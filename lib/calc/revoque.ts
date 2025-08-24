import { round2 } from "./rc";

export type RevoqueInput = {
  // ⬅️ antes: "uno" | "dos"
  lados: "uno" | "dos" | "ambos";
  term1: string;
  term2?: string | "";
  L: number;     // m
  H: number;     // m
  e_cm: number;  // cm
  wastePct?: number;
};

export type RevoqueResult = {
  area_m2: number;
  espesor_cm: number;
  mortero_m3: number;
  mortero_con_desperdicio_m3: number;
  terminaciones: string[];
};

export function calcRevoque(input: RevoqueInput): RevoqueResult {
  const { lados, term1, term2, L, H, e_cm, wastePct = 0 } = input;

  // "dos" o "ambos" cuentan como 2 caras
  const faces = lados === "uno" ? 1 : 2;

  const area = Math.max(0, L) * Math.max(0, H) * faces;
  const vol = area * (Math.max(0, e_cm) / 100);
  const fWaste = 1 + wastePct / 100;
  const volW = vol * fWaste;

  const terms = [term1, term2].filter(Boolean) as string[];

  return {
    area_m2: round2(area),
    espesor_cm: round2(e_cm),
    mortero_m3: round2(vol),
    mortero_con_desperdicio_m3: round2(volW),
    terminaciones: terms,
  };
}

export default calcRevoque;
