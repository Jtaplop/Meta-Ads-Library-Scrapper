# SPEC-FRONTEND — Interfaz web (Vite + React + TypeScript + Tailwind)

> Parte de [ROADMAP.md](./ROADMAP.md). Consume la API definida en [SPEC-API.md](./SPEC-API.md).

---

## 1. Objetivos de producto

- **Sustituir la terminal y Excel** en el flujo diario: lanzar búsquedas, ver progreso, explorar y depurar leads, exportar.
- **Cero curva de aprendizaje:** los parámetros del CLI se presentan con lenguaje de negocio, ayudas contextuales y recetas.
- **Transparencia:** siempre visible qué está haciendo el scraper (fase, contadores, logs) y el comando CLI equivalente.
- **Prevención de bloqueos:** la UI guía hacia límites y pausas seguras.

Usuario objetivo: profesional de captación de clientes (agencia/freelance) que prospecta anunciantes de Meta, en escritorio.

---

## 2. Stack y dependencias

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm i react-router @tanstack/react-query @tanstack/react-table @tanstack/react-virtual \
      react-hook-form zod @hookform/resolvers lucide-react sonner clsx tailwind-merge \
      class-variance-authority date-fns
npm i -D tailwindcss @tailwindcss/vite openapi-typescript prettier prettier-plugin-tailwindcss \
      vitest @testing-library/react @testing-library/jest-dom jsdom
npx shadcn@latest init     # componentes Radix copiados en src/components/ui
```

### 2.1 `vite.config.ts`

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: {
    port: 5173,
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } },
  },
});
```

> El proxy hace que en desarrollo el frontend use rutas relativas `/api/...` igual que en producción (mismo origen) → sin lógica de entorno en el código.

### 2.2 Scripts `package.json`

| Script | Comando |
| --- | --- |
| `dev` | `vite` |
| `build` | `tsc -b && vite build` |
| `preview` | `vite preview` |
| `lint` | `eslint .` |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest` |
| `gen:api` | `openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/schema.d.ts` |

---

## 3. Estructura de carpetas

```
frontend/src/
├── main.tsx                     # Providers: QueryClient, Router, Theme, Toaster
├── App.tsx                      # Definición de rutas
├── index.css                    # @import "tailwindcss"; @theme {...}
├── api/
│   ├── schema.d.ts              # GENERADO (openapi-typescript) — no editar
│   ├── client.ts                # fetch tipado + manejo de errores (ApiError)
│   ├── types.ts                 # Re-exports legibles: Job, ScrapeRequest, AdRecord...
│   └── queries/                 # Hooks TanStack Query por recurso
│       ├── useOptions.ts
│       ├── useJobs.ts           # useJobs, useJob, useCreateJob, useCancelJob, useRetryJob
│       ├── useBatches.ts
│       └── useResults.ts        # useResults, useResult, useDeleteResult, useMerge
├── hooks/
│   ├── useJobEvents.ts          # EventSource /jobs/{id}/events → estado reducido
│   ├── useGlobalJobEvents.ts    # EventSource /jobs/events → invalidar queries
│   ├── useLocalStorage.ts
│   └── useHotkeys.ts
├── lib/
│   ├── cn.ts                    # clsx + tailwind-merge
│   ├── format.ts                # fechas, bytes, duraciones, números
│   ├── enrich.ts                # derivados de AdRecord (§6)
│   ├── exportCsv.ts             # CSV UTF-8 con BOM desde filas filtradas
│   ├── cliPreview.ts            # ScrapeRequest → string del comando
│   └── schemas.ts               # zod: scrapeFormSchema, batchFormSchema
├── components/
│   ├── ui/                      # shadcn: button, input, select, tabs, switch, dialog, sheet...
│   ├── layout/                  # AppShell, Sidebar, Topbar, ActiveJobIndicator, ApiStatus
│   ├── scrape/                  # ScrapeForm, SearchModeTabs, CountrySelect, RecipePicker,
│   │                            # PresetMenu, CliPreview, LimitHint
│   ├── jobs/                    # JobStatusBadge, PhaseStepper, ProgressPanel, StatCards,
│   │                            # LogConsole, JobParamsSummary, JobsTable, CancelJobDialog
│   ├── results/                 # ResultFilesTable, AdsTable, AdsToolbar, ColumnPicker,
│   │                            # FilterBar, AdDetailSheet, MediaPreview, LandingTypeBadge,
│   │                            # DedupeToggle, ExportMenu
│   └── common/                  # EmptyState, ErrorState, PageHeader, ConfirmDialog, CopyButton
└── pages/
    ├── DashboardPage.tsx
    ├── NewScrapePage.tsx
    ├── BatchPage.tsx
    ├── JobsPage.tsx
    ├── JobDetailPage.tsx
    ├── ResultsPage.tsx
    ├── ResultDetailPage.tsx
    ├── SettingsPage.tsx
    └── NotFoundPage.tsx
```

---

## 4. Rutas

| Ruta | Página | Descripción |
| --- | --- | --- |
| `/` | `DashboardPage` | KPIs, job activo, últimos resultados, accesos rápidos |
| `/scrape/new` | `NewScrapePage` | Formulario de scrape (acepta `?recipe=` o `?from=<jobId>` para clonar) |
| `/scrape/batch` | `BatchPage` | Lote de keywords |
| `/jobs` | `JobsPage` | Cola + historial de ejecuciones |
| `/jobs/:jobId` | `JobDetailPage` | Seguimiento en vivo / resumen final |
| `/results` | `ResultsPage` | Ficheros de `output/` |
| `/results/:filename` | `ResultDetailPage` | Explorador de anuncios (`?merge=a.csv,b.csv` para fusionar) |
| `/settings` | `SettingsPage` | Config de solo lectura, pausa entre jobs, tema, preferencias |

---

## 5. Pantallas

### 5.1 Layout (`AppShell`)

```
┌───────────────┬──────────────────────────────────────────────────────────┐
│  ◆ Meta Ads   │  Título de página               [● API ok] [◐ tema]    │
│    Scraper    ├──────────────────────────────────────────────────────────┤
│               │                                                          │
│ ▸ Dashboard   │                                                          │
│ ▸ Nuevo scrape│                 Contenido de la página                   │
│ ▸ Lote        │                                                          │
│ ▸ Trabajos (1)│                                                          │
│ ▸ Resultados  │                                                          │
│ ▸ Ajustes     │                                                          │
│               │                                                          │
│ ┌───────────┐ │                                                          │
│ │⟳ psicolog.│ │   ← ActiveJobIndicator: job en curso, mini barra,       │
│ │ 34/100 ▓▓░│ │     clic → /jobs/:id                                     │
│ └───────────┘ │                                                          │
└───────────────┴──────────────────────────────────────────────────────────┘
```

- `ApiStatus`: consulta `/api/health` cada 10 s; si cae → banner rojo "API desconectada — ejecuta `scripts/dev.ps1`".
- `useGlobalJobEvents` montado en el shell: ante cambios de estado invalida `["jobs"]`, `["results"]` y muestra toast al terminar ("✔ psicologia: 87 anuncios — Ver resultados").

### 5.2 Nuevo scrape (`NewScrapePage`)

```
┌ Recetas: [Lead Gen IG] [Anuncios ganadores] [Barrido dolores] [Embudos ext.]   Presets ▾ ┐
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ ¿Qué buscas?   ( Palabra clave | Página (slug) | URL de página )                          │
│ [ psicologia                                              ]  ☑ Frase exacta             │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ País [España (ES) ▾]   Estado [Activos ▾]   Plataforma [Instagram ▾]   Medio [Vídeo ▾]   │
│ Desde [2025-11-01 📅]                                                                    │
│ ☑ Modo Lead Gen: solo anuncios que llevan a un perfil de Instagram                       │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Límite [100]  ⓘ Recomendado 50-200 por ejecución      Formato (CSV | JSON)               │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Comando equivalente                                                         [Copiar]     │
│ python main.py --keyword "psicologia" --country ES --status active --platform ...        │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│                                      [Guardar preset]   [▶ Lanzar scrape]                │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Campos y mapeo:

| Campo UI | Control | Campo `ScrapeRequest` | Default | Validación / UX |
| --- | --- | --- | --- | --- |
| Modo de búsqueda | Tabs | `mode` | `keyword` | Cambia placeholder y ayuda del input |
| Búsqueda | Input | `query` | — | Requerido; `page_url` → URL `facebook.com`; `slug` → `^[A-Za-z0-9.\-_]+$`. Si el usuario pega una URL en modo slug, ofrecer cambiar a modo URL |
| Frase exacta | Checkbox | `exact` | `false` | Solo habilitado en modo keyword |
| País | Combobox con búsqueda y grupos (Hispano / Anglosajón / Europa / Todos) | `country` | `ALL` | Aviso si escriben `UK` → "usa GB" |
| Estado | Select | `status` | `active` | Etiquetas: Activos / Inactivos / Todos |
| Plataforma | Select con opción "Todas" | `platform` | `null` | |
| Tipo de medio | Select | `media_type` | `all` | Todos / Vídeo / Imagen / Memes / Sin medio |
| Desde fecha | Date picker | `min_date` | vacío | No futura |
| Modo Lead Gen | Switch destacado | `only_ig_profile` | `false` | Ayuda: "Analiza 3-5× más anuncios para llegar al límite" |
| Límite | Number + slider | `limit` | `50` | 1-1000; aviso ámbar > 200 |
| Formato | Segmented | `format` | `csv` | |

Comportamiento:
- Opciones y defaults de `/api/options` (nunca hardcodeados salvo etiquetas de traducción).
- Si hay un job en ejecución: el botón dice **"Añadir a la cola"** y muestra la posición/pausa estimada.
- Tras crear → `navigate(/jobs/:id)`.
- Estado del formulario persistido en `localStorage` (último usado).

### 5.3 Lote (`BatchPage`)

- Textarea "Una búsqueda por línea" (dedupe y trim automáticos, contador).
- Mismos filtros que §5.2 (componente `ScrapeFiltersFields` reutilizado, sin campo `query`).
- `pause_seconds` (default 150) con explicación anti-bloqueo.
- Resumen: "3 búsquedas · ~X min estimados" (estimación: `n × (duración media histórica) + (n-1) × pausa`).
- Tras lanzar → vista del lote: lista de jobs con estado, progreso agregado, cancelar todo / cancelar uno, "Explorar resultados fusionados" al terminar.

### 5.4 Detalle de job (`JobDetailPage`)

```
┌ psicologia · ES · instagram · vídeo · Lead Gen       [● Ejecutando]   [Cancelar] [Clonar]┐
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ ● Lanzando ── ● Navegando ── ◉ Recolectando ── ○ Validando ── ○ Exportando ── ○ Hecho   │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ Recolectados 34 / 100  ▓▓▓▓▓▓▓░░░░░░░░░░░░░  34%                     ⏱ 02:41           │
│ ┌─────────────┐┌─────────────┐┌─────────────┐┌─────────────┐┌─────────────┐              │
│ │Iteración    ││Perfiles IG  ││Estancamiento││Reintentos   ││URL búsqueda │              │
│ │ 12 / 50     ││ 34 únicos   ││ 2 / 20      ││ 0           ││ abrir ↗     │              │
│ └─────────────┘└─────────────┘└─────────────┘└─────────────┘└─────────────┘              │
├ Logs  [Todos ▾ DEBUG/INFO/WARN/ERROR]  [🔍 filtrar]  [⤓ descargar] [⏸ auto-scroll] ──────┤
│ 23:41:02 INFO  Search URL: https://www.facebook.com/ads/library/?...                     │
│ 23:41:09 DEBUG Iteration 12: +3 new ads | total=34                                       │
│ ...                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- `useJobEvents(jobId)`: reducer que aplica `snapshot`, `status`, `progress`, `log`, `warning`, `done`. Logs en buffer circular (máx. 5 000 líneas) y renderizado virtualizado.
- Barra de progreso: determinada con `collected/limit`; indeterminada si no hay datos. La barra de "estancamiento" se muestra en ámbar cuando `stagnant/threshold > 0.5` ("Meta no está devolviendo anuncios nuevos").
- `CancelJobDialog`: "Se perderán los anuncios recolectados hasta ahora (el scraper solo guarda al final)".
- Estados finales:
  - `succeeded` → tarjeta verde con nº de anuncios + **[Ver resultados]** `[Descargar]`.
  - `empty` → tarjeta neutra con sugerencias: quitar frase exacta, país `ALL`, ampliar fecha, desactivar Lead Gen.
  - `failed` → tarjeta roja con `error`, últimas líneas de log y **[Reintentar]**; sugerencia "Si se repite, activa modo visible (HEADLESS=False)".
  - `cancelled` → neutra con **[Reintentar]**.
- `aria-live="polite"` en el contador de progreso.

### 5.5 Trabajos (`JobsPage`)

Tabla: estado (badge), búsqueda, filtros resumidos (chips), resultado (nº anuncios / enlace), duración, fecha, acciones (ver, clonar, reintentar, cancelar, borrar). Sección superior "En cola" ordenable solo en visualización (FIFO). Filtro por estado.

### 5.6 Resultados (`ResultsPage`)

Tabla de `ResultFile`: label, badge "IG", formato, filas, tamaño, fecha (relativa + absoluta en tooltip). Acciones: explorar, descargar, borrar (confirmación). Selección múltiple → **[Fusionar y explorar]**. Búsqueda por label y filtros (formato, solo IG).

### 5.7 Explorador (`ResultDetailPage`)

```
┌ psicologia_ig_profiles · 20261109 19:11 · 412 anuncios · 187 anunciantes        [Exportar ▾]┐
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│ [🔍 Buscar en texto, página, usuario…]  Estado ▾  Plataforma ▾  Destino ▾  Desde–Hasta      │
│ ☑ 1 fila por anunciante (ig_username)   ☐ Solo ganadores (> 30 días)   Columnas ▾  [@ Copiar]│
├──┬──────────────────┬──────────────┬────────────┬──────────┬─────────┬──────┬───────────────┤
│▢ │ Anunciante       │ @usuario     │ Inicio     │ Días act.│ Destino │Medio │ Plataformas   │
├──┼──────────────────┼──────────────┼────────────┼──────────┼─────────┼──────┼───────────────┤
│▢ │ Clinic Les Alpes │@cliniclesalp │ 2026-10-08 │ 33       │ [IG]    │ ▶    │ FB · IG       │
│  ...  (virtualizado)                                                                        │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Datos: `useResult(filename)` → `rows` → `enrich()` (memoizado).
- Columnas por defecto: selección, `page_name`, `ig_username` (link a IG + copiar), `start_date`, `days_active`, `landing_type`, medio (icono vídeo/imagen), `platforms`, `status`, `ad_text` (truncado). Ocultas por defecto: `ad_id`, `page_id`, `ad_caption`, `end_date`, URLs.
- Ordenación por cualquier columna; búsqueda global sobre `page_name`, `ig_username`, `ad_text`, `ad_caption`, `landing_page`.
- **Dedupe** por `ig_username` (fallback `page_id`): se conserva el anuncio con `start_date` más antiguo y se añade columna `ads_count` (nº de anuncios del anunciante).
- Clic en fila → `AdDetailSheet` (panel derecho): copy completo, `MediaPreview` (`<video>`/`<img>` con `onError` → placeholder "El enlace del creativo ha caducado" + botón "Ver en Ads Library"), enlaces (IG, landing, snapshot), metadatos, copiar JSON.
- Acciones de selección / vista: copiar `@usuarios` (uno por línea), exportar CSV/JSON de la vista filtrada o de la selección.
- Preferencias (columnas visibles, orden, filtros, dedupe) en `localStorage` por clave `explorer:<label>`.

### 5.8 Dashboard (`DashboardPage`)

- KPIs: scrapes totales, anuncios recolectados (suma de `rows`), último scrape, job activo.
- Tarjeta del job activo (mini `ProgressPanel`) o CTA "Nuevo scrape".
- Últimos 5 resultados con acceso directo.
- Recetas como tarjetas de acción rápida.

### 5.9 Ajustes (`SettingsPage`)

- Solo lectura: `config` de `/api/options` (HEADLESS, MAX_SCROLL_ATTEMPTS, timeouts, OUTPUT_DIR) con nota "se cambian en `backend/config.py`".
- Preferencias locales: tema (claro/oscuro/sistema), notificaciones del navegador, idioma de fechas.
- Gestión de presets (renombrar/borrar).

---

## 6. Enriquecimiento en cliente (`lib/enrich.ts`)

```ts
type LandingType = "instagram" | "whatsapp" | "calendly" | "facebook" | "linktree" | "web" | "none";

interface EnrichedAd extends AdRecord {
  days_active: number | null;   // (end_date ?? hoy) - start_date
  landing_type: LandingType;
  landing_domain: string | null;
  has_video: boolean;
  has_image: boolean;
  is_winner: boolean;           // status ACTIVE && days_active >= winnerThreshold (default 30)
  advertiser_key: string;       // ig_username ?? page_id ?? ad_id
}
```

Reglas de `landing_type` (sobre `landing_page`):

| Patrón | Tipo |
| --- | --- |
| `instagram.com/` | `instagram` |
| `wa.me`, `api.whatsapp.com`, `whatsapp.com` | `whatsapp` |
| `calendly.com` | `calendly` |
| `facebook.com`, `fb.me`, `m.me` | `facebook` |
| `linktr.ee`, `beacons.ai` | `linktree` |
| otra URL | `web` |
| vacío | `none` |

Tests unitarios (Vitest) para `enrich`, dedupe, `exportCsv` y `cliPreview`.

---

## 7. Gestión de estado y datos

| Tipo de estado | Herramienta | Ejemplos |
| --- | --- | --- |
| Servidor | TanStack Query | `["options"]` (staleTime ∞), `["jobs", filtros]`, `["job", id]`, `["results"]`, `["result", filename]` |
| Tiempo real | `EventSource` + `useReducer` | progreso y logs del job |
| Formularios | react-hook-form + zod | scrape, lote |
| UI persistente | `localStorage` | presets, último formulario, columnas, tema |
| UI efímera | `useState` | diálogos, selección de filas |

- Tras `useCreateJob`/`useCancelJob` → invalidar `["jobs"]`.
- En `done` con `result_file` → invalidar `["results"]`.
- `ApiError` centralizado: toast con `detail` y, en desarrollo, `code`.

### 7.1 `useJobEvents`

```ts
function useJobEvents(jobId: string) {
  // 1. new EventSource(`/api/jobs/${jobId}/events`)
  // 2. addEventListener para snapshot | status | progress | log | warning | done
  // 3. dispatch al reducer → { job, logs[], warnings[], connected }
  // 4. onerror: el navegador reconecta solo (envía Last-Event-ID); marcar connected=false
  // 5. en `done`: es.close(); queryClient.setQueryData(["job", jobId], job)
  // 6. cleanup en unmount
}
```

---

## 8. Sistema de diseño

### 8.1 Dirección visual

Herramienta profesional tipo "panel de operaciones": densa en información pero limpia, **oscuro por defecto** con modo claro, acentos azul Meta para acciones e Instagram (gradiente) solo para el modo Lead Gen y badges de IG.

### 8.2 Tokens (`index.css`, Tailwind v4)

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --color-brand-50:  oklch(0.97 0.02 255);
  --color-brand-500: oklch(0.62 0.19 255);   /* azul Meta */
  --color-brand-600: oklch(0.55 0.20 255);

  --color-success: oklch(0.70 0.17 150);
  --color-warning: oklch(0.80 0.16 80);
  --color-danger:  oklch(0.63 0.22 25);

  --radius-card: 0.75rem;
}
```

Colores semánticos de estado de job:

| Estado | Color | Icono |
| --- | --- | --- |
| `queued` / `waiting` | slate | `Clock` / `Hourglass` (con cuenta atrás) |
| `running` | brand | `Loader2` (animado) |
| `succeeded` | success | `CheckCircle2` |
| `empty` | slate | `SearchX` |
| `failed` | danger | `XCircle` |
| `cancelled` | warning | `Ban` |

### 8.3 Convenciones

- Componentes de `components/ui` no contienen lógica de negocio.
- Espaciado en múltiplos de 4; tablas `text-sm`, logs `font-mono text-xs`.
- Todo texto visible en español; centralizado en `src/i18n/es.ts` (permite traducir más adelante).
- Fechas: `date-fns` con locale `es`; mostrar relativas ("hace 2 h") con absoluta en tooltip.

---

## 9. Accesibilidad y rendimiento

- Componentes Radix (foco, teclado, ARIA) · contraste WCAG AA en ambos temas · foco visible.
- `aria-live` en progreso y toasts; `LogConsole` con `role="log"`.
- Tabla y logs virtualizados (TanStack Virtual) → fluido con 10 k filas / 5 k líneas.
- *Code splitting* por ruta (`React.lazy`) — el explorador es la página más pesada.
- Objetivos: bundle inicial < 250 KB gzip; interacción de tabla < 100 ms con 1 000 filas.

---

## 10. Testing

| Nivel | Herramienta | Cobertura mínima |
| --- | --- | --- |
| Unitario | Vitest | `enrich`, dedupe, `exportCsv`, `cliPreview`, schemas zod, reducer de `useJobEvents` |
| Componentes | Testing Library | `ScrapeForm` (validación y mapeo), `LogConsole`, `AdsTable` (filtros/dedupe) |
| E2E (opcional) | Playwright | Flujo: nuevo scrape (API con CLI falso) → progreso → resultados → exportar |

---

## 11. Checklist de entrega del frontend

- [ ] `npm run build`, `lint`, `typecheck` y `test` en verde.
- [ ] Tipos de API regenerados (`npm run gen:api`) y sin `any` en `api/`.
- [ ] Todas las páginas con estados de carga, vacío y error.
- [ ] Probado en Chrome y Edge (Windows), temas claro y oscuro, 1024 px y 1440 px.
- [ ] El flujo completo funciona servido por FastAPI desde `frontend/dist` (un solo puerto).
