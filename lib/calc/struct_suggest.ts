// Utilidades y sugerencias de pre-dimensionado "simple adelante, pro atrás"

export type SoilKey = "malo" | "medio" | "bueno";
type Elemento = "losa" | "viga" | "columna";

const SOIL_SIGMA_ADM_KPA: Record<SoilKey, number> = {
  malo: 100,
  medio: 200,
  bueno: 300,
};

// Cuantías mínimas típicas (en fracción, p. ej. 0.002 = 0.20 %)
const MIN_PCT = {
  losa: 0.002,
  viga: 0.002,
  columna: 0.01,
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const roundUpTo = (value: number, step: number) =>
  Math.ceil(value / step) * step;

const roundTo = (value: number, step: number) =>
  Math.round(value / step) * step;

const barAreaCm2 = (diam_mm: number) => (Math.PI * (diam_mm ** 2) / 4) / 100; // mm²→cm²

export function suggestSlab(params: { span_m: number; continua?: boolean }) {
  const { span_m, continua = false } = params;
  // Regla simple: H ≥ max(10 cm, L/25 simple, L/28 continua)
  const denom = continua ? 28 : 25;
  const h_cm = Math.max(10, roundTo((span_m * 100) / denom, 1));
  return { h_cm, regla: `H ≥ max(10 cm, L/${denom})`, continua };
}

export function checkRebarMin(args: {
  elemento: Elemento;
  b_cm: number;
  h_cm: number;
  pct_override?: number; // opcional
}) {
  const { elemento, b_cm, h_cm, pct_override } = args;
  const pct = pct_override ?? MIN_PCT[elemento];
  const As_min_cm2 = +(b_cm * h_cm * pct).toFixed(2);
  return { As_min_cm2, pct };
}

export function chooseRebarCombos(args: {
  As_objetivo_cm2: number;
  maxCombos?: number;
}) {
  const { As_objetivo_cm2, maxCombos = 3 } = args;
  const diametros = [8, 10, 12, 16, 20];
  const cantidades = [2, 3, 4, 5, 6, 8];
  const combos: Array<{
    diam_mm: number;
    cantidad: number;
    As_cm2: number;
  }> = [];

  for (const d of diametros) {
    const a = barAreaCm2(d);
    for (const n of cantidades) {
      const As = +(a * n).toFixed(2);
      combos.push({ diam_mm: d, cantidad: n, As_cm2: As });
    }
  }

  // Preferir combos que superen levemente As_objetivo y sean cercanos
  const filtrados = combos
    .filter((c) => c.As_cm2 >= As_objetivo_cm2)
    .sort(
      (c1, c2) =>
        Math.abs(c1.As_cm2 - As_objetivo_cm2) -
        Math.abs(c2.As_cm2 - As_objetivo_cm2)
    );

  return filtrados.slice(0, maxCombos);
}

export function suggestBeam(params: {
  span_m: number;
  uso?: "vivienda" | "terraza" | "comercial";
  gk_kN_m2?: number; // opcional, por si quieres mostrarlo en UI
}) {
  const { span_m } = params;
  // Reglas rápidas: h ≈ L/12; b ≈ h/2 (mín 15 cm)
  const h_cm = Math.max(20, roundTo((span_m * 100) / 12, 1)); // techo mínimo 20 cm por practicidad
  const b_cm = Math.max(15, roundTo(h_cm / 2, 1));

  const { As_min_cm2, pct } = checkRebarMin({
    elemento: "viga",
    b_cm,
    h_cm,
  });

  const combos = chooseRebarCombos({ As_objetivo_cm2: As_min_cm2 });

  return {
    b_cm,
    h_cm,
    As_min_cm2,
    pct_min: pct,
    combos_sugeridos: combos, // p. ej. [{diam_mm:12, cantidad:2, As_cm2:2.26}, ...]
    regla: "h≈L/12; b≈h/2 (≥15 cm); As,min=0,20%·b·h",
  };
}

export function suggestColumn(params: {
  N_kN: number; // carga axial de servicio aprox.
  plantas?: number; // para penalizar rango
}) {
  const { N_kN, plantas = 1 } = params;

  // Penalización leve por nº de plantas (aumenta N efectivo)
  const N_eff = N_kN * (1 + 0.15 * (plantas - 1));

  // Rangos discretos de sugerencia
  const rangos: Array<{ Nmax: number; b: number; h: number }> = [
    { Nmax: 300, b: 20, h: 20 },
    { Nmax: 500, b: 20, h: 30 },
    { Nmax: 800, b: 25, h: 30 },
    { Nmax: 1200, b: 30, h: 30 },
    { Nmax: 1800, b: 30, h: 40 },
    { Nmax: Infinity, b: 40, h: 40 },
  ];

  const elegido = rangos.find((r) => N_eff <= r.Nmax)!;
  // mínimos prácticos
  const b_cm = clamp(elegido.b, 20, 60);
  const h_cm = clamp(elegido.h, 20, 60);

  const { As_min_cm2, pct } = checkRebarMin({
    elemento: "columna",
    b_cm,
    h_cm,
  });

  const combos = chooseRebarCombos({ As_objetivo_cm2: As_min_cm2 });

  return {
    b_cm,
    h_cm,
    As_min_cm2,
    pct_min: pct,
    combos_sugeridos: combos,
    nota: `Rango según N≈${Math.round(N_eff)} kN y ${plantas} plantas`,
    regla: "mínimo 20 cm lado; As,min=1%·Ag",
  };
}

export function suggestFooting(params: {
  N_kN: number;
  soil?: SoilKey; // malo/medio/bueno
  FS?: number; // factor de seguridad
}) {
  const { N_kN, soil = "medio", FS = 2.5 } = params;
  const sigma_adm = SOIL_SIGMA_ADM_KPA[soil]; // kPa = kN/m²
  const sigma_diseño = sigma_adm / FS; // kN/m²
  const area_m2 = +(N_kN / sigma_diseño).toFixed(3);
  const lado_m = Math.sqrt(area_m2);

  const B_m = roundUpTo(lado_m, 0.1);
  const L_m = B_m; // arrancamos con base cuadrada
  const H_cm = Math.max(30, roundUpTo(Math.max(B_m, L_m) * 100 / 20, 1)); // ≥30 cm o L/20

  return {
    area_m2,
    B_m,
    L_m,
    H_cm,
    suelo: soil,
    sigma_adm_kPa: sigma_adm,
    FS,
    regla: "A=N/(σadm/FS); H≥max(30 cm, L/20)",
  };
}
