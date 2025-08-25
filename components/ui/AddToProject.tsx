"use client";

import { useEffect, useState } from "react";
import {
  listProjects,
  createProject,
  addPartida,
  getActiveProjectId,   // ← NUEVO
  setActiveProjectId,   // ← NUEVO
} from "@/lib/project/storage";
import { rowsToMaterials } from "@/lib/project/helpers";
import type { PartidaKind } from "@/lib/project/types";

type Props = {
  kind: PartidaKind;
  defaultTitle: string;
  items: Array<{ key?: string; label: string; qty: number; unit: string }>;
  raw?: any;
};

export default function AddToProject({
  kind,
  defaultTitle,
  items,
  raw,
}: Props) {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [title, setTitle] = useState(defaultTitle);
  const [saving, setSaving] = useState(false);

  // Mantener sincronizado si cambia defaultTitle desde el padre
  useEffect(() => {
    setTitle(defaultTitle);
  }, [defaultTitle]);

  useEffect(() => {
    const list = listProjects();
    setProjects(list);

    // Preseleccionar proyecto activo si existe y está en la lista
    const activeId = getActiveProjectId?.();
    if (activeId && list.some(p => p.id === activeId)) {
      setProjectId(activeId);
    }
  }, []);

  async function handleAdd() {
    if (!items?.length) return;

    setSaving(true);
    try {
      let targetId = projectId;

      // ¿Nuevo proyecto?
      if (!targetId) {
        const name = newName.trim() || "Proyecto sin nombre";
        const p = createProject({ name });
        targetId = p.id;
        // fijar como activo al crear
        setActiveProjectId?.(targetId);
      }

      await addPartida(targetId, {
        kind,
        title: (title || "").trim() || defaultTitle,
        inputs: {},
        outputs: raw ?? {},
        materials: rowsToMaterials(items),
      });

      // Si el usuario eligió un proyecto existente, mantenerlo activo
      if (targetId && targetId !== getActiveProjectId?.()) {
        setActiveProjectId?.(targetId);
      }

      alert("Partida agregada al proyecto ✅");
    } catch (e) {
      console.error(e);
      alert("No se pudo guardar la partida 😕");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <h3 className="font-medium">Agregar al proyecto</h3>

      <label className="text-sm block">
        Título de partida
        <input
          className="w-full px-3 py-2 mt-1"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={defaultTitle}
        />
      </label>

      <div className="grid md:grid-cols-2 gap-3">
        <label className="text-sm block">
          Proyecto existente
          <select
            className="w-full px-3 py-2 mt-1"
            value={projectId}
            onChange={(e) => {
              const val = e.target.value;
              setProjectId(val);
              if (val) setActiveProjectId?.(val); // mantener activo al cambiar
            }}
          >
            <option value="">— Crear nuevo —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {!projectId && (
          <label className="text-sm block">
            Nombre del nuevo proyecto
            <input
              className="w-full px-3 py-2 mt-1"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej.: Casa López"
            />
          </label>
        )}
      </div>

      <button className="btn" disabled={saving} onClick={handleAdd}>
        {saving ? "Guardando…" : "Agregar al proyecto"}
      </button>
    </div>
  );
}
