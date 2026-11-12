import { useCallback, useEffect, useState } from "react";
import { getContracts, readableError } from "./contracts";
import { templateBySchema } from "./templates";

async function issuerNames(addresses) {
  const { issuerRegistry } = getContracts();
  const unique = [...new Set(addresses)];
  const infos = await Promise.all(
    unique.map((a) => issuerRegistry.getIssuer(a).catch(() => null))
  );
  return Object.fromEntries(
    unique.map((a, i) => [a, { name: infos[i]?.name || "", active: !!infos[i]?.active }])
  );
}

/** Full on-chain record for one credential, or null if it doesn't exist. */
export async function fetchCredential(id) {
  const { credentialRegistry } = getContracts();
  const [c, status] = await Promise.all([
    credentialRegistry.getCredential(id),
    credentialRegistry.statusOf(id),
  ]);
  if (Number(c.issuedAt) === 0) return null;
  const names = await issuerNames([c.issuer]);
  return shape(id, c, Number(status), names);
}

function shape(id, c, status, names) {
  return {
    id,
    issuer: c.issuer,
    issuerName: names[c.issuer]?.name,
    issuerActive: names[c.issuer]?.active,
    subject: c.subject,
    schemaId: c.schemaId,
    template: templateBySchema(c.schemaId),
    issuedAt: Number(c.issuedAt),
    expiresAt: Number(c.expiresAt),
    revoked: c.revoked,
    uri: c.encryptedUri,
    status,
  };
}

/** Every credential held by `address`, newest first. */
export function useCredentials(address) {
  const [creds, setCreds] = useState([]);
  const [loading, setLoading] = useState(!!address);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError("");
    try {
      const { credentialRegistry } = getContracts();
      const ids = await credentialRegistry.credentialsOf(address);
      const rows = await Promise.all(
        ids.map((id) =>
          Promise.all([credentialRegistry.getCredential(id), credentialRegistry.statusOf(id)])
        )
      );
      const names = await issuerNames(rows.map(([c]) => c.issuer));
      setCreds(
        rows
          .map(([c, status], i) => shape(ids[i], c, Number(status), names))
          .sort((a, b) => b.issuedAt - a.issuedAt)
      );
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  return { creds, loading, error, reload: load };
}

/** The public directory of registered issuers. */
export function useIssuers() {
  const [issuers, setIssuers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { issuerRegistry } = getContracts();
      const count = Number(await issuerRegistry.issuerCount());
      const addrs = await Promise.all(
        Array.from({ length: count }, (_, i) => issuerRegistry.issuerAt(i))
      );
      const infos = await Promise.all(addrs.map((a) => issuerRegistry.getIssuer(a)));
      setIssuers(
        addrs.map((address, i) => ({
          address,
          name: infos[i].name,
          active: infos[i].active,
          registeredAt: Number(infos[i].registeredAt),
        }))
      );
    } catch (e) {
      setError(readableError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { issuers, loading, error, reload: load };
}
