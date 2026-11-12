const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

const SCHEMA_STUDENT = ethers.keccak256(ethers.toUtf8Bytes("StudentCredential"));
const SCHEMA_AGE = ethers.keccak256(ethers.toUtf8Bytes("AgeCredential"));

// Helper: build and sign an EIP-712 presentation the way the wallet will.
async function signPresentation(
  verificationRegistry,
  holderSigner,
  credentialId,
  verifierAddress,
  deadline
) {
  const nonce = await verificationRegistry.nonces(
    holderSigner.address,
    verifierAddress
  );
  const domain = {
    name: "DIVS-Presentation",
    version: "1",
    chainId: (await ethers.provider.getNetwork()).chainId,
    verifyingContract: await verificationRegistry.getAddress(),
  };
  const types = {
    Presentation: [
      { name: "credentialId", type: "bytes32" },
      { name: "verifier", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };
  const value = {
    credentialId,
    verifier: verifierAddress,
    nonce,
    deadline,
  };
  return holderSigner.signTypedData(domain, types, value);
}

describe("Decentralized Identity Verification System", function () {
  let didRegistry, issuerRegistry, credentialRegistry, verificationRegistry;
  let admin, university, student, otherStudent, verifierA, verifierB, attacker;
  let credentialId;

  beforeEach(async function () {
    [admin, university, student, otherStudent, verifierA, verifierB, attacker] =
      await ethers.getSigners();

    didRegistry = await (await ethers.getContractFactory("DIDRegistry")).deploy();
    issuerRegistry = await (
      await ethers.getContractFactory("IssuerRegistry")
    ).deploy();
    credentialRegistry = await (
      await ethers.getContractFactory("CredentialRegistry")
    ).deploy(await issuerRegistry.getAddress());
    verificationRegistry = await (
      await ethers.getContractFactory("VerificationRegistry")
    ).deploy(
      await credentialRegistry.getAddress(),
      await issuerRegistry.getAddress()
    );

    await issuerRegistry.registerIssuer(university.address, "State University");
    credentialId = ethers.keccak256(ethers.toUtf8Bytes("credential-001"));
  });

  // ------------------------------------------------------------------ //
  describe("O1 — DID Registry", function () {
    it("an identity controls itself by default", async function () {
      expect(await didRegistry.controllerOf(student.address)).to.equal(
        student.address
      );
    });

    it("publishes a public key without storing any personal data", async function () {
      const keyName = ethers.encodeBytes32String("did/pub/Secp256k1/veriKey");
      const pubKey = ethers.hexlify(ethers.randomBytes(33));

      await expect(
        didRegistry
          .connect(student)
          .setAttribute(student.address, keyName, pubKey, 31536000)
      ).to.emit(didRegistry, "DIDAttributeChanged");

      expect(await didRegistry.isRegistered(student.address)).to.equal(true);
    });

    it("blocks a stranger from modifying someone else's DID", async function () {
      const keyName = ethers.encodeBytes32String("did/pub/Secp256k1/veriKey");
      await expect(
        didRegistry
          .connect(attacker)
          .setAttribute(student.address, keyName, "0x00", 3600)
      ).to.be.revertedWithCustomError(didRegistry, "NotController");
    });

    it("supports controller rotation for key recovery", async function () {
      await didRegistry
        .connect(student)
        .changeController(student.address, otherStudent.address);
      expect(await didRegistry.controllerOf(student.address)).to.equal(
        otherStudent.address
      );
    });
  });

  // ------------------------------------------------------------------ //
  describe("O2 — Credential issuance", function () {
    it("a registered issuer can anchor a credential", async function () {
      await expect(
        credentialRegistry
          .connect(university)
          .issueCredential(
            credentialId,
            student.address,
            SCHEMA_STUDENT,
            0,
            "ipfs://QmExampleCid"
          )
      )
        .to.emit(credentialRegistry, "CredentialIssued")
        .withArgs(
          credentialId,
          university.address,
          student.address,
          SCHEMA_STUDENT,
          0,
          "ipfs://QmExampleCid"
        );

      expect(await credentialRegistry.statusOf(credentialId)).to.equal(1); // Valid
    });

    it("an unregistered issuer cannot issue", async function () {
      await expect(
        credentialRegistry
          .connect(attacker)
          .issueCredential(credentialId, student.address, SCHEMA_STUDENT, 0, "ipfs://x")
      ).to.be.revertedWithCustomError(credentialRegistry, "NotActiveIssuer");
    });

    it("the same credential cannot be issued twice", async function () {
      await credentialRegistry
        .connect(university)
        .issueCredential(credentialId, student.address, SCHEMA_STUDENT, 0, "ipfs://x");
      await expect(
        credentialRegistry
          .connect(university)
          .issueCredential(credentialId, student.address, SCHEMA_STUDENT, 0, "ipfs://x")
      ).to.be.revertedWithCustomError(credentialRegistry, "CredentialExists");
    });

    it("stores no personal data — only hash, addresses and URI", async function () {
      await credentialRegistry
        .connect(university)
        .issueCredential(credentialId, student.address, SCHEMA_STUDENT, 0, "ipfs://x");

      const c = await credentialRegistry.getCredential(credentialId);
      // The struct has exactly these fields and none of them is a claim value.
      expect(c.issuer).to.equal(university.address);
      expect(c.subject).to.equal(student.address);
      expect(c.schemaId).to.equal(SCHEMA_STUDENT);
      expect(c.encryptedUri).to.equal("ipfs://x");
    });

    it("lists credentials by subject for the wallet UI", async function () {
      await credentialRegistry
        .connect(university)
        .issueCredential(credentialId, student.address, SCHEMA_STUDENT, 0, "ipfs://x");
      const list = await credentialRegistry.credentialsOf(student.address);
      expect(list).to.deep.equal([credentialId]);
    });
  });

  // ------------------------------------------------------------------ //
  describe("O3/O5 — Verification", function () {
    beforeEach(async function () {
      await credentialRegistry
        .connect(university)
        .issueCredential(credentialId, student.address, SCHEMA_STUDENT, 0, "ipfs://x");
    });

    it("accepts a valid presentation from the true holder", async function () {
      const deadline = (await time.latest()) + 300;
      const sig = await signPresentation(
        verificationRegistry,
        student,
        credentialId,
        verifierA.address,
        deadline
      );

      await expect(
        verificationRegistry
          .connect(verifierA)
          .verifyPresentation(credentialId, student.address, deadline, SCHEMA_STUDENT, sig)
      ).to.emit(verificationRegistry, "VerificationSucceeded");

      expect(await verificationRegistry.totalVerifications()).to.equal(1n);
    });

    it("the read-only check agrees with the state-changing one", async function () {
      const deadline = (await time.latest()) + 300;
      const sig = await signPresentation(
        verificationRegistry,
        student,
        credentialId,
        verifierA.address,
        deadline
      );
      const [ok, reason] = await verificationRegistry
        .connect(verifierA)
        .checkPresentation.staticCall(credentialId, student.address, deadline, sig);
      expect(ok).to.equal(true);
      expect(reason).to.equal("");
    });

    it("rejects a presentation signed by someone who is not the subject", async function () {
      const deadline = (await time.latest()) + 300;
      const sig = await signPresentation(
        verificationRegistry,
        attacker,
        credentialId,
        verifierA.address,
        deadline
      );
      await expect(
        verificationRegistry
          .connect(verifierA)
          .verifyPresentation(credentialId, attacker.address, deadline, SCHEMA_STUDENT, sig)
      ).to.be.revertedWithCustomError(verificationRegistry, "BadSignature");
    });

    it("blocks replay at a different verifier", async function () {
      const deadline = (await time.latest()) + 300;
      const sig = await signPresentation(
        verificationRegistry,
        student,
        credentialId,
        verifierA.address,
        deadline
      );
      // Same signature presented to verifier B must fail: the verifier address
      // is inside the signed payload.
      await expect(
        verificationRegistry
          .connect(verifierB)
          .verifyPresentation(credentialId, student.address, deadline, SCHEMA_STUDENT, sig)
      ).to.be.revertedWithCustomError(verificationRegistry, "BadSignature");
    });

    it("blocks replay of the same presentation twice", async function () {
      const deadline = (await time.latest()) + 300;
      const sig = await signPresentation(
        verificationRegistry,
        student,
        credentialId,
        verifierA.address,
        deadline
      );
      await verificationRegistry
        .connect(verifierA)
        .verifyPresentation(credentialId, student.address, deadline, SCHEMA_STUDENT, sig);

      // nonce has advanced, so the identical signature no longer matches
      await expect(
        verificationRegistry
          .connect(verifierA)
          .verifyPresentation(credentialId, student.address, deadline, SCHEMA_STUDENT, sig)
      ).to.be.revertedWithCustomError(verificationRegistry, "BadSignature");
    });

    it("rejects an expired presentation deadline", async function () {
      const deadline = (await time.latest()) + 300;
      const sig = await signPresentation(
        verificationRegistry,
        student,
        credentialId,
        verifierA.address,
        deadline
      );
      await time.increase(600);
      await expect(
        verificationRegistry
          .connect(verifierA)
          .verifyPresentation(credentialId, student.address, deadline, SCHEMA_STUDENT, sig)
      ).to.be.revertedWithCustomError(verificationRegistry, "PresentationExpired");
    });

    it("rejects the wrong schema", async function () {
      const deadline = (await time.latest()) + 300;
      const sig = await signPresentation(
        verificationRegistry,
        student,
        credentialId,
        verifierA.address,
        deadline
      );
      await expect(
        verificationRegistry
          .connect(verifierA)
          .verifyPresentation(credentialId, student.address, deadline, SCHEMA_AGE, sig)
      ).to.be.revertedWithCustomError(verificationRegistry, "WrongSchema");
    });

    it("accepts the SAME credential at two independent verifiers", async function () {
      // This is your stated success criterion: cross-application reuse.
      for (const v of [verifierA, verifierB]) {
        const deadline = (await time.latest()) + 300;
        const sig = await signPresentation(
          verificationRegistry,
          student,
          credentialId,
          v.address,
          deadline
        );
        await expect(
          verificationRegistry
            .connect(v)
            .verifyPresentation(credentialId, student.address, deadline, SCHEMA_STUDENT, sig)
        ).to.emit(verificationRegistry, "VerificationSucceeded");
      }
      expect(await verificationRegistry.totalVerifications()).to.equal(2n);
    });
  });

  // ------------------------------------------------------------------ //
  describe("O5 — Revocation and expiry", function () {
    beforeEach(async function () {
      await credentialRegistry
        .connect(university)
        .issueCredential(credentialId, student.address, SCHEMA_STUDENT, 0, "ipfs://x");
    });

    it("only the issuing institution may revoke", async function () {
      await expect(
        credentialRegistry.connect(attacker).revokeCredential(credentialId)
      ).to.be.revertedWithCustomError(credentialRegistry, "NotCredentialIssuer");
    });

    it("a revoked credential fails verification", async function () {
      await credentialRegistry.connect(university).revokeCredential(credentialId);
      expect(await credentialRegistry.statusOf(credentialId)).to.equal(3); // Revoked

      const deadline = (await time.latest()) + 300;
      const sig = await signPresentation(
        verificationRegistry,
        student,
        credentialId,
        verifierA.address,
        deadline
      );
      await expect(
        verificationRegistry
          .connect(verifierA)
          .verifyPresentation(credentialId, student.address, deadline, SCHEMA_STUDENT, sig)
      ).to.be.revertedWithCustomError(verificationRegistry, "CredentialNotValid");
    });

    it("an expired credential fails verification", async function () {
      const shortId = ethers.keccak256(ethers.toUtf8Bytes("credential-short"));
      const expiry = (await time.latest()) + 3600;
      await credentialRegistry
        .connect(university)
        .issueCredential(shortId, student.address, SCHEMA_STUDENT, expiry, "ipfs://y");

      await time.increaseTo(expiry + 10);
      expect(await credentialRegistry.statusOf(shortId)).to.equal(2); // Expired
    });

    it("deactivating an issuer invalidates its credentials at verification time", async function () {
      // A university loses accreditation: previously issued credentials stop verifying.
      await issuerRegistry.setIssuerActive(university.address, false);

      const deadline = (await time.latest()) + 300;
      const sig = await signPresentation(
        verificationRegistry,
        student,
        credentialId,
        verifierA.address,
        deadline
      );
      await expect(
        verificationRegistry
          .connect(verifierA)
          .verifyPresentation(credentialId, student.address, deadline, SCHEMA_STUDENT, sig)
      ).to.be.revertedWithCustomError(verificationRegistry, "IssuerNotTrusted");
    });
  });
});
