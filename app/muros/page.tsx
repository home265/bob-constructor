"use client";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import NumberWithUnit from "@/components/inputs/NumberWithUnit";
import OpeningsGroup from "@/components/inputs/OpeningsGroup";
import ResultTable, { ResultRow } from "@/components/ui/ResultTable";

import {
  loadDefaults,
  loadMortars,
  loadWallCoefficients,
  loadWallOptions,
} from "@/lib/data/catalogs";
import { computeMuros } from "@/lib/calc/muros";
import type {
  Mortar,
  WallCoefficient,
  WallFormInput,
  WallOptions,
  WallResult,
} from "@/lib/types";

const schema = z.object({
  tipoMuroId: z.enum(["simple", "doble"]),
  ladrilloId: z.string().min(1),
  juntaMm: z.number().int().nonnegative(),
  morteroAsientoId: z.string().min(1),
  L: z.number().positive(),
  H: z.number().positive(),
  SA: z.number().min(0).default(0),
  desperdicioPct: z.number().min(0).max(30).default(7),
});

type FormValues = z.infer<typeof schema>;

export default function PageMuros() {
  const [opts, setOpts] = useState<WallOptions | null>(null);
  const [coeffs, setCoeffs] = useState<WallCoefficient[] | null>(null);
  const [mortars, setMortars] = useState<Mortar[] | null>(null);
  const [defaults, setDefaults] = useState<any>(null);
  const [vanos, setVanos] = useState([
    { lv: 0, hv: 0 },
    { lv: 0, hv: 0 },
    { lv: 0, hv: 0 },
  ]);
  const [res, setRes] = useState<WallResult | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipoMuroId: "simple",
      L: 0,
      H: 0,
      SA: 0,
      juntaMm: 10,
      desperdicioPct: 7,
    } as any,
  });

  useEffect(() => {
    (async () => {
      const [o, c, m, d] = await Promise.all([
        loadWallOptions(),
        loadWallCoefficients(),
        loadMortars(),
        loadDefaults(),
      ]);
      setOpts(o);
      setCoeffs(c);
      setMortars(m);
      setDefaults(d);
      // defaults: set mortero asiento al primero disponible
      if (o.morteros_asiento_ids?.length)
        setValue("morteroAsientoId", o.morteros_asiento_ids[0] as any);
      if (o.juntas_mm?.length) setValue("juntaMm", o.juntas_mm[0] as any);
    })();
  }, [setValue]);

  const onSubmit = (fv: FormValues) => {
    if (!coeffs || !mortars || !defaults) return;
    const input: WallFormInput = { ...fv, vanos };
    const r = computeMuros(input, coeffs, mortars, defaults);
    setRes(r);
  };

  // ---- Mapear resultado → filas del ResultTable
  const LABELS: Record<string, { label: string; unit?: string }> = {
    area_m2: { label: "Área de muro", unit: "m²" },
    S_m2: { label: "Área de muro", unit: "m²" }, // alias
    volumen_m3: { label: "Volumen (mampostería)", unit: "m³" },
    ladrillos_u: { label: "Unidades ladrillo/bloque", unit: "u" },
    unidades: { label: "Unidades ladrillo/bloque", unit: "u" }, // alias
    mortero_m3: { label: "Mortero de asiento", unit: "m³" },
    cemento_bolsas: { label: "Cemento", unit: "bolsas" },
    cal_bolsas: { label: "Cal", unit: "bolsas" },
    arena_m3: { label: "Arena", unit: "m³" },
    revoque_m3: { label: "Revoque", unit: "m³" },
  };

  const items: ResultRow[] = useMemo(() => {
    const arr: ResultRow[] = [];
    if (!res || typeof res !== "object") return arr;
    for (const [k, v] of Object.entries(res as Record<string, unknown>)) {
      const meta = LABELS[k];
      if (!meta) continue;
      if (v == null) continue;
      const qty =
        typeof v === "number" ? Math.round((v as number) * 100) / 100 : String(v);
      arr.push({ label: meta.label, qty, unit: meta.unit });
    }
    return arr;
  }, [res]);

  if (!opts) return <p>Cargando catálogos…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Muros</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Selecciones */}
        <div className="grid md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Tipo de muro</span>
            <select className="rounded border px-3 py-2" {...register("tipoMuroId")}>
              {opts.tipo_muro.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Ladrillo / Bloque</span>
            <select className="rounded border px-3 py-2" {...register("ladrilloId")}>
              <optgroup label="Comunes">
                {opts.ladrillos_bloques
                  .filter((l) => l.familia === "comun")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Huecos">
                {opts.ladrillos_bloques
                  .filter((l) => l.familia === "hueco")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Bloques cerámicos portantes">
                {opts.ladrillos_bloques
                  .filter((l) => l.familia === "ceramico_portante")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.id === "bloque_cer_27x19x20"
                        ? "Bloque cerámico portante 27×19×20"
                        : l.label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Bloques de cemento portantes">
                {opts.ladrillos_bloques
                  .filter((l) => l.familia === "hormigon")
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Junta (mm)</span>
            <select
              className="rounded border px-3 py-2"
              {...register("juntaMm", { valueAsNumber: true })}
            >
              {opts.juntas_mm.map((j) => (
                <option key={j} value={j}>
                  {j} mm
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Mortero de asiento</span>
            <select
              className="rounded border px-3 py-2"
              {...register("morteroAsientoId")}
            >
              {(opts.morteros_asiento_ids || []).map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>

          <NumberWithUnit
            label="Longitud (L)"
            name="L"
            unit="m"
            value={watch("L") ?? 0}
            onChange={(v) => setValue("L", v)}
          />
          <NumberWithUnit
            label="Altura (H)"
            name="H"
            unit="m"
            value={watch("H") ?? 0}
            onChange={(v) => setValue("H", v)}
          />
          <NumberWithUnit
            label="Superficie adicional (SA)"
            name="SA"
            unit="m²"
            value={watch("SA") ?? 0}
            onChange={(v) => setValue("SA", v)}
          />
        </div>

        {/* Vanos */}
        <div className="space-y-2">
          <div className="font-medium">Vanos a descontar (hasta 3)</div>
          <OpeningsGroup items={vanos} onChange={setVanos} />
        </div>

        {/* Desperdicio */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Desperdicio (%)</label>
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={watch("desperdicioPct") ?? 7}
            onChange={(e) =>
              setValue("desperdicioPct", parseInt(e.target.value))
            }
          />
          <span className="text-sm">{watch("desperdicioPct") ?? 7}%</span>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !coeffs || !mortars}
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          Calcular
        </button>
      </form>

      {res ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Resultado</h2>
          {items.length ? (
            <ResultTable title="Resultado" items={items} />
          ) : (
            <div className="card p-4">
              <h2 className="font-medium mb-2">Resultado</h2>
              <pre className="text-xs whitespace-pre-wrap">
                {JSON.stringify(res, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
