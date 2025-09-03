// lib/calc/losa.ts
import { round2 } from "@/lib/calc/rc";

export type LosaInput = {
  // Geometría
  Lx_m: number;      // largo X (m)
  Ly_m: number;      // largo Y (m)
  H_cm: number;      // espesor (cm)
  cover_cm?: number; // recubrimiento borde (cm)

  // Hormigón / desperdicio
  concreteClassId?: string;
  wastePct?: number;

  // Opción 1: Malla
  mallaId?: string | "";
  meshTable?: Record<string, { kg_m2?: number; label?: string }>;
  meshDoubleLayer?: boolean;

  // Opción 2: Barras
  bars?: {
    phi_x_mm?: number;     // barras paralelas a X (corren a lo largo de Lx)
    spacing_x_cm?: number; // separación sobre Y
    phi_y_mm?: number;     // barras paralelas a Y (corren a lo largo de Ly)
    spacing_y_cm?: number; // separación sobre X
    doubleLayer?: boolean; // 2 capas
  };
  rebarTable?: Record<string, { kg_m?: number; label?: string }>;
};

export type LosaResult = {
  area_m2: number;
  espesor_cm: number;
  volumen_m3: number;
  volumen_con_desperdicio_m3: number;
  espesor_sugerido_cm?: number;
  regla_espesor?: string;

  modo: "malla" | "barras" | "simple";
  concreteClassId?: string;

  // Malla
  malla_id?: string;
  malla_kg?: number;

  // Barras
  barras?: {
    acero_kg?: number;
    capas?: number;
    x?: { phi_mm: number; n: number; largo_unit_m: number; largo_total_m: number; kg_m?: number; kg?: number; spacing_cm?: number };
    y?: { phi_mm: number; n: number; largo_unit_m: number; largo_total_m: number; kg_m?: number; kg?: number; spacing_cm?: number };
  };
};

// 👉 Alias interno para evitar indexar un tipo opcional
type BarDet = NonNullable<LosaResult["barras"]>["x"];

function safeN(n: unknown, def = 0): number {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string") {
    const x = Number(n);
    if (Number.isFinite(x)) return x;
  }
  return def;
}

function kgPorMetro(map: LosaInput["rebarTable"], phi_mm?: number) {
  if (!map || !phi_mm) return undefined;
  const key = String(phi_mm);
  const row = map[key] || map[`${phi_mm}`];
  return row?.kg_m;
}

export function calcLosa(input: LosaInput): LosaResult {
  const {
    Lx_m, Ly_m, H_cm,
    cover_cm = 3,
    wastePct = 0,
    concreteClassId,
    mallaId,
    meshTable = {},
    meshDoubleLayer = false,
    bars,
    rebarTable = {},
  } = input;

  const Lx = Math.max(0, safeN(Lx_m));
  const Ly = Math.max(0, safeN(Ly_m));
  const H = Math.max(0, safeN(H_cm));
  const area = Lx * Ly;
  const vol = area * (H / 100);
  const fWaste = 1 + Math.max(0, safeN(wastePct)) / 100;
  const volW = vol * fWaste;
  // Regla simple de pre-dimensionado: H ≥ max(10 cm, L/25)
  const L_control_m = Math.max(Lx, Ly);
  const espesor_sugerido_cm = Math.max(10, Math.round((L_control_m * 100) / 25));
  const regla_espesor = "H ≥ max(10 cm, L/25)";
  // --- Malla
  if (mallaId && meshTable[mallaId]?.kg_m2) {
    const kg_m2 = safeN(meshTable[mallaId].kg_m2, 0);
    const capas = meshDoubleLayer ? 2 : 1;
    const mallaKg = kg_m2 * area * capas * fWaste;

    return {
      area_m2: round2(area),
      espesor_cm: round2(H),
      volumen_m3: round2(vol),
      volumen_con_desperdicio_m3: round2(volW),
      modo: "malla",
      concreteClassId,
      malla_id: mallaId,
      malla_kg: round2(mallaKg),
      espesor_sugerido_cm,
      regla_espesor,
    };
  }

  // --- Barras
  const cover_m = Math.max(0, safeN(cover_cm)) / 100;
  const libre_Lx = Math.max(0, Lx - 2 * cover_m);
  const libre_Ly = Math.max(0, Ly - 2 * cover_m);

  const phi_x = safeN(bars?.phi_x_mm) || 0;
  const s_x_m = Math.max(0, safeN(bars?.spacing_x_cm) / 100);
  const phi_y = safeN(bars?.phi_y_mm) || 0;
  const s_y_m = Math.max(0, safeN(bars?.spacing_y_cm) / 100);
  const capas = bars?.doubleLayer ? 2 : 1;

  let detX: BarDet | undefined;
  let detY: BarDet | undefined;
  let kgTot = 0;

  // Barras X: corren a lo largo de Lx, separadas sobre Ly
  if (phi_x > 0 && s_x_m > 0 && libre_Lx > 0 && libre_Ly > 0) {
    const n = Math.floor(libre_Ly / s_x_m) + 1;
    const largo_unit = libre_Lx;
    const kgm = kgPorMetro(rebarTable, phi_x) ?? 0;
    const largo_total = n * largo_unit * capas;
    const kg = largo_total * kgm * fWaste;

    detX = {
      phi_mm: phi_x,
      n,
      largo_unit_m: round2(largo_unit),
      largo_total_m: round2(largo_total),
      kg_m: kgm,
      kg: round2(kg),
      spacing_cm: round2(s_x_m * 100),
    };
    kgTot += kg;
  }

  // Barras Y: corren a lo largo de Ly, separadas sobre Lx
  if (phi_y > 0 && s_y_m > 0 && libre_Lx > 0 && libre_Ly > 0) {
    const n = Math.floor(libre_Lx / s_y_m) + 1;
    const largo_unit = libre_Ly;
    const kgm = kgPorMetro(rebarTable, phi_y) ?? 0;
    const largo_total = n * largo_unit * capas;
    const kg = largo_total * kgm * fWaste;

    detY = {
      phi_mm: phi_y,
      n,
      largo_unit_m: round2(largo_unit),
      largo_total_m: round2(largo_total),
      kg_m: kgm,
      kg: round2(kg),
      spacing_cm: round2(s_y_m * 100),
    };
    kgTot += kg;
  }

  const modo: LosaResult["modo"] = detX || detY ? "barras" : "simple";

  return {
    area_m2: round2(area),
    espesor_cm: round2(H),
    volumen_m3: round2(vol),
    volumen_con_desperdicio_m3: round2(volW),
    modo,
    concreteClassId,
    espesor_sugerido_cm,
    regla_espesor,
    barras: {
      acero_kg: round2(kgTot),
      capas,
      x: detX,
      y: detY,
    },
  };
}

export default calcLosa;
