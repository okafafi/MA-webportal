"use client";
import { useEffect, useState } from "react";

export function useOrgId() {
  const [orgId, setOrgId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let quit = false;
    async function run() {
      try {
        // Prefer a previously chosen org in localStorage for consistency
        const saved = typeof window !== "undefined" ? localStorage.getItem("orgId") : null;
        const url = saved ? `/api/org/me?orgId=${encodeURIComponent(saved)}` : "/api/org/me";
        const res = await fetch(url);
        const js = await res.json();
        if (!res.ok) throw new Error(js.error || "org resolve failed");
        if (quit) return;
        setOrgId(js.orgId);
        setSource(js.source);
        if (typeof window !== "undefined") localStorage.setItem("orgId", js.orgId);
      } catch (e) {
        if (quit) return;
        setError(String(e?.message || e));
      } finally {
        if (!quit) setLoading(false);
      }
    }
    run();
    return () => { quit = true; };
  }, []);

  return { orgId, loading, source, error, setOrgId };
}