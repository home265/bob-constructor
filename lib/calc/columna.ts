// lib/calc/columna.ts
import { round2, stirrupLengthRect, stirrupQty } from "@/lib/calc/rc";

export type ColumnaInput = {
  // Geometría
  H_m: number;        // altura (m)
  b_cm: number;       // lado 1 sección (cm)
  h_cm: number;       // lado 2 sección (cm)
  cover_cm?: number;  // recubrimiento (cm)

  // Hormigón / pérdidas
  concreteClassId?: string;
  wastePct?: number;

  // Tablas
  rebarTable?: Record<string, { kg_m?: number; label?: string }>;

  // Barras verticales
  vertical?: {
    phi_mm?: number;  // diámetro de barras verticales
    n?: number;       // cantidad de barras
  };

  // Estribos
  stirrups?: {
    phi_mm?: number;
    spacing_cm?: number; // separación uniforme (cm)
    hook_cm?: number;    // ganchos (cm) (típico 10 cm)
  };
};

export type ColumnaResult = {
  dimensiones: { H_m: number; b_cm: number; h_cm: number; cover_cm: number };
  area_seccion_m2: number;
  volumen_m3: number;
  volumen_con_desperdicio_m3: number;

  concreteClassId?: string;

  acero_total_kg: number;

  vertical?: {
    phi_mm?: number;
    n: number;
    largo_unit_m: number;   // ≈ H (no consideramos anclajes en esta versión)
    largo_total_m: number;
    kg_m?: number;
    kg: number;
  };

  estribos?: {
    phi_mm?: number;
    spacing_cm?: number;
    qty: number;
    largo_unit_m: number;   // perímetro interior + ganchos
    largo_total_m: number;
    kg_m?: number;
    kg: number;
  };
};

function safeN(n: unknown, def = 0) {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string") {
    const x = Number(n);
    if (Number.isFinite(x)) return x;
  }
  return def;
}

function kgPorMetro(map: ColumnaInput["rebarTable"], phi_mm?: number) {
  if (!map || !phi_mm) return undefined;
  const key = String(phi_mm);
  const row = map[key] || map[`${phi_mm}`];
  return row?.kg_m;
}

export function calcColumna(input: ColumnaInput): ColumnaResult {
  const {
    H_m,
    b_cm,
    h_cm,
    cover_cm = 3,
    wastePct = 0,
    concreteClassId,
    rebarTable = {},
    vertical,
    stirrups,
  } = input;

  const H = Math.max(0, safeN(H_m));
  const b_m = Math.max(0, safeN(b_cm) / 100);
  const h_m = Math.max(0, safeN(h_cm) / 100);

  const fWaste = 1 + Math.max(0, safeN(wastePct)) / 100;

  // Hormigón
  const area = b_m * h_m;
  const vol = area * H;
  const volW = vol * fWaste;

  // Verticales
  const phiV = safeN(vertical?.phi_mm) || 0;
  const nV = Math.max(0, safeN(vertical?.n));
  let detV: ColumnaResult["vertical"] | undefined;
  let kgV = 0;

  if (phiV > 0 && nV > 0 && H > 0) {
    const kgm = kgPorMetro(rebarTable, phiV) ?? 0;
    const largo_unit = H;              // simplificado (sin anclajes)
    const largo_total = largo_unit * nV;
    kgV = largo_total * kgm * fWaste;

    detV = {
      phi_mm: phiV,
      n: nV,
      largo_unit_m: round2(largo_unit),
      largo_total_m: round2(largo_total),
      kg_m: kgm,
      kg: round2(kgV),
    };
  }

  // Estribos
  const phiS = safeN(stirrups?.phi_mm) || 0;
  const s_cm = Math.max(0, safeN(stirrups?.spacing_cm));
  const hook_cm = Math.max(0, safeN(stirrups?.hook_cm, 10));
  let detS: ColumnaResult["estribos"] | undefined;
  let kgS = 0;

  if (phiS > 0 && s_cm > 0 && b_m > 0 && h_m > 0 && H > 0) {
    const kgmS = kgPorMetro(rebarTable, phiS) ?? 0;
    const largo_unit = stirrupLengthRect(b_m, h_m, cover_cm, hook_cm); // m
    const qty = stirrupQty(H, s_cm); // uds
    const largo_total = largo_unit * qty;
    kgS = largo_total * kgmS * fWaste;

    detS = {
      phi_mm: phiS,
      spacing_cm: s_cm,
      qty,
      largo_unit_m: round2(largo_unit),
      largo_total_m: round2(largo_total),
      kg_m: kgmS,
      kg: round2(kgS),
    };
  }

  const aceroTot = round2(kgV + kgS);

  return {
    dimensiones: { H_m: round2(H), b_cm: round2(b_cm), h_cm: round2(h_cm), cover_cm: round2(cover_cm) },
    area_seccion_m2: round2(area),
    volumen_m3: round2(vol),
    volumen_con_desperdicio_m3: round2(volW),
    concreteClassId,
    acero_total_kg: aceroTot,
    vertical: detV,
    estribos: detS,
  };
}

export default calcColumna;
