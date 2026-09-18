#!/usr/bin/env node
// Qoder CN 每日签到：解密本机 IDE 凭据取 token，调 sash daily-check-in 接口。
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PLATFORM = process.platform;
const BASE = process.env.QODER_API_BASE || 'https://gateway.qoder.com.cn';
const STATUS_PATH = '/sash/api/v1/me/daily-check-in/status';
const CLAIM_PATH = '/sash/api/v1/me/daily-check-in/claim';
const LOG_FILE = process.env.QODER_CHECKIN_LOG
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'checkin.log');

function windowsDataDirs() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return [
    'Qoder CN',
    'Qoder',
    'Qoder IDE',
    'com.qodercn.app.stable',
  ].map(name => path.join(appData, name));
}

function defaultDataDir() {
  if (PLATFORM === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'com.qodercn.app.stable');
  if (PLATFORM === 'win32') {
    const dirs = windowsDataDirs();
    return dirs.find(dir => existsSync(path.join(dir, 'auth.v1.dat'))) || dirs[0];
  }
  throw new Error(`不支持的系统：${PLATFORM}（目前支持 macOS 和 Windows）`);
}

function cliOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const DATA_DIR = process.env.QODER_DATA_DIR || cliOption('--data-dir') || defaultDataDir();
const KEYCHAIN_SERVICES = (process.env.QODER_KEYCHAIN_SERVICES
  || 'Qoder CN App Safe Storage,Qoder Safe Storage').split(',').map(s => s.trim()).filter(Boolean);

function decryptMacSafeStorage(buf, password) {
  if (buf.slice(0, 3).toString() !== 'v10') throw new Error('unexpected prefix (not v10)');
  const key = crypto.pbkdf2Sync(Buffer.from(password, 'utf8'), Buffer.from('saltysalt'), 1003, 16, 'sha1');
  const iv = Buffer.alloc(16, 0x20);
  const d = crypto.createDecipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([d.update(buf.slice(3)), d.final()]).toString('utf8');
}

function decryptWindowsDpapiBytes(buf) {
  // Electron safeStorage uses the Windows user's DPAPI key. Keep the
  // ciphertext in stdin so it never appears in the PowerShell command line.
  const powershell = process.env.SystemRoot
    ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'powershell.exe';
  const command = [
    '$ErrorActionPreference = "Stop"',
    'try { Add-Type -AssemblyName System.Security.Cryptography.ProtectedData } catch { Add-Type -AssemblyName System.Security }',
    '$encoded = [Console]::In.ReadToEnd()',
    '$cipher = [Convert]::FromBase64String($encoded)',
    '$plain = [System.Security.Cryptography.ProtectedData]::Unprotect($cipher, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)',
    '[Console]::Out.Write([Convert]::ToBase64String($plain))',
  ].join('; ');
  try {
    const encoded = execFileSync(powershell, [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-Command', command,
    ], { input: buf.toString('base64'), encoding: 'utf8' }).trim();
    return Buffer.from(encoded, 'base64');
  } catch (e) {
    const detail = e.stderr?.toString().trim() || e.message;
    throw new Error(`Windows DPAPI 解密失败：${detail}`);
  }
}

function decryptWindowsSafeStorage(buf) {
  const prefix = buf.slice(0, 3).toString();

  // Current Chromium/Electron Windows safeStorage format:
  // v10/v11 + 12-byte nonce + AES-256-GCM ciphertext + 16-byte tag.
  // The AES key is stored in Local State and protected with DPAPI.
  if (prefix === 'v10' || prefix === 'v11') {
    const localStateFile = path.join(DATA_DIR, 'Local State');
    if (!existsSync(localStateFile)) throw new Error(`找不到 ${localStateFile}，无法读取 Windows safeStorage 主密钥`);
    const localState = JSON.parse(readFileSync(localStateFile, 'utf8'));
    const encodedKey = localState.os_crypt?.encrypted_key;
    if (!encodedKey) throw new Error(`${localStateFile} 中没有 os_crypt.encrypted_key`);

    const encryptedKey = Buffer.from(encodedKey, 'base64');
    if (encryptedKey.slice(0, 5).toString() !== 'DPAPI') {
      throw new Error('Windows safeStorage 主密钥不是 DPAPI 格式');
    }
    const key = decryptWindowsDpapiBytes(encryptedKey.slice(5));
    const nonce = buf.slice(3, 15);
    const payload = buf.slice(15);
    if (nonce.length !== 12 || payload.length < 16) throw new Error('Windows safeStorage 密文格式无效');

    const ciphertext = payload.slice(0, -16);
    const authTag = payload.slice(-16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  // Older Electron/Chromium builds stored the whole value as a DPAPI blob.
  return decryptWindowsDpapiBytes(buf).toString('utf8');
}

function loadAuth() {
  const file = path.join(DATA_DIR, 'auth.v1.dat');
  if (!existsSync(file)) throw new Error(`找不到 ${file} —— 请先启动并登录 Qoder CN IDE；如果安装目录不同，请设置 QODER_DATA_DIR`);
  const buf = readFileSync(file);

  if (PLATFORM === 'win32') {
    try { return JSON.parse(decryptWindowsSafeStorage(buf)); }
    catch (e) { throw new Error(`${e.message}；请确认签到脚本与 Qoder 在同一个 Windows 用户下运行`); }
  }

  if (PLATFORM !== 'darwin') throw new Error(`不支持的系统：${PLATFORM}`);
  let lastErr;
  for (const service of KEYCHAIN_SERVICES) {
    try {
      const password = execFileSync('security', ['find-generic-password', '-s', service, '-w']).toString().trim();
      return JSON.parse(decryptMacSafeStorage(buf, password));
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

async function api(p, method, token) {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}

function log(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
  console.log(line);
  try { mkdirSync(path.dirname(LOG_FILE), { recursive: true }); } catch {}
  try { appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

async function main() {
  const cmd = process.argv[2] || 'status';
  let auth;
  try { auth = loadAuth(); } catch (e) { log({ cmd, result: 'AUTH_FAIL', error: e.message.split('\n')[0] }); process.exit(2); }
  if (new Date(auth.expiresAt).getTime() < Date.now()) {
    log({ cmd, result: 'TOKEN_EXPIRED', expiresAt: auth.expiresAt, hint: '打开一次 Qoder CN IDE 即会自动刷新' });
    process.exit(3);
  }
  if (cmd === 'status') {
    const r = await api(STATUS_PATH, 'GET', auth.token);
    log({ cmd, http: r.status, body: r.body });
    return;
  }
  if (cmd === 'claim') {
    let r = await api(CLAIM_PATH, 'POST', auth.token);
    if (r.status === 401) r = await api(CLAIM_PATH, 'POST', loadAuth().token);
    const ok = r.status === 200 || (r.status === 409 && r.body?.errorCode === 'AlreadyExists');
    log({ cmd, http: r.status, result: r.status === 409 ? 'ALREADY_CLAIMED' : ok ? 'OK' : 'FAIL', body: r.body });
    process.exit(ok ? 0 : 4);
  }
  console.error('usage: qoder-checkin.mjs status|claim');
  process.exit(1);
}
main();
