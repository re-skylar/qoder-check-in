# qoder-check-in

跨平台的 Qoder CN 桌面端每日签到工具 / Cross-platform daily check-in tool for Qoder CN Desktop.

- 本仓库 / This repository: [re-skylar/qoder-check-in](https://github.com/re-skylar/qoder-check-in)
- 原项目 / Original project: [hope0719/qoder-check-in](https://github.com/hope0719/qoder-check-in)
- 原作者 / Original author: [hope0719](https://github.com/hope0719)
- 许可证 / License: [MIT](LICENSE)

## 中文

### 功能

脚本不打开 GUI、不模拟鼠标点击，也不保存凭据副本，而是复用本机已经登录的 Qoder CN IDE 凭据，直接调用签到接口。

- 支持 macOS 和 Windows。
- 查询签到活动状态。
- 执行每日签到；重复签到由服务端幂等处理。
- macOS 使用钥匙串读取 Electron safeStorage 密钥。
- Windows 使用当前用户的 Windows DPAPI 读取 Electron safeStorage 主密钥，再解密 Qoder 凭据。
- macOS 使用 `launchd` 定时执行，Windows 使用任务计划程序定时执行。

### 使用前提

| 项目 | 要求 |
|---|---|
| Qoder CN IDE | 已安装并登录；建议先启动一次 IDE，确保登录凭据有效 |
| Node.js | 18 或更高版本，内置 `fetch` |
| macOS | 需要允许脚本访问钥匙串 |
| Windows | Windows 10/11 x64；脚本和 Qoder 必须在同一个 Windows 用户下运行 |

### 快速开始

#### macOS

```bash
git clone https://github.com/re-skylar/qoder-check-in.git
cd qoder-check-in
./install.sh
```

首次运行可能会弹出钥匙串授权对话框。输入登录密码并选择“始终允许”。

#### Windows PowerShell

```powershell
git clone https://github.com/re-skylar/qoder-check-in.git
cd qoder-check-in
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1
```

Windows 安装脚本会检查 Node.js 和 Qoder 登录状态，创建当前用户的任务计划，并每天在 10:05 执行、21:05 兜底。安装完成后会立即触发一次签到。

任务计划使用当前交互用户的权限运行，不需要管理员权限。由于 Windows DPAPI 与用户绑定，请不要用其他账户、管理员账户或系统账户运行任务。

### 手动运行

```powershell
node .\scripts\qoder-checkin.mjs status
node .\scripts\qoder-checkin.mjs claim
```

`status` 只读查询活动状态；`claim` 执行签到。

### Windows 凭据目录

脚本会依次尝试以下目录中的 `auth.v1.dat`：

```text
%APPDATA%\Qoder CN
%APPDATA%\Qoder
%APPDATA%\Qoder IDE
%APPDATA%\com.qodercn.app.stable
```

如果 Qoder 数据目录不同，可以手动指定：

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

### 定时任务管理

卸载 Windows 任务计划：

```powershell
.\uninstall.ps1
```

查看 Windows 任务：

```powershell
Get-ScheduledTask -TaskName 'Qoder CN Daily Check-in'
```

修改 Windows 执行时间：编辑 `install.ps1` 中的两个 `New-ScheduledTaskTrigger`，然后重新运行安装脚本。macOS 执行时间可以编辑 `install.sh` 中的主执行和兜底时间。

### 环境变量

| 变量 | 作用 |
|---|---|
| `QODER_DATA_DIR` | 覆盖 Qoder IDE 数据目录 |
| `QODER_KEYCHAIN_SERVICES` | macOS 钥匙串服务名，多个名称用逗号分隔 |
| `QODER_API_BASE` | 覆盖签到接口域名 |
| `QODER_CHECKIN_LOG` | 覆盖日志文件路径 |

也可以使用 `--data-dir` 临时覆盖目录：

```powershell
node .\scripts\qoder-checkin.mjs status --data-dir 'C:\path\to\qoder-data'
```

### 退出码

| 退出码 | 含义 |
|---:|---|
| `0` | 成功，或今日已经领取 |
| `1` | 命令参数错误 |
| `2` | 找不到或无法解密本地凭据 |
| `3` | token 已过期；启动一次 Qoder CN IDE 后重试 |
| `4` | 签到接口返回业务错误，例如活动尚未开始或已经结束 |

`claim` 返回 HTTP 409 且 `errorCode` 为 `AlreadyExists` 时，会按成功处理，因为这表示当天已经领取过。

### 原理和注意事项

```text
GET  https://gateway.qoder.com.cn/sash/api/v1/me/daily-check-in/status
POST https://gateway.qoder.com.cn/sash/api/v1/me/daily-check-in/claim
```

接口细节来自对官方客户端行为的分析，可能随 Qoder 版本或服务端活动变化。请仅在自己的账号和设备上使用，并遵守 Qoder 服务条款。项目不会上传凭据，但任何能在当前 Windows 用户权限下运行的程序理论上都可能访问同一用户可解密的数据。

## English

### Features

This tool does not open the GUI, simulate mouse clicks, or keep a copy of your credentials. It reuses the credentials of the Qoder CN IDE already signed in on the local machine and calls the check-in API directly.

- Supports macOS and Windows.
- Checks the check-in campaign status.
- Claims the daily reward; duplicate claims are handled idempotently by the server.
- Uses the macOS Keychain to read the Electron safeStorage key on macOS.
- Uses the current Windows user's DPAPI to decrypt the Electron safeStorage key on Windows.
- Uses `launchd` on macOS and Windows Task Scheduler on Windows.

### Requirements

| Item | Requirement |
|---|---|
| Qoder CN IDE | Installed and signed in; launch it once before the first run |
| Node.js | Version 18 or newer, with built-in `fetch` |
| macOS | Allow the script to access the Keychain |
| Windows | Windows 10/11 x64; run the script as the same Windows user as Qoder |

### Quick start

#### macOS

```bash
git clone https://github.com/re-skylar/qoder-check-in.git
cd qoder-check-in
./install.sh
```

The first run may show a Keychain authorization dialog. Enter your login password and choose “Always Allow”.

#### Windows PowerShell

```powershell
git clone https://github.com/re-skylar/qoder-check-in.git
cd qoder-check-in
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1
```

The Windows installer checks Node.js and the Qoder login state, creates a task for the current user, runs daily at 10:05 with a fallback run at 21:05, and triggers one run immediately after installation.

The task runs with the current interactive user's permissions and does not require administrator privileges. Windows DPAPI is user-bound, so do not run the task as another account, an administrator account, or the system account.

### Manual usage

```powershell
node .\scripts\qoder-checkin.mjs status
node .\scripts\qoder-checkin.mjs claim
```

`status` performs a read-only campaign check; `claim` performs the check-in.

### Windows credential directories

The script checks for `auth.v1.dat` in these directories, in order:

```text
%APPDATA%\Qoder CN
%APPDATA%\Qoder
%APPDATA%\Qoder IDE
%APPDATA%\com.qodercn.app.stable
```

Override the data directory when needed:

```powershell
$env:QODER_DATA_DIR = 'C:\path\to\qoder-data'
node .\scripts\qoder-checkin.mjs status
```

Set the same variable before installing the scheduled task:

```powershell
$env:QODER_DATA_DIR = 'C:\path\to\qoder-data'
.\install.ps1
```

The Windows implementation reads `Local State` and `auth.v1.dat`. DPAPI decryption only works under the same Windows user that protected the credentials.

### Task management

Remove the Windows scheduled task:

```powershell
.\uninstall.ps1
```

View the task:

```powershell
Get-ScheduledTask -TaskName 'Qoder CN Daily Check-in'
```

Edit the two `New-ScheduledTaskTrigger` calls in `install.ps1` to change the Windows schedule. Edit the primary and fallback times in `install.sh` for macOS.

### Exit codes

| Code | Meaning |
|---:|---|
| `0` | Success, or already claimed today |
| `1` | Invalid command or arguments |
| `2` | Local credentials missing or could not be decrypted |
| `3` | Token expired; launch Qoder CN IDE once and retry |
| `4` | API business error, such as campaign not started or already ended |

An HTTP 409 response with `errorCode: AlreadyExists` is treated as success because it means the reward was already claimed today.

### Notes and disclaimer

The API details were derived from observing the official client and may change with future Qoder versions or server-side campaigns. Use this tool only with your own account and device, and follow Qoder's terms of service. The project does not upload credentials, but any program running with the same Windows user permissions may theoretically access data decryptable by that user.

## Contributing

Issues and pull requests are welcome. Never include tokens, credential files, logs containing personal data, or account information in issues or commits.
