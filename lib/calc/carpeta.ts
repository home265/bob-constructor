import { round2 } from "./rc";

export type CarpetaInput = {
  tipo: string;            // ej "1_3"
  hidro?: string;          // "si" | "no" (opcional por ahora)
  L: number;               // m
  A: number;               // m
  Hcm: number;             // cm
  wastePct?: number;       // %
  mixMap?: any;            // array de { carpeta_id, mortero_id } o similar
  morteros?: Record<string, any>; // diccionario mortero_id -> ficha de mortero
};

export type CarpetaResult = {
  area_m2: number;
  espesor_cm: number;
  volumen_m3: number;
  volumen_con_desperdicio_m3: number;
  mortero_id?: string;
  materiales: Record<string, number>;
  modo: "per_m3" | "per_m2cm" | "simple";
};

function findMorteroId(tipo: string, mixMap: any): string | undefined {
  if (!mixMap) return;
  // si es ARRAY: { carpeta_id, mortero_id }
  if (Array.isArray(mixMap)) {
    const hit = mixMap.find((r) => r?.carpeta_id === tipo || r?.id === tipo);
    return hit?.mortero_id;
  }
  // si es OBJ key->value
  if (typeof mixMap === "object") {
    return mixMap[tipo]?.mortero_id ?? mixMap[tipo];
  }
  return;
}

export function calcCarpeta(input: CarpetaInput): CarpetaResult {
  const { L, A, Hcm, wastePct = 0, tipo, mixMap, morteros } = input;

  const area = Math.max(0, L) * Math.max(0, A);
  const vol = area * (Math.max(0, Hcm) / 100);
  const fWaste = 1 + wastePct / 100;
  const volW = vol * fWaste;

  const materiales: Record<string, number> = {};
  let modo: CarpetaResult["modo"] = "simple";
  let mortero_id: string | undefined;

  // 1) Resolver mortero_id desde mixMap
  mortero_id = findMorteroId(tipo, mixMap);

  // 2) Si tengo morteros y mortero_id, aplico rendimientos
  if (mortero_id && morteros && morteros[mortero_id]) {
    const ficha = morteros[mortero_id];
    const porM3 = ficha?.per_m3;
    const porM2cm = ficha?.per_m2cm;

    if (porM3 && typeof porM3 === "object") {
      for (const [k, v] of Object.entries(porM3)) {
        if (typeof v === "number" && isFinite(v)) {
          materiales[k] = round2(v * volW);
        }
      }
      modo = "per_m3";
    } else if (porM2cm && typeof porM2cm === "object") {
      const factor = area * (Math.max(0, Hcm)) * fWaste; // m2*cm
      for (const [k, v] of Object.entries(porM2cm)) {
        if (typeof v === "number" && isFinite(v)) {
          materiales[k] = round2(v * factor);
        }
      }
      modo = "per_m2cm";
    }
  }

  return {
    area_m2: round2(area),
    espesor_cm: round2(Hcm),
    volumen_m3: round2(vol),
    volumen_con_desperdicio_m3: round2(volW),
    mortero_id,
    materiales,
    modo,
  };
}

export default calcCarpeta;
