// lib/project/types.ts

export type Unit = "u" | "m" | "m2" | "m3" | "kg" | "l";

export interface MaterialLine {
  key: string;        // clave estable p/ agrupar (ej: "cemento_bolsa_50kg")
  label: string;      // etiqueta legible (ej: "Cemento x 50 kg")
  qty: number;
  unit: Unit;
}

// Alias para compatibilidad con helpers (rowsToMaterials, aggregate, etc.)
export type MaterialRow = MaterialLine;

export type PartidaKind =
  | "muro" | "revoque" | "revestimiento" | "carpeta" | "contrapiso"
  | "base" | "pilote" | "losa" | "losa_premoldeada" | "viga" | "columna"
  | "boceto_estructural"; // 👈 nuevo

export interface Partida {
  id: string;                 // uuid
  kind: PartidaKind;
  title: string;              // “Muro 3×2.7 H10 común”
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  materials: MaterialLine[];  // normalizado para sumar
  createdAt: number;
  updatedAt: number;          // 👈 necesario para ordenar por recientes
}

export interface Project {
  id: string;             // uuid
  name: string;
  client?: string;
  siteAddress?: string;
  contact?: string;       // tel/email
  logoUrl?: string;       // opcional
  currency?: "ARS" | "USD";
  unitSystem?: "metric";
  notes?: string;

  partes: Partida[];
  createdAt: number;
  updatedAt: number;
}

/** Para crear un proyecto desde el UI (opcional) */
export type NewProject = {
  name: string;
  client?: string;
  siteAddress?: string;
  contact?: string;
  notes?: string;
  logoUrl?: string;
  currency?: "ARS" | "USD";
  unitSystem?: "metric";
};

/** Para listados (opcional) */
export type ProjectListItem = Pick<Project, "id" | "name" | "updatedAt"> & {
  partesCount?: number;
};

/** Payload estándar para guardar/actualizar una partida */
export interface SavePartidaPayload {
  title: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  materials: MaterialLine[];
}

/** Para componentes que guardan lote */
export interface BatchItem {
  kind: PartidaKind | string;
  title: string;
  materials: MaterialLine[];
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}
