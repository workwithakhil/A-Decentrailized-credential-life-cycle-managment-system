import Icon from "../components/Icon.jsx";
import { PageHeader, ConnectGate, CopyField } from "../components/ui.jsx";
import { useWallet } from "../lib/session.jsx";
import { CHAIN } from "../lib/contracts";
import { toDid } from "../lib/credential";
import { clearLocalData } from "../lib/activity";

export default function Profile() {
  const { session, roles, disconnect, toast } = useWallet();

  if (!session) {
    return <ConnectGate icon="user" title="Your profile" lede="Connect your wallet to see your account details." />;
  }

  function clear() {
    if (!window.confirm("Clear your activity history and saved requests on this device?")) return;
    clearLocalData(session.address);
    toast("Local history cleared");
  }

  const roleList = ["Holder", roles.isIssuer && `Issuer · ${roles.issuerName}`, roles.isOwner && "Administrator"].filter(Boolean);

  return (
    <>
      <PageHeader eyebrow="Profile" title={<>Your <em>account</em></>} lede="Share your address with organisations so they can issue credentials to you." />

      <section className="panel profile-card">
        <div className="avatar-lg"><Icon name="user" size={30} /></div>
        <div className="chips">
          {roleList.map((r) => <span className="chip-soft" key={r}>{r}</span>)}
        </div>
        <CopyField label="Wallet address" value={session.address} />
        <CopyField label="Decentralised identifier (DID)" value={toDid(session.address, session.chainId)} />
        <dl className="kv">
          <div><dt>Network</dt><dd>{CHAIN.name} ({session.chainId})</dd></div>
        </dl>
      </section>

      <section className="panel">
        <h2>Privacy & data</h2>
        <p className="fine">
          Your activity history and sent requests are stored only in this browser. Unlocked credentials are
          forgotten when you close the tab.
        </p>
        <div className="btn-row">
          <button className="btn-quiet" onClick={clear}>Clear local history</button>
          <button className="btn-quiet danger" onClick={disconnect}>
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      </section>
    </>
  );
}
