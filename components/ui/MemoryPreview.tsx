"use client";

import { useMemo } from "react";
import { buildMemoriaPdf, MemoryReport } from "@/lib/report/memoria";

export interface MemoryPreviewProps {
  report: MemoryReport;
  autor?: string;
}

export default function MemoryPreview({ report, autor }: MemoryPreviewProps) {
  const fecha = useMemo(() => new Date(report.fechaISO).toLocaleDateString(), [report.fechaISO]);

  function onDownload() {
    const buffer = buildMemoriaPdf(report, {
      autor,
      notaLegal:
        "Resultado orientativo para apoyo en obra. No sustituye verificación profesional ni normativa vigente."
    });
    const blob = new Blob([buffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Memoria_${report.proyecto.replace(/\s+/g, "_")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <header className="border-b pb-2">
        <h1 className="text-xl font-semibold">Memoria de Cálculo (vista previa)</h1>
        <p className="text-sm text-gray-600">
          Proyecto: <span className="font-medium">{report.proyecto}</span> · Fecha: {fecha}
        </p>
      </header>

      <ol className="space-y-4">
        {report.entradas.map((e) => (
          <li key={e.id} className="rounded-2xl border p-4 shadow-sm bg-white">
            <h2 className="font-semibold">{e.titulo}</h2>
            <p className="text-xs text-gray-500 mt-1">Rubro: {e.rubro}</p>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <section className="rounded-lg border p-3">
                <h3 className="text-sm font-semibold">Entradas</h3>
                <dl className="mt-2 space-y-1">
                  {Object.entries(e.inputs).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-sm text-gray-600">{k}</dt>
                      <dd className="text-sm font-medium">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="rounded-lg border p-3">
                <h3 className="text-sm font-semibold">Resultados</h3>
                <dl className="mt-2 space-y-1">
                  {Object.entries(e.resultados).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3">
                      <dt className="text-sm text-gray-600">{k}</dt>
                      <dd className="text-sm font-medium">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>

            {e.supuestos && e.supuestos.length > 0 && (
              <section className="mt-3 rounded-lg border p-3">
                <h3 className="text-sm font-semibold">Supuestos</h3>
                <ul className="mt-2 list-disc list-inside text-sm">
                  {e.supuestos.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </section>
            )}

            {e.advertencias && e.advertencias.length > 0 && (
              <section className="mt-3 rounded-lg border p-3">
                <h3 className="text-sm font-semibold">Advertencias</h3>
                <ul className="mt-2 space-y-1">
                  {e.advertencias.map((w) => (
                    <li key={w.code} className="text-sm">
                      <span
                        className={
                          w.severity === "danger"
                            ? "text-red-600 font-semibold"
                            : w.severity === "warning"
                            ? "text-amber-600 font-semibold"
                            : "text-sky-700 font-semibold"
                        }
                      >
                        [{w.severity.toUpperCase()}]
                      </span>{" "}
                      {w.title} <span className="text-xs text-gray-500">({w.code})</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {e.fuente_id && (
              <p className="mt-2 text-xs text-gray-500">Fuente: {e.fuente_id}</p>
            )}
          </li>
        ))}
      </ol>

      <div className="pt-2">
        <button
          type="button"
          onClick={onDownload}
          className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90"
        >
          Descargar PDF
        </button>
      </div>
    </div>
  );
}
