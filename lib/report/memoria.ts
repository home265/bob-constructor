import jsPDF from "jspdf";
import autoTable, { RowInput } from "jspdf-autotable";

export interface MemoryEntry {
  id: string;
  titulo: string;
  rubro: "muros" | "revoques" | "contrapiso" | "carpeta" | "viga" | "columna" | "losa" | "zapata" | "pilote" | "general";
  inputs: Record<string, string | number | boolean>;
  supuestos?: string[];
  resultados: Record<string, string | number>;
  advertencias?: { code: string; severity: "info" | "warning" | "danger"; title: string }[];
  fuente_id?: string;
}

export interface MemoryReport {
  proyecto: string;
  fechaISO: string;
  entradas: MemoryEntry[];
}

export interface PdfOptions {
  autor?: string;
  notaLegal?: string;
}

function humanDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Genera un PDF y devuelve un ArrayBuffer listo para descargar/guardar. */
export function buildMemoriaPdf(report: MemoryReport, opts?: PdfOptions): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const marginX = 40;
  let y = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`Memoria de Cálculo (simplificada)`, marginX, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Proyecto: ${report.proyecto}`, marginX, y);
  y += 16;
  doc.text(`Fecha: ${humanDate(report.fechaISO)}`, marginX, y);
  y += 24;

  if (opts?.autor) {
    doc.text(`Generado por: ${opts.autor}`, marginX, y);
    y += 20;
  }

  report.entradas.forEach((e, idx) => {
    if (y > 720) {
      doc.addPage();
      y = 50;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`${idx + 1}. ${e.titulo}`, marginX, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);

    autoTable(doc, {
      head: [["Entrada", "Valor"]],
      body: Object.entries(e.inputs).map<RowInput>(([k, v]) => [k, String(v)]),
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 10 }
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    if (e.supuestos && e.supuestos.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Supuestos:", marginX, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      e.supuestos.forEach((s) => {
        doc.text(`• ${s}`, marginX, y);
        y += 12;
      });
    }

    autoTable(doc, {
      head: [["Resultado", "Valor"]],
      body: Object.entries(e.resultados).map<RowInput>(([k, v]) => [k, String(v)]),
      startY: y,
      margin: { left: marginX, right: marginX },
      styles: { fontSize: 10 }
    });
    y = (doc as any).lastAutoTable.finalY + 8;

    if (e.advertencias && e.advertencias.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.text("Advertencias:", marginX, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      e.advertencias.forEach((w) => {
        const tag = w.severity === "danger" ? "[CRÍTICO]" : w.severity === "warning" ? "[ATENCIÓN]" : "[INFO]";
        doc.text(`• ${tag} ${w.title} (${w.code})`, marginX, y);
        y += 12;
      });
    }

    if (e.fuente_id) {
      doc.setFont("helvetica", "italic");
      doc.text(`Fuente: ${e.fuente_id}`, marginX, y);
      y += 16;
    } else {
      y += 8;
    }
  });

  if (opts?.notaLegal) {
    if (y > 680) {
      doc.addPage();
      y = 50;
    }
    doc.setDrawColor(200);
    doc.line(marginX, y, 555, y);
    y += 12;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text(opts.notaLegal, marginX, y, { maxWidth: 515 });
  }

  return doc.output("arraybuffer") as ArrayBuffer;
}
