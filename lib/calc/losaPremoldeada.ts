// lib/calc/losaPremoldeada.ts
import { round2 } from "@/lib/calc/rc";

export type LosaPremInput = {
  // Geometría global
  L_m: number;   // luz entre apoyos (m)
  W_m: number;   // ancho total (m)

  // Viguetas
  spacing_cm: number; // separación eje-eje (cm) – típico 60
  apoyo_cm?: number;  // agregado de longitud por apoyo (cm) – típico 7..10

  // Bloques/bovedillas
  largo_bloque_m?: number; // típico 0.60 m

  // Capa de compresión
  capa_cm: number; // espesor (cm)
  wastePct?: number;

  // Opcional: malla en la capa
  mallaId?: string | "";
  meshTable?: Record<string, { kg_m2?: number; label?: string }>;
  meshDoubleLayer?: boolean;
};

export type LosaPremResult = {
  area_m2: number;

  viguetas: {
    qty: number;
    largo_unit_m: number;
    largo_total_m: number;
  };

  bloques?: {
    qty: number;
    por_vigueta: number;
    largo_unit_m: number;
  };

  capa: {
    volumen_m3: number;
    volumen_con_desperdicio_m3: number;
    espesor_cm: number;
  };

  malla?: {
    id: string;
    kg: number;
    capas: number;
  };
};

function safeN(n: unknown, d = 0): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : d;
}

export function calcLosaPremoldeada(input: LosaPremInput): LosaPremResult {
  const {
    L_m, W_m,
    spacing_cm,
    apoyo_cm = 7,
    largo_bloque_m = 0.6,
    capa_cm,
    wastePct = 0,
    mallaId,
    meshTable = {},
    meshDoubleLayer = false,
  } = input;

  const L = Math.max(0, safeN(L_m));
  const W = Math.max(0, safeN(W_m));
  const s_m = Math.max(0, safeN(spacing_cm) / 100);
  const apoyo_m = Math.max(0, safeN(apoyo_cm) / 100);
  const capa = Math.max(0, safeN(capa_cm));
  const fWaste = 1 + Math.max(0, safeN(wastePct)) / 100;

  const area = L * W;

  // Viguetas: qty ≈ floor(W/s) + 1 para cubrir los dos bordes
  const nVig = s_m > 0 ? Math.floor(W / s_m) + 1 : 0;
  const largoVig = L + 2 * apoyo_m; // luz + apoyos
  const totalVig = nVig * largoVig;

  // Bloques por vigueta: ceil(largo / largo_bloque)
  const porVig = largo_bloque_m > 0 ? Math.ceil(L / largo_bloque_m) : 0;
  const bloquesTot = nVig * porVig;

  // Capa de compresión
  const volCapa = area * (capa / 100);
  const volCapaW = volCapa * fWaste;

  const res: LosaPremResult = {
    area_m2: round2(area),
    viguetas: {
      qty: nVig,
      largo_unit_m: round2(largoVig),
      largo_total_m: round2(totalVig),
    },
    bloques: {
      qty: bloquesTot,
      por_vigueta: porVig,
      largo_unit_m: round2(largo_bloque_m),
    },
    capa: {
      volumen_m3: round2(volCapa),
      volumen_con_desperdicio_m3: round2(volCapaW),
      espesor_cm: round2(capa),
    },
  };

  // Malla en la capa (opcional)
  const kg_m2 = mallaId ? meshTable[mallaId]?.kg_m2 : undefined;
  if (kg_m2) {
    const capas = meshDoubleLayer ? 2 : 1;
    const kg = kg_m2 * area * capas * fWaste;
    res.malla = { id: mallaId as string, kg: round2(kg), capas };
  }

  return res;
}

export default calcLosaPremoldeada;
