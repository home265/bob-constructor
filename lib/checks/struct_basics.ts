import { makeMsg, CheckMessage } from "./messages";

/** Unidades base en metros y kN, pensado para entradas simples de obra. */
export interface BeamCheckInput {
  span_m: number;           // luz libre de la viga
  section_b_cm: number;     // ancho sección (cm)
  section_h_cm: number;     // alto sección (cm)
  floors_supported: number; // cantidad de pisos que carga (aprox)
}

export interface ColumnCheckInput {
  clear_height_m: number;
  section_b_cm: number;
  section_h_cm: number;
  floors_above: number;
}

export interface SlabCheckInput {
  span_m: number;
  thickness_cm: number;
  usage: "vivienda" | "comercial_liviano";
}

export interface FootingCheckInput {
  column_b_cm: number;
  column_h_cm: number;
  footing_b_m: number;
  footing_h_m: number;
  soil_allow_kPa?: number; // tensión admisible, si se desea precargar
}

/** Lógica simple, orientativa: límites razonables sin cálculo normativo. */
export function checkBeamBasics(i: BeamCheckInput): CheckMessage[] {
  const msgs: CheckMessage[] = [];
  const h_m = i.section_h_cm / 100;
  const b_m = i.section_b_cm / 100;

  // Relación luz/altura (regla rápida: L/h ≤ 12…16 para vigas de hormigón)
  const l_over_h = i.span_m / (h_m > 0 ? h_m : 1e-6);
  if (l_over_h > 18) {
    msgs.push(
      makeMsg(
        "BEAM_SLENDER",
        "danger",
        "Viga muy esbelta para la luz indicada",
        `Relación L/h ≈ ${l_over_h.toFixed(1)}. Para obra típica se sugiere L/h ≤ 16.`,
        "Aumentar altura de viga o agregar apoyo intermedio."
      )
    );
  } else if (l_over_h > 16) {
    msgs.push(
      makeMsg(
        "BEAM_NEAR_LIMIT",
        "warning",
        "Viga cercana al límite de esbeltez",
        `Relación L/h ≈ ${l_over_h.toFixed(1)}.`,
        "Si hay cargas importantes, conviene aumentar 2–5 cm de altura."
      )
    );
  }

  // Ancho mínimo razonable vs altura
  if (b_m < h_m * 0.35) {
    msgs.push(
      makeMsg(
        "BEAM_NARROW",
        "warning",
        "La viga parece angosta respecto a su altura",
        `b/h ≈ ${(b_m / (h_m || 1e-6)).toFixed(2)}.`,
        "Considerar aumentar el ancho o reducir altura para facilitar armadura y anclajes."
      )
    );
  }

  // Pisos soportados (orientativo)
  if (i.floors_supported >= 3 && h_m < 0.3) {
    msgs.push(
      makeMsg(
        "BEAM_FLOORS_HIGH",
        "warning",
        "Viga liviana para varios pisos",
        "Para 3 pisos o más, suele requerirse mayor inercia.",
        "Subir altura a 30 cm o más según la luz."
      )
    );
  }

  return msgs;
}

export function checkColumnBasics(i: ColumnCheckInput): CheckMessage[] {
  const msgs: CheckMessage[] = [];
  const h_cm = i.section_h_cm;
  const b_cm = i.section_b_cm;

  // Mínimos razonables de sección para vivienda: 20x20 cm
  if (h_cm < 20 || b_cm < 20) {
    msgs.push(
      makeMsg(
        "COL_MIN_SECTION",
        "danger",
        "Sección de columna muy chica",
        `Se sugiere mínimo 20×20 cm en vivienda.`,
        "Aumentar a 20×20 cm o más."
      )
    );
  }

  // Esbeltez geométrica simple: altura libre / menor lado (en m)
  const k = i.clear_height_m / ((Math.min(b_cm, h_cm) / 100) || 1e-6);
  if (k > 15 && k <= 20) {
    msgs.push(
      makeMsg(
        "COL_SLENDER_WARN",
        "warning",
        "Columna esbelta",
        `Relación altura/lado ≈ ${k.toFixed(1)}.`,
        "Agregar arriostramiento o aumentar la sección."
      )
    );
  } else if (k > 20) {
    msgs.push(
      makeMsg(
        "COL_SLENDER_HIGH",
        "danger",
        "Columna demasiado esbelta",
        `Relación altura/lado ≈ ${k.toFixed(1)}.`,
        "Aumentar significativamente la sección o reducir altura libre."
      )
    );
  }

  // Pisos por encima (orientativo)
  if (i.floors_above >= 2 && Math.min(h_cm, b_cm) < 25) {
    msgs.push(
      makeMsg(
        "COL_FLOORS_HIGH",
        "warning",
        "Columna justa para varios pisos",
        "Para 2 pisos o más, se recomiendan lados ≥ 25 cm.",
        "Subir a 25×25 cm o mayor."
      )
    );
  }

  return msgs;
}

export function checkSlabBasics(i: SlabCheckInput): CheckMessage[] {
  const msgs: CheckMessage[] = [];
  const t_m = i.thickness_cm / 100;

  // Relación luz/espesor losa maciza (regla rápida: L/t ≤ 35…45)
  const l_over_t = i.span_m / (t_m > 0 ? t_m : 1e-6);
  const limit = i.usage === "comercial_liviano" ? 35 : 40;

  if (l_over_t > limit + 5) {
    msgs.push(
      makeMsg(
        "SLAB_TOO_THIN",
        "danger",
        "Losa muy fina para la luz",
        `Relación L/t ≈ ${l_over_t.toFixed(1)} (límite sugerido ≈ ${limit}).`,
        "Aumentar 1–2 cm de espesor o agregar nervios/apoyos."
      )
    );
  } else if (l_over_t > limit) {
    msgs.push(
      makeMsg(
        "SLAB_NEAR_LIMIT",
        "warning",
        "Losa cercana al límite de esbeltez",
        `Relación L/t ≈ ${l_over_t.toFixed(1)}.`,
        "Si hay cargas de uso altas, aumentar 1 cm de espesor."
      )
    );
  }

  // Espesor mínimo razonable
  if (i.thickness_cm < 10) {
    msgs.push(
      makeMsg(
        "SLAB_MIN_THICK",
        "warning",
        "Espesor muy bajo",
        "Para vivienda, 10–12 cm es típico en losa maciza.",
        "Subir a 10–12 cm según luz y uso."
      )
    );
  }

  return msgs;
}

export function checkFootingBasics(i: FootingCheckInput): CheckMessage[] {
  const msgs: CheckMessage[] = [];
  const col_b_m = i.column_b_cm / 100;
  const col_h_m = i.column_h_cm / 100;

  // Proporción zapata vs columna (borde libre mínimo razonable)
  if (i.footing_b_m < Math.max(col_b_m, col_h_m) + 0.3) {
    msgs.push(
      makeMsg(
        "FOOTING_EDGE_CLEAR",
        "warning",
        "Zapata con borde libre chico",
        "Dejar al menos 15 cm por lado (30 cm en total sobre el lado de columna).",
        "Aumentar base en planta."
      )
    );
  }

  // Espesor mínimo razonable (20–30 cm típico)
  if (i.footing_h_m < 0.25) {
    msgs.push(
      makeMsg(
        "FOOTING_THICK_MIN",
        "warning",
        "Espesor de zapata bajo",
        "Valores usuales: 25–40 cm según carga.",
        "Aumentar a 0.25 m o más."
      )
    );
  }

  // Si el usuario declara tensión admisible bajita, advertir tamaño
  if (i.soil_allow_kPa !== undefined && i.soil_allow_kPa < 100) {
    msgs.push(
      makeMsg(
        "SOIL_WEAK",
        "info",
        "Suelo blando (tensión admisible baja)",
        `Declarado ${i.soil_allow_kPa} kPa.`,
        "Puede requerir zapatas mayores o pilotes."
      )
    );
  }

  return msgs;
}
