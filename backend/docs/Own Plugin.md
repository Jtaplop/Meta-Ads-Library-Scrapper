# Guía de Uso Avanzado: Meta Ads Library Scraper (Lead Gen Edition)

Este scraper extrae anuncios directamente del tráfico interno (XHR/GraphQL) de la Biblioteca de Anuncios de Meta sin usar API oficial ni cuentas logueadas[cite: 1]. Con la actualización, filtra en caliente perfiles de Instagram listos para prospección[cite: 5, 7].

---

## 1. Tabla de Parámetros y Filtros (CLI)

Obligatorio elegir **uno** de los tres modos de búsqueda (`-k`, `-s` o `-p`). El resto son filtros combinables:

| Parámetro | Corto | Valores aceptados | Default | Uso estratégico |
| :--- | :--- | :--- | :--- | :--- |
| `--keyword` | `-k` | Texto libre | `None` | Busca palabras en el copy o nombre del anunciante. |
| `--slug` | `-s` | Username de FB | `None` | Espía todos los anuncios de un competidor concreto (`--slug clinicabiolaser`). |
| `--page-url` | `-p` | URL de página FB | `None` | Igual que `--slug`, pero pegando la URL completa de Facebook. |
| `--country` | `-c` | Código ISO-2 o `ALL` | `ALL` | Filtra por el país donde se muestra el anuncio (ver tabla de regiones abajo). |
| `--status` | `-st` | `active`, `inactive`, `all` | `active` | Usa `active` para leads que están gastando dinero hoy. |
| `--platform` | `-pl` | `instagram`, `facebook`, `messenger`, `audience_network` | `None` | Restringe dónde se publica el anuncio. |
| `--media` | `-m` | `video`, `image`, `memes`, `none`, `all` | `all` | Usa `video` para captar marcas que invierten en Reels/vídeo-venta. |
| `--min-date` | `-md` | `YYYY-MM-DD` | `None` | Filtra anuncios lanzados a partir de una fecha (ej. `2025-11-01`). |
| `--exact` | `-e` | *Flag (sin valor)* | `False` | Fuerza coincidencia exacta de frase (`"terapia online"` en vez de palabras sueltas). |
| `--only-ig-profile`| `-ig` | *Flag (sin valor)* | `False` | **Modo Lead Gen:** Descarta webs/WhatsApp y guarda solo anuncios con botón *"Ir al perfil de IG"*. |
| `--format` | `-f` | `csv`, `json` | `json` | Usa `csv` para abrir en Excel/Sheets; `json` para automatizaciones. |
| `--limit` | `-l` | Número entero | `50` | Cantidad de anuncios **válidos** a recolectar antes de parar. |
| `--verbose` | `-v` | *Flag (sin valor)* | `False` | Muestra en consola qué hace el navegador en cada scroll. |

---

## 2. Regiones y Códigos de País (`--country` / `-c`)

Meta utiliza el estándar **ISO 3166-1 alpha-2** (en mayúsculas)[cite: 1, 7]. Los más rentables por mercado:

### Mercado Hispano
* **España:** `ES`
* **México:** `MX`
* **Colombia:** `CO`
* **Argentina:** `AR`
* **Chile:** `CL`
* **Perú:** `PE`
* **Uruguay / Panamá / Costa Rica:** `UY` / `PA` / `CR`

### Mercado Anglosajón (High-Ticket)
* **Estados Unidos:** `US`
* **Reino Unido:** `GB` *(Nota: no uses UK, el código ISO es GB)*
* **Canadá:** `CA`
* **Australia:** `AU`
* **Irlanda:** `IE`

### Europa Occidental y Otros Mercados
* **Alemania / Austria / Suiza:** `DE` / `AT` / `CH`
* **Francia / Italia / Portugal:** `FR` / `IT` / `PT`
* **Países Bajos / Bélgica / Suecia:** `NL` / `BE` / `SE`
* **Emiratos Árabes Unidos (Dubái):** `AE`
* **Brasil:** `BR`
* **Todo el mundo (Sin filtro geográfico):** `ALL`

---

## 3. Recetas de Comandos para Sacar el Máximo Provecho

### A. Captación pura de perfiles de Instagram (Tráfico a Perfil)
Extrae anunciantes en España que están pagando anuncios en vídeo en Instagram con el botón *"Ir al perfil"* (típico de infoproductores, psicólogos, coaches, clínicas y marcas personales):
```bash
python main.py -k "psicologia" -c ES -pl instagram -m video -st active --min-date 2025-11-01 --exact --only-ig-profile -f csv -l 100
```

### B. Detectar "Anuncios Ganadores" (Llevan meses activos)
Si buscas anuncios con `-st active` pero NO pones `--min-date` (o miras en el CSV los que tienen `start_date` de hace más de 30-60 días), encontrarás los anuncios que le están dando retorno positivo al cliente:
```bash
python main.py -k "clinica dental" -c ES -st active -m video --exact -f csv -l 150
```
*Truco en el CSV:* Ordena la columna `start_date` de más antigua a más reciente[cite: 1]. Si un anuncio sigue `ACTIVE` tras 3 meses, ese negocio tiene presupuesto y el embudo le funciona[cite: 1].

### C. Barrido por problemas / dolores del cliente (En vez de profesiones)
Muchos profesionales no ponen "psicólogo" en su anuncio, sino el síntoma que resuelven. Haz pasadas por palabras de dolor:
```bash
python main.py -k "ansiedad" -c ES -pl instagram -m video --only-ig-profile -f csv -l 100
python main.py -k "autoestima" -c ES -pl instagram -m video --only-ig-profile -f csv -l 100
python main.py -k "terapia online" -c ES -pl instagram -m video --exact --only-ig-profile -f csv -l 100
```

### D. Espiar embudos que van a Landing Page externa o WhatsApp
Si quitas `--only-ig-profile`, el scraper recogerá todo tipo de destinos en `landing_page`[cite: 1, 7]:
```bash
python main.py -k "reformas integrales" -c ES -st active -f csv -l 100
```
* En el CSV podrás filtrar `landing_page` por:
  * `wa.me` o `api.whatsapp.com` → Negocios que cierran por WhatsApp (ideales para ofrecerles chatbots de cualificación).
  * `calendly.com` → Negocios que agendan llamadas directamente.
  * Dominios propios (`.com` / `.es`) → Para auditar sus embudos web.

---

## 4. Columnas Clave del Archivo Exportado (`output/`)

| Columna | Qué contiene y cómo usarla |
| :--- | :--- |
| **`ig_username`** | **NUEVA:** El `@usuario` limpio (ej. `psicologa.ana`). Lista para importar en herramientas de prospección o CRM. |
| **`landing_page`** | URL limpia (sin el envoltorio `l.facebook.com`). Si usaste `-ig`, será `https://www.instagram.com/usuario/`. |
| **`page_name`** | Nombre comercial de la página. Útil para personalizar la primera línea de tu mensaje. |
| **`ad_text`** | El copy completo del anuncio. Léelo o pásalo por un LLM para mencionar su oferta exacta al prospectar. |
| **`video_url` / `image_url`** | Enlace directo al archivo MP4 o JPG del creativo para descargarlo o analizarlo. |
| **`start_date`** | Fecha en que arrancó la campaña. Mide cuánto tiempo lleva invirtiendo. |
| **`snapshot_url`** | Enlace directo al anuncio dentro de la web de Meta Ads Library. |

---

## 5. Reglas Operativas y Límites (Anti-Bloqueos)

1. **Lotes de 100 a 200 anuncios:** Con `--only-ig-profile` activado, por cada 100 perfiles válidos el scraper analiza entre 300 y 500 anuncios internos. Mantén `--limit` entre `50` y `200` por ejecución.
2. **Pausa entre comandos:** Deja entre **2 y 3 minutos** entre búsquedas pesadas para evitar que Meta aplique *rate-limit* temporal a tu IP[cite: 1].
3. **Deduplicación de anunciantes en Excel:** El scraper deduplica por `ad_id` (anuncio único)[cite: 1, 3]. Si un mismo psicólogo tiene 5 anuncios activos, aparecerá 5 veces con distinto `ad_id`. En Excel/Google Sheets, aplica **"Quitar duplicados"** sobre la columna **`ig_username`** (o `page_id`) para quedarte con 1 fila por cliente único[cite: 1, 4].
4. **Modo visible para depurar:** Si en algún momento una búsqueda devuelve `0` resultados extraños, abre `config.py`, cambia `HEADLESS: bool = True` a `False` y vuelve a lanzar el comando para ver en pantalla qué está mostrando Meta[cite: 1, 6].
````[cite: 1, 3, 4, 5, 6, 7]