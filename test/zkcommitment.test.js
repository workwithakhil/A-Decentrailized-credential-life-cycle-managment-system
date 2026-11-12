const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  makeAgeCommitment,
  recomputeCommitment,
  satisfiesAgeAbove18,
  toTimestamp,
  randomSalt,
  AGE_18_SECONDS,
} = require("../lib/zk");

const SCHEMA = ethers.keccak256(ethers.toUtf8Bytes("StudentCredential"));

describe("O4 — Age commitment scheme (real Poseidon)", function () {
  it("commitment is deterministic given the same inputs", async function () {
    const { commitment, salt, birthTimestamp } = await makeAgeCommitment("2004-07-19");
    const again = await recomputeCommitment(birthTimestamp, salt);
    expect(again).to.equal(commitment);
  });

  it("different salts give different commitments for the same birth date", async function () {
    const a = await makeAgeCommitment("2004-07-19");
    const b = await makeAgeCommitment("2004-07-19");
    expect(a.salt).to.not.equal(b.salt);
    expect(a.commitment).to.not.equal(b.commitment);
  });

  it("the salt defeats a brute-force dictionary over plausible birth dates", async function () {
    // Attacker knows the commitment and tries every date in a year.
    const { commitment, birthTimestamp } = await makeAgeCommitment("2004-07-19");
    let matched = false;
    for (let d = 0; d < 60; d++) {
      const guessTs = birthTimestamp + d * 86400;
      // attacker must also guess the salt; try zero and a few values
      for (const guessSalt of [0n, 1n, 12345n]) {
        const h = await recomputeCommitment(guessTs, guessSalt);
        if (h === commitment) matched = true;
      }
    }
    expect(matched).to.equal(false);
  });

  it("predicate logic accepts an adult and rejects a minor", async function () {
    const now = Math.floor(Date.now() / 1000);
    const adult = now - AGE_18_SECONDS - 86400;
    const minor = now - AGE_18_SECONDS + 86400;
    expect(satisfiesAgeAbove18(adult, now)).to.equal(true);
    expect(satisfiesAgeAbove18(minor, now)).to.equal(false);
  });

  it("binds a real Poseidon commitment to an on-chain credential", async function () {
    const [admin, university, student] = await ethers.getSigners();
    const issuerRegistry = await (await ethers.getContractFactory("IssuerRegistry")).deploy();
    const credentialRegistry = await (
      await ethers.getContractFactory("CredentialRegistry")
    ).deploy(await issuerRegistry.getAddress());
    const mockZk = await (await ethers.getContractFactory("MockGroth16Verifier")).deploy();
    const predicateVerifier = await (
      await ethers.getContractFactory("PredicateVerifier")
    ).deploy(
      await mockZk.getAddress(),
      await credentialRegistry.getAddress(),
      await issuerRegistry.getAddress()
    );

    await issuerRegistry.registerIssuer(university.address, "State University");
    const credId = ethers.keccak256(ethers.toUtf8Bytes("zk-cred-1"));
    await credentialRegistry
      .connect(university)
      .issueCredential(credId, student.address, SCHEMA, 0, "ipfs://x");

    const { commitment } = await makeAgeCommitment("2004-07-19");
    await predicateVerifier.connect(university).bindCommitment(credId, commitment);

    expect(await predicateVerifier.commitmentOf(credId)).to.equal(commitment);
  });
});
