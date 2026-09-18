#!/usr/bin/env bash
set -euo pipefail
LABEL="cn.qoder.daily-checkin"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
echo "✓ 已卸载定时任务（data/ 目录中的日志与 plist 副本保留）"
