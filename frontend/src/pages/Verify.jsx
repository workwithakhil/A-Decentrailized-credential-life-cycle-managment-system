import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon.jsx";
import { PageHeader, ConnectGate, CopyField, Empty, Segmented } from "../components/ui.jsx";
import { useWallet } from "../lib/session.jsx";
import { getContracts, readableError, explorerLink } from "../lib/contracts";
import { schemaId } from "../lib/credential";
import { TEMPLATES, fieldLabel, typeName } from "../lib/templates";
import { fetchCredential } from "../lib/hooks";
import { pack, unpack, randomId } from "../lib/share";
import { absoluteLink, navigate } from "../lib/router";
import { logActivity, saveRequest, findRequest, listRequests } from "../lib/activity";
import { countdown, short, timeAgo } from "../lib/format";

const TABS = [
  { id: "new", label: "New request" },
  { id: "check", label: "Check a reply" },
  { id: "history", label: "Sent requests" },
];

const REASONS = {
  "presentation expired": "The request expired before the reply was checked.",
  "unknown credential": "That credential doesn't exist.",
  "credential revoked": "The issuer has revoked this credential.",
  "credential expired": "This credential has expired.",
  "holder is not the subject": "The person replying doesn't own this credential.",
  "issuer not trusted": "The issuing organisation is no longer trusted.",
  "bad signature":
    "The signature doesn't match. The reply may be for a different account, or it has already been used.",
};

export default function Verify({ query }) {
  const { session } = useWallet();
  const [tab, setTab] = useState(query.res ? "check" : "new");

  useEffect(() => {
    if (query.res) setTab("check");
  }, [query.res]);

  if (!session) {
    return (
      <ConnectGate
        icon="scan"
        title={query.res ? "Check a reply" : "Verify someone's credential"}
        lede="Connect the wallet you use as a service. Requests are tied to your account, so only you can check the replies."
      />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Verify"
        title={<>Ask one question, <em>get one answer</em></>}
        lede="Send someone a request link. They choose what to reveal and sign. You check the reply — you never handle their documents."
      />
      <Segmented label="Verify sections" options={TABS} value={tab} onChange={setTab} />
      {tab === "new" && <NewRequest />}
      {tab === "check" && <CheckReply initial={query.res} />}
      {tab === "history" && <History />}
    </>
  );
}

function NewRequest() {
  const { session, toast } = useWallet();
  const [service, setService] = useState("");
  const [type, setType] = useState(TEMPLATES[0].type);
  const [claims, setClaims] = useState(new Set(["name"]));
  const [minutes, setMinutes] = useState(15);
  const [link, setLink] = useState("");

  const template = TEMPLATES.find((t) => t.type === type);

  function toggle(k) {
    setClaims((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  function create() {
    const request = {
      v: 1,
      id: randomId(),
      verifier: session.address,
      service: service.trim() || "A service",
      type: type || null,
      claims: template ? [...claims].filter((k) => template.fields.some((f) => f.key === k)) : [],
      deadline: Math.floor(Date.now() / 1000) + minutes * 60,
      chainId: session.chainId,
    };
    saveRequest(session.address, { ...request, createdAt: Date.now() });
    logActivity(session.address, {
      kind: "requested",
      title: `Requested ${typeName(request.type).toLowerCase()}`,
      detail: request.service,
    });
    setLink(absoluteLink("/share", { req: pack(request) }));
    toast("Request created");
  }

  if (link) {
    return (
      <section className="panel success">
        <div className="success-icon"><Icon name="link" size={24} /></div>
        <h2>Request link ready</h2>
        <p className="lede">
          Send this to the person — by chat, email or however you like. When they reply, paste their link into
          <b> Check a reply</b>. The request expires in {minutes} minutes.
        </p>
        <CopyField label="Request link" value={link} />
        <div className="btn-row">
          <button className="btn-quiet" onClick={() => setLink("")}>Create another</button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="grid2">
        <div className="field-row">
          <label htmlFor="svc">Your service name</label>
          <input
            id="svc"
            value={service}
            onChange={(e) => setService(e.target.value)}
            placeholder="e.g. City Library, Acme Hiring"
          />
        </div>
        <div className="field-row">
          <label htmlFor="ttl">Link valid for</label>
          <select id="ttl" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={60}>1 hour</option>
            <option value={1440}>24 hours</option>
          </select>
        </div>
      </div>

      <div className="field-row">
        <label>Credential you need</label>
        <div className="type-grid">
          {TEMPLATES.map((t) => (
            <button
              key={t.type}
              type="button"
              className={`type-card ${type === t.type ? "on" : ""}`}
              onClick={() => {
                setType(t.type);
                setClaims(new Set(["name"]));
              }}
            >
              <Icon name={t.icon} size={20} />
              <b>{t.name}</b>
            </button>
          ))}
          <button
            type="button"
            className={`type-card ${type === "" ? "on" : ""}`}
            onClick={() => {
              setType("");
              setClaims(new Set());
            }}
          >
            <Icon name="spark" size={20} />
            <b>Any credential</b>
          </button>
        </div>
      </div>

      {template && (
        <div className="field-row">
          <label>Details you'd like them to reveal</label>
          <div className="check-grid">
            {template.fields.map((f) => (
              <label className="check" key={f.key}>
                <input type="checkbox" checked={claims.has(f.key)} onChange={() => toggle(f.key)} />
                {f.label}
              </label>
            ))}
          </div>
          <p className="fine">Ask for as little as you need. People are more likely to say yes.</p>
        </div>
      )}

      <div className="btn-row">
        <button className="btn-go btn-lg" onClick={create}>
          Create request link
        </button>
      </div>
    </section>
  );
}

function CheckReply({ initial }) {
  const { session, toast } = useWallet();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const reply = useMemo(() => {
    if (!initial) return null;
    try {
      return unpack(initial, "res");
    } catch {
      return { invalid: true };
    }
  }, [initial]);

  const original = reply?.requestId ? findRequest(session.address, reply.requestId) : null;

  // check automatically as soon as a reply arrives — it's free
  useEffect(() => {
    if (reply && !reply.invalid) runCheck(reply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reply, session.address]);

  function openPasted() {
    try {
      const r = unpack(text, "res");
      if (!r.credentialId || !r.signature) throw new Error();
      setText("");
      navigate("/verify", { res: pack(r) });
    } catch {
      toast("That doesn't look like a reply link.", "bad");
    }
  }

  async function runCheck(r) {
    setBusy(true);
    setOutcome(null);
    try {
      const { verificationRegistry } = getContracts(session.signer);
      const [[ok, reason], cred] = await Promise.all([
        verificationRegistry.checkPresentation.staticCall(r.credentialId, r.holder, r.deadline, r.signature),
        fetchCredential(r.credentialId),
      ]);
      const expectedType = original ? original.type : null;
      const typeOk = !expectedType || !cred || cred.schemaId === schemaId(expectedType);
      setOutcome({
        ok: ok && typeOk,
        reason: !ok ? REASONS[reason] || reason : !typeOk ? `This isn't a ${typeName(expectedType).toLowerCase()}.` : "",
        cred,
      });
    } catch (e) {
      setOutcome({ ok: false, reason: readableError(e) });
    } finally {
      setBusy(false);
    }
  }

  async function record() {
    setBusy(true);
    try {
      const { verificationRegistry } = getContracts(session.signer);
      const expected = original?.type ? schemaId(original.type) : "0x" + "0".repeat(64);
      const tx = await verificationRegistry.verifyPresentation(
        reply.credentialId,
        reply.holder,
        reply.deadline,
        expected,
        reply.signature
      );
      const receipt = await tx.wait();
      setOutcome((o) => ({ ...o, recorded: receipt.hash }));
      logActivity(session.address, {
        kind: "verified",
        title: `Verified ${outcome.cred?.template?.name || "a credential"}`,
        detail: `Holder ${short(reply.holder)}`,
      });
      toast("Verification recorded on-chain");
    } catch (e) {
      toast(readableError(e), "bad");
    } finally {
      setBusy(false);
    }
  }

  if (!reply) {
    return (
      <section className="panel narrow">
        <div className="field-row">
          <label htmlFor="res">Reply link</label>
          <textarea
            id="res"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste the link the person sent back"
          />
        </div>
        <button className="btn-go" onClick={openPasted} disabled={!text.trim()}>
          Check reply
        </button>
      </section>
    );
  }

  if (reply.invalid) {
    return <div className="note bad">That reply link is damaged. Ask the person to send it again.</div>;
  }

  const wrongAccount = reply.verifier && reply.verifier.toLowerCase() !== session.address.toLowerCase();
  const disclosed = Object.entries(reply.disclosedClaims || {}).filter(([k]) => k !== "id");

  return (
    <>
      {wrongAccount && (
        <div className="note warn">
          This reply was made for account {short(reply.verifier)}. Switch to that account in your wallet to check it.
        </div>
      )}
      {!original && (
        <div className="note info">
          This request wasn't created on this device, so the credential type can't be enforced.
        </div>
      )}

      <section className={`panel verdict ${outcome ? (outcome.ok ? "ok" : "bad") : ""}`}>
        <div className="verdict-icon">
          {busy && !outcome ? <span className="spinner" /> : <Icon name={outcome?.ok ? "check" : outcome ? "x" : "scan"} size={30} />}
        </div>
        <div>
          <h2>
            {!outcome ? "Checking…" : outcome.ok ? "Verified" : "Not verified"}
          </h2>
          <p className="lede">
            {!outcome
              ? "Asking the blockchain whether this credential is genuine and current."
              : outcome.ok
              ? `${outcome.cred?.template?.name || "Credential"} issued by ${outcome.cred?.issuerName || short(outcome.cred?.issuer || "")} is valid, and the holder signed this reply.`
              : outcome.reason}
          </p>
        </div>
      </section>

      {outcome && (
        <div className="grid2">
          <section className="panel">
            <h2>What they revealed</h2>
            {disclosed.length === 0 ? (
              <p className="fine">Nothing beyond proof that they hold the credential.</p>
            ) : (
              <div className="claims flush">
                {disclosed.map(([k, v]) => (
                  <div className="claim static" key={k}>
                    <span className="claim-key">{fieldLabel(k, reply.type)}</span>
                    <span className="claim-val">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}
            {reply.withheldClaimCount > 0 && (
              <p className="fine">
                <Icon name="lock" size={14} /> {reply.withheldClaimCount} other details stayed private.
              </p>
            )}
          </section>
          <section className="panel">
            <h2>Details</h2>
            <dl className="kv">
              <div><dt>Holder</dt><dd className="mono">{short(reply.holder, 10, 6)}</dd></div>
              <div><dt>Issuer</dt><dd>{outcome.cred?.issuerName || "—"}</dd></div>
              <div><dt>Request</dt><dd>{reply.service || "—"}</dd></div>
              <div><dt>Expires</dt><dd>{countdown(reply.deadline)}</dd></div>
            </dl>
            {outcome.ok && !outcome.recorded && (
              <div className="btn-row">
                <button className="btn-go" onClick={record} disabled={busy}>
                  {busy ? "Recording…" : "Record verification on-chain"}
                </button>
              </div>
            )}
            {outcome.recorded && (
              <div className="note ok">
                Recorded on-chain.{" "}
                {explorerLink(outcome.recorded) && (
                  <a href={explorerLink(outcome.recorded)} target="_blank" rel="noreferrer">View transaction</a>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      <div className="btn-row">
        <button className="btn-quiet" onClick={() => navigate("/verify")}>
          <Icon name="back" size={16} /> Check another reply
        </button>
      </div>
    </>
  );
}

function History() {
  const { session } = useWallet();
  const requests = listRequests(session.address);
  if (requests.length === 0) {
    return (
      <section className="panel">
        <Empty icon="link" title="No requests yet">Requests you create will be listed here.</Empty>
      </section>
    );
  }
  return (
    <section className="panel list">
      {requests.map((r) => (
        <div className="row" key={r.id}>
          <span className="row-icon"><Icon name="link" size={16} /></span>
          <span className="row-main">
            <b>{typeName(r.type)}</b>
            <small>
              {r.service} · {r.claims?.length ? r.claims.map((k) => fieldLabel(k, r.type)).join(", ") : "no details"}
            </small>
          </span>
          <span className="row-meta">
            {Number(r.deadline) > Date.now() / 1000 ? countdown(r.deadline) : `sent ${timeAgo(r.createdAt)}`}
          </span>
        </div>
      ))}
    </section>
  );
}
