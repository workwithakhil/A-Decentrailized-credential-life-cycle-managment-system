import { useState } from "react";
import { isAddress } from "ethers";
import { PageHeader, ConnectGate, Empty, Spinner } from "../components/ui.jsx";
import { useWallet } from "../lib/session.jsx";
import { useIssuers } from "../lib/hooks";
import { getContracts, readableError } from "../lib/contracts";
import { logActivity } from "../lib/activity";
import { fmtDate, short } from "../lib/format";

export default function Admin() {
  const { session, roles, refreshRoles, toast } = useWallet();
  const { issuers, loading, error, reload } = useIssuers();
  const [addr, setAddr] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");

  if (!session) {
    return <ConnectGate icon="shield" title="Administration" lede="Connect the administrator wallet to manage issuers." />;
  }
  if (!roles.isOwner) {
    return (
      <PageHeader
        eyebrow="Administration"
        title="Not available"
        lede="Only the platform administrator can manage issuers."
      />
    );
  }

  async function run(key, fn, success) {
    setBusy(key);
    try {
      const { issuerRegistry } = getContracts(session.signer);
      await (await fn(issuerRegistry)).wait();
      toast(success);
      reload();
      refreshRoles(session.address);
      return true;
    } catch (e) {
      toast(readableError(e), "bad");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function register(e) {
    e.preventDefault();
    const ok = await run("new", (r) => r.registerIssuer(addr.trim(), name.trim()), `${name.trim()} approved`);
    if (ok) {
      logActivity(session.address, { kind: "registered", title: `Approved ${name.trim()}`, detail: short(addr.trim()) });
      setAddr("");
      setName("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title={<>Manage <em>issuers</em></>}
        lede="Approve organisations to issue credentials, or pause one if it can no longer be trusted. Pausing an issuer makes all of its credentials fail verification until it is reactivated."
      />

      <form className="panel" onSubmit={register}>
        <h2>Approve a new organisation</h2>
        <div className="grid2">
          <div className="field-row">
            <label htmlFor="org">Organisation name</label>
            <input id="org" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. State University" />
          </div>
          <div className="field-row">
            <label htmlFor="orgaddr">Wallet address</label>
            <input id="orgaddr" value={addr} onChange={(e) => setAddr(e.target.value)} placeholder="0x…" spellCheck="false" />
          </div>
        </div>
        <button className="btn-go" disabled={!name.trim() || !isAddress(addr.trim()) || busy === "new"}>
          {busy === "new" ? "Approving…" : "Approve organisation"}
        </button>
      </form>

      <h2 className="section-h">Registered organisations</h2>
      {error && <div className="note bad">{error}</div>}
      {loading ? (
        <div className="loading-row"><Spinner /> Loading…</div>
      ) : issuers.length === 0 ? (
        <section className="panel"><Empty icon="building" title="No organisations yet" /></section>
      ) : (
        <section className="panel list">
          {issuers.map((i) => (
            <div className="row" key={i.address}>
              <span className="issuer-avatar sm">{i.name.slice(0, 1).toUpperCase()}</span>
              <span className="row-main">
                <b>{i.name}</b>
                <small className="mono">{short(i.address, 8, 6)} · since {fmtDate(i.registeredAt)}</small>
              </span>
              <span className={`pill ${i.active ? "good" : "bad"}`}>{i.active ? "Active" : "Paused"}</span>
              <button
                className={`btn-quiet btn-sm ${i.active ? "danger" : ""}`}
                disabled={busy === i.address}
                onClick={() =>
                  run(i.address, (r) => r.setIssuerActive(i.address, !i.active), `${i.name} ${i.active ? "paused" : "reactivated"}`)
                }
              >
                {busy === i.address ? "Saving…" : i.active ? "Pause" : "Reactivate"}
              </button>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
