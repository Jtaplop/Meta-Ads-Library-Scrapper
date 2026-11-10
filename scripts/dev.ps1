<#
.SYNOPSIS
    Starts the development environment for Meta Ads Library Scrapper.
.DESCRIPTION
    Resolves the repository root, checks backend venv and frontend node_modules,
    and starts both the FastAPI backend (with --reload) and the Vite dev server concurrently
    with colored output and clean Ctrl+C shutdown.
#>

$ErrorActionPreference = "Stop"

# Resolve repo root
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   Meta Ads Library Scrapper - Development Mode   " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# 1. Check Python virtual environment in backend/venv
$PythonExe = Join-Path $RepoRoot "backend\venv\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    Write-Host "[WARNING] backend/venv/Scripts/python.exe not found. Falling back to system 'python'." -ForegroundColor Yellow
    $PythonExe = "python"
} else {
    Write-Host "[OK] Found backend virtual environment: $PythonExe" -ForegroundColor Green
}

# 2. Check frontend/node_modules
$FrontendDir = Join-Path $RepoRoot "frontend"
$NodeModulesDir = Join-Path $FrontendDir "node_modules"
if (-not (Test-Path $NodeModulesDir)) {
    Write-Host "[INFO] frontend/node_modules not found. Running 'npm install' in frontend/..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    try {
        npm install
        if ($LASTEXITCODE -ne 0) {
            throw "npm install failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
    Write-Host "[OK] Frontend dependencies installed successfully." -ForegroundColor Green
} else {
    Write-Host "[OK] Frontend dependencies already installed." -ForegroundColor Green
}

Write-Host ""
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host " Services startup:" -ForegroundColor Cyan
Write-Host "   - FastAPI Backend: http://127.0.0.1:8000" -ForegroundColor White
Write-Host "   - OpenAPI Docs:    http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "   - Vite Dev Server: http://localhost:5173" -ForegroundColor White
Write-Host "--------------------------------------------------" -ForegroundColor Cyan
Write-Host " Press Ctrl+C to stop both servers." -ForegroundColor Yellow
Write-Host ""

# Start Backend and Frontend concurrently using Job objects for robust process tracking & cleanup
$BackendJob = Start-Job -ScriptBlock {
    param($Root, $Py)
    Set-Location (Join-Path $Root "backend")
    & $Py -m uvicorn api.server:app --host 127.0.0.1 --port 8000 --reload
} -ArgumentList $RepoRoot, $PythonExe

$FrontendJob = Start-Job -ScriptBlock {
    param($Root)
    Set-Location (Join-Path $Root "frontend")
    npm run dev
} -ArgumentList $RepoRoot

# Output job logs helper & monitoring loop
try {
    while ($true) {
        # Receive job output if any
        $backendOutput = Receive-Job -Job $BackendJob
        if ($backendOutput) {
            foreach ($line in $backendOutput) {
                Write-Host "[Backend] $line" -ForegroundColor DarkCyan
            }
        }

        $frontendOutput = Receive-Job -Job $FrontendJob
        if ($frontendOutput) {
            foreach ($line in $frontendOutput) {
                Write-Host "[Frontend] $line" -ForegroundColor DarkGreen
            }
        }

        # Check if jobs are still running
        if ($BackendJob.State -eq 'Failed' -or $FrontendJob.State -eq 'Failed') {
            Write-Host "[ERROR] One of the background jobs failed." -ForegroundColor Red
            break
        }

        Start-Sleep -Milliseconds 500
    }
}
finally {
    Write-Host ""
    Write-Host "[INFO] Shutting down development servers..." -ForegroundColor Yellow

    # Stop jobs and cleanup child processes (python/uvicorn/node/vite)
    Get-Job | Stop-Job -ErrorAction SilentlyContinue
    Get-Job | Remove-Job -Force -ErrorAction SilentlyContinue

    # Kill any leftover uvicorn or node/vite processes spawned in this session
    Stop-Process -Name "uvicorn" -Force -ErrorAction SilentlyContinue
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue

    Write-Host "[OK] Development environment stopped cleanly." -ForegroundColor Green
}
