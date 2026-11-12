import { useEffect, useState } from "react";
import Icon from "../components/Icon.jsx";
import { href } from "../lib/router";
import { getContracts } from "../lib/contracts";
import { useWallet } from "../lib/session.jsx";

const STEPS = [
  {
    icon: "stamp",
    title: "An organisation issues it",
    body: "Your university, employer or club signs a credential for you. Only a fingerprint goes on the blockchain — never your details.",
  },
  {
    icon: "wallet",
    title: "You keep it",
    body: "The credential lives in your wallet, encrypted. Nobody can read it or share it without you.",
  },
  {
    icon: "send",
    title: "You prove it, in one tap",
    body: "When a service asks, you choose exactly which details to reveal and sign. They get an answer — not your documents.",
  },
];

const AUDIENCES = [
  {
    icon: "user",
    title: "For people",
    body: "Stop emailing scans of your ID. Share only what's needed, see who asked, and stay in control.",
    cta: "Open my wallet",
    to: "/wallet",
  },
  {
    icon: "building",
    title: "For organisations",
    body: "Issue tamper-proof credentials from ready-made templates, and revoke them instantly if something changes.",
    cta: "Issue credentials",
    to: "/issue",
  },
  {
    icon: "scan",
    title: "For services",
    body: "Send a request link, get a signed answer back, and confirm it on-chain in seconds. No paperwork to store.",
    cta: "Verify someone",
    to: "/verify",
  },
];

export default function Landing() {
  const { session } = useWallet();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { issuerRegistry, verificationRegistry } = getContracts();
        const [issuers, verifications] = await Promise.all([
          issuerRegistry.issuerCount(),
          verificationRegistry.totalVerifications(),
        ]);
        setStats({ issuers: Number(issuers), verifications: Number(verifications) });
      } catch {
        setStats(null);
      }
    })();
  }, []);

  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="landing">
      <nav className="landing-nav">
        <a className="brand" href={href("/")}>
          <span className="brand-mark"><Icon name="shield" size={18} /></span>
          Identity <em>Wallet</em>
        </a>
        <div className="landing-links">
          <button className="link-btn" onClick={() => scrollTo("how")}>How it works</button>
          <a href={href("/check")}>Check a credential</a>
          <a href={href("/issuers")}>Issuers</a>
          <a href={href("/help")}>Help</a>
          <a className="btn-go" href={href("/dashboard")}>
            {session ? "Go to app" : "Open app"}
          </a>
        </div>
      </nav>

      <section className="hero">
        <p className="eyebrow">Your identity, on your terms</p>
        <h1 className="hero-title">
          Prove who you are <em>without handing over your documents</em>
        </h1>
        <p className="hero-lede">
          Identity Wallet lets organisations issue digital credentials, lets you
          keep them privately, and lets any service verify them instantly — while
          you decide exactly what gets shared.
        </p>
        <div className="btn-row hero-ctas">
          <a className="btn-go btn-lg" href={href("/dashboard")}>
            Get started <Icon name="arrow" />
          </a>
          <a className="btn-quiet btn-lg" href={href("/check")}>
            Check a credential
          </a>
        </div>
        {stats && (
          <div className="hero-stats">
            <div><b>{stats.issuers}</b><span>trusted issuers</span></div>
            <div><b>{stats.verifications}</b><span>verifications on-chain</span></div>
            <div><b>0</b><span>personal details on-chain</span></div>
          </div>
        )}
      </section>

      <section id="how" className="landing-section">
        <p className="eyebrow">How it works</p>
        <h2 className="section-title">Three steps, <em>no paperwork</em></h2>
        <div className="steps">
          {STEPS.map((s, i) => (
            <article className="step panel" key={s.title}>
              <span className="step-num">{i + 1}</span>
              <Icon name={s.icon} size={24} />
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <p className="eyebrow">Who it's for</p>
        <h2 className="section-title">One service, <em>three sides</em></h2>
        <div className="audiences">
          {AUDIENCES.map((a) => (
            <article className="audience panel" key={a.title}>
              <div className="audience-icon"><Icon name={a.icon} size={22} /></div>
              <h3>{a.title}</h3>
              <p>{a.body}</p>
              <a className="text-link" href={href(a.to)}>
                {a.cta} <Icon name="arrow" size={15} />
              </a>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section">
        <div className="promise panel">
          <div>
            <h2 className="section-title">Private by design</h2>
            <ul className="ticks">
              <li><Icon name="check" /> Details are encrypted before they leave the issuer</li>
              <li><Icon name="check" /> Only a fingerprint is stored on the blockchain</li>
              <li><Icon name="check" /> You reveal individual details, never the whole document</li>
              <li><Icon name="check" /> Revoked or expired credentials are rejected automatically</li>
            </ul>
          </div>
          <a className="btn-go btn-lg" href={href("/dashboard")}>
            Create your wallet <Icon name="arrow" />
          </a>
        </div>
      </section>

      <footer className="landing-foot">
        <span>© {new Date().getFullYear()} Identity Wallet</span>
        <div>
          <a href={href("/help")}>Help & FAQ</a>
          <a href={href("/issuers")}>Trusted issuers</a>
          <a href={href("/check")}>Check status</a>
        </div>
      </footer>
    </div>
  );
}
