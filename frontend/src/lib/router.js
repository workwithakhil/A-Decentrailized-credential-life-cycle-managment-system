/**
 * A tiny hash router. Hash routes work on any static host with no
 * server-side rewrite rules, which keeps deployment trivial.
 */
import { useEffect, useState } from "react";

function parse() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, qs = ""] = raw.split("?");
  return { path: path || "/", query: Object.fromEntries(new URLSearchParams(qs)) };
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function href(path, query) {
  const qs = query ? "?" + new URLSearchParams(query).toString() : "";
  return `#${path}${qs}`;
}

export function navigate(path, query) {
  window.location.hash = href(path, query).slice(1);
}

/** Absolute URL for sharing outside the app. */
export function absoluteLink(path, query) {
  return `${window.location.origin}${window.location.pathname}${href(path, query)}`;
}
