---
title: MTA-scoped, non-monetary sender-cost mechanics for VAMP
---

A focused analysis of what must be true in the real world for VAMP to materially reduce email abuse

## Constraints assumed in this analysis

	1.	Any sender-side “work” is performed by the sending MTA / outbound relay / sender service edge, not by end-user clients.
	2.	Budgets and penalties attach first to the domain / tenant / outbound service, with optional per-identity accounting underneath.
	3.	No monetary settlement, cryptocurrency, token staking, or per-message payment rail is part of the protocol.
	4.	Human mail and bulk mail are separate operational classes and must be treated separately.
	5.	Native capability must be downgrade-resistant. If a domain advertises VAMP capability, it must not be able to escape native accountability by silently falling back to SMTP.
	6.	Gateways and relays must preserve origin identity rather than laundering it.

These constraints are not cosmetic. They determine which threat models VAMP can realistically address and what operational mechanics are required to make the system work.

## Threat-model boundary

Under the constraints above, VAMP is best understood as a system for breaking scale-dependent, infrastructure-dependent, and compatibility-laundered abuse. It is strongly aimed at:
	•	Bulk spam
	•	High-volume phishing and phishing-as-a-service campaigns
	•	Directory harvesting / namespace mining
	•	SMTP downgrade abuse
	•	Relay / gateway laundering
	•	Broad post-compromise fan-out from an already compromised sender

It is only partially aimed at:
	•	BEC setup messages
	•	Low-volume impersonation
	•	Compromised but previously trusted senders

That distinction is critical. Microsoft’s 2025 Digital Defense Report says BEC represented only 2% of total threats observed, but 21% of attack outcomes, and that BEC typically begins with identity compromise and then pivots to inbox-rule manipulation, thread hijacking, internal phishing, MFA tampering, and related trust abuse.[^1] Likewise, Microsoft’s 2026 research on complex routing and spoof-protection failures shows that attackers can deliver internal-looking spoofed phishing without needing the kind of volume that a pure sender-cost mechanism is designed to punish.[^2] So VAMP should make a narrower, more rigorous claim: it can change the economics of scalable abuse, but it must be combined with identity lifecycle, revocation, and anomaly detection to address trust-abuse attacks.

The real-world precedent: sender-side burden already works when operators enforce it

The strongest evidence that VAMP’s direction is viable is that large operators already deploy partial versions of the same idea.

Google’s 2023 Gmail security announcement said Gmail already blocks nearly 15 billion unwanted emails every day and that after requiring some form of authentication on mail sent to Gmail, the number of unauthenticated messages Gmail users received fell by 75%.[^3] Google then formalized bulk-sender requirements for senders at roughly 5,000+ messages/day, aggregated at the primary domain, and by November 2025 began ramping enforcement to include temporary and permanent rejections for non-compliant traffic.[^4] Outlook.com followed the same pattern in 2025: for domains sending over 5,000 emails/day, Microsoft announced stricter SPF, DKIM, and DMARC requirements and explicitly tied non-compliance to junking and then rejection.[^5]

This matters because it shows two things. First, changing sender obligations changes sender behavior. Second, large mail operators already accept the principle that the sender should bear some burden when traffic becomes high-risk or high-volume. VAMP is not inventing that principle from nothing; it is making it a first-class design property.

## What mechanics VAMP actually needs

### 1. The outbound MTA / relay must be the accounting boundary
If sender-side work lives on clients, scale hides in the endpoint fleet. If it lives on the sender’s outbound MTA / relay / tenant boundary, the sender domain becomes the scarce resource and the accountable unit.

This is already how major services behave. Exchange Online now imposes a tenant-level outbound external recipient rate limit (TERRL), calculated from the number of email licenses in the tenant, and explicitly reserves the right to apply additional restrictions for suspicious behavior, spam, fraud, or payment issues.[^6] Google’s SMTP relay service is also centrally monitored: Google says it watches relay traffic for large amounts of spam, emails administrators when abuse is detected, and suspends accounts that continue to send spam after warning.[^7] Microsoft’s outbound spam protection docs say the service blocks accounts that exceed internal spam thresholds and sends administrator alerts when users exceed sending limits or suspicious patterns are detected.[^8]

This is the single most important operational mechanic for VAMP. It directly supports the threat models that depend on scale:
	•	Bulk spam becomes a domain-scoped resource-consumption problem.
	•	Phishing-as-a-service becomes harder to industrialize through one domain’s outbound edge.
	•	Directory harvesting becomes attributable to a sender service rather than smeared across clients.
	•	Broad post-compromise fan-out becomes visible at the same layer where administrators already receive alerts.

This does not eliminate the possibility of parallel hardware or a distributed attacker. Hashcash’s own design discussion makes clear that proof-of-work does not abolish hardware asymmetry or distributed abuse; it only makes abuse more expensive when the system binds cost to a constrained policy surface.[^9] The key VAMP insight is therefore not “proof-of-work beats GPUs.” It is: MTA-scoped enforcement gives the operator a finite, visible, governable resource boundary.

### 2. VAMP needs domain-scoped budgets with per-identity subaccounting
The right control surface is not a flat per-user cap and not a flat per-domain cap alone. It is a domain-scoped budget subdivided by identity and sender history.

Google already counts bulk-sender status at the same primary domain, not merely at the user level.[^4] Outlook.com uses daily non-relationship recipient limits and upgrades new accounts only after they “establish credibility in the system,” which is a form of reputation-weighted budget allocation.[^10] This is a valuable precedent for VAMP: a domain can have a shared budget, while individual identities inside that domain can be given different allowances based on role, history, and trust.

That structure matters operationally for the threat models in scope. It means:
	•	a single compromised mailbox cannot spend an unlimited fraction of the domain’s outbound trust;
	•	an operator can quarantine a noisy application, mailbox, or business unit without globally disabling the domain; and
	•	broad spam/phishing abuse becomes visible as budget burn at a layer admins already know how to monitor.

Without this mechanic, “MTA-side work” collapses into either crude domain-wide throttling or meaningless per-client fragmentation.

### 3. Relationship-aware first-contact controls are mandatory
Raw message count is too blunt. Email abuse often reveals itself not just in volume, but in who is being contacted for the first time.

Microsoft’s own consumer limits distinguish daily non-relationship recipients—people you have never emailed before—from ordinary recipients, and Microsoft explicitly says new accounts receive lower quotas until they establish credibility.[^10] That is an important real-world signal: major providers already recognize that cold first contact is a different risk class from correspondence within an existing relationship.

This mechanic maps cleanly to VAMP. For the threat models VAMP is most qualified to address, cost should rise fastest when a sender is attempting:
	•	large numbers of new unique external recipients,
	•	many first-touch recipients in the same external domain, or
	•	repeated unsolicited discovery + first contact patterns.

There is also strong academic precedent for this structure. Dwork and Naor’s 1992 anti-junk-mail paper explicitly proposed that recipients could maintain a frequent correspondent list whose members bypass verification, and that legitimate bulk mail could be handled through a managed shortcut rather than by forcing every ordinary correspondence path to pay the same price.[^11] VAMP should adopt the spirit of that design: cold senders pay friction; established relationships get a lighter path; legitimate bulk is separated rather than smuggled through human semantics.

This mechanic strongly addresses bulk spam, high-volume phishing, and harvesting-to-send pipelines. It only weakly addresses single-recipient spear-phishing or BEC setup, which is why VAMP should never pretend this control is sufficient by itself.

### 4. VAMP needs a dedicated bulk-sender lane, not exceptions hidden in the human lane
The public email ecosystem already treats bulk mail as a separate regime, and VAMP should do the same from day one.

Google’s sender rules define bulk senders as those sending close to 5,000 messages or more to personal Gmail accounts in a 24-hour period, require authentication, enforce spam-rate thresholds, and make one-click unsubscribe mandatory for promotional traffic.[^4] Outlook.com applies similar high-volume requirements to domains sending over 5,000 emails/day.[^5] Microsoft’s own service descriptions say customers who need to send legitimate bulk commercial email should use a third-party ESP or on-premises infrastructure rather than treating ordinary cloud mailbox protections as bulk-delivery infrastructure.[^12][^13] Azure Communication Services likewise uses initial rate limits, requires senders to warm up gradually, and can scale to 1–2 million messages/hour only when business need, failure-rate control, and reputation support it.[^14]

This is strong evidence for a VAMP design rule: bulk-sender legitimacy must be explicit, managed, and separate. If VAMP makes the human lane porous enough to accommodate large newsletters, receipts, and marketing campaigns without a separate class, then bulk abuse will exploit that same lane. Conversely, if VAMP tries to cram all legitimate bulk traffic through ordinary human semantics plus sender-cost friction, operators will reject it because it will break real business workflows.

The right interpretation of sender cost here is not “make all bulk mail expensive.” It is: make untrusted bulk mail expensive unless it enters a managed lane with stricter identity, complaint, and failure-rate controls.

### 5. Complaint and reputation feedback must be part of the protocol’s operating model
A sender-cost system without feedback is blind. Real-world mail systems already use complaint and reputation data as core enforcement signals.

Google says bulk senders should keep user-reported spam rates below 0.1% and avoid reaching 0.3% or higher; rates above 0.3% have a stronger negative effect on delivery and can make the sender ineligible for mitigation.[^15] Outlook.com’s SNDS says deliverability is based on reputation, gives senders IP-level data plus JMRP complaint reports, and explicitly says that maintaining a good reputation is “a lot of work” and that reputation is always the responsibility of the sender.[^16] Microsoft’s sender-support guidance also says junk complaint rate is one of the principal factors driving down sender reputation and deliverability.[^17]

For VAMP, this means sender-side burden cannot be only pre-send work. It also needs a post-send feedback loop that lets operators accumulate or lose trust based on recipient complaints, delivery failures, blocklist events, and similar signals. That feedback loop is essential for:
	•	distinguishing human senders from abusive bulk senders over time,
	•	detecting when a previously trusted sender has begun to behave abnormally,
	•	allowing a managed bulk lane to remain viable for legitimate enterprise use, and
	•	making domain-wide abuse visible to administrators early enough to intervene.

This is also the mechanism that keeps VAMP from degenerating into a purely static quota system that attackers can game once they learn the thresholds.

### 6. Admin-visible alerts and kill switches are not optional
Under an MTA-scoped model, the sender domain becomes the accountable resource boundary. That only works if legitimate operators can actually see and stop abuse.

Google’s SMTP relay docs say admins receive email alerts when significant relay spam is detected, and accounts can be suspended if they continue to send spam after warning.[^7] Microsoft’s outbound spam protection documentation says default alert policies notify admins when a user is restricted from sending, when sending limits are exceeded, or when suspicious sending patterns are detected.[^8] Exchange Online’s new tenant-level outbound limits are also visible in reporting, and Microsoft planned admin notification when outbound volume crosses 80% of quota.[^6]

This is exactly the kind of operational behavior VAMP needs. It turns sender-side cost from an invisible tax into an operator-visible control plane. The anti-spam benefit is obvious for bulk spam, phishing fan-out, and post-compromise abuse, but there is also a strategic benefit: administrators are much more likely to notice and correct abuse when the pain is centralized and visible.

Without this mechanic, MTA-side work simply becomes a hidden performance penalty. With it, it becomes a governance tool.

### 7. Discovery must be attributed, rate-limited, and cost-shaped
VAMP’s pre-send model implies some sort of identity or capability lookup. That creates a new attack surface unless discovery itself is governed.

Microsoft’s sender-support documentation explicitly forbids namespace mining against Outlook.com inbound servers, defines it as verifying email addresses without sending to them, says it is commonly used to generate lists of valid addresses for spam, phishing, or malware, and notes that Microsoft takes action on IPs that engage in it.[^18] That is a direct real-world warning that any identity-first mail system must internalize.

So for VAMP, lookup is not a free oracle. The mechanics have to include:
	•	attributable sender identity for lookups,
	•	per-domain and per-identity lookup budgets,
	•	higher friction for bulk or patterned enumeration,
	•	policy differentiation between “can I reach this recipient?” and “reveal full identity metadata,” and
	•	feedback/penalty when lookup behavior resembles harvesting.

This mechanic is not ancillary. It is the only way to make directory harvesting materially more expensive than it is today.

### 8. Relays and gateways must preserve origin identity and be tightly governed
A sender-cost system can be neutralized if untrusted senders can borrow someone else’s reputable infrastructure.

Proofpoint’s 2024 disclosure is the cleanest public example: a spam actor abused a modifiable routing configuration so that spam from Microsoft 365 tenants was relayed through some Proofpoint customers’ infrastructure, and Proofpoint noted that any infrastructure with that feature could be abused if not properly constrained.[^19] Microsoft’s 2026 research on routing misconfigurations and spoof protection failures showed another version of the same theme: attackers can exploit complex routing scenarios to produce phishing emails that appear to have been sent internally.[^2] Outlook.com’s postmaster policies are also explicit that messages must not be transmitted through insecure email relay or proxy servers.[^20] Google’s SMTP relay documentation warns that Gmail-originated mail routed out to a third-party gateway and then back into Google is “best effort” only because it can create loops, quota problems, and increased security risk.[^21]

The VAMP implication is straightforward:
	•	gateways may exist for migration,
	•	but they must not be allowed to replace, launder, or upgrade origin identity,
	•	and they must have narrowly authorized sender populations rather than broad open relay semantics.

The origin identity should remain cryptographically bound to the sender domain or tenant, and any sender-cost token or sender budget consumption should be bound there as well. Otherwise relay/gateway laundering becomes the path of least resistance for abuse.

### 9. Downgrade resistance must be built into rollout, not bolted on later
SMTP has already taught this lesson. RFC 8461 exists because opportunistic STARTTLS can be downgraded: an attacker can strip the STARTTLS advertisement or tamper with MX resolution, and the sender will silently fall back unless policy says otherwise.[^22] MTA-STS therefore gives recipient domains a way to publish a policy, including an optional testing mode and a stricter enforce mode.[^22] The web learned the same lesson earlier with HSTS: once a site declares strict transport, the client keeps treating it that way rather than allowing silent fallback.[^23]

VAMP needs the same architectural pattern. If a domain advertises native VAMP capability, native delivery must become the expected path. SMTP from that sender should be marked as downgraded, and persistent downgrade behavior must eventually become throttleable, junkable, or rejectable. Gmail and Outlook’s phased bulk-sender enforcement is the relevant operational precedent: they publish requirements, expose tooling, give a runway, and then move to harder enforcement.[^4][^5]

Without this, VAMP would recreate the oldest problem in secure transport: the attacker always picks the cheaper fallback path.

### 10. Compromised trusted senders require extra controls beyond sender cost
This is the threat-model caveat VAMP has to state openly if it wants to remain credible.

Microsoft’s 2026 playbooks say attackers use compromised mailboxes to create inbox rules, forward mail externally, hide alerts, and send phishing mail; malicious inbox rules are described as common in both BEC and phishing campaigns.[^24] Microsoft’s January 2026 SharePoint-based AiTM/BEC write-up describes exactly this kind of progression: compromise a trusted account, manipulate inbox rules and authentication state, and use the compromised identity to expand the operation.[^25] The MDDR makes the same point more broadly: BEC is a high-impact threat driven by identity compromise.[^1]

This means sender cost is not enough by itself for:
	•	BEC setup messages
	•	low-volume impersonation from a compromised real identity
	•	single-message thread hijacks
	•	surgical fraud from established correspondents

For those cases, VAMP needs companion mechanics:
	•	device-bound keys,
	•	rapid revocation,
	•	anomaly detection against the sender’s historical pattern,
	•	trust resets when an identity behaves abnormally,
	•	and stronger treatment of new external fan-out from previously quiet senders.

This is not a weakness in the model. It is the boundary condition that makes the model honest.

## Operator value: why these mechanics are worth deploying

The operator value proposition is not mystical. It is practical.

Today, Gmail blocks nearly 15 billion unwanted emails/day and Microsoft screens 5 billion emails/day; those numbers are evidence of a receiver-heavy filtering regime that has to classify huge volumes of abuse after the fact.[^3][^26] Microsoft’s false-negative handling guidance says that investigating malicious mail that was delivered takes 5–10 minutes of admin time even before the downstream incident cost is counted.[^27] The operational benefit of VAMP is not that content filtering disappears; it is that more of the obviously scalable abuse becomes expensive or non-viable before it consumes those downstream resources.

If the mechanics above are present, operators gain:
	•	better attribution, because abuse burns a sender domain’s own budget and reputation;
	•	faster containment, because alerts and quotas live at the sender edge;
	•	cleaner separation between human and bulk sending, reducing ambiguity;
	•	less value in laundering through shared infrastructure, because relays cannot donate trust;
	•	and a migration path that does not depend on silently trusting SMTP forever.

That is the part of the story operators will actually care about.

## Conclusion

Under the constraints assumed here, VAMP can be successful against the threat models that depend on cheap scale, weak sender accountability, free discovery, or compatibility laundering. In practical terms, that means VAMP is well positioned to reduce:
	•	bulk spam
	•	high-volume phishing and phishing-as-a-service
	•	directory harvesting
	•	SMTP downgrade abuse
	•	relay / gateway laundering
	•	broad post-compromise message fan-out

It is only partially positioned to reduce:
	•	BEC setup
	•	low-volume impersonation
	•	compromised trusted senders

To make the system work in the real world, VAMP needs more than a generic notion of “proof of work.” It needs a bundle of mechanics:
	1.	outbound-edge enforcement,
	2.	domain-scoped budgets with per-identity subaccounting,
	3.	relationship-aware first-contact controls,
	4.	a dedicated bulk-sender lane,
	5.	complaint and reputation feedback loops,
	6.	operator alerts and kill switches,
	7.	attributed/rate-limited discovery,
	8.	identity-preserving relay governance, and
	9.	explicit anti-downgrade policy.

That bundle is what turns sender-side burden from a slogan into an operational anti-abuse system. The evidence from Google, Microsoft, Outlook.com postmaster tooling, classic anti-spam research, and modern incident cases suggests that these mechanics are not only plausible — they are already partially deployed across the existing ecosystem. VAMP’s opportunity is to recombine them into a cleaner, identity-first architecture instead of leaving them as scattered compensating controls.

## Footnotes

[^1]: Microsoft, Microsoft Digital Defense Report 2025, sections on identity attacks and BEC. It states that identity-based attacks rose 32% in the first half of 2025 and that BEC represented 2% of total threats observed but 21% of attack outcomes; it also describes BEC as typically initiated through identity compromise and then expanded through inbox rules, thread hijacking, SharePoint abuse, and MFA tampering.  ￼

[^2]: Microsoft Security Blog, Phishing actors exploit complex routing and misconfigurations to spoof domains (January 6, 2026). Microsoft reports that threat actors are exploiting complex routing scenarios and weak spoof protections to send phishing mail that appears to have been sent internally.  ￼

[^3]: Google, New Gmail protections for a safer, less spammy inbox (October 3, 2023). Google says Gmail blocks nearly 15 billion unwanted emails every day, stops more than 99.9% of spam, phishing, and malware, and that the number of unauthenticated messages Gmail users receive fell by 75% after Gmail began requiring some form of authentication.  ￼

[^4]: Google Workspace Admin Help, Email sender guidelines FAQ. Google defines a bulk sender as any sender sending close to 5,000 messages or more to personal Gmail accounts in 24 hours, counts messages sent from the same primary domain toward that threshold, and says that beginning November 2025 non-compliant traffic will see disruptions including temporary and permanent rejections. Google also documents daily spam-rate calculation, a <0.1% target, and stronger consequences at 0.3% or higher.  ￼

[^5]: Microsoft Tech Community, Strengthening Email Ecosystem: Outlook’s New Requirements for High-Volume Senders (April 2, 2025; updated April 30, 2025). Microsoft applies the policy to domains sending over 5,000 emails/day, ties it to SPF/DKIM/DMARC compliance, and says non-compliant traffic will be filtered, blocked, or rejected, with the updated post stating rejection from May 5, 2025 for failed authentication.  ￼

[^6]: Microsoft Exchange Team Blog, Introducing Exchange Online Tenant Outbound Email Limits (2025). Microsoft introduced tenant-level outbound external recipient limits (TERRL), calculated from the number of licensed mail users, and explicitly says additional restrictions can be applied for suspicious behavior, spam, fraud, or payment issues. It also notes planned admin alerts when usage exceeds 80% of quota.  ￼

[^7]: Google Workspace Admin Help, SMTP relay spam policy in Gmail. Google states that it monitors outgoing relay messages, sends email alerts when large amounts of spam are detected, suspends Gmail accounts that keep sending spam after warning, and notes that open relays or malware-infected devices can cause high spam volume and damage domain reputation.  ￼

[^8]: Microsoft Learn, Outbound spam protection – Microsoft Defender for Office 365. Microsoft describes admin alerts for users restricted from sending, alerts for suspicious sending patterns, a secondary “high-risk delivery pool” for outbound spam, source IP reputation monitoring, account blocking when spam thresholds are exceeded, and speed-based blocking because compromised accounts can send zero-day spam missed by filters.  ￼

[^9]: Adam Back, Hashcash – A Denial of Service Counter-Measure (2002). Back describes hashcash as a countermeasure against email spam and systematic abuse of unmetered resources, emphasizing non-interactive cost functions for store-and-forward systems like email. The paper also shows why proof-of-work must be bound to a meaningful policy surface; it does not erase all distributed-compute advantage by itself.  ￼

[^10]: Microsoft Support, Sending limits in Outlook.com. Microsoft limits daily recipients, per-message recipients, and daily non-relationship recipients, and says newly created accounts start with lower quotas until they establish credibility.  ￼

[^11]: Cynthia Dwork and Moni Naor, Pricing via Processing or Combatting Junk Mail (CRYPTO ’92). The paper proposes moderate computational cost to deter junk mail, discusses “shortcut” mechanisms for approved bulk mail handled by a trusted agent, and explicitly suggests a frequent correspondent list whose members bypass verification.  ￼

[^12]: Microsoft Learn, Exchange Online limits – Service Descriptions. Microsoft states that Exchange Online customers who need to send legitimate bulk commercial email (for example, newsletters) should use third-party providers that specialize in those services, and that message-rate limits exist to prevent overconsumption by single senders.  ￼

[^13]: Microsoft Learn, Exchange Online Protection limits – Service Descriptions. Microsoft says that if customers want to send commercial bulk email rather than using built-in cloud mailbox protections, they should use a third-party ESP or on-premises servers. It also notes that too many messages in a short period, poor reputation, or questionable content can lead to throttling or blocking.  ￼

[^14]: Microsoft Learn, Service limits for Azure Communication Services. Azure’s email service imposes initial rate limits, recommends a 2–4 week warm-up period while monitoring delivery, supports 1–2 million messages per hour for qualified senders, and conditions that on factors including peak traffic, business need, ability to manage failure rates, and domain reputation.  ￼

[^15]: Google Workspace Admin Help, Email sender guidelines FAQ. Google says spam rate is calculated daily, that senders should keep it below 0.1% and prevent it from reaching 0.3% or higher, and that rates above 0.3% make bulk senders ineligible for mitigation until the rate stays below 0.3% for 7 consecutive days.  ￼

[^16]: Outlook.com SNDS, Smart Network Data Services. Microsoft says deliverability to Outlook.com is based on reputation, that senders should use SNDS data to keep lists clean and monitor unusual behavior, and that JMRP complaint reporting is integrated into the service.  ￼

[^17]: Microsoft Support, Sender Support in Outlook.com. Microsoft says SmartScreen filtering is influenced by factors including sending IP, domain, authentication, list accuracy, complaint rates, and content, and identifies junk-email complaint rate as a principal driver of reputation degradation and deliverability loss.  ￼

[^18]: Microsoft Support, Sender Support in Outlook.com. Microsoft forbids namespace mining, defines it as verifying email addresses without sending to them, says it is commonly used to generate address lists for spam/phishing/malware, and says Microsoft takes action on IPs that engage in it.  ￼

[^19]: Proofpoint Threat Insight, Scammer Abuses Microsoft 365 Tenants, Relaying Through Proofpoint Servers to Deliver Spam Campaigns (July 29, 2024). Proofpoint reports that a spam actor abused a routing configuration so that Microsoft 365-originated spam was relayed through customer Proofpoint infrastructure; Proofpoint notes that any infrastructure offering such a feature can be abused if not properly constrained.  ￼

[^20]: Outlook.com Postmaster, Policies, Practices, and Guidelines. Microsoft says that email servers connecting to Outlook.com must not transmit messages through insecure relay or proxy servers, must stop retrying on permanent failures, and must not exceed certain connection behaviors without prior arrangement.  ￼

[^21]: Google Workspace Help, Route outgoing SMTP relay messages through Google. Google says using SMTP relay for Gmail-originated mail routed out to a third-party gateway and back is only “best effort,” because it can create mail loops, excessive quota use, and increased security risk.  ￼

[^22]: RFC 8461, SMTP MTA Strict Transport Security (MTA-STS). The RFC explains that SMTP can be downgraded via STARTTLS stripping or MX tampering and defines an optional testing mode alongside stricter enforcement modes, enabling soft deployment before hard policy.  ￼

[^23]: RFC 6797, HTTP Strict Transport Security (HSTS). HSTS is the web precedent for this design pattern: once a host is known as strict, the user agent continues to treat it that way and must not silently fall back to insecure handling.  ￼

[^24]: Microsoft Learn, Alert classification for suspicious inbox manipulation rules. Microsoft says compromised user accounts are used for reading inboxes, creating inbox rules to forward mail externally, deleting traces, and sending phishing mail; malicious inbox rules are described as common during both phishing and BEC campaigns.  ￼

[^25]: Microsoft Security Blog, Resurgence of a multi-stage AiTM phishing and BEC campaign abusing SharePoint (January 21, 2026). Microsoft documents a multi-stage AiTM/BEC campaign that compromised accounts, abused SharePoint and inbox-rule manipulation, and used compromised trusted senders as part of the attack chain.  ￼

[^26]: Kaspersky Securelist, Spam and phishing in 2025. Kaspersky reports that 44.99% of all emails sent worldwide in 2025 were spam and that its systems blocked 144,722,674 malicious email attachments and 554,002,207 phishing-link click attempts.  ￼

[^27]: Microsoft Learn, How to handle malicious emails that are delivered to recipients (false negatives) using Microsoft Defender for Office 365. Microsoft says the workflow requires 5–10 minutes, includes user reporting, admin triage, submission for analysis, block-entry creation, and review of why the malicious mail was allowed in the first place.  ￼