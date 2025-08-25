export type NavItem = {
  label: string;
  href?: string;
  children?: { label: string; href: string }[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Muros", href: "/muros" },
  { label: "Contrapiso", href: "/contrapiso" },
  { label: "Carpeta", href: "/carpeta" },
  { label: "Revoque", href: "/revoque" },
  { label: "Revestimientos", href: "/revestimientos" },

  // 👇 nuevo
  { label: "Boceto estructural", href: "/estructura" },
  { label: "Proyecto", href: "/proyecto" },

  {
    label: "Hormigón",
    children: [
      { label: "Base", href: "/hormigon/base" },
      { label: "Pilote", href: "/hormigon/pilote" },
      { label: "Columna", href: "/hormigon/columna" },
      { label: "Viga", href: "/hormigon/viga" },
      { label: "Losa", href: "/hormigon/losa" },
      { label: "Losa premoldeada", href: "/hormigon/losa-premoldeada" }
    ]
  }
];
