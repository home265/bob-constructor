import Link from "next/link";

const items = [
  {
    href: "/hormigon/base",
    title: "Base de fundación",
    desc: "Volumen, acero y materiales estimativos para bases."
  },
  {
    href: "/hormigon/columna",
    title: "Columna",
    desc: "Sección, volumen y armado orientativo de columnas."
  },
  {
    href: "/hormigon/losa",
    title: "Losa maciza",
    desc: "Espesor, volumen, acero y materiales para losa maciza."
  },
  {
    href: "/hormigon/losa-premoldeada",
    title: "Losa premoldeada",
    desc: "Cálculo orientativo para sistemas premoldeados."
  },
  {
    href: "/hormigon/pilote",
    title: "Pilote",
    desc: "Volumen y materiales para pilotes de hormigón."
  },
  {
    href: "/hormigon/viga",
    title: "Viga",
    desc: "Cargas/esfuerzos típicos y materiales para vigas."
  },
  {
  href: "/hormigon/zapatas",
  title: "Zanjas y Zapatas Corridas",
  desc: "Calcula excavación, hormigón y acero para vigas de fundación."
},
{
  href: "/hormigon/escalera",
  title: "Escalera",
  desc: "Diseña y calcula los materiales para escaleras de hormigón."
}
  
];

export default function HormigonHubPage() {
  return (
    <section className="container mx-auto px-4 max-w-5xl space-y-6">
      <div className="card p-4 space-y-2">
        <h1 className="text-2xl font-semibold">Hormigón</h1>
        <p className="text-sm text-foreground/70">
          Elegí una calculadora. Los resultados son orientativos para presupuesto y deben ser verificados por un profesional.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <div key={it.href} className="card p-4 flex flex-col justify-between">
            <div>
              <div className="font-medium">{it.title}</div>
              <div className="text-xs text-foreground/60 mt-1">{it.desc}</div>
            </div>
            <div className="mt-3">
              <Link className="btn" href={it.href}>Abrir</Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
