"use client";

import { useEffect, useState } from "react";
import {
  listProjects,
  createProject,
  addPartida,
} from "@/lib/project/storage";
import { rowsToMaterials } from "@/lib/project/helpers";
import type { PartidaKind } from "@/lib/project/types";

type Props = {
  kind: PartidaKind; // ✅ ahora es el union correcto
  defaultTitle: string;
  // Filas que mostrás en ResultTable
  items: Array<{ key?: string; label: string; qty: number; unit: string }>;
  // Objeto crudo del cálculo (lo guardamos en outputs para que quede persistido)
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

  useEffect(() => {
    setProjects(listProjects());
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
      }

      await addPartida(targetId, {
        kind, // ✅ PartidaKind
        title: title.trim() || defaultTitle,
        inputs: {},                 // ✅ tus tipos lo piden
        outputs: raw ?? {},         // ✅ guardamos el cálculo aquí
        materials: rowsToMaterials(items),
      });

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
            onChange={(e) => setProjectId(e.target.value)}
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
