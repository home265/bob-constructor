// components/ui/AddToProjectBatch.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listProjects,
  createProject,
  addPartida,
  getActiveProjectId,
} from "@/lib/project/storage";
import type { PartidaKind, MaterialRow, Project } from "@/lib/project/types";

type BatchItem = {
  kind: PartidaKind;
  title: string;
  materials: MaterialRow[];
  inputs: Record<string, any>;
  outputs: Record<string, any>;
};

type Props = {
  items: BatchItem[];
  onSaved?: (projectId: string) => void;
};

type ProjectLite = Pick<Project, "id" | "name">;

export default function AddToProjectBatch({ items, onSaved }: Props) {
  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [projectId, setProjectId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const list = (listProjects() || []) as Project[];
    setProjects(list.map(p => ({ id: p.id, name: p.name })));
    const active = getActiveProjectId?.();
    if (active) setProjectId(active);
    else if (list[0]) setProjectId(list[0].id);
  }, []);

  const canSave = useMemo(() => {
    if (!items?.length) return false;
    if (mode === "existing") return Boolean(projectId);
    return newName.trim().length > 0;
  }, [items, mode, projectId, newName]);

  function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      let targetId = projectId;

      if (mode === "new") {
        const p = createProject({ name: newName.trim() });
        // si createProject es async, usá: const p = await createProject(...)
        targetId = (p as Project).id;
        setProjectId(targetId);
      }

      for (const it of items) {
        // addPartida debería encargarse de generar id/createdAt internamente
        addPartida(targetId, {
          kind: it.kind,
          title: it.title,
          materials: it.materials,
          inputs: it.inputs,
          outputs: it.outputs,
        } as any);
      }

      onSaved?.(targetId);
      // feedback mínimo; reemplazalo por tu sistema de toasts si tenés
      alert("Lote guardado en el proyecto ✅");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar el lote 😕");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <h3 className="font-medium">Guardar lote en proyecto</h3>

      <div className="text-sm text-gray-600">
        Ítems en lote: <strong>{items?.length ?? 0}</strong>
      </div>

      <div className="flex gap-3 items-center">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="projMode"
            checked={mode === "existing"}
            onChange={() => setMode("existing")}
          />
          Usar proyecto existente
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="projMode"
            checked={mode === "new"}
            onChange={() => setMode("new")}
          />
          Crear proyecto nuevo
        </label>
      </div>

      {mode === "existing" ? (
        <label className="text-sm block">
          Proyecto
          <select
            className="w-full mt-1"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="text-sm block">
          Nombre del proyecto
          <input
            className="w-full mt-1"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej.: Casa López"
          />
        </label>
      )}

      <button className="btn" disabled={!canSave || saving} onClick={handleSave}>
        {saving ? "Guardando…" : "Guardar lote en proyecto"}
      </button>
    </div>
  );
}
