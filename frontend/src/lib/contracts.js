import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";

import addresses from "../abis/addresses.json";
import network from "../abis/network.json";
import DIDRegistry from "../abis/DIDRegistry.json";
import IssuerRegistry from "../abis/IssuerRegistry.json";
import CredentialRegistry from "../abis/CredentialRegistry.json";
import VerificationRegistry from "../abis/VerificationRegistry.json";

const AMOY = {
  chainId: "0x13882", // 80002
  chainName: "Polygon Amoy",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: ["https://rpc-amoy.polygon.technology"],
  blockExplorerUrls: ["https://amoy.polygonscan.com"],
};

const LOCAL = {
  chainId: "0x7a69", // 31337
  chainName: "Localhost 8545",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: ["http://127.0.0.1:8545"],
};

/** The chain this site is deployed against (written by scripts/deploy.js). */
export const CHAIN = {
  id: Number(import.meta.env.VITE_CHAIN_ID || network.chainId),
  rpcUrl: import.meta.env.VITE_RPC_URL || network.rpcUrl,
};
CHAIN.params = CHAIN.id === 80002 ? AMOY : LOCAL;
CHAIN.name = CHAIN.params.chainName;

export function hasWallet() {
  return typeof window !== "undefined" && !!window.ethereum;
}

let _read;
/** Read-only provider — lets public pages work without a wallet. */
export function readProvider() {
  if (!_read) _read = new JsonRpcProvider(CHAIN.rpcUrl, CHAIN.id, { staticNetwork: true });
  return _read;
}

/** Ask the wallet to switch to this site's chain, adding it if unknown. */
export async function switchNetwork() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN.params.chainId }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [CHAIN.params],
      });
    } else {
      throw err;
    }
  }
}

/** Connect MetaMask and return { provider, signer, address, chainId }. */
export async function connect() {
  if (!hasWallet()) {
    throw new Error("No wallet found. Install MetaMask to continue.");
  }
  let provider = new BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  let net = await provider.getNetwork();
  if (Number(net.chainId) !== CHAIN.id) {
    await switchNetwork();
    provider = new BrowserProvider(window.ethereum);
    net = await provider.getNetwork();
  }
  const signer = await provider.getSigner();
  return {
    provider,
    signer,
    address: await signer.getAddress(),
    chainId: Number(net.chainId),
  };
}

export function getContracts(signerOrProvider = readProvider()) {
  return {
    didRegistry: new Contract(addresses.DIDRegistry, DIDRegistry.abi, signerOrProvider),
    issuerRegistry: new Contract(addresses.IssuerRegistry, IssuerRegistry.abi, signerOrProvider),
    credentialRegistry: new Contract(
      addresses.CredentialRegistry,
      CredentialRegistry.abi,
      signerOrProvider
    ),
    verificationRegistry: new Contract(
      addresses.VerificationRegistry,
      VerificationRegistry.abi,
      signerOrProvider
    ),
  };
}

export { addresses };

export const STATUS_LABEL = ["Not found", "Valid", "Expired", "Revoked"];
export const STATUS_CLASS = ["is-unknown", "is-valid", "is-expired", "is-revoked"];

/** Block-explorer link, or null on a local chain that has none. */
export function explorerLink(hashOrAddress, kind = "tx") {
  if (CHAIN.id !== 80002) return null;
  return `${AMOY.blockExplorerUrls[0]}/${kind}/${hashOrAddress}`;
}

/** Turn a contract revert into something a person can read. */
export function readableError(err) {
  const raw =
    err?.info?.error?.message ||
    err?.shortMessage ||
    err?.reason ||
    err?.message ||
    "Something went wrong";

  if (raw.includes("NotActiveIssuer")) return "This account is not a registered issuer.";
  if (raw.includes("CredentialExists")) return "That credential has already been issued.";
  if (raw.includes("CredentialNotFound")) return "No credential exists with that ID.";
  if (raw.includes("NotCredentialIssuer")) return "Only the organisation that issued it can revoke it.";
  if (raw.includes("AlreadyRevoked")) return "That credential is already revoked.";
  if (raw.includes("CredentialNotValid")) return "The credential is expired or revoked.";
  if (raw.includes("WrongSchema")) return "That credential is not the type that was requested.";
  if (raw.includes("BadSignature")) return "The signature does not match the credential holder.";
  if (raw.includes("IssuerNotTrusted")) return "The issuing organisation is no longer recognised.";
  if (raw.includes("PresentationExpired")) return "This request has expired. Ask for a new one.";
  if (raw.includes("OwnableUnauthorizedAccount")) return "Only the platform administrator can do that.";
  if (raw.includes("already registered")) return "That address is already a registered issuer.";
  if (raw.includes("user rejected") || raw.includes("User denied")) return "You cancelled the request in your wallet.";
  if (raw.includes("could not detect network") || raw.includes("ECONNREFUSED") || raw.includes("Failed to fetch"))
    return "Can't reach the network right now. Please try again shortly.";
  return raw;
}
