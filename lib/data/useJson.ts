"use client";
import { useEffect, useState } from "react";

/** Carga JSON desde /public/data/*.json; si falla, devuelve fallback. */
export function useJson<T>(path: string, fallback: T): T {
  const [data, setData] = useState<T>(fallback);
  useEffect(() => {
    let cancelled = false;
    fetch(path, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((j) => !cancelled && setData(j as T))
      .catch(() => !cancelled && setData(fallback));
    return () => {
      cancelled = true;
    };
  }, [path]);
  return data;
}
