"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject } from "@/lib/project/storage";
import { aggregateMaterials } from "@/lib/project/compute";
import type { Project as DBProject } from "@/lib/db";

export default function ProyectoExportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<DBProject | null>(null);
  const [loading, setLoading] = useState(true);

  // carga inicial (async)
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

  if (loading) return <div className="mx-auto max-w-[840px] p-6">Cargando…</div>;
  if (!project) return null;

  const mat = useMemo(() => aggregateMaterials(project), [project]);
  const date = new Date().toLocaleDateString("es-AR");

  function onPrint() {
    window.print();
  }

  return (
    <div className="mx-auto max-w-[840px] p-6 print:p-0">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #ffffff !important; }
          @page { size: A4; margin: 14mm; }
        }
        .hline { border-top: 1px solid rgba(0,0,0,.15); }
        .muted { color: rgba(0,0,0,.6); }
        .tbl th, .tbl td { padding: 6px 8px; font-size: 12px; }
        .tbl thead th { text-align: left; color: rgba(0,0,0,.6); border-bottom: 1px solid rgba(0,0,0,.15); }
        .tbl tbody tr { border-bottom: 1px solid rgba(0,0,0,.08); }
        .title { font-size: 20px; font-weight: 600; margin: 0; }
      `}</style>

      <div className="no-print flex justify-between items-center mb-4">
        <button onClick={() => router.back()} className="btn btn-secondary">← Volver</button>
        <button onClick={onPrint} className="btn btn-primary">Imprimir / Guardar PDF</button>
      </div>

      {/* Encabezado */}
      <header className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="title">Presupuesto de materiales</h1>
            <div className="muted">Proyecto: <strong>{project.name}</strong></div>
            {project.client ? <div className="muted">Cliente: {project.client}</div> : null}
            {project.siteAddress ? <div className="muted">Obra: {project.siteAddress}</div> : null}
            {"contact" in project && project.contact ? (
              <div className="muted">Contacto: {project.contact as string}</div>
            ) : null}
            <div className="muted">Fecha: {date}</div>
          </div>
          {"logoUrl" in project && project.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.logoUrl as string} alt="Logo" style={{ maxWidth: 120, maxHeight: 80 }} />
          ) : null}
        </div>
        {project.notes ? <p className="mt-3">{project.notes}</p> : null}
      </header>

      {/* Resumen de materiales */}
      <section className="mb-8">
        <h2 className="font-medium mb-2">Resumen de materiales</h2>
        {mat.length === 0 ? (
          <div className="muted">Sin materiales aún.</div>
        ) : (
          <table className="w-full tbl">
            <thead>
              <tr>
                <th>Material</th>
                <th className="text-right">Cantidad</th>
                <th>Unidad</th>
              </tr>
            </thead>
            <tbody>
              {mat.map((m, i) => (
                <tr key={`${m.key}-${i}`}>
                  <td>{m.label}</td>
                  <td className="text-right">{m.qty}</td>
                  <td>{m.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Partidas */}
      <section>
        <h2 className="font-medium mb-2">Partidas incluidas</h2>
        {project.partes.length === 0 ? (
          <div className="muted">No hay partidas cargadas.</div>
        ) : (
          <table className="w-full tbl">
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Tipo</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {project.partes.map(part => (
                <tr key={part.id}>
                  <td>{part.title}</td>
                  <td>{part.kind}</td>
                  <td>{new Date(part.createdAt).toLocaleDateString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="mt-8 muted text-xs">
        * Documento generado automáticamente para estimación de materiales. No reemplaza memorias ni cálculo estructural profesional.
      </footer>
    </div>
  );
}
