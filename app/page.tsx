export default function Home() {
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bob Constructor</h1>
        <p className="text-sm text-foreground/80">
          Usá el menú de arriba para elegir un módulo.
        </p>
      </div>

      <p className="text-xs text-foreground/60">
        PWA: funciona offline y en pantalla chica/grande.
      </p>
    </section>
  );
}
