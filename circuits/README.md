# Zero-knowledge setup

The circuit proves "I am over 18" without revealing a date of birth.
Do this **after** the rest of the system works.

## Install the toolchain

```bash
# circom (Rust)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
git clone https://github.com/iden3/circom.git
cd circom && cargo build --release && cargo install --path circom

# snarkjs + circomlib
npm install -g snarkjs
npm install circomlib
```

## Compile

```bash
cd circuits
circom AgeAbove18.circom --r1cs --wasm --sym -l ../node_modules
```

Note the constraint count it prints — put that number in your report.

## Trusted setup (Groth16)

```bash
# Phase 1 — universal. Download an existing Powers of Tau file rather than
# generating one; powersOfTau28_hez_final_12.ptau is enough for this circuit.
wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_12.ptau

# Phase 2 — circuit specific
snarkjs groth16 setup AgeAbove18.r1cs powersOfTau28_hez_final_12.ptau age_0000.zkey
snarkjs zkey contribute age_0000.zkey age_final.zkey --name="team contribution" -v
snarkjs zkey export verificationkey age_final.zkey verification_key.json

# Generate the Solidity verifier
snarkjs zkey export solidityverifier age_final.zkey ../contracts/Groth16Verifier.sol
```

Then compile again and deploy `Groth16Verifier`, passing its address to
`PredicateVerifier`'s constructor.

## Generating a proof

```js
const snarkjs = require("snarkjs");
const { buildPoseidon } = require("circomlibjs");

const poseidon = await buildPoseidon();
const birthTimestamp = Math.floor(new Date("2004-07-19").getTime() / 1000);
const salt = 987654321n;                       // random, stored in the credential
const commitment = poseidon.F.toObject(poseidon([birthTimestamp, salt]));

const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  {
    birthTimestamp,
    salt,
    currentTimestamp: Math.floor(Date.now() / 1000),
    commitment,
  },
  "AgeAbove18_js/AgeAbove18.wasm",
  "age_final.zkey"
);

// Format for Solidity
const calldata = await snarkjs.groth16.exportSolidityCallData(proof, publicSignals);
```

## Understand before you present

- **Why the salt?** Without it, an attacker hashes every plausible birth date
  and matches the commitment. There are only ~40,000 candidates.
- **Why does the verifier supply `currentTimestamp`?** So the prover cannot
  claim it is 2099 and age themselves up. `PredicateVerifier` also rejects any
  timestamp more than 15 minutes from block time.
- **Why is the commitment bound on-chain?** So a student cannot prove 18+
  against somebody else's commitment.
- **What Groth16 gives you:** tiny proofs and cheap on-chain verification, at
  the cost of a per-circuit trusted setup. If the setup is compromised, false
  proofs become possible — that is the trade-off to name in your report.
