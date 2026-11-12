/**
 * Off-chain storage.
 *
 * The encrypted envelope is kept in this browser's localStorage, addressed by
 * a hash of the ciphertext. Only ciphertext is stored — never the plaintext.
 *
 * Uploading to an IPFS pinning service would need an API key, and the frontend
 * is a public bundle, so no key lives here. Real pinning would go through a
 * small server-side proxy that holds the key. Reading existing ipfs:// CIDs
 * from a public gateway needs no key and still works.
 */

export const storageMode = "local";

export async function putEncrypted(envelope) {
  // content-addressed by a hash of the ciphertext
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
  const res = await fetch(`https://ipfs.io/ipfs/${cid}`);
  if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status}`);
  return res.json();
}
