/**
 * Payload encryption. AES-256-GCM via the browser's Web Crypto API.
 *
 * Scope note for your report: a production system derives the AES key from the
 * holder's wallet key using ECIES so nobody has to remember a passphrase. Here
 * the key is derived from a passphrase with PBKDF2, which is simpler to demo
 * and to explain. Say this out loud rather than letting the panel find it.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(passphrase, salt) {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 250000, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

const toB64 = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Encrypt any JSON-serialisable object. Returns a portable envelope. */
export async function encryptJson(obj, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(obj))
  );
  return {
    alg: "AES-256-GCM",
    kdf: "PBKDF2-SHA256-250k",
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(ciphertext),
  };
}

export async function decryptJson(envelope, passphrase) {
  const key = await deriveKey(passphrase, fromB64(envelope.salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(envelope.iv) },
    key,
    fromB64(envelope.ciphertext)
  );
  return JSON.parse(dec.decode(plaintext));
}
