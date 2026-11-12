import { useState } from "react";
import Icon from "../components/Icon.jsx";
import { PageHeader, Empty, Spinner } from "../components/ui.jsx";
import { useIssuers } from "../lib/hooks";
import { fmtDate, short } from "../lib/format";
import { href } from "../lib/router";

export default function Issuers() {
  const { issuers, loading, error } = useIssuers();
  const [q, setQ] = useState("");

  const shown = issuers.filter(
    (i) =>
      i.name.toLowerCase().includes(q.toLowerCase()) ||
      i.address.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <>
      <PageHeader
        eyebrow="Directory"
        title={<>Trusted <em>issuers</em></>}
        lede="Organisations approved to issue credentials on this network. A credential is only accepted while its issuer is active."
      />

      <div className="search-bar panel">
        <Icon name="search" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or address"
          aria-label="Search issuers"
        />
      </div>

      {error && <div className="note bad">{error}</div>}

      {loading ? (
        <div className="loading-row"><Spinner /> Loading issuers…</div>
      ) : shown.length === 0 ? (
        <section className="panel">
          <Empty icon="building" title={issuers.length ? "No matches" : "No issuers yet"} />
        </section>
      ) : (
        <div className="issuer-grid">
          {shown.map((i) => (
            <article className="panel issuer" key={i.address}>
              <div className="issuer-avatar">{i.name.slice(0, 1).toUpperCase()}</div>
              <div className="row-main">
                <b>{i.name}</b>
                <small className="mono">{short(i.address, 8, 6)}</small>
                <small>Registered {fmtDate(i.registeredAt)}</small>
              </div>
              <span className={`pill ${i.active ? "good" : "bad"}`}>{i.active ? "Active" : "Paused"}</span>
            </article>
          ))}
        </div>
      )}

      <section className="panel cta-panel">
        <div>
          <h2>Want to issue credentials?</h2>
          <p className="fine">
            Organisations are approved by the platform administrator. Send them your organisation's wallet
            address to get started.
          </p>
        </div>
        <a className="btn-quiet" href={href("/help")}>How to apply</a>
      </section>
    </>
  );
}
