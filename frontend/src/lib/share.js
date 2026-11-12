/**
 * Requests and responses travel as URL-safe base64 JSON, so they fit in a
 * link that can be sent over any chat app or email.
 */

export function pack(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Accepts a full link, a bare code, or raw JSON. */
export function unpack(input, param) {
  let s = String(input || "").trim();
  if (!s) throw new Error("Nothing to read.");
  if (s.startsWith("{")) return JSON.parse(s);
  const m = s.match(new RegExp(`[?&]${param}=([^&#\\s]+)`));
  if (m) s = m[1];
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
}

export const randomId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");

/** A readable random passphrase, e.g. "maple-orbit-quiet-7421". */
export function generatePassphrase() {
  const words = [
    "amber", "brook", "cedar", "delta", "ember", "fable", "grove", "harbor",
    "iris", "jade", "koala", "lunar", "maple", "nova", "orbit", "pearl",
    "quiet", "river", "solar", "tulip", "umber", "velvet", "willow", "zephyr",
  ];
  const r = crypto.getRandomValues(new Uint32Array(4));
  const pick = (i) => words[r[i] % words.length];
  return `${pick(0)}-${pick(1)}-${pick(2)}-${1000 + (r[3] % 9000)}`;
}
