"use client";
import { useParams, useRouter } from "next/navigation";
import { getProject, removePartida } from "@/lib/project/storage";
import { aggregateMaterials } from "@/lib/project/compute";
import type { Project } from "@/lib/project/types";

function downloadText(filename: string, text: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ProyectoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const projectMaybe = getProject(id);
  if (!projectMaybe) {
    if (typeof window !== "undefined") router.replace("/proyecto");
    return null;
  }
  // Alias NO nulo para que TS no se queje dentro de funciones/closures
  const p: Project = projectMaybe;

  const mat = aggregateMaterials(p);
  const safeName = p.name.replace(/[^\w\-]+/g, "_").toLowerCase();

  async function onShare() {
    const text =
`Proyecto: ${p.name}
Cliente: ${p.client || "-"}
Obra: ${p.siteAddress || "-"}
Partidas: ${p.partes.length}
Materiales: ${mat.length} ítems

Resumen:
${mat.slice(0, 12).map(m => `• ${m.label}: ${m.qty} ${m.unit}`).join("\n")}
${mat.length > 12 ? "…" : ""}`;

    // Web Share API si está disponible; fallback a WhatsApp
    const navAny = navigator as any;
    if (navAny.share) {
      try { await navAny.share({ title: `Presupuesto - ${p.name}`, text }); }
      catch { /* usuario canceló */ }
    } else {
      const msg = encodeURIComponent(text);
      window.open(`https://wa.me/?text=${msg}`, "_blank");
    }
  }

  function onExportCSV() {
    const header = "key,label,qty,unit";
    const rows = mat.map(m =>
      [m.key, m.label.replace(/,/g, " "), m.qty, m.unit].join(",")
    );
    const csv = [header, ...rows].join("\n");
    downloadText(`materiales_${safeName}.csv`, csv, "text/csv;charset=utf-8");
  }

  function onExportJSON() {
    downloadText(`proyecto_${safeName}.json`, JSON.stringify(p, null, 2), "application/json");
  }

  return (
    <section className="space-y-6 container mx-auto px-4 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{p.name}</h1>
          <div className="text-sm text-foreground/60">
            {p.client ? `Cliente: ${p.client} · ` : ""}{p.siteAddress || ""}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => router.push(`/proyecto/${p.id}/export`)}>Imprimir / PDF</button>
          <button className="btn-secondary" onClick={onExportCSV}>Descargar CSV</button>
          <button className="btn-secondary" onClick={onExportJSON}>Descargar JSON</button>
          <button className="btn" onClick={onShare}>Compartir</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Partidas */}
        <div className="card p-4">
          <h2 className="font-medium mb-3">Partidas</h2>
          {p.partes.length === 0 ? (
            <p className="text-sm text-foreground/60">Todavía no agregaste partidas desde las calculadoras.</p>
          ) : (
            <ul className="space-y-2">
              {p.partes.map(part => (
                <li key={part.id} className="border rounded p-2 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{part.title}</div>
                    <div className="text-xs text-foreground/60">{part.kind}</div>
                  </div>
                  <button
                    className="btn-danger"
                    onClick={() => { removePartida(p.id, part.id); location.reload(); }}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Resumen de materiales */}
        <div className="card p-4 overflow-x-auto">
          <h2 className="font-medium mb-3">Resumen de materiales</h2>
          {mat.length === 0 ? (
            <p className="text-sm text-foreground/60">Sin materiales aún.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-foreground/60">
                <tr>
                  <th className="text-left py-1">Material</th>
                  <th className="text-right py-1">Cantidad</th>
                  <th className="text-left py-1">Unidad</th>
                </tr>
              </thead>
              <tbody>
                {mat.map((m, i) => (
                  <tr key={`${m.key}-${i}`} className="border-t">
                    <td className="py-1">{m.label}</td>
                    <td className="py-1 text-right">{m.qty}</td>
                    <td className="py-1">{m.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
