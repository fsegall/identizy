# Prompt — Pitch Deck Generator

Use this prompt with Claude, ChatGPT, or a presentation tool (Gamma, Beautiful.ai, etc.).

---

## Prompt

Create a 10-slide investor pitch deck for a B2B SaaS startup. Use the structure and content below exactly. Tone: clear, technical credibility without jargon, confident. Audience: seed-stage investors and enterprise buyers in healthcare and life sciences.

---

**Slide 1 — Cover**
Product name: Identizy
Tagline: "Verified Identity. Anonymous Data."
Subtitle: ZK-powered identity and consent infrastructure for regulated industries
Visual: abstract cryptographic pattern or lock/chain motif

---

**Slide 2 — The Problem**
Title: "Knowing Who the Patient Is Creates the Liability"

Three bullets:
- Clinical research needs confirmed eligibility, verifiable consent, and recurring access to health records — all three require knowing, at some point, who the patient is
- The moment identified data crosses an organization's perimeter, that organization becomes liable for it under HIPAA, GDPR, and LGPD — and the exposure lasts as long as the data is retained
- The current model collects identified records and de-identifies them internally. But something that was received can be exposed. Something that was held, even briefly, falls under breach and accountability obligations.

Bottom note: "The problem is structural, not procedural."

---

**Slide 3 — The Insight**
Title: "Move De-identification Upstream"

Two columns:
- LEFT (Today): Collect identified → de-identify internally → use anonymized. Risk: raw data entered the perimeter.
- RIGHT (With Identizy): De-identify at the source → only anonymized data enters the platform. Identity never crosses the perimeter.

Key line: "What never enters cannot be breached."

---

**Slide 4 — How It Works**
Title: "Consent Once. Retrieve Continuously."

Two stages, visually separated:

Stage 1 — Once (Identity & Consent):
Patient proves eligibility via Zero-Knowledge Proof. A long-lived credential is minted — bound to a pseudonymous identifier, the permitted data scope, and a revocation handle. Identity never reaches the research platform.

Stage 2 — Ongoing (Anonymized Delivery):
The service layer retrieves Electronic Health Records from the source, strips every identifying field before the record leaves its boundary, and delivers de-identified data tagged with the patient's pseudonym. The patient does not need to act on each retrieval.

Bottom line: "Consent creates the key. Retrieval uses the key. Withdrawal destroys the key."

---

**Slide 5 — The Technology**
Title: "Built on Proven Cryptographic Primitives"

Three pillars:
1. Zero-Knowledge Proofs (Groth16 / BN254) — mathematical proof that a fact is true without revealing the underlying data. Computed in the user's browser; nothing sensitive leaves the device.
2. Blockchain Credentials (Stellar / Soroban) — credential minted as an on-chain soulbound token. Any authorized party can verify consent status with a single contract call — no Identizy API in the loop.
3. Pseudonymous Identity — the patient's blockchain wallet address is the persistent pseudonymous subject identifier, controlled exclusively by their private key. No service holds the mapping between identity and health data.

Note: "Verified on Stellar mainnet. Production-grade cryptography, not a prototype."

---

**Slide 6 — Compliance by Architecture**
Title: "HIPAA. GDPR. LGPD. Satisfied on Their Own Terms."

Three columns:
- HIPAA: Identified PHI never enters the covered entity's perimeter. De-identification happens at the source.
- GDPR: Data subject retains revocable, auditable control. Consent is a verifiable on-chain event with a timestamp and scope.
- LGPD: Purpose-limited consent, revocable at any time, with cryptographic proof of the consent event.

Bottom: "Compliance is a consequence of the architecture, not a policy layer on top of it."

---

**Slide 7 — Market Opportunity**
Title: "A $5B+ Problem in Clinical Data"

Key numbers (use real market data if available, otherwise use these as placeholders):
- Global clinical data management market: $1.3B+ (growing 13% YoY)
- Top CROs and pharma companies spend hundreds of millions annually on compliance and data de-identification
- GDPR fines in healthcare: €1.2B+ since 2018
- Target buyers: Contract Research Organizations (CROs), pharma sponsors, hospital networks, health data platforms (e.g. IQVIA, Medidata, Veeva)

Positioning: "We are Auth0 for clinical identity — infrastructure that compliance-sensitive organizations plug into, not rebuild."

---

**Slide 8 — Business Model**
Title: "SaaS Infrastructure — Pay Per Credential"

Revenue streams:
- Platform fee: monthly subscription per research study / organization
- Usage fee: per credential issued and per EHR retrieval authorized
- Enterprise: custom SLA, dedicated infrastructure, audit trail exports

Go-to-market:
- Phase 1: Clinical research (CROs, pharma sponsors)
- Phase 2: Any regulated domain requiring pseudonymous identity — insurance, financial services, government
- Distribution: direct enterprise sales + integration partnerships with EHR providers

---

**Slide 9 — Traction & Validation**
Title: "Production-Grade Infrastructure, Proven on Mainnet"

Milestones:
- ✅ ZK proof verified on Stellar mainnet (June 2026) — contract CBPG3KIS6NEGWANQFEKWKFYFENECUWG4KLJZ7KN25SCPKODHFO33MMTY
- ✅ End-to-end credential flow: browser proof generation → Freighter wallet → on-chain verification → credential issued
- ✅ Finalist / submission: Stellar Hacks Real-World ZK hackathon ($10,000 XLM prize pool)
- ✅ Open-source ZK credential module published on GitHub
- 🔜 Pilot conversations with [target CRO / health data platform]

---

**Slide 10 — Team & Ask**
Title: "Who We Are and What We Need"

Team:
- Felipe Segall — product & blockchain infrastructure (Identizy / Livre Solutions)
- Gustavo Weinschutz — healthcare data architecture & EHR integration
[Add photos, LinkedIn, relevant background]

The Ask:
- Raising: [amount] seed round
- Use of funds: EHR provider integrations, compliance certifications (HIPAA BAA, SOC 2), enterprise pilot program
- Looking for: investors with healthcare or deep-tech portfolio; strategic partners with CRO / pharma relationships

Closing line: "The cryptography is done. The market is ready. We are building the layer that makes patient data safe by design."

---

## Additional instructions for the AI

- Keep each slide to one key idea — no walls of text
- Use visual metaphors where possible (lock, chain, two-stage funnel)
- Emphasize that this is not a prototype: mainnet deployment is a credibility signal, use it
- Do not mention competitor names unless asked
- The tone should feel like "deep-tech founders who understand the compliance problem from the inside"
