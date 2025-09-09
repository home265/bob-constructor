// lib/calc/pilote.ts
import { PI, round2, steelKg } from "@/lib/calc/rc";
import { CheckMessage } from "@/lib/checks/messages";

export type PiloteInput = {
  // Geometría
  L_m: number;        // largo total (m)
  d_cm: number;       // diámetro exterior (cm)
  cover_cm?: number;  // recubrimiento (cm) hasta el exterior del acero

  // Hormigón / desperdicio
  concreteClassId?: string;
  wastePct?: number;

  // Tablas de acero
  rebarTable?: Record<string, { kg_m?: number; label?: string }>;

  // Barras longitudinales
  long?: {
    phi_mm?: number;  // diámetro (mm)
    n?: number;       // cantidad
  };

  // Espiral/Helicoidal
  spiral?: {
    phi_mm?: number;     // diámetro (mm)
    pitch_cm?: number;   // paso (cm por vuelta)
    extra_m?: number;    // extra de empalmes/ganchos (m) – opcional
  };
};

export type PiloteResult = {
  dimensiones: { L_m: number; d_cm: number; cover_cm: number };
  area_seccion_m2: number;                     // π·(d/2)^2
  volumen_m3: number;                          // sin desperdicio
  volumen_con_desperdicio_m3: number;

  concreteClassId?: string;

  acero_total_kg: number;

  longitudinal?: {
    phi_mm?: number;
    n: number;
    largo_unit_m: number;
    largo_total_m: number;
    kg_m?: number;
    kg: number;
  };

  espiral?: {
    phi_mm?: number;
    pitch_cm?: number;
    radio_m?: number;           // radio de la fibra media (aprox.)
    vueltas?: number;           // L/pitch
    largo_total_m: number;      // longitud de hélice
    kg_m?: number;
    kg: number;
  };

  // Opcionales agregados (no rompen compatibilidad)
  warnings?: CheckMessage[];
  assumptions?: string[];
  fuente_id?: string;
};

function safeN(n: unknown, d = 0): number {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string") {
    const x = Number(n);
    if (Number.isFinite(x)) return x;
  }
  const x = Number(n);
  return Number.isFinite(x) ? x : d;
}

function kgPorMetro(map: PiloteInput["rebarTable"], phi_mm?: number): number | undefined {
  if (!map || !phi_mm) return undefined;
  const key = String(phi_mm);
  const row = map[key] || map[`${phi_mm}`];
  return row?.kg_m;
}

export function calcPilote(input: PiloteInput): PiloteResult {
  const {
    L_m,
    d_cm,
    cover_cm = 5,
    wastePct = 0,
    concreteClassId,
    rebarTable = {},
    long,
    spiral,
  } = input;

  const L = Math.max(0, safeN(L_m));
  const d_m = Math.max(0, safeN(d_cm) / 100);
  const cover_m = Math.max(0, safeN(cover_cm) / 100);
  const fWaste = 1 + Math.max(0, safeN(wastePct)) / 100;

  // Sección y volumen de hormigón
  const area = PI * Math.pow(d_m / 2, 2);
  const vol = area * L;
  const volW = vol * fWaste;

  // ---- Longitudinales
  const phiL = safeN(long?.phi_mm) || 0;
  const nL = Math.max(0, safeN(long?.n));
  let kgLong = 0;
  let detLong: PiloteResult["longitudinal"] | undefined;

  if (phiL > 0 && nL > 0 && L > 0) {
    const kgm = kgPorMetro(rebarTable, phiL);
    const largo_unit = L; // (simplificación – sin anclajes)
    const largo_total = largo_unit * nL;

    let kg: number;
    if (kgm != null) {
      kg = largo_total * kgm * fWaste;
    } else {
      // fallback físico con densidad del acero
      kg = steelKg(phiL, largo_total, 1) * fWaste;
    }

    kgLong = kg;

    detLong = {
      phi_mm: phiL,
      n: nL,
      largo_unit_m: round2(largo_unit),
      largo_total_m: round2(largo_total),
      kg_m: kgm,
      kg: round2(kg),
    };
  }

  // ---- Espiral (hélice)
  const phiS = safeN(spiral?.phi_mm) || 0;
  const pitch_m = Math.max(0, safeN(spiral?.pitch_cm) / 100);
  const extraDefault_m = Math.max(0, safeN(spiral?.extra_m, 0.2)); // 20 cm por defecto
  let kgSp = 0;
  let detSp: PiloteResult["espiral"] | undefined;

  if (phiS > 0 && pitch_m > 0 && d_m > 0 && L > 0) {
    // radio de la fibra media ≈ (d/2 - cover - φ/2)
    const r = Math.max(0, d_m / 2 - cover_m - (phiS / 1000) / 2);
    // longitud por vuelta de una hélice: sqrt((2πr)^2 + pitch^2)
    const perTurn = Math.sqrt(Math.pow(2 * PI * r, 2) + Math.pow(pitch_m, 2));
    const vueltas = L / pitch_m;
    const largo_total = perTurn * vueltas + extraDefault_m;

    const kgmS = kgPorMetro(rebarTable, phiS);
    let kg: number;
    if (kgmS != null) {
      kg = largo_total * kgmS * fWaste;
    } else {
      kg = steelKg(phiS, largo_total, 1) * fWaste;
    }

    kgSp = kg;

    detSp = {
      phi_mm: phiS,
      pitch_cm: round2(pitch_m * 100),
      radio_m: round2(r),
      vueltas: round2(vueltas),
      largo_total_m: round2(largo_total),
      kg_m: kgmS,
      kg: round2(kg),
    };
  }

  const aceroTot = round2(kgLong + kgSp);

  // Chequeos ligeros (no normativos)
  const warnings: CheckMessage[] = [];
  if (cover_cm < 5) {
    warnings.push({
      code: "PILE_COVER_LOW",
      severity: "warning",
      title: "Recubrimiento bajo para pilote",
      details: "Usualmente se adopta ≥ 5 cm en fundaciones.",
      help: "Aumentar recubrimiento si las condiciones de exposición son severas."
    });
  }
  if (spiral?.pitch_cm !== undefined && spiral.pitch_cm > 0 && spiral.pitch_cm < 6) {
    warnings.push({
      code: "PILE_PITCH_TIGHT",
      severity: "info",
      title: "Espiral con paso muy cerrado",
      details: `Paso indicado: ${round2(spiral.pitch_cm)} cm.`,
      help: "Verificar disponibilidad y práctica de taller."
    });
  }
  if (spiral?.pitch_cm !== undefined && spiral.pitch_cm > 30) {
    warnings.push({
      code: "PILE_PITCH_WIDE",
      severity: "info",
      title: "Espiral con paso amplio",
      details: `Paso indicado: ${round2(spiral.pitch_cm)} cm.`,
      help: "Asegurar confinamiento adecuado según proyecto."
    });
  }

  const assumptions: string[] = [
    "Longitudinales a lo largo de todo el pilote (sin considerar ganchos/anclajes).",
    `Hélice con paso constante; extra de empalmes considerado: ${round2(extraDefault_m)} m.`,
    `Desperdicio aplicado: ${round2(Math.max(0, safeN(wastePct)))}%.`
  ];

  return {
    dimensiones: { L_m: round2(L), d_cm: round2(d_cm), cover_cm: round2(cover_cm) },
    area_seccion_m2: round2(area),
    volumen_m3: round2(vol),
    volumen_con_desperdicio_m3: round2(volW),
    concreteClassId,
    acero_total_kg: aceroTot,
    longitudinal: detLong,
    espiral: detSp,
    warnings,
    assumptions,
    fuente_id: "guia_obras_vivienda"
  };
}

export default calcPilote;
