---
title: 'Revocation and Lifecycle'
description: How VAMP handles freshness, key rotation, revocation, and lifecycle over time.
sidebar:
  order: 9
---

The earlier chapters defined VAMP's trust hierarchy, discovery model, custody semantics, native flow, redistribution model, subscription proof, and sender-cost enforcement. This chapter closes the architecture story by defining how those objects change over time. The problem is not just compromise. It is routine churn: devices are replaced, users leave, list memberships go stale, organizations rotate keys, delegated edges move, and caches age out at different times.

VAMP therefore needs a lifecycle model that is secure without becoming online-fragile. The baseline design should minimize synchronous per-message live checks, preserve store-and-forward delivery, and prefer short-lived signed assertions plus explicit versioning over OCSP-style dependency on hot-path status services.

## Design Thesis

VAMP should treat lifecycle as **signed state with bounded freshness**, not as a permanent online query problem.

That means five design choices follow naturally:

1. identity and policy objects carry explicit validity windows
2. directories and policy documents advance through explicit signed versions or epochs
3. revocation is distributed as signed state through the same authority chain that issued the object
4. emergency invalidation exists, but it complements short-lived objects rather than replacing them
5. recipient and sender infrastructure may cache aggressively, but only within clearly defined staleness windows

This keeps the protocol compatible with asynchronous delivery while still giving operators a way to respond quickly to compromise.

## 1. Device Lifecycle

### Enrollment

Device lifecycle begins with explicit enrollment under the user and organization identity chain described in [Identity](/technical/identity/). Enrollment should produce a new device enrollment assertion that binds:

- the device key
- the user identity
- the organization authority
- device posture metadata
- issuance time
- activation time
- expiry or renewal horizon
- current status

The key architectural point is that enrollment creates a new active signer, but it does not change the user identity. Messages remain encrypted to the user, while the new device gains authority to produce future signatures.

### Replacement

Device replacement should normally be additive first and subtractive second. A new device is enrolled and becomes active before the old one is retired, allowing overlap during migration. That overlap is important because it avoids unnecessary trust resets when a user upgrades hardware, replaces a battery-failed laptop, or moves to a new phone.

The recipient experience should reflect that distinction. A known sender on a new device is not the same event as a new sender identity. The flow chapter already treats that as a separate trust state, and the lifecycle model should preserve it.

### Revocation

Device revocation should be a signed status change issued by the organization authority. At minimum, the revocation state should identify:

- the revoked device identifier
- the affected user
- the reason code if policy supports it
- the effective time
- the issuing authority
- the directory or revocation-state version in which the change became active

The baseline effect is simple: a revoked device may no longer produce valid new origin or consent assertions after its effective revocation time.

### Compromise Handling

Compromise needs stronger semantics than ordinary retirement. If a device is revoked for compromise, recipient and sender policy may treat a wider window of assertions as suspect, including:

- recent origin assertions from that device
- subscription assertions created during a compromise window
- unsubscribe or consent changes whose timing overlaps the incident

The system should therefore support both:

- a general `revoked` state for normal retirement or loss
- a stronger compromise-oriented state that carries a compromise cutoff or suspicion window

That distinction keeps ordinary device churn from causing excessive disruption while still allowing aggressive containment when a signing key may have been misused.

## 2. User Lifecycle

### Suspension

User suspension is a temporary administrative state. It should disable new native sending and optionally block new native receipt resolution without immediately destroying the underlying identity object. This is useful for:

- short-term account investigation
- legal or HR hold
- account recovery
- suspected compromise

A suspended user may still need mailbox preservation and administrative recovery, so suspension should not be modeled as immediate deletion.

### Revocation

User revocation is stronger. It means the user identity is no longer valid as an active VAMP principal. Revocation may occur because:

- the account was terminated
- a role identity was decommissioned
- the address assignment was ended permanently
- the organization is resetting trust after compromise

Once revoked, the user identity should no longer resolve as an active native recipient and should no longer authorize new sending assertions beneath it.

### Reassignment And Termination

Reassignment requires particular care. A mailbox address may be reused inside an organization, but VAMP should not treat a reused address as the same user identity. The correct model is:

- the address string may be reassigned
- the prior user identity remains a distinct historical subject
- a reassigned address resolves to a new user identity object and a new directory version

This prevents trust history, prior subscriptions, or relationship state from silently transferring from one human to another just because the local part stayed the same.

## 3. Organization And Domain Lifecycle

### Key Rotation

Organization and domain keys should rotate routinely rather than only after incidents. Rotation should be done through overlapping signed assertions so verifiers can accept both the old and new chain during a bounded migration period.

The normal sequence should be:

1. issue the new key and signed successor objects
2. publish both old and new chains during overlap
3. allow caches to refresh
4. retire the old key after the overlap window ends

That overlap is especially important in a store-and-forward protocol because not every sender-edge or receiver-edge will refresh state at the same instant.

### Overlap Periods

Overlap periods should be explicit in the signed objects rather than inferred operationally. Each rotated authority object should carry:

- `issued_at`
- `not_before`
- `not_after`
- an optional predecessor or successor reference
- an explicit rotation epoch or version identifier

This lets validators distinguish "expected coexistence during rotation" from "unexpected chain ambiguity."

### Delegated Edge Changes

Sender-edge and receiver-edge changes should be published as updated edge authorization assertions under organization and domain authority. Because [Discovery](/technical/discovery/) already routes capability and policy through signed bootstrap documents, edge changes should propagate by:

- updating the domain policy object
- advancing the policy version
- publishing the new edge authorization chain
- preserving a bounded overlap window when operationally possible

That keeps edge migration inside the same signed control plane rather than turning it into an out-of-band reconfiguration exercise.

### Emergency Rollover

Emergency rollover is the case where overlap cannot be trusted, such as domain key compromise or edge key exposure. VAMP should support emergency successor publication that:

- marks the old authority as superseded or revoked
- advances the current policy or directory epoch immediately
- shortens or eliminates the overlap window
- signals that cached older chains must no longer be treated as acceptable

Emergency rollover is the main exception to the normal preference for smooth overlap. It exists because compromise sometimes requires a hard cut rather than graceful coexistence.

## 4. Freshness Model

### Assertion Lifetimes

VAMP should prefer short-lived assertions for the objects most likely to change, and longer-lived assertions for the objects that represent slower-moving authority.

A good baseline hierarchy is:

- device-origin and transport assertions: very short-lived
- directory identity objects and active user state: short-lived
- subscription and revocation assertions: durable objects with explicit status and optional revalidation horizon
- organization and domain authority assertions: longer-lived but routinely rotated

The precise durations are policy choices, but the architectural rule is stable: the closer an object is to a live operational event, the shorter its validity should be.

### Directory Epoch And Versioning

The discovery chapter already established deterministic identity objects for a given address and directory version. Lifecycle management should extend that into a broader freshness rule:

- domain policy advances by `policy_version`
- recipient directory state advances by `directory_version` or epoch
- revocation-state snapshots may carry their own version tied to the same epoch or a companion sequence

For a given address and directory epoch, the same signed identity object should still be returned. If lifecycle state changes materially, the directory advances and the new object becomes explicit.

### Cache Semantics

Caching should work at two layers:

- HTTP caches and conditional revalidation for transport efficiency
- signed-object validity windows for security semantics

Infrastructure may cache signed policy, identity, and revocation objects until:

- the signed validity window expires
- a newer signed version is retrieved
- a local policy requires earlier refresh because of risk posture

Once a stronger policy or newer epoch has been learned, the system should not silently regress to weaker or older state until the signed validity window clearly permits that behavior.

### Acceptable Staleness Windows

VAMP should define acceptable staleness by object class rather than one universal timeout.

- Message-origin and transport assertions should tolerate only short clock skew and brief transit delay.
- Directory and policy objects should tolerate moderate caching, because they are designed for distribution and reuse.
- Emergency revocation state should be expected to converge faster than routine renewal state.

This is the practical compromise between security and store-and-forward operation. A message in transit should not become invalid simply because a cache refreshed three minutes later than another, but neither should week-old identity state remain acceptable for new native delivery.

## 5. Revocation Distribution

### Signed Directory State

Revocation should be distributed as signed authoritative state, not as an unsigned hint and not as a mandatory online callback.

At minimum, the relevant authority should be able to publish signed state covering:

- currently active devices for a user
- revoked device identifiers
- user suspension or revocation state
- active organization and edge authorities
- current directory and policy versions

This can be carried in:

- updated identity objects
- signed directory snapshots
- signed delta feeds between snapshots

The format matters less than the principle: verifiers should be able to consume revocation information as signed replicated state.

### Emergency Revocation

Emergency revocation needs a faster path than routine expiry. For severe compromise, a domain or organization should be able to publish an emergency revocation object or emergency state snapshot that:

- is signed by the still-trusted authority, or its emergency successor
- has immediate effect
- supersedes older cached state
- is easy for sender-edge and receiver-edge infrastructure to fetch and apply quickly

This may justify more aggressive refresh behavior by peers when high-risk state is encountered, but it should still avoid requiring a blocking live query for every message.

### Optional Transparency Or Audit Layers

VAMP should be compatible with optional transparency or append-only audit layers for high-value deployments. Those layers can help detect:

- hidden key rollovers
- split-view directory behavior
- retroactive tampering with lifecycle state
- inconsistent revocation publication across edges

They should remain an enhancement, not a baseline hot-path dependency. The core protocol should be able to function securely without assuming a public transparency log is always reachable.

### Avoiding OCSP-Style Hot-Path Dependency

The protocol should avoid turning every message validation into "ask the network whether this key is still good." That would recreate the fragility and privacy problems already seen in online certificate status systems.

The preferred pattern is:

- short-lived assertions
- signed cached revocation state
- conditional refresh when objects near expiry or when risk posture changes
- explicit emergency fetch or fail-safe behavior only for exceptional events

That keeps delivery robust when control-plane services are slow or temporarily unreachable.

## 6. Subscription Lifecycle

### Unsubscribe

As established in [Subscriptions](/technical/subscriptions/), unsubscribe should be a signed revocation assertion produced after a user gesture. That revocation should update both:

- sender-side membership state
- recipient-side local enforcement state where supported

This prevents the sender from continuing to rely on an old positive proof after consent has been withdrawn.

### Stale Membership

Not every subscription should last forever. Some list relationships can remain durable until explicitly revoked, but VAMP should also support membership that becomes stale and requires revalidation after a defined horizon. That is useful for:

- infrequently used subscriptions
- high-risk notification classes
- memberships created under weaker historical device posture
- campaigns whose purpose is time-bounded

The point is not to force constant ceremony. It is to keep long-dormant sender claims from remaining valid indefinitely without review.

### Revalidation

Revalidation should use the same basic ceremony as initial subscription:

- sender challenge
- user gesture
- device-signed scoped assertion
- sender validation and storage

The result is either a renewed membership state or a superseding subscription proof with a later issuance time and state version.

### Device-Revocation Interaction

The default rule should remain conservative and user-friendly: later device revocation does **not** automatically invalidate every subscription that device once authorized. A lost device does not imply withdrawn consent.

However, when a device is revoked specifically for compromise, recipient or sender policy may require revalidation for subscriptions created by that device after a compromise cutoff. That gives operators a precise containment tool without making ordinary device turnover destructive.

## 7. Operational Failure Cases

### Stale Directory View

If a sender-edge is operating on a stale directory view, it should fail based on how stale the state is and what action is being attempted.

- If the cached object is still within its signed validity window, delivery may proceed subject to local policy.
- If the object is expired or superseded by known newer state, native delivery should not proceed on the stale object alone.
- If the sender cannot refresh due to temporary control-plane failure, it may queue, retry, or downgrade only if downgrade policy explicitly permits it.

This preserves both store-and-forward behavior and downgrade resistance.

### Partially Rolled Keys

Key rollover will sometimes be partially deployed during real operations. Validators should therefore distinguish between:

- acceptable overlap where both chains are currently valid
- invalid ambiguity where the old chain is no longer acceptable

If the presented chain falls outside the overlap window, the message should fail validation rather than guess which authority is current.

### Sender-Edge Or Receiver-Edge Misconfiguration

If an edge presents the wrong authority chain, stale policy, or an unexpected delegated identity, peers should treat that as a policy failure, not as a reason to weaken validation. Recovery should come from:

- refreshing policy and edge authorization state
- correcting delegated-edge configuration
- temporarily queueing while authoritative state converges

Silent acceptance of mismatched edge state would reintroduce trust laundering through operational mistakes.

### Recovery Behavior

The general recovery sequence for lifecycle uncertainty should be:

1. prefer refresh over fallback
2. prefer queueing over silent downgrade
3. permit downgrade only where signed policy explicitly allows it
4. surface recovery-relevant signals to operators and, when appropriate, users

That sequence keeps VAMP aligned with the rest of its architecture: stronger state is sticky, fallback is explicit, and trust failures are observable.

## Recommended Baseline

VAMP should adopt the following lifecycle model.

1. Devices, users, organizations, edges, and domain authorities are represented by signed objects with explicit validity windows.
2. Discovery and identity resolution advance through explicit signed policy and directory versions rather than mutable implicit state.
3. Revocation is distributed as signed state snapshots or deltas, not as a mandatory per-message live query.
4. Routine rotation uses overlap windows; emergency rollover uses explicit supersession and faster refresh.
5. Subscriptions are revoked by signed user-driven assertions and may be revalidated when stale or compromise-related policy requires it.
6. Validators rely on bounded freshness, cache semantics, and emergency refresh behavior instead of OCSP-style hot-path dependency.

This gives VAMP a lifecycle story consistent with its broader architecture. The system remains store-and-forward. Identity survives normal churn. Compromise can be contained. Stronger state stays sticky. And revocation becomes an explicit part of the protocol's signed control plane rather than an unreliable afterthought.
