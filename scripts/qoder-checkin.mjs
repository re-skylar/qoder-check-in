#!/usr/bin/env node
// Qoder CN 每日签到：解密本机 IDE 凭据取 token，调 sash daily-check-in 接口。
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DATA_DIR = process.env.QODER_DATA_DIR
  || path.join(os.homedir(), 'Library/Application Support/com.qodercn.app.stable');
const KEYCHAIN_SERVICES = (process.env.QODER_KEYCHAIN_SERVICES
  || 'Qoder CN App Safe Storage,Qoder Safe Storage').split(',');
const BASE = process.env.QODER_API_BASE || 'https://gateway.qoder.com.cn';
const STATUS_PATH = '/sash/api/v1/me/daily-check-in/status';
const CLAIM_PATH = '/sash/api/v1/me/daily-check-in/claim';
const LOG_FILE = process.env.QODER_CHECKIN_LOG
  || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'checkin.log');

function decryptSafeStorage(buf, password) {
  if (buf.slice(0, 3).toString() !== 'v10') throw new Error('unexpected prefix (not v10)');
  const key = crypto.pbkdf2Sync(Buffer.from(password, 'utf8'), Buffer.from('saltysalt'), 1003, 16, 'sha1');
  const iv = Buffer.alloc(16, 0x20);
  const d = crypto.createDecipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([d.update(buf.slice(3)), d.final()]).toString('utf8');
}

function loadAuth() {
  const file = path.join(DATA_DIR, 'auth.v1.dat');
  if (!existsSync(file)) throw new Error(`missing ${file} — 请先在 Qoder CN IDE 登录`);
  const buf = readFileSync(file);
  let lastErr;
  for (const service of KEYCHAIN_SERVICES) {
    try {
      const password = execFileSync('security', ['find-generic-password', '-s', service, '-w']).toString().trim();
      return JSON.parse(decryptSafeStorage(buf, password));
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
