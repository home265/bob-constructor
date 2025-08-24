// lib/types.ts
export type Opening = { lv: number; hv: number; sv?: number }; // m x m o área directa

export type WallOptions = {
  tipo_muro: { id: "simple" | "doble"; label: string }[];
  ladrillos_bloques: {
    id: string;
    label: string;
    familia: string;
    dims_mm?: { e?: number; h?: number; l?: number };
  }[];
  juntas_mm: number[];
  morteros_asiento_ids: string[];
  revoques_ids: string[];
  flags: { aislamiento_termico?: boolean };
};

export type WallCoefficient = {
  ladrillo_id: string;
  junta_mm: number;
  unid_por_m2: number;
  mortero_asiento_m3_por_m2: number;
};

export type Mortar = {
  id: string;
  nombre: string;
  proporcion: { cemento: number; cal: number; arena: number };
  bolsas_cemento_por_m3: number;
  kg_cal_por_m3: number;
  agua_l_por_m3: number;
};

export type Defaults = {
  desperdicio_pct: Record<string, number>;
  redondeo: Record<string, string>;
  max_vanos: number;
};

// ---- Entradas/Salidas del cálculo de Muros
export type WallFormInput = {
  tipoMuroId: "simple" | "doble";
  ladrilloId: string;
  juntaMm: number;
  morteroAsientoId: string;
  // Geometría (m)
  L: number;
  H: number;
  SA?: number; // superficie adicional
  vanos: Opening[]; // hasta 3
  desperdicioPct?: number; // si no, usar defaults
};

export type WallResult = {
  areaNeta_m2: number;
  unidades: number; // ladrillos/bloques
  mortero_asiento_m3: number;
  cemento_bolsas: number;
  cal_kg: number;
  agua_l: number;
  avisos?: string[];
};
