/**
 * zk.js — age-commitment helpers.
 *
 * The commitment scheme here is REAL (circomlibjs Poseidon), not a placeholder.
 * Only the Groth16 proof itself requires the trusted setup described in
 * circuits/README.md.
 *
 * Flow:
 *   1. Issuer picks a random salt and computes  C = Poseidon(dobTimestamp, salt)
 *   2. C goes inside the signed credential AND is bound on-chain via
 *      PredicateVerifier.bindCommitment()
 *   3. Holder later proves, in zero knowledge, that they know (dob, salt) such
 *      that Poseidon(dob, salt) == C  AND  now - dob >= 18 years
 *
 * The salt is what makes this safe. Without it there are only ~40,000 plausible
 * birth dates, so an attacker could hash them all and match the commitment.
 */

const crypto = require("crypto");

const AGE_18_SECONDS = 568036800; // 18 * 365.25 * 24 * 60 * 60

let _poseidon = null;
async function poseidon() {
  if (!_poseidon) {
    const { buildPoseidon } = require("circomlibjs");
    _poseidon = await buildPoseidon();
  }
  return _poseidon;
}

/** Cryptographically random salt, reduced into the BN254 scalar field. */
function randomSalt() {
  const FIELD =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  return BigInt("0x" + crypto.randomBytes(31).toString("hex")) % FIELD;
}

/** Date string 'YYYY-MM-DD' -> unix seconds. */
function toTimestamp(dateString) {
  return Math.floor(new Date(dateString + "T00:00:00Z").getTime() / 1000);
}

/**
 * Issuer side: build the commitment to embed in the credential.
 * @returns {{commitment: bigint, salt: bigint, birthTimestamp: number}}
 */
async function makeAgeCommitment(dateOfBirth) {
  const p = await poseidon();
  const birthTimestamp = toTimestamp(dateOfBirth);
  const salt = randomSalt();
  const h = p([BigInt(birthTimestamp), salt]);
  return {
    commitment: p.F.toObject(h),
    salt,
    birthTimestamp,
  };
}

/** Recompute a commitment to check it matches (used in tests and by the wallet). */
async function recomputeCommitment(birthTimestamp, salt) {
  const p = await poseidon();
  return p.F.toObject(p([BigInt(birthTimestamp), BigInt(salt)]));
}

/**
 * Plaintext predicate evaluation. This is what the ZK circuit enforces —
 * useful for testing the logic before the circuit is compiled.
 */
function satisfiesAgeAbove18(birthTimestamp, currentTimestamp) {
  return currentTimestamp - birthTimestamp >= AGE_18_SECONDS;
}

/**
 * Generate a real Groth16 proof. Requires the artifacts produced by
 * circuits/README.md — until then this throws a clear error rather than
 * pretending to work.
 */
async function generateAgeProof({
  birthTimestamp,
  salt,
  currentTimestamp,
  commitment,
  wasmPath = "circuits/AgeAbove18_js/AgeAbove18.wasm",
  zkeyPath = "circuits/age_final.zkey",
}) {
  const fs = require("fs");
  if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
    throw new Error(
      "ZK artifacts not found. Run the trusted setup in circuits/README.md first.\n" +
        `Looked for: ${wasmPath} and ${zkeyPath}`
    );
  }
  const snarkjs = require("snarkjs");
  const started = Date.now();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    {
      birthTimestamp: birthTimestamp.toString(),
      salt: salt.toString(),
      currentTimestamp: currentTimestamp.toString(),
      commitment: commitment.toString(),
    },
    wasmPath,
    zkeyPath
  );
  const provingMs = Date.now() - started;

  // Format for the Solidity verifier
  const calldata = await snarkjs.groth16.exportSolidityCallData(
    proof,
    publicSignals
  );
  const args = JSON.parse("[" + calldata + "]");

  return {
    a: args[0],
    b: args[1],
    c: args[2],
    publicSignals: args[3],
    provingMs,
  };
}

module.exports = {
  AGE_18_SECONDS,
  randomSalt,
  toTimestamp,
  makeAgeCommitment,
  recomputeCommitment,
  satisfiesAgeAbove18,
  generateAgeProof,
};
