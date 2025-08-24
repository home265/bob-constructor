// lib/calc/muros.ts
import type { Mortar, WallCoefficient, WallFormInput, WallResult } from "../types";

function redondearArriba(n: number, decimales = 2) {
  const f = Math.pow(10, decimales);
  return Math.ceil(n * f) / f;
}

function areaConVanos(L: number, H: number, SA = 0, vanos: { lv: number; hv: number; sv?: number }[]) {
  let base = L * H + (SA || 0);
  for (const v of vanos) {
    if (v.sv && v.sv > 0) base -= v.sv;
    else if (v.lv && v.hv) base -= v.lv * v.hv;
  }
  return Math.max(base, 0);
}

export function computeMuros(
  input: WallFormInput,
  coeffs: WallCoefficient[],
  morteros: Mortar[],
  defaults: { desperdicio_pct: Record<string, number> }
): WallResult {
  const S = areaConVanos(input.L, input.H, input.SA || 0, input.vanos || []);
  const desperdicio = (input.desperdicioPct ?? defaults.desperdicio_pct.muros ?? 0) / 100;
  const SconDesp = S * (1 + desperdicio);

  const c = coeffs.find((c) => c.ladrillo_id === input.ladrilloId && c.junta_mm === input.juntaMm);
  if (!c) throw new Error("No hay coeficiente para ese ladrillo y junta.");

  const unidades = SconDesp * c.unid_por_m2;
  const mortero_m3 = SconDesp * c.mortero_asiento_m3_por_m2;

  const mortero = morteros.find((m) => m.id === input.morteroAsientoId);
  if (!mortero) throw new Error("Mortero de asiento no encontrado.");

  const cemento_bolsas = mortero_m3 * mortero.bolsas_cemento_por_m3;
  const cal_kg = mortero_m3 * mortero.kg_cal_por_m3;
  const agua_l = mortero_m3 * mortero.agua_l_por_m3;

  return {
    areaNeta_m2: redondearArriba(S, 2),
    unidades: Math.ceil(unidades), // unidad de compra
    mortero_asiento_m3: redondearArriba(mortero_m3, 3),
    cemento_bolsas: Math.ceil(cemento_bolsas),
    cal_kg: Math.ceil(cal_kg),
    agua_l: Math.ceil(agua_l),
    avisos: ["Cálculo orientativo. Verificar con profesional."],
  };
}
