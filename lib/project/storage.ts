// lib/project/storage.ts
// API de almacenamiento "a lo Gasista" para Bob Constructor.
// Usa Dexie (IndexedDB) y expone helpers para proyectos y partidas.
// ⚠️ Importar y usar SOLO en cliente (no en Server Components).

import { getDB, type Project, type Partida, type MaterialRow } from "@/lib/db";
import type { MaterialLine as UIMaterial } from "@/lib/project/types";
import { rid } from "@/lib/id";

/* ---------------------------------- Utils --------------------------------- */

function ensureClient() {
  if (typeof window === "undefined") {
    throw new Error(
      "storage.ts: esta API solo puede usarse en el cliente (IndexedDB no está disponible en SSR)."
    );
  }
}

const ACTIVE_KEY = "bob_active_project_v1"; // para recordar el proyecto activo en UI

/** Ordena proyectos por updatedAt desc */
function sortByUpdatedAtDesc(a: Project, b: Project) {
  return (b?.updatedAt ?? 0) - (a?.updatedAt ?? 0);
}

/** Normaliza materiales provenientes del UI a la forma del DB */
function toDBMaterialRow(m: MaterialRow | UIMaterial): MaterialRow {
  // DB.MaterialRow: { description: string; unit?: string; qty: number; ... }
  // UI.MaterialLine: { key: string; label: string; qty: number; unit: "u"|"m"|... }
  if ("label" in m) {
    const ui = m as UIMaterial;
    const out: MaterialRow = { description: ui.label, qty: ui.qty };
    if (ui.unit) out.unit = ui.unit;
    return out;
  }
  return m as MaterialRow;
}
function toDBMaterials(materials: Array<MaterialRow | UIMaterial>): MaterialRow[] {
  return materials.map(toDBMaterialRow);
}

/* ------------------------------ Proyectos CRUD ----------------------------- */

/** Lista todos los proyectos (más recientes primero) */
export async function listProjects(): Promise<Project[]> {
  ensureClient();
  const db = getDB();
  const rows = await db.projects.toArray();
  return rows.sort(sortByUpdatedAtDesc);
}

/** Crea un proyecto vacío */
export async function createProject(input: {
  name: string;
  client?: string;
  siteAddress?: string;
  notes?: string;
}): Promise<Project> {
  ensureClient();
  const now = Date.now();
  const project: Project = {
    id: rid("prj"),
    name: input.name?.trim() || "Proyecto",
    client: input.client?.trim(),
    siteAddress: input.siteAddress?.trim(),
    notes: input.notes,
    partes: [],
    createdAt: now,
    updatedAt: now,
  };
  const db = getDB();
  await db.projects.put(project);
  return project;
}

/** Lee un proyecto por id */
export async function getProject(id: string): Promise<Project | undefined> {
  ensureClient();
  const db = getDB();
  return db.projects.get(id);
}

/** Renombra y/o actualiza metadatos del proyecto */
export async function updateProjectMeta(
  id: string,
  patch: Partial<Pick<Project, "name" | "client" | "siteAddress" | "notes">>
): Promise<Project | null> {
  ensureClient();
  const db = getDB();
  const current = await db.projects.get(id);
  if (!current) return null;

  const updated: Project = {
    ...current,
    ...patch,
    updatedAt: Date.now(),
  };
  await db.projects.put(updated);
  return updated;
}

/** Aplica un mutador arbitrario sobre un proyecto (útil para cambios complejos) */
export async function updateProject(
  id: string,
  mutator: (p: Project) => void | Project
): Promise<Project | null> {
  ensureClient();
  const db = getDB();
  const current = await db.projects.get(id);
  if (!current) return null;

  const draft: Project = { ...current };
  const result = mutator(draft);
  const next = (result ?? draft) as Project;
  next.updatedAt = Date.now();

  await db.projects.put(next);
  return next;
}

/** Duplica un proyecto y devuelve su copia */
export async function duplicateProject(id: string): Promise<Project | null> {
  ensureClient();
  const db = getDB();
  const src = await db.projects.get(id);
  if (!src) return null;

  const now = Date.now();
  const copy: Project = {
    ...structuredClone(src),
    id: rid("prj"),
    name: `${src.name} (copia)`,
    createdAt: now,
    updatedAt: now,
    // aseguramos IDs únicos para partidas
    partes: src.partes.map((pt) => ({ ...pt, id: rid("pt"), createdAt: now, updatedAt: now })),
  };
  await db.projects.put(copy);
  return copy;
}

/** Elimina un proyecto por id */
export async function removeProject(id: string): Promise<void> {
  ensureClient();
  const db = getDB();
  await db.projects.delete(id);

  // si estaba activo, lo limpiamos
  if (getActiveProjectId() === id) {
    setActiveProjectId(null);
  }
}

/* ------------------------- Estado de UI: proyecto activo ------------------- */

export function getActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export function setActiveProjectId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // noop
  }
}

/* ---------------------------- Partidas (cálculos) -------------------------- */

export type SavePartidaPayload = {
  title: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  materials: Array<MaterialRow | UIMaterial>; // acepta UI o DB; se normaliza al guardar
};

/** Obtiene una partida por `kind` dentro de un proyecto (si existe) */
export async function getPartidaByKind(
  projectId: string,
  kind: string
): Promise<Partida | undefined> {
  ensureClient();
  const db = getDB();
  const p = await db.projects.get(projectId);
  if (!p) return undefined;
  return p.partes.find((pt) => pt.kind === kind);
}

/** Lista todas las partidas de un proyecto (útil para tablero/overview) */
export async function listPartidas(projectId: string): Promise<Partida[]> {
  ensureClient();
  const db = getDB();
  const p = await db.projects.get(projectId);
  if (!p) return [];
  // orden por actualización reciente primero
  return [...p.partes].sort((a, b) => (b?.updatedAt ?? 0) - (a?.updatedAt ?? 0));
}

/** Inserta/actualiza una partida por `kind` (idempotente por tipo de calculadora) */
export async function saveOrUpdatePartidaByKind(
  projectId: string,
  kind: string,
  data: SavePartidaPayload
): Promise<Partida | null> {
  ensureClient();
  const db = getDB();
  const p = await db.projects.get(projectId);
  if (!p) return null;

  const now = Date.now();
  const idx = p.partes.findIndex((pt) => pt.kind === kind);

  const base = {
    kind,
    title: data.title?.trim() || "Cálculo",
    inputs: data.inputs ?? {},
    outputs: data.outputs ?? {},
    materials: toDBMaterials(Array.isArray(data.materials) ? data.materials : []),
  };

  let nextPartida: Partida;
  if (idx >= 0) {
    // update in-place
    nextPartida = {
      ...p.partes[idx],
      ...base,
      updatedAt: now,
    };
    p.partes[idx] = nextPartida;
  } else {
    // insert new
    nextPartida = {
      id: rid("pt"),
      ...base,
      createdAt: now,
      updatedAt: now,
    };
    p.partes.push(nextPartida);
  }

  p.updatedAt = now;
  await db.projects.put(p);
  return nextPartida;
}

/** Elimina una partida por `kind` dentro del proyecto */
export async function removePartidaByKind(projectId: string, kind: string): Promise<boolean> {
  ensureClient();
  const db = getDB();
  const p = await db.projects.get(projectId);
  if (!p) return false;

  const before = p.partes.length;
  p.partes = p.partes.filter((pt) => pt.kind !== kind);
  if (p.partes.length === before) return false;

  p.updatedAt = Date.now();
  await db.projects.put(p);
  return true;
}

/** Lee una partida por id dentro de un proyecto */
export async function getPartida(
  projectId: string,
  partidaId: string
): Promise<Partida | undefined> {
  ensureClient();
  const db = getDB();
  const p = await db.projects.get(projectId);
  if (!p) return undefined;
  return p.partes.find((pt) => pt.id === partidaId);
}

/** Actualiza una partida por id (sin cambiar la lógica de cálculo) */
export async function updatePartida(
  projectId: string,
  partidaId: string,
  data: SavePartidaPayload
): Promise<Partida | null> {
  ensureClient();
  const db = getDB();
  const p = await db.projects.get(projectId);
  if (!p) return null;

  const idx = p.partes.findIndex((pt) => pt.id === partidaId);
  if (idx === -1) return null;

  const now = Date.now();
  const updated: Partida = {
    ...p.partes[idx],
    title: data.title?.trim() || p.partes[idx].title,
    inputs: data.inputs ?? p.partes[idx].inputs,
    outputs: data.outputs ?? p.partes[idx].outputs,
    materials: toDBMaterials(Array.isArray(data.materials) ? data.materials : []),
    updatedAt: now,
  };

  p.partes[idx] = updated;
  p.updatedAt = now;
  await db.projects.put(p);
  return updated;
}

/* ---------------------------- Helpers de migración ------------------------- */

/**
 * Migración opcional desde localStorage (versión anterior de Constructor).
 * Espera dos claves:
 *  - "bob_projects_v1": JSON con un array de proyectos con forma anterior
 *  - "bob_active_project_v1": id del proyecto activo
 *
 * Si todo migra bien, deja un flag "MIGRATED_V1" para no repetir.
 */
export async function migrateFromLocalStorageV1(): Promise<{ migrated: number }> {
  ensureClient();
  const FLAG = "MIGRATED_V1";

  // helpers de narrowing
  const asString = (v: unknown): string | undefined =>
    typeof v === "string" ? v : undefined;
  const asNumber = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const asRecord = (v: unknown): Record<string, unknown> | undefined =>
    v !== null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
  const asArray = (v: unknown): unknown[] | undefined =>
    Array.isArray(v) ? (v as unknown[]) : undefined;

  try {
    if (localStorage.getItem(FLAG)) return { migrated: 0 };

    const raw = localStorage.getItem("bob_projects_v1");
    if (!raw) {
      localStorage.setItem(FLAG, "1");
      return { migrated: 0 };
    }

    const parsed: unknown = JSON.parse(raw);
    const arr = asArray(parsed);
    if (!arr) {
      localStorage.setItem(FLAG, "1");
      return { migrated: 0 };
    }

    const db = getDB();
    let migrated = 0;

    for (const item of arr) {
      const it = asRecord(item);
      if (!it) continue;

      const now = Date.now();

      const partesSrc = asArray(it["partes"]) ?? [];
      const partes: Partida[] = partesSrc
        .map((pt) => {
          const pr = asRecord(pt);
          if (!pr) return null;

          const inputs = asRecord(pr["inputs"]) ?? {};
          const outputs = asRecord(pr["outputs"]) ?? {};

          const materialsSrc = asArray(pr["materials"]) ?? [];
          const materials: MaterialRow[] = materialsSrc
            .map((m): MaterialRow | null => {
              const mm = asRecord(m);
              if (!mm) return null;

              const description =
                asString(mm["description"]) ?? asString(mm["label"]) ?? "Ítem";
              const qty = asNumber(mm["qty"]) ?? 0;
              const unit = asString(mm["unit"]);

              const out: MaterialRow = { description, qty };
              if (unit) out.unit = unit;
              return out;
            })
            .filter((x): x is MaterialRow => x !== null);

          const createdAt = asNumber(pr["createdAt"]) ?? now;
          const updatedAt = asNumber(pr["updatedAt"]) ?? now;

          return {
            id: asString(pr["id"]) ?? rid("pt"),
            kind: asString(pr["kind"]) ?? "constructor_custom",
            title: asString(pr["title"]) ?? "Cálculo",
            inputs,
            outputs,
            materials,
            createdAt,
            updatedAt,
          } as Partida;
        })
        .filter((x): x is Partida => x !== null);

      const project: Project = {
        id: asString(it["id"]) ?? rid("prj"),
        name: asString(it["name"]) ?? "Proyecto",
        client: asString(it["client"]) ?? undefined,
        siteAddress: asString(it["siteAddress"]) ?? undefined,
        notes: asString(it["notes"]) ?? undefined,
        partes,
        createdAt: asNumber(it["createdAt"]) ?? now,
        updatedAt: asNumber(it["updatedAt"]) ?? now,
      };

      await db.projects.put(project);
      migrated++;
    }

    localStorage.setItem(FLAG, "1");
    return { migrated };
  } catch {
    // si algo falla, marcamos flag para no bloquear el arranque
    try {
      localStorage.setItem("MIGRATED_V1", "1");
    } catch {}
    return { migrated: 0 };
  }
}
