"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { listProjects, setActiveProjectId, removeProject } from "@/lib/project/storage";

export default function ProyectosPage() {
  const [projects, setProjects] = useState<Array<{ id: string; name: string; client?: string }>>([]);

  useEffect(() => {
    (async () => {
      const rows = await listProjects();
      setProjects(rows.map(p => ({ id: p.id, name: p.name, client: p.client })));
    })();
  }, []);

  async function refresh() {
    const rows = await listProjects();
    setProjects(rows.map(p => ({ id: p.id, name: p.name, client: p.client })));
  }

  const handleDelete = async (projectId: string, projectName: string) => {
    if (window.confirm(`¿Estás seguro de que querés eliminar el proyecto "${projectName}"? Esta acción no se puede deshacer.`)) {
      await removeProject(projectId);
      await refresh();
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Proyectos</h1>
        <Link href="/proyecto/nuevo" className="btn btn-primary">Nuevo proyecto</Link>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-foreground/60">Aún no hay proyectos.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-foreground/60">{p.client || "—"}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link className="btn btn-primary" href={`/proyecto/${p.id}`}>Abrir</Link>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setActiveProjectId(p.id)}
                  title="Marcar como activo"
                >
                  Activar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => handleDelete(p.id, p.name)}
                  title="Eliminar proyecto"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
