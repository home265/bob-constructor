// app/proyecto/[id]/export/page.tsx
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
  const date = new Date().toLocaleDateString("es-AR", {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  function onPrint() {
    window.print();
  }

  if (loading) {
    return <div className="p-6 text-center">Cargando vista previa...</div>;
  }
  if (!project) return null;

  return (
    // Estilos para modo claro (light mode) para una mejor impresión
    <div className="mx-auto max-w-4xl p-8 print:p-0 bg-white text-gray-800 font-sans">
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { 
            background: #ffffff !important; 
            color: #111827 !important; 
          }
          @page { 
            size: A4; 
            margin: 1.5cm; 
          }
        }
        .header-title { font-size: 24px; font-weight: 700; color: #1a202c; }
        .project-details { color: #4a5568; }
        .section-title { 
          font-size: 18px; 
          font-weight: 600; 
          margin-top: 2rem; 
          margin-bottom: 0.5rem; 
          border-bottom: 2px solid #e2e8f0; 
          padding-bottom: 0.25rem; 
          color: #2d3748;
        }
        .materials-table { 
          width: 100%; 
          border-collapse: collapse; 
          font-size: 12px; 
        }
        .materials-table th, .materials-table td { 
          padding: 8px 4px; 
          text-align: left;
        }
        .materials-table thead th { 
          color: #718096; 
          border-bottom: 1px solid #cbd5e0; 
          font-weight: 600;
        }
        .materials-table tbody tr:nth-child(even) { 
          background-color: #f7fafc; 
        }
        .materials-table .text-right {
          text-align: right;
        }
        .footer-note { 
          margin-top: 3rem; 
          padding-top: 1rem;
          border-top: 1px solid #e2e8f0;
          font-size: 10px; 
          color: #a0aec0; 
          text-align: center; 
        }
      `}</style>

      <div className="no-print mb-6 flex justify-between items-center bg-gray-100 p-4 rounded-lg shadow-sm">
        <button 
          onClick={() => router.back()} 
          className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded transition-colors"
        >
          ← Volver al Proyecto
        </button>
        <button 
          onClick={onPrint} 
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          Imprimir
        </button>
      </div>

      {/* Encabezado del Documento */}
      <header className="mb-8">
        <h1 className="header-title">{project.name}</h1>
        <div className="project-details mt-2 space-y-1">
          {project.client && <div><strong>Cliente:</strong> {project.client}</div>}
          {project.siteAddress && <div><strong>Obra:</strong> {project.siteAddress}</div>}
          <div><strong>Fecha de Emisión:</strong> {date}</div>
        </div>
      </header>

      {/* Resumen de Materiales */}
      <section>
        <h2 className="section-title">Resumen de Materiales</h2>
        {mat.length === 0 ? (
          <div className="project-details">No hay materiales computados en este proyecto.</div>
        ) : (
          <table className="materials-table">
            <thead>
              <tr>
                <th>Material</th>
                <th className="text-right">Cantidad</th>
                <th style={{ paddingLeft: '1rem' }}>Unidad</th>
              </tr>
            </thead>
            <tbody>
              {mat.map((m, i) => (
                <tr key={`${m.key}-${i}`}>
                  <td>{m.label}</td>
                  <td className="text-right">{m.qty.toLocaleString('es-AR')}</td>
                  <td style={{ paddingLeft: '1rem' }}>{m.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Pie de Página */}
      <footer className="footer-note">
        <p>Este documento fue generado por Bob Constructor. Los cálculos son una estimación y deben ser verificados por un profesional.</p>
      </footer>
    </div>
  );
}