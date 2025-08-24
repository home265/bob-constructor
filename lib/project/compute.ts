import { MaterialLine, Project } from "./types";

export function aggregateMaterials(p: Project): MaterialLine[] {
  const map = new Map<string, MaterialLine>();
  for (const part of p.partes) {
    for (const m of (part.materials || [])) {
      const key = `${m.key}|${m.unit}`;
      const prev = map.get(key);
      if (prev) prev.qty += m.qty;
      else map.set(key, { ...m });
    }
  }
  // redondeo suave + orden estable por label
  return Array.from(map.values())
    .map(m => ({ ...m, qty: Math.round(m.qty * 100) / 100 }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
