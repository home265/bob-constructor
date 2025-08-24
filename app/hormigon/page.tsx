export default function HormigonIndex() {
  const cards = [
    { href: "/hormigon/base", title: "Base/Plateas" },
    { href: "/hormigon/pilote", title: "Pilotes" },
    { href: "/hormigon/columna", title: "Columnas" },
    { href: "/hormigon/viga", title: "Vigas" },
    { href: "/hormigon/losa", title: "Losa maciza" },
    { href: "/hormigon/losa-premoldeada", title: "Losa premoldeada" },
  ];
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Hormigón armado</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <a key={c.href} href={c.href} className="card p-4 hover:bg-[var(--muted)] transition">
            <div className="text-lg font-medium">{c.title}</div>
            <div className="text-sm text-foreground/70">Abrir</div>
          </a>
        ))}
      </div>
    </section>
  );
}
