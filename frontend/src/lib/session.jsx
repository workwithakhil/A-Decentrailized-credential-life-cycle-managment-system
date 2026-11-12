/**
 * App-wide wallet session: who is connected, what roles they hold,
 * which credentials they've unlocked this visit, and toast messages.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { connect as connectWallet, hasWallet, getContracts, readableError } from "./contracts";

const WalletCtx = createContext(null);
export const useWallet = () => useContext(WalletCtx);

const NO_ROLES = { isIssuer: false, issuerName: "", isOwner: false };
const DISCONNECTED_KEY = "divs:disconnected";

export function WalletProvider({ children }) {
  const [session, setSession] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [roles, setRoles] = useState(NO_ROLES);
  const [unlocked, setUnlocked] = useState({}); // credentialId -> decrypted VC
  const [toasts, setToasts] = useState([]);
  const addressRef = useRef(null);

  const toast = useCallback((message, kind = "ok") => {
    const id = Math.random();
    setToasts((t) => [...t, { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const refreshRoles = useCallback(async (address) => {
    try {
      const { issuerRegistry } = getContracts();
      const [info, owner] = await Promise.all([
        issuerRegistry.getIssuer(address),
        issuerRegistry.owner(),
      ]);
      setRoles({
        isIssuer: info.active,
        issuerName: info.name,
        isOwner: owner.toLowerCase() === address.toLowerCase(),
      });
    } catch {
      setRoles(NO_ROLES);
    }
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const s = await connectWallet();
      try { localStorage.removeItem(DISCONNECTED_KEY); } catch { /* ignore */ }
      if (addressRef.current !== s.address) setUnlocked({});
      addressRef.current = s.address;
      setSession(s);
      await refreshRoles(s.address);
      return s;
    } catch (e) {
      toast(readableError(e), "bad");
      return null;
    } finally {
      setConnecting(false);
    }
  }, [refreshRoles, toast]);

  const disconnect = useCallback(() => {
    try { localStorage.setItem(DISCONNECTED_KEY, "1"); } catch { /* ignore */ }
    addressRef.current = null;
    setSession(null);
    setUnlocked({});
    setRoles(NO_ROLES);
  }, []);

  // Reconnect silently if this site was already authorised.
  useEffect(() => {
    if (!hasWallet()) return;
    let skip = false;
    try { skip = localStorage.getItem(DISCONNECTED_KEY) === "1"; } catch { /* ignore */ }
    if (!skip) {
      window.ethereum
        .request({ method: "eth_accounts" })
        .then((accounts) => accounts.length && connect())
        .catch(() => {});
    }

    const onAccounts = (accounts) => (accounts.length ? connect() : disconnect());
    const onChain = () => window.location.reload();
    window.ethereum.on?.("accountsChanged", onAccounts);
    window.ethereum.on?.("chainChanged", onChain);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", onAccounts);
      window.ethereum.removeListener?.("chainChanged", onChain);
    };
  }, [connect, disconnect]);

  const value = {
    session,
    connecting,
    connect,
    disconnect,
    roles,
    refreshRoles,
    unlocked,
    unlock: (id, doc) => setUnlocked((u) => ({ ...u, [id]: doc })),
    toast,
    toasts,
  };

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}
