import { round2 } from "./rc";

export type ContrapisoInput = {
  tipo: string;
  L: number;      // m
  A: number;      // m
  Hcm: number;    // cm
  malla?: string; // id o "no"
  wastePct?: number;
  coeffs?: Record<string, Record<string, number>>; // por m3 (ej: cemento_kg, arena_m3, etc.)
};

export type ContrapisoResult = {
  area_m2: number;
  espesor_cm: number;
  volumen_m3: number;
  volumen_con_desperdicio_m3: number;
  malla_m2: number;
  materiales: Record<string, number>; // si hay coeffs
};

export function calcContrapiso(input: ContrapisoInput): ContrapisoResult {
  const { L, A, Hcm, wastePct = 0, malla, coeffs, tipo } = input;

  const area = Math.max(0, L) * Math.max(0, A);
  const vol = area * (Math.max(0, Hcm) / 100);
  const fWaste = 1 + wastePct / 100;
  const volW = vol * fWaste;

  // Materiales desde coeffs (por m3)
  const materiales: Record<string, number> = {};
  const per = coeffs?.[tipo];
  if (per && typeof per === "object") {
    for (const [k, v] of Object.entries(per)) {
      if (typeof v === "number" && isFinite(v)) {
        materiales[k] = round2(v * volW);
      }
    }
  }

  const malla_m2 = malla && malla !== "no" ? round2(area * fWaste) : 0;

  return {
    area_m2: round2(area),
    espesor_cm: round2(Hcm),
    volumen_m3: round2(vol),
    volumen_con_desperdicio_m3: round2(volW),
    malla_m2,
    materiales,
  };
}

export default calcContrapiso;
