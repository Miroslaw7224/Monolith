# Tworzy skrót Monolith.lnk na pulpicie Windows. Wołany przez install-shortcut.sh.
param(
  [Parameter(Mandatory = $true)][string]$Distro,
  [Parameter(Mandatory = $true)][string]$IconPath,
  [Parameter(Mandatory = $true)][string]$ProdDir
)
$desktop = [Environment]::GetFolderPath('Desktop')
$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut((Join-Path $desktop 'Monolith.lnk'))
$lnk.TargetPath = Join-Path $env:SystemRoot 'System32\wsl.exe'
# Cienka komenda: ustaw worktree na main (-f: katalog jest zarządzany maszynowo) i uruchom skrypt z repo.
# Checkout main robi sam start-prod.sh (pod blokadą i z komunikatem błędu).
$lnk.Arguments = "-d $Distro -- bash -lc `"cd '$ProdDir' && exec bash scripts/prod/start-prod.sh`""
$lnk.IconLocation = $IconPath
$lnk.Description = 'Monolith'
$lnk.WindowStyle = 1
$lnk.Save()
Write-Output ("Skrót utworzony: " + (Join-Path $desktop 'Monolith.lnk'))
