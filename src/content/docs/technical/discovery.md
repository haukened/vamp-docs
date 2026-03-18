---
title: 'Service Discovery'
description: 'How VAMP discovers recipient capability, retrieves domain policy, and resolves recipient identity.'
sidebar:
  order: 3
---

This chapter defines the VAMP control plane on the network: how a sender learns that a recipient domain supports VAMP, how it retrieves the recipient domain's policy and trust material, and how it resolves a recipient address into a deterministic identity object. It builds directly on [Identity](/technical/identity/), which established that domains root trust, organizations govern policy, users are the stable encryption targets, and sender-edge and receiver-edge services are the accountable public actors.

The main design requirement is straightforward: **discovery must not become a free oracle**. If VAMP requires pre-send capability and identity lookup, then lookup itself must be attributable, rate-limited, and policy-governed. The research already treats directory harvesting as a real abuse class and explicitly argues that discovery must be sender-attributed rather than anonymously enumerable. This paper turns that constraint into a concrete bootstrap and directory model. For the surrounding transport and abuse arguments, see [VAMP Native Transport Topology](/research/native-transport-topology/), [Sender-Cost Enforcement, Downgrade Resistance, and Operator Value](/research/threat-model-and-value/), and [Sender-Cost Mechanics](/research/sender-cost-mechanics/).

## Design thesis

VAMP discovery should follow a three-step model:

1. **DNS bootstrap** tells the sender where the recipient domain's VAMP API lives.
2. **HTTPS policy bootstrap** returns the domain's signed trust and policy objects.
3. **Authenticated exact-address resolution** returns a deterministic signed identity object when policy allows it.

That split is intentional.

- DNS is good at service discovery and caching.
- HTTPS is good at authenticated API transport and larger structured documents.
- Signed identity and policy objects are good at durable trust decisions and cache reuse.

Trying to collapse all three into one layer would make the system either too brittle or too easy to abuse.

## Control-plane flow

At a high level, recipient discovery should work like this:

1. The sender-edge extracts the recipient domain from the target address.
2. It queries DNS for the recipient domain's VAMP bootstrap record.
3. DNS returns the authority for the recipient domain's VAMP API.
4. The sender-edge connects to that API over HTTPS.
5. The recipient domain returns its signed domain policy and trust material.
6. The sender-edge performs an authenticated exact-address lookup.
7. If policy allows resolution, the API returns a deterministic signed identity object for that address and directory version.

This is a control-plane transaction, not the message-delivery path itself. It should therefore be explicit, cacheable, attributable, and separately governed from message submission and transfer.

## DNS bootstrap

### What record should be queried

The recommended bootstrap record is:

- `_vamp.<recipient-domain>` queried as an **`SVCB`** record

Example:

```text
_vamp.example.com. IN SVCB 1 api.example.net.
```

This should be the primary bootstrap mechanism because VAMP is discovering a service endpoint, not publishing human-readable metadata. `SVCB` is the right shape for that problem: it supports service indirection, structured parameters, and normal DNS caching without forcing the protocol to parse ad hoc strings.

### What information belongs in DNS

DNS should contain only the minimum data needed to reach the recipient domain's control-plane service:

- the API authority hostname
- an optional non-default port
- optional connection hints such as address hints
- an optional coarse bootstrap profile or major protocol family identifier

That is enough to answer one question: **where should the sender-edge go next?**

### What does not belong in DNS

DNS should **not** be the place for:

- full domain policy
- certificates or complete trust chains
- recipient identity objects
- recipient device metadata
- per-user directory entries
- rich capability negotiation
- fine-grained anti-abuse policy

There are three reasons.

First, those objects are too large and too dynamic for DNS to be the primary source of truth. Second, the transport and threat-model papers already argue that VAMP needs explicit anti-downgrade and anti-abuse policy; those are better carried as signed versioned documents than as scattered DNS text. Third, putting recipient identity material in DNS would make enumeration easier, not harder.

### Why `SVCB` is better than `TXT`

`TXT` should not be the primary mechanism. It is easy to deploy, but it is the wrong long-term tool for a structured control plane.

- `TXT` is untyped and convention-driven.
- `TXT` encourages string parsing drift across implementations.
- `TXT` makes extensibility awkward because every added field becomes format debt.
- `TXT` has a long history of becoming a generic dumping ground for policy that should have lived elsewhere.

By contrast, `SVCB` is explicitly designed for service bootstrap and indirection. That maps cleanly to the VAMP requirement that DNS be primarily for discovery, not for carrying the whole trust story.

### Transitional compatibility

If a deployment needs a migration path, a narrowly scoped `TXT` fallback could exist temporarily, but only as a compatibility aid and only to point at the HTTPS bootstrap authority. It should not become the normative baseline.

## API bootstrap and policy discovery

### How the client finds the VAMP API

After DNS bootstrap, the sender-edge should connect to the returned authority over HTTPS and fetch a stable bootstrap document from a fixed path such as:

```text
https://api.example.net/.well-known/vamp/domain
```

The exact path can be standardized later, but the architectural point is stable: DNS yields the authority, and HTTPS yields the structured policy object.

### What the bootstrap API returns

The bootstrap response should include, directly or by signed embedded object, the recipient domain's current:

- domain authority assertion
- receiver-edge authorization
- active domain policy
- supported control-plane API versions
- current directory version
- identity-resolution endpoint information
- downgrade posture
- cache and expiry metadata

The response should be signed in the same VAMP assertion family introduced in [Identity](/technical/identity/). That keeps bootstrap trust aligned with the rest of the system rather than creating a separate unsigned JSON control plane that implementations must "just trust" because it arrived over TLS.

### Domain policy contents

The active domain policy should answer at least these questions:

- Does this domain currently support native VAMP delivery?
- Which receiver-edge services are authoritative for it?
- Which sender authentication profile is required for lookup?
- Is anonymous lookup forbidden?
- What is the current directory version?
- What are the cache lifetimes for policy and directory objects?
- What is the domain's downgrade posture for native-capable peers?
- What control-plane features are supported at this time?

This keeps all the high-value discovery decisions in one signed, cacheable place.

### Versioning and caching

Policy should be versioned explicitly. A good baseline is:

- a monotonically increasing `policy_version`
- `issued_at`
- `not_before`
- `not_after`
- an optional `previous_policy_version`
- a stable `policy_id`

HTTP and signed-object caching should work together.

- HTTP provides `Cache-Control`, `ETag`, and conditional revalidation.
- The signed policy object provides semantic validity windows and version identity.

The sender-edge should cache the policy object by recipient domain and `policy_version`. Once a stronger policy has been learned, it should not silently fall back to weaker assumptions until the cached policy expires or is explicitly replaced by a newer signed version. This follows the same architectural lesson the research drew from MTA-STS and HSTS: stronger capability must become sticky enough that downgrade is observable and policy-governed rather than ambient.

## Identity directory model

### Exact-address lookup only

The directory should support **exact-address lookup**, not prefix search, wildcard search, or browse-style enumeration.

Good:

- `alice@example.com`

Not good:

- all users in `example.com`
- all users beginning with `a`
- all active users in department `sales`

The directory exists to support delivery to a specific intended recipient, not to expose an address book to the internet.

### Deterministic identity objects

For a given normalized address and directory version, the same signed identity object should be returned.

That requirement matters for three reasons.

- It makes caching safe and predictable.
- It prevents per-request object drift from becoming a covert channel.
- It ensures that sender-edge implementations are not forced to reconcile multiple "equivalent" versions of the same recipient identity during one directory epoch.

In practice, this means identity objects should be versioned snapshots. If anything materially changes about the resolved identity, the recipient domain should advance the directory version or the object's own version so the change is explicit rather than silent.

### What an identity object contains

An identity object should contain the minimum information needed to deliver securely to the user principal:

- the canonical recipient address
- the stable user identifier
- the organization and domain bindings for that user
- the user's encryption material or encryption reference
- the current identity-object version
- the directory version under which it was issued
- capability flags relevant to delivery
- validity metadata
- references to the supporting organization and domain assertions

Optionally, it may also carry limited policy-relevant metadata such as:

- whether first-contact delivery is allowed
- whether additional consent or subscription proof is required for specific sender classes
- whether the identity is temporarily suspended from native delivery

This is enough for the sender-edge and later receiver-edge validation path to prepare delivery without exposing the recipient's internal endpoint topology.

### Why device lists should not be exposed by default

Recipient device lists should not be part of the default public identity object.

There are two architectural reasons and one abuse reason.

First, [Identity](/technical/identity/) already established that **encryption targets the user identity, not individual devices**. Exposing device lists would pull device churn back into inter-domain behavior even though the architecture explicitly moved away from that.

Second, device lists are unstable. Publishing them externally would force senders to reason about local recipient lifecycle events that should remain inside the recipient organization.

Third, device lists are high-value enumeration and fingerprinting material. They reveal endpoint count, rollout posture, likely device classes, and lifecycle timing to parties who do not need that information.

The default answer should therefore be simple: **resolve users publicly, manage devices privately**.

## Lookup authentication and abuse resistance

### Who should query the directory

The directory should normally be queried by the **sender-edge** or another explicitly authorized outbound service for the sender organization, not by arbitrary end-user devices on the public internet.

That keeps lookup attached to the same accountable actor that later performs transport. It also fits the rest of the VAMP architecture, where the sender-edge is the public enforcement point for policy, sender state, and sender-incurred cost.

### Authenticated queries

Directory queries should be authenticated using sender-edge credentials rooted in the VAMP trust chain. The baseline could be:

- HTTPS server authentication on the recipient side
- sender-edge client authentication using a VAMP edge credential, mTLS, or signed HTTP requests
- request-level binding to sender domain, sender organization, and intended recipient address

The critical property is not the exact HTTP authentication scheme. The critical property is that the recipient domain can attribute the lookup to a real sender authority rather than to an anonymous network origin.

### Sender-attributable lookups

Every lookup should be attributable at least to:

- sender domain
- sender organization
- sender-edge identity
- target domain
- target address
- request time
- declared lookup purpose

That attribution is what makes budgets, penalties, and anomaly detection possible. Without it, the directory becomes a namespace-mining oracle.

### Rate limiting and budget control

Recipient domains should apply budgets and rate limits at multiple levels:

- per sender domain
- per sender organization
- per sender-edge
- per target domain relationship
- per target address pattern

The point is not merely to return `429`. The point is to make repeated exact-address discovery expensive enough, visible enough, and attributable enough that harvesting loses its asymmetry.

Stronger profiles may also require additional friction for low-trust or high-volume discovery patterns, such as:

- proof-of-work or budget-token presentation
- tighter quotas for first-contact lookups
- progressively lower disclosure for patterned enumeration
- operator alerts when lookup behavior resembles harvesting

### Minimal disclosure

The directory should separate "can I query?" from "how much should I learn?"

The baseline disclosure rule should be:

- if policy and sender trust allow it, return the full signed identity object
- otherwise return a minimal, generic denial or non-disclosure response

That denial response should avoid unnecessarily confirming whether the address does not exist, exists but is hidden, or exists but is unavailable to this sender at this time. The exact response taxonomy can be standardized later, but the principle should be firm: **the default failure mode should not help enumeration**.

### Anti-enumeration controls

At minimum, VAMP discovery should forbid or tightly govern:

- unauthenticated bulk lookup
- wildcard and prefix search
- cross-domain browse operations
- device-list exposure
- overly precise negative responses
- repeated patterned lookup without sender accountability

This is not optional hardening. The research already argues that discovery must be attributed and rate-limited if VAMP is going to improve on today's address-harvesting economics.

## Trust establishment

### Role of HTTPS

HTTPS is the baseline transport security for the control plane.

It provides:

- server authentication
- confidentiality for lookup contents
- integrity for the control-plane exchange
- a deployment model operators already understand

It is also the right transport for larger structured documents, conditional caching, and authenticated APIs. But HTTPS alone is not the entire trust model. VAMP still needs signed policy and identity objects because the domain may delegate API hosting to infrastructure that is not itself the namespace owner, and because cached control-plane objects should remain meaningful beyond one TLS session.

### Role of DNSSEC

DNSSEC should be treated as **optional hardening**, not as a mandatory baseline requirement.

That means the baseline security model is:

- DNS bootstraps the API authority
- HTTPS authenticates the connection
- signed VAMP assertions authenticate the domain policy and resolved identity

If DNSSEC is present, it strengthens bootstrap integrity by making tampering with the `_vamp` record harder. That is useful, especially for anti-downgrade posture, but it should not be required for basic interoperability. Requiring DNSSEC from day one would likely slow deployment more than it would improve the base architecture.

### Stronger profiles and DANE-like pinning

Stronger profiles should support DNSSEC-backed pinning or DANE-like hardening for deployments that want it.

Examples include:

- pinning the expected VAMP API certificate or public key hash
- pinning the domain trust-anchor key hash
- constraining acceptable API authorities more tightly than the Web PKI alone

Those mechanisms make sense only when tied to authenticated DNS data, so they should be defined as opt-in profiles layered on top of DNSSEC rather than as universal baseline requirements.

The architectural conclusion is:

- **HTTPS is mandatory**
- **DNSSEC is optional hardening**
- **DNSSEC-backed pinning is an advanced stricter profile**

## Recommended baseline architecture

VAMP discovery should adopt the following baseline.

1. **Use `_vamp.<domain>` `SVCB` for bootstrap.**  
   DNS answers where the control plane lives, not what the whole policy is.

2. **Fetch policy over HTTPS from the discovered authority.**  
   The recipient domain returns signed domain policy, trust material, and current directory version.

3. **Resolve recipients through authenticated exact-address lookup.**  
   The sender-edge authenticates and requests resolution for one target address at a time.

4. **Return deterministic signed identity objects.**  
   The same normalized address under the same directory version yields the same signed object.

5. **Do not expose recipient device lists by default.**  
   Encryption targets users; devices remain recipient-local lifecycle state.

6. **Treat discovery as an abuse-sensitive control plane.**  
   Lookups are attributable, rate-limited, minimally disclosive, and auditable.

7. **Use sticky policy caching to resist downgrade.**  
   Once stronger recipient policy is known, fallback becomes explicit and governed.

8. **Support stronger DNSSEC-backed profiles without making them mandatory.**  
   Baseline deployment should stay practical, while stricter operators can opt into pinning and stronger bootstrap guarantees.

## Final assessment

Discovery is the second chapter of the VAMP architecture because it connects the trust model to the network. The identity paper answered who may speak for whom. This chapter answers how a sender-edge learns where to ask, what policy to trust, and which recipient identity to encrypt to.

If DNS stays narrow, policy stays signed, resolution stays exact-address and deterministic, and lookup stays attributable, VAMP gains a usable control plane without creating a new public-harvesting surface. That is the right architectural boundary: **DNS finds the authority, HTTPS carries the policy, and signed identity objects carry the trust decision forward into delivery**.
