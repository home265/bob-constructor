// lib/calc/rc.ts
export const PI = Math.PI;
export const STEEL_RHO = 7850; // kg/m³ (acero)

// --- Utilidades generales
/**
 * Redondea un número a una cantidad específica de decimales.
 * @param n El número a redondear.
 * @param decimals La cantidad de decimales a la que se redondeará (por defecto es 2).
 */
export function round2(n: number, decimals = 2): number {
  const x = Number(n);
  if (!isFinite(x)) return 0;
  const f = Math.pow(10, decimals);
  return Math.round(x * f) / f;
}

// Redondeo hacia arriba al múltiplo "step" (p.ej. bolsas de 50 kg, cajas de 1 ud)
export function ceilTo(n: number, step: number) {
  const x = Number(n);
  const s = Number(step);
  if (!isFinite(x) || !isFinite(s) || s <= 0) return 0;
  return Math.ceil(x / s) * s;
}

export function toM(cmOrMm: number, unit: "cm" | "mm") {
  return unit === "cm" ? cmOrMm / 100 : cmOrMm / 1000;
}

// Sección de barra (m²) a partir de diámetro en mm
export function barArea(d_mm: number) {
  const r = d_mm / 1000 / 2;
  return PI * r * r;
}

// Peso de barra(s) (kg) => ρ * A * L * qty
export function steelKg(
  d_mm: number,
  length_m: number,
  qty: number,
  rho = STEEL_RHO
) {
  return rho * barArea(d_mm) * length_m * qty;
}

// Longitud de estribo rectangular (m) con recubrimiento (cm) y ganchos (cm)
export function stirrupLengthRect(
  b_m: number,
  h_m: number,
  cover_cm: number,
  hook_cm = 10
) {
  const c = cover_cm / 100;
  const innerB = b_m - 2 * c;
  const innerH = h_m - 2 * c;
  return 2 * (innerB + innerH) + 2 * (hook_cm / 100);
}

// Espaciamiento → cantidad = ceil(L/esp) + 1
export function stirrupQty(length_m: number, spacing_cm: number) {
  const s = spacing_cm / 100;
  return Math.max(1, Math.ceil(length_m / s) + 1);
}

// Volúmenes
export function volPrism(b_m: number, h_m: number, l_m: number) {
  return b_m * h_m * l_m;
}
export function volSlab(Lx_m: number, Ly_m: number, H_cm: number) {
  return Lx_m * Ly_m * (H_cm / 100);
}
// Base escalonada: suma de prismas
export function volFootingSteps(
  steps: Array<{ b: number; h: number; t: number }>
) {
  // b = base mayor lado X, h = base mayor lado Y, t = espesor (todos en m)
  return steps.reduce((acc, s) => acc + s.b * s.h * s.t, 0);
}