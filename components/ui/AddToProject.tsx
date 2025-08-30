"use client";

import { useEffect, useMemo, useState } from "react";
import { listProjects, createProject, saveOrUpdatePartidaByKind } from "@/lib/project/storage";
import type { Unit, MaterialLine } from "@/lib/project/types";

type DisplayItem = { key?: string; label: string; qty: number; unit: string };

interface Props {
  kind: string;
  defaultTitle: string;
  items: DisplayItem[];
  raw: unknown;
}

const toUnit = (u?: string): Unit =>
  u === "m²" ? "m2" :
  u === "m³" ? "m3" :
  u === "bolsas" ? "u" :
  (["u","m","m2","m3","kg","l"] as const).includes((u ?? "") as Unit) ? (u as Unit) : "u";

export default function AddToProject({ kind, defaultTitle, items, raw }: Props) {
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [newName, setNewName] = useState<string>("");

  useEffect(() => {
    (async () => {
      const rows = await listProjects();
      setProjects(rows.map(r => ({ id: r.id, name: r.name })));
      if (rows.length) setProjectId(rows[0].id);
    })();
  }, []);

  const materials: MaterialLine[] = useMemo(() => {
    return items.map((m, idx) => ({
      key: (m.key && m.key.trim()) || `it_${idx}`,
      label: m.label,
      qty: Number.isFinite(m.qty) ? m.qty : 0,
      unit: toUnit(m.unit),
    }));
  }, [items]);

  async function handleCreateAndSave() {
    if (!newName.trim()) return;
    const p = await createProject({ name: newName.trim() });
    await saveOrUpdatePartidaByKind(p.id, kind, {
      title: defaultTitle,
      inputs: { raw },
      outputs: { raw },
      materials,
    });
    setNewName("");
    const rows = await listProjects();
    setProjects(rows.map(r => ({ id: r.id, name: r.name })));
    setProjectId(p.id);
  }

  async function handleSave() {
    if (!projectId) return;
    await saveOrUpdatePartidaByKind(projectId, kind, {
      title: defaultTitle,
      inputs: { raw },
      outputs: { raw },
      materials,
    });
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Guardar en proyecto</h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Proyecto</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="rounded border px-3 py-2"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Crear nuevo</span>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del proyecto"
              className="flex-1 rounded border px-3 py-2"
            />
            <button type="button" className="btn btn-secondary" onClick={handleCreateAndSave}>
              Crear y guardar
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          Guardar en proyecto
        </button>
      </div>
    </div>
  );
}
