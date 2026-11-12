import { useState } from "react";
import Icon from "./Icon.jsx";
import { useWallet } from "../lib/session.jsx";
import { hasWallet, CHAIN, STATUS_LABEL, STATUS_CLASS } from "../lib/contracts";

export function PageHeader({ eyebrow, title, lede, children }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </header>
  );
}

/** Shown in place of a page that needs a connected wallet. */
export function ConnectGate({ title, lede, icon = "wallet" }) {
  const { connect, connecting } = useWallet();
  return (
    <section className="gate panel">
      <div className="gate-icon"><Icon name={icon} size={28} /></div>
      <h2>{title}</h2>
      <p className="lede">{lede}</p>
      {hasWallet() ? (
        <button className="btn-go" onClick={connect} disabled={connecting}>
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>
      ) : (
        <>
          <a className="btn-go" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
            Install MetaMask
          </a>
          <p className="fine">
            You'll need a wallet to sign in. After installing, reload this page.
          </p>
        </>
      )}
      <p className="fine">Network: {CHAIN.name}</p>
    </section>
  );
}

export function CopyField({ label, value, multiline = false }) {
  const { toast } = useWallet();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast("Couldn't copy — select the text and copy it manually.", "bad");
    }
  }
  return (
    <div className="copyfield">
      {label && <span className="copyfield-label">{label}</span>}
      <div className="copyfield-row">
        {multiline ? (
          <textarea readOnly value={value} onFocus={(e) => e.target.select()} />
        ) : (
          <input readOnly value={value} onFocus={(e) => e.target.select()} />
        )}
        <button className="btn-icon" onClick={copy} title="Copy" aria-label={`Copy ${label || "value"}`}>
          <Icon name={copied ? "check" : "copy"} />
        </button>
      </div>
    </div>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={`status ${STATUS_CLASS[status] || "is-unknown"}`}>
      {STATUS_LABEL[status] || "Unknown"}
    </span>
  );
}

export function Empty({ icon = "spark", title, children }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={26} />
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          className="seg-btn"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
        >
          {o.label}
          {o.count !== undefined && <span className="seg-count">{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Spinner() {
  return <span className="spinner" aria-label="Loading" />;
}
