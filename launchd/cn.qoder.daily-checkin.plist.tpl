<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>cn.qoder.daily-checkin</string>
  <key>ProgramArguments</key>
  <array>
    <string>__NODE_PATH__</string>
    <string>__SCRIPT_PATH__</string>
    <string>claim</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>__PRIMARY_HOUR__</integer><key>Minute</key><integer>__PRIMARY_MINUTE__</integer></dict>
    <dict><key>Hour</key><integer>__FALLBACK_HOUR__</integer><key>Minute</key><integer>__FALLBACK_MINUTE__</integer></dict>
  </array>
  <key>StandardOutPath</key><string>__DATA_DIR__/launchd.out.log</string>
  <key>StandardErrorPath</key><string>__DATA_DIR__/launchd.err.log</string>
  <key>EnvironmentVariables</key>
  <dict><key>HOME</key><string>__HOME__</string></dict>
</dict>
</plist>
