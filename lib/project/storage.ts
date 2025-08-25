import { Project, Partida } from "./types";

const KEY = "bob_projects_v1";
const ACTIVE = "bob_active_project_v1";

function isBrowser() { return typeof window !== "undefined"; }

function readAll(): Project[] {
  if (!isBrowser()) return [];
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

function writeAll(list: Project[]) {
  if (!isBrowser()) return;
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

export function listProjects() { return readAll(); }
export function getProject(id: string) { return readAll().find(p => p.id === id) || null; }

export function saveProject(p: Project) {
  const all = readAll();
  const i = all.findIndex(x => x.id === p.id);
  if (i >= 0) all[i] = p; else all.push(p);
  writeAll(all);
}

export function createProject(data: Partial<Project>) {
  const now = Date.now();
  const p: Project = {
    id: crypto.randomUUID(),
    name: data.name || "Nuevo proyecto",
    client: data.client || "",
    siteAddress: data.siteAddress || "",
    contact: data.contact || "",
    logoUrl: data.logoUrl || "",
    currency: data.currency || "ARS",
    unitSystem: "metric",
    notes: data.notes || "",
    partes: [],
    createdAt: now,
    updatedAt: now,
  };
  saveProject(p);
  return p;
}

// 👇 FUNCIÓN AÑADIDA PARA ELIMINAR PROYECTOS 👇
export function deleteProject(projectId: string): void {
  if (!isBrowser()) return;

  const all = readAll();
  const newList = all.filter(p => p.id !== projectId);
  writeAll(newList);

  // Opcional: Si el proyecto eliminado era el activo, lo limpiamos
  if (getActiveProjectId() === projectId) {
    localStorage.removeItem(ACTIVE);
  }
}
// 👆 FIN DE LA FUNCIÓN AÑADIDA 👆

export function addPartida(projectId: string, part: Omit<Partida, "id" | "createdAt">) {
  const p = getProject(projectId);
  if (!p) throw new Error("Proyecto no encontrado");
  const nueva: Partida = { ...part, id: crypto.randomUUID(), createdAt: Date.now() };
  p.partes.push(nueva);
  p.updatedAt = Date.now();
  saveProject(p);
  return nueva;
}

export function removePartida(projectId: string, partidaId: string) {
  const p = getProject(projectId);
  if (!p) return;
  p.partes = p.partes.filter(x => x.id !== partidaId);
  p.updatedAt = Date.now();
  saveProject(p);
}

// 🔹 NUEVO: obtener una partida por id
export function getPartida(projectId: string, partidaId: string): Partida | null {
  const p = getProject(projectId);
  if (!p) return null;
  return p.partes.find(x => x.id === partidaId) || null;
}

// 🔹 NUEVO: actualizar (merge) una partida existente
export function updatePartida(
  projectId: string,
  partidaId: string,
  patch: Partial<Omit<Partida, "id" | "createdAt">>
): Partida {
  const p = getProject(projectId);
  if (!p) throw new Error("Proyecto no encontrado");
  const i = p.partes.findIndex(x => x.id === partidaId);
  if (i === -1) throw new Error("Partida no encontrada");

  const actual = p.partes[i];
  const actualizado: Partida = {
    ...actual,
    ...patch,
    id: actual.id,                // aseguramos identidad
    createdAt: actual.createdAt,  // preservamos creación
  };

  p.partes[i] = actualizado;
  p.updatedAt = Date.now();
  saveProject(p);
  return actualizado;
}

// 🔹 OPCIONAL: duplicar una partida (con nuevos id/createdAt)
export function duplicatePartida(
  projectId: string,
  partidaId: string,
  overrides?: Partial<Omit<Partida, "id" | "createdAt">>
): Partida {
  const p = getProject(projectId);
  if (!p) throw new Error("Proyecto no encontrado");
  const original = p.partes.find(x => x.id === partidaId);
  if (!original) throw new Error("Partida no encontrada");

  const copia: Partida = {
    ...original,
    ...overrides,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };

  p.partes.push(copia);
  p.updatedAt = Date.now();
  saveProject(p);
  return copia;
}

export function setActiveProjectId(id: string) {
  if (!isBrowser()) return;
  try { localStorage.setItem(ACTIVE, id); } catch {}
}
export function getActiveProjectId() {
  if (!isBrowser()) return null;
  try { return localStorage.getItem(ACTIVE); } catch { return null; }
}

// 🔹 helper opcional (no cambia nada existente): obtener el proyecto activo
export function getActiveProject(): Project | null {
  const id = getActiveProjectId();
  return id ? getProject(id) : null;
}