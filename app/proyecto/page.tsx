"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listProjects, createProject, removeProject } from "@/lib/project/storage";

export default function ProyectosPage() {
  const [projects, setProjects] = useState<Array<{ id: string; name: string; client?: string }>>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const router = useRouter();

  async function refresh() {
    const rows = await listProjects();
    setProjects(rows.map(p => ({ id: p.id, name: p.name, client: p.client })));
  }

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      alert("Por favor, ingresa un nombre para el proyecto.");
      return;
    }
    // Creamos el proyecto pero no lo abrimos, solo refrescamos la lista
    await createProject({ name: newProjectName.trim() });
    setNewProjectName("");
    await refresh();
  };
  
  // La función de crear y abrir ahora es una acción separada
  const handleCreateAndOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      alert("Por favor, ingresa un nombre para el proyecto.");
      return;
    }
    const newProject = await createProject({ name: newProjectName.trim() });
    router.push(`/proyecto/${newProject.id}`);
  };


  const handleDelete = async (projectId: string, projectName: string) => {
    if (window.confirm(`¿Estás seguro de que querés eliminar el proyecto "${projectName}"? Esta acción no se puede deshacer.`)) {
      await removeProject(projectId);
      await refresh();
    }
  };

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Mis Proyectos</h1>
        <p className="text-sm text-foreground/70">Crea un proyecto nuevo o continúa con uno existente.</p>
      </div>

      {/* Formulario de Creación - Estilo Bob Gasista */}
      <div className="card p-4">
        <h2 className="font-medium mb-3">Crear Nuevo Proyecto</h2>
        <form onSubmit={handleCreateAndOpen} className="flex flex-wrap items-end gap-3">
          <label className="flex-grow text-sm">
            <span className="font-medium sr-only">Nombre del Nuevo Proyecto</span>
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Ej: Casa Familia Pérez"
              className="w-full px-3 py-2"
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Crear y Abrir Proyecto
          </button>
        </form>
      </div>

      {/* --- ESTE ES EL BLOQUE CORREGIDO --- */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold">Proyectos Existentes</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-foreground/70 pt-2">No hay proyectos todavía. ¡Crea el primero!</p>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => (
              <div key={p.id} className="card p-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-foreground/60">{p.client || "Sin cliente"}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link className="btn btn-primary" href={`/proyecto/${p.id}`}>
                    Editar/Ver Partidas
                  </Link>
                  <Link className="btn btn-secondary" href={`/proyecto/${p.id}/export`}>
                    Ver Resumen y Exportar
                  </Link>
                  <button
                    type="button"
                    className="btn btn-danger"
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
      </div>
    </section>
  );
}