"use client";
import Link from "next/link";
import { listProjects, setActiveProjectId } from "@/lib/project/storage";

export default function ProyectosPage() {
  const list = listProjects();

  return (
    <section className="container mx-auto px-4 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Proyectos</h1>
        <Link href="/proyecto/nuevo" className="btn">Nuevo proyecto</Link>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-foreground/60">Aún no hay proyectos.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-foreground/60">{p.client || "—"}</div>
              <div className="mt-3 flex gap-2">
                <Link className="btn" href={`/proyecto/${p.id}`}>Abrir</Link>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setActiveProjectId(p.id)}
                  title="Marcar como activo"
                >
                  Activar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
