// lib/calc/revestimientos.ts
import { round2 } from "./rc";

export type RevestInput = {
  tipo: string;
  L: number;   // m
  A: number;   // m
  pieza_cm: { LP: number; AP: number }; // tamaño de pieza
  junta_mm: number;
  wastePct?: number;
  coeffs?: RevestCoeffs;   // puede traer m2_por_caja o pzas_por_caja
  pastina?: PastinaCoeffs; // puede traer kg_por_m2 por junta u otros
};

export type RevestCoeffsEntry = {
  m2_por_caja?: number;
  pzas_por_caja?: number;
};
export type RevestCoeffs = Record<string, RevestCoeffsEntry> | RevestCoeffsEntry;

export type PastinaCoeffs = {
  kg_por_m2?: Record<string, number>;
  kg_por_m2_default?: number;
  kg_m2?: number;
};

export type RevestResult = {
  materiales?: Record<string, number>; // opcional (desglose si existiera)
  area_m2: number;
  modulo_m2: number;             // módulo pieza+junta
  piezas_necesarias: number;
  piezas_con_desperdicio: number;
  cajas?: number;
  pastina_kg?: number;
};

function pickCoeffs(coeffs: RevestCoeffs | undefined, tipo: string): RevestCoeffsEntry | undefined {
  if (!coeffs) return undefined;
  if ("m2_por_caja" in coeffs || "pzas_por_caja" in coeffs) {
    return coeffs as RevestCoeffsEntry;
  }
  const dict = coeffs as Record<string, RevestCoeffsEntry>;
  return dict[tipo];
}

export function calcRevestimientos(input: RevestInput): RevestResult {
  const { L, A, pieza_cm, junta_mm, wastePct = 0, tipo, coeffs, pastina } = input;
  const area = Math.max(0, L) * Math.max(0, A);
  const j_cm = Math.max(0, junta_mm) / 10; // mm -> cm

  const modL_m = (Math.max(0, pieza_cm.LP) + j_cm) / 100;
  const modA_m = (Math.max(0, pieza_cm.AP) + j_cm) / 100;
  const modulo_m2 = modL_m * modA_m || 0.000001; // evitar 0

  const piezas = Math.ceil(area / modulo_m2);
  const piezasW = Math.ceil(piezas * (1 + wastePct / 100));

  const res: RevestResult = {
    materiales: {}, // por ahora sin desglose
    area_m2: round2(area),
    modulo_m2: round2(modulo_m2),
    piezas_necesarias: piezas,
    piezas_con_desperdicio: piezasW,
  };

  // Cajas (si hay info)
  const c = pickCoeffs(coeffs, tipo);
  if (c) {
    let m2_por_caja: number | undefined = c.m2_por_caja;
    if (!m2_por_caja && typeof c.pzas_por_caja === "number") {
      m2_por_caja = c.pzas_por_caja * modulo_m2;
    }
    if (typeof m2_por_caja === "number" && m2_por_caja > 0) {
      res.cajas = Math.ceil((area * (1 + wastePct / 100)) / m2_por_caja);
    }
  }

  // Pastina (si hay info): kg por m2 según junta
  if (pastina) {
    const kg_m2: number | undefined =
      pastina.kg_por_m2?.[String(junta_mm)] ??
      pastina.kg_por_m2_default ??
      pastina.kg_m2;
    if (typeof kg_m2 === "number" && isFinite(kg_m2)) {
      res.pastina_kg = round2(kg_m2 * area * (1 + wastePct / 100));
    }
  }

  return res;
}

export default calcRevestimientos;
