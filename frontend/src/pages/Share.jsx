import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon.jsx";
import UnlockForm from "../components/UnlockForm.jsx";
import { PageHeader, ConnectGate, CopyField, Empty, Spinner } from "../components/ui.jsx";
import { useWallet } from "../lib/session.jsx";
import { useCredentials } from "../lib/hooks";
import { getContracts, addresses, readableError } from "../lib/contracts";
import { signPresentation, selectivelyDisclose } from "../lib/credential";
import { fieldLabel, typeName } from "../lib/templates";
import { pack, unpack } from "../lib/share";
import { absoluteLink, navigate } from "../lib/router";
import { logActivity } from "../lib/activity";
import { countdown, fmtDate, short } from "../lib/format";

function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
}

export default function Share({ query }) {
  const { session } = useWallet();

  const request = useMemo(() => {
    if (!query.req) return null;
    try {
      return unpack(query.req, "req");
    } catch {
      return { invalid: true };
    }
  }, [query.req]);

  if (!session) {
    return (
      <ConnectGate
        icon="send"
        title={request && !request.invalid ? `${request.service || "A service"} is asking for proof` : "Share a credential"}
        lede="Connect your wallet to choose a credential and decide exactly what to reveal. Nothing is sent until you sign."
      />
    );
  }

  if (!request || request.invalid) {
    return <PasteRequest invalid={request?.invalid} cred={query.cred} />;
  }

  return <Respond request={request} preselect={query.cred} />;
}

function PasteRequest({ invalid, cred }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState(invalid ? "That request link is damaged. Ask for a new one." : "");

  function open() {
    try {
      const req = unpack(text, "req");
      if (!req.verifier || !req.deadline) throw new Error();
      navigate("/share", { req: pack(req), ...(cred ? { cred } : {}) });
    } catch {
      setErr("That doesn't look like a request link. Copy the whole link and try again.");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Share"
        title={<>Respond to a <em>request</em></>}
        lede="Services that need proof will send you a request link. Open it, or paste it here."
      />
      <section className="panel narrow">
        <div className="field-row">
          <label htmlFor="req">Request link</label>
          <textarea
            id="req"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="https://…/#/share?req=…"
          />
        </div>
        {err && <div className="note bad">{err}</div>}
        <div className="btn-row">
          <button className="btn-go" onClick={open} disabled={!text.trim()}>
            Continue <Icon name="arrow" size={16} />
          </button>
        </div>
      </section>
      <section className="panel narrow how">
        <h2>How sharing works</h2>
        <ol>
          <li>A service creates a request saying what it needs to know.</li>
          <li>You pick a credential and tick only the details you're happy to reveal.</li>
          <li>You sign, and send the reply link back. Everything else stays private.</li>
        </ol>
      </section>
    </>
  );
}

function Respond({ request, preselect }) {
  useTick();
  const { session, unlocked, toast } = useWallet();
  const { creds, loading } = useCredentials(session.address);
  const [credId, setCredId] = useState(preselect || "");
  const [chosen, setChosen] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [reply, setReply] = useState("");

  const expired = Number(request.deadline) <= Date.now() / 1000;
  const wrongChain = request.chainId && Number(request.chainId) !== session.chainId;
  const eligible = creds.filter(
    (c) => c.status === 1 && (!request.type || c.template?.type === request.type)
  );
  const cred = eligible.find((c) => c.id === credId);
  const doc = cred && unlocked[cred.id];
  const requested = request.claims || [];

  // auto-pick when there's exactly one match
  useEffect(() => {
    if (!credId && eligible.length === 1) setCredId(eligible[0].id);
  }, [credId, eligible]);

  // pre-tick what the service asked for, once the credential is open
  useEffect(() => {
    if (doc) setChosen(new Set(requested.filter((k) => k in doc.credentialSubject)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  function toggle(k) {
    setChosen((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  async function sign() {
    setBusy(true);
    setErr("");
    try {
      const { verificationRegistry } = getContracts();
      const nonce = await verificationRegistry.nonces(session.address, request.verifier);
      const signature = await signPresentation({
        signer: session.signer,
        credentialId: cred.id,
        verifierAddress: request.verifier,
        nonce,
        deadline: request.deadline,
        chainId: session.chainId,
        verifyingContract: addresses.VerificationRegistry,
      });
      const disclosed = doc ? selectivelyDisclose(doc, [...chosen]) : null;
      const response = {
        v: 1,
        requestId: request.id,
        verifier: request.verifier,
        service: request.service,
        type: cred.template?.type,
        credentialId: cred.id,
        holder: session.address,
        deadline: request.deadline,
        signature,
        disclosedClaims: disclosed?.disclosedClaims,
        withheldClaimCount: disclosed?.withheldClaimCount,
      };
      setReply(absoluteLink("/verify", { res: pack(response) }));
      logActivity(session.address, {
        kind: "shared",
        title: `Shared ${cred.template?.name || "a credential"} with ${request.service || "a service"}`,
        detail: chosen.size ? `Revealed: ${[...chosen].map((k) => fieldLabel(k, response.type)).join(", ")}` : "No details revealed",
      });
      toast("Signed — send the reply link back");
    } catch (e) {
      setErr(readableError(e));
    } finally {
      setBusy(false);
    }
  }

  const missing = doc ? requested.filter((k) => !chosen.has(k)) : [];

  return (
    <>
      <PageHeader
        eyebrow="Share"
        title={<>{request.service || "A service"} <em>is asking</em></>}
        lede="Review the request, choose a credential and decide what to reveal. Anything you leave unticked never leaves this device."
      />

      <section className="panel request-card">
        <div className="request-top">
          <div>
            <span className="tile-label">Wants to see</span>
            <h2>{typeName(request.type)}</h2>
          </div>
          <span className={`pill ${expired ? "bad" : ""}`}>
            <Icon name="clock" size={14} /> {countdown(request.deadline)}
          </span>
        </div>
        {requested.length > 0 && (
          <div className="chips">
            {requested.map((k) => (
              <span className="chip-soft" key={k}>{fieldLabel(k, request.type)}</span>
            ))}
          </div>
        )}
        <p className="fine">Requested by {short(request.verifier)}</p>
      </section>

      {expired && <div className="note bad">This request has expired. Ask the service for a new link.</div>}
      {wrongChain && <div className="note bad">This request was made on a different network.</div>}

      {!reply && !expired && (
        <>
          <h2 className="section-h">1 · Choose a credential</h2>
          {loading ? (
            <div className="loading-row"><Spinner /> Loading your credentials…</div>
          ) : eligible.length === 0 ? (
            <section className="panel">
              <Empty icon="wallet" title="No matching credential">
                You don't hold a valid {typeName(request.type).toLowerCase()} yet.
              </Empty>
            </section>
          ) : (
            <div className="pick-list">
              {eligible.map((c) => (
                <label className={`pick panel ${credId === c.id ? "on" : ""}`} key={c.id}>
                  <input
                    type="radio"
                    name="cred"
                    checked={credId === c.id}
                    onChange={() => setCredId(c.id)}
                  />
                  <span className="cred-icon"><Icon name={c.template?.icon || "card"} size={18} /></span>
                  <span className="row-main">
                    <b>{c.template?.name || "Credential"}</b>
                    <small>{c.issuerName || short(c.issuer)} · issued {fmtDate(c.issuedAt)}</small>
                  </span>
                </label>
              ))}
            </div>
          )}

          {cred && (
            <>
              <h2 className="section-h">2 · Choose what to reveal</h2>
              <section className="panel">
                {!doc ? (
                  <>
                    <p className="fine" style={{ marginTop: 0 }}>
                      Unlock this credential to pick individual details — or sign without revealing any, which
                      only proves you hold a valid credential.
                    </p>
                    <UnlockForm cred={cred} />
                  </>
                ) : (
                  <ClaimPicker doc={doc} chosen={chosen} toggle={toggle} requested={requested} />
                )}
                {missing.length > 0 && (
                  <div className="note warn">
                    The service asked for {missing.map((k) => fieldLabel(k, request.type)).join(", ")}. It may
                    refuse the request without them.
                  </div>
                )}
              </section>

              <h2 className="section-h">3 · Sign and send</h2>
              <section className="panel">
                <p className="fine" style={{ marginTop: 0 }}>
                  Your wallet will ask you to sign. This costs nothing and proves the reply came from you.
                </p>
                {err && <div className="note bad">{err}</div>}
                <button className="btn-go btn-lg" onClick={sign} disabled={busy || wrongChain}>
                  {busy ? "Waiting for signature…" : "Sign and create reply"}
                </button>
              </section>
            </>
          )}
        </>
      )}

      {reply && (
        <section className="panel success">
          <div className="success-icon"><Icon name="check" size={26} /></div>
          <h2>Reply ready</h2>
          <p className="lede">
            Send this link back to {request.service || "the service"}. It only works for them, and only until the
            request expires.
          </p>
          <CopyField label="Reply link" value={reply} />
        </section>
      )}
    </>
  );
}

function ClaimPicker({ doc, chosen, toggle, requested }) {
  const type = doc.type?.[1];
  const keys = Object.keys(doc.credentialSubject).filter((k) => k !== "id");
  const pct = keys.length ? (chosen.size / keys.length) * 100 : 0;
  return (
    <>
      <div className="claims flush">
        {keys.map((k) => {
          const on = chosen.has(k);
          return (
            <label className="claim" key={k}>
              <input type="checkbox" checked={on} onChange={() => toggle(k)} />
              <span className="claim-key">
                {fieldLabel(k, type)}
                {requested.includes(k) && <span className="req-tag">requested</span>}
              </span>
              <span className={`claim-val ${on ? "" : "frosted"}`}>{String(doc.credentialSubject[k])}</span>
              <span className={`claim-hint ${on ? "on" : ""}`}>{on ? "Shared" : "Hidden"}</span>
            </label>
          );
        })}
      </div>
      <div className="disclosure-meter">
        <span>{chosen.size} of {keys.length} shared</span>
        <div className="meter"><span style={{ width: `${pct}%` }} /></div>
        <span>{Math.round(pct)}%</span>
      </div>
    </>
  );
}
