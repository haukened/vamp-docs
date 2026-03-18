---
title: 'Message Flow'
description: 'The baseline end-to-end flow for native human-originated VAMP mail.'
sidebar:
  order: 5
---

This chapter tells the simplest complete operational story for VAMP: a normal human sends a message to another human using the native path. The earlier chapters established the trust model in [Identity](/technical/identity/), the control plane in [Discovery](/technical/discovery/), and the message and provenance primitive in [Message](/technical/message/). This chapter puts those pieces together into one end-to-end flow.

The baseline assumptions are:

- messages are encrypted to the recipient user identity
- devices sign messages
- sender-edge validates and authorizes transport
- recipient-edge validates the chain and applies local policy

This is the path VAMP should optimize first, because it is the reference case for how trust, transport, and user-visible semantics fit together before redistribution, bulk sending, migration bridges, or legacy fallback complicate the picture. For the surrounding transport and anti-abuse rationale, see [VAMP Native Transport Topology](/research/native-transport-topology/), [Sender-Cost Enforcement, Downgrade Resistance, and Operator Value](/research/threat-model-and-value/), and [Sender-Cost Mechanics](/research/sender-cost-mechanics/).

## Design thesis

The baseline VAMP mail flow should be understood as a sequence of five linked decisions:

1. **Can the sender discover and trust the recipient domain's native VAMP policy?**
2. **Can the sender resolve the recipient user identity?**
3. **Can the sender device produce a valid origin assertion over the canonical message object?**
4. **Will the sender-edge authorize this message for native transport?**
5. **Will the recipient-edge accept the chain under recipient policy and relationship state?**

That is the right level of abstraction because VAMP is not merely "encrypted mail." It is a system in which native delivery depends on identity, policy, provenance, and relationship-aware evaluation all being coherent at once.

## End-to-end summary

At a high level, the native human-mail flow is:

1. Alice composes a message to Bob.
2. Alice's client asks the sender-side system to discover Bob's domain policy and identity.
3. Bob's domain returns signed VAMP policy and Bob's deterministic identity object.
4. Alice's client encrypts the message to Bob's user identity.
5. Alice's device signs the canonical message object.
6. The message is submitted to Alice's sender-edge.
7. Alice's sender-edge validates Alice's identity chain and organization policy.
8. Alice's sender-edge adds transport authorization and sends the message directly to Bob's receiver-edge.
9. Bob's receiver-edge validates the message, origin chain, transport authorization, freshness, revocation status, and relationship state.
10. Bob's receiver-edge either delivers the message to Bob's mailbox with clear trust signals or rejects/quarantines it under policy.

The rest of this chapter expands that sequence.

## 1. Sender-side flow

### 1.1 Compose and identify the recipient

The user begins with an ordinary human action: composing a message to a recipient address such as `bob@example.net`. At this point the sender-side client knows only the destination address, not yet the recipient's native capability, policy, or user encryption material.

In VAMP, the client should not guess. It should treat addressing as the start of an authenticated control-plane process.

### 1.2 Recipient discovery

The sender-side system extracts the recipient domain and performs the bootstrap sequence defined in [Discovery](/technical/discovery/):

1. query `_vamp.<recipient-domain>` as `SVCB`
2. obtain the recipient domain's VAMP API authority
3. connect to that authority over HTTPS

This yields the recipient domain's signed bootstrap and policy material rather than forcing the sender to infer capability from transport accidents or SMTP fallback behavior.

### 1.3 Policy retrieval

The sender-side system retrieves the recipient domain's current signed policy object. That policy tells the sender:

- whether native VAMP delivery is supported
- which receiver-edge services are authoritative
- what lookup authentication profile is required
- the domain's downgrade posture
- the current directory version
- any cache or expiry constraints

This step matters because VAMP should not attempt native delivery on implied trust. The sender must know the recipient domain's declared native policy before it starts preparing the message for delivery.

### 1.4 Identity resolution

Once policy is in hand, the sender-edge or other authorized outbound service performs an authenticated exact-address lookup for the recipient. If policy allows resolution, the recipient domain returns a deterministic signed identity object containing the recipient user identity and encryption material or encryption reference.

This is where the sender learns the actual cryptographic recipient principal. The lookup is exact-address, authenticated, and attributable so that directory discovery does not become a harvesting oracle.

### 1.5 User-level encryption

The sender-side client encrypts the message to the **recipient user identity**, not to a list of recipient devices.

That choice follows directly from [Identity](/technical/identity/): the user is the stable recipient principal, while device fanout and local delivery are the recipient organization's internal lifecycle problem. This keeps the sender focused on "send to Bob" rather than "track every active Bob device."

### 1.6 Canonical message creation

The client constructs the canonical message object defined in [Message](/technical/message/):

- author identity
- recipient identity
- authored content
- attachment manifest
- authored timestamp
- any conversation metadata

The message is canonicalized and hashed before origin signing so that later validators can prove they are all talking about the same authored object.

### 1.7 Device signature

The originating device then signs the message-origin assertion over the canonical message digest. This origin step binds:

- the enrolled device
- the author user identity being acted for
- the canonical message object
- any required local security context

This is the first real provenance step in the chain. It says, in effect, "this enrolled endpoint originated this authored message object."

### 1.8 Submission to the sender-edge

After origin signing, the client submits the encrypted message, canonical message object, and origin assertion chain to the sender-edge. This completes the sender-side phase.

The sender-edge is now responsible for deciding whether this locally originated message may become organization-authorized native traffic.

## 2. Sender-edge processing

### 2.1 Identity-chain validation

The sender-edge validates the sender-side chain upward from the device:

- device enrollment and status
- user binding
- organization authority
- sender-edge's own authority to act for the domain

This is where the system confirms that the device signature is not merely well-formed, but rooted in a currently valid identity chain for the claimed sender.

### 2.2 Revocation and freshness checks

Before authorizing transport, the sender-edge should check:

- whether the device has been revoked
- whether any required user or organization assertions are revoked
- whether the origin assertion is fresh enough for policy
- whether the message or any attached assertion is stale or replayed

These checks matter because endpoint signatures are only as useful as their current validity. A valid-looking signature from a revoked device should not become authorized transport.

### 2.3 Policy evaluation

The sender-edge evaluates local sender policy, including:

- whether the sender is allowed to use native human-mail semantics
- whether the sender is inside budget, quota, or sender-cost policy
- whether the recipient relationship is established or first-contact
- whether the message is being downgraded against policy
- whether the message belongs in a different lane such as bulk, notification, or compatibility handling

This is one of the key architectural distinctions in VAMP. A device may originate a message, but the organization decides whether that message is allowed onto the network as native traffic.

### 2.4 Organizational transport attestation

If the sender-edge approves the message, it appends the organization-authorized custody step defined in [Message](/technical/message/). That custody assertion states that:

- the sender organization validated the origin chain
- the message is authorized for native transport
- this sender-edge admitted it under policy

This turns endpoint-origin evidence into accountable inter-domain transport authority.

### 2.5 Native transmission to the recipient-edge

The sender-edge then transmits the message directly to the authoritative recipient-edge learned during discovery. This should be the ordinary native path:

- sender-edge to receiver-edge
- no unaffiliated transit relay
- no hidden laundering hop

This is where the transport research matters operationally. The narrow native path makes downgrade and relay laundering easier to detect because there is only one external native hop to reason about.

## 3. Recipient-edge processing

### 3.1 Receipt and chain validation

When the message arrives, the recipient-edge validates:

- the canonical message object
- the message digest
- the device-origin assertion
- the sender device → user → organization chain
- the sender-edge transport authorization
- any other custody assertions present

This is both cryptographic and semantic validation. The recipient-edge must know not only that signatures verify, but also what each role in the chain means.

### 3.2 Revocation and freshness checks

The recipient-edge should then check:

- whether the sender device is revoked
- whether the sender organization or relevant assertions are revoked
- whether the policy and identity objects used are still fresh enough
- whether the message-origin and transport assertions fall within acceptable freshness windows
- whether replay or stale-chain indicators exist

This is especially important for identity compromise scenarios. The broader threat model already makes clear that compromised trusted senders are not solved by transport shape alone; revocation and freshness remain core controls.

### 3.3 Relationship-aware and first-contact evaluation

After basic validation, the recipient-edge applies recipient policy and relationship state. This is where it distinguishes:

- known sender in an established relationship
- first contact from a new sender
- known sender on a newly enrolled device
- previously trusted sender now presenting degraded trust state

This step should be explicit because the research already argues that relationship history matters. Real mail systems already distinguish first contact from established correspondents, and VAMP should make that distinction native rather than heuristic.

### 3.4 Mailbox delivery decision

The recipient-edge then makes the local delivery decision. Typical outcomes are:

- accept and deliver normally
- accept and deliver with a visible caution state
- hold for quarantine or review
- reject as invalid or policy-violating

This is the final network-facing decision point. Once the message passes here, the recipient domain can proceed with local delivery and user presentation.

## 4. User-visible trust signals

VAMP should not stop at backend validation. Recipient software should surface trust states that correspond to the actual chain and relationship evidence.

### Known sender

This state means:

- the sender identity chain validated
- the sender organization authorized transport
- the sender is already known to the recipient or recipient domain under local policy
- there are no active caution indicators

This is the closest equivalent to "normal trusted mail."

### First contact

This state means:

- the sender chain is valid
- the message is native and policy-compliant
- but the sender has no established relationship history with the recipient

This is important because first contact is a different risk class from ongoing correspondence, even when the message is otherwise authentic.

### Known sender on new device

This state means:

- the sender identity is already known
- but the current origin device is new, recently enrolled, or previously unseen in this relationship

This is a strong example of why VAMP separates user identity from device provenance. The recipient should be able to understand: "this is still Alice, but from a newly observed device."

### Revoked device

This state means:

- the message presents a device-origin claim
- but the relevant device is revoked, expired, or otherwise invalid for current policy

Depending on policy, this may lead to rejection rather than merely a warning. But when exposed in a UI or audit trail, it should be unmistakable.

### Lookalike or inconsistent sender identity

This state means the message presents some form of inconsistency, such as:

- a display identity inconsistent with the validated sender identity
- a lookalike or suspiciously confusable sender namespace
- custody or transport assertions that do not align cleanly with the claimed author

This is where VAMP can do materially better than legacy mail. Because the sender identity and custody chain are structured and validated, the client can warn on concrete inconsistency instead of relying only on fuzzy content heuristics.

## 5. Failure cases

The baseline flow must define its main failure modes clearly.

### Unresolved identity

If recipient discovery succeeds but exact-address identity resolution fails under policy, native delivery should not proceed as if the recipient were known. Depending on sender policy, the result may be:

- hard failure
- retry after policy-directed delay
- explicit fallback to a compatibility lane if allowed

What should not happen is silent continuation with invented recipient trust.

### Policy mismatch

If the sender and recipient policies are incompatible, native delivery should stop. Examples include:

- recipient requires a sender-authentication profile the sender cannot satisfy
- recipient policy forbids the sender's transport or sender class
- sender policy forbids the required downgrade or alternate handling

This is a clean failure, not an ambiguity.

### Revoked device

If the originating device is revoked, expired, or otherwise invalid, the sender-edge should normally refuse transport authorization. If the problem is detected only at the recipient-edge, the recipient should reject or quarantine according to policy.

Either way, the message should not be treated as ordinary valid human mail.

### Downgrade attempt

If a domain is known to be VAMP-capable and the flow attempts to bypass native delivery through SMTP or another weaker path, the event should be treated as an explicit downgrade. Depending on phase and policy, outcomes may include:

- rejection
- throttling
- junking
- degraded trust classification

The important rule is that downgrade is explicit, not silent. This follows directly from the HSTS/MTA-STS-style reasoning already adopted in the research and discovery chapters.

### Stale or invalid assertions

If required identity, policy, origin, or transport assertions are stale, malformed, unverifiable, or outside acceptable freshness windows, the message should fail validation. Native delivery depends on currently valid assertions, not just historically valid ones.

## Recommended baseline flow

VAMP should adopt the following baseline native human-mail flow.

1. **Discover before sending.**  
   Resolve recipient capability, policy, and identity before native transmission.

2. **Encrypt to the user, not the devices.**  
   The recipient user identity is the external delivery target.

3. **Let the device establish origin.**  
   The endpoint signs the canonical message object.

4. **Let the sender-edge authorize transport.**  
   Organization policy, sender state, and revocation checks happen before network transmission.

5. **Deliver only over the direct native path.**  
   Native mail is sender-edge to receiver-edge, not arbitrary relay choreography.

6. **Let the recipient-edge make the final trust decision.**  
   Chain validation, freshness, revocation, and relationship-aware policy all converge there.

7. **Expose meaningful trust states to the user.**  
   Known sender, first contact, new device, revoked device, and identity inconsistency should be first-class UI outcomes.

## Final assessment

This baseline flow is the simplest complete story VAMP needs to tell. A human composes a message, the sender resolves and trusts the recipient identity, the device signs, the organization authorizes, the message moves directly from sender-edge to receiver-edge, and the recipient domain decides whether to deliver based on both cryptographic validity and relationship-aware policy.

That is the architectural payoff of the prior chapters. Identity defines who may act. Discovery defines how the sender learns where and how to deliver. The message chapter defines what is signed. The flow chapter shows how those decisions become an operational mail system: **native human mail in VAMP is not just message transmission, but policy-governed trust establishment from composition to inbox.**
