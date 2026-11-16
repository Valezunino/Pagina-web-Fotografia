import { getDb } from "@/db";
import { siteSettings } from "@/db/schema";

export type EditableSiteSettings = {
  heroKicker: string;
  heroDescription: string;
  galleryEyebrow: string;
  galleryTitle: string;
  watermarkText: string;
  footerText: string;
};

export const DEFAULT_SITE_SETTINGS: EditableSiteSettings = {
  heroKicker: "Fotografía profesional",
  heroDescription: "Elegí tu imagen, pagá de forma segura y descargá el archivo en alta calidad, sin marca de agua.",
  galleryEyebrow: "Galerías por evento",
  galleryTitle: "Eventos y colecciones",
  watermarkText: "FOTO DE MUESTRA",
  footerText: "Imágenes protegidas · Compra segura",
};

export async function getSiteSettings(): Promise<EditableSiteSettings> {
  try {
    const rows = await getDb().select().from(siteSettings);
    const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    const settings: EditableSiteSettings = { ...DEFAULT_SITE_SETTINGS, ...stored };
    for (const key of Object.keys(DEFAULT_SITE_SETTINGS) as (keyof EditableSiteSettings)[]) {
      const value = settings[key];
      if (/\bDaniel\b/i.test(value)) {
        settings[key] = key === "watermarkText"
          ? DEFAULT_SITE_SETTINGS.watermarkText
          : value.replace(/\bDaniel(?:\s+Justiniano)?\b/gi, "Galería Fotográfica");
      }
    }
    return settings;
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}
