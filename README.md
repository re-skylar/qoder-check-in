# qoder-check-in

Qoder CN 桌面端「每日签到领 Credits」自动化。纯 HTTP 实现：**不开 GUI、不做屏幕点击、不存储任何凭据副本**，直接复用本机 Qoder CN IDE 已登录的凭据调用官方签到接口。

## 背景

Qoder CN 会不定期上线登录奖励活动（例如 2026-09-18 ~ 09-30，每天 10:00 起可领 100 Credits，入口是桌面端左下角用量面板的礼物图标）。本项目把「点一下礼物图标」变成每天自动执行一次的 HTTP 请求。

## 原理（逆向结论）

- 签到接口：`POST https://gateway.qoder.com.cn/sash/api/v1/me/daily-check-in/claim`，状态查询为同前缀的 `GET .../status`，认证用 `Authorization: Bearer <JWT>`。
- 重复领取返回 `409 AlreadyExists`，服务端天然幂等，脚本可安全地每天多次运行。
- JWT 来自 IDE 的登录凭据文件 `~/Library/Application Support/com.qodercn.app.stable/auth.v1.dat`：Electron safeStorage 加密（`v10` 前缀；密钥存于 macOS 钥匙串条目 `Qoder CN App Safe Storage`；PBKDF2-SHA1，salt `saltysalt`，1003 次迭代，AES-128-CBC，IV 为 16 个 `0x20`）。
- 同一套 sash 服务也被 QoderWork/QwenWork CN 客户端使用（其旧签到活动已于 2026-07-30 截止）。

## 前置环境

| 项目 | 要求 |
|---|---|
| 系统 | macOS（依赖 `security` 命令与钥匙串） |
| Node.js | ≥ 18（内置 `fetch`） |
| Qoder CN IDE | 已安装且已登录；access token 有效期约 10 天，IDE 启动时自动轮换 |

## 快速开始

```bash
git clone https://github.com/hope0719/qoder-check-in.git
cd qoder-check-in
./install.sh
```

首次运行会弹出 macOS 钥匙串授权对话框，输入登录密码并点「始终允许」——之后定时任务不再弹窗。

手动操作：

```bash
node scripts/qoder-checkin.mjs status   # 查看活动状态（只读）
node scripts/qoder-checkin.mjs claim    # 执行签到（幂等）
```

退出码：`0` 成功或今日已领；`2` 无法解密凭据（未登录/钥匙串未授权）；`3` token 过期（打开一次 IDE 即刷新）；`4` 接口报错（如活动未开始/已结束）。

## 定制

环境变量：`QODER_DATA_DIR`（IDE 数据目录）、`QODER_KEYCHAIN_SERVICES`（钥匙串服务名，逗号分隔）、`QODER_API_BASE`（接口域名）。定时规则在 `install.sh` 内 `__PRIMARY_*__` / `__FALLBACK_*__` 处修改后重跑安装。

## 声明

- 仅操作本机当前登录的单一账号；不采集、不上传任何凭据。
- 接口细节来自对官方客户端的反向分析，可能随版本变化；请遵守 Qoder 服务条款，仅供个人学习使用。

## License

MIT
