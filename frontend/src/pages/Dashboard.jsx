import Icon from "../components/Icon.jsx";
import { PageHeader, ConnectGate, Empty } from "../components/ui.jsx";
import { useWallet } from "../lib/session.jsx";
import { useCredentials } from "../lib/hooks";
import { listActivity } from "../lib/activity";
import { href } from "../lib/router";
import { short, timeAgo } from "../lib/format";

const ACTIVITY_ICON = {
  issued: "stamp",
  revoked: "x",
  shared: "send",
  requested: "link",
  verified: "check",
  rejected: "x",
  registered: "building",
};

export default function Dashboard() {
  const { session, roles } = useWallet();
  const { creds, loading } = useCredentials(session?.address);

  if (!session) {
    return (
      <ConnectGate
        icon="home"
        title="Welcome to Identity Wallet"
        lede="Connect your wallet to see your credentials, respond to requests and verify others. Your wallet is your account — there's no password to remember."
      />
    );
  }

  const activity = listActivity(session.address);
  const valid = creds.filter((c) => c.status === 1).length;
  const shared = activity.filter((a) => a.kind === "shared").length;
  const verified = activity.filter((a) => a.kind === "verified").length;

  const actions = [
    { to: "/wallet", icon: "wallet", title: "My credentials", body: "View, unlock and manage what you hold." },
    { to: "/share", icon: "send", title: "Respond to a request", body: "Open a link a service sent you." },
    { to: "/verify", icon: "scan", title: "Verify someone", body: "Ask for proof and check the answer." },
    { to: "/check", icon: "search", title: "Check a credential", body: "Look up whether one is still valid." },
  ];
  if (roles.isIssuer)
    actions.unshift({ to: "/issue", icon: "stamp", title: "Issue a credential", body: `Sign as ${roles.issuerName}.` });
  if (roles.isOwner)
    actions.push({ to: "/admin", icon: "shield", title: "Manage issuers", body: "Approve or pause organisations." });

  return (
    <>
      <PageHeader
        eyebrow={roles.isIssuer ? roles.issuerName : "Your dashboard"}
        title={<>Welcome back</>}
        lede={`Signed in as ${short(session.address)}. Here's what's happening with your identity.`}
      />

      <div className="stats">
        <div className="tile">
          <span className="tile-label">Credentials held</span>
          <b>{loading ? "…" : creds.length}</b>
        </div>
        <div className="tile">
          <span className="tile-label">Currently valid</span>
          <b>{loading ? "…" : valid}</b>
        </div>
        <div className="tile">
          <span className="tile-label">Times shared</span>
          <b>{shared}</b>
        </div>
        <div className="tile">
          <span className="tile-label">People verified</span>
          <b>{verified}</b>
        </div>
      </div>

      <h2 className="section-h">Quick actions</h2>
      <div className="actions">
        {actions.map((a) => (
          <a className="action panel" key={a.to} href={href(a.to)}>
            <span className="action-icon"><Icon name={a.icon} size={20} /></span>
            <span>
              <b>{a.title}</b>
              <small>{a.body}</small>
            </span>
            <Icon name="arrow" size={16} className="action-go" />
          </a>
        ))}
      </div>

      <h2 className="section-h">Recent activity</h2>
      <section className="panel list">
        {activity.length === 0 ? (
          <Empty icon="clock" title="No activity yet">
            Things you issue, share and verify will show up here.
          </Empty>
        ) : (
          activity.slice(0, 8).map((a, i) => (
            <div className="row" key={i}>
              <span className={`row-icon kind-${a.kind}`}>
                <Icon name={ACTIVITY_ICON[a.kind] || "spark"} size={16} />
              </span>
              <span className="row-main">
                <b>{a.title}</b>
                {a.detail && <small>{a.detail}</small>}
              </span>
              <span className="row-meta">{timeAgo(a.at)}</span>
            </div>
          ))
        )}
      </section>
    </>
  );
}
