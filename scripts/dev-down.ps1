#Requires -Version 5.1
<#
  Stops the local dev stack started by dev-up.ps1 (chain on 8545, frontend on 5173).
  Run with: npm run dev:down
#>

foreach ($port in 8545, 5173) {
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) {
        $pids = $conn | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($p in $pids) {
            Write-Host "Stopping process $p listening on port $port..." -ForegroundColor Cyan
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "Nothing listening on port $port." -ForegroundColor Yellow
    }
}
