import { useState } from "react";
import Icon from "../components/Icon.jsx";
import { PageHeader, ConnectGate, Empty, Segmented, StatusBadge, Spinner } from "../components/ui.jsx";
import { useWallet } from "../lib/session.jsx";
import { useCredentials } from "../lib/hooks";
import UnlockForm from "../components/UnlockForm.jsx";
import { STATUS_CLASS } from "../lib/contracts";
import { fieldLabel } from "../lib/templates";
import { fmtDate, short } from "../lib/format";
import { href } from "../lib/router";

const FILTERS = [
  { id: "all", label: "All", test: () => true },
  { id: "valid", label: "Valid", test: (c) => c.status === 1 },
  { id: "inactive", label: "Expired / revoked", test: (c) => c.status !== 1 },
];

export default function Wallet() {
  const { session } = useWallet();
  const { creds, loading, error, reload } = useCredentials(session?.address);
  const [filter, setFilter] = useState("all");

  if (!session) {
    return (
      <ConnectGate
        title="Your credentials live here"
        lede="Connect your wallet to see the credentials organisations have issued to you. Nothing is shared until you choose to."
      />
    );
  }

  const shown = creds.filter(FILTERS.find((f) => f.id === filter).test);

  return (
    <>
      <PageHeader
        eyebrow="Wallet"
        title={<>Everything here <em>belongs to you</em></>}
        lede="Unlock a credential with the passphrase your issuer gave you to see its details. Only you can open it."
      >
        <button className="btn-quiet" onClick={reload} disabled={loading}>
          <Icon name="refresh" size={16} /> Refresh
        </button>
      </PageHeader>

      <Segmented
        label="Filter credentials"
        value={filter}
        onChange={setFilter}
        options={FILTERS.map((f) => ({ ...f, count: creds.filter(f.test).length }))}
      />

      {error && <div className="note bad">{error}</div>}

      {loading ? (
        <div className="loading-row"><Spinner /> Loading your credentials…</div>
      ) : shown.length === 0 ? (
        <section className="panel">
          <Empty icon="wallet" title={creds.length ? "Nothing in this view" : "No credentials yet"}>
            {creds.length
              ? "Try a different filter."
              : "When an organisation issues you a credential, it appears here automatically. Give them your wallet address from your Profile page."}
          </Empty>
        </section>
      ) : (
        <div className="cred-grid">
          {shown.map((c) => (
            <CredentialCard key={c.id} cred={c} />
          ))}
        </div>
      )}
    </>
  );
}

function CredentialCard({ cred }) {
  const { unlocked } = useWallet();
  const [asking, setAsking] = useState(false);
  const doc = unlocked[cred.id];
  const state = STATUS_CLASS[cred.status];
  const type = doc?.type?.[1] || cred.template?.type;
  const claims = doc ? Object.entries(doc.credentialSubject).filter(([k]) => k !== "id") : [];
  return (
    <article className={`cred ${state}`}>
      <div className="cred-head">
        <div className="cred-title">
          <span className="cred-icon"><Icon name={cred.template?.icon || "card"} size={20} /></span>
          <div>
            <div className="cred-type">{cred.template?.name || "Credential"}</div>
            <div className="cred-issuer">
              {cred.issuerName || short(cred.issuer)}
              {!cred.issuerActive && cred.issuerName && " · issuer paused"}
            </div>
          </div>
        </div>
        <StatusBadge status={cred.status} />
      </div>

      <dl className="cred-meta">
        <div><dt>Issued</dt><dd>{fmtDate(cred.issuedAt)}</dd></div>
        <div><dt>Expires</dt><dd>{cred.expiresAt ? fmtDate(cred.expiresAt) : "Never"}</dd></div>
      </dl>

      {doc ? (
        <div className="claims">
          {claims.map(([k, v]) => (
            <div className="claim static" key={k}>
              <span className="claim-key">{fieldLabel(k, type)}</span>
              <span className="claim-val">{String(v)}</span>
            </div>
          ))}
        </div>
      ) : asking ? (
        <UnlockForm cred={cred} onCancel={() => setAsking(false)} onDone={() => setAsking(false)} />
      ) : (
        <div className="claims locked">
          <Icon name="lock" size={16} /> Details are encrypted. Unlock to view them.
        </div>
      )}

      <div className="btn-row cred-actions">
        {!doc && !asking && (
          <button className="btn-quiet" onClick={() => setAsking(true)}>
            <Icon name="unlock" size={16} /> Unlock
          </button>
        )}
        {cred.status === 1 && (
          <a className="btn-go" href={href("/share", { cred: cred.id })}>
            <Icon name="send" size={16} /> Share
          </a>
        )}
        <a className="btn-quiet" href={href("/check", { id: cred.id })}>
          <Icon name="search" size={16} /> Public status
        </a>
      </div>
    </article>
  );
}
