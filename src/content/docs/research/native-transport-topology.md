---
title: VAMP Native Transport Topology  
---

Sender-edge to receiver-edge delivery with no third-party transit relay in the normal path

## Executive summary

This paper defines a transport topology for VAMP in which the **sender** is the authoritative **egress edge** for the sender’s administrative domain, the **receiver** is the authoritative **ingress edge** for the recipient’s administrative domain, and **no third-party transit relay is allowed between them in the normal mail path**. This is not a rejection of store-and-forward messaging. It is a tighter definition of **where store-and-forward is allowed to occur**: at the **authoritative edges**, not through arbitrary middleboxes. That model is consistent with modern Internet mail architecture, which already separates **message submission** from **message transfer**, models email as an **asynchronous sequence of point-to-point transfers**, and expects MTAs to **store messages and retry after temporary failures**.[^1][^2]

The topology is also practical on today’s Internet. Major cloud platforms often **block or restrict direct outbound TCP port 25** from arbitrary compute and instead recommend or require **authenticated relay services**: Amazon EC2 blocks public outbound port 25 by default, Google Cloud blocks external port 25 because of abuse risk, and Azure blocks port 25 for most subscription types while recommending authenticated relay on port 587. In other words, the modern Internet already pushes mail-sending responsibility toward a **small number of managed egress services**. VAMP can turn that operational reality into a clean protocol boundary rather than pretending every endpoint is a first-class mail originator.[^3][^4][^5]

The main value of this topology is not elegance. It is **accountability**. It sharply reduces the ability of intermediate systems to **launder identity, trust, or sender cost**, which is exactly the problem demonstrated by recent real-world abuse cases. Proofpoint documented spam being relayed from Microsoft 365 tenants through customer Proofpoint infrastructure because the relay configuration did not restrict which tenants were allowed to use it; in some cases DKIM signing was applied during transit, making the spam more deliverable. Proofpoint also documented internal-looking phishing campaigns abusing Microsoft 365 Direct Send in combination with unsecured third-party email security appliances used as SMTP relays. Both cases are examples of why a protocol that wants to make sender identity and sender cost meaningful should not allow transparent third-party transit relays in the normal path.[^6][^7]

The topology directly helps with the threat models previously identified as **scale-dependent or transport-dependent**: **relay/gateway laundering**, **SMTP downgrade abuse**, **bulk spam**, **high-volume phishing**, and **broad post-compromise fan-out**. It only partially helps with **directory harvesting** and does not, by itself, solve **low-volume impersonation**, **BEC setup**, or **compromised but previously trusted senders**. Those defer to other controls such as identity lifecycle, revocation, anomaly detection, and trust policy.[^8][^9]

## 1. Topology definition

### 1.1 Sender-edge

For VAMP, the **sender-edge** is the **authoritative outbound boundary service** for the sender’s administrative domain. This maps directly onto the Internet Mail Architecture’s concept of an **Administrative Management Domain (ADMD)** and its **Boundary MTA / Outbound MTA** roles. RFC 5598 says ADMDs exist to separate internal from external issues and explicitly lists concerns such as **reliability, access control, accountability, and content evaluation** as domain policy concerns. The same RFC also notes that one ADMD can host services for other ADMDs, which makes delegated cloud or managed-provider egress fully consistent with the architecture.[^10]

### 1.2 Receiver-edge

The **receiver-edge** is the **authoritative inbound boundary service** for the recipient’s administrative domain. Again, this maps cleanly onto RFC 5598’s **Boundary MTA / Inbound MTA** role and the MX-based reachability model of SMTP. The receiver-edge is the first externally visible VAMP endpoint for the recipient domain, even if the domain internally routes mail onward to storage, policy engines, archival systems, or local delivery agents.[^1][^10]

### 1.3 Native VAMP path

For typical person-to-person or application-to-person mail, excluding dedicated bulk-sender flows, the **native VAMP path** is:

1. **Submission** from a user, application, or local system to the sender-edge.
2. **Direct inter-domain transfer** from the sender-edge to the receiver-edge.
3. **Local receipt and delivery** inside the recipient domain.

In this model, **no third ADMD transit relay** exists between sender-edge and receiver-edge. Internal hops inside the sender’s own service or the receiver’s own service are out of scope for the external protocol and are treated as internal implementation detail, not as independent transport actors.[^1][^2]

### 1.4 What is *not* part of the native path

The following are **not** part of the normal native path:

- unaffiliated third-party transit relays,
- transparent forwarding services,
- mailing lists treated as mere pass-through,
- outbound security gateways that re-emit mail on behalf of unrelated senders,
- inbound security services that overwrite or replace origin accountability.

If such services exist, they must be modeled as **explicit custody services** or **re-originators**, not as invisible transport. That distinction is required both by operational reality and by existing mail-authentication lessons from DMARC and ARC.[^11][^12]

## 2. Why this topology is technically plausible now

### 2.1 Internet mail is already asynchronous and point-to-point

RFC 5598 describes Internet Mail as an **asynchronous sequence of point-to-point transfer mechanisms** with **no requirement for the author, originator, or recipients to be online at the same time**. The same RFC says SMTP is used primarily for **point-to-point transfers between peer MTAs**, provides **basic reliability via retransmission after temporary transfer failure**, and expects MTAs to **store messages in a manner that allows recovery across service interruptions**. That means VAMP does **not** need intermediate transit relays to preserve store-and-forward behavior. Store-and-forward already exists at the MTA layer itself.[^1]

### 2.2 The Internet already distinguishes submission from transfer

RFC 6409 separates **message submission** from **message transfer** and says that this separation makes it easier to **implement security policies** and **guard against unauthorized mail relaying or injection of unsolicited bulk mail**. That is exactly the split VAMP needs. Submission occurs into the sender-edge; transfer occurs between sender-edge and receiver-edge. Once those roles are cleanly separated, the protocol can attach identity, sender cost, and policy to the correct boundary instead of smearing them across arbitrary hosts.[^2]

### 2.3 Modern cloud networks already centralize mail egress

This topology also fits the way cloud networks already behave.

- **Amazon EC2** allows outbound traffic on port 25 only to private IPv4 addresses by default; traffic to public IPv4 or IPv6 destinations on port 25 is blocked unless the restriction is removed.[^3]
- **Google Cloud** blocks connections to external destination TCP port 25 because of abuse risk and recommends ports **587/465**, third-party providers, or Google Workspace relay instead.[^4]
- **Azure** recommends authenticated SMTP relay services on port **587**, says those are used in part to maintain **IP reputation**, and blocks outbound port 25 for most subscription types.[^5]

The operational implication is that direct MTA-to-MX delivery from arbitrary workloads is no longer the common or recommended cloud pattern. Instead, organizations already use a **small number of managed outbound edges**. VAMP can formalize that reality without giving up direct inter-domain transfer.

## 3. Why “no third-party transit relay” is a useful rule

### 3.1 It makes sender identity and sender cost attach to one accountable edge

If the sender is defined as the **authoritative egress edge** of the sender’s domain, then both **identity** and **sender-incurred marginal cost** become attributable to a single external actor. This sharply simplifies accounting.

That is already how large mail systems are moving. Exchange Online has introduced **tenant-level outbound email limits** (TERRL) based on tenant license count and explicitly says additional restrictions can apply because of suspicious behavior, spam, fraud, or other factors. Microsoft also documents default admin alerts such as **Email sending limit exceeded** and **Suspicious email sending patterns detected**, showing that outbound abuse is already being measured and surfaced at the sender service boundary rather than at individual clients.[^13][^14]

This directly helps the previously identified threat models of:

- **bulk spam**,  
- **high-volume phishing**, and  
- **broad post-compromise fan-out**  

because those threats depend on scaling outbound activity cheaply and inconspicuously. A sender-edge topology gives the operator one place to meter, alert, and cut off abuse.[^13][^14]

### 3.2 It prevents relay/gateway laundering

The most direct argument for this topology is empirical.

Proofpoint’s July 2024 research showed that a spam actor abused a modifiable routing feature so that spam from Microsoft 365 tenants was **relayed through Proofpoint-hosted customer infrastructure**. Proofpoint said the problem existed because the relay configuration allowed outbound messages from Microsoft 365 tenants but did **not** restrict which tenants were allowed. It also noted that **any email infrastructure that offers this type of relay feature can be abused by spammers**. In some cases, when customer domains were spoofed while relaying through the matching infrastructure, **DKIM signing was applied during transit**, making the spam more deliverable.[^6]

That is exactly the class of problem VAMP should eliminate in the native path. If only the sender-edge may originate native delivery and only the receiver-edge may receive it, then a third-party transit relay cannot “donate” its infrastructure reputation or signing authority to unaffiliated senders.

This topology therefore directly addresses the threat model of **relay/gateway laundering**.[^6]

### 3.3 It reduces the attack surface for internal-looking spoofing through relays

Proofpoint’s 2025 analysis of attacks abusing **Microsoft 365 Direct Send** documented a phishing campaign in which threat actors used **unsecured third-party email security appliances as SMTP relays** to inject messages that appeared as **internal email**. Proofpoint says Direct Send can be misused to deliver unauthenticated messages that appear to come from within the organization, and that attackers used third-party appliances as relay points to get those messages into Microsoft 365 tenants.[^7]

A topology that forbids third-party transit relays in the normal native path does not solve spoofing alone, but it removes one of the **transport tricks** that made this campaign more effective. That makes the topology directly relevant to the threat models of:

- **relay/gateway laundering**, and  
- **some classes of low-volume impersonation that depend on relay misuse**.[^7]

### 3.4 It simplifies downgrade resistance

SMTP already had to learn this lesson the hard way. RFC 8461 explains that STARTTLS can be downgraded if an attacker strips the `250 STARTTLS` response or tampers with MX resolution, and MTA-STS exists so recipient domains can declare whether secure SMTP is expected and whether the sender should refuse delivery to MX hosts that do not meet the policy.[^15] The same architecture lesson appears earlier in HSTS on the web: once a site declares strict transport, the client should not silently fall back to a weaker mode.[^16]

A sender-edge-to-receiver-edge topology helps because there is only **one external native hop** to reason about. If the sender-edge knows the receiver-edge is VAMP-capable, then any attempt to use SMTP instead becomes an **explicit downgrade**, not an ambiguous multi-hop routing choice. That does not solve downgrade abuse by itself, but it makes policy much simpler and therefore more enforceable.

This topology therefore directly helps with **SMTP downgrade abuse**, though full protection still depends on explicit anti-downgrade policy.[^15][^16]

### 3.5 It avoids the known interoperability pain of indirect flows in the normal path

RFC 7960 says DMARC can create **potentially disruptive interoperability issues when messages do not flow directly from the author’s administrative domain to the final recipients**, and it defines those as **indirect email flows**. The RFC specifically discusses mailing lists, forwarders, and combined indirect flows as real interoperability problems.[^11]

That is not merely a DMARC complaint. It is a structural warning: once messages traverse additional, modifying intermediaries, the relationship between the original domain, the apparent sender, and the delivery path becomes harder to reason about. A direct sender-edge → receiver-edge path avoids that complexity in the default case.

This topology therefore directly reduces the normal-path exposure to problems associated with **indirect flows**, while leaving special handling for those flows to explicit alternate roles.[^11]

## 4. Strengths of the topology

### 4.1 Clear external trust boundaries

The topology makes the boundary between **internal mechanics** and **external protocol behavior** explicit. A cloud provider, on-prem cluster, or hybrid deployment can use any number of internal filters, queues, scanning engines, and routing layers, but to the outside world there is still one **sender-edge** and one **receiver-edge**. That aligns well with RFC 5598’s ADMD model, which explicitly exists to distinguish **internal issues** from **external ones**.[^10]

#### Problem solved, idiomatically

This solves the **“Who is actually responsible for this message?”** problem.  
In SMTP’s looser world, multiple hops can each add trace, modify handling, and contribute reputation. In the native VAMP topology, the answer is simple: **the sender-edge originated the message for transport; the receiver-edge accepted it for delivery**.

### 4.2 Store-and-forward without third-party trust donation

Because RFC 5598 already treats email as asynchronous point-to-point transfer with retransmission and durable storage at MTAs, removing third-party transit relays does **not** remove the core benefit of store-and-forward. The sender-edge can still queue and retry until the receiver-edge is reachable.[^1]

#### Problem solved, idiomatically

This solves the **“We need relays for reliability”** objection.  
You need durable **edges**, not arbitrary transit relays, to get store-and-forward semantics.

### 4.3 Better alignment with sender-cost enforcement

Because the sender is the sender-edge, any sender-incurred marginal cost can be accounted to the **authoritative outbound service** of the sender’s domain. That is operationally legible, because major platforms already meter outbound behavior at the **tenant**, **relay**, or **service** boundary rather than trying to price every client equally.[^13][^14]

#### Problem solved, idiomatically

This solves the **“Who pays?”** problem.  
Without a clear sender boundary, sender cost can be laundered or fragmented. With a sender-edge, the budget and the burn rate live in one accountable place.

### 4.4 Simpler operational fit for cloud deployments

Because cloud platforms often block or discourage direct outbound port 25 from arbitrary workloads, most organizations already need some kind of **authoritative egress service**. AWS, Google Cloud, and Azure all push operators toward relay or managed email services rather than “let every VM speak direct SMTP to the world.”[^3][^4][^5]

#### Problem solved, idiomatically

This solves the **“Can this work in cloud?”** problem.  
Yes — because the cloud already expects a managed egress edge.

## 5. Weaknesses and constraints

### 5.1 Forwarders, remailers, and mailing lists cannot be transparent in the native path

The strongest constraint is that **indirect flows stop being transparent**.

RFC 7960 says indirect flows create interoperability issues for DMARC, and RFC 8617 introduced ARC precisely to carry a **chain of custody** through mail handlers that modify or re-evaluate mail. RFC 5598 goes even further for mailing lists: because a mailing list can modify message content in any way, it is responsible for that content and is therefore treated as an **Author**, not just a transparent relay.[^11][^12][^17]

That means VAMP cannot honestly treat mailing lists or forwarders as mere middleboxes in the native path. They have to be modeled as one of:

- a **custody-bearing intermediary** with explicit semantics, or  
- a **re-originator** with its own sender identity and policy.

That is not a flaw in the topology; it is a design consequence. But it is a real constraint.

### 5.2 Some organizations will still need delegated egress

“No intermediary between sender-edge and receiver-edge” does **not** mean every enterprise runs its own outbound MTA directly from every network segment. In practice, many organizations will designate a managed cloud service or provider as the sender-edge, because cloud infrastructure and mail reputation requirements already push them that way.[^3][^4][^5]

So the topology requires a second concept: **delegated sender-edge authority**. That delegation must be explicit, because sender cost, policy, and identity all attach there.

### 5.3 Recipient-side security stacks still exist — they become part of the receiver-edge

Many enterprises will continue to run inbound filtering, anti-malware, archival, journaling, or split-delivery systems. Google Workspace’s routing docs explicitly support models where Gmail first processes inbound mail, filters spam, and then forwards it to an on-premise server. That is compatible with this topology as long as those components are treated as part of the **receiver-edge or recipient ADMD**, not as unrelated third-party transit relays.[^18]

So the rule is **not** “one physical server on each side.”  
The rule is: **one authoritative external edge on each side**.

### 5.4 The topology does not solve trust-abuse attacks by itself

This topology gives a cleaner transport and accountability model, but it does **not** by itself stop:

- **BEC setup messages**,  
- **compromised trusted senders**,  
- **single-message thread hijacking**, or  
- **surgical low-volume impersonation**.

Those threats defer to other controls such as:

- strong sender identity,  
- device-bound keys,  
- revocation,  
- anomaly detection,  
- relationship history, and  
- explicit downgrade policy.

This should be stated plainly so the design remains honest.

## 6. Threat-model mapping

### 6.1 Threats directly addressed or strongly improved by this topology

#### Relay / gateway laundering  

**Directly addressed.**  
By removing third-party transit relays from the normal path, the topology removes the exact mechanism abused in the Proofpoint 2024 case, where unaffiliated senders borrowed reputable infrastructure and even received DKIM signing in transit.[^6]

#### SMTP downgrade abuse 

**Strongly improved, but not solved alone.**  
The sender-edge → receiver-edge model leaves only one native external hop, making any SMTP use an explicit downgrade event. This dramatically simplifies anti-downgrade policy, though actual downgrade protection still depends on protocol policy akin to MTA-STS/HSTS.[^15][^16]

#### Bulk spam and high-volume phishing 

**Partially addressed via cleaner sender-cost attachment.**  
The topology does not, by itself, impose cost. But it defines the sender in a way that makes domain-scoped sender cost and quotas operationally meaningful, which is exactly what these scale-dependent threats require.[^13][^14]

#### Broad post-compromise fan-out  

**Partially addressed.**  
A compromised account trying to send broadly is more visible when all external delivery must pass through the sender-edge, where quotas, alerts, and policy can be enforced.[^13][^14]

### 6.2 Threats only partially addressed and requiring other controls

#### Directory harvesting  

**Only partially addressed.**  
The topology helps only if capability/identity lookups are tied to the sender-edge and rate-limited there. On its own, the transport topology does not stop harvesting. Microsoft’s guidance against namespace mining shows the need for explicit anti-enumeration controls.[^19]

#### Low-volume impersonation  
**Mostly deferred.**  
The topology removes some relay-based impersonation tricks, but low-volume impersonation primarily requires stronger sender identity and recipient trust signals.[^7]

#### BEC setup messages  

**Mostly deferred.**  
BEC remains a trust-abuse and identity-compromise problem, not merely a transport-shape problem.[^8]

#### Compromised but previously trusted senders  
**Mostly deferred.**  
The topology helps centralize detection, but compromised trusted senders still require revocation, anomaly detection, and trust-reset controls.[^8]

## 7. Final assessment

The sender-edge → receiver-edge topology is a strong default for VAMP’s **native** transport.

It works because it aligns with three facts that are already true:

1. Internet mail already supports **asynchronous point-to-point, store-and-forward transfer** without requiring intermediaries between every hop.[^1]  
2. Modern mail operations already separate **submission** from **transfer** and already meter abuse at **tenant / relay / service** boundaries.[^2][^13][^14]  
3. Real-world abuse has repeatedly shown that **intermediate relays and gateways can launder trust**, making spam and phishing more deliverable.[^6][^7]

So the topology should be adopted as the **default native transport rule**:

> **For ordinary VAMP mail, the only allowed external native path is sender-edge → receiver-edge.**

Everything else — mailing lists, forwarders, archival hops, bulk-sender services, migration bridges, SMTP fallback — should be modeled as **explicit alternate roles**, not as transparent transport. That is the cleanest way to preserve accountability, make sender-incurred cost meaningful, and keep the normal path narrow enough to secure.

## Footnotes

[^1]: RFC 5598, *Internet Mail Architecture*. RFC 5598 describes Internet Mail as an **asynchronous sequence of point-to-point transfer mechanisms**, says there is **no requirement for authors/originators/recipients to be online at the same time**, states that SMTP is used primarily for **point-to-point transfers between peer MTAs**, and says SMTP supports reliability through **retransmission after temporary transfer failure** while MTAs are expected to store messages durably enough to recover across service interruptions. https://www.rfc-editor.org/rfc/rfc5598

[^2]: RFC 6409, *Message Submission for Mail*. RFC 6409 says that separating **submission** from **transfer** makes it easier to implement security policies and guard against **unauthorized mail relaying** and **injection of unsolicited bulk mail**. https://www.rfc-editor.org/rfc/rfc6409

[^3]: Amazon EC2 User Guide, *Restriction on email sent using port 25*. AWS says EC2 allows outbound traffic over port 25 only to private IPv4 addresses by default; traffic to public IPv4 and IPv6 destinations on port 25 is blocked unless the restriction is removed. https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-resource-limits.html

[^4]: Google Cloud, *Sending email from an instance*. Google Cloud says connections to external destination TCP port 25 are blocked because of abuse risk, recommends ports 587/465, third-party providers, or relay services, and notes that some projects are exceptions. https://docs.cloud.google.com/compute/docs/tutorials/sending-mail

[^5]: Microsoft Learn, *Troubleshoot outbound SMTP connectivity problems in Azure*. Microsoft recommends authenticated SMTP relay services on port 587, says those services help maintain IP reputation, and states that Azure blocks outbound TCP port 25 for most subscription types. https://learn.microsoft.com/en-us/troubleshoot/azure/virtual-network/troubleshoot-outbound-smtp-connectivity

[^6]: Proofpoint Threat Insight, *Scammer Abuses Microsoft 365 Tenants, Relaying Through Proofpoint Servers to Deliver Spam Campaigns* (July 29, 2024). Proofpoint reports that a spam actor abused a relay configuration feature so that spam from Microsoft 365 tenants was sent through Proofpoint customer infrastructure; in some cases DKIM signing was applied in transit, making the spam more deliverable. https://www.proofpoint.com/us/blog/threat-insight/scammer-abuses-microsoft-365-tenants-relaying-through-proofpoint-servers-deliver

[^7]: Proofpoint, *Attackers Exploit M365 for Internal Phishing* (2025). Proofpoint documented phishing campaigns abusing Microsoft 365 Direct Send and unsecured third-party email security appliances as SMTP relays to inject spoofed messages that appeared as internal mail. https://www.proofpoint.com/us/blog/email-and-cloud-threats/attackers-abuse-m365-for-internal-phishing

[^8]: Microsoft, *Microsoft Digital Defense Report 2025*. Microsoft reports that BEC represented only 2% of total threats observed but 21% of attack outcomes, and describes BEC as typically beginning with identity compromise and then expanding through inbox-rule abuse, thread hijacking, and related trust-abuse tactics. https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/bade/documents/products-and-services/en-us/security/Microsoft-Digital-Defense-Report-2025-v4-05Nov25.pdf

[^9]: Microsoft Security Blog, *Phishing actors exploit complex routing and misconfigurations to spoof domains* (January 6, 2026). Microsoft documents internal-looking spoofed mail enabled by routing and spoof-protection weaknesses, illustrating that some impersonation threats require stronger identity controls in addition to topology. https://www.microsoft.com/en-us/security/blog/2026/01/06/phishing-actors-exploit-complex-routing-and-misconfigurations-to-spoof-domains/

[^10]: RFC 5598, *Internet Mail Architecture*. RFC 5598 defines **Administrative Management Domains (ADMDs)**, says the ADMD construct helps distinguish internal from external issues, lists **reliability, access control, accountability, and content evaluation/modification** as domain policy concerns, and notes that one ADMD can host services for another. It also defines **Boundary MTAs**, **Outbound MTAs**, and **Inbound MTAs**. https://www.rfc-editor.org/rfc/rfc5598

[^11]: RFC 7960, *Interoperability Issues between DMARC and Indirect Email Flows*. RFC 7960 says DMARC enables potentially disruptive interoperability issues when messages **do not flow directly from the author’s administrative domain to the final recipients**, and calls such cases **indirect email flows**. https://www.rfc-editor.org/rfc/rfc7960

[^12]: RFC 8617, *The Authenticated Received Chain (ARC) Protocol*. ARC defines a verifiable **chain of custody** across Internet Mail Handlers, which is the right model when a message does traverse intermediaries that assess or modify authentication state. https://www.rfc-editor.org/rfc/rfc8617

[^13]: Microsoft Exchange Team Blog, *Introducing Exchange Online Tenant Outbound Email Limits* (2025). Microsoft introduced tenant-level outbound external recipient limits (TERRL), calculated from tenant license count, and says additional restrictions can apply for suspicious behavior, spam, fraud, or related factors. https://techcommunity.microsoft.com/blog/exchange/introducing-exchange-online-tenant-outbound-email-limits/4372797

[^14]: Microsoft Learn, *Outbound spam protection* and *Configure outbound spam policies*. Microsoft documents default alerts such as **Email sending limit exceeded**, **Suspicious email sending patterns detected**, and **User restricted from sending email**, showing that outbound abuse is already measured and surfaced at the sender-service boundary. https://learn.microsoft.com/en-us/defender-office-365/outbound-spam-protection-about and https://learn.microsoft.com/en-us/defender-office-365/outbound-spam-policies-configure

[^15]: RFC 8461, *SMTP MTA Strict Transport Security (MTA-STS)*. RFC 8461 explains that SMTP is vulnerable to downgrade and interception if an attacker strips STARTTLS or tampers with MX resolution, and provides a policy mechanism so recipient domains can declare when secure SMTP is expected. https://www.rfc-editor.org/rfc/rfc8461

[^16]: RFC 6797, *HTTP Strict Transport Security (HSTS)*. HSTS is the web precedent for the same architectural pattern: once a stronger transport policy is known, silent fallback should not be allowed. https://www.rfc-editor.org/rfc/rfc6797

[^17]: RFC 5598, *Internet Mail Architecture*. RFC 5598 states that because a mailing list can modify message content in any way, it is responsible for that content and is therefore an **Author**, not merely a transparent relay. https://www.rfc-editor.org/rfc/rfc5598

[^18]: Google Workspace Admin Help, *Email routing and delivery options for Google Workspace*. Google documents receiver-side topologies in which Gmail first processes inbound mail, filters spam and other problem messages, and then sends messages onward to an on-premise server; this is consistent with treating Gmail as part of the **receiver-edge**. https://support.google.com/a/answer/2685650

[^19]: Microsoft Support, *Sender Support in Outlook.com*. Microsoft explicitly forbids **namespace mining**, defines it as verifying email addresses without sending to them, says it is commonly used to generate lists of valid addresses for spam, phishing, or malware, and says Microsoft takes action on IPs that engage in it. https://support.microsoft.com/en-us/office/sender-support-in-outlook-com-05875e8d-1950-4d89-a5c3-adc355d0d652