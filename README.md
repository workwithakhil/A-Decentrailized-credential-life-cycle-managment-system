# Decentralized Identity Verification System

Blockchain-based credential verification where the holder keeps their documents
and verifiers receive only proofs.

**Status:** contracts complete and tested (**37 passing**), frontend complete,
evaluation harness producing measured results, ZK commitment scheme working with
real Poseidon; the Groth16 trusted setup is the one remaining step.

This prototype is built specifically to close limitations identified in three
base papers. See **GAP_CLOSURE.md** for the traceability matrix.

---

## What this repository contains

```
contracts/                  Solidity smart contracts
  DIDRegistry.sol           self-owned identifiers (M1)
  IssuerRegistry.sol        which institutions are trusted
  CredentialRegistry.sol    credential anchoring, expiry, revocation (M2, M6)
  VerificationRegistry.sol  presentation checking (M5)
  PredicateVerifier.sol     zero-knowledge age proof (M4)
  PairwiseDIDRegistry.sol   per-verifier identities, reduces correlation
  mocks/                    test doubles — never deploy these

circuits/AgeAbove18.circom  the ZK circuit
lib/credential.js           W3C VC construction, hashing, signing
lib/zk.js                   Poseidon age commitments and proof generation
scripts/deploy.js           deployment
scripts/demo.js             end-to-end demo + gas benchmark
scripts/evaluate.js         50-run evaluation + gap closure evidence
scripts/export-abis.js      copies ABIs to the frontend
test/                       37 tests covering all five objectives
GAP_CLOSURE.md              which paper limitation each file closes

frontend/                   React + Vite dApp (M3)
  src/components/IssuerPortal.jsx
  src/components/HolderWallet.jsx    frosted-claim selective disclosure
  src/components/VerifierApp.jsx
  src/components/GapLedger.jsx       the 12 gaps, scored honestly
  src/styles.css                     glass & pastel design system
  src/lib/                  contracts, credentials, encryption, storage
```

---

## Quick start (15 minutes)

### 1. Install

```bash
npm install
```

Node.js 18 or newer. Check with `node --version`.

### 2. Run the tests

```bash
npx hardhat test
```

You should see **37 passing**. If they pass, your contracts work — this is the
single fastest way to prove the project is real to your guide.

### 3. See the whole story in your terminal

```bash
npx hardhat run scripts/demo.js
```

This deploys everything to a temporary chain, registers a university, issues a
credential to a student, verifies it at two different services, revokes it, and
proves the revoked credential is rejected. It prints the gas figures your O5
objective needs.

### 4. Deploy to a local chain

Terminal 1:
```bash
npx hardhat node
```

Terminal 2:
```bash
npx hardhat run scripts/deploy.js --network localhost
npm run export-abis
```

### 5. Run the dApp

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Import one of the Hardhat test private keys into
MetaMask and add the network `http://127.0.0.1:8545`, chain ID `31337`.

---

## Deploying to Polygon Amoy testnet

1. Create `.env` in the project root:

```
PRIVATE_KEY=your_test_wallet_private_key_without_0x
AMOY_RPC_URL=https://rpc-amoy.polygon.technology
POLYGONSCAN_API_KEY=optional_for_verification
```

**Use a throwaway wallet.** Never put a private key holding real funds in a
file, and make sure `.env` is in `.gitignore` (it already is).

2. Get free test POL from the Polygon faucet.

3. Deploy:

```bash
npx hardhat run scripts/deploy.js --network amoy
```

4. Copy the printed addresses — they are written to `deployments/amoy.json` and
   `frontend/src/abis/addresses.json` automatically.

---

## The demo you will give at the review

Rehearse this until it takes under four minutes.

| Step | What you do | What to say |
|------|-------------|-------------|
| 1 | Student connects wallet, registers DID | "No name was submitted. Only a public key." |
| 2 | Issuer portal: fill in details, issue | "Six claims. Watch what reaches the chain." |
| 3 | Open the block explorer on that transaction | "A hash. No name, no roll number, no date of birth." |
| 4 | Wallet: open credential, tick one claim, sign | "The verifier asked one question, so it gets one answer." |
| 5 | Verifier: paste, verify | "Access granted. Gas and latency shown here." |
| 6 | Second verifier, same credential | "Issued once, reused. No re-verification." |
| 7 | Issuer revokes, verifier tries again | "Rejected immediately." |

Have a backup: run `scripts/demo.js` and screen-record it. If campus wifi fails
during the review, play the recording.

---

## Zero-knowledge setup (do this last)

The circuit is written but needs a trusted setup ceremony. See
`circuits/README.md`. Budget half a day. Everything else works without it — do
not let the ZK layer block the rest of the project.

---

## Known limitations (state these before the panel finds them)

1. **Issuer trust is bootstrapped by a contract owner.** Deciding that address
   0xABC really is "State University" is a governance problem this project does
   not solve.
2. **No initial identity proofing.** Someone must confirm in person, once, that
   you are who you claim. Out of scope.
3. **No wallet key recovery.** Lose the private key, lose the credentials. The
   DIDRegistry supports controller rotation, which is a foundation for social
   recovery, but recovery itself is not implemented.
4. **Simplified JSON canonicalisation.** We use sorted-key JSON rather than
   full JSON-LD URDNA2015 canonicalisation. Both parties must use our
   implementation for hashes to match.
5. **Passphrase-based encryption.** Production would derive the key from the
   wallet key via ECIES. PBKDF2 with a shared passphrase is used here because
   it is easier to demonstrate.
6. **Testnet only.** No mainnet deployment, no formal audit.

Every one of these is a legitimate scope decision for a student project. Saying
them out loud is much stronger than being caught by them.

---

## Measured results (local chain, 50 runs)

| Operation | Gas (mean) | Latency (mean) |
|-----------|-----------|----------------|
| Credential issuance | 172,308 | 4.5 ms |
| Verification | 67,004 | 8.1 ms |
| Read-only pre-check | 0 | 2.8 ms |
| Revocation | 31,261 | — |

**Privacy:** 1 of 6 claims disclosed (16.7% ratio), 65.8% payload reduction,
**zero** plaintext claims on-chain.
**Correctness:** 100% rejection of revoked credentials over 20 trials.

Reproduce with `npm run evaluate`, or `npm run evaluate:amoy` for real testnet
figures. Results are written to `results/evaluation-<network>.json`.

---

## Team split

| Member | Owns | Files |
|--------|------|-------|
| 1 | Smart contracts | `contracts/`, `test/` |
| 2 | Frontend and wallet | `frontend/src/components/`, `frontend/src/lib/contracts.js` |
| 3 | Cryptography and ZK | `circuits/`, `contracts/PredicateVerifier.sol`, `frontend/src/lib/crypto.js` |
| 4 | Integration and testing | `scripts/`, `frontend/src/lib/storage.js`, benchmarking |

Everyone should be able to explain every file. The panel will ask.


---

## Interface design

The frontend is built on a single idea: **a credential is a frosted pane of
glass.** Claims you have not chosen to share stay blurred; ticking one clears
it. The material explains the concept, so nobody has to read a paragraph about
selective disclosure to understand what is happening.

**Palette** — pastel field of periwinkle, blush, sage, butter and mist, blurred
into a soft background so the glass has something to refract. Ink is a deep
plum (#34304A); iris (#7A6BAE) is the only saturated colour, used for actions.

**Type** — Instrument Serif for display (italic for emphasis), Plus Jakarta
Sans for body, JetBrains Mono for hashes and addresses.

**Glass** — `backdrop-filter: blur(22px) saturate(160%)` over a 55% white pane,
a 1px light border, and a soft violet-tinted shadow. A hairline highlight along
the top edge of each credential card catches the light.

**Quality floor** — responsive to 380px, visible keyboard focus on every
control, and all animation disabled under `prefers-reduced-motion`.

The fourth tab, **Ledger**, lists all twelve gaps drawn from the three base
papers with their status and the file that addresses each one. Six closed,
two partial, two open.
