export const short = (a, head = 6, tail = 4) =>
  a ? `${a.slice(0, head)}…${a.slice(-tail)}` : "";

export const fmtDate = (sec) =>
  Number(sec)
    ? new Date(Number(sec) * 1000).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

export const humanize = (key) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim();

export function timeAgo(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(ms).toLocaleDateString();
}

export function countdown(deadlineSec) {
  const left = Number(deadlineSec) - Math.floor(Date.now() / 1000);
  if (left <= 0) return "expired";
  const m = Math.floor(left / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min left` : `${m} min ${left % 60} s left`;
}
