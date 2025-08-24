"use client";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProject } from "@/lib/project/storage";
import { aggregateMaterials } from "@/lib/project/compute";

export default function ProyectoExportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const p = getProject(id);

  useEffect(() => {
    if (!p) router.replace("/proyecto");
  }, [p, router]);

  if (!p) return null;

  const mat = aggregateMaterials(p);
  const date = new Date().toLocaleDateString();

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
        <button onClick={() => router.back()} className="btn-secondary">← Volver</button>
        <button onClick={onPrint} className="btn">Imprimir / Guardar PDF</button>
      </div>

      {/* Encabezado */}
      <header className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="title">Presupuesto de materiales</h1>
            <div className="muted">Proyecto: <strong>{p.name}</strong></div>
            {p.client ? <div className="muted">Cliente: {p.client}</div> : null}
            {p.siteAddress ? <div className="muted">Obra: {p.siteAddress}</div> : null}
            {p.contact ? <div className="muted">Contacto: {p.contact}</div> : null}
            <div className="muted">Fecha: {date}</div>
          </div>
          {p.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.logoUrl} alt="Logo" style={{maxWidth: 120, maxHeight: 80}} />
          ) : null}
        </div>
        {p.notes ? <p className="mt-3">{p.notes}</p> : null}
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
        {p.partes.length === 0 ? (
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
              {p.partes.map(part => (
                <tr key={part.id}>
                  <td>{part.title}</td>
                  <td>{part.kind}</td>
                  <td>{new Date(part.createdAt).toLocaleDateString()}</td>
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
