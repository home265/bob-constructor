export function keyToUnit(key: string): string {
  if (/_kg$/.test(key)) return "kg";
  if (/_m3$/.test(key)) return "m³";
  if (/_m2$/.test(key)) return "m²";
  if (/_l$/.test(key) || /_lt$/.test(key)) return "L";
  if (/_uds?$/.test(key)) return "ud";
  return "";
}

export function keyToLabel(key: string): string {
  // reemplazos comunes
  const map: Record<string, string> = {
    cemento_kg: "Cemento",
    arena_m3: "Arena",
    cal_kg: "Cal",
    piedra_m3: "Piedra",
    agua_l: "Agua",
    aditivo_l: "Aditivo",
    malla_m2: "Malla SIMA",
  };
  if (map[key]) return map[key];

  // genérico
  const pretty = key.replace(/_/g, " ");
  return pretty.charAt(0).toUpperCase() + pretty.slice(1);
}
