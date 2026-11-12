/**
 * Browser copy of lib/credential.js. Kept as a separate ESM file so the
 * frontend has no dependency on the Hardhat project's CommonJS modules.
 * If you change one, change both — or move this to a shared workspace package.
 */
import { keccak256, toUtf8Bytes, getAddress, verifyMessage, getBytes } from "ethers";

export const VC_CONTEXT = [
  "https://www.w3.org/ns/credentials/v2",
  "https://www.w3.org/ns/credentials/examples/v2",
];

export const toDid = (address, chainId = 80002) =>
  `did:ethr:${chainId}:${getAddress(address)}`;

export const fromDid = (did) => getAddress(did.split(":").pop());

export function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value).sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") +
    "}"
  );
}

export function buildCredential({
  type,
  issuerAddress,
  subjectAddress,
  claims,
  validUntil,
  chainId = 80002,
  statusRegistry,
}) {
  const now = Math.floor(Date.now() / 1000);
  const credential = {
    "@context": VC_CONTEXT,
    type: ["VerifiableCredential", type],
    issuer: toDid(issuerAddress, chainId),
    validFrom: new Date(now * 1000).toISOString(),
    credentialSubject: { id: toDid(subjectAddress, chainId), ...claims },
  };
  if (validUntil) credential.validUntil = new Date(validUntil * 1000).toISOString();
  if (statusRegistry) {
    credential.credentialStatus = {
      type: "OnChainRegistryStatus2025",
      registry: statusRegistry,
      chainId,
    };
  }
  return credential;
}

export const credentialHash = (credential) =>
  keccak256(toUtf8Bytes(canonicalize(credential)));

export const schemaId = (typeName) => keccak256(toUtf8Bytes(typeName));

export async function signCredential(credential, issuerSigner) {
  const hash = credentialHash(credential);
  const signature = await issuerSigner.signMessage(getBytes(hash));
  return {
    ...credential,
    proof: {
      type: "EcdsaSecp256k1Signature2019",
      created: new Date().toISOString(),
      proofPurpose: "assertionMethod",
      verificationMethod: `${credential.issuer}#controller`,
      proofValue: signature,
    },
  };
}

export function recoverIssuer(signedCredential) {
  const { proof, ...unsigned } = signedCredential;
  return verifyMessage(getBytes(credentialHash(unsigned)), proof.proofValue);
}

export function selectivelyDisclose(signedCredential, fields) {
  const subject = signedCredential.credentialSubject;
  const disclosed = { id: subject.id };
  for (const f of fields) if (f in subject) disclosed[f] = subject[f];
  return {
    "@context": VC_CONTEXT,
    type: ["VerifiablePresentation"],
    holder: subject.id,
    disclosedClaims: disclosed,
    withheldClaimCount:
      Object.keys(subject).length - Object.keys(disclosed).length,
  };
}

/** Sign the EIP-712 presentation. Must match VerificationRegistry exactly. */
export async function signPresentation({
  signer,
  credentialId,
  verifierAddress,
  nonce,
  deadline,
  chainId,
  verifyingContract,
}) {
  const domain = {
    name: "DIVS-Presentation",
    version: "1",
    chainId,
    verifyingContract,
  };
  const types = {
    Presentation: [
      { name: "credentialId", type: "bytes32" },
      { name: "verifier", type: "address" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };
  return signer.signTypedData(domain, types, {
    credentialId,
    verifier: verifierAddress,
    nonce,
    deadline,
  });
}
