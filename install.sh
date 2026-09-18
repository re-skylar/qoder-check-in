#!/usr/bin/env bash
# 安装 Qoder CN 每日签到定时任务（launchd，每天 10:05 主跑 + 21:05 兜底）
set -euo pipefail
cd "$(dirname "$0")"

REPO="$(pwd)"
DATA_DIR="$REPO/data"
NODE_PATH="$(command -v node)"
LABEL="cn.qoder.daily-checkin"

[ -n "$NODE_PATH" ] || { echo "缺少 node（需 >=18），请先安装：brew install node"; exit 1; }
node -e 'process.exit(Number(process.versions.node.split(".")[0] >= 18))' \
  || { echo "node 版本过低（$(node -v)），需要 >=18"; exit 1; }
mkdir -p "$DATA_DIR"

sed -e "s|__NODE_PATH__|$NODE_PATH|g" \
    -e "s|__SCRIPT_PATH__|$REPO/scripts/qoder-checkin.mjs|g" \
    -e "s|__DATA_DIR__|$DATA_DIR|g" \
    -e "s|__HOME__|$HOME|g" \
    -e "s|__PRIMARY_HOUR__|10|g" -e "s|__PRIMARY_MINUTE__|5|g" \
    -e "s|__FALLBACK_HOUR__|21|g" -e "s|__FALLBACK_MINUTE__|5|g" \
    launchd/cn.qoder.daily-checkin.plist.tpl > "$DATA_DIR/$LABEL.plist"

echo "== 先手动验证一次 claim =="
"$NODE_PATH" scripts/qoder-checkin.mjs claim || {
  echo "验证失败：请确认 Qoder CN IDE 已登录，且允许访问钥匙串条目「Qoder CN App Safe Storage」"; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents"
cp "$DATA_DIR/$LABEL.plist" "$HOME/Library/LaunchAgents/"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/$LABEL.plist"
launchctl kickstart "gui/$(id -u)/$LABEL" || true

echo "✓ 已安装并触发。管理命令："
echo "  查看状态  launchctl print gui/\$(id -u)/$LABEL"
echo "  立即执行  launchctl kickstart gui/\$(id -u)/$LABEL"
echo "  卸载      ./uninstall.sh"
