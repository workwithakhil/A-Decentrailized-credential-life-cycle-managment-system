/**
 * Per-account activity history and the verifier's outstanding requests.
 * Kept on this device only — nothing here is sent anywhere.
 */

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — history is a convenience, not a requirement */
  }
};

const activityKey = (a) => `divs:activity:${a.toLowerCase()}`;
const requestsKey = (a) => `divs:requests:${a.toLowerCase()}`;

export const listActivity = (address) => read(activityKey(address), []);

/** kind: issued | revoked | shared | requested | verified | rejected */
export function logActivity(address, entry) {
  const list = listActivity(address);
  list.unshift({ ...entry, at: Date.now() });
  write(activityKey(address), list.slice(0, 60));
}

export const listRequests = (address) => read(requestsKey(address), []);

export function saveRequest(address, request) {
  const list = listRequests(address).filter((r) => r.id !== request.id);
  list.unshift(request);
  write(requestsKey(address), list.slice(0, 40));
}

export const findRequest = (address, id) =>
  listRequests(address).find((r) => r.id === id);

export function clearLocalData(address) {
  try {
    localStorage.removeItem(activityKey(address));
    localStorage.removeItem(requestsKey(address));
  } catch {
    /* ignore */
  }
}
