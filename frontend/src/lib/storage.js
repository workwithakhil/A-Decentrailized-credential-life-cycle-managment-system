/**
 * Off-chain storage.
 *
 * Two modes so your demo never fails because a pinning service is down:
 *   - "local"  : keeps the encrypted envelope in localStorage. Use for the demo.
 *   - "pinata" : real IPFS pinning. Set VITE_PINATA_JWT in frontend/.env
 *
 * Either way the ciphertext is what leaves the browser — never the plaintext.
 */

const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;
const MODE = PINATA_JWT ? "pinata" : "local";

export const storageMode = MODE;

export async function putEncrypted(envelope) {
  if (MODE === "pinata") {
    const res = await fetch(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: JSON.stringify({ pinataContent: envelope }),
      }
    );
    if (!res.ok) throw new Error(`Pinata upload failed: ${res.status}`);
    const { IpfsHash } = await res.json();
    return `ipfs://${IpfsHash}`;
  }

  // local fallback — content-addressed by a hash of the ciphertext
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(envelope))
  );
  const cid =
    "local" +
    Array.from(new Uint8Array(digest).slice(0, 16))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  localStorage.setItem(`divs:blob:${cid}`, JSON.stringify(envelope));
  return `ipfs://${cid}`;
}

export async function getEncrypted(uri) {
  const cid = uri.replace("ipfs://", "");
  if (cid.startsWith("local")) {
    const raw = localStorage.getItem(`divs:blob:${cid}`);
    if (!raw) throw new Error("Encrypted payload not found on this device.");
    return JSON.parse(raw);
  }
  const res = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
  if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status}`);
  return res.json();
}
