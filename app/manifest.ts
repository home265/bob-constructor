import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bob Constructor",
    short_name: "Bob",
    description: "Cómputo de materiales de obra. Funciona offline.",
    start_url: "/",
    display: "standalone",
    background_color: "#2C3333",
    theme_color: "#0E8388",
    //icons: [
    //  { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    //  { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
   // ]
  };
}
