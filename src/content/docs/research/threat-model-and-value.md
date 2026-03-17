---
title: Sender-Cost Enforcement, Downgrade Resistance, and Operator Value
description: A threat-model and deployment analysis for VAMP
---

## Executive summary

VAMP’s core security claim is not that it will “stop spam” in the abstract. The real claim is narrower and more defensible: it can make the most economically scalable forms of email abuse more expensive, more attributable, and harder to launder through compatibility paths. The evidence already in the market suggests that this is plausible. Today’s major providers already impose sender-side friction through daily send limits, non-relationship recipient caps, bulk-sender thresholds, complaint-rate thresholds, sender authentication mandates, reputation feedback loops, relay restrictions, and phased junk/reject enforcement. In other words, the industry has already accepted the principle that senders must bear some cost; what it has not done is integrate those controls into a clean identity-first transport model. [^1][^2][^3][^4][^5][^6]  ￼

The abuse model VAMP should target is not one thing but eight distinct classes: bulk spam, phishing, BEC setup messages, low-volume impersonation, directory harvesting, compromised but previously trusted senders, SMTP downgrade abuse, and relay/gateway laundering. Some of these are strongly volume-driven and therefore highly amenable to sender-side cost. Others—especially BEC from compromised accounts—are less sensitive to raw cost and require cryptographic identity, revocation, anomaly detection, and downgrade resistance in addition to sender friction. The right conclusion is not “cost solves everything.” The right conclusion is that cost is a strong control against scale, a weak control against trust abuse, and therefore must be combined with identity and policy. [^8][^9][^10][^11][^12][^13][^14][^15]  ￼

Downgrade resistance is not speculative. SMTP already needed a downgrade-resistant add-on because opportunistic STARTTLS is vulnerable to stripping and MX redirection; that is why MTA-STS exists. The web needed the same thing for HTTPS; that is why HSTS exists. Both are precedents for the same architectural pattern: a domain declares a stronger capability, clients cache that declaration, and fallback becomes policy-governed rather than silent. VAMP should inherit that lesson directly. If a domain advertises native VAMP capability, native delivery should be the expected path; SMTP from that domain should be explicitly downgraded and eventually penalized or rejected, or the protocol will be hollowed out by the cheapest available path. [^17][^18]  ￼

For operators, the value proposition is concrete. Google says Gmail blocks nearly 15 billion unwanted emails/day and stops more than 99.9% of spam, phishing, and malware. Microsoft says it screens 5 billion emails/day and processes 100 trillion security signals/day. Kaspersky says 44.99% of global email traffic in 2025 was spam. Microsoft’s current false-negative workflow for malicious mail is explicitly documented as a 5–10 minute admin process, and Microsoft says post-delivery remediation still removes an average of 70.8% of malicious mail that initially reached inboxes. In short: today’s ecosystem is already paying huge ongoing operational cost because the receiver is expected to sort good traffic from bad after the fact. [^1][^8][^21][^22][^23]  ￼

## Method and evidentiary standard

This analysis relies primarily on primary sources: Google Workspace and Gmail policy documents, Microsoft product and threat-intelligence documentation, IETF RFCs, FBI IC3 reporting, and Microsoft/Google postmaster material. Where a primary source does not exist for a specific abuse case, named vendor threat research is used and labeled accordingly. All cited sources were reopened and re-checked immediately before drafting. The standard here is not mathematical proof; it is evidence-based systems analysis grounded in currently deployed controls and current threat reporting. [^1][^2][^3][^4][^5][^6][^8][^17][^18][^21]  ￼

A second methodological point matters: the exact marginal-cost mechanism for VAMP is intentionally deferred. This document therefore evaluates control families, not one single implementation. In that sense, “sender cost” should be read as any marginal burden that is (a) attributable to a sender identity or domain, (b) cheap for the receiver to verify, (c) hard for an attacker to amortize across large campaigns, and (d) compatible with privileged, explicitly managed bulk-sender lanes. Those design properties are not hypothetical; they are already visible in both academic anti-spam proposals and modern provider policies. [^19][^20][^2][^3][^4][^6]  ￼

## 1. What exact abuse model are we trying to break?

### 1.1 Bulk spam

Bulk spam is the clearest case for sender-cost enforcement because its economics are linear in volume and its success rates are tiny. Gmail says it blocks nearly 15 billion unwanted emails/day, and Kaspersky says 44.99% of global email traffic in 2025 was spam. That only makes sense because the marginal cost of sending another unwanted message is effectively negligible. If a sender must pay any meaningful per-message or per-new-recipient cost, the economic advantage of bulk spam collapses far faster than legitimate human communication does. [^1][^21]  ￼

Current providers already act on this logic, even if they do it imperfectly. Gmail imposes special rules at roughly 5,000+ messages/day, makes bulk-sender status permanent once reached, and requires strong authentication, low complaint rates, and unsubscribe support. Outlook.com similarly introduced new requirements for domains sending over 5,000 emails/day, routing non-compliant traffic to Junk first and potentially rejecting it later. Those are already forms of sender-side cost: not monetary cost, but compliance, reputation, and deliverability cost. VAMP’s insight is to make those costs more explicit, more attributable, and native to the transport rather than layered on after SMTP. [^2][^3]  ￼

What cost changes here: a marginal cost applied to first-contact or high-volume delivery makes large spam blasts more expensive in direct proportion to their size, while a dedicated bulk-sender lane gives legitimate marketing/transactional infrastructure an explicit alternative path. This does not “solve” all spam, but it does target the part of the problem that depends on cheap scale. [^19][^20]  ￼

### 1.2 Phishing

Phishing spans a broad range, from large commodity credential theft campaigns to carefully staged attacks. At industrial scale, Microsoft says Tycoon 2FA was responsible for more than 30 million emails in a single month, and Kaspersky reports more than 144 million malicious or potentially unwanted email attachments blocked in 2025. These are precisely the kinds of campaigns that benefit from near-zero cost per message and from the ability to rotate identities, domains, and infrastructure quickly. [^11][^21]  ￼

Sender-cost enforcement is effective here in two ways. First, it raises the marginal cost of blasting first-touch messages to large numbers of recipients. Second, when combined with domain-authorized identity, it removes some of the ambiguity attackers exploit when they pretend to be something they are not. Cost alone is not enough—phishing also exploits trust, social engineering, and compromised accounts—but it is a strong control against the commodity and mid-scale phishing segment that currently depends on cheap iteration. [^11][^19][^20]  ￼

### 1.3 BEC setup messages

Business Email Compromise (BEC) is the clearest example of why “spam” is too fuzzy a word. Microsoft’s 2025 Digital Defense Report says BEC represented only 2% of total threats observed, yet 21% of attack outcomes—a disproportionate impact. Microsoft further says BEC is typically initiated through identity compromise, with attackers gaining initial access through phishing or password spraying and then pivoting to inbox-rule manipulation, unauthorized SharePoint access, internal phishing, email-thread hijacking, new MFA authentication method registration, or MFA tampering. The FBI’s IC3 recorded 21,442 BEC complaints in 2024. [^8][^21]  ￼

This matters because BEC setup messages are often low volume. A cost mechanism tied only to raw volume would not reliably stop them. However, sender-side cost still helps in two places: it makes the initial phishing or spraying phase more expensive when attackers are operating from new or weakly trusted identities, and it makes post-compromise fanout more expensive if attackers attempt broad internal or external messaging after account takeover. But the main control for BEC is not cost alone; it is identity assurance plus rapid revocation plus anomaly detection on previously trusted senders. VAMP should explicitly say this. [^8][^13][^14]  ￼

### 1.4 Low-volume impersonation

Low-volume impersonation includes executive impersonation, internal-looking spoofed messages, and carefully staged fraudulent correspondence that may never exceed a simple rate threshold. Microsoft documented that threat actors are exploiting complex routing scenarios and misconfigured spoof protections to send phishing messages that appear, superficially, to have been sent internally from an organization’s own domain. Kaspersky similarly reports that BEC actors in 2025 refined their tactics by inserting fake forwarded emails into correspondence to make fraud look more legitimate. [^12][^21]  ￼

This class of attack is a good example of where identity matters more than volume. Sender-side cost still has value if the attacker is using a new identity and trying first-touch impersonation against many targets, but the decisive control is that a recipient should be able to tell whether the sending identity is actually authorized by the claimed domain. VAMP’s domain-authorized identity model directly attacks this weakness. In other words: cost helps against scale; identity helps against impersonation; both are needed. [^12][^3][^2]  ￼

### 1.5 Directory harvesting

Directory harvesting is a foundational abuse primitive, not just a nuisance. Microsoft’s own sender-support guidance says senders must not use namespace mining techniques against Outlook.com inbound servers. It defines this as verifying email addresses without sending to them and states plainly that it is commonly used by malicious senders to generate lists of valid addresses for spam, phishing, or malware, and that Microsoft takes action on IPs that engage in it. [^5]  ￼

This is exactly the abuse VAMP should address at the discovery layer. If recipient capability and identity discovery are queryable, then discovery must itself be attributable, rate-limited, and cost-shaped. A small number of lookups for a real human sender can be effectively free. Large-scale, pattern-driven harvesting should trigger friction or denial. This is not speculative; it is directly aligned with how Microsoft already characterizes the abuse. [^5][^4]  ￼

### 1.6 Compromised but previously trusted senders

Some of the hardest abuse comes from previously trusted identities that have already been compromised. Microsoft’s incident playbooks say threat actors use compromised user accounts to read inboxes, create rules that forward mail externally, delete traces, and send phishing messages; malicious inbox rules are described as common during both phishing and BEC campaigns. Microsoft’s January 2026 research on a multi-stage AiTM phishing/BEC campaign abusing SharePoint says the campaign resulted in compromised user accounts and used inbox rule creation to maintain persistence and evade user awareness. [^13][^14]  ￼

This is the class where sender cost is least sufficient by itself. Once the attacker has a valid, established identity, the protocol cannot simply assume that “authenticated” means “safe.” The answer here is lifecycle control: device-bound keys, revocation, anomaly detection, trust reset, and stateful recipient policies. Sender-side cost still helps if the attacker suddenly fans out to many new recipients or starts hitting external domains at unusual rates, but VAMP should explicitly recognize that compromised trusted senders are primarily an identity-lifecycle problem, not just a pricing problem. [^13][^14]  ￼

### 1.7 SMTP downgrade abuse

SMTP already has a known downgrade problem. RFC 8461 states that opportunistic STARTTLS can be defeated by an attacker who deletes the “250 STARTTLS” response or redirects the SMTP session—potentially by overwriting the resolved MX record—thereby forcing plaintext or interception. MTA-STS exists precisely because an optional secure path is not enough when an attacker can force fallback. [^17]  ￼

The VAMP equivalent is straightforward: if a sender domain is VAMP-capable but can silently fall back to SMTP whenever sender-side cost or stronger identity checks would apply, then attackers will simply choose the cheap path. That is not a corner case; it is the obvious escape hatch. This is why downgrade resistance is mandatory, not ornamental. [^17][^18]  ￼

### 1.8 Relay/gateway laundering

Relay/gateway laundering is when attackers borrow someone else’s email infrastructure to make malicious traffic look more deliverable or more trusted. Proofpoint’s 2024 threat research provides a clean example: a spam actor abused a configuration that allowed outbound messages to be relayed from Microsoft 365 tenants through customer Proofpoint infrastructures without specifying which tenants were allowed. Proofpoint says any infrastructure offering that routing feature can be abused if it is not properly constrained, and in observed cases the transit through customer infrastructure even resulted in DKIM signing, making the spam more deliverable. [^15]  ￼

Google’s own Workspace guidance for SMTP relay spam similarly notes that open relays can cause high spam volume. These cases matter because they show that the path a message takes can be weaponized to borrow trust. VAMP should therefore treat relays and gateways as identity-preserving transport agents, not as entities permitted to replace or obscure the origin identity. If a relay can transform weak or unauthenticated traffic into apparently trusted traffic, it becomes an abuse amplifier. [^15][^16]  ￼

## 2. Why sender-cost enforcement is a credible control family

### 2.1 The concept is academically grounded

The idea of imposing a moderate but non-trivial cost on senders to deter junk mail is not new. Dwork and Naor proposed exactly this in 1992: require the sender to compute a “moderately hard” function to access a shared resource, with the stated goal of deterring junk mail without unduly burdening normal users. They also emphasized two design properties that remain highly relevant to VAMP: the cost function should be easy to verify, and it should be not amenable to amortization, so that an attacker cannot cheaply spread one computation across many messages. Importantly, they also proposed a shortcut mechanism allowing a trusted authority to bypass direct per-message cost for approved bulk mailings, and a frequent correspondent list that allows trusted senders to bypass the cost entirely. That is remarkably close to what VAMP needs conceptually: ordinary human messaging, managed bulk lanes, and differentiated trust. [^19]  ￼

Hashcash extended the same core idea for unmetered internet resources like email, making the cost token non-interactive, publicly auditable, and suitable for store-and-forward contexts where the receiver cannot issue a live challenge. Hashcash also discussed dynamic throttling and phased backward compatibility for interactive settings. The point here is not that VAMP must use proof-of-work. The point is that the design space of sender cost is mature, technically coherent, and explicitly built for asymmetric abuse problems. [^20]  ￼

### 2.2 The current email ecosystem already uses sender-side cost in practice

Modern providers already impose sender-side friction in several forms:
	1.	Rate and recipient limits. Outlook.com limits daily recipients, maximum recipients per message, and—critically—daily non-relationship recipients, and it says new accounts begin with low quotas that increase only after they “establish credibility.” That is a live example of relationship-aware sender cost. [^4]  ￼
	2.	Bulk-sender obligations. Gmail imposes stronger requirements at 5,000+ messages/day, including authentication and complaint-rate discipline, and makes bulk-sender classification permanent once that threshold is crossed. Outlook.com is now doing something similar for 5,000+ emails/day domains. [^2][^3]  ￼
	3.	Complaint-linked deliverability cost. Gmail tells bulk senders to keep user-reported spam rates below 0.1% and prevent them from reaching 0.3%, with graduated delivery impact and mitigation ineligibility beyond the threshold. Azure Communication Services likewise conditions high-volume quota growth on keeping email failure rates below 1%. Those are explicit signals that sender cost can be reputational and operational, not only computational or monetary. [^2][^7]  ￼
	4.	Certification and managed sender lanes. Outlook.com Postmaster explicitly offers or references sender-reputation and certification services, including JMRP/SNDS feedback loops and third-party certification. This is, functionally, a managed shortcut for trusted high-volume sending. [^6]  ￼

Taken together, these controls are already partial proofs that sender-side burden is operationally viable. VAMP’s novelty is not inventing sender cost from scratch; it is organizing it around native identity, discoverable capability, and downgrade-resistant transport semantics. [^2][^3][^4][^6][^7]  ￼

### 2.3 What kinds of marginal cost are plausible, even before choosing one

Because the exact mechanism is deferred, VAMP should define properties, not prematurely commit to one token scheme. The evidence supports at least five viable families:
	•	Quota/rate cost: limits on total messages, new recipients, or first-touch recipient domains. This is already deployed at Outlook.com and major providers. [^3][^4]  ￼
	•	Reputation cost: complaint thresholds, deliverability penalties, junking, and rejection. Gmail’s spam-rate thresholds and Outlook.com’s postmaster tooling already operate this way. [^2][^6]  ￼
	•	Relationship-weighted cost: lower friction for prior correspondents, higher friction for cold first contact. Dwork/Naor’s “frequent correspondent list” and Outlook.com’s “non-relationship recipient” concept both point in this direction. [^4][^19]  ￼
	•	Computational cost: proof-of-work or other verifiable work tokens. This is directly supported by Dwork/Naor and Hashcash. [^19][^20]  ￼
	•	Managed bulk shortcut: an explicitly approved bulk lane for transactional or marketing traffic, rather than pretending bulk and human mail are the same class. Dwork/Naor’s shortcut model and Azure’s high-volume service posture both support this structure. [^7][^19]  ￼

### 2.4 What sender cost can and cannot solve

Sender cost is strong against scale-dependent abuse: bulk spam, high-volume phishing, harvesting, and some relay abuse. It is weaker against attacks that weaponize existing trust, especially compromised mailboxes and low-volume BEC setup. Microsoft’s own threat reporting makes this limitation clear: BEC often starts with identity compromise and then pivots through inbox rules, SharePoint access, internal phishing, and thread hijacking. VAMP should therefore treat sender-side cost as a necessary but insufficient layer. It is the economic control, not the full trust model. [^8][^13][^14]  ￼

## 3. Downgrade resistance

### 3.1 Why downgrade resistance is mandatory

The lesson from SMTP and HTTPS is the same: optional security loses to active attackers. RFC 8461 says that an attacker who can strip STARTTLS or rewrite MX resolution can perform downgrade or interception attacks. That is why MTA-STS lets recipient domains publish a policy saying whether authenticated TLS is expected and what the sender should do if TLS cannot be negotiated. RFC 6797 does the same in web terms: an HSTS host declares a policy and user agents MUST enforce it. [^17][^18]  ￼

VAMP faces the same architectural hazard. If native VAMP delivery imposes stronger identity checks, stricter capability discovery, or sender-side cost, but a sender can simply fall back to SMTP when that becomes inconvenient, then the expensive path becomes optional and attackers will choose the cheap one. The protocol would not be merely weak; it would be self-defeating. This is why VAMP needs a rule analogous to HSTS/MTA-STS: if a domain advertises VAMP capability, native delivery becomes the expected path. [^17][^18]  ￼

### 3.2 Why strict capability enforcement is plausible operationally

This is not new internet behavior. Gmail and Outlook are already moving in that direction for sender authentication. Gmail’s FAQ says that starting in November 2025, non-compliant bulk-sender traffic would experience temporary and permanent rejections. Outlook’s 2025 high-volume-sender policy says non-compliant traffic from 5,000+/day domains will first be routed to Junk and may eventually be rejected. The pattern is the same one VAMP needs: publish requirements, expose sender tooling, phase in enforcement, then harden over time. [^2][^3]  ￼

RFC 8461 also explicitly includes a testing-only mode, allowing soft deployment and failure discovery before hard enforcement. That is a useful direct precedent for VAMP migration. In other words, strict capability enforcement is not only technically sound; it already has both standards and provider-deployment precedent. [^17]  ￼

### 3.3 Practical VAMP rule set

A defensible VAMP downgrade policy would be:
	1.	If the recipient domain is not VAMP-capable, SMTP compatibility remains available.
	2.	If the recipient domain is VAMP-capable, the client should attempt VAMP first.
	3.	If the sender domain is VAMP-capable but sends via SMTP anyway, that traffic should be treated as explicitly downgraded.
	4.	Downgraded traffic should not inherit native trust, and repeated downgrade behavior should accumulate penalties: junking, throttling, rejection, or reputation damage.
	5.	Testing/soft mode should exist during rollout, but must end. A permanent “compatibility forever” stance would just recreate SMTP’s weakest incentives. [^2][^3][^17][^18]  ￼

This is a design conclusion rather than a quoted provider rule, but it follows directly from the same logic already embedded in HSTS, MTA-STS, Gmail’s sender enforcement, and Outlook’s high-volume-sender policy.

### 3.4 Why gateways cannot be trust-equal to native delivery

Relay/gateway laundering provides the empirical reason. Proofpoint showed that if a gateway is allowed to relay mail for an insufficiently constrained sender population, attackers can borrow that infrastructure’s trust and even obtain downstream DKIM signing. Microsoft’s January 2026 spoofing write-up shows that complex routing and weak spoof protections can create internal-looking spoofed mail. These are not abstract possibilities; they happened. [^12][^15]  ￼

Therefore a VAMP gateway must be treated as a downgrade boundary, not a neutral translation layer. Native-to-legacy delivery is sometimes necessary for migration. But it should never be indistinguishable from native delivery, and it should never allow a VAMP-capable sender to avoid native accountability. [^15][^17]  ￼

## 4. Operator value

### 4.1 What operators pay for today

The current system imposes cost in at least four measurable ways.

First, there is screening at industrial scale. Gmail blocks nearly 15 billion unwanted emails/day and says it stops more than 99.9% of spam, phishing, and malware. Microsoft screens 5 billion emails/day and processes 100 trillion security signals/day. Kaspersky says 44.99% of all email traffic in 2025 was spam. That is the current baseline load any operator or platform must absorb. [^1][^8][^21]  ￼

Second, there is deliverability and reputation management. Outlook.com Postmaster says email abuse continues to burden the ecosystem and offers JMRP, SNDS, and reputation-management services so senders and ISPs can improve deliverability and reduce complaints. Google’s sender FAQ exposes bulk-sender status, complaint-rate thresholds, and a compliance dashboard. This is operational work created by weak sender trust and cheap abuse. [^2][^6]  ￼

Third, there is human remediation cost. Microsoft explicitly documents malicious-email false-negative handling as a 5–10 minute admin task, and its March 2026 benchmark says post-delivery remediation still removed 70.8% of malicious mail that reached inboxes. That means even a strong filter stack still leaves operators paying for user reports, triage, submission, block entries, quarantine review, and follow-up investigation. [^22][^23]  ￼

Fourth, there is residual business loss. The FBI’s 2024 IC3 report recorded 193,407 phishing/spoofing complaints, 21,442 BEC complaints, and $16.6 billion in total reported losses. BEC alone remained highly consequential. Those are not purely operator-side costs, but they are the end-state evidence that today’s model still leaks expensive fraud through the stack. [^21]  ￼

### 4.2 Where VAMP should create value

The operator value proposition is strongest if VAMP-native traffic allows operators to do less heuristic work and more deterministic policy enforcement.
	•	Less screening volume for first-contact abuse. If sending to unknown recipients carries cost and strong identity, commodity spam and some bulk phishing should become less economical before the receiver has to classify content. That is the same economic logic already motivating Gmail’s and Outlook’s bulk-sender controls. [^2][^3]  ￼
	•	Less remediation churn. If more traffic arrives in a native lane with verified sender identity and explicit recipient capability, operators should see fewer false-negative cleanups and less post-delivery removal. This is an inference from Microsoft’s current 70.8% post-delivery catch burden, not a measured VAMP result yet. [^22][^23]  ￼
	•	Lower dependence on overlapping tools for marginal gains. Microsoft’s March 2026 benchmark says layering ICES on top of Defender improved marketing and bulk email filtering by 13.7%, but only 0.29% for spam and 0.24% for malicious messages in the latest quarter. That suggests operators are already paying real money to squeeze out incremental gains after the baseline filter stack. VAMP’s promise is to move more of that burden upstream by making suspicious volume and weak identity more expensive before the content reaches those tools. [^23]  ￼
	•	Clearer sender classes. Today’s ecosystem often forces human mailboxes, transactional senders, and marketing platforms into overlapping semantics. VAMP can separate human identities, trusted bulk lanes, and legacy-compatible gateways as first-class classes. The Azure Communication Services model—low initial quota, monitored ramp-up, <1% failure rate for high quota, explicit high-volume approval—is a concrete example of how operationally useful that separation can be. [^7]  ￼

### 4.3 Operator KPIs a VAMP pilot should measure

A serious pilot should measure at least:
	1.	Reduction in first-contact unwanted mail volume per mailbox/domain.
	2.	Reduction in post-delivery malicious removals and quarantine churn.
	3.	Reduction in false-negative investigation count and time spent per incident.
	4.	Complaint-rate changes for human and bulk lanes separately.
	5.	Rate of downgraded VAMP-capable SMTP traffic and resulting penalties.
	6.	Relay/gateway abuse attempts blocked before delivery.

These KPIs are grounded in current operator pain: complaint thresholds, false-negative workflows, post-delivery catch, and sender reputation tooling all already exist because operators need them. [^2][^6][^22][^23]  ￼

## 5. Migration state model

VAMP needs an explicit state machine, not hand-wavy interoperability.

State	What it means	Recommended policy posture
Legacy → Legacy	Neither side supports VAMP.	Continue SMTP as-is. This is the baseline the world already runs on.
Legacy → VAMP	Recipient supports VAMP; sender does not.	Accept only through a compatibility boundary. Treat as lower-trust, non-native traffic. Do not let SMTP traffic claim native guarantees.
VAMP → Legacy	Sender supports VAMP; recipient does not.	Allow explicit downgrade if sender policy permits, but mark it as downgraded and do not claim native confidentiality/integrity guarantees.
VAMP → VAMP	Both sides support VAMP.	Use native delivery, native identity, native policy, and native sender-cost controls.
VAMP-capable sender using SMTP anyway	Sender had a native path available and chose the legacy path.	Treat as downgraded or policy-violating traffic; throttle, junk, or reject after rollout, analogous to current Gmail/Outlook bulk-sender enforcement.
Gateway/relay path with identity ambiguity	A third party is translating or relaying traffic in a way that weakens origin identity.	Reject or quarantine unless the relay preserves bound sender identity and is explicitly authorized. Proofpoint’s 2024 relay abuse shows why this matters.
Compromised trusted sender	Mail is native-capable but the identity itself is suspect.	Sender cost alone is not enough; revoke keys/devices, apply anomaly detection, and temporarily reclassify traffic until trust is re-established.

The plausibility of this phased state model is supported by two existing patterns. First, MTA-STS testing-only mode proves that soft rollout with policy observation is operationally viable. Second, Gmail and Outlook’s phased enforcement for high-volume senders—first visibility, then junking, then rejection—shows that gradual tightening is how the internet adopts stronger mail policy in practice. [^2][^3][^17]  ￼

## 6. Conclusion

The threat model VAMP needs to break is specific and technically coherent. It is the combination of cheap first contact, weakly bound sender identity, free address discovery, silent downgrade, and trust laundering through relays/gateways. Those properties enable different abuse classes in different ways: bulk spam and industrial phishing depend on cheap scale; BEC and low-volume impersonation depend on trust abuse; relay laundering and SMTP downgrade depend on path ambiguity. A successful successor model must therefore address economics, identity, and transport semantics together, not one at a time. [^8][^12][^15][^17]  ￼

The evidence supports the central VAMP thesis: sender-side marginal cost is a viable control family, and the internet has already deployed partial versions of it. Outlook.com uses credibility-based limits and non-relationship recipient caps; Gmail and Outlook impose high-volume sender rules; Azure conditions quota growth on sender quality; postmaster systems expose complaints and reputation; MTA-STS and HSTS show how strict capability policies defeat silent fallback. What VAMP proposes is not a leap into fantasy. It is a recomposition of proven control patterns into a cleaner, identity-first messaging model. [^2][^3][^4][^6][^7][^17][^18][^19][^20]  ￼

The key limitation should be stated plainly: sender cost alone will not stop compromised trusted identities or surgical BEC. For those, VAMP must rely on revocation, device-bound identity, anomaly detection, and explicit downgrade-resistant policy. But that limitation is not a weakness of the argument; it is what makes the argument rigorous. The correct claim is not “cost solves email.” The correct claim is that cost solves scale, identity solves impersonation, and downgrade resistance prevents the old protocol from becoming the cheap bypass around the new one. [^8][^13][^14][^17]  ￼

## 7. Footnotes

[^1]: Google, “New Gmail protections for a safer, less spammy inbox,” October 3, 2023.
[^2]: Google Workspace Admin Help, “Email sender guidelines FAQ,” current as accessed March 2026.
[^3]: Microsoft Tech Community, “Strengthening Email Ecosystem: Outlook’s New Requirements for High-Volume Senders,” April 2, 2025.
[^4]: Microsoft Support, “Sending limits in Outlook.com,” current as accessed March 2026.
[^5]: Microsoft Support, “Sender Support in Outlook.com,” current as accessed March 2026.
[^6]: Outlook.com Postmaster, “Services for Senders and ISPs,” updated March 3, 2026.
[^7]: Microsoft Learn, “Service limits for Azure Communication Services,” and Microsoft Learn, “Manage high volume emails for Microsoft 365 Public preview,” current as accessed March 2026.
[^8]: Microsoft, Microsoft Digital Defense Report 2025: Safeguarding Trust in the AI Era, especially sections on identity attacks and BEC.
[^9]: Microsoft Security Blog, “Investigating targeted payroll pirate attacks affecting US universities,” October 9, 2025.
[^10]: Microsoft on the Issues, “Microsoft seizes 338 websites to disrupt rapidly growing RaccoonO365 phishing service,” September 16, 2025.
[^11]: Microsoft on the Issues, “How a global coalition disrupted Tycoon,” March 4, 2026.
[^12]: Microsoft Security Blog, “Phishing actors exploit complex routing and misconfigurations to spoof domains,” January 6, 2026.
[^13]: Microsoft Security Blog, “Resurgence of a multi-stage AiTM phishing and BEC campaign abusing SharePoint,” January 21, 2026.
[^14]: Microsoft Learn, “Alert classification for suspicious inbox manipulation rules,” current as accessed March 2026.
[^15]: Proofpoint Threat Research, “Scammer Abuses Microsoft 365 Tenants, Relaying Through Proofpoint Servers to Deliver Spam Campaigns,” July 29, 2024.
[^16]: Google Workspace Admin Help, “SMTP relay spam policy in Gmail,” current as accessed March 2026.
[^17]: IETF RFC 8461, “SMTP MTA Strict Transport Security (MTA-STS),” September 2018.
[^18]: IETF RFC 6797, “HTTP Strict Transport Security (HSTS),” November 2012.
[^19]: Cynthia Dwork and Moni Naor, “Pricing via Processing or Combatting Junk Mail,” CRYPTO 1992 / Springer LNCS 740.
[^20]: Adam Back, “Hashcash – A Denial of Service Counter-Measure,” August 2002.
[^21]: FBI Internet Crime Complaint Center, 2024 IC3 Annual Report, released 2025.
[^22]: Microsoft Learn, “How to handle malicious emails that are delivered to recipients (false negatives) using Microsoft Defender for Office 365,” current as accessed March 2026.
[^23]: Microsoft Security Blog, “From transparency to action: What the latest Microsoft email security benchmark reveals,” March 12, 2026.
[^24]: Microsoft Learn, “Bulk complaint level values – Microsoft Defender for Office 365,” current as accessed March 2026.