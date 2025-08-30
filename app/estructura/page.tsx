"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import AddToProject from "@/components/ui/AddToProject";
import AddToProjectBatch from "@/components/ui/AddToProjectBatch";
import BatchList from "@/components/ui/BatchList";
import type { MaterialRow } from "@/lib/project/types";
import { useSearchParams } from "next/navigation";
import { getPartida, updatePartida } from "@/lib/project/storage";

type OpcionUso = { key: string; q_kN_m2: number; label: string };
type OpcionTecho = { key: string; g_kN_m2: number; label: string };

const USOS: OpcionUso[] = [
  { key: "vivienda",   q_kN_m2: 2.0, label: "Vivienda (~2.0 kN/m²)" },
  { key: "comercial",  q_kN_m2: 3.0, label: "Comercial liviano (~3.0 kN/m²)" },
  { key: "terraza",    q_kN_m2: 4.0, label: "Terraza accesible (~4.0 kN/m²)" },
];

const TECHOS: OpcionTecho[] = [
  { key: "losa10", g_kN_m2: 0.0, label: "Techo = misma losa del piso (sin extra)" },
  { key: "chapa",  g_kN_m2: 0.2, label: "Chapa s/ correas (~0.2 kN/m²) (extra en techo)" },
  { key: "teja",   g_kN_m2: 0.7, label: "Teja s/ madera (~0.7 kN/m²) (extra en techo)" },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

function EstructuraCalculator() {
  // Deep-link (C)
  const sp = useSearchParams();
  const projectId = sp.get("projectId");
  const partidaId = sp.get("partidaId");

  // Geometría
  const [Lx, setLx] = useState(10);
  const [Ly, setLy] = useState(8);
  const [nx, setNx] = useState(3);
  const [ny, setNy] = useState(2);
  const [plantas, setPlantas] = useState(1);

  // Losa / acabados
  const [espLosa_cm, setEspLosa] = useState(10);
  const [gAcabados, setGAcabados] = useState(0.5);

  // Uso / techo
  const [usoKey, setUsoKey] = useState<OpcionUso["key"]>("vivienda");
  const [techoKey, setTechoKey] = useState<OpcionTecho["key"]>("losa10");

  // Precargar desde partida (C) — async
  useEffect(() => {
    if (!projectId || !partidaId) return;
    (async () => {
      const p = await getPartida(projectId, partidaId);
      const inp = (p?.inputs ?? {}) as Record<string, unknown>;
      if (!inp) return;
      if (typeof inp.Lx === "number") setLx(inp.Lx);
      if (typeof inp.Ly === "number") setLy(inp.Ly);
      if (typeof inp.nx === "number") setNx(inp.nx);
      if (typeof inp.ny === "number") setNy(inp.ny);
      if (typeof inp.plantas === "number") setPlantas(inp.plantas);
      if (typeof inp.espLosa_cm === "number") setEspLosa(inp.espLosa_cm);
      if (typeof inp.gAcabados === "number") setGAcabados(inp.gAcabados);
      if (typeof inp.usoKey === "string") setUsoKey(inp.usoKey);
      if (typeof inp.techoKey === "string") setTechoKey(inp.techoKey);
    })();
  }, [projectId, partidaId]);

  // Derivados
  const spanX = useMemo(() => (nx > 0 ? Lx / nx : 0), [Lx, nx]);
  const spanY = useMemo(() => (ny > 0 ? Ly / ny : 0), [Ly, ny]);

  const q = useMemo(() => USOS.find(u => u.key === usoKey)?.q_kN_m2 ?? 2.0, [usoKey]);
  const gTechoExtra = useMemo(() => TECHOS.find(t => t.key === techoKey)?.g_kN_m2 ?? 0, [techoKey]);

  const gLosa = useMemo(() => 0.25 * Math.max(0, espLosa_cm), [espLosa_cm]); // kN/m²
  const gPiso = useMemo(() => gLosa + Math.max(0, gAcabados), [gLosa, gAcabados]);
  const gTotalPiso = useMemo(() => gPiso, [gPiso]);
  const gTotalTecho = useMemo(() => gPiso + gTechoExtra, [gPiso, gTechoExtra]);

  const tribAreaInterior = round2(spanX * spanY);
  const tribAreaBorde    = round2(0.5 * spanX * spanY);
  const tribAreaEsquina  = round2(0.25 * spanX * spanY);

  const tribWidthVigaX = spanY;
  const tribWidthVigaY = spanX;

  // Vigas piso
  const wX_piso = round2((gTotalPiso + q) * tribWidthVigaX);
  const wY_piso = round2((gTotalPiso + q) * tribWidthVigaY);
  const Mx_piso = round2(wX_piso * spanX * spanX / 8);
  const My_piso = round2(wY_piso * spanY * spanY / 8);
  const Vx_piso = round2(wX_piso * spanX / 2);
  const Vy_piso = round2(wY_piso * spanY / 2);

  // Vigas techo
  const wX_techo = round2((gTotalTecho + q) * tribWidthVigaX);
  const wY_techo = round2((gTotalTecho + q) * tribWidthVigaY);
  const Mx_techo = round2(wX_techo * spanX * spanX / 8);
  const My_techo = round2(wY_techo * spanY * spanY / 8);
  const Vx_techo = round2(wX_techo * spanX / 2);
  const Vy_techo = round2(wY_techo * spanY / 2);

  // Columnas
  const pisos = Math.max(0, plantas);
  const N_int = round2(pisos * tribAreaInterior * (gTotalPiso + q) + tribAreaInterior * gTechoExtra);
  const N_bor = round2(pisos * tribAreaBorde    * (gTotalPiso + q) + tribAreaBorde    * gTechoExtra);
  const N_esq = round2(pisos * tribAreaEsquina  * (gTotalPiso + q) + tribAreaEsquina  * gTechoExtra);

  const sugCol = suggestCol(N_int);

  // ---- Agregar al proyecto (items como MaterialRow, unit "u") ----
  const itemsForProject = useMemo<MaterialRow[]>(() => ([
    { key: "viga_x_w_piso", label: "Viga X — w piso (kN/m)", qty: wX_piso, unit: "u" },
    { key: "viga_x_m_piso", label: "Viga X — M piso (kN·m)", qty: Mx_piso, unit: "u" },
    { key: "viga_x_v_piso", label: "Viga X — V piso (kN)",   qty: Vx_piso, unit: "u" },
    { key: "viga_y_w_piso", label: "Viga Y — w piso (kN/m)", qty: wY_piso, unit: "u" },
    { key: "viga_y_m_piso", label: "Viga Y — M piso (kN·m)", qty: My_piso, unit: "u" },
    { key: "viga_y_v_piso", label: "Viga Y — V piso (kN)",   qty: Vy_piso, unit: "u" },
    { key: "col_int_n",     label: "Columna interior — N (kN)", qty: N_int, unit: "u" },
    { key: "col_borde_n",   label: "Columna borde — N (kN)",    qty: N_bor, unit: "u" },
    { key: "col_esq_n",     label: "Columna esquina — N (kN)",  qty: N_esq, unit: "u" },
  ]), [wX_piso, Mx_piso, Vx_piso, wY_piso, My_piso, Vy_piso, N_int, N_bor, N_esq]);

  const defaultTitle = `Boceto ${Lx}×${Ly} m · grilla ${nx}×${ny} · ${plantas} plantas`;

  const raw: Record<string, unknown> = {
    Lx, Ly, nx, ny, plantas, usoKey, techoKey,
    espLosa_cm, gAcabados,
    gLosa, gTotalPiso, gTotalTecho,
    spanX, spanY,
    wX_piso, wY_piso, Mx_piso, My_piso, Vx_piso, Vy_piso,
    wX_techo, wY_techo, Mx_techo, My_techo, Vx_techo, Vy_techo,
    N_int, N_bor, N_esq, sugCol
  };

  // ---------- (A) Lote local ----------
  type Batch = {
    kind: "boceto_estructural";
    title: string;
    materials: MaterialRow[];
    inputs: {
      Lx: number; Ly: number; nx: number; ny: number; plantas: number;
      usoKey: string; techoKey: string; espLosa_cm: number; gAcabados: number;
    };
    outputs: Record<string, unknown>;
  };
  const [batch, setBatch] = useState<Batch[]>([]);
  const [editIndex, setEditIndex] = useState<number | null>(null);

  const addCurrentToBatch = () => {
    const inputs = { Lx, Ly, nx, ny, plantas, usoKey, techoKey, espLosa_cm, gAcabados };
    const item: Batch = {
      kind: "boceto_estructural",
      title: defaultTitle,
      materials: itemsForProject,
      inputs,
      outputs: raw,
    };
    setBatch(prev => {
      if (editIndex !== null) {
        const next = [...prev];
        next[editIndex] = item;
        return next;
      }
      return [...prev, item];
    });
    setEditIndex(null);
  };

  const handleEditFromBatch = (index: number) => {
    const it = batch[index];
    if (!it) return;
    setLx(it.inputs.Lx);
    setLy(it.inputs.Ly);
    setNx(it.inputs.nx);
    setNy(it.inputs.ny);
    setPlantas(it.inputs.plantas);
    setUsoKey(it.inputs.usoKey);
    setTechoKey(it.inputs.techoKey);
    setEspLosa(it.inputs.espLosa_cm);
    setGAcabados(it.inputs.gAcabados);
    setEditIndex(index);
  };

  const handleRemoveFromBatch = (index: number) => {
    setBatch(prev => prev.filter((_, i) => i !== index));
    if (editIndex === index) setEditIndex(null);
  };

  // ---------- (C) Actualizar partida ----------
  const handleUpdatePartida = async () => {
    if (!projectId || !partidaId) return;
    await updatePartida(projectId, partidaId, {
      title: defaultTitle,
      inputs: { Lx, Ly, nx, ny, plantas, usoKey, techoKey, espLosa_cm, gAcabados },
      outputs: raw,
      materials: itemsForProject,
    });
    alert("Partida actualizada.");
  };

  return (
    <section className="container mx-auto px-4 max-w-5xl space-y-6">
      <div className="card p-4 space-y-3">
        <h1 className="text-2xl font-semibold">Boceto estructural (orientativo)</h1>
        <p className="text-sm text-foreground/70">
          Estima cargas en vigas y columnas para pre-dimensionado y presupuesto. <strong>Debe validarlo un profesional.</strong>
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* ENTRADAS */}
        <div className="card p-4 space-y-4">
          <h2 className="font-medium">Entradas</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Lx (m)<input type="number" value={Lx} onChange={(e)=>setLx(+e.target.value||0)} className="w-full px-3 py-2"/></label>
            <label className="text-sm">Ly (m)<input type="number" value={Ly} onChange={(e)=>setLy(+e.target.value||0)} className="w-full px-3 py-2"/></label>
            <label className="text-sm">N° vanos X<input type="number" value={nx} min={1} onChange={(e)=>setNx(Math.max(1,+e.target.value||1))} className="w-full px-3 py-2"/></label>
            <label className="text-sm">N° vanos Y<input type="number" value={ny} min={1} onChange={(e)=>setNy(Math.max(1,+e.target.value||1))} className="w-full px-3 py-2"/></label>
            <label className="text-sm">Plantas<input type="number" value={plantas} min={0} onChange={(e)=>setPlantas(Math.max(0,+e.target.value||0))} className="w-full px-3 py-2"/></label>
            <label className="text-sm">Uso
              <select value={usoKey} onChange={(e)=>setUsoKey(e.target.value)} className="w-full px-3 py-2">
                {USOS.map((u,i)=><option key={`${u.key}-${i}`} value={u.key}>{u.label}</option>)}
              </select>
            </label>
            <label className="text-sm">Losa (espesor cm)<input type="number" value={espLosa_cm} min={5} onChange={(e)=>setEspLosa(+e.target.value||0)} className="w-full px-3 py-2"/></label>
            <label className="text-sm">Acabados (kN/m²)<input type="number" value={gAcabados} min={0} step={0.1} onChange={(e)=>setGAcabados(+e.target.value||0)} className="w-full px-3 py-2"/></label>
            <label className="text-sm col-span-2">Techo (carga extra)
              <select value={techoKey} onChange={(e)=>setTechoKey(e.target.value)} className="w-full px-3 py-2">
                {TECHOS.map((t,i)=><option key={`${t.key}-${i}`} value={t.key}>{t.label}</option>)}
              </select>
            </label>
          </div>

          <div className="text-xs text-foreground/60">
            <div>• Peso propio losa ≈ <strong>{round2(gLosa)}</strong> kN/m²</div>
            <div>• Piso típico g = <strong>{round2(gTotalPiso)}</strong> kN/m² · q = <strong>{q}</strong> kN/m²</div>
            <div>• Techo extra g = <strong>{gTechoExtra}</strong> kN/m²</div>
          </div>
        </div>

        {/* RESULTADOS */}
        <div className="card p-4 space-y-4 overflow-x-auto">
          <h2 className="font-medium">Resultados (por vano típico)</h2>

          <table className="w-full text-sm">
            <thead className="text-foreground/60">
              <tr>
                <th className="text-left py-1">Grilla</th>
                <th className="text-right py-1">Luz X (m)</th>
                <th className="text-right py-1">Luz Y (m)</th>
                <th className="text-right py-1">Área trib. int (m²)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="py-1">{nx} × {ny}</td>
                <td className="py-1 text-right">{round2(spanX)}</td>
                <td className="py-1 text-right">{round2(spanY)}</td>
                <td className="py-1 text-right">{tribAreaInterior}</td>
              </tr>
            </tbody>
          </table>

          <h3 className="font-medium mt-2">Vigas — cargas y esfuerzos</h3>
          <table className="w-full text-sm">
            <thead className="text-foreground/60">
              <tr>
                <th className="text-left py-1">Dirección</th>
                <th className="text-right py-1">w piso (kN/m)</th>
                <th className="text-right py-1">M piso (kN·m)</th>
                <th className="text-right py-1">V piso (kN)</th>
                <th className="text-right py-1">w techo (kN/m)</th>
                <th className="text-right py-1">M techo (kN·m)</th>
                <th className="text-right py-1">V techo (kN)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="py-1">X (L={round2(spanX)} m)</td>
                <td className="py-1 text-right">{wX_piso}</td>
                <td className="py-1 text-right">{Mx_piso}</td>
                <td className="py-1 text-right">{Vx_piso}</td>
                <td className="py-1 text-right">{wX_techo}</td>
                <td className="py-1 text-right">{Mx_techo}</td>
                <td className="py-1 text-right">{Vx_techo}</td>
              </tr>
              <tr>
                <td className="py-1">Y (L={round2(spanY)} m)</td>
                <td className="py-1 text-right">{wY_piso}</td>
                <td className="py-1 text-right">{My_piso}</td>
                <td className="py-1 text-right">{Vy_piso}</td>
                <td className="py-1 text-right">{wY_techo}</td>
                <td className="py-1 text-right">{My_techo}</td>
                <td className="py-1 text-right">{Vy_techo}</td>
              </tr>
            </tbody>
          </table>

          <h3 className="font-medium mt-2">Columnas — carga axial (kN)</h3>
          <table className="w-full text-sm">
            <thead className="text-foreground/60">
              <tr>
                <th className="text-left py-1">Posición</th>
                <th className="text-right py-1">Carga (kN)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="py-1">Interior</td>
                <td className="py-1 text-right">{N_int}</td>
              </tr>
              <tr>
                <td className="py-1">Borde/Medianera</td>
                <td className="py-1 text-right">{N_bor}</td>
              </tr>
              <tr>
                <td className="py-1">Esquina</td>
                <td className="py-1 text-right">{N_esq}</td>
              </tr>
            </tbody>
          </table>

          <div className="p-3 rounded bg-[color:var(--color-neutral)] text-[color:var(--color-primary)]">
            <div className="font-medium">Sugerencia orientativa (columna interior):</div>
            <div className="text-sm">{sugCol.note} — {sugCol.rec}</div>
            <div className="text-xs mt-1 opacity-70">
              Solo guía para presupuesto. No sustituye cálculo profesional.
            </div>
          </div>
        </div>
      </div>

      {/* Guardar como partida */}
      <AddToProject
        kind="boceto_estructural"
        defaultTitle={defaultTitle}
        items={itemsForProject}
        raw={raw}
      />

      {/* Botón (A) para armar lote local rápido */}
      <div>
        <button
          type="button"
          className="rounded border px-4 py-2"
          onClick={addCurrentToBatch}
          title={editIndex !== null ? "Guardar ítem del lote" : "Añadir boceto al lote"}
        >
          {editIndex !== null ? "Guardar ítem del lote" : "Añadir boceto al lote"}
        </button>
        {editIndex !== null && (
          <button
            type="button"
            className="rounded border px-3 py-2 ml-2"
            onClick={() => setEditIndex(null)}
          >
            Cancelar edición
          </button>
        )}
      </div>

      {/* Lote local (A) */}
      {batch.length > 0 && (
        <div className="card p-4 space-y-3">
          <h2 className="font-medium">Lote local (Boceto estructural)</h2>
          <BatchList
            items={batch.map((b) => ({ title: b.title }))}
            onEdit={handleEditFromBatch}
            onRemove={handleRemoveFromBatch}
          />
          <AddToProjectBatch
            items={batch.map((b) => ({
              kind: b.kind,
              title: b.title,
              materials: b.materials,
              inputs: b.inputs,
              outputs: b.outputs,
            }))}
            onSaved={() => setBatch([])}
          />
        </div>
      )}

      {/* Deep-link: actualizar partida (C) */}
      {projectId && partidaId ? (
        <div>
          <button
            type="button"
            className="rounded border px-3 py-2"
            onClick={handleUpdatePartida}
          >
            Actualizar partida
          </button>
        </div>
      ) : null}
    </section>
  );
}

function suggestCol(NkN: number) {
  if (NkN <= 300) return { rec: "≈ Columna 20×20 cm", note: `N ≈ ${NkN} kN` };
  if (NkN <= 500) return { rec: "≈ Columna 20×30 cm", note: `N ≈ ${NkN} kN` };
  if (NkN <= 800) return { rec: "≈ Columna 25×30 cm", note: `N ≈ ${NkN} kN` };
  if (NkN <= 1200) return { rec: "≈ Columna 30×30 cm", note: `N ≈ ${NkN} kN` };
  return { rec: "Consulta con ingenier@", note: `N ≈ ${NkN} kN (alta)` };
}

// Este es el componente de página que se exporta por defecto.
// Envuelve el calculador en <Suspense> para evitar el error de build.
export default function EstructuraPage() {
  return (
    <Suspense fallback={<div>Cargando boceto...</div>}>
      <EstructuraCalculator />
    </Suspense>
  );
}
