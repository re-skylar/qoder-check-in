$ErrorActionPreference = 'Stop'

$taskName = 'Qoder CN Daily Check-in'
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "✓ Windows 定时任务已卸载：$taskName（日志和本地 data 目录保留）"
