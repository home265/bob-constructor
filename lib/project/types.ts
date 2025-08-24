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
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  materials: MaterialLine[];  // normalizado para sumar
  createdAt: number;
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

/** Opcional: para crear un proyecto desde el UI */
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

/** Opcional: para listados */
export type ProjectListItem = Pick<Project, "id" | "name" | "updatedAt"> & {
  partesCount?: number;
};
