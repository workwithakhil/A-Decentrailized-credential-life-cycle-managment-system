import { useEffect, useState } from "react";
import Icon from "../components/Icon.jsx";
import { PageHeader, StatusBadge, Spinner } from "../components/ui.jsx";
import { fetchCredential } from "../lib/hooks";
import { readableError } from "../lib/contracts";
import { navigate } from "../lib/router";
import { fmtDate, short } from "../lib/format";

const isId = (s) => /^0x[0-9a-fA-F]{64}$/.test(s);

const VERDICT = {
  1: { icon: "check", title: "This credential is valid", body: "It was issued by a registered organisation and hasn't expired or been revoked." },
  2: { icon: "clock", title: "This credential has expired", body: "It was genuine, but its validity period is over." },
  3: { icon: "x", title: "This credential was revoked", body: "The issuing organisation has withdrawn it. It should not be accepted." },
};

export default function Check({ query }) {
  const [input, setInput] = useState(query.id || "");
  const [state, setState] = useState({ loading: false, cred: undefined, error: "" });

  useEffect(() => {
    if (!query.id) return setState({ loading: false, cred: undefined, error: "" });
    setInput(query.id);
    if (!isId(query.id)) return setState({ loading: false, cred: undefined, error: "That isn't a valid credential ID." });
    setState({ loading: true, cred: undefined, error: "" });
    fetchCredential(query.id)
      .then((cred) => setState({ loading: false, cred, error: "" }))
      .catch((e) => setState({ loading: false, cred: undefined, error: readableError(e) }));
  }, [query.id]);

  function submit(e) {
    e.preventDefault();
    navigate("/check", { id: input.trim() });
  }

  const { loading, cred, error } = state;
  const verdict = cred && VERDICT[cred.status];

  return (
    <>
      <PageHeader
        eyebrow="Public lookup"
        title={<>Check a <em>credential</em></>}
        lede="Anyone can confirm whether a credential is genuine and still valid — no account needed. Personal details are never shown here, because they're never on the blockchain."
      />

      <form className="search-bar panel" onSubmit={submit}>
        <Icon name="search" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a credential ID (0x…)"
          aria-label="Credential ID"
          spellCheck="false"
        />
        <button className="btn-go" disabled={!input.trim()}>Check</button>
      </form>

      {loading && <div className="loading-row"><Spinner /> Looking it up…</div>}
      {error && <div className="note bad">{error}</div>}

      {cred === null && !loading && (
        <section className="panel verdict bad">
          <div className="verdict-icon"><Icon name="x" size={30} /></div>
          <div>
            <h2>No credential found</h2>
            <p className="lede">Nothing has been issued with this ID. Check it was copied in full.</p>
          </div>
        </section>
      )}

      {cred && (
        <>
          <section className={`panel verdict ${cred.status === 1 ? "ok" : "bad"}`}>
            <div className="verdict-icon"><Icon name={verdict.icon} size={30} /></div>
            <div>
              <h2>{verdict.title}</h2>
              <p className="lede">{verdict.body}</p>
            </div>
          </section>

          <section className="panel">
            <div className="cred-head">
              <h2 style={{ margin: 0 }}>{cred.template?.name || "Credential"}</h2>
              <StatusBadge status={cred.status} />
            </div>
            <dl className="kv">
              <div>
                <dt>Issued by</dt>
                <dd>
                  {cred.issuerName || "Unknown organisation"}
                  {!cred.issuerActive && <span className="pill bad small">not currently trusted</span>}
                </dd>
              </div>
              <div><dt>Issuer account</dt><dd className="mono">{short(cred.issuer, 10, 6)}</dd></div>
              <div><dt>Holder account</dt><dd className="mono">{short(cred.subject, 10, 6)}</dd></div>
              <div><dt>Issued on</dt><dd>{fmtDate(cred.issuedAt)}</dd></div>
              <div><dt>Expires</dt><dd>{cred.expiresAt ? fmtDate(cred.expiresAt) : "Never"}</dd></div>
              <div><dt>Credential ID</dt><dd className="mono">{cred.id}</dd></div>
            </dl>
          </section>
        </>
      )}
    </>
  );
}
