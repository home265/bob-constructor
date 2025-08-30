/**
 * Genera IDs legibles con prefijo.
 * Ej: rid("prj") -> "prj_k3f9v2a1c8d4"
 */
export function rid(prefix = "id"): string {
  // Usamos randomUUID si está disponible (Edge/Browser/Node >=18)
  const core =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : // Fallback estable sin dependencias
        (Math.random().toString(36).slice(2, 10) +
          Date.now().toString(36).slice(-4)).slice(0, 12);

  return `${prefix}_${core}`;
}
