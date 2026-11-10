import { z } from "zod";

const isoCountryRegex = /^[A-Z]{2}$|^ALL$/;
const slugRegex = /^[A-Za-z0-9.\-_]+$/;

export const searchModes = ["keyword", "page_url", "slug"] as const;
export const adStatuses = ["active", "inactive", "all"] as const;
export const platforms = [
  "instagram",
  "facebook",
  "messenger",
  "audience_network",
] as const;
export const mediaTypes = ["all", "video", "image", "memes", "none"] as const;
export const exportFormats = ["csv", "json"] as const;

/**
 * Base scrape form schema mirroring backend ScrapeRequest.
 */
export const scrapeFormSchema = z
  .object({
    mode: z.enum(searchModes, {
      required_error: "Selecciona un modo de búsqueda",
    }).default("keyword"),
    query: z
      .string()
      .trim()
      .min(1, "La búsqueda no puede estar vacía")
      .max(500, "Máximo 500 caracteres"),
    country: z
      .string()
      .trim()
      .transform((val) => (val ? val.toUpperCase() : "ALL"))
      .refine(
        (val) => isoCountryRegex.test(val),
        "Código de país inválido. Usa un código ISO de 2 letras (ej. ES) o ALL"
      )
      .default("ALL"),
    status: z.enum(adStatuses).default("active"),
    platform: z.enum(platforms).nullable().optional(),
    media_type: z.enum(mediaTypes).default("all"),
    min_date: z
      .string()
      .nullable()
      .optional()
      .refine((val) => {
        if (!val) return true;
        const d = new Date(val);
        if (isNaN(d.getTime())) return false;
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return d <= today;
      }, "La fecha no puede ser futura"),
    exact: z.boolean().default(false),
    only_ig_profile: z.boolean().default(false),
    format: z.enum(exportFormats).default("csv"),
    limit: z.coerce
      .number({ invalid_type_error: "El límite debe ser un número" })
      .int("El límite debe ser un entero")
      .min(1, "Mínimo 1 anuncio")
      .max(1000, "Máximo 1000 anuncios")
      .default(50),
  })
  .superRefine((data, ctx) => {
    // URL mode validation
    if (data.mode === "page_url") {
      const q = data.query.toLowerCase();
      if (!q.startsWith("http://") && !q.startsWith("https://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La URL debe comenzar con https:// o http://",
          path: ["query"],
        });
      } else if (!q.includes("facebook.com")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La URL debe ser una página de facebook.com",
          path: ["query"],
        });
      }
    }

    // Slug mode validation
    if (data.mode === "slug") {
      if (data.query.includes("facebook.com") || data.query.includes("/")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Has pegado una URL. Cambia el modo a 'URL de página' o usa solo el identificador slug",
          path: ["query"],
        });
      } else if (!slugRegex.test(data.query)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El slug solo puede contener letras, números, puntos, guiones y guiones bajos",
          path: ["query"],
        });
      }
    }
  });

export type ScrapeFormValues = z.infer<typeof scrapeFormSchema>;

/**
 * Batch scrape form schema mirroring backend BatchRequest.
 */
export const batchFormSchema = z.object({
  queriesText: z
    .string()
    .trim()
    .min(1, "Introduce al menos una búsqueda"),
  pause_seconds: z.coerce
    .number()
    .int()
    .min(0, "La pausa mínima es 0 segundos")
    .max(1800, "La pausa máxima es 1800 segundos (30 min)")
    .default(150),
  country: z
    .string()
    .trim()
    .transform((val) => (val ? val.toUpperCase() : "ALL"))
    .refine(
      (val) => isoCountryRegex.test(val),
      "Código de país inválido. Usa un código ISO de 2 letras (ej. ES) o ALL"
    )
    .default("ALL"),
  status: z.enum(adStatuses).default("active"),
  platform: z.enum(platforms).nullable().optional(),
  media_type: z.enum(mediaTypes).default("all"),
  min_date: z
    .string()
    .nullable()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const d = new Date(val);
      if (isNaN(d.getTime())) return false;
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return d <= today;
    }, "La fecha no puede ser futura"),
  exact: z.boolean().default(false),
  only_ig_profile: z.boolean().default(false),
  format: z.enum(exportFormats).default("csv"),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Mínimo 1 anuncio")
    .max(1000, "Máximo 1000 anuncios")
    .default(50),
});

export type BatchFormValues = z.infer<typeof batchFormSchema>;

/**
 * Helper to parse and deduplicate queries from a multi-line string.
 */
export function parseBatchQueries(rawText: string): string[] {
  const lines = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  // Deduplicate preserving order
  return Array.from(new Set(lines));
}
