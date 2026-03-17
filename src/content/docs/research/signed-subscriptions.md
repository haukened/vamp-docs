---
title: WebAuthn-Style Subscription Authorization for VAMP
---

## 1. Executive Summary

This paper recommends a **cryptographic subscription authorization model** for VAMP in which a user’s device signs a sender-scoped subscription assertion after an explicit user gesture, the sender validates that assertion against the VAMP identity chain, and subsequent list or bulk deliveries carry a compact, locally verifiable proof of consent. The design borrows the strongest properties of WebAuthn—**device-bound keys, explicit user consent, verifier-name binding, and replay-resistant challenge-response**—but adapts them to an asynchronous mail system rather than an online login ceremony.[^1][^2][^3]

The core conclusion is that VAMP should treat **bulk mail, newsletters, notifications, and mailing lists as one list-service primitive**, not as separate channels. Existing email standards already distinguish list identity and list control functions through headers such as List-Id and List-Unsubscribe, and major providers now require one-click unsubscribe and explicit subscription hygiene for high-volume senders. What the current ecosystem lacks is a **recipient-verifiable proof that the recipient actually consented**. VAMP can fill that gap by replacing “double opt-in plus sender honesty” with “device-signed consent plus recipient-side verifiability.”[^4][^5][^6][^7]

The recommended baseline architecture is:

1. A list service or bulk sender issues a **domain- and list-scoped challenge**.  
2. The user performs a simple action such as “Subscribe.”  
3. The VAMP client asks the device to sign a **subscription assertion** bound to:
   - the recipient identity,
   - the sender domain,
   - the list/service identifier,
   - the challenge,
   - and a freshness value.  
4. The sender validates the assertion against the VAMP device → user → organization chain and stores the resulting proof.  
5. Each subscribed delivery carries a **compact subscription proof** that the recipient MTA can verify without a synchronous callback to the sender.  
6. Unsubscribe is the same pattern in reverse: a user gesture generates a signed revocation assertion, and both sender and recipient domain can enforce it.[^1][^2][^3][^8][^9]

This model directly addresses the main weaknesses of existing email list management: it makes consent **cryptographically verifiable**, gives recipient MTAs a way to reject unsolicited bulk mail even if the sender claims otherwise, and preserves the user experience rule that **humans never handle crypto**. It does **not** eliminate every list-abuse problem; compromised devices, compromised user accounts, and malicious but already authorized senders still require revocation, anomaly detection, and sender reputation controls. But for the abuse class “someone is sending bulk or list mail without solid proof that the recipient asked for it,” this model is materially stronger than the current state of the art.[^5][^6][^7][^10]

## 2. Background and Problem Statement

The current email list ecosystem already has standards for identifying lists and signaling unsubscribe actions. RFC 2369 standardizes List-Help, List-Subscribe, and List-Unsubscribe headers as a way for mailing-list software to expose command URLs in messages; RFC 2919 provides List-Id as a unique identifier for a mailing list regardless of which host currently runs the list processor; and RFC 8058 extends List-Unsubscribe with a one-click HTTPS POST mechanism so mailbox software can safely automate unsubscription without accidentally triggering it by prefetching URLs.[^4][^11][^12] These are useful standards, but none of them provide **cryptographic proof that the recipient actually subscribed**.

Large providers now enforce stronger operational expectations around those same workflows. Google’s sender guidance says that senders of **5,000 or more messages per day** must support one-click unsubscribe for marketing and subscribed messages, and Google’s subscription-message guidance says senders should implement one-click unsubscribe, honor unsubscribe requests within **48 hours**, and obtain **double consent** before sending subscription messages.[^5][^6] These requirements improve user control and deliverability, but they still depend on the sender maintaining accurate subscription state and honestly representing that state to the receiver.

That limitation matters because today’s recipient MTA can usually verify only **sender authentication and sender policy compliance**, not **recipient consent**. RFC 8058 even requires that one-click unsubscribe headers be covered by a valid DKIM signature, but that only proves the sender authenticated the unsubscribe metadata; it does not prove the user wanted the messages in the first place.[^12] In other words, the current system can verify “this sender supports unsubscribe” far more easily than it can verify “this recipient actually authorized this subscription.”

VAMP’s list model changes that target. In the VAMP architecture already established, mailing lists and bulk senders are not separate channels; they are both **list services** that redistribute messages and append custody assertions. Once that is true, the missing control becomes obvious: the list service must be able to prove, cryptographically, that a particular recipient is a legitimate member of that list. That is the problem this paper solves.[^13]

## 3. WebAuthn and Device-Based Authorization

WebAuthn provides the most relevant existing pattern for solving this problem without exposing users to key management. The WebAuthn specification defines an API for creating and using **scoped public-key credentials** that are created by and bound to authenticators, while the user agent mediates access to those authenticators to preserve privacy. The specification also states that authenticators are responsible for ensuring that **no operation is performed without user consent** and that they provide cryptographic proof of their properties through attestation.[^1]

Two properties of WebAuthn are especially important for VAMP. First, WebAuthn credentials are scoped to a **Relying Party**, and credentials can be accessed only by origins that belong to that relying party. Second, WebAuthn’s normal authentication flow is **challenge-based**, so assertions are tied to a fresh verifier-supplied challenge rather than being replayable forever. NIST SP 800-63B describes this as **verifier name binding** and **replay resistance**, and explicitly cites WebAuthn as a standard that provides phishing resistance by binding authenticator output to the authenticated domain name of the verifier.[^2][^3]

These properties map cleanly to subscription authorization. A mailing list or bulk sender is conceptually a **Relying Party**. A subscription action is conceptually a **consent ceremony** rather than a login ceremony. The user’s device already holds a signing key under VAMP’s device → user → organization hierarchy. So VAMP does not need users to create and handle a new token manually; it needs the client to present the user with a simple UI gesture and then have the device sign a **sender-scoped challenge** proving that the user authorized the subscription.[^1][^2]

The most important adaptation is what VAMP does **not** need to copy. WebAuthn often creates a new credential per relying party. VAMP already has an enrolled device identity chain, so it does not necessarily need to mint a new long-lived credential for each list. The security properties VAMP needs—user consent, verifier binding, and freshness—come from the **challenge, scope, and signature**, not from per-list credential proliferation. That is a design inference from the WebAuthn and NIST properties, not a directly standardized email pattern, but it follows from the standards’ stated goals and keeps the mail system simpler.[^1][^2][^3]

## 4. Subscription Assertion Design

The subscription assertion should be a compact, signed statement of consent. At minimum, it needs to bind together:

- the **recipient identity**,
- the **sender domain**,
- the **list or service identifier**,
- a **fresh challenge or nonce**,
- an **issuance time**,
- and optionally an **expiry** or validity window.[^2][^3][^8]

The sender/list scope should not be an arbitrary URL. NIST’s verifier-name-binding guidance says that for DNS identifiers the verifier identifier should be the authenticated hostname or a parent domain below the public suffix, and WebAuthn scopes credentials to a relying party rather than to arbitrary page URLs.[^2][^3] For VAMP, that strongly suggests the right binding surface is **the sender domain plus a stable list/service identifier**, not a specific HTTP path. RFC 2919’s List-Id is directly useful here because it already provides a standards-track way to uniquely identify a mailing list independently of the specific host currently serving it.[^11]

A good subscription assertion therefore looks conceptually like this:

- subject: the recipient identity
- audience: the sender domain
- scope: the list or service identifier
- challenge: sender-generated nonce
- issued-at: time of consent
- optional expiry or revalidation window
- device signature over the whole object
- references to the user and organization identity chain

The exact serialization should be compact. RFC 8392 defines CWT as a compact claims format using CBOR and COSE, and RFC 9052 explicitly says COSE is suitable for **store-and-forward or offline protocols**. RFC 8949 adds that CBOR’s design goals include small code size and small message size. That makes CWT/COSE a very strong fit for subscription assertions and later per-message consent proofs in VAMP.[^8][^9][^14]

One subtle design point matters for privacy. WebAuthn and later FIDO2 privacy work treat linkability seriously. The W3C spec says the user agent mediates authenticator access to preserve privacy, and recent academic work notes that metadata outside the pure WebAuthn component can create linkability concerns even when the core WebAuthn analysis shows unlinkability properties.[^1][^15] So VAMP should minimize unnecessary exposure of raw authenticator or attestation metadata. The subscription assertion should prove device-backed consent, but it should not carry more device fingerprinting information than the recipient domain needs to validate the sender’s claim.

## 5. Subscription Lifecycle and Flow

The subscription ceremony should be modeled explicitly and should remain user-simple.

### 5.1 Request and challenge

The list service presents a subscription request and generates a fresh challenge. This challenge must be unique enough to provide replay resistance, just as WebAuthn and NIST rely on fresh challenges/nonces to defeat replay.[^2][^3] The service should also identify the sender domain and the list/service scope up front, so the client can bind the authorization to the correct relying party.

### 5.2 User gesture and device signature

When the user clicks “Subscribe,” the client asks the device to sign the subscription assertion. This mirrors WebAuthn’s core pattern: the device performs the cryptographic operation only after **user consent**, and the resulting assertion is device-bound but understandable to the relying party through the public-key chain.[^1]

### 5.3 Sender validation and storage

The sender validates:

- the challenge freshness,
- the device signature,
- the device → user → organization chain,
- and the scope binding to its own sender identity.

The sender then stores the subscription proof. This is analogous to how current mailing-list systems store subscription state after a successful double opt-in, except that in VAMP the resulting state is grounded in a cryptographic assertion rather than just a clicked URL.[^6][^12]

### 5.4 Comparison with current double opt-in

Google’s subscription-message guidance says senders should confirm the recipient’s email address after it is entered on a website or app and calls this **double consent**.[^6] Current double opt-in improves over single-form submission because it proves the address owner could receive and act on a confirmation message, but it still depends on a sender-operated workflow and does not create a reusable, recipient-verifiable proof for downstream MTAs. A VAMP subscription assertion is therefore best understood as a **cryptographic successor to double opt-in**, not as an entirely different business process.[^6]

## 6. Integration with the VAMP Custody Chain

VAMP’s custody chain model changes how list-originated mail is represented. Mailing lists and bulk senders do not replace the original sender; they append **custody assertions**. That means a distribution message can preserve both:

- the **author or publisher identity**, and
- the **list service identity** that redistributed the message.[^13]

Subscription proof should integrate into that same model. The recommended baseline is that each list-originated or bulk-originated message carries:

1. the normal custody chain,
2. a compact **subscription proof** or subscription-proof reference,
3. and the list/service identifier.

The strongest baseline for a store-and-forward system is to carry a **compact, self-contained proof** rather than a sender-hosted reference that the recipient MTA would need to dereference online. RFC 5598 describes Internet Mail as an **asynchronous sequence of point-to-point transfer mechanisms**, and RFC 9052 explicitly notes that COSE is for store-and-forward or offline protocols.[^9][^16] That makes in-band proof carriage more appropriate as a baseline than online lookup.

In practice, that means the per-message proof should either be:

- the compact signed subscription assertion itself, or
- a compact signed derivative that is still locally verifiable by the recipient MTA.

A pure opaque reference is weaker because it forces the recipient MTA to trust sender-controlled state or perform an extra online query during delivery, which cuts against VAMP’s store-and-forward design goals.[^9][^16]

Recipient MTAs may still **cache** validated subscription proofs keyed by recipient identity, sender domain, and list/service scope to reduce repeated validation overhead. That is an optimization, not a security dependency.

## 7. Revocation and Unsubscribe Mechanisms

Current email unsubscribe is sender-controlled. RFC 8058 standardizes a one-click HTTPS POST mechanism and requires the relevant headers to be DKIM-signed; Google requires one-click unsubscribe for high-volume subscribed messages and says unsubscribe requests must be honored within **48 hours**.[^5][^6][^12] This is useful operationally, but it still depends on sender compliance.

VAMP can improve on this by making unsubscribe a **signed revocation assertion** produced by the recipient’s device after a user gesture, using the same basic pattern as subscription creation. That revocation assertion should bind:

- the original subscription or its stable identifier,
- the sender domain,
- the list/service scope,
- a fresh challenge or nonce,
- and the user identity.[^1][^2]

The sender must honor the revocation, but the recipient side should also gain an enforcement mechanism. Because the recipient domain is already the receiver and the user’s identity authority in VAMP’s architecture, it can maintain a local record that the subscription has been revoked and treat subsequent list mail with the same subscription identifier as unauthorized. This is a design recommendation rather than an existing deployed standard, but it follows directly from VAMP’s domain-authoritative identity model and improves materially on sender-only unsubscribe semantics.

A policy choice remains: if the device that originally authorized the subscription is later revoked, should the subscription remain valid? The safest default is **not** to invalidate all prior subscriptions automatically on device revocation, because a lost or reimaged device does not necessarily negate the user’s consent. However, if the device was revoked specifically for compromise, the recipient organization may reasonably choose to require resubscription for subscriptions approved by that device after a given cutoff. That is a VAMP policy choice, not something directly standardized by WebAuthn or mailing-list RFCs.

## 8. Security Analysis

### 8.1 Forged subscription attempts

Because the subscription assertion is signed by the recipient’s device key and chained to the user and organization, a sender cannot forge valid subscriptions unless it can forge that device signature or compromise the device/user identity chain. That is substantially stronger than ordinary double opt-in links, which are sender-issued and sender-validated.[^1][^2][^6]

### 8.2 Replay attacks

Replay resistance is addressed by the same principle NIST and WebAuthn rely on: **fresh challenges or nonces**. If the challenge is unique per subscription ceremony and the assertion includes the challenge and issuance time, replay of an old assertion is detectable.[^2][^3]

### 8.3 Token reuse across senders or lists

Binding the assertion to the sender domain and list/service identifier prevents a proof created for one sender or one list from being reused for another. RFC 2919’s list identifier is useful here because it gives a stable and unique identifier for the list itself.[^11] This is an important improvement over generic “email confirmation” workflows that prove mailbox control but not narrowly scoped consent.

### 8.4 Impersonation of list services

The sender-side list service must itself be authenticated in the VAMP custody chain. That prevents an arbitrary party from attaching a user’s subscription proof to mail that did not come from the subscribed list identity. This is another area where VAMP is stronger than today’s email headers: current List-Unsubscribe and List-Id headers are useful, but they do not by themselves create a cryptographically verifiable sender/list binding.[^4][^11][^12]

### 8.5 List harvesting

Cryptographic subscriptions dramatically weaken the value of scraped email lists. A scraped address without a subscription proof is simply not eligible for list delivery in VAMP native mode. This does not eliminate all malicious list sending—bad actors can still send unwanted messages outside the subscription model—but it gives recipient MTAs a strong signal for rejecting **purportedly subscribed** bulk mail that lacks proof.

### 8.6 Compromised devices and user accounts

WebAuthn-style device assertions are only as good as the device and account that produce them. Recent research on FIDO2 notes that privacy and authentication guarantees can be complicated by metadata and by the CTAP/client side of the system, and that malware-mediated attacks on the path to a hardware token have been demonstrated in the literature.[^15] VAMP should therefore treat subscription authorization as one strong control, not the only control. Device revocation, account revocation, anomaly detection, and sender reputation remain necessary.

## 9. Privacy Considerations

The subscription model should avoid unnecessary exposure of user behavior. A sender obviously learns that a user subscribed, but recipient-side validation should not require broad publication of subscription state.

Three privacy goals are important:

1. **Minimize repeated device fingerprint disclosure.**  
   WebAuthn and later FIDO2 analysis both emphasize privacy and unlinkability concerns. VAMP should therefore keep the subscription proof compact and avoid disclosing more attestation/device metadata than is required to validate consent.[^1][^15]

2. **Scope subscriptions tightly.**  
   Proofs should be bound to a specific sender domain and list/service identifier so they cannot be reused or correlated across unrelated senders.[^2][^3][^11]

3. **Avoid sender-hosted live validation dependencies.**  
   If recipient MTAs must query the sender for proof on every delivery, the sender gains additional observation power over when and where messages are being validated. A locally verifiable in-band proof is better for privacy and for mail-system robustness.[^9][^16]

These considerations point again to a compact signed token carried with the message or cached by the recipient domain, rather than a pure online-reference model.

## 10. Comparison with Existing Systems

### 10.1 Traditional mailing list headers

RFC 2369 and RFC 2919 standardize list control and identification metadata. They are valuable because they let mail clients expose subscribe/unsubscribe actions and consistently identify list traffic.[^4][^11] But they do not prove that the recipient ever consented to membership.

### 10.2 RFC 8058 one-click unsubscribe

RFC 8058 improves unsubscribe safety and automates the action, and it requires the unsubscribe headers to be DKIM-signed.[^12] That is stronger than an unsigned footer link, but it still proves the sender supports one-click unsubscribe—not that the sender had legitimate subscription proof to begin with.

### 10.3 Double opt-in

Google’s subscription guidance recommends double consent and timely unsubscribe processing, which reflects modern best practice.[^6] But double consent still produces sender-controlled evidence, not recipient-verifiable evidence.

### 10.4 WebAuthn

WebAuthn provides the best building blocks for VAMP subscription authorization because it already solves:

- explicit user consent,
- device-bound private keys,
- verifier-name binding,
- and replay resistance.[^1][^2][^3]

VAMP is not reusing WebAuthn as a web-login protocol; it is adapting the same security properties to a messaging-consent ceremony.

## 11. Proposed VAMP Subscription Architecture

Based on the standards and research reviewed here, the recommended VAMP subscription architecture is:

1. **List identity**  
   Every mailing list, newsletter, or notification feed is represented by a stable list/service identity under a sender domain, ideally aligned with a List-Id-like identifier.[^11]

2. **Subscription request**  
   The list service issues a challenge scoped to:
   - sender domain,
   - list/service identifier,
   - recipient address,
   - freshness/nonce.

3. **User consent**  
   The user performs a simple gesture such as “Subscribe.”

4. **Device-signed subscription assertion**  
   The client asks the device to sign the scoped challenge using the device’s VAMP signing key. The assertion chains to user and organization identity.

5. **Sender validation and storage**  
   The sender validates the chain and stores the proof.

6. **Per-message consent proof**  
   Each list/bulk message carries a compact, locally verifiable subscription proof or a compact derivative of the original subscription assertion, sufficient for recipient MTA validation without a synchronous sender callback.

7. **Unsubscribe/revoke**  
   The user performs a simple “Unsubscribe” gesture; the client generates a revocation assertion; the sender must honor it; the recipient domain may also record the revocation locally to reject further mail with the same subscription identifier.

This model preserves the UX rule that users never handle cryptography, while giving recipient MTAs something the current ecosystem lacks: **cryptographic evidence of recipient consent**.

## 12. Trade-offs and Open Research Questions

Several important questions remain.

### 12.1 Full assertion versus compact derivative
The cleanest baseline is to carry a compact, locally verifiable proof with each message, but there is still a design choice between:
- carrying the full original assertion every time, or
- carrying a smaller derivative bound to the original proof.

The former is simpler; the latter may be more privacy- and bandwidth-efficient.

### 12.2 Local recipient-side revocation state
Using recipient-side local state to enforce unsubscribe is one of the strongest VAMP improvements, but it needs a precise design for how revocation identifiers are keyed, cached, and synchronized across recipient infrastructure.

### 12.3 Device compromise semantics
The right policy for subscriptions created by later-compromised devices deserves deeper work. Immediate invalidation is safer, but may over-disrupt legitimate subscriptions.

### 12.4 Privacy of subscription proofs
The proof format should be stress-tested to ensure it does not leak more device or user metadata than necessary. The FIDO2 privacy literature suggests this is a non-trivial design concern.[^15]

## 13. Conclusions

The current email ecosystem has standards for identifying lists and standardizing unsubscribe actions, and large providers now require one-click unsubscribe and better subscription hygiene. What it still does not have is **recipient-verifiable proof of subscription consent**.[^4][^5][^6][^12]

A WebAuthn-style device authorization model is the strongest known pattern for filling that gap without violating VAMP’s non-negotiable UX requirement that **humans never touch the crypto**. WebAuthn already provides the right primitives—device-bound keys, explicit user consent, verifier binding, and challenge-based replay resistance—and those properties transfer naturally to list subscription authorization.[^1][^2][^3]

The key design move is to treat subscriptions not as email headers or sender-local database rows, but as **cryptographically signed consent assertions** that integrate into VAMP’s broader identity and custody architecture. That makes mailing lists and bulk mail a natural extension of the same protocol rather than a loophole around it. The result is a system where bulk distribution can remain usable, but only when recipient consent is provable.

## Footnotes

[^1]: W3C, Web Authentication: An API for accessing Public Key Credentials Level 3. The specification defines scoped public-key credentials, says authenticators are responsible for ensuring no operation is performed without user consent, and says the user agent mediates access to authenticators and their public key credentials to preserve user privacy. https://www.w3.org/TR/webauthn-3/

[^2]: NIST SP 800-63B (Revision 4 draft), Digital Identity Guidelines: Authentication and Authenticator Management. NIST defines verifier name binding and replay resistance, and cites WebAuthn as an example of a standard that provides phishing resistance by binding authenticator output to the authenticated domain name of the verifier. https://pages.nist.gov/800-63-4/sp800-63b.html

[^3]: W3C, Web Authentication Level 2. The Recommendation states that public key credentials are scoped to a WebAuthn Relying Party and bound to authenticators. https://www.w3.org/TR/webauthn-2/

[^4]: RFC 2369, The Use of URLs as Meta-Syntax for Core Mail List Commands and their Transport through Message Header Fields. RFC 2369 defines List-Help, List-Subscribe, List-Unsubscribe, and related list control headers. https://www.rfc-editor.org/rfc/rfc2369

[^5]: Google Workspace Admin Help, Email sender guidelines FAQ. Google requires bulk senders to make it easy for recipients to unsubscribe, classifies bulk senders starting at roughly 5,000 messages/day, and from November 2025 ramps enforcement on non-compliant traffic. https://support.google.com/a/answer/14229414?hl=en

[^6]: Google Workspace Admin Help, Email subscription guidelines for senders. Google defines subscription messages, recommends one-click unsubscribe, requires honoring unsubscribe requests within 48 hours, and recommends double consent before sending subscription messages. https://support.google.com/a/answer/15263077?hl=en

[^7]: Yahoo Sender Hub, Sender Best Practices. Yahoo’s official deliverability guidance emphasizes sending wanted mail to active and engaged audiences and frames opt-in and easy unsubscribe as core anti-abuse expectations for bulk senders. https://senders.yahooinc.com/best-practices/

[^8]: RFC 8392, CBOR Web Token (CWT). CWT is a compact means of representing claims between parties using CBOR and COSE. https://www.rfc-editor.org/rfc/rfc8392

[^9]: RFC 9052, CBOR Object Signing and Encryption (COSE): Structures and Process. COSE is intended for store-and-forward or offline protocols and defines signatures, MACs, and encryption over CBOR. https://www.rfc-editor.org/rfc/rfc9052.html

[^10]: RFC 8949, Concise Binary Object Representation (CBOR). CBOR’s design goals include small code size, fairly small message size, and deterministic encoding support. https://www.rfc-editor.org/rfc/rfc8949

[^11]: RFC 2919, List-Id: A Structured Field and Namespace for the Identification of Mailing Lists. RFC 2919 defines a unique identifier for a mailing list independent of the host currently serving as the list processor. https://www.rfc-editor.org/rfc/rfc2919

[^12]: RFC 8058, Signaling One-Click Functionality for List Email Headers. RFC 8058 defines one-click unsubscribe via HTTPS POST, requires the List-Unsubscribe and List-Unsubscribe-Post headers to be DKIM-signed, and requires the URI to contain enough information to identify the recipient and list automatically. https://www.rfc-editor.org/rfc/rfc8058

[^13]: Prior VAMP design assumption from this conversation: mailing lists and bulk mail are treated as one list-service primitive that preserves authorship through the custody chain rather than replacing the sender identity.

[^14]: RFC 8392 and RFC 9052 together support a compact signed token model suitable for asynchronous mail, allowing subscription assertions to be represented as claims protected by COSE in a store-and-forward environment. https://www.rfc-editor.org/rfc/rfc8392 and https://www.rfc-editor.org/rfc/rfc9052.html

[^15]: Alkhazaali et al., Privacy and Security of FIDO2 Revisited, Proceedings on Privacy Enhancing Technologies 2025(3). The paper notes that WebAuthn privacy has been formally analyzed, but also that metadata and CTAP-side behavior can affect privacy and linkability, which is relevant when adapting device-backed assertions outside the exact browser-login setting. https://www.petsymposium.org/popets/2025/popets-2025-0100.pdf

[^16]: RFC 5598, Internet Mail Architecture. RFC 5598 describes Internet Mail as an asynchronous sequence of point-to-point transfer mechanisms, which supports the recommendation that recipient MTAs should be able to validate subscription proof without live online lookups to sender-side systems. https://www.rfc-editor.org/rfc/rfc5598