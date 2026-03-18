---
title: 'Subscriptions and Consent'
description: 'How VAMP uses device-backed consent and membership proof for redistribution.'
sidebar:
  order: 7
---

This chapter defines subscription authorization and membership proof as the consent layer for VAMP redistribution. The earlier chapters already established the trust model in [Identity](/technical/identity/), the recipient control plane in [Discovery](/technical/discovery/), the custody model in [Message](/technical/message/), and the redistribution model in [Bulk](/technical/bulk/). This chapter explains how a recipient authorizes a list service to send redistributed mail and how that authorization is later proven to recipient infrastructure.

The design goal is strict but user-simple:

- users never manage keys directly
- a normal user gesture triggers consent
- the user's device signs the consent
- the sender stores proof
- later deliveries carry recipient-verifiable membership evidence

This is how VAMP turns "the sender says you subscribed" into "the recipient domain can verify that the recipient did subscribe." For the deeper research basis, see [WebAuthn-Style Subscription Authorization for VAMP](/research/signed-subscriptions/) and the related sender-cost and transport papers.

## Design thesis

VAMP subscriptions should be modeled as **device-signed consent assertions scoped to one sender domain and one list-service identity**. That gives the protocol three properties ordinary mailing-list systems lack:

1. membership is established by recipient-side cryptographic consent rather than sender-side bookkeeping alone
2. each subscribed delivery can present local proof of membership without requiring a live callback to the sender
3. revoke and unsubscribe can be handled as signed consent changes, not just sender promises

That is the right abstraction because the real problem is not how to store a subscriber row in a database. The real problem is how to make redistribution consent **portable, scoped, replay-resistant, and verifiable by the receiving side**.

## 1. Subscription assertion model

### What the assertion is

A subscription assertion is a signed statement that says, in effect:

> This recipient user, acting through this enrolled device, authorized this sender domain and this list-service scope to send subscribed redistribution mail.

It should be expressed in the same VAMP assertion family used elsewhere in the system so that subscription, identity, transport, and custody all stay inside one coherent signed-object model.

### What fields are included

At minimum, a subscription assertion should include:

- assertion type and version
- a stable subscription identifier
- recipient user identity
- recipient canonical address
- sender domain
- list-service identifier or service scope
- sender challenge or nonce
- issuance time
- optional expiry or revalidation window
- device identifier or device-chain reference
- user and organization chain references
- device signature over the whole assertion

Optionally, it may also include:

- policy class for the subscription
- recipient-local membership metadata that is safe to disclose
- a human-readable label for the list or service

The critical fields are the recipient identity, sender domain, service scope, freshness material, and device signature. Without those, the assertion loses either verifiability or anti-replay value.

### How scope works

The assertion must be tightly scoped to:

- one sender domain
- one list or service identity

That scope is essential. A proof authorizing `updates.example.org` to send `product-announcements` must not be reusable by:

- a different domain
- a different list under the same domain
- a different campaign under a distinct service identity if policy treats them separately

This is why the list-service identifier defined in [Bulk](/technical/bulk/) matters so much. Consent must bind to the actual redistribution service, not just to a vague brand label or page URL.

### How replay resistance is achieved

Replay resistance should come from the same model that WebAuthn relies on:

- a fresh sender challenge or nonce
- an issuance time
- an optional validity window
- sender-side tracking of used or superseded subscription states

The subscription assertion is therefore not just "I subscribe." It is "I subscribe to this exact service scope in response to this fresh challenge at this time."

## 2. Subscription flow

### 2.1 Sender challenge

The flow begins with the list service issuing a challenge scoped to:

- sender domain
- list-service identifier
- recipient identity or address
- freshness material

This challenge should be unique enough to prevent replay and precise enough to bind the user's consent to the correct relying party.

### 2.2 User gesture

The user performs a simple action such as:

- Subscribe
- Join list
- Enable updates
- Opt in to notifications

This preserves the UX rule that the user performs a human action, not a cryptographic ceremony.

### 2.3 Device-signed consent

After the user gesture, the client asks the device to sign the subscription assertion. The device is the right signing actor because it can attest that:

- an enrolled endpoint produced the assertion
- the assertion is tied to the fresh sender challenge
- the consent was released through the normal local security path

This is the same architectural logic used elsewhere in VAMP: devices sign because endpoint-origin facts belong at the endpoint.

### 2.4 Sender validation

The sender validates:

- challenge freshness
- sender-domain and service-scope match
- device signature
- device → user → organization chain
- any required revocation or validity state

Only after this validation should the sender treat the subscription as active.

### 2.5 Sender storage of proof

The sender stores the validated proof as durable subscription state. At minimum, it should retain:

- the full subscription assertion
- the current membership status
- the subscription identifier
- revocation status if later changed
- any relevant proof version or state version

This is not just operational bookkeeping. It is the sender's evidence that future redistributions are authorized for this recipient.

## 3. Per-message membership proof

### What the proof is for

Once a subscription exists, each subscribed delivery needs a way to prove to recipient infrastructure that:

- this recipient is actually a valid member of this list or service
- the current delivery is within the consent scope
- the proof is still valid and not revoked

Without that, the system falls back to sender assertion rather than recipient-verifiable consent.

### Baseline carriage model

The baseline VAMP design should carry the subscription proof **directly**, using the compact original subscription assertion or a minimally wrapped form that still contains it intact.

This is the best initial design because it is:

- the simplest to validate
- the least ambiguous
- fully local-verifiable by the recipient MTA
- aligned with the store-and-forward design of the protocol

### Derived proof as an optimization

A smaller derived proof may be a useful future optimization, but only if it remains locally verifiable and commits back to the original subscription assertion. That means derived proofs are acceptable later as an efficiency layer, not as an excuse to replace a strong baseline with a sender-controlled opaque reference.

So the recommended sequence is:

- baseline: carry the compact direct proof
- later optimization: allow compact derived proofs that cryptographically commit to the original consent

### How recipient MTAs validate it

Recipient MTAs should validate subscribed deliveries by checking:

- the proof signature and assertion integrity
- the recipient identity in the proof
- the sender domain in the proof
- the list-service identifier in the proof
- that the delivery's list service matches the proof scope
- freshness and validity window
- revocation state if known
- that the proof is not being reused outside its intended scope

The receiver should be able to do this locally, without needing the sender to answer an online query for each message.

## 4. Unsubscribe and membership revocation

### Revocation assertions

Unsubscribe should be modeled as a signed revocation assertion produced after a user gesture, not as a sender-local flag alone.

At minimum, the revocation assertion should bind:

- the original subscription identifier or proof reference
- recipient identity
- sender domain
- list-service scope
- a fresh challenge or nonce
- issuance time
- device signature

This is simply the reverse of subscription creation: the recipient uses a device-backed gesture to withdraw redistribution consent.

### Sender obligations

Once a sender receives and validates a revocation assertion, it should be required to:

- mark the subscription inactive
- stop sending subscribed mail under that subscription
- update stored membership state
- refuse to treat the old proof as active for future deliveries

The sender does not get to keep sending because it still has an old positive proof. Revocation changes the membership state.

### Recipient-side enforcement possibilities

Recipient-side enforcement is one of the strongest parts of the design. Because the recipient domain can validate and track proofs locally, it can also:

- record revoked subscription identifiers
- reject later messages claiming revoked membership
- treat unsubscribed list traffic as unauthorized even if the sender misbehaves

This is materially stronger than current sender-only unsubscribe semantics.

### Device compromise and subscription lifetime

The default policy should be that later device revocation does **not** automatically revoke every subscription the device once approved. A lost or replaced device does not necessarily negate the user's original consent.

However, if the device was revoked because of compromise, recipient policy may decide that subscriptions created during a compromise window should be revalidated. That is a policy lever, not the baseline default.

## 5. Abuse resistance

### Purchased lists

Purchased lists fail cleanly in this model because the sender does not possess recipient-specific device-signed consent. A database row or third-party marketing export is not enough to produce a valid VAMP subscription proof.

### Scraped addresses

Scraped addresses fail for the same reason. Knowing an address is not the same as having proof that the address owner authorized a particular list service to send redistribution mail.

### Forged subscriptions

Forged subscriptions are resisted by the device signature and the identity chain. An attacker or dishonest sender would need:

- the recipient device key
- or a way to forge the device → user → organization chain

That is much stronger than traditional double opt-in evidence, which is sender-generated and sender-validated.

### Replay

Replay is resisted by:

- fresh challenge issuance
- issuance time
- optional validity windows
- sender-side and recipient-side replay detection as needed

An old assertion replayed against a new subscription event or outside its validity window should fail.

### Token misuse across senders or lists

Token reuse across domains or lists is prevented by scope binding. A proof for:

- `news.example.org`
- `weekly-briefing`

must not work for:

- `alerts.example.org`
- `billing-notices`
- or any unrelated sender domain

This is one of the main reasons the proof must carry exact sender-domain and service-scope binding.

## 6. Privacy considerations

### Minimize exposure of user behavior

The system should reveal only what the recipient MTA needs to validate consent. The proof should establish "this recipient authorized this sender and service scope" without unnecessarily exposing extra behavioral or account history data.

### Keep proofs scoped and compact

Proofs should be:

- scoped to one sender domain
- scoped to one list-service identity
- compact enough for store-and-forward carriage
- short-lived or revalidated as policy requires

This reduces both replay value and correlation value.

### Avoid unnecessary device disclosure

The proof should not disclose more device detail than is necessary to validate that the consent came from a valid enrolled device. In particular, it should avoid gratuitous exposure of:

- raw device inventory
- rich attestation metadata
- device fingerprinting material

The device matters because it signs. It does not follow that every subscribed delivery should reveal everything about that device.

### Avoid live sender callbacks when possible

Recipient MTAs should not need to query the sender for each validation decision. Online lookup creates extra privacy leakage about when and where messages are being checked. A locally verifiable in-band proof is better for both privacy and robustness.

## Recommended baseline architecture

VAMP should adopt the following subscription rules.

1. **Use device-backed consent assertions as the root of subscription state.**  
   The subscription is established by recipient-side cryptographic consent, not sender promise alone.

2. **Scope every proof to one sender domain and one list-service identity.**  
   Consent must not bleed across senders or services.

3. **Use challenge-based freshness.**  
   Subscription and revocation events should both be bound to fresh sender challenges.

4. **Store the full validated proof at the sender.**  
   The sender's membership state must be backed by durable cryptographic evidence.

5. **Carry direct compact proof with subscribed deliveries as the baseline.**  
   Derived proofs can be added later as an optimization if they remain locally verifiable.

6. **Treat unsubscribe as signed revocation.**  
   Revocation is a cryptographic state change, not only a sender database toggle.

7. **Allow recipient-side enforcement of revocation.**  
   The receiving side should be able to reject continued subscribed mail that no longer has valid consent.

## Final assessment

Subscription and membership proof are the consent layer that makes VAMP redistribution honest. The redistribution chapter already established that lists, newsletters, and notifications are explicit list services rather than hidden relays. This chapter adds the missing reciprocal control: those services may redistribute only when they can prove the recipient authorized them to do so.

That is the architectural payoff. Users still experience a simple subscribe or unsubscribe gesture. Devices do the signing. Senders store the proof. Recipient infrastructure validates it locally. And bulk or list mail stops being a channel where the sender merely claims the recipient opted in. In VAMP, subscribed redistribution becomes a cryptographically provable state.
