/**
 * End-to-end demo + benchmark.
 *
 * Runs the exact five-step story you will show the panel, and prints the gas
 * and latency numbers your O5 objective requires.
 *
 *   npx hardhat run scripts/demo.js
 *   npx hardhat run scripts/demo.js --network amoy
 */
const { ethers, network } = require("hardhat");
const {
  buildCredential,
  credentialHash,
  schemaId,
  signCredential,
  recoverIssuer,
  selectivelyDisclose,
  toDid,
} = require("../lib/credential");

const line = (s = "") => console.log(s);
const rule = () => line("─".repeat(66));

async function main() {
  const [deployer, university, student, verifierA, verifierB] =
    await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const gas = {};

  rule();
  line("  DECENTRALIZED IDENTITY VERIFICATION SYSTEM — DEMO");
  line(`  network: ${network.name}   chainId: ${chainId}`);
  rule();

  // ---------------------------------------------------------------- deploy
  const didRegistry = await (
    await ethers.getContractFactory("DIDRegistry")
  ).deploy();
  const issuerRegistry = await (
    await ethers.getContractFactory("IssuerRegistry")
  ).deploy();
  const credentialRegistry = await (
    await ethers.getContractFactory("CredentialRegistry")
  ).deploy(await issuerRegistry.getAddress());
  const verificationRegistry = await (
    await ethers.getContractFactory("VerificationRegistry")
  ).deploy(
    await credentialRegistry.getAddress(),
    await issuerRegistry.getAddress()
  );
  await issuerRegistry.registerIssuer(university.address, "State University");

  // ------------------------------------------------- STEP 1: student DID
  line("\nSTEP 1  Student creates a self-owned identity");
  const keyName = ethers.encodeBytes32String("did/pub/Secp256k1/veriKey");
  const pubKey = ethers.hexlify(ethers.randomBytes(33));
  let tx = await didRegistry
    .connect(student)
    .setAttribute(student.address, keyName, pubKey, 31536000);
  let rc = await tx.wait();
  gas.didRegistration = rc.gasUsed;
  line(`        DID: ${toDid(student.address, chainId)}`);
  line(`        on-chain content: a public key. No name, no roll number.`);
  line(`        gas: ${rc.gasUsed}`);

  // ------------------------------------------- STEP 2: university issues
  line("\nSTEP 2  University issues a Student Credential");
  const credential = buildCredential({
    type: "StudentCredential",
    issuerAddress: university.address,
    subjectAddress: student.address,
    claims: {
      name: "Priya Sharma",
      rollNumber: "21CSE1043",
      programme: "B.Tech Computer Science",
      enrolmentStatus: "Active",
      dateOfBirth: "2004-07-19",
      graduationYear: 2027,
    },
    chainId,
    statusRegistry: await credentialRegistry.getAddress(),
  });
  const signed = await signCredential(credential, university);
  const credId = credentialHash(credential);

  line(`        claims held by the student:`);
  for (const [k, v] of Object.entries(credential.credentialSubject)) {
    if (k !== "id") line(`          ${k.padEnd(16)} ${v}`);
  }
  line(`        issuer signature recovers to: ${recoverIssuer(signed)}`);
  line(`        credentialId (this is ALL that goes on-chain):`);
  line(`          ${credId}`);

  // In the real system the encrypted payload is pinned to IPFS first and the
  // returned CID is what you pass here.
  const fakeCid = "ipfs://QmDemoEncryptedPayloadCid";
  tx = await credentialRegistry
    .connect(university)
    .issueCredential(
      credId,
      student.address,
      schemaId("StudentCredential"),
      0,
      fakeCid
    );
  rc = await tx.wait();
  gas.issuance = rc.gasUsed;
  line(`        gas: ${rc.gasUsed}`);

  // ------------------------------------------------ STEP 3: what is public
  line("\nSTEP 3  What an outside observer can read from the chain");
  const stored = await credentialRegistry.getCredential(credId);
  line(`        issuer     ${stored.issuer}`);
  line(`        subject    ${stored.subject}`);
  line(`        schemaId   ${stored.schemaId}`);
  line(`        uri        ${stored.encryptedUri}`);
  line(`        --> no name, no date of birth, no roll number. That is the point.`);

  // -------------------------------------------- STEP 4: verifier A checks
  async function present(verifierSigner, label, expectSchema) {
    const nonce = await verificationRegistry.nonces(
      student.address,
      verifierSigner.address
    );
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const domain = {
      name: "DIVS-Presentation",
      version: "1",
      chainId,
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
    const sig = await student.signTypedData(domain, types, {
      credentialId: credId,
      verifier: verifierSigner.address,
      nonce,
      deadline,
    });

    const started = Date.now();
    const t = await verificationRegistry
      .connect(verifierSigner)
      .verifyPresentation(
        credId,
        student.address,
        deadline,
        expectSchema,
        sig
      );
    const r = await t.wait();
    const elapsed = Date.now() - started;
    line(`        ${label}: VERIFIED  (gas ${r.gasUsed}, ${elapsed} ms)`);
    return { gasUsed: r.gasUsed, elapsed };
  }

  line("\nSTEP 4  The same credential is accepted by two different services");
  const disclosure = selectivelyDisclose(signed, ["enrolmentStatus"]);
  line(
    `        verifier receives ${Object.keys(disclosure.disclosedClaims).length - 1} claim, ` +
      `${disclosure.withheldClaimCount} withheld`
  );
  const rA = await present(verifierA, "Library access  ", schemaId("StudentCredential"));
  const rB = await present(verifierB, "Exam hall entry ", schemaId("StudentCredential"));
  gas.verification = rA.gasUsed;

  // ---------------------------------------------- STEP 5: revoke, re-test
  line("\nSTEP 5  University revokes the credential (student leaves)");
  tx = await credentialRegistry.connect(university).revokeCredential(credId);
  rc = await tx.wait();
  gas.revocation = rc.gasUsed;
  line(`        gas: ${rc.gasUsed}`);

  const statusNames = ["Unknown", "Valid", "Expired", "Revoked"];
  line(`        status now: ${statusNames[await credentialRegistry.statusOf(credId)]}`);

  try {
    await present(verifierA, "Library access  ", schemaId("StudentCredential"));
    line("        ERROR: revoked credential was accepted!");
  } catch (e) {
    line(`        Library access  : REJECTED  (credential revoked)`);
  }

  // ------------------------------------------------------------ benchmark
  rule();
  line("  GAS REPORT  (put these numbers on your evaluation slide)");
  rule();
  for (const [k, v] of Object.entries(gas)) {
    line(`  ${k.padEnd(20)} ${String(v).padStart(9)} gas`);
  }
  const total = Object.values(gas).reduce((a, b) => a + b, 0n);
  line(`  ${"TOTAL".padEnd(20)} ${String(total).padStart(9)} gas`);
  rule();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
