import Link from "next/link";

export default function Home() {
  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Bob Constructor</h1>
        <p className="text-sm text-foreground/80">
          Usá el menú de arriba para elegir un módulo.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <Link href="/proyecto" className="btn btn-primary">
          Ir a Proyectos
        </Link>
      </div>

      <p className="text-xs text-foreground/60">
        PWA: funciona offline y en pantalla chica/grande.
      </p>
    </section>
  );
}
