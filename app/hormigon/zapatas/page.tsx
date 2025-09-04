// app/hormigon/zapatas/page.tsx
"use client";
import { useMemo, useState, useEffect, Suspense } from "react";
import { useJson } from "@/lib/data/useJson";
import * as C from "@/lib/calc/zapata";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import AddToProject from "@/components/ui/AddToProject";
import type { MaterialRow } from "@/lib/project/types";
import { useSearchParams } from "next/navigation";
import { getPartida, updatePartida } from "@/lib/project/storage";
import HelpPopover from "@/components/ui/HelpPopover";
import NumberWithUnit from "@/components/inputs/NumberWithUnit";
import { keyToLabel, keyToUnit } from "@/components/ui/result-mappers";
import { toUnit } from "@/lib/project/helpers";

// (El resto de los tipos como ConcreteRow, RebarRow, etc. son iguales a tus otras calculadoras)

function ZapataCalculator() {
  const sp = useSearchParams();
  const projectId = sp.get("projectId");
  const partidaId = sp.get("partidaId");

  const concrete = useJson<any>("/data/concrete_classes.json", {});
  const rebars = useJson<any>("/data/rebar_diams.json", {});
  const excavationFactors = useJson<any[]>("/data/excavation_factors.json", []);

  const concreteOpts = useMemo(() => Object.values(concrete).map((r: any) => ({ key: r.id, label: r.label ?? r.id })), [concrete]);
  // BLOQUE CORREGIDO
  const rebarOpts = useMemo(() => {
    const rows = Object.values(rebars as Record<string, any>);
    rows.sort((a, b) => (a?.phi_mm ?? 0) - (b?.phi_mm ?? 0));
    return rows.map((r: any) => ({
      key: String(r?.phi_mm ?? r?.id),
      label: r?.label ?? `Φ${r?.phi_mm}`,
      phi_mm: r?.phi_mm ?? 0,
      kg_m: r?.kg_m ?? 0 // <-- LA PROPIEDAD QUE FALTABA
    }));
  }, [rebars]);

  // Estado
  const [largo, setLargo] = useState(10);
  const [profZanja, setProfZanja] = useState(0.8);
  const [anchoZanja, setAnchoZanja] = useState(40);
  const [altoZapata, setAltoZapata] = useState(30);
  const [anchoZapata, setAnchoZapata] = useState(40);
  const [concreteId, setConcreteId] = useState("H21");
  const [waste, setWaste] = useState(10);
  const [phiLong, setPhiLong] = useState(10);
  const [nLong, setNLong] = useState(4);
  const [phiEstribo, setPhiEstribo] = useState(6);
  const [sepEstribo, setSepEstribo] = useState(20);
  const [incluirLimpieza, setIncluirLimpieza] = useState(true);
  const [espesorLimpieza, setEspesorLimpieza] = useState(8);
  const [soilFactor, setSoilFactor] = useState(excavationFactors[0]?.factor ?? 1.25);

  const rebarMap = useMemo(() => {
    const m: Record<string, any> = {};
    rebarOpts.forEach(r => { m[r.key] = { kg_m: r.kg_m, label: r.label } });
    return m;
  }, [rebarOpts]);

  const res = C.calcZapata({
    largo_m: largo,
    profundidad_zanja_m: profZanja,
    ancho_zanja_cm: anchoZanja,
    alto_zapata_cm: altoZapata,
    ancho_zapata_cm: anchoZapata,
    concreteClassId: concreteId,
    wastePct: waste,
    rebarTable: rebarMap,
    longitudinal: { phi_mm: phiLong, n: nLong },
    estribos: { phi_mm: phiEstribo, spacing_cm: sepEstribo },
    incluirHormigonLimpieza: incluirLimpieza,
    espesorHormigonLimpieza_cm: espesorLimpieza,
    tipo_suelo_factor_esponjamiento: soilFactor,
  });

  const { rows, itemsForProject, defaultTitle } = useMemo(() => {
    const r: ResultRow[] = [];
    const items: MaterialRow[] = [];

    r.push({ label: "Volumen de Excavación", qty: res.volumen_excavacion_m3, unit: "m³", hint: "Volumen de suelo en estado natural" });
    r.push({ label: "Volumen Esponjado (a transportar)", qty: res.volumen_excavacion_esponjado_m3, unit: "m³", hint: "Volumen de suelo suelto" });
    items.push({key: 'excavacion_m3', label: 'Volumen de Excavación', qty: res.volumen_excavacion_m3, unit: 'm3'});

    if (res.volumen_hormigon_limpieza_m3 > 0) {
      r.push({ label: "Hormigón de Limpieza (H-13)", qty: res.volumen_hormigon_limpieza_m3, unit: "m³", hint: "Hormigón pobre" });
      items.push({key: 'hormigon_limpieza_m3', label: 'Hormigón de Limpieza', qty: res.volumen_hormigon_limpieza_m3, unit: 'm3'});
    }

    r.push({ label: `Hormigón Zapata (${concreteId})`, qty: res.volumen_hormigon_zapata_m3, unit: "m³" });
    items.push({key: 'hormigon_zapata_m3', label: `Hormigón Zapata (${concreteId})`, qty: res.volumen_hormigon_zapata_m3, unit: 'm3'});

    r.push({ label: "Acero Total", qty: res.acero_total_kg, unit: "kg" });
    items.push({key: 'acero_zapata_kg', label: 'Acero para Zapatas', qty: res.acero_total_kg, unit: 'kg'});

    const title = `Zapata Corrida ${largo}m`;

    return { rows: r, itemsForProject: items, defaultTitle: title };
  }, [res, concreteId, largo]);


  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Fundaciones — Zanjas y Zapatas Corridas</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4 space-y-4">
          {/* Dimensiones Geométricas */}
          <h3 className="font-medium border-b pb-2">Dimensiones Generales</h3>
          <div className="grid grid-cols-2 gap-3">
              <NumberWithUnit label={<span className="flex items-center">Largo Total<HelpPopover>Longitud total de la zanja a excavar.</HelpPopover></span>} name="largo" unit="m" value={largo} onChange={setLargo} />
              <NumberWithUnit label={<span className="flex items-center">Profundidad Zanja<HelpPopover>Profundidad de la excavación desde el nivel de terreno natural.</HelpPopover></span>} name="prof_zanja" unit="m" value={profZanja} onChange={setProfZanja} />
              <NumberWithUnit label={<span className="flex items-center">Ancho Zanja<HelpPopover>Ancho de la excavación. Define el tamaño del hormigón de limpieza.</HelpPopover></span>} name="ancho_zanja" unit="cm" value={anchoZanja} onChange={setAnchoZanja} />
              <label className="text-sm col-span-2"><span className="flex items-center">Tipo de Suelo<HelpPopover>Afecta el "esponjamiento", es decir, cuánto aumenta el volumen del suelo al excavarlo para calcular el transporte.</HelpPopover></span><select value={soilFactor} onChange={e => setSoilFactor(Number(e.target.value))} className="w-full px-3 py-2">{excavationFactors.map(f => <option key={f.id} value={f.factor}>{f.label}</option>)}</select></label>
          </div>
          {/* Hormigón */}
          <h3 className="font-medium border-b pb-2">Hormigón</h3>
           <div className="grid grid-cols-2 gap-3">
             <NumberWithUnit label={<span className="flex items-center">Ancho Zapata<HelpPopover>Ancho de la viga de fundación de hormigón armado.</HelpPopover></span>} name="ancho_zapata" unit="cm" value={anchoZapata} onChange={setAnchoZapata} />
             <NumberWithUnit label={<span className="flex items-center">Alto Zapata<HelpPopover>Altura de la viga de fundación de hormigón armado.</HelpPopover></span>} name="alto_zapata" unit="cm" value={altoZapata} onChange={setAltoZapata} />
             <label className="text-sm"><span className="flex items-center">Hormigón Zapata<HelpPopover>Resistencia del hormigón para la zapata. H-21 es un valor usual.</HelpPopover></span><select value={concreteId} onChange={e => setConcreteId(e.target.value)} className="w-full px-3 py-2">{concreteOpts.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
             <NumberWithUnit label={<span className="flex items-center">Desperdicio<HelpPopover>Porcentaje de hormigón extra para compensar pérdidas (usualmente 10% en fundaciones).</HelpPopover></span>} name="waste" unit="%" value={waste} onChange={setWaste} />
             <label className="text-sm col-span-2 inline-flex items-center gap-2"><input type="checkbox" checked={incluirLimpieza} onChange={e => setIncluirLimpieza(e.target.checked)} /><span className="flex items-center">Incluir Hormigón de Limpieza<HelpPopover>Capa de hormigón pobre que se coloca en el fondo de la zanja para nivelar y limpiar la superficie antes de armar.</HelpPopover></span></label>
             {incluirLimpieza && <NumberWithUnit label="Espesor H. Limpieza" name="esp_limpieza" unit="cm" value={espesorLimpieza} onChange={setEspesorLimpieza} />}
           </div>
          {/* Acero */}
          <h3 className="font-medium border-b pb-2">Acero</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm"><span className="flex items-center">Φ Longitudinal<HelpPopover>Diámetro de las barras principales que recorren la zapata a lo largo.</HelpPopover></span><select value={phiLong} onChange={e => setPhiLong(Number(e.target.value))} className="w-full px-3 py-2">{rebarOpts.map(r => <option key={`long-${r.key}`} value={r.phi_mm}>{r.label}</option>)}</select></label>
              <NumberWithUnit label="Cantidad Barras Long." name="n_long" value={nLong} onChange={v => setNLong(Math.round(v))} step={1} />
              <label className="text-sm"><span className="flex items-center">Φ Estribos<HelpPopover>Diámetro de las barras que conforman los "anillos" o estribos.</HelpPopover></span><select value={phiEstribo} onChange={e => setPhiEstribo(Number(e.target.value))} className="w-full px-3 py-2">{rebarOpts.map(r => <option key={`est-${r.key}`} value={r.phi_mm}>{r.label}</option>)}</select></label>
              <NumberWithUnit label="Separación Estribos" name="sep_estribo" unit="cm" value={sepEstribo} onChange={setSepEstribo} />
            </div>
        </div>

        <div className="card p-4 card--table">
          <ResultTable title="Resultado" items={rows} />
        </div>
      </div>
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold">Guardar en proyecto</h3>
        <AddToProject kind="zapata" defaultTitle={defaultTitle} items={itemsForProject} raw={res} />
      </div>
    </section>
  );
}

export default function ZapatasPage() {
  return (<Suspense fallback={<div>Cargando...</div>}><ZapataCalculator /></Suspense>);
}