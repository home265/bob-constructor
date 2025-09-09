export interface FuenteItem {
  id: string;
  titulo: string;
  editor: string;
  edicion: string;
  nota?: string;
}

export interface FuentesDb {
  version: string;
  items: FuenteItem[];
}

/** Carga dinámica del JSON de fuentes (en runtime del navegador). */
export async function getFuenteById(fuenteId: string): Promise<FuenteItem | null> {
  try {
    const res = await fetch("/data/fuentes.json", { cache: "force-cache" });
    const db = (await res.json()) as FuentesDb;
    const found = db.items.find((f) => f.id === fuenteId);
    return found ?? null;
  } catch {
    return null;
  }
}
