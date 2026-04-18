param(
  [string]$WslAddress = "",
  [string]$LanAddress = "",
  [int]$WebPort = 5173,
  [int]$ApiPort = 4023
)

$ErrorActionPreference = "Stop"

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $argumentList = @(
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      "`"$PSCommandPath`"",
      "-WebPort",
      $WebPort,
      "-ApiPort",
      $ApiPort
    )

    if ($WslAddress.Trim().Length -gt 0) {
      $argumentList += @("-WslAddress", $WslAddress.Trim())
    }

    if ($LanAddress.Trim().Length -gt 0) {
      $argumentList += @("-LanAddress", $LanAddress.Trim())
    }

    Write-Host "Requesting elevated Windows PowerShell for WSL LAN forwarding..."
    Start-Process -FilePath "powershell.exe" -ArgumentList $argumentList -Verb RunAs -Wait
    exit $LASTEXITCODE
  }
}

function Resolve-WslAddress {
  if ($WslAddress.Trim().Length -gt 0) {
    return $WslAddress.Trim()
  }

  $detected = (wsl.exe hostname -I).Trim().Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries) | Select-Object -First 1
  if (-not $detected) {
    throw "Could not detect the WSL IP address. Pass -WslAddress explicitly."
  }

  return $detected
}

function Resolve-LanAddress {
  if ($LanAddress.Trim().Length -gt 0) {
    return $LanAddress.Trim()
  }

  $candidate = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike "127.*" -and
      $_.IPAddress -notlike "169.254.*" -and
      $_.InterfaceAlias -notmatch "vEthernet|Loopback"
    } |
    Sort-Object InterfaceMetric |
    Select-Object -First 1

  if (-not $candidate) {
    return "localhost"
  }

  return $candidate.IPAddress
}

function Set-PortProxy {
  param(
    [int]$Port,
    [string]$ConnectAddress
  )

  netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=$Port | Out-Null
  netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$Port connectaddress=$ConnectAddress connectport=$Port | Out-Null
}

function Ensure-FirewallRule {
  param(
    [int]$Port,
    [string]$Name
  )

  $existing = Get-NetFirewallRule -DisplayName $Name -ErrorAction SilentlyContinue
  if ($existing) {
    Set-NetFirewallRule -DisplayName $Name -Enabled True -Direction Inbound -Action Allow | Out-Null
    return
  }

  New-NetFirewallRule -DisplayName $Name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
}

Assert-Administrator

$resolvedWslAddress = Resolve-WslAddress
$resolvedLanAddress = Resolve-LanAddress

Set-PortProxy -Port $WebPort -ConnectAddress $resolvedWslAddress
Set-PortProxy -Port $ApiPort -ConnectAddress $resolvedWslAddress

Ensure-FirewallRule -Port $WebPort -Name "2dRPG Web $WebPort"
Ensure-FirewallRule -Port $ApiPort -Name "2dRPG Server $ApiPort"

Write-Host "WSL LAN forwarding configured."
Write-Host "WSL address: $resolvedWslAddress"
Write-Host "LAN URL: http://$resolvedLanAddress`:$WebPort"
Write-Host "API URL: http://$resolvedLanAddress`:$ApiPort"
