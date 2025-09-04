// lib/calc/escalera.ts
import { round2 } from "./rc";

export type TramoInput = {
  largoHorizontal_m: number;
  ancho_m: number;
};

export type EscaleraInput = {
  // Geometría y Tramos
  tipo: "recta" | "L" | "U";
  alturaTotal_m: number;
  tramos: TramoInput[];
  // Dimensiones constructivas
  espesorLosa_cm: number;
  incluirDescanso: boolean;
  anchoDescanso_m?: number; // Para escaleras en 'U'
  // Hormigón y Acero
  concreteClassId: string;
  wastePct?: number;
  rebarTable?: Record<string, { kg_m?: number }>;
  aceroPrincipal: { phi_mm: number; separacion_cm: number };
  aceroReparticion: { phi_mm: number; separacion_cm: number };
};

export type EscaleraResult = {
  // Diseño y Ergonomía
  alturaTotal_m: number;
  desarrolloHorizontalTotal_m: number;
  cantidadEscalones: number;
  alzada_cm: number;
  pedada_cm: number;
  leyBlondel_cm: number;
  anguloInclinacion_grados: number;
  // Materiales
  volumenHormigonTotal_m3: number;
  volumenHormigonLosa_m3: number;
  volumenHormigonEscalones_m3: number;
  volumenHormigonDescanso_m3: number;
  aceroPrincipal_kg: number;
  aceroReparticion_kg: number;
  aceroTotal_kg: number;
  superficieEncofrado_m2: number;
};

function kgPorMetro(map: EscaleraInput["rebarTable"], phi_mm?: number) {
  if (!map || !phi_mm) return 0;
  return map[String(phi_mm)]?.kg_m ?? 0;
}

export function calcEscalera(input: EscaleraInput): EscaleraResult {
  const {
    alturaTotal_m,
    tramos,
    espesorLosa_cm,
    wastePct = 10,
    rebarTable = {},
    aceroPrincipal,
    aceroReparticion,
    incluirDescanso,
    anchoDescanso_m = 1
  } = input;

  const fWaste = 1 + wastePct / 100;
  const espesorLosa_m = espesorLosa_cm / 100;

  // 1. Diseño Ergonómico (Ley de Blondel)
  const estimacionAlzadas = Math.round(alturaTotal_m / 0.175); // Alzada ideal ~17.5cm
  const cantidadEscalones = estimacionAlzadas > 0 ? estimacionAlzadas : 1;
  const alzada_m = alturaTotal_m / cantidadEscalones;
  const desarrolloHorizontalTotal_m = tramos.reduce((sum, tramo) => sum + tramo.largoHorizontal_m, 0);
  const pedada_m = desarrolloHorizontalTotal_m / cantidadEscalones;
  const leyBlondel_cm = round2((2 * alzada_m + pedada_m) * 100);
  const anguloInclinacion_grados = round2(Math.atan(alturaTotal_m / desarrolloHorizontalTotal_m) * (180 / Math.PI));

  // 2. Cálculos de Volumen
  let volLosa = 0;
  let volEscalones = 0;
  let volDescanso = 0;
  let supEncofrado = 0;
  let aceroPrincKg = 0;
  let aceroRepartKg = 0;

  const areaTrianguloEscalon = (alzada_m * pedada_m) / 2;

  tramos.forEach(tramo => {
    const largoInclinado = Math.sqrt(tramo.largoHorizontal_m ** 2 + (alturaTotal_m / tramos.length) ** 2);
    volLosa += largoInclinado * tramo.ancho_m * espesorLosa_m;
    supEncofrado += largoInclinado * tramo.ancho_m; // Fondo de losa
    supEncofrado += largoInclinado * espesorLosa_m * 2; // Costados de la losa
    
    // Acero
    const cantPrincipales = Math.floor((tramo.ancho_m * 100) / aceroPrincipal.separacion_cm);
    const kgmPrinc = kgPorMetro(rebarTable, aceroPrincipal.phi_mm);
    aceroPrincKg += cantPrincipales * largoInclinado * kgmPrinc;

    const cantReparticion = Math.floor((largoInclinado * 100) / aceroReparticion.separacion_cm);
    const kgmRepart = kgPorMetro(rebarTable, aceroReparticion.phi_mm);
    aceroRepartKg += cantReparticion * tramo.ancho_m * kgmRepart;
  });
  
  // Asumimos escalones distribuidos uniformemente
  volEscalones = cantidadEscalones * areaTrianguloEscalon * tramos[0].ancho_m;
  supEncofrado += cantidadEscalones * alzada_m * tramos[0].ancho_m; // Frente de escalones

  if (incluirDescanso) {
    const anchoRealDescanso = input.tipo === 'U' ? anchoDescanso_m : tramos[0].ancho_m;
    volDescanso = (tramos[0].ancho_m * anchoRealDescanso) * espesorLosa_m;
    supEncofrado += (tramos[0].ancho_m * anchoRealDescanso);
  }

  const volTotal = (volLosa + volEscalones + volDescanso) * fWaste;
  
  return {
    alturaTotal_m: round2(alturaTotal_m),
    desarrolloHorizontalTotal_m: round2(desarrolloHorizontalTotal_m),
    cantidadEscalones,
    alzada_cm: round2(alzada_m * 100),
    pedada_cm: round2(pedada_m * 100),
    leyBlondel_cm,
    anguloInclinacion_grados,
    volumenHormigonTotal_m3: round2(volTotal),
    volumenHormigonLosa_m3: round2(volLosa * fWaste),
    volumenHormigonEscalones_m3: round2(volEscalones * fWaste),
    volumenHormigonDescanso_m3: round2(volDescanso * fWaste),
    aceroPrincipal_kg: round2(aceroPrincKg * fWaste),
    aceroReparticion_kg: round2(aceroRepartKg * fWaste),
    aceroTotal_kg: round2((aceroPrincKg + aceroRepartKg) * fWaste),
    superficieEncofrado_m2: round2(supEncofrado),
  };
}