import { useEffect, useState } from "react";
import Icon from "./components/Icon.jsx";
import { useWallet } from "./lib/session.jsx";
import { useRoute, href } from "./lib/router";
import { hasWallet } from "./lib/contracts";
import { short } from "./lib/format";

import Landing from "./pages/Landing.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Wallet from "./pages/Wallet.jsx";
import Share from "./pages/Share.jsx";
import Verify from "./pages/Verify.jsx";
import Check from "./pages/Check.jsx";
import Issuers from "./pages/Issuers.jsx";
import Issue from "./pages/Issue.jsx";
import Admin from "./pages/Admin.jsx";
import Help from "./pages/Help.jsx";
import Profile from "./pages/Profile.jsx";

const PAGES = {
  "/dashboard": { component: Dashboard, title: "Home" },
  "/wallet": { component: Wallet, title: "Wallet" },
  "/share": { component: Share, title: "Share" },
  "/verify": { component: Verify, title: "Verify" },
  "/check": { component: Check, title: "Check status" },
  "/issuers": { component: Issuers, title: "Issuers" },
  "/issue": { component: Issue, title: "Issue" },
  "/admin": { component: Admin, title: "Admin" },
  "/help": { component: Help, title: "Help" },
  "/profile": { component: Profile, title: "Profile" },
};

function navGroups(roles) {
  return [
    {
      section: "Personal",
      items: [
        { path: "/dashboard", label: "Home", icon: "home" },
        { path: "/wallet", label: "Wallet", icon: "wallet" },
        { path: "/share", label: "Share", icon: "send" },
      ],
    },
    {
      section: "Services",
      items: [
        { path: "/verify", label: "Verify", icon: "scan" },
        { path: "/check", label: "Check status", icon: "search" },
        { path: "/issuers", label: "Issuers", icon: "building" },
      ],
    },
    {
      section: "Organisation",
      items: [
        { path: "/issue", label: "Issue", icon: "stamp" },
        roles.isOwner && { path: "/admin", label: "Admin", icon: "shield" },
      ].filter(Boolean),
    },
    {
      section: "Account",
      items: [
        { path: "/profile", label: "Profile", icon: "user" },
        { path: "/help", label: "Help", icon: "help" },
      ],
    },
  ];
}

const TABBAR = [
  { path: "/dashboard", label: "Home", icon: "home" },
  { path: "/wallet", label: "Wallet", icon: "wallet" },
  { path: "/verify", label: "Verify", icon: "scan" },
  { path: "/check", label: "Check", icon: "search" },
];

export default function App() {
  const route = useRoute();
  const { session, roles, connect, connecting, toasts } = useWallet();
  const [drawer, setDrawer] = useState(false);
  const nav = navGroups(roles);

  useEffect(() => setDrawer(false), [route.path]);

  const page = PAGES[route.path];
  useEffect(() => {
    document.title = page ? `${page.title} · Identity Wallet` : "Identity Wallet";
  }, [page]);

  const backdrop = (
    <div className="field" aria-hidden="true">
      <div className="blob" /><div className="blob" /><div className="blob" /><div className="blob" />
    </div>
  );

  const toastStack = (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div className={`toast ${t.kind}`} key={t.id}>
          <Icon name={t.kind === "bad" ? "x" : "check"} size={16} /> {t.message}
        </div>
      ))}
    </div>
  );

  if (route.path === "/" || !page) {
    return (
      <>
        {backdrop}
        {route.path === "/" ? <Landing /> : <NotFound />}
        {toastStack}
      </>
    );
  }

  const Page = page.component;

  return (
    <>
      {backdrop}
      <div className="app">
        <aside className={`sidebar ${drawer ? "open" : ""}`}>
          <a className="brand" href={href("/")}>
            <span className="brand-mark"><Icon name="shield" size={18} /></span>
            Identity <em>Wallet</em>
          </a>
          <nav aria-label="Main">
            {nav.map((group) => (
              <div className="nav-group" key={group.section}>
                <span className="nav-section">{group.section}</span>
                {group.items.map((item) => (
                  <a
                    key={item.path}
                    className="nav-link"
                    href={href(item.path)}
                    aria-current={route.path === item.path ? "page" : undefined}
                  >
                    <Icon name={item.icon} /> {item.label}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </aside>
        {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}

        <div className="main">
          <header className="topbar">
            <button className="btn-icon menu-btn" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Icon name="menu" />
            </button>
            <span className="topbar-title">{page.title}</span>
            {session ? (
              <a className="chip" href={href("/profile")}>
                <span className="pip" />
                <span className="addr">{short(session.address)}</span>
                {roles.isIssuer && <span className="chip-role">{roles.issuerName}</span>}
              </a>
            ) : hasWallet() ? (
              <button className="btn-go" onClick={connect} disabled={connecting}>
                {connecting ? "Connecting…" : "Connect wallet"}
              </button>
            ) : (
              <a className="btn-go" href="https://metamask.io/download/" target="_blank" rel="noreferrer">
                Get a wallet
              </a>
            )}
          </header>

          <main className="content">
            <Page query={route.query} />
          </main>
        </div>
      </div>

      <nav className="tabbar" aria-label="Quick">
        {TABBAR.map((t) => (
          <a key={t.path} href={href(t.path)} aria-current={route.path === t.path ? "page" : undefined}>
            <Icon name={t.icon} size={20} />
            <span>{t.label}</span>
          </a>
        ))}
        <button onClick={() => setDrawer(true)}>
          <Icon name="menu" size={20} />
          <span>More</span>
        </button>
      </nav>
      {toastStack}
    </>
  );
}

function NotFound() {
  return (
    <div className="notfound">
      <h1>Page not found</h1>
      <p className="lede">The link may be broken, or the page may have moved.</p>
      <a className="btn-go" href={href("/dashboard")}>Go to the app</a>
    </div>
  );
}
