$ErrorActionPreference = 'Stop'

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $repo 'scripts\qoder-checkin.mjs'
$taskName = 'Qoder CN Daily Check-in'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue

if (-not $nodeCommand) {
  throw '找不到 Node.js。请先安装 Node.js 18 或更高版本，并确保 node 已加入 PATH。'
}

$nodePath = $nodeCommand.Source
$nodeVersion = (& $nodePath --version).Trim()
$nodeMajor = [int]($nodeVersion -replace '^v([0-9]+).*$', '$1')
if ($nodeMajor -lt 18) {
  throw "Node.js 版本过低：$nodeVersion，需要 18 或更高版本。"
}

$scriptArgs = @($scriptPath, 'status')
if ($env:QODER_DATA_DIR) {
  $scriptArgs += @('--data-dir', $env:QODER_DATA_DIR)
}

Write-Host '== 正在验证 Qoder 登录凭据和签到接口 =='
& $nodePath @scriptArgs
if ($LASTEXITCODE -ne 0) {
  throw '验证失败。请先启动并登录 Qoder CN IDE；如果数据目录不在默认位置，请设置 QODER_DATA_DIR 后重试。'
}

$actionArguments = '"{0}" claim' -f $scriptPath
if ($env:QODER_DATA_DIR) {
  $actionArguments += ' --data-dir "{0}"' -f $env:QODER_DATA_DIR
}

$action = New-ScheduledTaskAction `
  -Execute $nodePath `
  -Argument $actionArguments `
  -WorkingDirectory $repo
$primaryTrigger = New-ScheduledTaskTrigger -Daily -At '10:05'
$fallbackTrigger = New-ScheduledTaskTrigger -Daily -At '21:05'
$userId = if ($env:USERDOMAIN) { "$env:USERDOMAIN\$env:USERNAME" } else { $env:USERNAME }
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable
$task = New-ScheduledTask `
  -Action $action `
  -Trigger @($primaryTrigger, $fallbackTrigger) `
  -Principal $principal `
  -Settings $settings `
  -Description 'Qoder CN 每日签到（复用当前 Windows 用户的本地登录凭据）'

Register-ScheduledTask -TaskName $taskName -InputObject $task -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host "✓ Windows 定时任务已安装：$taskName"
Write-Host '  每日执行：10:05，21:05 兜底'
Write-Host "  查看任务：Get-ScheduledTask -TaskName '$taskName'"
Write-Host '  卸载任务：.\uninstall.ps1'
