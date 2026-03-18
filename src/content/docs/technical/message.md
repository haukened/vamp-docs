---
title: 'Message and Custody Semantics'
description: 'The canonical VAMP message object and custody-chain semantics.'
sidebar:
  order: 4
---

This chapter defines the core VAMP primitive: a message is not just a blob of content plus some transport metadata. A VAMP message is an **immutable canonical message object** accompanied by an **append-only custody chain**. That model builds directly on [Identity](/technical/identity/), which defined device, user, organization, and domain roles, and on [Discovery](/technical/discovery/), which defined how senders resolve recipient identity and recipient policy before delivery.

The architectural insight is simple: **device → user → organization is already a custody chain**. Native transport, redistribution, forwarding, and security processing do not replace that chain. They either extend it with explicit assertions or remain transparently inside an already accountable administrative boundary. This is the main way VAMP preserves authorship and provenance without recreating the ambiguity of SMTP-era trace headers and indirect-flow heuristics. For the surrounding transport and redistribution arguments, see [VAMP Native Transport Topology](/research/native-transport-topology/) and [WebAuthn-Style Subscription Authorization for VAMP](/research/signed-subscriptions/).

## Design thesis

VAMP should separate two things that legacy mail often blurs together:

- **the message object**
- **the handling history**

The message object answers:

- What was authored?
- Who was it for?
- What exact bytes or structured content are being committed to?

The custody chain answers:

- Who handled it?
- In what role?
- What prior custody state did they receive?
- What authority did they add?

That separation makes three important properties possible.

1. Authorship can remain stable even when custody changes.
2. Redistribution can be represented honestly as new custody rather than as forged continuity.
3. Tampering becomes visible because every meaningful custody step commits to the message and to prior custody state.

## The canonical message object

### What a VAMP message is

At the architectural level, a VAMP message should be modeled as:

1. a **canonical message object**
2. zero or more **attachments or external content objects**
3. an ordered **custody chain**

The canonical object is the content and delivery-intent unit. The custody chain is the provenance and authorization unit.

### Fields in the canonical object

The canonical object should contain the fields that define the authored message and its intended delivery semantics. At minimum, it should include:

- a stable message identifier
- a schema or object version
- author user identity
- author organization identity
- recipient identities
- conversation or thread references, if any
- authored timestamp
- subject or message title field
- canonical body representation
- attachment manifest
- content-type or content-profile metadata
- security-relevant policy flags that are part of authored intent

Optionally, it may also include:

- reply targeting metadata
- list or service scope when the message is born as a list-service message
- declared sensitivity or retention hints
- internationalization and locale metadata

The key rule is that these are **message-definition fields**, not transport-history fields.

### What is hashed

The custody chain should commit to a single **message digest** derived from the canonical message object and any attachment digests. That means the digest input should cover:

- the canonical message object itself
- the attachment manifest
- the content digests of each attachment or external content object

The body bytes should not be hashed in some ad hoc display form. They should be hashed in the canonical serialization defined for the message object so that all validators compute the same digest from the same semantic content.

### Canonicalization rules

Canonicalization should be strict and minimal. The system should not rely on "best effort" normalization the way legacy mail often does.

At a high level:

- field ordering is fixed by the schema
- field names are canonical
- encoded values have one canonical representation
- absent and empty are distinct when the schema says they are distinct
- text normalization rules are fixed, not implementation-local
- attachments are represented by manifest entries and digests, not by local storage paths

The cleanest architectural direction remains the same one established in [Identity](/technical/identity/): use one compact signed assertion family and one disciplined canonical serialization model across the protocol rather than inventing separate normalization rules for message bodies, policy objects, and custody assertions.

### What is immutable

The following should be treated as immutable once the canonical message object is created:

- authored content
- recipient set for that authored object
- attachment digests
- subject and authored metadata
- the message identifier
- the initial authored timestamp

If any of those change materially, the result is not "the same message with a tweak." It is a new message object, even if it reuses previous content.

This rule matters because provenance only works if validators know what the chain is actually protecting.

### What is allowed to change

Some things may change outside the canonical object without changing the message identity:

- custody assertions appended after origin
- receiver-local classification or policy outcomes
- queueing and retry state
- receiver-local delivery metadata
- storage and indexing metadata

Some transformations create a **new custody step** but not a new authored message:

- organization transport authorization
- forwarding without content mutation
- security scanning results
- archive or journal capture assertions

Some transformations are so material that they should create a **new message object or re-originated object**:

- message body rewriting
- subject rewriting that changes user-visible meaning
- list footers inserted into the canonical body
- attachment replacement
- major recipient-set changes in redistribution scenarios

That is why the transport research insisted that mailing lists and similar systems cannot be treated as transparent pass-through in the native path. When the content or authorial context changes materially, the system must say so explicitly.

## Custody assertions

### What a custody assertion contains

Each custody assertion should be a signed statement that binds:

- the custody role being exercised
- the actor identity performing that role
- the message digest being handled
- the immediately previous custody state
- the assertion timestamp
- any role-specific metadata
- the actor's signature

In effect, each assertion says: **"In this role, I received this message state and I am adding this bounded statement to its custody history."**

### Commitment to previous custody state

Each custody assertion should commit not only to the message digest but also to the prior custody state. The simplest architectural model is:

- `message_digest`
- `previous_custody_digest`
- `current_assertion_digest`

where the current assertion digest is computed over the current assertion contents, including the previous custody digest. This produces an append-only linked chain.

That design gives VAMP the property ARC was trying to restore for indirect mail flows, but as a native message primitive rather than as a compatibility overlay.

### Ordering and tamper evidence

Ordering should be preserved by three aligned mechanisms:

- each assertion references the previous custody state
- each assertion carries its own issuance time
- the chain is validated in order from origin toward the receiver

Tampering becomes visible because:

- removing an assertion breaks the next link
- reordering assertions breaks previous-state commitments
- mutating a message after origin breaks the message digest
- changing role metadata breaks the assertion signature

This is the main reason VAMP should prefer an explicit custody ledger over loosely interpreted received headers or partial authentication summaries.

## Custody roles

Not every handler means the same thing. The role must therefore be explicit in the custody assertion.

### Device-origin

This is the first meaningful custody step for authored mail.

It should attest:

- the canonical message digest
- the author user identity being acted for
- any local security context that origin policy requires
- that the enrolled device created the origin assertion

This step gives endpoint provenance. It answers, "which enrolled device originated this authored message object?"

### User-origin

In most cases, the user is represented through the device-origin assertion plus the device-to-user chain defined in [Identity](/technical/identity/). A separate user-origin signature is therefore usually unnecessary.

The important semantic point is that the user is the claimed author principal, while the device is the signing actor. VAMP should preserve that distinction rather than forcing the user identity to sign independently.

### Organization-authorized

This custody role is added by the sender-edge or another authorized organization service.

It should attest:

- that the organization validated the origin chain
- that the organization authorizes native delivery of this message
- the sender-edge identity that admitted the message
- any transport-class policy relevant to downstream validation

This role converts endpoint-authored content into organization-authorized network traffic.

### Redistribution

Redistribution applies when a service receives a message and deliberately emits it onward to a new audience or under a service identity, such as:

- mailing lists
- newsletters
- notification services
- team aliases that behave as active message processors

This role should not pretend to be transparent forwarding. It should explicitly attest:

- the incoming custody state it received
- the redistribution service identity
- the redistribution scope or list identity
- whether the canonical object was preserved or replaced
- any recipient-consent proof or redistribution authorization being relied on

This aligns directly with the research conclusion that mailing lists are responsible actors, not passive relays.

### Forwarding

Forwarding is narrower than redistribution. It applies when custody passes onward without re-authoring the message and without claiming the forwarder as the new author.

Examples include:

- user-configured forwarding within policy
- explicit account migration forwarding
- administrative routing that preserves the original canonical object

The forwarding custody role should attest that the message object is being passed onward while preserving the original authorship semantics.

### Security processing

Some processing steps add value without claiming authorship or redistribution, such as:

- malware scanning
- policy classification
- journaling or archival capture
- quarantine release
- content safety labeling

When these steps matter to downstream verifiers, they should use an explicit security-processing custody role rather than overloading forwarding or organization-authorization semantics.

### Receiver-acceptance

The receiver-edge may add a final receipt or acceptance assertion attesting that:

- the chain validated to the receiver's required policy level
- the message was accepted under receiver policy
- any downgrade or special handling classification was applied

This is especially useful for auditing and cross-domain dispute analysis, even if not every receiver exposes it back to senders.

## Selective signing

### Which actors should append custody signatures

Custody signatures should be appended by actors whose participation materially changes trust, provenance, or policy interpretation.

That normally includes:

- the originating device
- the sender-edge organization authority
- explicit redistributors
- explicit forwarders when forwarding is externally meaningful
- security processors whose verdicts are meant to travel with the message
- the receiver-edge when receipt attestation is desired

### Which actors should remain transparent

Many internal components should remain transparent and should not each append separate custody assertions:

- internal queueing layers within one sender-edge service
- internal retry workers
- storage replicas
- load balancers
- stateless transport helpers
- ordinary internal scanners whose outputs are not exported as trust signals

These components are already covered by the administrative boundary of the accountable edge or organization. Signing every internal micro-hop would bloat the chain without adding proportionate explanatory value.

### What value each signature adds

Each custody signature should exist for a reason:

- **device-origin** adds endpoint provenance
- **organization-authorized** adds domain and transport authority
- **redistribution** adds explicit re-emission semantics
- **forwarding** adds non-authorial path continuity
- **security processing** adds portable downstream trust signals
- **receiver-acceptance** adds final validation evidence

If a signature does not add one of those things, it probably should not exist.

### Why not every intermediary needs to sign

Signing every intermediary would recreate the worst part of legacy mail trace: lots of path detail, little semantic clarity.

The right principle is not "everyone signs." The right principle is:

- **every actor that changes external accountability signs**
- **actors that are merely internal implementation detail do not**

This keeps the chain legible and makes validation about meaning, not about counting hops.

## Validation semantics

### How recipient-side software validates the chain

Recipient-side validation should proceed in layers.

1. Validate the canonical message digest and attachment digests.
2. Validate the device-origin assertion against the device → user → organization chain.
3. Validate the organization-authorized transport assertion.
4. Walk each subsequent custody assertion in order, verifying previous-state commitment and role semantics.
5. Apply recipient policy to the resulting chain shape.

Validation is therefore not only cryptographic. It is also semantic.

The receiver needs to know not just that signatures are valid, but what those signatures mean.

### Distinguishing authorship

Authorship should be determined from:

- the author identity in the canonical message object
- the device-origin assertion
- the device-to-user chain

This answers, "who authored this message and from which enrolled endpoint did it originate?"

### Distinguishing redistribution

Redistribution is present when an explicit redistribution custody role appears in the chain or when a new message object is emitted under redistribution service authority. Recipient software should display this as:

- original author, if preserved and still relevant
- redistributing service identity
- relationship between the original object and the redistributed object

That makes list mail and similar flows understandable without pretending they are direct first-party authorship.

### Distinguishing forwarding

Forwarding should be recognized as custody continuation without authorship replacement. A valid forwarder assertion means:

- the original author remains the author
- the forwarder became an intermediate accountable custodian
- the message reached the recipient through an alternate route that was declared, not hidden

### Distinguishing security processing

Security-processing assertions should be treated as portable evidence, not as authorship evidence. They may affect policy or UI, but they should never be confused with "who wrote this message."

### Policy outcomes

After validation, recipient software should be able to answer at least these questions:

- Is the authored message intact?
- Which device originated it?
- Which organization authorized transport?
- Was it redistributed, forwarded, or both?
- Did any external security processor add assertions that matter?
- Is the final provenance ordinary, unusual, degraded, or suspicious?

Those are exactly the questions legacy email often answers poorly.

## Recommended baseline architecture

VAMP should adopt the following message and custody rules.

1. **Treat the canonical message object as immutable.**  
   Authored content and authored delivery intent do not silently drift after origin.

2. **Represent provenance as an append-only custody chain.**  
   Every meaningful external custody step signs the message digest and the previous custody state.

3. **Keep authorship separate from handling history.**  
   The author is not overwritten merely because another actor later handled the message.

4. **Require explicit roles for non-native flows.**  
   Redistribution, forwarding, and security processing are different semantics and should not be collapsed.

5. **Use selective signing rather than hop-by-hop maximalism.**  
   Sign when accountability changes; remain transparent for internal implementation detail.

6. **Make material content mutation either explicit re-origin or a new message object.**  
   Significant rewriting cannot masquerade as intact custody continuity.

7. **Validate both cryptography and meaning.**  
   A valid chain is not just a stack of signatures. It is a coherent story about authorship, authority, and path.

## Final assessment

The message object and the custody chain are the center of the VAMP protocol story because they connect all of the prior chapters. Identity tells us who can sign. Discovery tells us how recipients are resolved and policy is learned. The message chapter tells us what those actors are actually signing and how later handlers extend provenance without erasing authorship.

If VAMP gets this primitive right, redistribution becomes explicit instead of ambiguous, forwarding becomes accountable instead of invisible, and recipient software can distinguish original authorship from later custody with much less guesswork. That is the architectural payoff: **a VAMP message is not just content in transit. It is content plus a verifiable story of who created it, who authorized it, and who meaningfully handled it after origin.**
