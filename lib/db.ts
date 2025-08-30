// IMPORTANT: Este módulo debe usarse sólo en el **cliente** (IndexedDB).
// Evitá llamar getDB() en Server Components/SSR.

import Dexie, { Table } from "dexie";

/** Línea de material exportable/agrupable (tabla de salida) */
export interface MaterialRow {
  description: string;
  unit?: string;
  qty: number;
  code?: string;
  price?: number;
  wastePercent?: number;
}

/** Una “Partida” = una ejecución de calculadora dentro del proyecto */
export interface Partida {
  id: string;
  kind: string; // p.ej. "constructor_muros", "constructor_viga"
  title: string;

  // Guardamos lo que tu UI necesite restaurar
  inputs: Record<string, unknown>;
  // Resultados ya calculados (lo que mostrás en pantalla)
  outputs: Record<string, unknown>;
  // Materiales para exportación / agregado global
  materials: MaterialRow[];

  createdAt: number;
  updatedAt: number;
}

/** Proyecto contenedor de partidas */
export interface Project {
  id: string;
  name: string;
  client?: string;
  siteAddress?: string;
  notes?: string;

  partes: Partida[];

  createdAt: number;
  updatedAt: number;
}

export class AppDatabase extends Dexie {
  projects!: Table<Project, string>;

  constructor() {
    super("bob-constructor-db");
    // Índices: id (PK), name (búsqueda), updatedAt (ordenar recientes)
    this.version(1).stores({
      projects: "id, name, updatedAt",
    });
  }
}

// Singleton seguro para HMR y evitar múltiples conexiones
declare global {
  // eslint-disable-next-line no-var
  var __bobConstructorDb: AppDatabase | undefined;
}

/**
 * Devuelve la instancia de Dexie (sólo en cliente).
 * Lanza error si se invoca en servidor.
 */
export function getDB(): AppDatabase {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB no está disponible en el servidor (SSR). Llamá getDB() sólo en el cliente.");
  }
  if (!globalThis.__bobConstructorDb) {
    globalThis.__bobConstructorDb = new AppDatabase();
  }
  return globalThis.__bobConstructorDb;
}
