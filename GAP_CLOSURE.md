# Gap Closure Traceability

How each limitation in the three base papers maps to a specific artefact in this
repository. Bring this to your review — when a panel member asks "where exactly
did you implement that?", point at a file and a test.

---

## Base papers

| Ref | Paper |
|-----|-------|
| **P1** | B. Khaund, "Decentralized Identity Using Blockchain," *J. Computer Science and Technology Studies*, 7(6):858–866, 2025 |
| **P2** | W. Xu et al., "Blockchain-based Verifiable Decentralized Identity for Intelligent Flexible Manufacturing," *IEEE IoT Journal*, 12(16):32366–32378, 2025 |
| **P3** | Y. Liu et al., "Fully Anonymous Decentralized Identity Supporting Threshold Traceability," *WWW '25*, pp. 3628–3638 |

---

## CLOSED

### P1 — No implementation, no measurement
*Where stated:* the paper is descriptive throughout; §11 Conclusions contains no experimental result.

| Artefact | What it shows |
|---|---|
| `contracts/` | Five working Solidity contracts |
| `test/` | 37 passing tests |
| `scripts/evaluate.js` | 50-run benchmark producing gas, latency and rejection figures |
| `results/evaluation-*.json` | Machine-readable measurements |

**Measured (local chain):** issuance 172,308 gas · verification 67,004 gas · revocation 31,261 gas · verification latency 8.08 ms mean.

---

### P2 — Permissioned ledger reintroduces a trusted operator
*Where stated:* §V-A, deployed on Hyperledger Fabric with Docker-deployed peer nodes.

| Artefact | What it shows |
|---|---|
| `hardhat.config.js` → `networks.amoy` | Public permissionless EVM target |
| `contracts/IssuerRegistry.sol` | No validator allow-list; anyone may run a node |

**Caveat to state:** we still have a contract owner who accredits issuers. Centralisation moved from consensus to accreditation, it did not vanish.

---

### P2 — No credential expiry or revocation
*Where stated:* absent from §IV entirely; the paper verifies data integrity only.

| Artefact | What it shows |
|---|---|
| `contracts/CredentialRegistry.sol` → `revokeCredential()`, `statusOf()` | Four-state lifecycle: Unknown / Valid / Expired / Revoked |
| `contracts/VerificationRegistry.sol` → `verifyPresentation()` | Status checked *before* access is granted |
| `test/lifecycle.test.js` → "O5 — Revocation and expiry" | 4 tests |

**Measured:** 100% rejection of revoked credentials across 20 trials.

---

### P3 — Committee of distributed authorities required
*Where stated:* §3.2 System Model; anonymity holds only while fewer than *t* committee members collude.

| Artefact | What it shows |
|---|---|
| `contracts/IssuerRegistry.sol` | One registered issuer per credential, no threshold assumption |
| `contracts/VerificationRegistry.sol` | Verification needs no committee interaction |

**Trade-off:** simpler deployment, but we lose their anonymity-to-authority property. See NOT CLOSED below.

---

### P3 — No credential lifecycle
*Where stated:* §4 defines four phases — setup, registration, presentation, tracing. Issuance is explicitly out of scope; expiry and revocation never appear.

| Artefact | What it shows |
|---|---|
| `contracts/CredentialRegistry.sol` → `issueCredential()` | Issuance implemented, not assumed |
| `lib/credential.js` | W3C VC 2.0 construction and signing |
| `frontend/src/components/IssuerPortal.jsx` | Working issuer interface |

---

### P2 — Custom `did:CPW3` method, no interoperability
*Where stated:* §IV-A defines a bespoke DID method.

| Artefact | What it shows |
|---|---|
| `lib/credential.js` → `toDid()`, `buildCredential()` | `did:ethr` and W3C VC Data Model 2.0 |
| `contracts/DIDRegistry.sol` | ERC-1056 compatible structure |

**Caveat:** we use sorted-key JSON rather than full JSON-LD URDNA2015 canonicalisation. Conformance is partial, and we say so.

---

## PARTIAL

### P2 — Privacy named but never implemented
*Where stated:* §IV-F lists ZKPs, off-chain storage and group signatures as "incorporated." No circuit, no experiment, no measurement appears anywhere in §V.

| Artefact | Status |
|---|---|
| `frontend/src/lib/crypto.js` | **Done** — AES-256-GCM encryption of payloads |
| `frontend/src/lib/storage.js` | **Done** — off-chain IPFS storage, ciphertext only |
| `lib/credential.js` → `selectivelyDisclose()` | **Done** — measured at 16.7% disclosure ratio, 65.8% payload reduction |
| `circuits/AgeAbove18.circom` | **Written**, not yet compiled |
| `lib/zk.js` → `makeAgeCommitment()` | **Done** — real Poseidon commitments, 5 tests passing |
| `contracts/PredicateVerifier.sol` | **Done**, but currently tested against `MockGroth16Verifier` |
| Groth16 trusted setup | **Pending** — see `circuits/README.md` |

**Say this exactly:** "Selective disclosure is implemented and measured. The zero-knowledge circuit and commitment scheme are written and tested; the trusted setup that produces the real verifier is Phase 5 work."

---

### P3 — Link analysis across services
*Where stated:* §1, *Loss of full anonymity* — fixed identifiers allow correlation across verifiers.

| Artefact | What it shows |
|---|---|
| `contracts/PairwiseDIDRegistry.sol` | A distinct identity address per verifier |
| `test/pairwise.test.js` | 5 tests, including one that documents the limitation |

**Measured:** verifier A and verifier B see unrelated addresses; correlation by address alone fails.

**What remains open:** `bindPairwise()` writes the root → pairwise mapping on-chain, so a chain analyst can still follow it. Full unlinkability needs P3's DAC construction with one-time show tokens. Our test `"HONEST LIMIT: the root-to-pairwise link is publicly readable on-chain"` asserts this openly rather than hiding it.

---

## NOT CLOSED

### P3 — Anonymity to the issuing authority
Their committee cannot learn the user's real identity even during registration. Our issuer knows precisely who it issues to. This is inherent to the single-issuer trust model we chose, and closing it would require adopting the committee architecture we deliberately avoided.

### P2 — Storage and query scalability
Their Tier Skip Chain reduces query time from 0.98 ms to below 0.1 ms at 160k records. We do not improve on this axis and make no claim to.

### P1, P2, P3 — Physical-world identity proofing
All three defer it. P3 §4.2 calls it "orthogonal to our work." We do the same, and say so on the limitations slide.

---

## Summary for the panel

| Gap | Status |
|---|---|
| P1 no implementation | CLOSED |
| P2 permissioned ledger | CLOSED |
| P2 no revocation | CLOSED |
| P2 custom DID method | CLOSED (partial canonicalisation) |
| P2 privacy unimplemented | PARTIAL |
| P3 no lifecycle | CLOSED |
| P3 committee dependency | CLOSED |
| P3 link analysis | PARTIAL |
| P3 anonymity to authority | NOT CLOSED |
| P2 query scalability | NOT ATTEMPTED |

Six closed, two partial, two open — and naming the last four is what makes the first six credible.
