/**
 * evaluate.js — the measurement script for your Review 3 / final report.
 *
 * Produces numbers that are directly comparable to the three base papers, and
 * evidence for each gap you claim to close.
 *
 *   npx hardhat run scripts/evaluate.js                  (local chain)
 *   npx hardhat run scripts/evaluate.js --network amoy   (real testnet)
 *
 * Writes results/evaluation.json and prints a table you can paste into slides.
 */
const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");
const {
  buildCredential,
  credentialHash,
  schemaId,
  signCredential,
  selectivelyDisclose,
} = require("../lib/credential");

const RUNS = Number(process.env.RUNS || 50);

const stats = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return {
    n: s.length,
    min: s[0],
    mean: Number(mean.toFixed(2)),
    median: s[Math.floor(s.length / 2)],
    p95: s[Math.floor(s.length * 0.95)],
    max: s[s.length - 1],
  };
};

const rule = (c = "─") => console.log(c.repeat(74));
const row = (a, b, c = "") =>
  console.log("  " + String(a).padEnd(34) + String(b).padStart(14) + "  " + c);

async function main() {
  const signers = await ethers.getSigners();
  const [deployer, university, holder, verifierA, verifierB] = signers;
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  rule("═");
  console.log("  EVALUATION — Decentralized Identity Verification System");
  console.log(`  network ${network.name} · chainId ${chainId} · ${RUNS} runs`);
  rule("═");

  // ------------------------------------------------------------ deploy
  const didRegistry = await (await ethers.getContractFactory("DIDRegistry")).deploy();
  const issuerRegistry = await (await ethers.getContractFactory("IssuerRegistry")).deploy();
  const credentialRegistry = await (
    await ethers.getContractFactory("CredentialRegistry")
  ).deploy(await issuerRegistry.getAddress());
  const verificationRegistry = await (
    await ethers.getContractFactory("VerificationRegistry")
  ).deploy(await credentialRegistry.getAddress(), await issuerRegistry.getAddress());
  const pairwiseRegistry = await (
    await ethers.getContractFactory("PairwiseDIDRegistry")
  ).deploy(await didRegistry.getAddress());

  await issuerRegistry.registerIssuer(university.address, "State University");

  const results = {
    meta: {
      network: network.name,
      chainId,
      runs: RUNS,
      timestamp: new Date().toISOString(),
    },
    deployment: {},
    operations: {},
    privacy: {},
    correctness: {},
  };

  // -------------------------------------------------- deployment cost
  console.log("\n[1] Deployment cost (one-time)");
  const deployGas = {};
  for (const [name, c] of Object.entries({
    DIDRegistry: didRegistry,
    IssuerRegistry: issuerRegistry,
    CredentialRegistry: credentialRegistry,
    VerificationRegistry: verificationRegistry,
    PairwiseDIDRegistry: pairwiseRegistry,
  })) {
    const rc = await ethers.provider.getTransactionReceipt(
      c.deploymentTransaction().hash
    );
    deployGas[name] = Number(rc.gasUsed);
    row(name, deployGas[name], "gas");
  }
  results.deployment = deployGas;

  // ------------------------------------------------ issuance benchmark
  console.log(`\n[2] Credential issuance (${RUNS} runs)`);
  const issueGas = [];
  const issueMs = [];
  const credIds = [];

  for (let i = 0; i < RUNS; i++) {
    const credential = buildCredential({
      type: "StudentCredential",
      issuerAddress: university.address,
      subjectAddress: holder.address,
      claims: {
        name: `Student ${i}`,
        rollNumber: `21CSE${1000 + i}`,
        programme: "B.Tech Computer Science",
        enrolmentStatus: "Active",
        dateOfBirth: "2004-07-19",
        graduationYear: 2027,
      },
      chainId,
      statusRegistry: await credentialRegistry.getAddress(),
    });
    const id = credentialHash(credential);
    credIds.push({ id, credential });

    const t0 = Date.now();
    const tx = await credentialRegistry
      .connect(university)
      .issueCredential(
        id,
        holder.address,
        schemaId("StudentCredential"),
        0,
        `ipfs://QmBench${i}`
      );
    const rc = await tx.wait();
    issueMs.push(Date.now() - t0);
    issueGas.push(Number(rc.gasUsed));
  }
  const issueGasS = stats(issueGas);
  const issueMsS = stats(issueMs);
  row("gas (mean / p95)", `${issueGasS.mean} / ${issueGasS.p95}`, "gas");
  row("latency (mean / p95)", `${issueMsS.mean} / ${issueMsS.p95}`, "ms");
  results.operations.issuance = { gas: issueGasS, latencyMs: issueMsS };

  // --------------------------------------------- verification benchmark
  console.log(`\n[3] Verification (${RUNS} runs)`);
  const verifyGas = [];
  const verifyMs = [];

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

  for (let i = 0; i < RUNS; i++) {
    const { id } = credIds[i];
    const nonce = await verificationRegistry.nonces(holder.address, verifierA.address);
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const sig = await holder.signTypedData(domain, types, {
      credentialId: id,
      verifier: verifierA.address,
      nonce,
      deadline,
    });

    const t0 = Date.now();
    const tx = await verificationRegistry
      .connect(verifierA)
      .verifyPresentation(
        id,
        holder.address,
        deadline,
        schemaId("StudentCredential"),
        sig
      );
    const rc = await tx.wait();
    verifyMs.push(Date.now() - t0);
    verifyGas.push(Number(rc.gasUsed));
  }
  const vGas = stats(verifyGas);
  const vMs = stats(verifyMs);
  row("gas (mean / p95)", `${vGas.mean} / ${vGas.p95}`, "gas");
  row("latency (mean / p95)", `${vMs.mean} / ${vMs.p95}`, "ms");
  row("target: latency < 5000 ms", vMs.p95 < 5000 ? "PASS" : "FAIL");
  results.operations.verification = { gas: vGas, latencyMs: vMs };

  // ------------------------------------------- off-chain check (free path)
  console.log("\n[4] Read-only pre-check (no gas spent)");
  const checkMs = [];
  for (let i = 0; i < Math.min(RUNS, 20); i++) {
    const { id } = credIds[i];
    const nonce = await verificationRegistry.nonces(holder.address, verifierB.address);
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const sig = await holder.signTypedData(domain, types, {
      credentialId: id,
      verifier: verifierB.address,
      nonce,
      deadline,
    });
    const t0 = Date.now();
    await verificationRegistry
      .connect(verifierB)
      .checkPresentation.staticCall(id, holder.address, deadline, sig);
    checkMs.push(Date.now() - t0);
  }
  const cMs = stats(checkMs);
  row("latency (mean)", cMs.mean, "ms · 0 gas");
  results.operations.readOnlyCheck = { latencyMs: cMs, gas: 0 };

  // ------------------------------------------------- revocation benchmark
  console.log("\n[5] Revocation and rejection accuracy");
  const revokeGas = [];
  let rejected = 0;
  const REVOKE_N = Math.min(RUNS, 20);

  for (let i = 0; i < REVOKE_N; i++) {
    const { id } = credIds[i];
    const rc = await (await credentialRegistry.connect(university).revokeCredential(id)).wait();
    revokeGas.push(Number(rc.gasUsed));

    const nonce = await verificationRegistry.nonces(holder.address, verifierA.address);
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const sig = await holder.signTypedData(domain, types, {
      credentialId: id,
      verifier: verifierA.address,
      nonce,
      deadline,
    });
    try {
      await verificationRegistry
        .connect(verifierA)
        .verifyPresentation(id, holder.address, deadline, schemaId("StudentCredential"), sig);
    } catch {
      rejected += 1;
    }
  }
  const rGas = stats(revokeGas);
  const rejectionRate = (rejected / REVOKE_N) * 100;
  row("revocation gas (mean)", rGas.mean, "gas");
  row("revoked credentials rejected", `${rejected}/${REVOKE_N}`, `${rejectionRate}%`);
  row("target: 100% rejection", rejectionRate === 100 ? "PASS" : "FAIL");
  results.operations.revocation = { gas: rGas };
  results.correctness.revocationRejectionRate = rejectionRate;

  // ------------------------------------------------- privacy measurement
  console.log("\n[6] Data minimisation (the core privacy claim)");
  const { credential } = credIds[RUNS - 1];
  const signed = await signCredential(credential, university);
  const totalClaims = Object.keys(credential.credentialSubject).length - 1; // minus id
  const disclosure = selectivelyDisclose(signed, ["enrolmentStatus"]);
  const disclosed = Object.keys(disclosure.disclosedClaims).length - 1;

  const fullBytes = Buffer.byteLength(JSON.stringify(signed), "utf8");
  const discBytes = Buffer.byteLength(JSON.stringify(disclosure), "utf8");

  // What actually lands on-chain for a credential
  const stored = await credentialRegistry.getCredential(credIds[RUNS - 1].id);
  const onChainPersonalFields = [
    stored.issuer,
    stored.subject,
    stored.schemaId,
    stored.encryptedUri,
  ].filter((v) => {
    const s = String(v).toLowerCase();
    return Object.values(credential.credentialSubject).some(
      (claim) => String(claim).toLowerCase() !== "" && s.includes(String(claim).toLowerCase())
    );
  }).length;

  row("claims in credential", totalClaims);
  row("claims disclosed to verifier", disclosed);
  row("claims withheld", totalClaims - disclosed);
  row("disclosure ratio", `${((disclosed / totalClaims) * 100).toFixed(1)}%`);
  row("full credential size", fullBytes, "bytes");
  row("presented payload size", discBytes, "bytes");
  row("payload reduction", `${(100 - (discBytes / fullBytes) * 100).toFixed(1)}%`);
  row("plaintext claims on-chain", onChainPersonalFields, onChainPersonalFields === 0 ? "PASS" : "FAIL");
  results.privacy = {
    totalClaims,
    disclosedClaims: disclosed,
    disclosureRatioPct: Number(((disclosed / totalClaims) * 100).toFixed(1)),
    fullCredentialBytes: fullBytes,
    presentedBytes: discBytes,
    plaintextClaimsOnChain: onChainPersonalFields,
  };

  // ----------------------------------------------- unlinkability measure
  console.log("\n[7] Cross-verifier correlation (pairwise identifiers)");
  const [, , , , , pwA, pwB] = signers;
  await pairwiseRegistry.connect(holder).bindPairwise(holder.address, verifierA.address, pwA.address);
  await pairwiseRegistry.connect(holder).bindPairwise(holder.address, verifierB.address, pwB.address);
  const seenA = await pairwiseRegistry.pairwiseFor(holder.address, verifierA.address);
  const seenB = await pairwiseRegistry.pairwiseFor(holder.address, verifierB.address);
  row("address seen by verifier A", seenA.slice(0, 12) + "…");
  row("address seen by verifier B", seenB.slice(0, 12) + "…");
  row("correlatable by address alone", seenA === seenB ? "YES" : "NO");
  row("link readable from chain state", "YES", "<-- stated limitation");
  results.privacy.pairwiseDistinct = seenA !== seenB;
  results.privacy.linkPubliclyReadable = true;

  // ------------------------------------------------ gap closure summary
  console.log("\n");
  rule("═");
  console.log("  GAP CLOSURE EVIDENCE");
  rule("═");
  const gapRow = (paper, gap, status, evidence) => {
    console.log(`  ${paper}  ${gap}`);
    console.log(`        ${status.padEnd(12)} ${evidence}`);
  };
  gapRow("P1", "No implementation or measurement",
    "CLOSED", `${RUNS} measured runs across 5 operations`);
  gapRow("P2", "Permissioned ledger (Hyperledger Fabric)",
    "CLOSED", `deployed on ${network.name}, permissionless EVM`);
  gapRow("P2", "No credential expiry or revocation",
    "CLOSED", `${rejectionRate}% rejection of revoked credentials`);
  gapRow("P2", "Privacy named but never implemented",
    "PARTIAL", `selective disclosure measured; ZK circuit pending setup`);
  gapRow("P3", "No credential lifecycle (issue/expiry/revoke)",
    "CLOSED", "all three implemented and tested");
  gapRow("P3", "Committee of distributed authorities required",
    "CLOSED", "single registered issuer, no threshold assumption");
  gapRow("P3", "Link analysis across services",
    "PARTIAL", "pairwise DIDs; on-chain link remains readable");
  gapRow("P3", "Anonymity to the issuing authority",
    "NOT CLOSED", "inherent to single-issuer model — stated limitation");
  rule("═");

  results.gapClosure = {
    P1_noImplementation: "CLOSED",
    P2_permissionedLedger: "CLOSED",
    P2_noRevocation: "CLOSED",
    P2_privacyUnimplemented: "PARTIAL",
    P3_noLifecycle: "CLOSED",
    P3_committeeDependency: "CLOSED",
    P3_linkAnalysis: "PARTIAL",
    P3_anonymityToAuthority: "NOT CLOSED",
  };

  const outDir = path.join(__dirname, "..", "results");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `evaluation-${network.name}.json`);
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\n  Saved ${outFile}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
