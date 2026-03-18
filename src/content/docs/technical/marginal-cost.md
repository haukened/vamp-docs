---
title: 'Marginal Cost'
description: How VAMP applies sender-incurred marginal cost to unauthorized bulk delivery.
sidebar:
  order: 8
---

VAMP's redistribution model creates a clean policy boundary. Bulk delivery with valid recipient consent is authorized redistribution. Bulk delivery without valid consent proof is unauthorized scale. This chapter defines how VAMP uses sender-incurred marginal cost to enforce that boundary, so the cost of unsolicited delivery is paid at origination rather than absorbed by receivers.

The goal is not another heuristic spam filter. The goal is to make abusive fan-out consume sender resources at the sender-edge, where the protocol already has identity, custody, and policy context. Consent-backed newsletters, notifications, and mailing lists should remain cheap to deliver. Unsolicited bulk should become operationally expensive to originate.

## Design Thesis

VAMP should treat valid subscription or membership proof as the dividing line between low-cost redistribution and costly bulk delivery. When a sender can prove that a recipient authorized a given list service or notification stream, VAMP should allow that delivery to proceed without per-message marginal cost. When the sender cannot provide that proof, the protocol should classify the traffic as unauthorized bulk and require sender-incurred work before delivery is attempted.

That approach matches the earlier design papers. The redistribution chapter defines newsletters, list traffic, and notifications as one list-service primitive rather than separate mail classes. The subscription chapter defines recipient consent as a device-backed, sender-scoped assertion that can be validated at delivery time. Marginal cost is therefore not the first line of policy. It is the enforcement layer that activates when redistribution lacks the consent proof required to remain cheap.

## The Policy Boundary Between Free And Costly Delivery

The free path in VAMP is not "any message that claims to be legitimate." It is traffic that can justify its delivery semantics.

Direct human-originated mail is usually on the free path because it is low-volume, attributable, and evaluated through the ordinary identity and relationship model described in the native flow paper. Consent-backed redistribution is also on the free path because the sender can present a valid membership proof showing that the recipient authorized that list service or notification source.

Unauthorized bulk is different. A receiver-edge should classify a message as unauthorized bulk when all of the following are true:

- the delivery is structurally redistribution or campaign-style fan-out rather than ordinary direct human correspondence
- the sender cannot produce valid subscription or membership proof for the recipient and list-service scope
- the traffic pattern or service role indicates scale, repetition, or bulk semantics rather than a single direct interpersonal contact

That classification is important because it gives the receiver-edge an objective reason to demand cost instead of relying on opaque content scoring. The question becomes "was this recipient authorized for this redistribution stream?" rather than "does this message feel like spam?"

## The Purpose Of Marginal Cost In VAMP

Marginal cost exists to move the economics of abuse back to the sender side of the network.

In the legacy mail model, unsolicited bulk is cheap to originate and expensive to defend against. Receivers spend CPU, storage, analyst time, user attention, and false-positive budget deciding which incoming traffic to distrust. VAMP inverts that arrangement. If a sender wants to originate large volumes of unconsented traffic, the sender-edge should have to spend a scarce local resource to do so.

That serves four purposes.

First, it shifts operating cost back toward the party creating the load. Second, it reduces the amount of receiver-side filtering required to separate authorized redistribution from abuse. Third, it forces scale-dependent attacks such as spam, scam fan-out, and mass phishing to consume sender resources in proportion to their reach. Fourth, it gives operators a native control surface for throttling or terminating bad campaigns before they externalize their costs onto the rest of the network.

Marginal cost therefore acts as a protocol-level economic control, not a user-facing challenge and not a replacement for all trust decisions.

## Where Marginal Cost Is Applied

VAMP should apply marginal cost at the authoritative sender-edge for the sender domain. The sender-edge is the correct execution point because it already performs submission validation, policy evaluation, transport authorization, and custody extension. It is also the actor that can be held accountable by other operators.

Client-side proof of work is the wrong model for this system. End-user devices should not be forced to solve puzzles, expose battery life, or degrade accessibility just because a sender wants to run a bulk campaign. More importantly, client-side work does not align with VAMP's trust boundary. The protocol sender is the egress edge for the domain, not the user device. If cost is meant to discipline senders, it must be borne by the sender-edge or infrastructure the sender controls.

This also allows cost to interact with domain-scoped and service-scoped budgets. A sender-edge can maintain separate accounting for:

- ordinary human-originated traffic
- known list services with validated subscriptions
- unsolicited or under-attested redistribution streams
- suspicious campaigns whose rate or targeting exceeds local trust thresholds

That budget model keeps cost native to the operator control plane. The domain can see which service is burning resources, which tenant is exhausting allowance, and which campaign should be slowed, challenged, or terminated.

## Traffic Classes That Should And Should Not Incur Cost

VAMP should not impose sender-incurred marginal cost uniformly. The whole point is to apply it where it changes the economics of abuse without degrading ordinary mail.

Human-originated direct mail should normally remain free of per-message cost. That includes first-contact mail, although first-contact traffic may still be subject to elevated scrutiny, rate limits, or relationship-aware controls at the receiver-edge. First contact is not the same thing as unauthorized bulk.

Authenticated subscribed bulk should also remain on the cheap path. If a newsletter, product notification stream, or mailing list can present valid membership proof for the recipient, the message is authorized redistribution and should not be forced through the punishment lane simply because it is high volume.

Unsolicited bulk without valid consent proof should incur cost by default. Suspicious high-volume campaigns should face increasing cost, lower rate ceilings, or both, especially when they target many first-contact recipients or exhibit campaign behavior inconsistent with the sender's established role.

Legacy downgraded traffic, if VAMP supports any interoperability path for it, should not receive the same benefit of the doubt as native authenticated traffic. A receiver-edge may require stronger sender-edge cost, tighter quotas, or degraded delivery semantics when identity, policy, or consent evidence is missing because of downgrade.

## Mechanism Expectations

The mechanism VAMP uses for marginal cost should satisfy several architectural requirements.

Verification at the receiver must be cheap. The receiver-edge should be able to check whether the sender performed the required work without recreating the sender's expense. Difficulty must be tunable so that the burden can scale with campaign size, recipient relationship, service role, and receiver policy. The proof should be bound tightly enough to message context, recipient scope, time, and sender identity that it cannot be amortized cheaply across a whole campaign or replayed across domains.

The work factor should also be attributable. A receiver should know which sender domain, sender-edge, and list or service identity incurred the work. That lets cost integrate with reputation and operator policy instead of floating as an anonymous token economy.

VAMP does not need to freeze one concrete algorithm in this chapter, but the protocol should prefer a non-monetary proof family with these properties:

- expensive enough for the sender to make unsolicited fan-out costly
- cheap enough for the receiver to verify inline
- memory-hard or otherwise resistant to trivial hardware asymmetry and easy central amortization
- bindable to specific recipients, batches, or narrowly scoped message contexts
- adjustable by policy so trusted, consent-backed traffic can remain cheap while suspicious campaigns become progressively expensive

In practice, the sender-edge should compute and attach the cost proof as part of transmission authorization, after it determines that the message does not qualify for the free consent-backed path. Users never see this mechanism, and recipient devices never participate in it.

## Abuse And Adversarial Behavior

Marginal cost is particularly effective against attacks that depend on cheap scale. Spam campaigns become more expensive because every unconsented delivery burns sender-side compute or another scarce local resource. Mass phishing becomes harder to run at volume because the sender can no longer externalize the cost of millions of probes onto receiver infrastructure. Scam fan-out and abusive list expansion also become less attractive because they must either obtain real subscription proof or pay an accumulating origination cost.

The model also makes list abuse easier to reason about. Purchased lists and scraped addresses do not carry valid recipient consent within VAMP's subscription model, so they fall directly into the costly lane. Forged membership claims fail because the sender cannot produce the cryptographic proof. Replay attacks are limited when proofs are recipient-bound, time-bound, and sender-scoped.

Marginal cost does not solve every abuse class by itself. A compromised trusted sender may still originate harmful traffic until the compromise is detected and the sender's privileges are reduced or revoked. Low-volume impersonation and highly targeted social engineering may remain economically viable because they do not depend on bulk scale. VAMP therefore still needs identity validation, revocation, anomaly detection, operator visibility, and recipient-side trust signaling. Cost is a strong control against scale abuse, not a universal substitute for security policy.

## Operator Value

Sender-incurred cost gives both receivers and sending-domain administrators better operational leverage.

For receivers, the system reduces dependence on fragile content heuristics because consent-backed redistribution is explicitly provable and unauthorized scale is explicitly expensive. Filtering does not disappear, but its job becomes narrower and higher quality. Operators can spend less effort guessing intent from content and more effort enforcing clear protocol facts.

For sending domains, the model creates visibility into where abuse is actually originating. If one list service, tenant, or campaign begins consuming disproportionate sender-edge work budget, administrators can see it directly, alert on it, slow it down, or shut it off. The protocol stops hiding abusive scale inside generic outbound volume and starts surfacing it as a measurable cost center.

That is why native sender-side cost makes the system easier to defend. It turns unsolicited fan-out from an externality into an observable, attributable, and controllable resource burn inside the sender's own infrastructure boundary.

## Interaction With Subscriptions And Redistribution

The subscription model is what keeps VAMP from punishing legitimate redistribution. A valid subscription assertion proves that the recipient authorized deliveries from a specific sender domain and list-service scope. That proof is therefore the policy line between acceptable high-volume redistribution and unauthorized bulk.

When that proof is present, legitimate newsletters and notifications stay out of the punishment path even if their volume is large. When it is absent, the sender cannot claim that volume alone should excuse the delivery. The system does not need a separate bulk-mail channel because the protocol already has the two facts that matter: whether the redistribution is consent-backed and whether the sender is willing to bear the cost of originating traffic that is not.

This preserves the unification established in the redistribution chapter. Mailing lists, newsletters, notifications, and other bulk senders still use one list-service primitive. What changes is the policy outcome. Consent-backed instances stay cheap. Unconsented instances become expensive.

## Recommended Policy Model

VAMP should adopt the following baseline policy:

1. Native direct human mail is delivered through the normal identity and relationship path without per-message marginal cost.
2. Redistribution traffic with valid per-recipient subscription or membership proof is treated as authorized and remains low-cost.
3. Redistribution or campaign traffic without valid consent proof is classified as unauthorized bulk and requires sender-incurred marginal cost at the sender-edge.
4. Receiver policy may raise cost, tighten quotas, or degrade treatment further for suspicious high-volume campaigns, downgraded traffic, or senders with poor prior behavior.
5. Cost proofs should be cheap to verify, tightly bound, difficult to amortize, and attributable to the sender domain and service identity that incurred them.

This gives VAMP a coherent enforcement layer. Consent-backed redistribution is cheap to deliver. Unsolicited scale is expensive to originate. The burden of abuse is pushed back toward the sender. Proof of work, or another comparable non-monetary sender-edge cost mechanism, becomes a native protocol control rather than a challenge imposed on users.
