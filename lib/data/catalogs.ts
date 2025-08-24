// lib/data/catalogs.ts
import type { WallOptions, WallCoefficient, Mortar, Defaults } from "../types";

const mem = new Map<string, unknown>();
async function loadJSON<T>(path: string): Promise<T> {
  if (mem.has(path)) return mem.get(path) as T;
  const res = await fetch(path, { cache: "force-cache" });
  if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
  const data = (await res.json()) as T;
  mem.set(path, data);
  return data;
}

export function loadWallOptions() {
  return loadJSON<WallOptions>("/data/wall_options.json");
}
export function loadWallCoefficients() {
  return loadJSON<WallCoefficient[]>("/data/wall_coefficients.json");
}
export function loadMortars() {
  return loadJSON<Mortar[]>("/data/mortars.json");
}
export function loadDefaults() {
  return loadJSON<Defaults>("/data/defaults.json");
}
