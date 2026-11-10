<#
.SYNOPSIS
    Production launcher for Meta Ads Library Scrapper.
.DESCRIPTION
    Builds the frontend if dist/ does not exist or if -Rebuild is passed,
    and starts the FastAPI backend which serves both /api/* and the compiled SPA from frontend/dist.
.PARAMETER Rebuild
    Forces a rebuild of the frontend SPA even if frontend/dist already exists.
.PARAMETER NoBrowser
    Prevents automatically opening the default browser to http://127.0.0.1:8000.
#>

param(
    [switch]$Rebuild,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"

# Resolve repo root
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Meta Ads Library Scrapper - Production Mode    " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Check Python virtual environment in backend/venv
$PythonExe = Join-Path $RepoRoot "backend\venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    Write-Host "[WARNING] backend/venv/Scripts/python.exe not found. Falling back to system 'python'." -ForegroundColor Yellow
    $PythonExe = "python"
} else {
    Write-Host "[OK] Found backend virtual environment: $PythonExe" -ForegroundColor Green
}

# 2. Check frontend/dist and build if necessary or requested
$FrontendDir = Join-Path $RepoRoot "frontend"
$FrontendDist = Join-Path $FrontendDir "dist"

$NeedsBuild = $Rebuild -or (-not (Test-Path $FrontendDist))

if ($NeedsBuild) {
    Write-Host "[INFO] Building frontend SPA (npm run build)..." -ForegroundColor Yellow
    if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
        Write-Host "[INFO] Installing frontend dependencies first..." -ForegroundColor Cyan
        Push-Location $FrontendDir
        try {
            npm install
            if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
        }
        finally {
            Pop-Location
        }
    }

    Push-Location $FrontendDir
    try {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            throw "frontend build failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
    Write-Host "[OK] Frontend build successfully completed in frontend/dist." -ForegroundColor Green
} else {
    Write-Host "[OK] Frontend dist/ already exists. (Use -Rebuild to force recompilation)." -ForegroundColor Green
}

# 3. Open browser if requested
if (-not $NoBrowser) {
    Write-Host "[INFO] Opening default browser at http://127.0.0.1:8000 ..." -ForegroundColor Cyan
    Start-Process "http://127.0.0.1:8000"
}

Write-Host ""
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host " Starting production server:" -ForegroundColor Cyan
Write-Host "   - URL: http://127.0.0.1:8000" -ForegroundColor White
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host " Press Ctrl+C to stop the server." -ForegroundColor Yellow
Write-Host ""

# 4. Start FastAPI backend (which serves /api/* and frontend/dist static files)
Push-Location (Join-Path $RepoRoot "backend")
try {
    & $PythonExe -m uvicorn api.server:app --host 127.0.0.1 --port 8000
}
finally {
    Pop-Location
    Write-Host "[OK] Production server stopped." -ForegroundColor Green
}
