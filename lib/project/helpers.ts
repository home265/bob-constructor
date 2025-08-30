// lib/project/helpers.ts
import type { MaterialRow, Unit } from "./types";

/** Normaliza strings comunes a nuestro tipo Unit */
export function toUnit(u?: string): Unit {
  const t = (u ?? "").trim().toLowerCase();

  // equivalencias y símbolos
  if (t === "u" || t === "unidad" || t === "unidades" || t === "und" || t === "uds" || t === "caja" || t === "cajas" || t === "bolsa" || t === "bolsas") return "u";
  if (t === "m" || t === "mt" || t === "mts" || t === "metro" || t === "metros") return "m";
  if (t === "m2" || t === "m²" || t === "m^2" || t === "mt2" || t === "mts2") return "m2";
  if (t === "m3" || t === "m³" || t === "m^3" || t === "mt3" || t === "mts3") return "m3";
  if (t === "kg" || t === "kilogramo" || t === "kilogramos") return "kg";
  if (t === "l" || t === "lt" || t === "lts" || t === "litro" || t === "litros") return "l";

  // fallback seguro
  return "u";
}

/** Genera una key estable (slug) a partir de una etiqueta */
export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Convierte filas de ResultTable -> materiales unificables (UI) */
export function rowsToMaterials(
  items: Array<{ key?: string; label: string; qty: number; unit: string }>
): MaterialRow[] {
  return items.map((it) => ({
    key: it.key ?? slug(it.label),
    label: it.label,
    qty: Number.isFinite(it.qty) ? it.qty : 0,
    unit: toUnit(it.unit),
  }));
}
