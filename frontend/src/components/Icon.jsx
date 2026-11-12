const PATHS = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  wallet: "M3 7h15a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7zm0 0V6a2 2 0 0 1 2-2h11v3M16 14h2",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M8 12l3 3 5-6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5",
  building: "M4 21V5l8-3 8 3v16M2 21h20M9 21v-5h6v5M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01",
  stamp: "M12 3a3 3 0 0 0-3 3c0 2 1.5 3 1.5 5H8a3 3 0 0 0-3 3v2h14v-2a3 3 0 0 0-3-3h-2.5c0-2 1.5-3 1.5-5a3 3 0 0 0-3-3zM5 20h14",
  shield: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6zM9 12l2 2 4-4",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  check: "M5 12l5 5L20 7",
  x: "M6 6l12 12M18 6 6 18",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  unlock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 7.6-1.8",
  menu: "M4 6h16M4 12h16M4 18h16",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  arrow: "M5 12h14M13 6l6 6-6 6",
  back: "M19 12H5M11 6l-6 6 6 6",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7",
  badge: "M4 5h16v14H4zM8 10a2 2 0 1 0 4 0 2 2 0 0 0-4 0M6.5 16a3.5 3.5 0 0 1 7 0M15 9h3M15 12h3",
  award: "M12 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM8.5 14 7 22l5-3 5 3-1.5-8",
  briefcase: "M3 7h18v13H3zM8 7V4h8v3M3 13h18",
  card: "M3 5h18v14H3zM3 10h18M7 15h4",
  calendar: "M4 5h16v16H4zM4 10h16M8 3v4M16 3v4",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6",
};

export default function Icon({ name, size = 18, className = "" }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] || PATHS.spark} />
    </svg>
  );
}
