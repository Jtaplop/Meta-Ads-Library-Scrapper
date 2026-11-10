# SPEC-API — Capa puente FastAPI (`backend/api/`)

> Parte de [ROADMAP.md](./ROADMAP.md). Define la API que conecta el frontend con el CLI existente **sin modificar el código Python actual**.

---

## 1. Principios

1. **El CLI es la fuente de verdad.** La API solo construye argumentos, lanza `python main.py`, lee su salida y lee los ficheros de `output/`.
2. **Un job = un subproceso.** Aislamiento de logs, memoria y fallos.
3. **Ejecución secuencial.** Un único worker procesa la cola (anti rate-limit de Meta).
4. **Solo local.** Bind a `127.0.0.1`, sin autenticación, CORS restringido al dev server de Vite.
5. **Contrato tipado.** Todos los modelos en Pydantic v2 → OpenAPI → tipos TS generados.

---

## 2. Configuración (`settings.py`)

| Variable | Valor por defecto | Descripción |
| --- | --- | --- |
| `BACKEND_DIR` | `Path(__file__).resolve().parents[1]` | Carpeta `backend/` (cwd del subproceso) |
| `CLI_ENTRY` | `BACKEND_DIR / "main.py"` | Script a ejecutar |
| `OUTPUT_DIR` | `BACKEND_DIR / config.OUTPUT_DIR` | Carpeta de resultados (absoluta) |
| `DATA_DIR` | `BACKEND_DIR / "api" / "data"` | `jobs.json`, `logs/`, `presets.json` |
| `PYTHON_EXE` | `sys.executable` | Mismo intérprete/venv que la API |
| `JOB_PAUSE_SECONDS` | `150` | Pausa entre jobs consecutivos de la cola (regla 2-3 min) |
| `MAX_LOG_LINES_IN_MEMORY` | `5000` | Buffer circular por job para *replay* SSE |
| `HOST` / `PORT` | `127.0.0.1` / `8000` | |
| `CORS_ORIGINS` | `["http://localhost:5173", "http://127.0.0.1:5173"]` | |
| `FRONTEND_DIST` | `<repo>/frontend/dist` | Si existe, se sirve como SPA en `/` (modo producción) |

Todas sobreescribibles por variables de entorno con prefijo `MAS_` (p. ej. `MAS_JOB_PAUSE_SECONDS=180`).

---

## 3. Modelos (`schemas.py`)

### 3.1 `ScrapeRequest`

```python
class SearchMode(str, Enum):
    keyword = "keyword"
    page_url = "page_url"
    slug = "slug"

class ScrapeRequest(BaseModel):
    mode: SearchMode
    query: str = Field(min_length=1, max_length=500)       # keyword | URL | slug
    country: str = "ALL"                                    # ISO-2 en mayúsculas o "ALL"
    status: Literal["active", "inactive", "all"] = "active"
    platform: Literal["instagram", "facebook", "messenger", "audience_network"] | None = None
    media_type: Literal["all", "video", "image", "memes", "none"] = "all"
    min_date: date | None = None
    exact: bool = False
    only_ig_profile: bool = False
    format: Literal["csv", "json"] = "csv"
    limit: int = Field(50, ge=1, le=1000)
```

Validaciones extra:
- `country`: `^[A-Z]{2}$|^ALL$` (normalizar con `.upper()`).
- `mode == page_url` → `query` debe empezar por `https://` y contener `facebook.com`.
- `exact` solo tiene efecto con `mode == keyword` (se acepta pero la UI lo deshabilita).
- Los `Literal` deben coincidir con `config.VALID_*`; un test verifica la igualdad para detectar desajustes si `config.py` cambia.

### 3.2 `Job`

```python
class JobStatus(str, Enum):
    queued = "queued"
    waiting = "waiting"        # en la pausa anti-bloqueo antes de arrancar
    running = "running"
    succeeded = "succeeded"    # exit 0 + fichero generado
    empty = "empty"            # exit 0 + "No ads matched the criteria."
    failed = "failed"          # exit != 0 (salvo cancelación)
    cancelled = "cancelled"

class JobPhase(str, Enum):
    starting = "starting"      # proceso lanzado
    browser = "browser"        # "Browser launched"
    navigating = "navigating"  # "Search URL:" / "Navigation successful"
    collecting = "collecting"  # iteraciones de scroll
    validating = "validating"  # "Collected N unique raw ads" / "Validated"
    exporting = "exporting"    # "exporting as CSV|JSON"
    finished = "finished"

class JobProgress(BaseModel):
    collected: int = 0             # total acumulado (Iteration ...: total=N)
    limit: int
    iteration: int = 0
    max_iterations: int = 50       # MAX_SCROLL_ATTEMPTS
    stagnant: int = 0
    stagnant_threshold: int | None = None
    unique_ig_profiles: int | None = None
    retries: int = 0
    raw_unique: int | None = None  # "Collected N unique raw ads..."
    validated: int | None = None
    discarded: int | None = None

class Job(BaseModel):
    id: str                        # uuid4 hex corto
    batch_id: str | None = None
    request: ScrapeRequest
    command: list[str]             # argumentos exactos (para mostrar en UI)
    status: JobStatus
    phase: JobPhase | None = None
    progress: JobProgress
    search_url: str | None = None
    result_file: str | None = None # nombre de fichero dentro de output/
    error: str | None = None       # última línea ERROR o motivo
    exit_code: int | None = None
    pid: int | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
```

### 3.3 `ResultFile`

```python
class ResultFile(BaseModel):
    filename: str                  # "psicologia_ig_profiles_20261109_191111.csv"
    label: str                     # "psicologia"
    ig_profiles_only: bool         # sufijo "_ig_profiles"
    format: Literal["csv", "json"]
    created_at: datetime           # del timestamp del nombre (fallback: mtime)
    size_bytes: int
    rows: int | None               # contado de forma perezosa y cacheado por (mtime, size)
    job_id: str | None             # si lo generó un job de la API
```

Regex del nombre (de `main.py`): `^(?P<label>.+?)(?P<ig>_ig_profiles)?_(?P<ts>\d{8}_\d{6})\.(?P<fmt>csv|json)$`.

### 3.4 `AdRecord` (filas devueltas al frontend)

Mismo esquema que `models.ad.Ad`, normalizado para ambos formatos:

| Campo | Tipo JSON | Normalización desde CSV |
| --- | --- | --- |
| `ad_id` | string | — |
| `page_id`, `page_name`, `ad_text`, `ad_caption` | string \| null | `""` → `null` |
| `start_date`, `end_date` | `"YYYY-MM-DD"` \| null | `""` → `null` |
| `status` | `"ACTIVE"` \| `"INACTIVE"` \| null | |
| `image_url`, `video_url`, `landing_page`, `snapshot_url` | string \| null | |
| `ig_username` | string \| null | |
| `platforms` | string[] | `"FACEBOOK, INSTAGRAM"` → `["FACEBOOK","INSTAGRAM"]` |

> Se usa `csv` de la stdlib con `encoding="utf-8-sig"` (el exportador escribe BOM). IDs siempre como `str` para no perder precisión en JS (los `ad_id` superan 2^53).

### 3.5 `BatchRequest`

```python
class BatchRequest(BaseModel):
    queries: list[str] = Field(min_length=1, max_length=50)   # una por elemento
    base: ScrapeRequest            # filtros comunes (se ignora base.query)
    pause_seconds: int = Field(150, ge=0, le=1800)
```

### 3.6 `OptionsResponse`

```python
class OptionsResponse(BaseModel):
    statuses: list[str]            # config.VALID_ACTIVE_STATUSES
    platforms: list[str]           # config.VALID_PLATFORMS
    media_types: list[str]         # config.VALID_MEDIA_TYPES
    defaults: dict                 # country, status, media_type, limit=50, format="csv"
    countries: list[CountryGroup]  # [{group: "Mercado Hispano", items: [{code:"ES", name:"España"}...]}]
    recipes: list[Recipe]          # ver §7
    limits: dict                   # {recommended_min: 50, recommended_max: 200, hard_max: 1000}
    config: dict                   # solo lectura: HEADLESS, MAX_SCROLL_ATTEMPTS, SCROLL_PAUSE_SECONDS...
```

---

## 4. Endpoints

Prefijo común: `/api`. Errores con formato `{"detail": "...", "code": "..."}`.

### 4.1 Sistema

| Método | Ruta | Respuesta | Notas |
| --- | --- | --- | --- |
| GET | `/health` | `{status:"ok", version, python, playwright_ok, output_dir, queue_size, active_job_id}` | `playwright_ok` comprueba que `playwright` es importable |
| GET | `/options` | `OptionsResponse` | Cacheable |

### 4.2 Jobs

| Método | Ruta | Body / Query | Respuesta | Notas |
| --- | --- | --- | --- | --- |
| POST | `/jobs` | `ScrapeRequest` | `201 Job` | Encola. Si no hay job activo y no aplica pausa, arranca al instante |
| GET | `/jobs` | `?status=&limit=50&offset=0` | `{items: Job[], total}` | Orden: `created_at` desc |
| GET | `/jobs/{id}` | — | `Job` | `404 job_not_found` |
| POST | `/jobs/{id}/cancel` | — | `Job` | `queued/waiting` → se retira; `running` → kill árbol. `409` si ya terminó |
| POST | `/jobs/{id}/retry` | — | `201 Job` | Crea un job nuevo con la misma `request` |
| DELETE | `/jobs/{id}` | — | `204` | Solo terminados; borra log. **No** borra el fichero de resultados |
| GET | `/jobs/{id}/logs` | `?format=text\|json` | log completo | Desde `data/logs/<id>.log` |
| GET | `/jobs/{id}/events` | — | `text/event-stream` | Ver §5 |
| GET | `/jobs/events` | — | `text/event-stream` | Stream global: cambios de estado de cualquier job (para el indicador del layout) |

### 4.3 Lotes

| Método | Ruta | Body | Respuesta |
| --- | --- | --- | --- |
| POST | `/batches` | `BatchRequest` | `201 {id, job_ids: string[]}` |
| GET | `/batches/{id}` | — | `{id, jobs: Job[], status agregado, progress agregado}` |
| POST | `/batches/{id}/cancel` | — | cancela todos los jobs pendientes y el activo |

### 4.4 Resultados

| Método | Ruta | Query | Respuesta | Notas |
| --- | --- | --- | --- | --- |
| GET | `/results` | `?q=&format=&ig_only=` | `ResultFile[]` | Escanea `output/` (incluye ficheros generados por CLI) |
| GET | `/results/{filename}` | — | `{file: ResultFile, rows: AdRecord[]}` | Todas las filas (volúmenes esperados < 10 k) |
| GET | `/results/{filename}/download` | — | `FileResponse` | `Content-Disposition: attachment` |
| DELETE | `/results/{filename}` | — | `204` | Confirmación en UI |
| POST | `/results/merge` | `{filenames: string[], dedupe_by: "ad_id"\|"ig_username"\|"page_id"}` | `{rows: AdRecord[]}` | Fusión en memoria (no escribe fichero) |

**Seguridad de `filename`:** validar con el regex de §3.3, resolver `OUTPUT_DIR / filename` y comprobar que `resolved.parent == OUTPUT_DIR.resolve()`; si no → `400 invalid_filename`.

### 4.5 Presets (opcional, Fase 5)

`GET/POST/DELETE /presets` persistidos en `data/presets.json`. (Alternativa: `localStorage` en cliente — elegir uno; recomendado `localStorage` para el MVP.)

---

## 5. Streaming SSE (`/jobs/{id}/events`)

### 5.1 Formato

```
event: <tipo>
id: <secuencia incremental>
data: <json>

```

- Al conectar se envía un `snapshot` con el `Job` completo y luego el *replay* de las últimas líneas de log del buffer (o desde `Last-Event-ID` si el navegador reconecta).
- Heartbeat `: ping` cada 15 s para evitar cortes de proxies.
- El stream se cierra tras enviar `done`.

### 5.2 Tipos de evento

| Evento | `data` | Cuándo |
| --- | --- | --- |
| `snapshot` | `Job` | Al conectar |
| `status` | `{status, phase?, started_at?, finished_at?}` | Cambio de estado o fase |
| `progress` | `JobProgress` | Cada vez que el parser actualiza contadores |
| `log` | `{ts, level, message, raw}` | Cada línea de stdout/stderr (sin ANSI) |
| `warning` | `{kind: "retry"\|"validation"\|"navigation", message}` | Líneas WARNING relevantes |
| `done` | `Job` (final) | Proceso terminado y estado final calculado |

---

## 6. Runner y parser de logs

### 6.1 Construcción del comando (`command.py`)

```python
def build_command(req: ScrapeRequest) -> list[str]:
    args = [PYTHON_EXE, str(CLI_ENTRY)]          # main.py (o fake_main.py en tests)
    flag = {"keyword": "--keyword", "page_url": "--page-url", "slug": "--slug"}[req.mode]
    args += [flag, req.query]
    args += ["--country", req.country, "--status", req.status,
             "--media", req.media_type, "--format", req.format,
             "--limit", str(req.limit), "--verbose"]          # -v SIEMPRE (progreso)
    if req.platform:        args += ["--platform", req.platform]
    if req.min_date:        args += ["--min-date", req.min_date.isoformat()]
    if req.exact:           args += ["--exact"]
    if req.only_ig_profile: args += ["--only-ig-profile"]
    return args
```

Se usan siempre las **opciones largas** y lista de argumentos (`shell=False`) → sin riesgo de inyección.

### 6.2 Ejecución (`runner.py`)

```python
proc = subprocess.Popen(
    cmd,
    cwd=BACKEND_DIR,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True, encoding="utf-8", errors="replace", bufsize=1,
    env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1"},
    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    start_new_session=(os.name != "nt"),
)
```

- Dos hilos (`threading.Thread`) leen `stdout` y `stderr` línea a línea y publican en el loop con `loop.call_soon_threadsafe(queue.put_nowait, (stream, line))`.
- **No** usar `asyncio.create_subprocess_exec`: en Windows falla con `SelectorEventLoop` (p. ej. `uvicorn --reload`).
- Cancelación:
  - Windows: `subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"])` (mata Python + Chromium hijos).
  - POSIX: `os.killpg(os.getpgid(pid), signal.SIGTERM)` → a los 5 s `SIGKILL`.
- Al apagar la API (`lifespan` shutdown): cancelar el job activo y marcar `queued` como `cancelled`.
- Al arrancar: cualquier job persistido como `running`/`waiting` pasa a `failed` con `error="API reiniciada"`.

### 6.3 Parser (`log_parser.py`)

1. Quitar ANSI: `re.sub(r"\x1b\[[0-9;]*[A-Za-z]", "", line)`.
2. Separar formato Loguru: `^(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \| (?P<level>\w+)\s*\| (?P<msg>.*)$`. Si no casa → `level="INFO"`, `msg=line` (p. ej. el `typer.echo` final o trazas).
3. Aplicar reglas sobre `msg` (en orden; varias pueden casar):

| Regex sobre `msg` | Origen | Efecto |
| --- | --- | --- |
| `^Starting scrape \|` | `main.py` | `phase=starting` |
| `^Browser launched` | `ads_scraper.py` | `phase=browser` |
| `^Search URL: (?P<url>\S+)` | `ads_scraper.py` | `search_url=url`, `phase=navigating` |
| `^Navigation successful\|^Navigation aborted by redirect` | `ads_scraper.py` | `phase=navigating` (ok) |
| `^Cookie banner dismissed` | `ads_scraper.py` | solo log |
| `^Retry attempt (?P<n>\d+)` | `_log_retry` | `retries=n`, evento `warning(retry)` |
| `^Scroll iteration (?P<i>\d+)/(?P<max>\d+)` | `pagination.py` | `phase=collecting`, `iteration=i`, `max_iterations=max` |
| `^Iteration (?P<i>\d+): \+(?P<new>\d+) new ads \| total=(?P<total>\d+)` | `pagination.py` | `collected=total` |
| `^No new ads on iteration \d+ \(stagnant=(?P<s>\d+)/(?P<t>\d+)\)` | `pagination.py` | `stagnant=s`, `stagnant_threshold=t` |
| `total unique profiles so far: (?P<n>\d+)` | `ads_scraper.py` | `unique_ig_profiles=n` |
| `^Stopping pagination: (?P<reason>.+)` | `pagination.py` | log informativo (motivo de parada) |
| `^Collected (?P<n>\d+) unique raw ads` | `ads_scraper.py` | `raw_unique=n`, `phase=validating` |
| `^Validated (?P<v>\d+) ads \(discarded (?P<d>\d+)\)` | `ads_scraper.py` | `validated=v`, `discarded=d` |
| `^Validation failed for ad_id` | `ads_scraper.py` | `warning(validation)` |
| `^Collected (?P<n>\d+) ads .* exporting as (?P<fmt>CSV\|JSON)` | `main.py` | `phase=exporting` |
| `^No ads matched the criteria` | `main.py` | marca `empty` |
| `^Done\. Output written to: (?P<path>.+)$` | `main.py` (stdout) | `result_file=Path(path).name`, `phase=finished` |
| `level == "ERROR"` | cualquiera | `error=msg` |

4. Cálculo del estado final al terminar el proceso:

| Condición | Estado |
| --- | --- |
| Cancelado por usuario | `cancelled` |
| `exit_code == 0` y `result_file` | `succeeded` |
| `exit_code == 0` y "No ads matched" | `empty` |
| `exit_code == 130` | `cancelled` |
| Resto | `failed` (con `error` = última línea ERROR o últimas 20 líneas de stderr) |

> [!IMPORTANT]
> El parser debe ser **tolerante**: una línea que no casa con ninguna regla se emite solo como `log`. Si Meta o el código cambian los mensajes, la UI degrada a "progreso indeterminado" pero sigue funcionando.

Fixtures de test: capturar logs reales (`python main.py ... -v 2> fixture.log`) y guardarlos en `api/tests/fixtures/` para tests de regresión del parser.

---

## 7. Recetas predefinidas (servidas en `/options`)

Derivadas de `backend/docs/Own Plugin.md`:

| id | Nombre | Parámetros |
| --- | --- | --- |
| `ig_lead_gen` | Captación de perfiles IG | `country=ES, platform=instagram, media_type=video, status=active, exact=true, only_ig_profile=true, format=csv, limit=100` |
| `winning_ads` | Anuncios ganadores | `country=ES, status=active, media_type=video, exact=true, format=csv, limit=150` (en el explorador: ordenar por `start_date` asc + badge "ganador") |
| `pain_sweep` | Barrido por dolores | Lote: `queries=["ansiedad","autoestima","terapia online"]`, `platform=instagram, media_type=video, only_ig_profile=true, limit=100` |
| `external_funnels` | Embudos externos / WhatsApp | `country=ES, status=active, only_ig_profile=false, format=csv, limit=100` (en el explorador: filtro por tipo de destino) |

---

## 8. Persistencia

```
backend/api/data/           # git-ignored
├── jobs.json               # lista de Job (escritura atómica: tmp + os.replace)
├── batches.json
└── logs/
    └── <job_id>.log        # salida completa, sin ANSI
```

- Escritura de `jobs.json` en cada cambio de estado (no en cada línea de log).
- Retención: conservar los últimos 200 jobs; los logs de jobs eliminados se borran.

---

## 9. Servir el frontend (producción)

```python
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        return FileResponse(FRONTEND_DIST / "index.html")   # tras registrar /api/*
```

Arranque: `cd backend; python -m uvicorn api.server:app --host 127.0.0.1 --port 8000`.

---

## 10. Tests (`backend/api/tests/`)

| Test | Qué verifica |
| --- | --- |
| `test_command.py` | `ScrapeRequest` → argumentos exactos para cada combinación |
| `test_options.py` | Los `Literal` de `schemas.py` == `config.VALID_*` |
| `test_log_parser.py` | Fixtures reales → secuencia de eventos y `JobProgress` esperados |
| `test_jobs.py` | Cola FIFO, pausa (con reloj falso), cancelación en `queued`/`running`, estados finales |
| `test_results.py` | Parseo de nombres, normalización CSV/JSON, `rows` contados, *path traversal* rechazado |
| `test_api_e2e.py` | Con `CLI_ENTRY` apuntando a `fake_main.py` (emite logs reales y escribe un CSV): POST → SSE → `done` → GET result |

Ejecución: `cd backend; python -m pytest api/tests -q`.
