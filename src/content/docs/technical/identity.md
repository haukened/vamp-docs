---
title: 'Identity and PKI Architecture'
description: 'The VAMP trust model, identity hierarchy, and PKI architecture.'
sidebar:
  order: 2
---

VAMP begins with a narrower claim than "solve email." It defines who is allowed to speak for whom, where trust begins and ends, and which cryptographic statements are needed to make transport, consent, and sender cost enforceable. The transport and threat-model research already argues that VAMP only works if identity, policy, and transport are bound together rather than layered loosely on top of SMTP. This paper turns that premise into a concrete trust model and PKI architecture. For the surrounding transport and abuse arguments, see [VAMP Native Transport Topology](/research/native-transport-topology/), [Sender-Cost Enforcement, Downgrade Resistance, and Operator Value](/research/threat-model-and-value/), and [WebAuthn-Style Subscription Authorization for VAMP](/research/signed-subscriptions/).

## Design thesis

The core design decision is that VAMP identity is hierarchical:

- device
- user
- organization
- domain trust anchor

That hierarchy exists because the protocol needs four different kinds of authority.

- A **device** can truthfully say, "this specific enrolled endpoint produced this signature."
- A **user** can act as the stable human recipient and sender identity across device changes.
- An **organization** can authorize transport, policy, and membership under its administrative control.
- A **domain trust anchor** can root which organization is authorized to represent a domain on the network.

The result is a simple rule: **devices sign, users receive, organizations authorize, and domains root trust**.

## Trust boundaries

VAMP should define six primary trust boundaries.

### Domain

The domain is the public namespace boundary. It answers the network-level question, "who is allowed to represent `example.com`?" The domain trust anchor is therefore the root of external trust for that namespace. It does not need to sign every message directly, but it must root the organization or organizations that are allowed to operate under that domain and the authoritative edges that may exchange native VAMP traffic for it.

This matches the transport model in which the sender and receiver are authoritative edges for administrative domains, not arbitrary hosts in the middle of the path. That boundary matters because otherwise identity and sender cost can be laundered through relays or downgrade paths.

### Organization

The organization is the administrative trust domain beneath the public namespace. It governs users, devices, transport policy, revocation, and delegated infrastructure. In enterprise terms, this is the tenant or operator that decides who belongs to the system and which edges may send and receive on its behalf.

The organization is the correct layer for most policy because it is stable enough to manage people and systems, but narrow enough to remain accountable. A user does not authorize the mail transport fabric. A domain alone is too coarse if multiple administrative entities exist beneath it. The organization is where those controls belong.

### User

The user is the stable personal identity inside the organization. This identity represents a person or role account, not a single endpoint. It should survive device replacement, device loss, re-enrollment, and multi-device use. That stability is why **encryption targets the user identity rather than individual devices**.

The user identity is also the level at which relationship history, consent state, mailbox semantics, and human-oriented trust should attach. A message is "for Alice," not "for Alice's phone from February."

### Device

The device is the concrete signing actor. It is the only layer that can honestly attest local facts such as "this enrolled device produced this signature" or "this assertion was released after local user presence." VAMP should therefore put signing keys on devices, ideally in hardware-backed modules, and avoid asking humans to manage cryptographic material directly.

The device boundary is intentionally narrow. A device can attest origin and local execution, but it cannot define organization policy or domain authority.

### Sender-edge

The sender-edge is the authoritative egress boundary for the sender domain or delegated sender organization. It is the public transport actor that can say, "this message entered native inter-domain delivery under organization policy." The transport paper already treats this as the accountable outbound boundary, and that should remain true in the identity model.

This means a local device signature alone is not enough for native delivery. The sender-edge must also attest that transport is authorized for that sender identity and that the message is being emitted through the organization's approved egress path.

### Receiver-edge

The receiver-edge is the authoritative ingress boundary for the recipient domain or delegated recipient organization. It is the first external verifier of VAMP-native traffic and the enforcement point for downgrade policy, sender cost validation, subscription proof validation, and recipient capability checks.

Just as the sender-edge is the public outbound authority, the receiver-edge is the public inbound policy authority.

## Identity hierarchy and actor roles

The hierarchy is not just naming. Each layer has a distinct cryptographic role.

### Device role

The device holds a signing key and produces assertions that require endpoint-level provenance. That includes:

- message-origin signatures
- subscription and unsubscribe assertions
- optional local user-presence or user-verification signals
- key-rotation continuity statements during device lifecycle events

Hardware backing matters here because it raises the cost of key extraction and makes device compromise more visible and revocable. VAMP does not need to expose full manufacturer attestation on every message, but it should preserve enough enrollment evidence for the organization to decide whether a device key is hardware-backed, software-backed, managed, revoked, or degraded.

### User role

The user identity is the stable cryptographic subject for person-level messaging semantics. It represents:

- the mailbox or inbox principal
- the encryption target
- the human or role identity relationships are built around
- the parent subject under which multiple devices are enrolled

The user identity should not normally sign transport statements. That would collapse the distinction between "the human principal" and "the endpoint that actually performed the action." VAMP is stronger if those remain separate.

### Organization role

The organization authorizes the system around the user. It is responsible for:

- issuing or approving user identities
- enrolling and revoking devices beneath users
- authorizing sender-edge and receiver-edge services
- publishing transport and downgrade policy
- binding list services, bulk-sender lanes, and delegated infrastructure into one accountable authority

This is also the right level for organization-level transport attestation. A message may be signed by a device, but only the organization can authorize external delivery under its domain or tenant policy.

### Domain trust anchor role

The domain trust anchor roots the organization's authority to speak for the namespace. Its job is not to manage users or devices directly. Its job is to establish which organization key material and which edge authorities are legitimate for the domain.

In the simplest model, the domain trust anchor signs:

- organization authorization objects
- edge authorization objects for sender-edge and receiver-edge services
- domain policy statements, including native capability and downgrade posture

That gives the receiver a clean validation chain from namespace ownership down to transport and sender identity.

## PKI model

VAMP should use a single assertion family across identity and message-level artifacts, with different object profiles for different roles. The main reason is operational simplicity. If domain authorization, device enrollment, subscription proof, and message-origin statements all use unrelated formats, implementations will drift and policy will fragment. A protocol that is trying to replace email ambiguity should not begin by multiplying internal syntax.

The research on subscription assertions already points toward compact signed objects that work well in asynchronous, store-and-forward systems. That same reasoning applies here. VAMP should use one compact, signed object format for:

- domain trust anchor statements
- organization certificates or authorization assertions
- user identity certificates or bindings
- device certificates or enrollment assertions
- edge authorization assertions
- message-origin assertions
- message-transport assertions
- subscription and revocation assertions

The format choice should optimize for compactness, offline verification, and profile discipline rather than X.509-era generality. The most coherent direction is a **COSE/CBOR-style signed assertion family**, with profile-specific claims for each object type. The exact serialization can evolve, but the architectural conclusion is stable: **one assertion model, many typed profiles**.

### Recommended object types

At minimum, VAMP should define the following objects.

1. **Domain Authority Assertion**  
   Names the domain and authorizes one or more organization roots and edge authorities.

2. **Organization Authorization Assertion**  
   Binds an organization identity to a domain and grants it authority to issue users, enroll devices, and authorize transport services.

3. **User Identity Assertion**  
   Binds a user identifier to the organization and publishes the user's encryption material and lifecycle metadata.

4. **Device Enrollment Assertion**  
   Binds a device signing key to a user, includes device status and key properties, and records whether the key is hardware-backed, attested, managed, or limited.

5. **Edge Authorization Assertion**  
   Authorizes a sender-edge or receiver-edge service to act for an organization or domain.

6. **Message-Origin Assertion**  
   Produced by the sending device; attests the message payload, sender user identity, and any required local security context.

7. **Transport Authorization Assertion**  
   Produced or attached by the sender-edge; attests that the organization authorized this message for native inter-domain transport.

8. **Recipient Encryption Metadata**  
   Publishes how to encrypt to the user identity without binding ciphertext to one device forever.

9. **Consent Assertions**  
   Used for subscriptions, unsubscriptions, and similar user-authorized delegated sending flows.

### What signs what

The signing chain should be explicit:

- the **domain trust anchor** signs organization and edge authority
- the **organization** signs users, devices, and delegated service authority beneath its control
- the **device** signs message-origin and consent assertions
- the **sender-edge** signs or countersigns transport authorization for native delivery

That chain expresses the real authority split:

- the domain says who may represent the namespace
- the organization says who belongs to the system and which edges are trusted
- the device says this specific endpoint performed this action
- the sender-edge says this action was admitted to network transport under policy

## Hardware-backed device identity

Hardware backing should be the preferred device-key posture, but not the only enrollment posture. The system needs room for software-backed fallback, managed mobile devices, virtualized workloads, and staged migration. The right model is not "only hardware-backed devices may exist." The right model is:

- hardware-backed device identity gets stronger trust and more stable provenance
- software-backed identity can exist with lower trust or narrower permissions
- device posture is represented in enrollment assertions and enforced by policy

This is important because VAMP needs to be honest about compromise. A device key stored in secure hardware is still not magic, but it is materially better than a freely exportable software key for the specific job of endpoint signing.

## Encryption and signing semantics

### Why encryption targets the user identity

Encryption should target the **user identity**, not an individual device, because the user is the stable recipient principal.

If encryption targets devices directly, ordinary lifecycle events become protocol failures:

- adding a new device requires sender re-discovery of every endpoint
- replacing a lost device breaks continuity
- multi-device delivery becomes awkward fanout at the wrong layer
- archived messages become tied to obsolete endpoint state
- every message must be encrypted to multiple devices or re-encrypted on every device change

By encrypting to the user identity, VAMP lets the recipient organization manage local rewrapping or fanout to the user's active devices while keeping the external sender focused on the actual recipient principal. This matches the design constraint that humans should not handle keys directly and keeps device churn out of inter-domain semantics.

### Why devices perform signatures

Devices should sign because origin claims are strongest at the endpoint that actually originated the action. A user identity is too abstract to prove endpoint provenance; an organization is too broad; a sender-edge is too far downstream. Only the device can attest that a specific enrolled endpoint created the message-origin assertion or subscription authorization.

This is also why the subscription paper uses device-signed consent rather than sender-managed "proof." Consent, message origin, and similar facts should be signed where those facts are actually observed.

### How organization-level transport attestation works

Native delivery should require a second layer beyond the device signature: an organization-authorized transport assertion added by the sender-edge.

Conceptually, the flow is:

1. The device signs the message-origin assertion.
2. The message is submitted to the sender-edge.
3. The sender-edge validates the device chain up to the organization.
4. The sender-edge checks organization policy, sender state, sender cost, downgrade rules, and any delegated-send permissions.
5. The sender-edge emits a transport authorization assertion stating that this message is authorized for native delivery from this organization and domain.

That division is important. It prevents a raw endpoint signature from bypassing organizational policy, and it prevents the transport layer from claiming stronger sender provenance than the endpoint actually supplied.

## Sender-edge and receiver-edge semantics

The transport paper already argues that native VAMP delivery is sender-edge to receiver-edge with no unaffiliated transit relay in the normal path. The identity model should make that topology cryptographically explicit.

- The **sender-edge** is the only public actor allowed to originate native delivery for the sender domain.
- The **receiver-edge** is the only public actor allowed to accept native delivery for the recipient domain.
- Any third party translating or relaying between them is not transparent transport. It is either a delegated edge, a custody-bearing intermediary, or a downgrade boundary.

That matters because otherwise relay infrastructure can donate trust, policy, or reputation to traffic that did not actually originate from the claimed sender. The transport and threat-model papers both treat this as a core abuse class, and the PKI model should make it impossible to hide.

## Consumer-provider domains

Consumer-provider domains such as `gmail.com` and `outlook.com` need to be treated explicitly, because the provider is both the service operator and the namespace authority.

For those domains, the correct interpretation is:

- the provider operates the **domain trust anchor**
- the provider is also the **organization authority** for accounts under that namespace
- the provider's managed mail fabric is the **authoritative sender-edge and receiver-edge**
- individual end users are **users**, not organizations

In other words, a `gmail.com` user does not operate an independent organization beneath `gmail.com`. Google does. The same logic applies to `outlook.com` or similar consumer namespaces.

Hosted custom domains are different. If `example.com` uses Google Workspace or Microsoft 365, then `example.com` remains the external namespace, the customer organization remains the administrative identity authority for its people, and Google or Microsoft may operate delegated sender-edge and receiver-edge services under explicit authorization. That distinction is critical. Otherwise a provider's infrastructure could blur together "hosting the edge" and "owning the namespace."

## Design conclusions

VAMP should adopt the following conclusions as baseline architecture.

1. **Use a strict identity hierarchy.**  
   Device, user, organization, and domain each have different authority and should remain separate.

2. **Treat device signatures as origin evidence, not transport authorization.**  
   Devices attest local action. Organizations and edges authorize delivery.

3. **Encrypt to users, not devices.**  
   The recipient principal is the user identity; device fanout is local lifecycle management.

4. **Root trust at the domain, but govern policy at the organization.**  
   Namespace authority and administrative authority are related, but not identical.

5. **Use one compact assertion model across the protocol.**  
   Domain, identity, transport, and consent artifacts should be profiles of one signed object family.

6. **Make edge authority explicit.**  
   Sender-edge and receiver-edge roles must be signed and delegated, not inferred from routing accidents.

7. **Model consumer mail providers honestly.**  
   For provider-owned namespaces, the provider is the organization. For hosted custom domains, the provider is delegated infrastructure, not the domain owner.

8. **Keep the trust story compatible with the threat model.**  
   Sender cost handles scale, identity handles impersonation, and strict edge policy prevents downgrade and relay laundering.

This is the opening chapter of the VAMP architecture because every later mechanism depends on it. Native transport, sender cost, consent proofs, downgrade resistance, and list handling only become coherent when the system first answers four basic questions: who signed, for which user, under which organization, rooted by which domain.
