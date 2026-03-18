---
title: Email volume baselines for VAMP threshold design
description: How many emails do human send, how do bulk senders behave, how do attackers scale, and where should VAMP thresholds start?
sidebar:
  order: 2
---

#### How many emails a human sends, how bulk senders behave, how attackers scale, and where initial thresholds should start

## Executive summary

The best current public evidence suggests that a **normal professional human sender operates in the low dozens of emails per workday, not the hundreds**. In EmailAnalytics’ business-only benchmark sample, the average professional sent **30.9 emails per workday** and **24.6 per day including weekends**; the busiest weekday average was **33.5 sent on Tuesday**. EmailAnalytics’ 2026 productivity summary rounds that benchmark to **33 emails sent and 88 received per day**, while Microsoft’s 2025 Work Trend data shows the average employee receiving **117 emails per day**. The outbound pattern matters most for VAMP: humans appear to live in a “dozens per day” world, even when their inbox load is much heavier.[^1][^2][^3]

For **human-like outbound prospecting**, Hunter’s 2026 cold-email study is especially useful because it measures real sending behavior at account level across **31 million emails sent in 2025**. It found that reply rates peak when an account sends **20–49 emails/day**, remain strong at **50–99/day**, and that the average outreach sequence had **449 recipients**, although the **best-performing segments were 21–50 recipients** and sequences with **500+ recipients** performed materially worse. This is a strong clue that “legitimate but personal” outbound behavior is still generally **under 100 emails/day/account**, while large blasts quickly become a different operational class.[^4]

For **legitimate bulk or marketing mail**, the public evidence does not provide a single universal “average campaign size,” because this category spans SMB newsletters, SaaS lifecycle messaging, receipts, and enterprise marketing automation. What public sources *do* show is that major providers already treat bulk mail as a separate regime. Gmail applies bulk-sender requirements at roughly **5,000+ messages/day** to personal Gmail accounts, Outlook is introducing similar requirements for domains sending **over 5,000 emails/day**, and Exchange Online explicitly says customers who need to send **legitimate bulk commercial email** should use **specialized third-party providers**. Commercial infrastructure reflects the same split: SendGrid markets campaign plans ranging from **<6,000 to 2.5 million+ emails/month**, while Azure Communication Services starts with conservative quotas but can be raised to **1–2 million messages/hour** for approved high-volume senders.[^5][^6][^10]

For **malicious senders**, there is no single meaningful “average per attacker,” because the distribution is adversarial and highly skewed. Public telemetry instead shows two regimes. At the low end, Microsoft documented phishing campaigns consisting of **fewer than 100 emails**, **several thousand emails**, and attacks sent to **nearly 6,000 accounts across 25 universities**. At industrial scale, Microsoft says a single RaccoonO365 subscription allowed up to **9,000 target email addresses/day**, Tycoon 2FA was responsible for **more than 30 million emails in a single month**, and Proofpoint observed CoGUI phishing campaigns ranging from **hundreds of thousands to tens of millions per campaign**, with **172 million messages** observed in January 2025 alone. Kaspersky measured **44.99% of all email traffic in 2025** as spam.[^7][^8][^9]

That leads to a practical first-pass VAMP policy:

- **No-friction human lane:** up to **100 messages/day/account** and up to **50 new unique external recipients/day**.  
- **Elevated scrutiny lane:** **101–250 messages/day** or **51–100 new unique external recipients/day**.  
- **Sender-cost / throttling lane:** above **250 messages/day** or above **100 new unique external recipients/day**.  
- **Dedicated bulk-sender lane:** **5,000+ messages/day**, with separate policy, complaint/failure controls, and no silent fallback into ordinary human-sender semantics.  

The logic is simple: **100/day is about 3.2× the benchmark professional workday send volume**, **250/day is about 8.1×**, and **5,000/day is about 162×**. Those thresholds create a large safety margin over ordinary human behavior while still leaving room for unusually busy users before bulk-sender treatment begins.[^1]

---

## 1. Research question and method

The practical question is not “how many emails *can* a mailbox send?” Provider hard limits are usually anti-abuse safety rails, not human norms. The real design question for VAMP is: **what send volume looks like a human, what volume clearly belongs to a bulk sender, and what thresholds create enough headroom that ordinary users are not punished while automation and abuse become economically visible?** The answer requires triangulating four evidence types: (1) human productivity/email benchmarks, (2) cold-outreach performance data, (3) provider bulk-sender and mailbox limits, and (4) official threat-intelligence case studies on phishing and spam scale. All sources cited below were re-opened and checked immediately before drafting.[^1]

Two caveats matter. First, **human email benchmarks are much better than attacker “average send volume” benchmarks**. Attackers hide behind botnets, compromised accounts, rented infrastructure, and phishing-as-a-service ecosystems, so public sources mostly describe campaign sizes or ecosystem share, not clean sender-level averages. Second, **marketing mail is not one thing**. A weekly SMB newsletter, SaaS password resets, invoices, and a national retail promotion all live in the same broad category, but with radically different send volumes. That is why provider thresholds and infrastructure tiers are more useful here than a single synthetic “average marketing campaign size.”[^5]

---

## 2. How many emails a human is expected to send in a day

The strongest directly relevant public benchmark is EmailAnalytics’ business-only sample. It reports **30.9 sent emails per workday** when weekends are excluded and **24.6/day** when weekends are included. The sample size is **1,542 EmailAnalytics customers**, @gmail.com accounts were removed to focus on professionals, and the top and bottom **5%** of users by total volume were removed as outliers. The same report shows weekday means of **28.6 on Monday**, **33.5 on Tuesday**, **33.1 on Wednesday**, **31.9 on Thursday**, and **26.8 on Friday**. In other words, a “busy normal” professional workday is still only about **30–35 outbound emails**.[^1]

EmailAnalytics’ 2026 productivity summary restates the practical takeaway: the average professional now receives **88 emails/day** and sends **33/day**. Microsoft’s Work Trend data pushes the inbound figure higher, at **117 emails/day received** on average. The combination is instructive: the modern knowledge worker is **heavily interrupted by email** but is **not** typically sending hundreds of messages per day from a single identity. VAMP should therefore treat “dozens per day” as the default human regime, not “whatever the mailbox provider technically permits.”[^2][^3]

A useful supporting signal comes from Hunter’s 2026 outreach report. Hunter explicitly says deliverability suffers if a single account sends too many emails per day, because mailbox providers expect a volume “that reflects what a human could reasonably send in a day’s work.” In its data, reply rates peak at **20–49 emails/day/account** and remain similar for **50–99/day/account**, while both open and reply performance are strongest **below 100/day/account**. That does not mean a human *cannot* send more than 100/day; it means that once an account does so, it begins to look less human to the ecosystem. That is precisely the kind of boundary VAMP should exploit.[^4]

### Interim conclusion

A defensible working assumption for VAMP is:

- **Expected professional human send volume:** roughly **30–35 emails/workday/account**.[^1]  
- **Conservative “still human-like” upper band:** roughly **up to 100/day/account**.[^4]  

That gives you a baseline without pretending every role is identical. Sales, recruiting, support, and executive-assistant roles may exceed the mean, but they still do not naturally belong in the same category as bulk marketing or industrial spam.

---

## 3. What legitimate outreach and marketing look like

### 3.1 Cold outreach and human-operated prospecting

Hunter’s 2026 report is the clearest public source for the volume profile of legitimate email outreach. Across **31 million emails sent in 2025**, the **average sequence had 449 recipients**, but the best-performing recipient cohorts were **21–50 people**, and sequences with **more than 500 recipients** materially underperformed. Hunter also found that contacting **one or two people per company** outperformed contacting **three or more**, which is a useful anti-abuse clue for VAMP: high first-touch fanout into one destination domain is statistically associated with lower legitimacy and worse outcomes.[^4]

This leads to an important distinction. **Legitimate personal outreach is not the same thing as legitimate mass marketing.** A sales rep, recruiter, or founder doing credible outbound work may send dozens of carefully targeted emails, perhaps even a few dozen more on busy days, but the evidence does not support treating “hundreds or thousands per day from a human account” as normal. Even the cold-email ecosystem that most aggressively pushes outbound prospecting still finds the sweet spot **below 100/day/account** and in small segments.[^4]

### 3.2 Bulk/marketing/transactional programs

Public provider policy confirms that true bulk mail is a separate operational class. Gmail defines a bulk sender as one who sends **close to 5,000 or more messages in 24 hours** to personal Gmail accounts, and permanent bulk-sender obligations attach once that threshold is met. Outlook’s announced rules likewise focus on domains sending **over 5,000 emails/day**. Exchange Online permits **10,000 recipients/day** and **30 messages/minute** per mailbox, but Microsoft explicitly says customers who need to send **legitimate bulk commercial email** should use **third-party providers that specialize in these services**. Gmail Workspace user limits are likewise high—**2,000 messages/day**, **10,000 total recipients/day**, and **3,000 external recipients/day**—but these are mailbox safety rails, not statements of normal human behavior.[^6][^10]

Commercial bulk infrastructure shows the same pattern. SendGrid’s public marketing-campaign plans range from **<6,000 to 2.5 million+ emails/month**, with **100 to 500,000+ contacts** in plan tiers. Its Email API plans scale from **50,000 to 5 million+ emails/month**, and Twilio’s own scaling guide discusses growth milestones such as **1 million to 2.5 million/month** and **5 million to 10 million/month**. Azure Communication Services begins cautiously at **30 emails/minute** and **100/hour** per subscription for custom domains, but supports **1–2 million messages/hour** for approved high-volume senders, with the explicit requirement that failure rates stay below **1%** for high quota.[^5]

### Interim conclusion

The market already tells us there are **two different sending worlds**:

1. **Human-operated identities**: dozens/day, sometimes low hundreds/day.[^1]  
2. **Bulk-sender infrastructure**: thousands/day up to millions/hour, with dedicated reputation management and compliance.[^5][^6]  

VAMP should not blur those two worlds.

---

## 4. What scammers and spammers send

### 4.1 Targeted phishing and BEC-style campaigns

Low-volume malicious campaigns can be surprisingly small. Microsoft documented a March 2025 tax-themed campaign of **fewer than 100 emails** targeting CPAs and accountants, another February 2025 tax-themed campaign involving **several thousand emails**, and another tax-themed wave sent to **more than 2,300 organizations**. In “payroll pirate” attacks affecting US universities, Microsoft observed **11 compromised accounts** used to send phishing mail to **nearly 6,000 email accounts across 25 universities**. The lesson is important: **not all dangerous email abuse is high-volume**. Highly targeted campaigns can sit well below any simple “messages/day” threshold and still be severe.[^7]

RaccoonO365 shows the next rung up. Microsoft says customers of the service could input **up to 9,000 target email addresses/day**, and that a single subscription enabled a criminal to send **thousands of phishing emails a day**, “adding up to potentially hundreds of millions of malicious emails a year” through the platform. This is a useful design anchor: once an identity is pushing into the high hundreds or low thousands of fresh external targets/day, it is already in territory associated with commercialized phishing operations, not human communication.[^8]

### 4.2 Industrial phishing and mass spam

At industrial scale, the numbers become absurd. Microsoft says Tycoon 2FA was responsible for **more than 30 million emails in a single month** by mid-2025 and accounted for roughly **62% of all phishing attempts Microsoft blocked**. Proofpoint says CoGUI campaigns ranged from **hundreds of thousands to tens of millions per campaign**, with **around 50 campaigns/month** observed and **172 million messages** seen in January 2025 alone. Kaspersky measured **44.99% of all global email traffic in 2025** as spam. These are not “aggressive humans.” They are industrial abuse systems.[^9]

### Interim conclusion

Malicious senders also divide into two groups:

- **Targeted malicious senders**: fewer than 100 to several thousand messages per campaign/day.[^7]  
- **Industrial malicious senders**: thousands/day per subscription, tens of millions/month per service, or hundreds of thousands to tens of millions/campaign.[^8][^9]  

This is why **volume thresholds alone are necessary but not sufficient**. They are very good at catching commodity abuse and automation. They are not enough to stop every spear-phish.

---

## 5. Safety margin: where a threshold stops looking like a human

Using the **30.9 emails/workday** benchmark as the baseline, the safety margin of candidate thresholds looks like this:

- **100 emails/day** = **3.24×** the benchmark professional workday volume. ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~  
- **250 emails/day** = **8.09×** the benchmark professional workday volume.[^1]  
- **500 emails/day** = **16.18×** the benchmark professional workday volume.[^1]  
- **5,000 emails/day** = **161.81×** the benchmark professional workday volume.[^1]  

From a policy-design perspective, this is almost comically useful. A **100/day** threshold is already very generous relative to actual human behavior, yet it still aligns with Hunter’s finding that the best-performing sender accounts stay **below 100/day**. A **250/day** threshold is far beyond what public human benchmarks suggest is ordinary, but still nowhere near bulk-sender territory. And **5,000/day** cleanly aligns with how Gmail and Outlook already distinguish high-volume senders from ordinary ones.[^4]

The main policy mistake to avoid is using **provider hard limits as human baselines**. Exchange Online’s **10,000 recipients/day** and Gmail Workspace’s **2,000 messages/day** are service-protection ceilings. They are designed to keep the platform from being abused, not to describe what a normal person does. VAMP should set its own human thresholds far lower than those ceilings.[^10]

---

## 6. How the initial VAMP thresholds should be set

## 6.1 Core design principle

VAMP should not key primarily on raw daily message count alone. It should weight three dimensions:

1. **Messages per day per identity**  
2. **New unique external recipients per day**  
3. **First-touch fanout into the same external domain/company**  

That is because a human executive assistant might send many replies into existing threads, while a spammer’s signal is more often **new outbound fanout**. Microsoft already distinguishes **non-relationship recipients** in Outlook.com, and Hunter’s data shows outreach degrades when you contact **three or more people per company** instead of one or two. That makes “new external recipients” and “per-domain first-touch concentration” more useful than raw count alone.[^4][^11]

## 6.2 Proposed starting thresholds

### A. Default human lane (no sender-side cost)

A VAMP identity should remain in the ordinary human lane if it stays at or below:

- **100 messages/day**, and  
- **50 new unique external recipients/day**, and  
- **no more than 2 first-touch recipients at the same external domain/company in 24 hours**.  

This threshold is intentionally generous. It is already **3.2×** the benchmark professional workday send volume, and still consistent with Hunter’s finding that deliverability and replies are strongest below **100/day/account**. The “2 per external domain/company” heuristic comes from the fact that contacting **1–2 people/company** performs better than contacting **3+**, which also makes it a useful anti-abuse signal.[^1][^4]

### B. Elevated scrutiny lane (reputation-weighted, but not bulk)

An identity should move into an elevated-scrutiny lane if it crosses any of these:

- **101–250 messages/day**, or  
- **51–100 new unique external recipients/day**, or  
- **3+ first-touch recipients at the same external domain/company in 24 hours**.  

At this stage, VAMP should not necessarily block the sender. Instead, it should begin applying **higher sender cost, stronger reputation weighting, more aggressive anomaly detection, or explicit account/device trust checks**. The point is to make automation and list-based outreach more expensive before it looks like bulk abuse. The reason **250/day** is a sensible boundary is that it is already **8.1×** the professional average and well above the public “human-like” range suggested by both EmailAnalytics and Hunter.[^1][^4]

### C. Sender-cost / throttling lane

Above **250 messages/day** or **100 new unique external recipients/day**, the identity should move into a sender-cost or throttling lane by default. At this point, the account is behaving much more like automation, bulk outreach, or compromise than like an ordinary human sender. VAMP’s exact “cost” mechanism can evolve later—proof of work, stricter rate controls, relationship approval, domain reputation dependency, or other friction—but this is a reasonable point to start imposing it.[^1]

### D. Dedicated bulk-sender lane

At **5,000+ messages/day**, VAMP should treat the identity or sending domain as a **bulk sender**, not as a human mailbox. That matches the threshold already used by Gmail and Outlook for high-volume sender requirements. This lane should require:

- a **separate sender class** from ordinary human identities,  
- stronger authentication and reputation controls,  
- explicit unsubscribe and complaint handling for promotional traffic,  
- **no downgrade escape hatch** back into ordinary SMTP-like semantics, and  
- dedicated monitoring of complaint and failure rates.[^6]

For this bulk lane, a reasonable initial health target is:

- **user-reported spam/complaint rate target below 0.1%**, with intervention before it hits **0.3%**, following Gmail’s public guidance, and  
- **failure rate below 1%** if the sender wants higher quota, mirroring Azure Communication Services.[^6]

## 6.3 Why these thresholds are preferable to provider hard caps

These proposed thresholds are intentionally **much lower** than mailbox-provider ceilings. Exchange Online allows **10,000 recipients/day** and **30 messages/minute** per mailbox, but Microsoft explicitly says bulk commercial email should go through specialized providers. Gmail Workspace allows **2,000 messages/day** and **3,000 external recipients/day**, yet Google separately treats **5,000+/day to Gmail** as bulk-sender behavior. In other words, provider limits tell you what the service can tolerate, not what a human should be assumed to do. VAMP should set defaults based on **human behavior plus safety margin**, not on the absolute size of the guardrail.[^10]

---

## 7. What volume thresholds can and cannot solve

These thresholds will be effective against:

- commodity spam,  
- compromised accounts used for broad phishing,  
- cheap cold-blast automation,  
- list-based credential phishing, and  
- much of the “phishing-as-a-service” ecosystem that depends on cheap scale.[^8]

They will **not**, by themselves, reliably stop:

- carefully targeted BEC setups,  
- highly customized spear-phishing that stays under 100 messages,  
- fraud run through already-trusted identities, or  
- attacker behavior that is intentionally low-volume and relationship-aware. Microsoft’s case studies explicitly include campaigns of **less than 100 emails** and **several thousand emails**, which is why VAMP will still need identity trust, relationship state, revocation, domain reputation, and downgrade resistance on top of volume.[^7]

So the right way to think about these thresholds is:

> **Volume thresholds are the anti-automation rail, not the whole security model.**

That is still extremely valuable. Most ordinary humans should never feel them. Bulk senders should operate in a clearly different lane. And commodity attackers should have to pay real cost much earlier.

---

## 8. Final recommendation

If VAMP needs a first shipping policy, the cleanest starting point is:

- **Default human lane:** ≤ **100 messages/day/account** and ≤ **50 new unique external recipients/day**.  
- **Elevated scrutiny:** **101–250/day** or **51–100 new unique external/day**.  
- **Sender-cost lane:** > **250/day** or > **100 new unique external/day**.  
- **Bulk sender class:** ≥ **5,000/day**, with separate infrastructure and policy.  
- **Bulk health targets:** complaint/spam **<0.1% target**, intervene at **0.3%**, and keep delivery failure **<1%** for quota growth.[^1]

That policy is defensible for three reasons.

First, it reflects **actual human behavior** rather than provider hard caps. Second, it aligns with how the market already separates **human mailboxes** from **bulk sender infrastructure**. Third, it leaves a large safety margin for busy legitimate users while making automation and abuse visible early. The numbers will need tuning with real telemetry, but as a starting point they are serious, conservative, and operator-friendly.[^1]

## Source notes

This write-up relied primarily on:

- EmailAnalytics business-user email benchmark data and 2026 productivity summary.[^1][^2]
- Microsoft Work Trend data on daily inbound email volume.[^3]
- Hunter’s 2026 cold-email report based on **31 million emails sent in 2025**.[^4]
- Official Google, Microsoft, Exchange Online, Azure, and SendGrid policy/limit pages.[^5][^6][^10][^11]
- Official Microsoft, Proofpoint, and Kaspersky threat-intelligence reports and case studies on phishing/spam scale.[^7][^8][^9]

## Citations

[^1]: EmailAnalytics, “Email Productivity Benchmark Report,” https://emailanalytics.com/email-productivity-benchmark-report/

[^2]: EmailAnalytics, “51 Productivity Statistics to Improve Your Team’s Performance,” https://emailanalytics.com/51-productivity-statistics-to-improve-your-teams-performance/

[^3]: Microsoft News, “New Microsoft study reveals the rise of the infinite workday,” https://news.microsoft.com/de-ch/2025/06/17/new-microsoft-study-reveals-the-rise-of-the-infinite-workday-40-of-employees-check-email-before-6-a-m-evening-meetings-up-16/

[^4]: Hunter, “The State of Cold Email,” https://hunter.io/the-state-of-cold-email/

[^5]: SendGrid Pricing, https://sendgrid.com/en-us/pricing

[^6]: Google Workspace Admin Help, “Email sender guidelines FAQ,” https://support.google.com/a/answer/14229414?hl=en

[^7]: Microsoft Security Blog, “Investigating targeted payroll pirate attacks affecting US universities,” https://www.microsoft.com/en-us/security/blog/2025/10/09/investigating-targeted-payroll-pirate-attacks-affecting-us-universities/

[^8]: Microsoft On the Issues, “Microsoft seizes 338 websites to disrupt rapidly growing RaccoonO365 phishing service,” https://blogs.microsoft.com/on-the-issues/2025/09/16/microsoft-seizes-338-websites-to-disrupt-rapidly-growing-raccoono365-phishing-service/

[^9]: Microsoft On the Issues, “How a global coalition disrupted Tycoon,” https://blogs.microsoft.com/on-the-issues/2026/03/04/how-a-global-coalition-disrupted-tycoon/

[^10]: Microsoft Learn, “Exchange Online limits,” https://learn.microsoft.com/en-us/office365/servicedescriptions/exchange-online-service-description/exchange-online-limits

[^11]: Microsoft Support, “Sending limits in Outlook.com,” https://support.microsoft.com/en-us/office/sending-limits-in-outlook-com-279ee200-594c-40f0-9ec8-bb6af7735c2e