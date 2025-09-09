// lib/calc/zapata.ts
import { round2, stirrupLengthRect, stirrupQty } from "./rc";
import { checkFootingBasics, FootingCheckInput } from "@/lib/checks/struct_basics";
import { CheckMessage } from "@/lib/checks/messages";

export type ZapataInput = {
  // Geometría
  largo_m: number;
  profundidad_zanja_m: number;
  ancho_zanja_cm: number;
  alto_zapata_cm: number;
  ancho_zapata_cm: number;
  
  // Hormigón
  concreteClassId: string;
  wastePct?: number;
  incluirHormigonLimpieza: boolean;
  espesorHormigonLimpieza_cm: number;

  // Acero
  rebarTable?: Record<string, { kg_m?: number; label?: string }>;
  longitudinal?: { phi_mm: number; n: number };
  estribos?: { phi_mm: number; spacing_cm: number };

  // Suelo
  tipo_suelo_factor_esponjamiento: number;
};

export type ZapataResult = {
  volumen_excavacion_m3: number;
  volumen_excavacion_esponjado_m3: number;
  volumen_hormigon_zapata_m3: number;
  volumen_hormigon_limpieza_m3: number;
  volumen_hormigon_total_m3: number;
  acero_total_kg: number;
  acero_longitudinal_kg: number;
  acero_estribos_kg: number;
  materiales_hormigon_zapata: Record<string, number>;
  materiales_hormigon_limpieza: Record<string, number>;

  // Opcionales agregados: no rompen compatibilidad
  warnings?: CheckMessage[];
  assumptions?: string[];
  fuente_id?: string;
};

function kgPorMetro(map: ZapataInput["rebarTable"], phi_mm?: number) {
  if (!map || !phi_mm) return 0;
  const key = String(phi_mm);
  return map[key]?.kg_m ?? 0;
}

export function calcZapata(input: ZapataInput): ZapataResult {
  const {
    largo_m,
    profundidad_zanja_m,
    ancho_zanja_cm,
    alto_zapata_cm,
    ancho_zapata_cm,
    wastePct = 10,
    rebarTable = {},
    longitudinal,
    estribos,
    tipo_suelo_factor_esponjamiento,
    incluirHormigonLimpieza,
    espesorHormigonLimpieza_cm,
  } = input;

  const fWaste = 1 + wastePct / 100;
  
  // 1. Excavación
  const volExcavacion = largo_m * profundidad_zanja_m * (ancho_zanja_cm / 100);
  const volExcavacionEsponjado = volExcavacion * tipo_suelo_factor_esponjamiento;

  // 2. Hormigón de Limpieza (si aplica)
  const volLimpieza = incluirHormigonLimpieza
    ? largo_m * (ancho_zanja_cm / 100) * (espesorHormigonLimpieza_cm / 100)
    : 0;
  const volLimpiezaWaste = volLimpieza * fWaste;

  // 3. Hormigón de Zapata
  const volZapata = largo_m * (alto_zapata_cm / 100) * (ancho_zapata_cm / 100);
  const volZapataWaste = volZapata * fWaste;
  
  // 4. Acero
  let aceroLongKg = 0;
  if (longitudinal && longitudinal.phi_mm > 0 && longitudinal.n > 0) {
    const kgm = kgPorMetro(rebarTable, longitudinal.phi_mm);
    const anclaje = 40 * (longitudinal.phi_mm / 1000); // Solape/anclaje 40 diámetros
    const largoTotal = (largo_m * longitudinal.n) + anclaje;
    aceroLongKg = largoTotal * kgm * fWaste;
  }

  let aceroEstribosKg = 0;
  if (estribos && estribos.phi_mm > 0 && estribos.spacing_cm > 0) {
    const cover_cm = 5; // Recubrimiento típico para fundaciones
    const hook_cm = 10;
    const kgm = kgPorMetro(rebarTable, estribos.phi_mm);
    const largoUnit = stirrupLengthRect(ancho_zapata_cm / 100, alto_zapata_cm / 100, cover_cm, hook_cm);
    const qty = stirrupQty(largo_m, estribos.spacing_cm);
    aceroEstribosKg = qty * largoUnit * kgm * fWaste;
  }

  // 5. Chequeos básicos (no normativos)
  const assumedColumnSideCm = 20; // Asumimos columna 20×20 cm por no estar en inputs
  const checkInput: FootingCheckInput = {
    column_b_cm: assumedColumnSideCm,
    column_h_cm: assumedColumnSideCm,
    footing_b_m: ancho_zapata_cm / 100,
    footing_h_m: alto_zapata_cm / 100,
    soil_allow_kPa: undefined
  };
  const warnings: CheckMessage[] = checkFootingBasics(checkInput);

  const assumptions: string[] = [
    "Se asume columna de 20×20 cm a efectos de verificaciones básicas.",
    `Recubrimiento de estribos considerado 5 cm y ganchos de 10 cm en fundaciones.`,
    `Desperdicio aplicado: ${round2(wastePct)}%.`
  ];

  return {
    volumen_excavacion_m3: round2(volExcavacion),
    volumen_excavacion_esponjado_m3: round2(volExcavacionEsponjado),
    volumen_hormigon_zapata_m3: round2(volZapataWaste),
    volumen_hormigon_limpieza_m3: round2(volLimpiezaWaste),
    volumen_hormigon_total_m3: round2(volZapataWaste + volLimpiezaWaste),
    acero_longitudinal_kg: round2(aceroLongKg),
    acero_estribos_kg: round2(aceroEstribosKg),
    acero_total_kg: round2(aceroLongKg + aceroEstribosKg),
    materiales_hormigon_zapata: {}, // Se llenará en la UI
    materiales_hormigon_limpieza: {}, // Se llenará en la UI
    warnings,
    assumptions,
    fuente_id: "guia_obras_vivienda"
  };
}
