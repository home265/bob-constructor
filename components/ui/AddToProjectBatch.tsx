"use client";

import { useEffect, useMemo, useState } from "react";
import { listProjects, createProject, saveOrUpdatePartidaByKind } from "@/lib/project/storage";
import type { Unit, MaterialLine } from "@/lib/project/types";

type DisplayMaterial = { key?: string; label: string; qty: number; unit: string };
type BatchItemInput = {
  kind: string;
  title: string;
  materials: DisplayMaterial[];
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
};

interface Props {
  items: BatchItemInput[];
  onSaved?: () => void;
}

const toUnit = (u?: string): Unit =>
  u === "m²" ? "m2" :
  u === "m³" ? "m3" :
  u === "bolsas" ? "u" :
  (["u","m","m2","m3","kg","l"] as const).includes((u ?? "") as Unit) ? (u as Unit) : "u";

export default function AddToProjectBatch({ items, onSaved }: Props) {
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

  const mapped = useMemo(() => {
    return items.map((it) => {
      const materials: MaterialLine[] = it.materials.map((m, idx) => ({
        key: (m.key && m.key.trim()) || `it_${idx}`,
        label: m.label,
        qty: Number.isFinite(m.qty) ? m.qty : 0,
        unit: toUnit(m.unit),
      }));
      return { ...it, materials };
    });
  }, [items]);

  async function handleCreate() {
    if (!newName.trim()) return;
    const p = await createProject({ name: newName.trim() });
    setNewName("");
    const rows = await listProjects();
    setProjects(rows.map(r => ({ id: r.id, name: r.name })));
    setProjectId(p.id);
  }

  async function handleSaveAll() {
    if (!projectId) return;
    for (const it of mapped) {
      await saveOrUpdatePartidaByKind(projectId, it.kind, {
        title: it.title,
        inputs: it.inputs,
        outputs: it.outputs,
        materials: it.materials,
      });
    }
    if (onSaved) onSaved();
  }

  return (
    <div className="space-y-3">
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
            <button type="button" className="btn btn-secondary" onClick={handleCreate}>
              Crear
            </button>
          </div>
        </div>
      </div>

      <button type="button" className="btn btn-primary" onClick={handleSaveAll}>
        Guardar lote en proyecto
      </button>
    </div>
  );
}
