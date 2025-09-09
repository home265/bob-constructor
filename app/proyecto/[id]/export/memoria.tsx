"use client";

import MemoryPreview from "@/components/ui/MemoryPreview";
import { MemoryReport } from "@/lib/report/memoria";
import { useEffect, useState } from "react";

/**
 * Esta vista intenta cargar un reporte guardado en localStorage con la clave:
 *   memoria:current
 * Si no existe, muestra un ejemplo vacío para que la página no falle.
 */
export default function MemoriaExportPage() {
  const [report, setReport] = useState<MemoryReport | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("memoria:current");
      if (raw) {
        const parsed = JSON.parse(raw) as MemoryReport;
        setReport(parsed);
      } else {
        setReport({
          proyecto: "Proyecto sin nombre",
          fechaISO: new Date().toISOString(),
          entradas: []
        });
      }
    } catch {
      setReport({
        proyecto: "Proyecto sin nombre",
        fechaISO: new Date().toISOString(),
        entradas: []
      });
    }
  }, []);

  if (!report) {
    return <div className="p-6">Cargando…</div>;
    }

  return (
    <main className="p-6">
      <MemoryPreview report={report} autor="Calculadora de Construcción" />
    </main>
  );
}
