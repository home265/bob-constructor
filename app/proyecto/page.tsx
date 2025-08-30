"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listProjects, createProject, removeProject } from "@/lib/project/storage";
// --- 1. IMPORTAMOS EL MODAL ---
import HelpModal from "@/components/ui/HelpModal"; 

export default function ProyectosPage() {
  const [projects, setProjects] = useState<Array<{ id: string; name: string; client?: string }>>([]);
  const [newProjectName, setNewProjectName] = useState("");
  const router = useRouter();

  // --- 2. AÑADIMOS ESTADOS PARA CONTROLAR EL MODAL ---
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [newlyCreatedProjectId, setNewlyCreatedProjectId] = useState<string | null>(null);

  async function refresh() {
    const rows = await listProjects();
    setProjects(rows.map(p => ({ id: p.id, name: p.name, client: p.client })));
  }

  useEffect(() => {
    refresh();
  }, []);
  
  // --- 3. MODIFICAMOS LA FUNCIÓN DE CREAR Y ABRIR ---
  const handleCreateAndOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) {
      alert("Por favor, ingresa un nombre para el proyecto.");
      return;
    }
    const newProject = await createProject({ name: newProjectName.trim() });
    
    // Guardamos el ID del proyecto nuevo
    setNewlyCreatedProjectId(newProject.id);
    
    // Y abrimos el modal de ayuda en lugar de redirigir directamente
    setIsHelpModalOpen(true); 
  };

  const handleDelete = async (projectId: string, projectName: string) => {
    if (window.confirm(`¿Estás seguro de que querés eliminar el proyecto "${projectName}"? Esta acción no se puede deshacer.`)) {
      await removeProject(projectId);
      await refresh();
    }
  };
  
  // Esta función se ejecuta cuando se cierra el modal
  const handleCloseModal = () => {
      setIsHelpModalOpen(false);
      // Si tenemos un ID guardado, redirigimos al nuevo proyecto
      if (newlyCreatedProjectId) {
          router.push(`/proyecto/${newlyCreatedProjectId}`);
      }
  };

  return (
    // Usamos un Fragment <> para envolver la sección y el modal
    <>
      <section className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Mis Proyectos</h1>
          <p className="text-sm text-foreground/70">Crea un proyecto nuevo o continúa con uno existente.</p>
        </div>

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

      {/* --- 4. AÑADIMOS EL MODAL AL FINAL DEL ARCHIVO --- */}
      <HelpModal 
        isOpen={isHelpModalOpen} 
        onClose={handleCloseModal}
        title="¡Tu proyecto ha sido creado!"
      >
        <p>Ahora puedes seguir estos pasos:</p>
        <ol className="list-decimal pl-5 space-y-2 mt-2">
            <li>
                <strong>Elige una Calculadora:</strong> Usa el menú de navegación de arriba (Muros, Contrapiso, Hormigón, etc.) para abrir la herramienta que necesites.
            </li>
            <li>
                <strong>Realiza tu Cálculo:</strong> Ingresa los datos en la calculadora y obtén tus resultados.
            </li>
            <li>
                <strong>Guarda en este Proyecto:</strong> Al final de cada calculadora, verás una sección para "Guardar en Proyecto". Tus cálculos guardados (llamados "partidas") aparecerán en la página de detalle de tu proyecto.
            </li>
        </ol>
      </HelpModal>
    </>
  );
}