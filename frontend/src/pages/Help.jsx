import Icon from "../components/Icon.jsx";
import { PageHeader } from "../components/ui.jsx";
import { CHAIN } from "../lib/contracts";
import { href } from "../lib/router";

const START = [
  {
    icon: "wallet",
    title: "Install a wallet",
    body: (
      <>
        Add the{" "}
        <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">MetaMask</a> browser extension.
        Your wallet is your account — there's no username or password.
      </>
    ),
  },
  {
    icon: "link",
    title: "Connect",
    body: <>Click <b>Connect wallet</b>. We'll ask your wallet to switch to the {CHAIN.name} network automatically.</>,
  },
  {
    icon: "user",
    title: "Share your address",
    body: <>Give your wallet address (on your <a href={href("/profile")}>Profile</a>) to the organisation issuing your credential.</>,
  },
  {
    icon: "unlock",
    title: "Unlock and use it",
    body: <>Your credential appears in your <a href={href("/wallet")}>Wallet</a>. Unlock it with the passphrase the issuer sends you.</>,
  },
];

const FAQ = [
  {
    q: "Is my personal information stored on the blockchain?",
    a: "No. Only a fingerprint (a hash) of your credential and its status are recorded. The details themselves are encrypted, and only someone with the passphrase can read them.",
  },
  {
    q: "What does a service see when I share a credential?",
    a: "Only the details you tick, plus proof that a trusted organisation issued the credential to you and that it's still valid. Everything you leave unticked stays on your device.",
  },
  {
    q: "Does it cost anything?",
    a: "Signing a reply is free. Issuing, revoking and recording a verification on-chain are blockchain transactions and need a small network fee, paid by the organisation or service doing it.",
  },
  {
    q: "I lost my passphrase. What now?",
    a: "Ask the organisation that issued the credential to revoke it and issue you a new one. Nobody else can recover it — that's what keeps it private.",
  },
  {
    q: "Why does my credential say “Revoked” or “Expired”?",
    a: "The issuing organisation withdrew it, or its validity date has passed. Services will reject it automatically. Contact the issuer if you think it's a mistake.",
  },
  {
    q: "How does my organisation become an issuer?",
    a: "The platform administrator approves organisations. Connect your organisation's wallet, open the Issue page, and send the address shown there to the administrator.",
  },
  {
    q: "A request link says it has expired.",
    a: "Requests are only valid for a short time so they can't be reused. Ask the service for a fresh link.",
  },
];

export default function Help() {
  return (
    <>
      <PageHeader
        eyebrow="Help"
        title={<>Getting <em>started</em></>}
        lede="Everything you need to start using Identity Wallet in a few minutes."
      />

      <div className="steps compact">
        {START.map((s, i) => (
          <article className="step panel" key={s.title}>
            <span className="step-num">{i + 1}</span>
            <Icon name={s.icon} size={22} />
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </article>
        ))}
      </div>

      <h2 className="section-h">Frequently asked questions</h2>
      <section className="panel faq">
        {FAQ.map((f) => (
          <details key={f.q}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>

      <section className="panel cta-panel">
        <div>
          <h2>Want to check a credential someone showed you?</h2>
          <p className="fine">You don't need an account for that.</p>
        </div>
        <a className="btn-go" href={href("/check")}>Check a credential</a>
      </section>
    </>
  );
}
