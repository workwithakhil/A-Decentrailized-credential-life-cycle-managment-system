/**
 * Credential library — shared by scripts and (in ESM form) the frontend.
 *
 * Builds credentials that follow the W3C Verifiable Credentials Data Model 2.0
 * (W3C Recommendation, 15 May 2025). The important structural points, which
 * you should be able to explain in the review:
 *
 *   @context          — tells a verifier how to interpret the terms
 *   type              — always includes "VerifiableCredential", plus your type
 *   issuer            — the issuer's DID
 *   validFrom/validUntil — VCDM 2.0 renamed these from issuanceDate/expirationDate
 *   credentialSubject — the actual claims, and "id" is the holder's DID
 *   credentialStatus  — where a verifier checks revocation
 *
 * The whole document is hashed to produce credentialId, and that hash is what
 * goes on-chain. The document itself is encrypted and pinned to IPFS.
 */

const { ethers } = require("ethers");

const VC_CONTEXT = [
  "https://www.w3.org/ns/credentials/v2",
  "https://www.w3.org/ns/credentials/examples/v2",
];

/** Build a did:ethr identifier for an address on a given chain. */
function toDid(address, chainId = 80002) {
  return `did:ethr:${chainId}:${ethers.getAddress(address)}`;
}

/** Parse the address back out of a did:ethr string. */
function fromDid(did) {
  const parts = did.split(":");
  return ethers.getAddress(parts[parts.length - 1]);
}

/**
 * Deterministic JSON: keys sorted at every level. Two parties must produce
 * byte-identical output or the hashes will not match. This is a simplified
 * stand-in for full JSON-LD canonicalisation (URDNA2015) — note that
 * limitation in your report rather than claiming full conformance.
 */
function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  return (
    "{" +
    keys.map((k) => JSON.stringify(k) + ":" + canonicalize(value[k])).join(",") +
    "}"
  );
}

/**
 * Create an unsigned credential.
 *
 * @param {object}  opts
 * @param {string}  opts.type              e.g. "StudentCredential"
 * @param {string}  opts.issuerAddress
 * @param {string}  opts.subjectAddress
 * @param {object}  opts.claims            the actual attribute values
 * @param {number} [opts.validUntil]       unix seconds, omit for no expiry
 * @param {number} [opts.chainId]
 * @param {string} [opts.statusRegistry]   CredentialRegistry address
 */
function buildCredential({
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
    credentialSubject: {
      id: toDid(subjectAddress, chainId),
      ...claims,
    },
  };
  if (validUntil) {
    credential.validUntil = new Date(validUntil * 1000).toISOString();
  }
  if (statusRegistry) {
    credential.credentialStatus = {
      type: "OnChainRegistryStatus2025",
      registry: statusRegistry,
      chainId,
    };
  }
  return credential;
}

/** keccak256 of the canonical form. This is the on-chain credentialId. */
function credentialHash(credential) {
  return ethers.keccak256(ethers.toUtf8Bytes(canonicalize(credential)));
}

/** keccak256 of the type name. This is the on-chain schemaId. */
function schemaId(typeName) {
  return ethers.keccak256(ethers.toUtf8Bytes(typeName));
}

/**
 * Issuer signs the credential hash. The signature travels inside the encrypted
 * payload; the verifier recovers the issuer address from it and checks that
 * address against IssuerRegistry.
 */
async function signCredential(credential, issuerSigner) {
  const hash = credentialHash(credential);
  const signature = await issuerSigner.signMessage(ethers.getBytes(hash));
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

/** Recover the issuer address from a signed credential. */
function recoverIssuer(signedCredential) {
  const { proof, ...unsigned } = signedCredential;
  const hash = credentialHash(unsigned);
  return ethers.verifyMessage(ethers.getBytes(hash), proof.proofValue);
}

/**
 * Build the presentation payload the holder signs (EIP-712).
 * Must match VerificationRegistry.hashPresentation exactly.
 */
function presentationTypedData({
  credentialId,
  verifier,
  nonce,
  deadline,
  chainId,
  verifyingContract,
}) {
  return {
    domain: {
      name: "DIVS-Presentation",
      version: "1",
      chainId,
      verifyingContract,
    },
    types: {
      Presentation: [
        { name: "credentialId", type: "bytes32" },
        { name: "verifier", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    message: { credentialId, verifier, nonce, deadline },
  };
}

/**
 * Selective disclosure: return a presentation containing ONLY the requested
 * fields. This is the plain (non-ZK) path — the verifier learns the value of
 * the disclosed field but nothing else.
 */
function selectivelyDisclose(signedCredential, fields) {
  const subject = signedCredential.credentialSubject;
  const disclosed = { id: subject.id };
  for (const f of fields) {
    if (f in subject) disclosed[f] = subject[f];
  }
  return {
    "@context": VC_CONTEXT,
    type: ["VerifiablePresentation"],
    holder: subject.id,
    disclosedClaims: disclosed,
    withheldClaimCount: Object.keys(subject).length - Object.keys(disclosed).length,
  };
}

module.exports = {
  VC_CONTEXT,
  toDid,
  fromDid,
  canonicalize,
  buildCredential,
  credentialHash,
  schemaId,
  signCredential,
  recoverIssuer,
  presentationTypedData,
  selectivelyDisclose,
};
