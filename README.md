# qoder-check-in

Qoder CN 桌面端每日签到自动化工具。脚本不打开 GUI、不模拟鼠标点击，也不保存凭据副本，而是复用本机已经登录的 Qoder CN IDE 凭据，直接调用签到接口。

本版本是在原项目基础上汇总并补充 Windows 支持的版本。

## 原作者

- 原项目作者：[hope0719](https://github.com/hope0719)
- 原项目地址：[hope0719/qoder-check-in](https://github.com/hope0719/qoder-check-in)
- 许可证：MIT，详见 [LICENSE](LICENSE)

## 功能

- macOS 和 Windows 跨平台运行。
- 查询签到活动状态。
- 执行每日签到；重复签到由服务端幂等处理。
- macOS 使用钥匙串读取 Electron safeStorage 密钥。
- Windows 使用当前用户的 Windows DPAPI 读取 Electron safeStorage 主密钥，再解密 Qoder 凭据。
- macOS 使用 `launchd` 定时执行，Windows 使用任务计划程序定时执行。

## 使用前提

| 项目 | 要求 |
|---|---|
| Qoder CN IDE | 已安装并登录；建议先启动一次 IDE，确保登录凭据有效 |
| Node.js | 18 或更高版本，内置 `fetch` |
| macOS | 需要允许脚本访问钥匙串 |
| Windows | Windows 10/11 x64；脚本和 Qoder 必须在同一个 Windows 用户下运行 |

## 快速开始

### macOS

```bash
git clone https://github.com/hope0719/qoder-check-in.git
cd qoder-check-in
./install.sh
```

首次运行可能会弹出钥匙串授权对话框。输入登录密码并选择“始终允许”，之后定时任务通常不会再次询问。

### Windows PowerShell

```powershell
git clone https://github.com/hope0719/qoder-check-in.git
cd qoder-check-in
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1
```

Windows 安装脚本会：

1. 检查 Node.js 版本和 Qoder 登录状态；
2. 创建当前用户的 Windows 任务计划；
3. 每天 10:05 执行一次，21:05 再执行一次作为兜底；
4. 安装完成后立即触发一次签到。

任务计划使用当前交互用户的权限运行，不需要管理员权限。由于 Windows DPAPI 与用户绑定，请不要用其他账户、管理员账户或系统账户运行任务。

## 手动运行

查看活动状态：

```bash
node scripts/qoder-checkin.mjs status
```

执行签到：

```bash
node scripts/qoder-checkin.mjs claim
```

Windows PowerShell 也可以直接运行相同命令：

```powershell
node .\scripts\qoder-checkin.mjs status
node .\scripts\qoder-checkin.mjs claim
```

## Windows 凭据目录

脚本会依次尝试以下目录中的 `auth.v1.dat`：

```text
%APPDATA%\Qoder CN
%APPDATA%\Qoder
%APPDATA%\Qoder IDE
%APPDATA%\com.qodercn.app.stable
```

如果 Qoder 安装位置不同，可以手动指定数据目录：

```powershell
$env:QODER_DATA_DIR = 'C:\path\to\qoder-data'
node .\scripts\qoder-checkin.mjs status
```

安装定时任务时，也要在同一个 PowerShell 窗口中设置该变量：

```powershell
$env:QODER_DATA_DIR = 'C:\path\to\qoder-data'
.\install.ps1
```

Windows 版本会读取数据目录下的 `Local State` 和 `auth.v1.dat`。DPAPI 解密只能在保护凭据的同一 Windows 用户环境中成功。

## 定时任务管理

卸载 Windows 任务计划：

```powershell
.\uninstall.ps1
```

查看 Windows 任务：

```powershell
Get-ScheduledTask -TaskName 'Qoder CN Daily Check-in'
```

修改 Windows 执行时间：编辑 `install.ps1` 中的两个 `New-ScheduledTaskTrigger`，然后重新运行安装脚本。macOS 执行时间可以编辑 `install.sh` 中的主执行和兜底时间。

## 环境变量

| 变量 | 作用 |
|---|---|
| `QODER_DATA_DIR` | 覆盖 Qoder IDE 数据目录 |
| `QODER_KEYCHAIN_SERVICES` | macOS 钥匙串服务名，多个名称用逗号分隔 |
| `QODER_API_BASE` | 覆盖签到接口域名 |
| `QODER_CHECKIN_LOG` | 覆盖日志文件路径 |

也可以在命令中使用 `--data-dir` 临时覆盖目录：

```powershell
node .\scripts\qoder-checkin.mjs status --data-dir 'C:\path\to\qoder-data'
```

## 退出码

| 退出码 | 含义 |
|---:|---|
| `0` | 成功，或今日已经领取 |
| `1` | 命令参数错误 |
| `2` | 找不到或无法解密本地凭据 |
| `3` | token 已过期；启动一次 Qoder CN IDE 后重试 |
| `4` | 签到接口返回业务错误，例如活动尚未开始或已经结束 |

`claim` 返回 HTTP 409 且 `errorCode` 为 `AlreadyExists` 时，会按成功处理，因为这表示当天已经领取过。

## 原理和注意事项

签到接口为：

```text
GET  https://gateway.qoder.com.cn/sash/api/v1/me/daily-check-in/status
POST https://gateway.qoder.com.cn/sash/api/v1/me/daily-check-in/claim
```

接口细节来自对官方客户端行为的分析，可能随 Qoder 版本或服务端活动变化。请仅在自己的账号和设备上使用，并遵守 Qoder 服务条款。项目不会上传凭据，但任何能在当前 Windows 用户权限下运行的程序理论上都可能访问同一用户可解密的数据。

## 贡献

欢迎提交 Issue 或 Pull Request。请不要在 Issue、日志或提交内容中公开 token、凭据文件或个人账号信息。
