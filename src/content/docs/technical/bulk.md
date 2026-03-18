---
title: 'Bulk Sending'
description: 'How mailing lists, newsletters, notifications, and bulk mail fit into one redistribution model.'
sidebar:
  order: 6
---

This chapter defines how redistribution works in VAMP and why mailing lists, newsletters, notifications, and bulk mail can all be modeled as one **list-service primitive**. It builds directly on [Identity](/technical/identity/), [Message](/technical/message/), and [Flow](/technical/flow/): trust is already defined, the canonical message and custody chain already exist, and native human mail already explains the baseline end-to-end path. This chapter explains what changes when a service intentionally re-emits messages to multiple recipients or to a managed subscriber set.

The core claim is narrower than "bulk mail is the same as human mail." It is this: **bulk mail does not need a separate protocol primitive or alternate authorship model**. It can be represented as redistribution by an explicitly authorized list service. That means VAMP can unify mailing lists, newsletters, notifications, and other large-scale recipient distributions under one cryptographic and custody model, while still allowing operators to apply stricter policy to high-volume senders where needed.

For the surrounding rationale, see [WebAuthn-Style Subscription Authorization for VAMP](/research/signed-subscriptions/), [VAMP Native Transport Topology](/research/native-transport-topology/), [Sender-Cost Enforcement, Downgrade Resistance, and Operator Value](/research/threat-model-and-value/), and [Sender-Cost Mechanics](/research/sender-cost-mechanics/).

## Design thesis

VAMP should distinguish three layers that legacy email often collapses:

- the **original author**
- the **redistribution service**
- the **policy lane** under which the redistribution service operates

Those are different questions.

- "Who wrote this content?" is an authorship question.
- "Who redistributed it to me?" is a custody question.
- "Should this service be treated as high-volume or tightly governed?" is a policy question.

Once those are kept separate, the architecture becomes much cleaner:

- mailing lists are redistribution services
- newsletters are redistribution services
- notifications are redistribution services
- bulk campaigns are large redistribution services

The protocol primitive is the same. The scale and policy treatment may differ.

## 1. List service identity

### What a list service is

A list service is an explicit organizational actor that accepts content, manages a recipient set, and redistributes messages onward under its own accountable service identity.

In VAMP terms, it is not a hidden relay. It is a named, signed, policy-bearing participant in the custody chain.

### How a list service is represented cryptographically

The list service should be represented by a stable service identity beneath an organization and domain. That identity should be expressed in the same VAMP assertion family used elsewhere in the system, rather than through an unrelated side channel.

At minimum, the list service should have:

- a stable service identifier
- an organization binding
- a domain binding
- one or more authorized sending edges or delegated send authorities
- a service-scope identifier for the list or notification stream
- lifecycle and validity metadata

This is directly parallel to the rest of the VAMP trust model. A list service is not a special exception. It is another authorized actor under the organization.

### How the organization authorizes the list service

The organization should authorize the list service the same way it authorizes other delegated service actors:

- the organization signs a service authorization assertion
- the assertion binds the service identity to the domain and organization
- the assertion grants permission to redistribute mail for an identified service scope
- the relevant sender-edge is authorized to emit mail for that service

This matters because otherwise the service could not be held accountable as a real sender. In VAMP, redistribution must remain rooted in organization authority rather than in ad hoc headers or IP reputation alone.

### Service scope

Each list service should have a stable scope identifier, similar in spirit to a `List-Id`-style concept:

- a mailing list identifier
- a newsletter identifier
- a notification stream identifier
- or another stable service scope below the sender domain

This scope is important for consent, unsubscribe, and recipient-side evaluation. The subscription paper already makes the same point: the right binding surface is the sender domain plus a stable list or service identifier, not a random page URL or an implicit marketing label.

## 2. Redistribution semantics

### How a list extends the custody chain

A list service should extend the custody chain, not replace it.

The normal pattern is:

1. an original authored message or service-generated message exists
2. the list service receives it
3. the list service emits a redistribution custody assertion
4. the redistributed message is sent onward under the list service's authority

That redistribution assertion should bind:

- the incoming custody state
- the redistribution service identity
- the service scope
- whether the original canonical object was preserved or replaced
- any consent or subscription proof being relied on

This preserves a truthful story: "this was originally authored here, then redistributed by this named service."

### How original authorship is preserved

Original authorship should remain visible whenever the redistribution service is passing along authored content from another actor. Recipient software should be able to distinguish:

- the original human or service author
- the redistributing list service
- the organization that authorized the redistribution

That is the core reason VAMP uses custody extension rather than sender replacement. Mailing lists often need to say two true things at once:

- Alice wrote the original content.
- `team-updates@example.org` redistributed it to the list.

Both facts matter, and neither should erase the other.

### When wrapping is preferable to mutation

Wrapping is preferable when the list service wants to add explanatory context without corrupting the original authored object. Examples include:

- "Distributed by engineering-all@example.org"
- digest framing
- explanatory list metadata
- UI presentation hints

In those cases, the best model is often:

- preserve the original canonical message object
- create a new outer redistribution object that references it
- add list-service context in the outer layer

This keeps provenance clean and lets recipients distinguish original content from redistribution framing.

### What happens when content is modified

If the list service materially changes the content, the system should say so explicitly.

Small transport-local metadata changes do not require a new authored object, but these do:

- footer insertion into the canonical body
- subject rewriting that changes meaning
- attachment replacement
- body rewriting
- message truncation or content transformation with semantic effect

When that happens, the list service should either:

- emit a new canonical message object under redistribution authority, or
- clearly mark that it has re-originated the content

This follows directly from the message chapter: significant mutation cannot masquerade as intact custody continuity.

## 3. Bulk mail as list service

### Why a newsletter is structurally the same as a list

A newsletter is simply a list service with:

- one service identity
- one service scope
- many recipients
- explicit consent and unsubscribe semantics

The fact that the author is often a marketing or editorial team rather than a discussion participant does not change the basic structure. The service still redistributes content to a managed recipient set.

### Why notifications use the same primitive

Notifications fit the same model as well:

- a service identity emits messages
- recipients are enrolled or provisioned into a stream or service relationship
- the message is redistributed under service authority
- recipients need to know which service generated it and why

A password-reset notice, billing reminder, product alert, or weekly product summary all fit cleanly into "service-originated redistribution under a stable sender domain and service scope."

### Why bulk mail is a large-scale list

Bulk mail is therefore best understood as a **large-scale list service**. Its distinctive property is not a different transport primitive. Its distinctive property is scale and policy sensitivity.

That means the same core mechanics still apply:

- stable list-service identity
- explicit service scope
- custody-chain extension
- recipient consent or entitlement
- unsubscribe or revocation handling when applicable

### Why VAMP does not need a separate bulk transport primitive

VAMP does **not** need a separate wire-level bulk protocol class because the existing redistribution model already answers the real protocol questions:

- who is sending
- under what authority
- to which recipient set
- with what consent basis
- with what provenance chain

What bulk mail may still need is a separate **policy lane**, not a separate **message primitive**.

That distinction matters. The research on sender-cost and provider policy strongly supports dedicated high-volume treatment for operational reasons. But that does not require a different authorship model, a different trust root, or a different custody model. It only requires different enforcement thresholds and reputation expectations for the same underlying list-service primitive.

So the architectural conclusion is:

- **one redistribution primitive**
- **multiple policy classes**

## 4. Recipient evaluation

### How recipients distinguish direct human mail from redistributed mail

Recipients should not have to infer redistribution from weak heuristics. VAMP clients and receiver-edge policy should be able to distinguish:

- direct human-originated native mail
- redistributed human-authored content
- service-originated list or newsletter mail
- service-originated notification mail

That distinction should come from the custody chain:

- direct human mail has device-origin plus organization-authorized transport
- redistributed mail has a redistribution custody step
- service-originated mail has a service author or redistribution identity

### How trust signals should be surfaced

Clients should surface redistribution explicitly. Useful trust signals include:

- direct known sender
- redistributed by `team-updates@example.org`
- newsletter from `news.example.org`
- notification from `billing.example.org`
- service identity valid but no subscription proof
- service identity valid with current subscription proof

This is especially important because the recipient needs to understand two different trust questions:

- Do I trust the original author?
- Do I trust this redistribution service to have sent this to me legitimately?

### Preserving authorship in the UI

When original authorship exists, the UI should preserve it rather than flattening everything into one sender string. For example:

- "Alice Smith, redistributed by engineering-all@example.org"
- "Product Updates, sent via updates@example.org"

That is one of the clearest user-facing improvements over legacy list handling and forwarding ambiguity.

## 5. Abuse and accountability

### Redistribution and sender-edge accountability

Redistribution should not weaken sender-edge accountability. The list service's outbound traffic still exits through an authoritative sender-edge, and that sender-edge remains the resource and policy boundary for:

- rate control
- sender-cost accounting
- complaint handling
- reputation accumulation
- operator alerts and kill switches

This is one of the main reasons to keep list services explicit. They should burn their own organization's trust and budget, not borrow someone else's invisibly.

### How list services consume sender budget or reputation

A list service should consume budget and reputation as a sender class beneath its organization. That means:

- the organization has domain-scoped accountability
- the list service can have per-service subaccounting
- complaint and failure signals can be attached to the service identity or scope
- abusive or degraded list behavior can be throttled without collapsing the entire domain

This fits the sender-cost mechanics research: budgets attach first to the domain or tenant boundary, with finer-grained accounting beneath it.

### Why the model reduces laundering and ambiguity

This model reduces laundering and ambiguity in three ways.

First, it prevents hidden path donation. The list service is explicit, so it cannot masquerade as transparent transport.

Second, it preserves authorship while still naming the redistributor. That makes impersonation and "internal-looking" ambiguity harder to manufacture.

Third, it makes consent evaluation explicit. A service claiming newsletter or subscribed-message status can be required to present the relevant subscription proof rather than merely asserting that the recipient asked for the mail.

### Relationship to high-volume policy

The sender-cost and threat-model research argues, correctly, that operators may still want a dedicated bulk lane for high-volume services. This chapter does not contradict that. It clarifies the boundary:

- the **protocol primitive** is still list-service redistribution
- the **policy lane** may become stricter once the service behaves like a high-volume sender

That is the right split because it avoids inventing a second sender ontology just to express different operational thresholds.

## Recommended baseline architecture

VAMP should adopt the following redistribution rules.

1. **Represent lists, newsletters, and notifications as explicit list services.**  
   They are named actors, not hidden relays.

2. **Authorize list services under the organization's trust chain.**  
   A list service is another delegated service identity beneath the domain and organization.

3. **Use custody-chain extension for redistribution.**  
   Redistribution adds a new accountable step instead of overwriting sender history.

4. **Preserve original authorship when it exists.**  
   The redistributor and the original author are different facts and should both remain visible.

5. **Prefer wrapping to mutation when possible.**  
   Add redistribution context around the original object rather than editing the authored content in place.

6. **Treat material content change as re-origin or a new message object.**  
   Meaningful mutation cannot pretend to be transparent forwarding.

7. **Use one protocol primitive for bulk and list redistribution.**  
   Newsletters, notifications, and bulk mail are all list-service distributions.

8. **Allow separate policy treatment without inventing a separate protocol class.**  
   High-volume senders may live in a stricter lane, but they still use the same redistribution model.

## Final assessment

VAMP does not need a special bulk-mail protocol primitive because the system already has the right abstraction: an explicitly authorized list service extending the custody chain. Mailing lists, newsletters, notifications, and large-scale campaigns are all instances of the same structural idea: a service with a stable identity redistributes content to a managed recipient set under organization authority.

What changes at scale is not the meaning of the message primitive. What changes is policy: complaint tolerance, sender-cost treatment, budget accounting, and enforcement posture. That is exactly the distinction VAMP should preserve. The protocol stays unified, provenance stays intelligible, and operators still get the levers they need for high-volume abuse control.
