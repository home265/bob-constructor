// lib/calc/muros.ts
import type { Mortar, WallCoefficient, WallFormInput, WallResult } from "../types";
// Se importa la función de redondeo mejorada desde rc.ts
import { round2 } from "./rc";

// La función 'redondearArriba' ya no es necesaria, la eliminamos para evitar confusiones.

function areaConVanos(L: number, H: number, SA = 0, vanos: { lv: number; hv: number; sv?: number }[]) {
  // Esta función se mantiene intacta.
  let base = L * H + (SA || 0);
  for (const v of vanos) {
    if (v.sv && v.sv > 0) base -= v.sv;
    else if (v.lv && v.hv) base -= v.lv * v.hv;
  }
  return Math.max(base, 0);
}

// La firma de la función se actualiza para aceptar los nuevos campos opcionales.
export function computeMuros(
  input: WallFormInput & { incluyeEncadenado?: boolean; metrosDinteles?: number },
  coeffs: WallCoefficient[],
  morteros: Mortar[],
  defaults: { desperdicio_pct: Record<string, number> }
): WallResult & { hormigonVigas_m3?: number; aceroVigas_kg?: number } {
  // Lógica original para área y desperdicio, sin cambios.
  const S = areaConVanos(input.L, input.H, input.SA || 0, input.vanos || []);
  const desperdicio = (input.desperdicioPct ?? defaults.desperdicio_pct.muros ?? 7) / 100;
  const fWaste = 1 + desperdicio;

  const c = coeffs.find((c) => c.ladrillo_id === input.ladrilloId && c.junta_mm === input.juntaMm);
  if (!c) throw new Error("No hay coeficiente para ese ladrillo y junta.");

  // Lógica original para unidades, sin cambios.
  const unidades = S * c.unid_por_m2 * fWaste;

  // --- MEJORA 1: Cálculo de mortero con juntas verticales ---
  // Se calcula el mortero de asiento original y se le añade un 15% para las juntas verticales.
  const mortero_horizontal_m3 = S * c.mortero_asiento_m3_por_m2;
  const mortero_m3_total = mortero_horizontal_m3 * 1.15 * fWaste;

  const mortero = morteros.find((m) => m.id === input.morteroAsientoId);
  if (!mortero) throw new Error("Mortero de asiento no encontrado.");

  // Lógica original para desglose de mortero, pero usando el nuevo volumen total.
  const cemento_bolsas = mortero_m3_total * mortero.bolsas_cemento_por_m3;
  const cal_kg = mortero_m3_total * mortero.kg_cal_por_m3;
  const agua_l = mortero_m3_total * mortero.agua_l_por_m3;
  
  // --- MEJORA 2: Cálculo de Encadenados y Dinteles ---
  let hormigonVigas_m3 = 0;
  let aceroVigas_kg = 0;
  
  // Se asumen dimensiones y armados típicos para muros no portantes en Argentina.
  const seccion_viga_m2 = 0.18 * 0.18; // Viga de 18x18 cm
  // Acero: 4 barras Ø8 (0.395 kg/m) + estribos Ø6 (0.222 kg/m) cada 20cm (5 estribos/metro)
  const kg_acero_por_metro = (4 * 0.395) + (5 * (0.18 * 4) * 0.222);

  if (input.incluyeEncadenado) {
      hormigonVigas_m3 += input.L * seccion_viga_m2;
      aceroVigas_kg += input.L * kg_acero_por_metro;
  }
  
  const metrosDinteles = input.metrosDinteles ?? 0;
  if (metrosDinteles > 0) {
      hormigonVigas_m3 += metrosDinteles * seccion_viga_m2;
      aceroVigas_kg += metrosDinteles * kg_acero_por_metro;
  }

  // Se retornan todos los valores originales MÁS los nuevos.
  return {
    areaNeta_m2: round2(S), // Usamos la nueva función round2
    unidades: Math.ceil(unidades),
    mortero_asiento_m3: round2(mortero_m3_total, 3), // Usamos round2 con 3 decimales
    cemento_bolsas: Math.ceil(cemento_bolsas),
    cal_kg: Math.ceil(cal_kg),
    agua_l: Math.ceil(agua_l),
    // Nuevos resultados
    hormigonVigas_m3: round2(hormigonVigas_m3 * fWaste, 3), // Usamos round2 con 3 decimales
    aceroVigas_kg: round2(aceroVigas_kg * fWaste), // Usa round2 con 2 decimales por defecto
    avisos: ["Cálculo orientativo. Verificar con profesional."],
  };
}