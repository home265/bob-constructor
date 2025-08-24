// lib/calc/viga.ts
import { round2, stirrupLengthRect, stirrupQty } from "@/lib/calc/rc";

// --- Tipos
export type VigaInput = {
  // Geometría
  L_m: number;       // largo (m)
  b_cm: number;      // ancho sección (cm)
  h_cm: number;      // alto sección (cm)
  cover_cm?: number; // recubrimiento (cm)

  // Hormigón y desperdicio
  concreteClassId?: string;
  wastePct?: number;

  // Tablas
  rebarTable?: Record<string, { kg_m?: number; label?: string }>;

  // Longitudinales (superior / inferior / extras)
  long?: {
    phi_mm?: number;
    n_sup?: number;     // cantidad barras superiores
    n_inf?: number;     // cantidad barras inferiores
    n_extra?: number;   // barras adicionales (centrales, refuerzos, etc.)
  };

  // Estribos
  stirrups?: {
    phi_mm?: number;
    spacing_cm?: number;
    hook_cm?: number;   // ganchos (cm), por defecto 10 cm
  };
};

export type VigaResult = {
  dimensiones: { L_m: number; b_cm: number; h_cm: number; cover_cm: number };
  area_seccion_m2: number;
  volumen_m3: number;
  volumen_con_desperdicio_m3: number;

  concreteClassId?: string;

  acero_total_kg: number;

  longitudinal?: {
    phi_mm?: number;
    n_sup: number;
    n_inf: number;
    n_extra: number;
    largo_unit_m: number;
    largo_total_m: number;
    kg_m?: number;
    kg: number;
  };

  estribos?: {
    phi_mm?: number;
    spacing_cm?: number;
    qty: number;
    largo_unit_m: number;
    largo_total_m: number;
    kg_m?: number;
    kg: number;
  };
};

// --- Helpers internos
function safeN(n: any, def = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : def;
}

function kgPorMetro(map: VigaInput["rebarTable"], phi_mm?: number) {
  if (!map || !phi_mm) return undefined;
  const key = String(phi_mm);
  const row = map[key] || map[`${phi_mm}`];
  return row?.kg_m;
}

// --- Cálculo
export function calcViga(input: VigaInput): VigaResult {
  const {
    L_m,
    b_cm,
    h_cm,
    cover_cm = 3,
    wastePct = 0,
    concreteClassId,
    rebarTable = {},
    long,
    stirrups,
  } = input;

  const L = Math.max(0, safeN(L_m));
  const b_m = Math.max(0, safeN(b_cm) / 100);
  const h_m = Math.max(0, safeN(h_cm) / 100);

  const fWaste = 1 + Math.max(0, safeN(wastePct)) / 100;

  // Volumen de viga
  const area = b_m * h_m;          // m²
  const vol = area * L;            // m³
  const volW = vol * fWaste;

  // Longitudinales
  const phiL = safeN(long?.phi_mm) || 0;
  const nSup = Math.max(0, safeN(long?.n_sup));
  const nInf = Math.max(0, safeN(long?.n_inf));
  const nExt = Math.max(0, safeN(long?.n_extra));
  const nTot = nSup + nInf + nExt;

  let kgLong = 0;
  let longDet: VigaResult["longitudinal"] | undefined;
  if (phiL > 0 && nTot > 0) {
    const kgm = kgPorMetro(rebarTable, phiL) ?? 0;
    const largo_unit = L; // barras a lo largo de toda la viga
    const largo_total = largo_unit * nTot;
    kgLong = largo_total * kgm * fWaste;

    longDet = {
      phi_mm: phiL,
      n_sup: nSup,
      n_inf: nInf,
      n_extra: nExt,
      largo_unit_m: round2(largo_unit),
      largo_total_m: round2(largo_total),
      kg_m: kgm,
      kg: round2(kgLong),
    };
  }

  // Estribos
  const phiS = safeN(stirrups?.phi_mm) || 0;
  const s_cm = Math.max(0, safeN(stirrups?.spacing_cm));
  const hook_cm = Math.max(0, safeN(stirrups?.hook_cm, 10));

  let kgSt = 0;
  let stDet: VigaResult["estribos"] | undefined;
  if (phiS > 0 && s_cm > 0 && b_m > 0 && h_m > 0 && L > 0) {
    const kgmS = kgPorMetro(rebarTable, phiS) ?? 0;
    const largoUnit = stirrupLengthRect(b_m, h_m, cover_cm, hook_cm); // m
    const qty = stirrupQty(L, s_cm); // uds
    const largoTotal = largoUnit * qty;
    kgSt = largoTotal * kgmS * fWaste;

    stDet = {
      phi_mm: phiS,
      spacing_cm: s_cm,
      qty,
      largo_unit_m: round2(largoUnit),
      largo_total_m: round2(largoTotal),
      kg_m: kgmS,
      kg: round2(kgSt),
    };
  }

  const aceroTot = round2(kgLong + kgSt);

  return {
    dimensiones: { L_m: round2(L), b_cm: round2(b_cm), h_cm: round2(h_cm), cover_cm: round2(cover_cm) },
    area_seccion_m2: round2(area),
    volumen_m3: round2(vol),
    volumen_con_desperdicio_m3: round2(volW),
    concreteClassId,
    acero_total_kg: aceroTot,
    longitudinal: longDet,
    estribos: stDet,
  };
}

export default calcViga;
