// app/hormigon/escalera/page.tsx
"use client";
import { useMemo, useState, useEffect, Suspense } from "react";
import { useJson } from "@/lib/data/useJson";
import * as C from "@/lib/calc/escalera";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import AddToProject from "@/components/ui/AddToProject";
import type { MaterialRow } from "@/lib/project/types";
import { useSearchParams } from "next/navigation";
import { getPartida, updatePartida } from "@/lib/project/storage";
import HelpPopover from "@/components/ui/HelpPopover";

import { toUnit } from "@/lib/project/helpers";
import { keyToLabel, keyToUnit } from "@/components/ui/result-mappers";
import NumberWithUnit from "@/components/inputs/NumberWithUnit";

// (Aquí irían los tipos de ConcreteRow y RebarRow, si los necesitas)

function EscaleraCalculator() {
  const [tipo, setTipo] = useState<"recta" | "L" | "U">("recta");
  const [altura, setAltura] = useState(2.8);
  const [ancho, setAncho] = useState(0.9);
  const [largoT1, setLargoT1] = useState(3.5);
  const [largoT2, setLargoT2] = useState(2.0);
  const [anchoDescanso, setAnchoDescanso] = useState(1.0);
  const [espesorLosa, setEspesorLosa] = useState(12);
  const [concreteId, setConcreteId] = useState("H21");
  const [waste, setWaste] = useState(10);
  const [phiP, setPhiP] = useState(10);
  const [sepP, setSepP] = useState(15);
  const [phiR, setPhiR] = useState(8);
  const [sepR, setSepR] = useState(20);

  const concrete = useJson<any>("/data/concrete_classes.json", {});
  const rebars = useJson<any>("/data/rebar_diams.json", {});
  const concreteOpts = useMemo(() => Object.values(concrete).map((r: any) => ({ key: r.id, label: r.label ?? r.id })), [concrete]);
  const rebarOpts = useMemo(() => Object.values(rebars).sort((a: any, b: any) => a.phi_mm - b.phi_mm).map((r: any) => ({ key: String(r.phi_mm), label: r.label ?? `Φ${r.phi_mm}`, phi_mm: r.phi_mm, kg_m: r.kg_m })), [rebars]);
  const rebarMap = useMemo(() => { const m: Record<string, any> = {}; rebarOpts.forEach(r => { m[r.key] = { kg_m: r.kg_m } }); return m; }, [rebarOpts]);

  const tramos: C.TramoInput[] = useMemo(() => {
    if (tipo === 'recta') return [{ largoHorizontal_m: largoT1, ancho_m: ancho }];
    if (tipo === 'L') return [{ largoHorizontal_m: largoT1, ancho_m: ancho }]; // El descanso se calcula aparte
    if (tipo === 'U') return [{ largoHorizontal_m: largoT1, ancho_m: ancho }, { largoHorizontal_m: largoT2, ancho_m: ancho }];
    return [];
  }, [tipo, largoT1, largoT2, ancho]);

  const res = C.calcEscalera({
    tipo,
    alturaTotal_m: altura,
    tramos,
    espesorLosa_cm: espesorLosa,
    incluirDescanso: tipo !== 'recta',
    anchoDescanso_m: anchoDescanso,
    concreteClassId: concreteId,
    wastePct: waste,
    rebarTable: rebarMap,
    aceroPrincipal: { phi_mm: phiP, separacion_cm: sepP },
    aceroReparticion: { phi_mm: phiR, separacion_cm: sepR },
  });

  const { rows, itemsForProject, defaultTitle } = useMemo(() => {
    const r: ResultRow[] = [];
    const items: MaterialRow[] = [];

    r.push({ label: "Diseño (Ley de Blondel)", qty: `${res.leyBlondel_cm} cm`, hint: (res.leyBlondel_cm >= 62 && res.leyBlondel_cm <= 65) ? "Óptimo" : "Revisar diseño" });
    r.push({ label: "Cantidad de Escalones", qty: res.cantidadEscalones, unit: "un." });
    r.push({ label: "Alzada (contrahuella)", qty: res.alzada_cm, unit: "cm" });
    r.push({ label: "Pedada (huella)", qty: res.pedada_cm, unit: "cm" });
    r.push({ label: "Ángulo de Inclinación", qty: res.anguloInclinacion_grados, unit: "°" });
    
    r.push({ label: "Hormigón Total", qty: res.volumenHormigonTotal_m3, unit: "m³" });
    items.push({key: 'hormigon_escalera_m3', label: `Hormigón para Escalera (${concreteId})`, qty: res.volumenHormigonTotal_m3, unit: 'm3'});
    
    r.push({ label: "Acero Total", qty: res.aceroTotal_kg, unit: "kg" });
    items.push({key: 'acero_escalera_kg', label: 'Acero para Escalera', qty: res.aceroTotal_kg, unit: 'kg'});

    r.push({ label: "Superficie de Encofrado", qty: res.superficieEncofrado_m2, unit: "m²" });
    items.push({key: 'encofrado_escalera_m2', label: 'Encofrado para Escalera', qty: res.superficieEncofrado_m2, unit: 'm2'});

    const title = `Escalera de ${res.cantidadEscalones} escalones (${tipo})`;

    return { rows: r, itemsForProject: items, defaultTitle: title };
  }, [res, concreteId, tipo]);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Hormigón — Escaleras</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4 space-y-4">
          {/* Geometría y Tipo */}
          <h3 className="font-medium border-b pb-2">Geometría de la Escalera</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2"><span className="flex items-center">Forma de la Escalera<HelpPopover>Elige la forma. "L" tiene un tramo y un descanso. "U" tiene dos tramos y un descanso.</HelpPopover></span><select value={tipo} onChange={e => setTipo(e.target.value as any)} className="w-full px-3 py-2"><option value="recta">Recta (un tramo)</option><option value="L">En L (un tramo + descanso)</option><option value="U">En U (dos tramos + descanso)</option></select></label>
            <NumberWithUnit label={<span className="flex items-center">Altura a Salvar<HelpPopover>Altura total de piso terminado a piso terminado que debe cubrir la escalera.</HelpPopover></span>} name="altura" unit="m" value={altura} onChange={setAltura} />
            <NumberWithUnit label={<span className="flex items-center">Ancho de Tramos<HelpPopover>Ancho libre de los escalones.</HelpPopover></span>} name="ancho" unit="m" value={ancho} onChange={setAncho} />
            <NumberWithUnit label={<span className="flex items-center">Largo Horizontal (Tramo 1)<HelpPopover>Longitud horizontal que ocupa el primer tramo de la escalera.</HelpPopover></span>} name="largoT1" unit="m" value={largoT1} onChange={setLargoT1} />
            {tipo === 'U' && <NumberWithUnit label={<span className="flex items-center">Largo Horizontal (Tramo 2)<HelpPopover>Longitud horizontal que ocupa el segundo tramo de la escalera.</HelpPopover></span>} name="largoT2" unit="m" value={largoT2} onChange={setLargoT2} />}
            {tipo === 'U' && <NumberWithUnit label={<span className="flex items-center">Ancho Descanso<HelpPopover>Ancho del descanso que une los dos tramos.</HelpPopover></span>} name="anchoDescanso" unit="m" value={anchoDescanso} onChange={setAnchoDescanso} />}
          </div>
          {/* Materiales */}
          <h3 className="font-medium border-b pb-2">Materiales y Armado</h3>
          <div className="grid grid-cols-2 gap-3">
            <NumberWithUnit label={<span className="flex items-center">Espesor Losa Inclinada<HelpPopover>También llamada "garganta". Es el espesor de hormigón debajo de los escalones. Típico: 10-15 cm.</HelpPopover></span>} name="espesor_losa" unit="cm" value={espesorLosa} onChange={setEspesorLosa} />
            <label className="text-sm"><span className="flex items-center">Hormigón<HelpPopover>Resistencia del hormigón. H-21 es común para escaleras.</HelpPopover></span><select value={concreteId} onChange={e => setConcreteId(e.target.value)} className="w-full px-3 py-2">{concreteOpts.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></label>
            <label className="text-sm"><span className="flex items-center">Φ Acero Principal<HelpPopover>Diámetro del acero que va en la dirección larga de los tramos.</HelpPopover></span><select value={phiP} onChange={e => setPhiP(Number(e.target.value))} className="w-full px-3 py-2">{rebarOpts.map(r => <option key={`p-${r.key}`} value={r.phi_mm}>{r.label}</option>)}</select></label>
            <NumberWithUnit label="Separación Acero Principal" name="sep_p" unit="cm" value={sepP} onChange={setSepP} />
            <label className="text-sm"><span className="flex items-center">Φ Acero Repartición<HelpPopover>Diámetro del acero transversal, perpendicular al principal.</HelpPopover></span><select value={phiR} onChange={e => setPhiR(Number(e.target.value))} className="w-full px-3 py-2">{rebarOpts.map(r => <option key={`r-${r.key}`} value={r.phi_mm}>{r.label}</option>)}</select></label>
            <NumberWithUnit label="Separación Acero Repartición" name="sep_r" unit="cm" value={sepR} onChange={setSepR} />
          </div>
        </div>
        <div className="card p-4 card--table">
          <ResultTable title="Diseño y Cómputo" items={rows} />
        </div>
      </div>
      <div className="card p-4 space-y-3">
        <h3 className="font-semibold">Guardar en proyecto</h3>
        <AddToProject kind="escalera" defaultTitle={defaultTitle} items={itemsForProject} raw={res} />
      </div>
    </section>
  );
}

export default function EscaleraPage() {
  return (<Suspense fallback={<div>Cargando...</div>}><EscaleraCalculator /></Suspense>);
}