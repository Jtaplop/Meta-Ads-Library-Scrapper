# Meta Ads Library Scraper & Lead Gen UI

A fast, no-nonsense web interface for scraping the Meta Ads Library. Built specifically for client acquisition, competitor monitoring, and extracting verified Instagram profiles from active ads.

<!-- YOUTUBE DEMO VIDEO -->
<!-- Simply replace the video URL below with your YouTube link: -->
<p align="center">
  <a href="https://www.youtube.com/watch?v=mwIELD710-o">
    <img src="https://img.youtube.com/vi/mwIELD710-o/maxresdefault.jpg" alt="Watch Demo Video" width="85%" style="border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
  </a>https://youtu.be/
</p>

---

## Quick Navigation
1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Key Features](#key-features)
4. [Pro Tips for Lead Generation](#pro-tips-for-lead-generation)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before running the application, make sure you have installed:
* **Python 3.11+**
* **Node.js 20+**

If you haven't installed the project dependencies yet, open a PowerShell terminal in the project root:

```powershell
# 1. Backend environment
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-api.txt
playwright install chromium
cd ..

# 2. Frontend dependencies
cd frontend
npm install
cd ..
```

---

## Quick Start

You don't need to run separate commands or open multiple terminals. Two automated scripts are ready in the `scripts/` folder:

### Regular Use (One-click launch)
Compiles the interface and opens your default browser at `http://127.0.0.1:8000`:
```powershell
.\scripts\start.ps1
```

### Development Mode (Hot-Reload)
Runs Vite HMR on port `5173` and FastAPI on port `8000`:
```powershell
.\scripts\dev.ps1
```

> **Windows PowerShell Note:** If script execution is restricted on your machine, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` once in your terminal session before launching the scripts.

---

## Key Features

* **Visual Scraper (`/scrape/new`)**: Search by keyword, Facebook Page URL, or brand username. Filter by country, media type (videos/images), platforms, and minimum start date.
* **Lead Gen Mode (`--only-ig-profile`)**: Automatically discards generic websites and WhatsApp links, retaining only advertisers sending paid traffic directly to their Instagram profile.
* **Smart Presets**: One-click setups for common workflows:
  * *Instagram Lead Gen* (coaches, clinics, personal brands)
  * *Winning Ads* (campaigns running > 30 days)
  * *Pain-Point Sweeps* (symptom-based batch searches)
  * *External Funnels* (WhatsApp, Calendly, landing pages)
* **Live Cockpit (`/jobs/:id`)**: Real-time progress bar, scroll counters, unique IG handles discovered, and live terminal logs via Server-Sent Events. Cancel runs cleanly without orphan Chrome processes.
* **Batch Runner (`/scrape/batch`)**: Queue up multiple keywords sequentially with a safe cooldown timer between requests to prevent Meta rate limits.
* **Results Explorer (`/results/:filename`)**:
  * 1-Click advertiser deduplication ("1 row per advertiser").
  * Copy all `@usernames` directly to clipboard for your outreach CRM.
  * Export filtered views to Excel-compatible CSV (UTF-8 BOM) or clean JSON.
  * Preview creatives directly inside the app, with fallback links to the live Meta Library if CDN links expire.

---

## Pro Tips for Lead Generation

1. **Batch size:** Keep each search limit between **50 and 150 ads**. Scraping hundreds of ads at once increases the risk of temporary IP rate-limits from Meta.
2. **Finding winning offers:** Sort the results table by `Days Active` or use the "Winning Ads" toggle. If a business has had an ad active for 60+ days, it is consistently profitable for them.
3. **Pain words instead of titles:** Instead of searching for `"psychologist"`, search for the problem they solve (e.g., `"anxiety"`, `"burnout"`, `"insomnia"`).

---

## Troubleshooting

* **Script won't start in PowerShell?**
  Run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
* **Zero results returned?**
  Make sure your keyword isn't too narrow. Try switching Country to `ALL` or disabling the Exact Phrase checkbox.
* **Browser crashes on startup?**
  Re-run `playwright install chromium` inside your active virtual environment.
