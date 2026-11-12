#Requires -Version 5.1
<#
  Starts the whole local dev stack: Hardhat chain + contract deploy + frontend.
  Run it yourself from a VS Code terminal any time you want the project up:

      npm run dev:up

  It opens two independent, visible PowerShell windows (chain + frontend) that
  keep running even if this script's own window is closed. Re-running it is
  safe: it skips starting a new chain if port 8545 is already listening.
#>

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$logFile = Join-Path $root "hardhat-node.log"

function Test-Rpc {
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:8545" -Method Post `
            -Body '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' `
            -ContentType "application/json" -TimeoutSec 2 | Out-Null
        return $true
    } catch { return $false }
}

function Test-Frontend {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:5173" -TimeoutSec 2 -UseBasicParsing
        return $r.StatusCode -eq 200
    } catch { return $false }
}

function Clear-StalePort($port) {
    $owner = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($owner) {
        $pids = $owner | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($p in $pids) {
            Write-Host "Port $port is held by stale PID $p - stopping it." -ForegroundColor Yellow
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 1
    }
}

$chainAlreadyUp = Test-Rpc

if ($chainAlreadyUp) {
    Write-Host "Chain already running on http://127.0.0.1:8545 - leaving it alone." -ForegroundColor Yellow
} else {
    Clear-StalePort 8545

    Write-Host "Starting Hardhat node in a new window..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-Command",
        "Set-Location '$root'; npx hardhat node 2>&1 | Tee-Object -FilePath '$logFile'"
    ) | Out-Null

    Write-Host "Waiting for it to come up..." -NoNewline
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        Write-Host "." -NoNewline
        if (Test-Rpc) { $ready = $true; break }
    }
    Write-Host ""
    if (-not $ready) {
        Write-Host "Chain didn't come up within 30s. Check the new window for errors." -ForegroundColor Red
        exit 1
    }
    Write-Host "Chain is up." -ForegroundColor Green

    Write-Host "Deploying contracts..." -ForegroundColor Cyan
    Push-Location $root
    $deployed = $false
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        npx hardhat run scripts/deploy.js --network localhost
        if ($LASTEXITCODE -eq 0) { $deployed = $true; break }
        Write-Host "Deploy attempt $attempt failed (exit $LASTEXITCODE) - retrying..." -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
    if (-not $deployed) {
        Pop-Location
        Write-Host "Deploy failed after 3 attempts. Run 'npm run deploy:local' manually to see the full error." -ForegroundColor Red
        exit 1
    }
    npm run export-abis
    Pop-Location
}

if (Test-Frontend) {
    Write-Host "Frontend already running on http://localhost:5173 - leaving it alone." -ForegroundColor Yellow
} else {
    Clear-StalePort 5173
    Write-Host "Starting frontend dev server in a new window..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList @(
        "-NoExit", "-Command",
        "Set-Location '$root\frontend'; npm run dev"
    ) | Out-Null
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
Write-Host "  Chain    : http://127.0.0.1:8545  (chain ID 31337)"
Write-Host "  Frontend : http://localhost:5173"
Write-Host "  Watch the chain live any time with:"
Write-Host "    Get-Content '$logFile' -Wait -Tail 30"
