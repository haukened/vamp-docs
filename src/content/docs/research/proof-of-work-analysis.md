---
title: Proof-of-Work Families for VAMP  
description: A technical deep dive on sender-cost models for MTA-executed anti-abuse controls
---

## Executive summary

This paper evaluates proof-of-work (PoW) families that could plausibly be used inside VAMP under the constraints already established by prior research and design discussion:

1. **The work is executed by the sending MTA / outbound relay / sender service edge, not by end-user clients.**
2. **Budgets and penalties attach first to the domain / tenant / sender service, with optional per-identity accounting underneath.**
3. **No money, crypto-assets, staking, or micropayment rails are part of the protocol.**
4. **Human mail and bulk mail are separate operational classes.**
5. **The PoW layer is intended to address scale-dependent abuse, not to solve every trust-abuse problem by itself.**
6. **Because VAMP is a store-and-forward network protocol, human-in-the-loop escalation is out of scope. Any adaptation in difficulty must be automated and machine-to-machine, not CAPTCHA-like or admin-driven.**

Under those constraints, the most important conclusion is this:

> **VAMP should not adopt a universal, CPU-bound Hashcash-style puzzle as its primary sender-cost primitive.**  
> The best fit among currently published families is an **asymmetric memory-hard proof-of-work family** with **cheap verification, recipient/time/domain binding, and tunable memory cost**. If adaptive difficulty is ever needed, it should be done through **automated policy modulation**, not human intervention.[^1][^2][^3][^4][^5][^6]

On the current literature, the strongest near-term fit is an **Equihash-like family**: it is explicitly designed as an **asymmetric proof-of-work**, is **instant to verify**, has **short proofs**, introduces **algorithm binding to prevent cost amortization**, and imposes **steep time-space tradeoffs** when memory is reduced.[^1] However, the evidence also shows that **memory-hard does not mean ASIC-proof forever**: official Zcash documentation now assumes ASIC mining for Equihash networks, and the Zcash Foundation documented the emergence of Equihash ASICs as early as 2018.[^7][^8] For VAMP, that means Equihash-like designs should be treated as **strong throttling primitives**, not as perfect egalitarianity guarantees.

The paper therefore reaches a two-part recommendation:

- **Prototype recommendation:** use an **Equihash-like asymmetric memory-hard family** for the first research prototype, because it best matches the required properties of non-interactive issuance, cheap verification, and steep memory tradeoffs among currently published designs.[^1]
- **Longer-term research recommendation:** pursue an **Argon2-derived asymmetric proof family** only if it can be given **cheap verification** without inheriting the failure modes demonstrated against MTP. Argon2 itself is a strong memory-hard primitive, but **plain Argon2 or scrypt are not enough by themselves** because verification is too expensive when used as standalone per-message proofs.[^3][^4][^5][^9][^10]

## 1. Scope and threat-model fit

This paper is not evaluating PoW as a universal cure for email abuse. It is evaluating PoW as a control layer for the threat models that prior research showed are most sensitive to **sender-side marginal cost**.

### 1.1 Threat models well-addressed by MTA-side PoW

Under the VAMP constraints, a PoW layer is best suited to:

- **Bulk spam**
- **High-volume phishing and phishing-as-a-service**
- **Directory harvesting / namespace mining**
- **Relay / gateway laundering that depends on cheap message throughput**
- **Broad post-compromise fan-out from a compromised sender**
- **SMTP downgrade abuse when fallback is being used to evade native accountability**

These attack classes all have one thing in common: **they become materially weaker when the sender has to pay a real, attributable marginal cost for each new unit of abuse**.[^11][^12]

### 1.2 Threat models only partially addressed by MTA-side PoW

The same mechanism is only partially effective against:

- **BEC setup messages**
- **Low-volume impersonation**
- **Compromised but previously trusted senders**
- **Spear-phishing that stays intentionally below volume thresholds**

The reason is simple: those threats often weaponize **existing trust** rather than **cheap scale**. Prior anti-spam economics work makes the same point from a different angle: a **uniform** proof-of-work system is too blunt, while a **hybrid** system that combines cost with reputation or trust state is much more plausible.[^11][^12]

So the design target for VAMP is narrower and more rigorous:

> **The PoW layer must make large-scale first contact, large-scale fan-out, and low-trust sending measurably more expensive, while being cheap for receivers to verify and operationally acceptable for legitimate domains.**

## 2. Design requirements for a VAMP proof-of-work primitive

Based on the previous threat-model analysis and the literature, a PoW primitive suitable for VAMP needs all of the following properties.

### 2.1 MTA-compatibility

The primitive must be practical for execution by an **outbound MTA / relay**. That implies:

- **No end-user interaction**
- **Predictable enough latency for queued mail**
- **Straightforward implementation in server software**
- **Compatibility with domain-scoped budgets and administrative monitoring**

This requirement rules out **human-solved escalation paths** as part of the protocol’s normal operation. Interactive puzzle research remains relevant as theory, but VAMP cannot depend on end users or administrators solving challenges during delivery.[^13][^14]

### 2.2 Cheap verification

Dwork, Goldberg, and Naor explicitly argue that the cost of **verification** must grow much more slowly than the cost of **proof generation**, and that if verification is sufficiently cheap it can even be performed by the receiver’s SMTP server.[^15] Any PoW family that requires the receiver to redo most of the sender’s work is a poor fit for mail transport.

### 2.3 Non-amortization

A proof must be bound so that solving for one recipient or one message does not materially help solve for another. Dwork, Goldberg, and Naor list this as a core property of any anti-spam pricing function, and Back’s Hashcash similarly binds stamps to a **service name** and time, with replay protection via expiry and spent-token tracking.[^15][^16]

For VAMP, that means any acceptable PoW family must be bindable to at least:

- sender domain / sender service,
- recipient or recipient policy scope,
- a short time epoch,
- and a nonce or challenge identifier.

### 2.4 Tunable cost

Dwork and Naor already treated tunable hardness as a design requirement in 1992.[^17] In VAMP, tunability matters twice:

- operators need to raise or lower work factors over time,
- and policy may require different costs for different sender classes.

### 2.5 Hardware-asymmetry resistance

The literature is unequivocal that pure CPU-bound work is vulnerable to disparities among machines and to specialized hardware. Abadi, Burrows, Manasse, and Wobber argue that memory latency varies less across machines than CPU speeds, making memory-bound functions more equitable.[^18] Dwork, Goldberg, and Naor pursued the same direction and explicitly formalized memory-bound anti-spam proofs.[^15] Argon2, scrypt, Equihash, and MTP all exist in this general design tradition.[^1][^3][^4][^5][^9][^10]

### 2.6 Stateless or near-stateless receiver operation

Interactive challenge systems can be made stateless with signed or MACed challenge material, but a non-interactive mail stamp is simpler when mail is store-and-forward. Hashcash explicitly supports non-interactive issuance for email because the receiver cannot issue a challenge in advance in store-and-forward systems.[^16] This does **not** mean VAMP must be interactive nowhere; it means the **default** sender-cost primitive should ideally not require receiver-side pre-challenge state.

## 3. Candidate proof-of-work families

### 3.1 CPU-bound partial hash search (Hashcash family)

Hashcash is the classic anti-spam proof-of-work design. Back describes it as a **non-interactive, publicly auditable, trapdoor-free cost function** based on finding a partial hash collision, originally proposed to throttle abuse of unmetered resources such as email.[^16] Its most important strengths are:

- **very cheap verification**,
- **non-interactive issuance**,
- **simple implementation**,
- **natural message/service/time binding**,
- and **public auditability**.[^16]

These are real advantages for email.

But the weaknesses are equally clear in the literature. Laurie and Clayton’s 2004 analysis concluded that a **universal** proof-of-work system cannot effectively discourage spammers without having an unacceptable impact on a significant fraction of legitimate senders, and that any viable approach would require “significant extra complexity” to excuse legitimate senders from some of the proof-of-work burden.[^11] Hashcash itself is also explicitly **parallelizable**, and Back notes that the non-interactive form has **unbounded probabilistic cost** and is open to precomputation unless additional binding material or a slowly changing beacon is used.[^16]

#### Trade-off conclusion

Hashcash remains attractive for **simplicity** and **verification cost**, but the academic record is strong that **uniform CPU-bound PoW is too blunt** and too favorable to attackers with rented compute, botnets, or specialized hardware.[^11][^12][^16] Under VAMP’s constraints, Hashcash is best viewed as:

- a **baseline reference design**,
- a possible **design benchmark**,
- but **not** the best primary family for MTA-scoped sender-cost control.

### 3.2 Interactive server-issued client puzzles

Juels and Brainard’s client puzzles were built for **connection depletion attacks** rather than spam, but the model is relevant because it offers:

- **easy verification**,
- **carefully controlled hardness**,
- **stateless challenge construction**,
- and **dynamic scaling of puzzle difficulty depending on attack severity**.[^13]

These are excellent properties when the receiver is online and willing to issue a challenge.

The problem is architectural fit. Client puzzles are fundamentally **interactive**. Juels and Brainard present them in a connection-establishment setting, not a store-and-forward mail setting.[^13] Email, even in VAMP, still wants the ability to queue, retry, and operate with minimal back-and-forth. Back’s contrast between interactive and non-interactive cost functions is directly relevant: interactive cost functions help defeat precomputation and allow dynamic throttling, but non-interactive ones are more natural for store-and-forward communication like email.[^16]

#### Trade-off conclusion

Interactive puzzles are still academically valuable because they demonstrate **cheap verification**, **dynamic difficulty adjustment**, and **stateless challenge construction**.[^13][^16] However, VAMP is fundamentally a **network protocol for store-and-forward messaging**, not an interactive user workflow. It cannot assume that end users, administrators, or operators will solve CAPTCHA-style challenges or participate in synchronous escalation during ordinary message delivery.

For that reason, interactive puzzle schemes are **not suitable as a required operational path** for VAMP. Their relevance is primarily architectural: they show how difficulty can be adjusted under changing abuse conditions. If any challenge-based escalation is retained in the design, it should be **fully automated and machine-to-machine**, not dependent on human intervention.

### 3.3 Memory-bound anti-spam functions

Abadi, Burrows, Manasse, and Wobber’s “moderately hard, memory-bound functions” and Dwork/Goldberg/Naor’s “memory-bound functions for fighting spam” are directly relevant because they were designed with the anti-spam use case in mind.[^18][^15]

Abadi et al. argue that CPU-bound work is problematic because of machine disparities, and that memory-bound functions can be evaluated at more similar speeds across systems.[^18] Dwork, Goldberg, and Naor go further: they formalize anti-spam pricing functions that force the sender to perform many unrelated memory accesses while allowing the receiver to verify the work with **significantly fewer** memory accesses—or, in some constructions, with **no memory accesses at all** on the verification side.[^15]

This family is extremely aligned with VAMP’s needs:

- the anti-spam literature already targeted email,
- the sender/receiver asymmetry is deliberate,
- the functions are explicitly designed to be **non-amortizable** across recipients,
- and the verification burden is kept low.[^15]

The weakness is standardization and maturity. These designs are academically strong, but there is no modern IETF-standardized, widely deployed “memory-bound anti-spam stamp” equivalent to Hashcash. In practice, the industry standardized more around generic memory-hard KDFs and cryptocurrency PoW work than around the specific Penny Black-style anti-spam constructions.

#### Trade-off conclusion

This family is one of the **best conceptual fits** for VAMP, and it strongly influences the final recommendation. Its weakness is not conceptual but practical: **it is less mature as a directly implementable, audited, modern internet primitive than the best-known newer families**.

### 3.4 Standalone memory-hard KDFs as PoW cores: scrypt and Argon2

#### scrypt

scrypt is standardized in RFC 7914 and explicitly described as based on memory-hard functions that offer added protection against attacks using custom hardware.[^5] Colin Percival’s underlying paper argues for **sequential memory-hard functions** as a way to reduce the advantage of hardware parallelism.[^6]

That sounds attractive for VAMP. The problem is that **standalone scrypt does not give the asymmetry we need**. The MTP cryptanalysis paper states the issue plainly: tuning scrypt to use substantial memory does **not** provide efficient verification, which is why Litecoin’s deployment did not end up using substantial memory at all.[^10]

#### Argon2

Argon2 is stronger and more modern. RFC 9106 explicitly says it is a **memory-hard function for password hashing and proof-of-work applications**.[^3] The RFC and original paper both emphasize:

- tunable memory and time cost,
- defense against trade-off attacks,
- and resistance to hardware cost advantages through memory pressure.[^3][^4]

RFC 9106 also distinguishes the variants:

- **Argon2d** uses data-dependent memory access and is suitable for **proof-of-work applications** when side-channel timing attacks are not a concern,
- **Argon2i** uses data-independent access and is preferred for password hashing,
- **Argon2id** blends the two and is the required baseline in the RFC.[^3]

This makes Argon2 a compelling **work core** for a VAMP stamp.

But the critical limitation remains: **plain Argon2 does not solve the receiver-verification problem**. If used directly as a per-message stamp, the receiver would have to recompute essentially the same memory-hard function to verify the sender’s work. That is the wrong asymmetry for a mail server.

#### Trade-off conclusion

scrypt and Argon2 are **good primitives**, but **bad standalone anti-spam stamps**. They are most useful as building blocks inside a larger asymmetric design, not as the entire scheme.

### 3.5 Asymmetric memory-hard proofs: Equihash

Equihash is one of the few published designs that was explicitly created to solve the problem VAMP cares about: an **asymmetric proof-of-work** that is **memory-hard for the prover** but **instant to verify**.[^1]

The Equihash paper’s claims are exactly the right ones for this problem:

- the prover requires a lot of memory,
- verification is instant,
- time-space tradeoffs are steep,
- and **algorithm binding** is introduced specifically to prevent cost amortization.[^1]

The authors present a reference implementation using **700 MB of RAM**, taking **30 seconds** on a **1.8 GHz CPU**, with a proof only **120 bytes** long, and they claim a **1000×** computation increase if memory is halved.[^1] Those numbers are not necessarily the right operating point for VAMP, but the design shape is exactly right.

The caution comes from practice. Official Zcash documentation now states that “given the current network difficulty you must use an ASIC to mine Zcash,” and notes that after the release of the Antminer Z9 mini, more and more ASICs were deployed, driving a **10×** growth in network difficulty.[^7] The Zcash Foundation likewise documented the urgency of the **ASIC resistance** debate once Equihash-focused ASICs appeared.[^8]

That does **not** invalidate Equihash for VAMP. It simply means that “memory-hard” should not be oversold as “permanently ASIC-proof.” For email, the requirement is lower: VAMP does not need to make custom hardware impossible, only to make abuse materially less scalable and less profitable at the sender edge than it is today.

#### Trade-off conclusion

Among currently published designs, Equihash is the **strongest direct fit** for a VAMP prototype because it combines:

- non-interactive issuance,
- cheap verification,
- short proofs,
- recipient/time binding potential,
- and steep memory tradeoffs.[^1]

Its main weakness is that **practice has shown ASIC resistance is not absolute**.[^7][^8] That is a real caution, but not a disqualifier for VAMP’s use case.

### 3.6 Argon2 + Merkle proof families: MTP

MTP (Merkle Tree Proof) is conceptually attractive because it tries to get the best of both worlds:

- use a memory-hard function (Argon2d),
- commit to the full memory image with a Merkle tree,
- and let the receiver verify only a small subset with a short proof.[^9]

The revised “Egalitarian Computing” paper presents MTP as a **memory-hard proof-of-work with fast verification and short proofs**, requiring **2 GB of RAM** to make a proof and claiming performance hard to beat for the same amount of RAM.[^9]

On paper, this is a near-perfect VAMP shape.

The problem is the published cryptanalysis. Dinur and Nadler’s attack paper shows that the proposed MTP instantiation using Argon2d could be attacked with **less than a megabyte of memory**—about **1/3000** of the honest prover’s memory—with a computation penalty of **170×**, which they say is **more than 55,000 times faster** than the designers claimed.[^10] The attack exploits data-dependent indexing in Argon2d and the fact that only part of the memory is verified.[^10]

The revised MTP paper says the scheme was tweaked in late 2017 to withstand these attacks.[^9] That matters, but it does not erase the fundamental lesson: **Argon2-based partial verification is subtle and dangerous**. The family is promising, but the specific published MTP construction is not a safe drop-in choice for VAMP.

#### Trade-off conclusion

MTP shows the **right architectural direction**—memory-hard generation with short, cheap verification—but should **not** be adopted as-is for VAMP because a published attack significantly undercut the claimed security of the original construction.[^10]

### 3.7 Sequential-delay families: VDFs

Verifiable Delay Functions (VDFs) are elegant: they require **t sequential steps** to evaluate and support **efficient public verification**.[^19] If the only requirement were “make the sender wait,” VDFs would look attractive.

But their design goal is different. VDFs are about **sequential delay**, not specifically about making general-purpose server hardware relatively competitive with specialized hardware through memory cost. They are valuable for randomness beacons and delay-sensitive decentralized systems, but for VAMP they impose a direct per-message latency penalty by construction.[^19]

That does not automatically disqualify them, but it makes them misaligned with the operational goal of a mail transfer agent, which wants:

- predictable queue throughput,
- tunable parallelism across a finite MTA fleet,
- and economic pressure on scale rather than a universal wall-clock pause.

#### Trade-off conclusion

VDFs are academically interesting but **not** the best fit for VAMP v0. They optimize for the wrong dimension of asymmetry.

## 4. What the literature says about universal vs hybrid PoW

Any recommendation here has to grapple with the strongest academic criticism of proof-of-work for email.

Laurie and Clayton’s 2004 paper concluded that a **universal** proof-of-work system would either fail to stop spam or impose unacceptable burden on legitimate senders, and that any viable design would need significant extra complexity to excuse legitimate senders from some of the work.[^11]

Later work responded by showing that PoW can be more plausible when it is combined with **reputation weighting**. “Proof of Work can Work” explicitly argues that work requirements can be weighted by a reputation function and combined with current anti-spam reputation systems, rather than applied uniformly to all senders.[^12]

This is directly relevant to VAMP. It means the literature supports **exactly the posture VAMP is already taking**:

- **no universal flat cost**,  
- **reputation- and relationship-aware friction**,  
- **a separate bulk-sender lane**,  
- and **stronger cost for newcomers and suspicious high-volume fan-out**.[^11][^12]

So the question is not “should VAMP use PoW alone?” The literature says no. The correct question is “which PoW family best supports a **hybrid, reputation-aware, MTA-scoped** design?” That is the standard used in the recommendation below.

## 5. Trade-off study

| Family | Verification cost | Non-interactive suitability | Hardware-asymmetry resistance | Supports dynamic difficulty | Major weakness | Fit for VAMP |
|---|---:|---:|---:|---:|---|---|
| **Hashcash / CPU-bound partial hash search**[^16] | Excellent | High | Low | Moderate | Too friendly to parallel / specialized compute; universal flat cost criticized in the literature | **Reference only, not primary** |
| **Interactive client puzzles**[^13][^16] | Excellent | Low as default, high as theory | Low–Moderate | High | Requires online challenge/response and is not suitable as a required operational path in a store-and-forward protocol | **Useful research precedent, not default path** |
| **Memory-bound anti-spam functions**[^15][^18] | Good to excellent | High | Moderate–High | Moderate | Less standardized / less modern operational tooling | **Strong conceptual basis** |
| **scrypt as standalone stamp**[^5][^6][^10] | Poor | High | Moderate | Moderate | Verification too expensive as a direct stamp | **Not recommended as final stamp** |
| **Argon2 as standalone stamp**[^3][^4] | Poor | High | Moderate–High | High | Verification too expensive without proof wrapper | **Good work core, not full solution** |
| **Equihash family**[^1][^7][^8] | Excellent | High | Moderate–High at design time | Moderate | ASIC resistance not permanent in practice | **Best current prototype family** |
| **MTP family**[^9][^10] | Excellent | High | Intended high | Moderate | Published attack against original construction; subtle proof system | **Do not adopt as-is** |
| **VDF family**[^19] | Excellent | High | Not targeted at memory egalitarianism | Low | Enforces sequential delay rather than useful MTA-friendly cost | **Not recommended for v0** |

## 6. Proposed direction for VAMP

### 6.1 Recommended family

Based on the published literature and the operational constraints already established, the best current recommendation is:

> **Use an asymmetric memory-hard PoW family for VAMP’s primary stamp, with an Equihash-like design as the first prototype family.**

This recommendation is based on four source-backed properties:

1. **Cheap verification is mandatory for receivers.**[^15]  
2. **Memory cost is more equitable than pure CPU cost.**[^18][^15]  
3. **Non-amortization across recipients and messages is required.**[^15][^16][^1]  
4. **Published asymmetric memory-hard designs exist, and Equihash is the strongest current fit among them.**[^1]

#### Why not plain Hashcash?

Because the academic critique of universal CPU-bound PoW is strong, and because Hashcash does not solve the hardware asymmetry problem nearly as well as modern memory-hard designs.[^11][^16][^18]

#### Why not plain Argon2 or scrypt?

Because they are excellent **memory-hard functions**, but not excellent **receiver-cheap proofs** when used directly per message.[^3][^4][^5][^10]

#### Why not MTP?

Because the specific published MTP construction attracted a serious published attack and should not be adopted blindly.[^10]

#### Why not VDFs?

Because they optimize for sequential delay, not for the particular sender/receiver asymmetry and MTA throughput profile VAMP needs.[^19]

### 6.2 Recommended deployment shape

The literature supports a design in which the **default sender-cost mechanism is non-interactive**.

#### Mode A: non-interactive default stamp

For ordinary first-contact or low-trust mail, the sender MTA computes a **non-interactive asymmetric memory-hard stamp** bound to:

- sender domain / sender service,
- recipient policy scope,
- a short epoch or timestamp window,
- and a nonce/challenge seed.

This follows Dwork/Goldberg/Naor’s anti-amortization requirement and Hashcash’s service/time binding.[^15][^16]

#### Mode B: automated policy modulation, not human escalation

When the receiver wants stricter control—because the sender is unknown, low reputation, or actively throttled—the receiver may publish or negotiate **machine-readable policy inputs** that cause the sender MTA to perform more work. However, VAMP should **not** assume a human challenge-response loop, administrative CAPTCHA solving, or any other intervention-driven escalation path.

This preserves the useful insight from interactive puzzle research—namely that difficulty can be raised under attack conditions—without making the protocol operationally dependent on synchronous human action.[^13][^16]

This is directly consistent with the academic critique that **universal flat PoW is too blunt**, and with the later argument that **PoW can work when combined with reputation systems**.[^11][^12] It is also more consistent with the realities of mail transport, where delivery decisions must generally be made automatically by MTAs and relays rather than by end users or administrators in real time.

### 6.3 What VAMP should *not* do in v0

The literature is strong enough to justify several explicit exclusions:

1. **Do not use a universal flat Hashcash-style CPU puzzle as the primary sender-cost mechanism.**[^11][^16]  
2. **Do not require end-user clients to do the work.** That violates the operational constraints and defeats domain-scoped accountability.  
3. **Do not ship plain scrypt or plain Argon2 as the final per-message proof.** Use them, if at all, as internal primitives or research cores, not as receiver-expensive standalone stamps.[^3][^5][^10]  
4. **Do not adopt MTP as-published without further cryptanalysis and redesign.**[^10]  
5. **Do not depend on human-solved or admin-solved escalation flows.** They are unsuitable for a store-and-forward network protocol.  
6. **Do not depend on VDFs for the first shipping sender-cost control.**[^19]

### 6.4 Best current research path

The whitepaper’s most defensible final proposal is:

#### Short-term prototype recommendation
Prototype **Equihash-like asymmetric memory-hard proofs** as the default VAMP sender-cost family, because the design already provides:

- cheap verification,
- short proofs,
- explicit algorithm binding,
- steep time-space tradeoffs,
- and a good fit for non-interactive issuance.[^1]

#### Longer-term research recommendation
Investigate an **Argon2-derived asymmetric proof** family that preserves:

- Argon2’s standardization and mature memory-hard core,
- receiver-cheap verification,
- and strong resistance to the sort of partial-verification attacks demonstrated against MTP.[^3][^4][^10]

That may ultimately be a better long-term VAMP family than Equihash, but the current published evidence is not strong enough to recommend any existing Argon2-wrapper construction as a safe drop-in standard.

## 7. Final conclusion

The available literature leads to a clear answer.

If VAMP wants a sender-cost primitive that matches its actual threat model and operational constraints, it should prefer a family that is:

- **memory-hard for the sender**,  
- **cheap for the receiver to verify**,  
- **bindable to sender/recipient/time**,  
- **usable non-interactively by MTAs**,  
- and **compatible with automated policy adjustment without requiring human intervention**.

Among currently published families, that points most strongly to an **asymmetric memory-hard PoW family**, with **Equihash-like designs** as the best currently available prototype target.[^1]

The literature also supports the caution that must accompany that recommendation: **proof-of-work should be one layer in a hybrid, reputation-aware anti-abuse system, not a universal tax on all mail**.[^11][^12] In the VAMP setting, that further implies that the proof mechanism should remain **protocol-native and automatic**. A design that depends on user- or admin-driven escalation is a poor fit for store-and-forward messaging, even if interactive puzzle research remains useful as background theory.[^13][^16]

## Footnotes

[^1]: Alex Biryukov and Dmitry Khovratovich, **“Equihash: Asymmetric Proof-of-Work Based on the Generalized Birthday Problem”**, NDSS 2016 / Ledger. The paper explicitly presents Equihash as an asymmetric, memory-hard PoW with instant verification, algorithm binding to prevent amortization, steep time-space tradeoffs, and a 120-byte proof in the reference implementation.  
    https://www.ndss-symposium.org/wp-content/uploads/2017/09/equihash-asymmetric-proof-of-work-based-generalized-birthday-problem.pdf

[^2]: RFC 9106, **“Argon2 Memory-Hard Function for Password Hashing and Proof-of-Work Applications”**. The RFC states that Argon2 is a memory-hard function for password hashing and proof-of-work applications.  
    https://www.rfc-editor.org/rfc/rfc9106.html

[^3]: RFC 9106, **“Argon2 Memory-Hard Function for Password Hashing and Proof-of-Work Applications”**. The RFC explains that Argon2d uses data-dependent memory access and is suitable for proof-of-work applications when side-channel timing attacks are not a concern, Argon2i uses data-independent access, and Argon2id must be supported by implementations of the RFC.  
    https://www.rfc-editor.org/rfc/rfc9106.html

[^4]: Alex Biryukov, Daniel Dinu, and Dmitry Khovratovich, **“Argon2: New Generation of Memory-Hard Functions for Password Hashing and Other Applications”**. The paper states that Argon2 imposes prohibitive time-memory and computation-memory tradeoffs on memory-saving users and aims to provide ASIC- and botnet-resistance through aggressive memory filling.  
    https://orbilu.uni.lu/bitstream/10993/31652/1/Argon2ESP.pdf

[^5]: RFC 7914, **“The scrypt Password-Based Key Derivation Function”**. scrypt is standardized as a memory-hard KDF intended to add protection against custom hardware attacks.  
    https://www.rfc-editor.org/rfc/rfc7914

[^6]: Colin Percival, **“Stronger Key Derivation Via Sequential Memory-Hard Functions”** (BSDCan 2009). Percival defines sequential memory-hard functions and motivates them as a defense against hardware parallelism.  
    https://www.tarsnap.com/scrypt/scrypt.pdf

[^7]: **Zcash Mining Guide**, Electric Coin Company documentation. Zcash’s current documentation says that given current network difficulty, ASICs must be used to mine Zcash, and notes that after the Antminer Z9 mini, Equihash ASIC deployment drove roughly 10× growth in network difficulty.  
    https://zcash.readthedocs.io/en/latest/rtd_pages/zcash_mining_guide.html

[^8]: **Zcash Foundation**, *The Zcash Foundation’s Role in the Zcash ASIC Resistance Debate* (May 8, 2018). The Foundation explicitly notes the emergence of Equihash-focused ASICs and treats ASIC resistance as an active research issue rather than a solved property.  
    https://zfnd.org/the-zcash-foundations-role-in-the-zcash-asic-resistance-debate/

[^9]: Alex Biryukov and Dmitry Khovratovich, **“Egalitarian Computing (MTP 1.2)”**. The revised paper presents MTP as a memory-hard proof-of-work with fast verification and short proofs, based on an Argon2-derived memory image plus Merkle proofs.  
    https://arxiv.org/pdf/1606.03588.pdf

[^10]: Itai Dinur and Niv Nadler, **“Time-Memory Tradeoff Attacks on the MTP Proof-of-Work Scheme?”**. The paper presents a practical attack on the original MTP/Argon2d construction, sharply reducing the memory required for malicious proof generation relative to the designers’ claims.  
    https://eprint.iacr.org/2017/497.pdf

[^11]: Ben Laurie and Richard Clayton, **“‘Proof-of-Work’ Proves Not to Work”** (2004). The paper concludes that a universal PoW system cannot effectively discourage spammers without unacceptable impact on a significant proportion of legitimate senders, and that viable schemes would require extra complexity to excuse legitimate senders from part of the burden.  
    https://sites.cs.ucsb.edu/~rich/class/cs293b-cloud/papers/laurie-proofwork2.pdf

[^12]: Debin Liu and L. Jean Camp, **“Proof of Work can Work”**. The paper argues that PoW can be workable when combined with reputation systems rather than applied as a uniform cost to all senders.  
    https://sites.cs.ucsb.edu/~rich/class/cs293b-cloud/papers/lui-pow.pdf

[^13]: Ari Juels and John Brainard, **“Client Puzzles: A Cryptographic Defense Against Connection Depletion Attacks”** (NDSS 1999). The work shows how interactive puzzles provide cheap verification, adjustable hardness, and stateless challenge handling under attack.  
    https://www.ndss-symposium.org/wp-content/uploads/2017/09/Client-Puzzles-A-Cryptographic-Defense-Against-Connection-Depletion-Attacks.pdf

[^14]: Because VAMP is explicitly scoped here as a store-and-forward network protocol with MTA-executed work and no human-in-the-loop escalation, any challenge path that requires end-user or admin action is outside the design envelope by construction. This is a protocol-design constraint, not an external empirical claim.

[^15]: Cynthia Dwork, Andrew Goldberg, and Moni Naor, **“On Memory-Bound Functions for Fighting Spam”** (CRYPTO 2003). The paper formalizes anti-spam pricing functions that require many sender-side memory accesses while allowing much cheaper verification, including constructions with no receiver memory accesses. It also stresses non-amortization and low verification cost as design requirements.  
    https://www.microsoft.com/en-us/research/wp-content/uploads/2003/08/crypto03.pdf

[^16]: Adam Back, **“Hashcash – A Denial of Service Counter-Measure”** (2002). Back describes Hashcash as a non-interactive, publicly auditable, trapdoor-free cost function for email and other unmetered resources, and discusses both interactive and non-interactive variants, replay prevention, precomputation, variance, and dynamic throttling.  
    https://sites.cs.ucsb.edu/~rich/class/old.cs290/papers/hascash2.pdf

[^17]: Cynthia Dwork and Moni Naor, **“Pricing via Processing or Combatting Junk Mail”** (CRYPTO ’92). This is the foundational paper introducing computational pricing to deter junk mail and other resource abuse.  
    https://web.cs.dal.ca/~abrodsky/7301/readings/DwNa93.pdf

[^18]: Martín Abadi, Mike Burrows, Mark Manasse, and Ted Wobber, **“Moderately Hard, Memory-Bound Functions”**. The paper argues that memory-bound functions can be more equitable across hardware classes than CPU-bound ones because memory latency varies less dramatically across platforms than CPU speed.  
    https://users.soe.ucsc.edu/~abadi/Papers/memory-longer-acm.pdf

[^19]: Dan Boneh, Joseph Bonneau, Benedikt Bünz, and Ben Fisch, **“Verifiable Delay Functions”** (CRYPTO 2018). The paper formalizes VDFs as functions requiring sequential evaluation with efficient verification, which makes them excellent delay primitives but not necessarily the best fit for MTA throughput-oriented anti-spam work.  
    https://link.springer.com/content/pdf/10.1007/978-3-319-96884-1_25.pdf