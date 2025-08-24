"use client";
import { useMemo, useState, useEffect } from "react";
import { useJson } from "@/lib/data/useJson";
// @ts-ignore – desacoplado de la firma exacta
import * as C from "@/lib/calc/revoque";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";

type RevoqueOptionsFile = {
  lados?: { id?: string; label?: string }[];
  terminaciones_ids?: string[];
  hidrofugo?: boolean;
};

// Mapa de IDs → etiqueta legible
const TERM_LABELS: Record<string, string> = {
  revoque_grueso: "Revoque grueso",
  revoque_fino: "Revoque fino",
  revoque_grueso_fino: "Revoque grueso + fino",
  revoque_grueso_yeso: "Revoque grueso + enlucido de yeso",
  yeso_engrosado_enlucido: "Yeso (engrosado y enlucido)",
  yeso_enlucido: "Yeso (enlucido)",
};

type LadoKey = "uno" | "dos" | "ambos";

export default function RevoquePage() {
  const opts = useJson<RevoqueOptionsFile>("/data/revoque_options.json", {
    lados: [
      { id: "uno", label: "Un lado" },
      { id: "ambos", label: "Ambos lados" },
    ],
    terminaciones_ids: [
      "revoque_grueso",
      "revoque_fino",
      "revoque_grueso_fino",
      "revoque_grueso_yeso",
      "yeso_engrosado_enlucido",
      "yeso_enlucido",
    ],
    hidrofugo: true,
  });

  // Normalizo lados
  const ladosOpts = useMemo(
    () =>
      Array.isArray(opts.lados)
        ? opts.lados.map((l, i) => ({
            key: l?.id ?? `lado_${i}`,
            label: l?.label ?? `Opción ${i + 1}`,
          }))
        : [],
    [opts.lados]
  );

  // Normalizo terminaciones_ids → {key,label}
  const terminaciones = useMemo(
    () =>
      Array.isArray(opts.terminaciones_ids)
        ? opts.terminaciones_ids.map((id, i) => ({
            key: id ?? `t_${i}`,
            label: TERM_LABELS[id] ?? id ?? `Opción ${i + 1}`,
          }))
        : [],
    [opts.terminaciones_ids]
  );

  // Estado + autocorrección segura si cambian las opciones
  const [lado, setLado] = useState<LadoKey>(
    (ladosOpts[0]?.key as LadoKey) ?? "uno"
  );
  const [term1, setTerm1] = useState<string>(terminaciones[0]?.key ?? "");
  const [term2, setTerm2] = useState<string>(terminaciones[1]?.key ?? "");
  const [L, setL] = useState(4); // m
  const [H, setH] = useState(2.7); // m
  const [e, setE] = useState(2.5); // cm
  const [waste, setWaste] = useState(10); // %

  useEffect(() => {
    if (ladosOpts.length && !ladosOpts.find((l) => l.key === lado)) {
      setLado(ladosOpts[0].key as LadoKey);
    }
  }, [ladosOpts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (terminaciones.length && !terminaciones.find((t) => t.key === term1)) {
      setTerm1(terminaciones[0].key);
    }
    if (
      lado === "ambos" &&
      terminaciones.length &&
      term2 &&
      !terminaciones.find((t) => t.key === term2)
    ) {
      setTerm2(terminaciones[0].key);
    }
  }, [terminaciones, lado]); // eslint-disable-line react-hooks/exhaustive-deps

  // Función de cálculo (anotada como any para evitar choques de tipos si la lib aún no acepta "ambos")
  const calc: any =
    // @ts-ignore
    C.calcRevoque ?? C.default ?? ((x: any) => x);

  const res = calc({
    lados: lado, // "uno" | "dos" | "ambos"
    term1,
    term2: lado === "ambos" ? term2 : "",
    L,
    H,
    e_cm: e,
    wastePct: waste,
  });

  return (
  <section className="space-y-6">
    <h1 className="text-2xl font-semibold">Revoque</h1>

    <div className="grid md:grid-cols-2 gap-4">
      <div className="card p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm col-span-2">
            Lados a revocar
            <select
              value={lado}
              onChange={(e) => setLado(e.target.value as LadoKey)}
              className="w-full px-3 py-2"
            >
              {ladosOpts.map((l, i) => (
                <option key={`${l.key}-${i}`} value={l.key}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm col-span-2">
            Terminación lado 1
            <select
              value={term1}
              onChange={(e) => setTerm1(e.target.value)}
              className="w-full px-3 py-2"
            >
              {terminaciones.map((t, i) => (
                <option key={`${t.key}-${i}`} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {lado === "ambos" && (
            <label className="text-sm col-span-2">
              Terminación lado 2
              <select
                value={term2}
                onChange={(e) => setTerm2(e.target.value)}
                className="w-full px-3 py-2"
              >
                {terminaciones.map((t, i) => (
                  <option key={`t2-${t.key}-${i}`} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="text-sm">
            Longitud (m)
            <input
              type="number"
              value={L}
              onChange={(e) => setL(+e.target.value || 0)}
              className="w-full px-3 py-2"
            />
          </label>

          <label className="text-sm">
            Altura (m)
            <input
              type="number"
              value={H}
              onChange={(e) => setH(+e.target.value || 0)}
              className="w-full px-3 py-2"
            />
          </label>

          <label className="text-sm col-span-2">
            Espesor (cm)
            <input
              type="number"
              value={e}
              onChange={(e2) => setE(+e2.target.value || 0)}
              className="w-full px-3 py-2"
            />
          </label>

          <label className="text-sm col-span-2">
            Desperdicio (%)
            <input
              type="number"
              value={waste}
              onChange={(e2) => setWaste(+e2.target.value || 0)}
              className="w-full px-3 py-2"
            />
          </label>
        </div>
      </div>

      <ResultTable
        title="Resultado"
        items={(function (): ResultRow[] {
          const out: ResultRow[] = [];
          if (res?.area_m2 != null) out.push({ label: "Área", qty: res.area_m2, unit: "m²" });
          if (res?.espesor_cm != null) out.push({ label: "Espesor", qty: res.espesor_cm, unit: "cm" });

          const vol = res?.mortero_con_desperdicio_m3 ?? res?.mortero_m3;
          if (vol != null) out.push({ label: "Mortero", qty: vol, unit: "m³", hint: "Con desperdicio" });

          if (Array.isArray(res?.terminaciones) && res.terminaciones.length) {
            out.push({ label: "Terminaciones", qty: res.terminaciones.join(" + ") });
          }
          return out;
        })()}
      />
    </div>
  </section>
);

}
