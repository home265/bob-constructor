// app/proyecto/[id]/page.tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { getProject, removePartidaById } from "@/lib/project/storage";
import { aggregateMaterials } from "@/lib/project/compute";
import type { Project as DBProject, Partida as DBPartida } from "@/lib/db";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

// Rutas a las calculadoras para el botón de "Editar"
const KIND_ROUTES: Record<string, string> = {
  muro: "/muros",
  carpeta: "/carpeta",
  contrapiso: "/contrapiso",
  revestimiento: "/revestimientos",
  revoque: "/revoque",
  base: "/hormigon/base",
  columna: "/hormigon/columna",
  losa: "/hormigon/losa",
  losa_premoldeada: "/hormigon/losa-premoldeada",
  pilote: "/hormigon/pilote",
  viga: "/hormigon/viga",
  boceto_estructural: "/estructura",
};

export default function ProyectoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<DBProject | null>(null);
  const [loading, setLoading] = useState(true);

  // Carga inicial
  useEffect(() => {
    (async () => {
      const p = await getProject(id);
      if (!p) {
        router.replace("/proyecto");
        return;
      }
      setProject(p);
      setLoading(false);
    })();
  }, [id, router]);

  const mat = useMemo(() => (project ? aggregateMaterials(project) : []), [project]);
  const safeName = useMemo(
    () => (project ? project.name.replace(/[^\w\-]+/g, "_").toLowerCase() : "proyecto"),
    [project]
  );

  // Función para Descargar el PDF directamente
  async function handleDownloadPdf() {
    if (!project) return;

    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Resumen de Proyecto", 14, 22);
    doc.setFontSize(12);
    doc.text(project.name, 14, 32);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Cliente: ${project.client || "-"}`, 14, 38);
    doc.text(`Obra: ${project.siteAddress || "-"}`, 14, 44);

    autoTable(doc, {
      startY: 55,
      head: [['Material', 'Cantidad', 'Unidad']],
      body: mat.map(m => [m.label, m.qty.toLocaleString('es-AR'), m.unit]),
      theme: 'grid',
      headStyles: { fillColor: [46, 79, 79] },
    });

    // Esta es la línea clave: .save() descarga el archivo directamente.
    doc.save(`proyecto_${safeName}.pdf`);
  }

  // Lógica para eliminar una partida
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toDelete, setToDelete] = useState<{ partidaId: string; title: string } | null>(null);

  const makeEditHref = (kind: string, partidaId: string) => {
    const base = KIND_ROUTES[kind] ?? `/${kind}`;
    const sp = new URLSearchParams({ projectId: id, partidaId });
    return `${base}?${sp.toString()}`;
  };

  if (loading) {
    return <section className="space-y-6"><p className="text-sm text-center p-8">Cargando proyecto...</p></section>;
  }
  if (!project) return null;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <div className="text-sm text-foreground/60">
            {project.client ? `Cliente: ${project.client} · ` : ""}{project.siteAddress || ""}
          </div>
        </div>
        <div className="flex items-center space-x-2">
            <Link className="btn btn-secondary" href={`/proyecto/${project.id}/export`}>
              Vista Previa (Imprimir / PDF)
            </Link>
            <button className="btn btn-primary" onClick={handleDownloadPdf}>
              Descargar PDF
            </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Columna Izquierda: Partidas del Proyecto */}
        <div className="card p-4">
          <h2 className="font-medium mb-3">Partidas del Proyecto</h2>
          {project.partes.length === 0 ? (
            <p className="text-sm text-foreground/60">Aún no se ha guardado ningún cálculo para este proyecto.</p>
          ) : (
            <ul className="space-y-2">
              {project.partes.map(part => (
                <li key={part.id} className="border border-border rounded p-3 flex justify-between items-center gap-2">
                  <div>
                    <div className="text-sm font-medium">{part.title}</div>
                    <div className="text-xs text-foreground/70 uppercase">{part.kind.replace("_", " ")}</div>
                  </div>
                   <div className="flex items-center gap-1">
                    <button
                      className="btn btn-secondary text-xs px-3 py-1"
                      onClick={() => router.push(makeEditHref(part.kind, part.id))}
                      title="Editar"
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-ghost text-xs px-3 py-1"
                      onClick={() => { setToDelete({ partidaId: part.id, title: part.title }); setConfirmOpen(true); }}
                      title="Eliminar"
                    >
                      X
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Columna Derecha: Resumen de Materiales */}
        <div className="card p-4 overflow-x-auto">
          <h2 className="font-medium mb-3">Resumen de Materiales</h2>
          {mat.length === 0 ? (
            <p className="text-sm text-foreground/60">Sin materiales aún.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-foreground/60">
                <tr>
                  <th className="text-left py-1 font-normal">Material</th>
                  <th className="text-right py-1 font-normal">Cantidad</th>
                  <th className="text-left py-1 pl-4 font-normal">Unidad</th>
                </tr>
              </thead>
              <tbody>
                {mat.map((m, i) => (
                  <tr key={`${m.key}-${i}`} className="border-t border-border">
                    <td className="py-1.5">{m.label}</td>
                    <td className="py-1.5 text-right">{m.qty.toLocaleString('es-AR')}</td>
                    <td className="py-1.5 pl-4">{m.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <p className="text-xs text-foreground/60">Funciona offline (PWA)</p>

      {/* Dialogo de confirmación para eliminar */}
      <ConfirmDialog
        open={confirmOpen}
        title="Eliminar partida"
        message={toDelete ? `¿Seguro que querés eliminar “${toDelete.title}” del proyecto?` : ""}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        onConfirm={async () => {
          if (!toDelete || !project) return;
          await removePartidaById(project.id, toDelete.partidaId);
          setProject(prev => prev ? {
            ...prev,
            partes: prev.partes.filter(pt => pt.id !== toDelete.partidaId),
            updatedAt: Date.now(),
          } : null);
          setConfirmOpen(false);
          setToDelete(null);
        }}
        onCancel={() => { setConfirmOpen(false); setToDelete(null); }}
      />
    </section>
  );
}