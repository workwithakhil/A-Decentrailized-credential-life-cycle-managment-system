const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const SCHEMA = ethers.keccak256(ethers.toUtf8Bytes("StudentCredential"));
const COMMITMENT = 123456789n; // stands in for Poseidon(dob, salt)
const EMPTY_A = [0, 0];
const EMPTY_B = [[0, 0], [0, 0]];
const EMPTY_C = [0, 0];

describe("O4 — Zero-knowledge predicate", function () {
  let issuerRegistry, credentialRegistry, predicateVerifier, mockZk;
  let admin, university, student, bar, attacker, credId;

  beforeEach(async function () {
    [admin, university, student, bar, attacker] = await ethers.getSigners();

    issuerRegistry = await (await ethers.getContractFactory("IssuerRegistry")).deploy();
    credentialRegistry = await (
      await ethers.getContractFactory("CredentialRegistry")
    ).deploy(await issuerRegistry.getAddress());
    mockZk = await (await ethers.getContractFactory("MockGroth16Verifier")).deploy();
    predicateVerifier = await (
      await ethers.getContractFactory("PredicateVerifier")
    ).deploy(
      await mockZk.getAddress(),
      await credentialRegistry.getAddress(),
      await issuerRegistry.getAddress()
    );

    await issuerRegistry.registerIssuer(university.address, "State University");
    credId = ethers.keccak256(ethers.toUtf8Bytes("age-cred-1"));
    await credentialRegistry
      .connect(university)
      .issueCredential(credId, student.address, SCHEMA, 0, "ipfs://x");
  });

  async function prove(signer, commitment, tsOffset = 0) {
    const now = (await time.latest()) + tsOffset;
    return predicateVerifier
      .connect(signer)
      .proveAgeAbove18(credId, EMPTY_A, EMPTY_B, EMPTY_C, [now, commitment]);
  }

  it("only the issuer can bind an age commitment", async function () {
    await expect(
      predicateVerifier.connect(attacker).bindCommitment(credId, COMMITMENT)
    ).to.be.revertedWithCustomError(predicateVerifier, "NotCredentialIssuer");
  });

  it("accepts a valid proof and never sees the date of birth", async function () {
    await predicateVerifier.connect(university).bindCommitment(credId, COMMITMENT);
    await expect(prove(bar, COMMITMENT)).to.emit(predicateVerifier, "PredicateProved");
  });

  it("rejects a proof against someone else's commitment", async function () {
    await predicateVerifier.connect(university).bindCommitment(credId, COMMITMENT);
    await expect(prove(bar, 999n)).to.be.revertedWithCustomError(
      predicateVerifier,
      "CommitmentMismatch"
    );
  });

  it("rejects a forged timestamp far in the future", async function () {
    await predicateVerifier.connect(university).bindCommitment(credId, COMMITMENT);
    await expect(prove(bar, COMMITMENT, 3600)).to.be.revertedWithCustomError(
      predicateVerifier,
      "StaleTimestamp"
    );
  });

  it("rejects an invalid ZK proof", async function () {
    await predicateVerifier.connect(university).bindCommitment(credId, COMMITMENT);
    await mockZk.setShouldAccept(false);
    await expect(prove(bar, COMMITMENT)).to.be.revertedWithCustomError(
      predicateVerifier,
      "InvalidProof"
    );
  });

  it("rejects the predicate once the credential is revoked", async function () {
    await predicateVerifier.connect(university).bindCommitment(credId, COMMITMENT);
    await credentialRegistry.connect(university).revokeCredential(credId);
    await expect(prove(bar, COMMITMENT)).to.be.revertedWithCustomError(
      predicateVerifier,
      "CredentialNotValid"
    );
  });
});
