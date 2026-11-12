/**
 * Copies just the ABIs the frontend needs out of artifacts/.
 * Run after every `npx hardhat compile`.
 */
const fs = require("fs");
const path = require("path");

const names = [
  "DIDRegistry",
  "IssuerRegistry",
  "CredentialRegistry",
  "VerificationRegistry",
  "PredicateVerifier",
  "PairwiseDIDRegistry",
];

const out = path.join(__dirname, "..", "frontend", "src", "abis");
fs.mkdirSync(out, { recursive: true });

for (const n of names) {
  const artifact = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "..", "artifacts", "contracts", `${n}.sol`, `${n}.json`),
      "utf8"
    )
  );
  fs.writeFileSync(
    path.join(out, `${n}.json`),
    JSON.stringify({ abi: artifact.abi }, null, 2)
  );
  console.log("exported", n);
}
