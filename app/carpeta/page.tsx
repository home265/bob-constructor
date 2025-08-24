"use client";
import { useEffect, useMemo, useState } from "react";
import { useJson } from "@/lib/data/useJson";
// @ts-ignore – desacoplado de la firma exacta de la función de cálculo
import * as C from "@/lib/calc/carpeta";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";
import { keyToLabel, keyToUnit } from "@/components/ui/result-mappers";
import AddToProject from "@/components/ui/AddToProject";

// Forma real de tu JSON: { mezclas: [{id,label}], hidrofugo: boolean | array }
type CarpetaOptionsFile = {
  mezclas?: { id?: string; label?: string }[];
  hidrofugo?: boolean | { key?: string; label?: string }[];
};
type MixMap = any;
type Morteros = Record<string, any>;

export default function CarpetaPage() {
  const options = useJson<CarpetaOptionsFile>("/data/carpeta_options.json", {
    mezclas: [
      { id: "1_3", label: "Cemento 1:3" },
      { id: "1_4", label: "Cemento 1:4" },
      { id: "1_2_6", label: "Cemento y cal 1:2:6" },
    ],
    hidrofugo: true,
  });
  const mixMap = useJson<MixMap>("/data/carpeta_mix_map.json", []);
  const morteros = useJson<Morteros>("/data/mortars.json", {});

  // Normalizo "mezclas" -> tipos {key,label}
  const tipos = useMemo(
    () =>
      Array.isArray(options.mezclas)
        ? options.mezclas.map((m, i) => ({
            key: m?.id ?? `mix_${i}`,
            label: m?.label ?? `Mezcla ${i + 1}`,
          }))
        : [],
    [options.mezclas]
  );

  // Normalizo hidrófugo: si es boolean, genero opciones; si es array, las mapeo
  const hidros = useMemo(() => {
    const h = options.hidrofugo;
    if (Array.isArray(h)) {
      return h.map((x, i) => ({
        key: x?.key ?? `hidro_${i}`,
        label: x?.label ?? `Opción ${i + 1}`,
      }));
    }
    if (h === true) {
      return [
        { key: "no", label: "Sin hidrófugo" },
        { key: "si", label: "Con hidrófugo" },
      ];
    }
    return []; // si es false o undefined: sin selector
  }, [options.hidrofugo]);

  // Estado con fallback + autocorrección si cambian las opciones
  const [tipo, setTipo] = useState<string>(tipos[0]?.key ?? "1_3");
  const [hidro, setHidro] = useState<string>(hidros[0]?.key ?? "no");
  const [L, setL] = useState(4);
  const [A, setA] = useState(3);
  const [H, setH] = useState(3); // cm
  const [waste, setWaste] = useState(10);

  useEffect(() => {
    if (tipos.length && !tipos.find((t) => t.key === tipo)) {
      setTipo(tipos[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipos]);

  useEffect(() => {
    if (hidros.length && !hidros.find((h) => h.key === hidro)) {
      setHidro(hidros[0].key);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidros]);

  const input = { tipo, hidro, L, A, Hcm: H, wastePct: waste, mixMap, morteros };
  // @ts-ignore – usa tu función real si existe; si no, devuelve el input
  const r = (C.calcCarpeta ?? C.default ?? ((x: any) => x))(input);

  // ---- Filas para la tabla (sin 'key', qty:number)
  const rows: ResultRow[] = [];
  if (typeof r?.area_m2 === "number")
    rows.push({ label: "Área", qty: Math.round(r.area_m2 * 100) / 100, unit: "m²" });
  if (typeof r?.espesor_cm === "number")
    rows.push({ label: "Espesor", qty: Math.round(r.espesor_cm * 100) / 100, unit: "cm" });
  const vol = typeof r?.volumen_con_desperdicio_m3 === "number"
    ? r.volumen_con_desperdicio_m3
    : (typeof r?.volumen_m3 === "number" ? r.volumen_m3 : undefined);
  if (typeof vol === "number")
    rows.push({ label: "Volumen", qty: Math.round(vol * 100) / 100, unit: "m³" });

  if (r?.materiales && typeof r.materiales === "object") {
    for (const [k, v] of Object.entries(r.materiales)) {
      const qty = Math.round((Number(v) || 0) * 100) / 100;
      rows.push({ label: keyToLabel(k), qty, unit: keyToUnit(k) });
    }
  }

  if (r?.mortero_id)
    rows.push({ label: "Mortero (ID)", qty: 1, unit: keyToUnit("mortero_id") ?? "" });

  // ---- Materiales para Proyecto (solo materiales, con key y qty:number)
  const itemsForProject = useMemo(() => {
    const list: { key?: string; label: string; qty: number; unit: string }[] = [];
    if (r?.materiales && typeof r.materiales === "object") {
      for (const [k, v] of Object.entries(r.materiales)) {
        list.push({
          key: k,
          label: keyToLabel(k),
          qty: Math.round((Number(v) || 0) * 100) / 100,
          unit: keyToUnit(k),
        });
      }
    }
    return list;
  }, [r?.materiales]);

  // Título de partida por defecto
  const defaultTitle = useMemo(
    () => `Carpeta ${L}×${A} m · e=${H} cm · ${tipo}${hidro === "si" ? " + hidrófugo" : ""}`,
    [L, A, H, tipo, hidro]
  );

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Carpeta</h1>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Card: Formulario */}
        <div className="card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm col-span-2">
              Tipo de carpeta
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full px-3 py-2"
              >
                {tipos.map((t, i) => (
                  <option key={`${t.key}-${i}`} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            {!!hidros.length && (
              <label className="text-sm col-span-2">
                Hidrófugo
                <select
                  value={hidro}
                  onChange={(e) => setHidro(e.target.value)}
                  className="w-full px-3 py-2"
                >
                  {hidros.map((h, i) => (
                    <option key={`${h.key}-${i}`} value={h.key}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="text-sm">
              Largo (m)
              <input
                type="number"
                value={L}
                onChange={(e) => setL(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>
            <label className="text-sm">
              Ancho (m)
              <input
                type="number"
                value={A}
                onChange={(e) => setA(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>
            <label className="text-sm col-span-2">
              Espesor (cm)
              <input
                type="number"
                value={H}
                onChange={(e) => setH(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>
            <label className="text-sm col-span-2">
              Desperdicio (%)
              <input
                type="number"
                value={waste}
                onChange={(e) => setWaste(+e.target.value || 0)}
                className="w-full px-3 py-2"
              />
            </label>
          </div>
        </div>

        {/* Card: Resultado */}
        <div className="card p-4 card--table">
          <h2 className="font-medium mb-2">Resultado</h2>
          <ResultTable title="Resultado" items={rows} />
        </div>
      </div>

      {/* Guardar en Proyecto */}
      {itemsForProject.length > 0 && (
        <AddToProject
          kind="carpeta"
          defaultTitle={defaultTitle}
          items={itemsForProject}
          raw={r}
        />
      )}
    </section>
  );
}
