import { useCallback, useEffect, useState } from "react";
import { isAddress } from "ethers";
import Icon from "../components/Icon.jsx";
import { PageHeader, ConnectGate, CopyField, Empty, Segmented, StatusBadge, Spinner } from "../components/ui.jsx";
import { useWallet } from "../lib/session.jsx";
import { getContracts, addresses, readableError } from "../lib/contracts";
import { buildCredential, signCredential, credentialHash, schemaId } from "../lib/credential";
import { encryptJson } from "../lib/crypto";
import { putEncrypted, storageMode } from "../lib/storage";
import { TEMPLATES, templateBySchema } from "../lib/templates";
import { generatePassphrase } from "../lib/share";
import { logActivity } from "../lib/activity";
import { absoluteLink } from "../lib/router";
import { fmtDate, short } from "../lib/format";

const TABS = [
  { id: "new", label: "Issue new" },
  { id: "issued", label: "Issued credentials" },
];

export default function Issue() {
  const { session, roles } = useWallet();
  const [tab, setTab] = useState("new");

  if (!session) {
    return (
      <ConnectGate
        icon="stamp"
        title="Issue credentials"
        lede="Connect your organisation's wallet to issue tamper-proof credentials to students, employees or members."
      />
    );
  }

  if (!roles.isIssuer) {
    return (
      <>
        <PageHeader
          eyebrow="Issue"
          title={<>Become an <em>issuer</em></>}
          lede={
            roles.issuerName
              ? `${roles.issuerName} is registered but currently paused. Contact the platform administrator to reactivate it.`
              : "This account isn't a registered organisation yet. Send the address below to the platform administrator to be approved."
          }
        />
        <section className="panel narrow">
          <CopyField label="Your organisation's address" value={session.address} />
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow={roles.issuerName}
        title={<>Issue a <em>credential</em></>}
        lede="Details are signed by your organisation and encrypted before they leave this page. Only a fingerprint is recorded on the blockchain."
      />
      <Segmented label="Issuer sections" options={TABS} value={tab} onChange={setTab} />
      {tab === "new" ? <IssueForm /> : <IssuedList />}
    </>
  );
}

function blankFor(template) {
  return Object.fromEntries(template.fields.map((f) => [f.key, f.options ? f.options[0] : ""]));
}

function IssueForm() {
  const { session, roles, toast } = useWallet();
  const [template, setTemplate] = useState(TEMPLATES[0]);
  const [holder, setHolder] = useState("");
  const [claims, setClaims] = useState(blankFor(TEMPLATES[0]));
  const [validUntil, setValidUntil] = useState("");
  const [passphrase, setPassphrase] = useState(generatePassphrase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  function pick(t) {
    setTemplate(t);
    setClaims(blankFor(t));
  }

  const holderOk = isAddress(holder.trim());
  const ready =
    holderOk && template.fields.every((f) => String(claims[f.key]).trim()) && passphrase.length >= 8;

  async function issue(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { credentialRegistry } = getContracts(session.signer);
      const expires = validUntil ? Math.floor(new Date(validUntil).getTime() / 1000) : 0;
      const values = Object.fromEntries(
        template.fields.map((f) => [f.key, f.kind === "number" ? Number(claims[f.key]) : claims[f.key].trim()])
      );

      const credential = buildCredential({
        type: template.type,
        issuerAddress: session.address,
        subjectAddress: holder.trim(),
        claims: values,
        validUntil: expires || undefined,
        chainId: session.chainId,
        statusRegistry: addresses.CredentialRegistry,
      });
      const signed = await signCredential(credential, session.signer);
      const credId = credentialHash(credential);
      const uri = await putEncrypted(await encryptJson(signed, passphrase));

      const tx = await credentialRegistry.issueCredential(
        credId,
        holder.trim(),
        schemaId(template.type),
        expires,
        uri
      );
      await tx.wait();

      logActivity(session.address, {
        kind: "issued",
        title: `Issued ${template.name} to ${values.name || short(holder)}`,
        detail: short(holder.trim()),
      });
      setResult({ credId, holder: holder.trim(), passphrase, name: values.name, template });
      toast("Credential issued");
    } catch (err) {
      setError(readableError(err));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setResult(null);
    setHolder("");
    setClaims(blankFor(template));
    setValidUntil("");
    setPassphrase(generatePassphrase());
  }

  if (result) {
    const message = [
      `Hi ${result.name || ""}, ${roles.issuerName} has issued you a ${result.template.name}.`,
      ``,
      `Open your wallet: ${absoluteLink("/wallet")}`,
      `Passphrase to unlock it: ${result.passphrase}`,
      ``,
      `Credential ID: ${result.credId}`,
    ].join("\n");
    return (
      <section className="panel success">
        <div className="success-icon"><Icon name="check" size={26} /></div>
        <h2>{result.template.name} issued</h2>
        <p className="lede">
          Send the holder their passphrase privately. Without it, nobody — including us — can open the credential.
        </p>
        <CopyField label="Message for the holder" value={message} multiline />
        <CopyField label="Credential ID" value={result.credId} />
        <div className="btn-row">
          <button className="btn-go" onClick={reset}>Issue another</button>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={issue}>
      <h2 className="section-h">Credential type</h2>
      <div className="type-grid wide">
        {TEMPLATES.map((t) => (
          <button
            key={t.type}
            type="button"
            className={`type-card ${template.type === t.type ? "on" : ""}`}
            onClick={() => pick(t)}
          >
            <Icon name={t.icon} size={22} />
            <b>{t.name}</b>
            <small>{t.blurb}</small>
          </button>
        ))}
      </div>

      <section className="panel">
        <h2>Holder</h2>
        <div className="field-row">
          <label htmlFor="holder">Holder's wallet address</label>
          <input
            id="holder"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder="0x…"
            spellCheck="false"
          />
          {holder && !holderOk && <small className="field-err">That isn't a valid wallet address.</small>}
        </div>

        <h2>Details</h2>
        <div className="grid2">
          {template.fields.map((f) => (
            <div className="field-row" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              {f.kind === "select" ? (
                <select
                  id={f.key}
                  value={claims[f.key]}
                  onChange={(e) => setClaims((c) => ({ ...c, [f.key]: e.target.value }))}
                >
                  {f.options.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  id={f.key}
                  type={f.kind || "text"}
                  value={claims[f.key]}
                  placeholder={f.placeholder}
                  onChange={(e) => setClaims((c) => ({ ...c, [f.key]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Security</h2>
        <div className="grid2">
          <div className="field-row">
            <label htmlFor="until">Expires on (optional)</label>
            <input id="until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div className="field-row">
            <label htmlFor="pass">Passphrase for the holder</label>
            <div className="input-with-btn">
              <input
                id="pass"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="at least 8 characters"
              />
              <button type="button" className="btn-icon" title="Generate a new one" onClick={() => setPassphrase(generatePassphrase())}>
                <Icon name="refresh" />
              </button>
            </div>
          </div>
        </div>
        {storageMode === "local" && (
          <div className="note info">
            Encrypted copies are currently stored in this browser. Holders must unlock on the same device until
            cloud storage is configured.
          </div>
        )}
        {error && <div className="note bad">{error}</div>}
        <div className="btn-row">
          <button className="btn-go btn-lg" disabled={!ready || busy}>
            {busy ? "Issuing…" : "Sign and issue"}
          </button>
        </div>
      </section>
    </form>
  );
}

function IssuedList() {
  const { session, toast } = useWallet();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { credentialRegistry } = getContracts();
      const events = await credentialRegistry.queryFilter(
        credentialRegistry.filters.CredentialIssued(null, session.address)
      );
      const statuses = await Promise.all(events.map((e) => credentialRegistry.statusOf(e.args.credentialId)));
      setRows(
        events
          .map((e, i) => ({
            id: e.args.credentialId,
            subject: e.args.subject,
            template: templateBySchema(e.args.schemaId),
            expiresAt: Number(e.args.expiresAt),
            block: e.blockNumber,
            status: Number(statuses[i]),
          }))
          .reverse()
      );
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }, [session.address]);

  useEffect(() => {
    load();
  }, [load]);

  async function revoke(row) {
    if (!window.confirm(`Revoke this ${row.template?.name || "credential"}? This can't be undone.`)) return;
    setBusyId(row.id);
    try {
      const { credentialRegistry } = getContracts(session.signer);
      await (await credentialRegistry.revokeCredential(row.id)).wait();
      logActivity(session.address, {
        kind: "revoked",
        title: `Revoked ${row.template?.name || "a credential"}`,
        detail: short(row.subject),
      });
      toast("Credential revoked");
      load();
    } catch (e) {
      toast(readableError(e), "bad");
    } finally {
      setBusyId("");
    }
  }

  if (loading) return <div className="loading-row"><Spinner /> Loading issued credentials…</div>;
  if (error) return <div className="note bad">{error}</div>;
  if (rows.length === 0)
    return (
      <section className="panel">
        <Empty icon="stamp" title="Nothing issued yet">Credentials you issue will be listed here.</Empty>
      </section>
    );

  return (
    <section className="panel list">
      {rows.map((r) => (
        <div className="row" key={r.id}>
          <span className="row-icon"><Icon name={r.template?.icon || "card"} size={16} /></span>
          <span className="row-main">
            <b>{r.template?.name || "Credential"}</b>
            <small className="mono">to {short(r.subject, 8, 6)} · {r.expiresAt ? `expires ${fmtDate(r.expiresAt)}` : "no expiry"}</small>
          </span>
          <StatusBadge status={r.status} />
          {r.status === 1 && (
            <button className="btn-quiet btn-sm danger" onClick={() => revoke(r)} disabled={busyId === r.id}>
              {busyId === r.id ? "Revoking…" : "Revoke"}
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
