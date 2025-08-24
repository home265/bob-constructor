"use client";
import { useRouter } from "next/navigation";
import { createProject, setActiveProjectId } from "@/lib/project/storage";
import { useState } from "react";

export default function NuevoProyectoPage() {
  const [name, setName] = useState("Proyecto sin nombre");
  const [client, setClient] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [contact, setContact] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [currency, setCurrency] = useState<"ARS"|"USD">("ARS");
  const [notes, setNotes] = useState("");
  const router = useRouter();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = createProject({ name, client, siteAddress, contact, logoUrl, currency, notes });
    setActiveProjectId(p.id);
    router.push(`/proyecto/${p.id}`);
  }

  return (
    <section className="space-y-6 container mx-auto px-4 max-w-3xl">
      <h1 className="text-2xl font-semibold">Nuevo proyecto</h1>
      <form onSubmit={onSubmit} className="card p-4 grid gap-4">
        <label className="text-sm">
          Nombre
          <input className="w-full px-3 py-2" value={name} onChange={e => setName(e.target.value)} />
        </label>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm">
            Cliente
            <input className="w-full px-3 py-2" value={client} onChange={e => setClient(e.target.value)} />
          </label>
          <label className="text-sm">
            Moneda
            <select className="w-full px-3 py-2" value={currency} onChange={e => setCurrency(e.target.value as any)}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>

        <label className="text-sm">
          Dirección de obra
          <input className="w-full px-3 py-2" value={siteAddress} onChange={e => setSiteAddress(e.target.value)} />
        </label>

        <div className="grid md:grid-cols-2 gap-4">
          <label className="text-sm">
            Contacto (tel/email)
            <input className="w-full px-3 py-2" value={contact} onChange={e => setContact(e.target.value)} />
          </label>
          <label className="text-sm">
            Logo (URL opcional)
            <input className="w-full px-3 py-2" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." />
          </label>
        </div>

        <label className="text-sm">
          Notas
          <textarea className="w-full px-3 py-2 min-h-[90px]" value={notes} onChange={e => setNotes(e.target.value)} />
        </label>

        <button className="btn mt-2" type="submit">Crear</button>
      </form>
    </section>
  );
}
