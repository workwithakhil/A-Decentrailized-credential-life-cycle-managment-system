import { useState } from "react";
import { useWallet } from "../lib/session.jsx";
import { decryptJson } from "../lib/crypto";
import { getEncrypted } from "../lib/storage";

/** Passphrase prompt that decrypts a credential into the session. */
export default function UnlockForm({ cred, onCancel, onDone }) {
  const { unlock, toast } = useWallet();
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const envelope = await getEncrypted(cred.uri);
      unlock(cred.id, await decryptJson(envelope, pass));
      toast("Credential unlocked");
      onDone?.();
    } catch (e) {
      setErr(
        e.message?.includes("not found")
          ? "This credential's encrypted copy isn't stored on this device."
          : "That passphrase didn't work. Check it and try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="unlock-form" onSubmit={submit}>
      <input
        type="password"
        autoFocus
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        placeholder="Passphrase from your issuer"
        aria-label="Passphrase"
      />
      <button className="btn-go" disabled={pass.length < 8 || busy}>
        {busy ? "Unlocking…" : "Unlock"}
      </button>
      {onCancel && (
        <button type="button" className="btn-quiet" onClick={onCancel}>
          Cancel
        </button>
      )}
      {err && <div className="note bad full">{err}</div>}
    </form>
  );
}
