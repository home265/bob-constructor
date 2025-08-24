import { round2 } from "@/lib/calc/rc";

// Tipos separados para evitar indexar sobre algo opcional
export type BarrasDet = {
  phi_mm: number;
  n: number;
  largo_unit_m: number;
  largo_total_m: number;
  kg_m?: number;
  kg?: number;
  spacing_cm?: number;
};

export type Barras = {
  acero_kg?: number;
  x?: BarrasDet;
  y?: BarrasDet;
  capas?: number; // 1 ó 2
};

export type BaseInput = {
  // Dimensiones
  L: number;        // largo (m)
  B: number;        // ancho (m)
  Hcm: number;      // espesor (cm)

  // Concreto y pérdidas
  concreteClassId?: string;
  wastePct?: number; // % desperdicio

  // Recubrimiento
  cover_cm?: number; // cm

  // Opción 1: Malla SIMA
  mallaId?: string | "";
  meshTable?: Record<string, { kg_m2?: number; label?: string }>;
  meshDoubleLayer?: boolean;

  // Opción 2: Barras
  bars?: {
    phi_x_mm?: number;
    spacing_x_cm?: number;
    phi_y_mm?: number;
    spacing_y_cm?: number;
    doubleLayer?: boolean;
  };
  rebarTable?: Record<string, { kg_m?: number; label?: string }>;
};

export type BaseResult = {
  area_m2: number;
  espesor_cm: number;
  volumen_m3: number;
  volumen_con_desperdicio_m3: number;

  modo: "malla" | "barras" | "simple";
  concreteClassId?: string;

  // Malla
  malla_id?: string;
  malla_kg?: number;

  // Barras
  barras?: Barras;
};

function kgPorMetro(rebarTable: BaseInput["rebarTable"], phi_mm?: number): number | undefined {
  if (!rebarTable || !phi_mm) return;
  const k = String(phi_mm);
  const row = rebarTable[k] || rebarTable[`${phi_mm}`];
  return row?.kg_m;
}

function safeN(n: any, def = 0) {
  const x = Number(n);
  return isFinite(x) ? x : def;
}

export function calcBase(input: BaseInput): BaseResult {
  const {
    L, B, Hcm,
    wastePct = 0,
    concreteClassId,
    cover_cm = 5,
    mallaId,
    meshTable = {},
    meshDoubleLayer = false,
    bars,
    rebarTable = {},
  } = input;

  const area = Math.max(0, safeN(L)) * Math.max(0, safeN(B));
  const vol = area * (Math.max(0, safeN(Hcm)) / 100);
  const fWaste = 1 + safeN(wastePct) / 100;
  const volW = vol * fWaste;

  // ---- Modo malla
  if (mallaId && meshTable[mallaId]?.kg_m2) {
    const kg_m2 = safeN(meshTable[mallaId].kg_m2, 0);
    const capas = meshDoubleLayer ? 2 : 1;
    const mallaKg = kg_m2 * area * capas * fWaste;

    return {
      area_m2: round2(area),
      espesor_cm: round2(Hcm),
      volumen_m3: round2(vol),
      volumen_con_desperdicio_m3: round2(volW),
      modo: "malla",
      concreteClassId,
      malla_id: mallaId,
      malla_kg: round2(mallaKg),
    };
  }

  // ---- Modo barras
  const cover_m = Math.max(0, safeN(cover_cm)) / 100;
  const libre_L = Math.max(0, safeN(L) - 2 * cover_m);
  const libre_B = Math.max(0, safeN(B) - 2 * cover_m);

  const phi_x = safeN(bars?.phi_x_mm) || 0;
  const s_x_m = Math.max(0, safeN(bars?.spacing_x_cm) / 100);
  const phi_y = safeN(bars?.phi_y_mm) || 0;
  const s_y_m = Math.max(0, safeN(bars?.spacing_y_cm) / 100);
  const capas = bars?.doubleLayer ? 2 : 1;

  let detX: BarrasDet | undefined;
  let detY: BarrasDet | undefined;
  let kgTot = 0;

  if (phi_x > 0 && s_x_m > 0 && libre_B > 0 && libre_L > 0) {
    const n = Math.floor(libre_B / s_x_m) + 1;
    const largo_unit = Math.max(0, libre_L);
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

  if (phi_y > 0 && s_y_m > 0 && libre_B > 0 && libre_L > 0) {
    const n = Math.floor(libre_L / s_y_m) + 1;
    const largo_unit = Math.max(0, libre_B);
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

  const modo: BaseResult["modo"] = detX || detY ? "barras" : "simple";

  return {
    area_m2: round2(area),
    espesor_cm: round2(Hcm),
    volumen_m3: round2(vol),
    volumen_con_desperdicio_m3: round2(volW),
    modo,
    concreteClassId,
    barras: {
      acero_kg: round2(kgTot),
      x: detX,
      y: detY,
      capas,
    },
  };
}

export default calcBase;
