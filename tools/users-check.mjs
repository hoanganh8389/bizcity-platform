#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer platform
// [2026-11-25 10:34 AM Johnny Chu - Chu Hoàng Anh] USERS-1 — bộ kiểm khuôn chung người dùng · user meta · vai · phân quyền (bizcity_users@1, BIZCITY-USERS-ROLES-v1.md).
//   Đọc tệp khai báo bizcity.authz.json (bizcity_authz_manifest@1) và cây mã của repo; không chạy mã app, không cần CSDL. Không phụ thuộc gói ngoài (R-PLAT-5).
//
//   node tools/users-check.mjs                          # vector schema (SC-USER-6)
//   node tools/users-check.mjs --manifest <tệp…>        # luật chéo trên bizcity.authz.json (SC-USER-4)
//   node tools/users-check.mjs --repo <thư mục…>        # repo: có tệp khai báo, không tự tạo bảng người dùng / vai riêng (SC-USER-5) + SC-USER-4
//   node tools/users-check.mjs --json                   # kết quả theo bizcity_conformance_report@1
//
// Kết luận theo cổng: một phát hiện mức fail là KHÔNG ĐẠT (mã thoát 1).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { ROOT, validate } from './lib/json-schema.mjs';

const USERS_DIR = join(ROOT, 'packages/contracts/schema/users');
const SCHEMA = JSON.parse(readFileSync(join(USERS_DIR, 'authz-manifest.schema.json'), 'utf8'));

/** Động từ cuối tên quyền (R-USER-7). Nhóm cũ (read / write…) còn nhận, có cảnh báo khi tạo quyền mới theo kiểu cũ. */
const VERBS = ['xem', 'lap', 'sua', 'xoa', 'huy', 'duyet', 'bo-duyet', 'xuat', 'gop', 'gia', 'nhap', 'in', 'khoa', 'mo'];
/** Động từ tiếng Anh: trộn vào tên quyền tiếng Việt không dấu là lệch khuôn (cảnh báo). */
const ENGLISH_VERBS = ['sell', 'cancel', 'use', 'report', 'return', 'create', 'update', 'delete', 'view', 'edit', 'list', 'manage', 'import', 'export'];
const LEGACY_VERBS = ['read', 'write', 'approve', 'lock', 'run', 'edit-all', 'bypass-date-lock'];
/** Từ cấm trong khoá user meta (R-USER-16, cùng danh sách lớp mềm của open-cake R-DATA-2). */
const FORBIDDEN_META = ['price', 'amount', 'qty', 'tax', 'status', 'role', 'perm', 'permission', 'token', 'cookie', 'password', 'secret'];
/** Bảng người dùng / vai do nền làm chủ — app không tự tạo bảng trùng vai trò (R-USER-2). */
const PLATFORM_TABLES = ['users', 'user_role_assignments', 'tenant_roles', 'tenant_role_rules', 'roles', 'permissions', 'user_roles', 'role_permissions', 'api_keys'];

/** App là NGUỒN GỐC của bảng nền (0001_platform_nen_tang gom từ migration của nó): miễn SC-USER-5 tới khi chuyển sang gói nền. */
const ORIGIN_APPS = { 'open-ketoan': 'P6 — open-ketoan dùng @bizcity/platform' };

const verbOf = (key) => {
  const fn = key.split(':')[1];
  const two = fn.split('-').slice(-2).join('-');
  if ([...VERBS, ...LEGACY_VERBS].includes(two)) return two;
  if ([...VERBS, ...LEGACY_VERBS].includes(fn)) return fn;
  return fn.split('-').pop();
};

/* ── SC-USER-4: luật chéo trên tệp khai báo ── */
function checkManifest(m, where) {
  const out = [];
  const add = (level, msg) => out.push({ id: 'SC-USER-4', level, where, msg });
  for (const e of validate(SCHEMA, SCHEMA, m)) add('fail', e);
  if (out.length) return out;
  const core = new Set(m.core_permissions ?? []);
  const own = new Map(m.permissions.map((p) => [p.key, p]));
  const known = (k) => core.has(k) || own.has(k);

  for (const p of m.permissions) {
    const prefix = p.key.split(':')[0];
    if (p.module && prefix !== p.module) add('fail', `quyền ${p.key}: tiền tố khác module "${p.module}"`);
    if (core.has(p.key)) add('fail', `quyền ${p.key} trùng quyền nền`);
    const v = verbOf(p.key);
    if (LEGACY_VERBS.includes(v)) add('info', `quyền ${p.key} dùng động từ kiểu cũ "${v}" — quyền mới đặt theo <module>:<chức-năng>-<${VERBS.slice(0, 8).join('|')}…>`);
    else if (ENGLISH_VERBS.includes(v)) add('warn', `quyền ${p.key}: động từ tiếng Anh "${v}" — tên quyền dùng tiếng Việt không dấu (R-USER-7), ví dụ ${p.key.split(':')[0]}:<chức-năng>-lap`);
    else if (!VERBS.includes(v)) add('info', `quyền ${p.key}: động từ nghiệp vụ "${v}" (ngoài danh sách thao tác màn ${VERBS.join(', ')}) — được, miễn là tiếng Việt không dấu`);
  }
  const seenRole = new Set();
  for (const r of m.roles) {
    if (seenRole.has(r.key)) add('fail', `vai ${r.key} khai hai lần`);
    seenRole.add(r.key);
    if (r.key === 'owner') add('fail', 'vai owner thuộc nền, app không khai lại');
    for (const k of r.permissions) if (!known(k)) add('fail', `vai ${r.key} trỏ quyền không có: ${k}`);
    if (!r.permissions.length && !r.admin) add('warn', `vai ${r.key} không có quyền nào`);
    if (r.admin) add('warn', `vai ${r.key} là vai quản trị (nhận mọi quyền) — chỉ owner nên có cờ này`);
  }
  for (const [scope, perms] of Object.entries(m.api_scopes ?? {})) {
    for (const k of perms) {
      if (!known(k)) add('fail', `phạm vi khoá ${scope} trỏ quyền không có: ${k}`);
      else if (own.get(k)?.risk === 'high') add('fail', `phạm vi khoá ${scope} mang quyền rủi ro cao ${k} (khoá API không bao giờ có quyền rủi ro cao)`);
    }
  }
  const metaSeen = new Set();
  for (const u of m.user_meta ?? []) {
    if (metaSeen.has(u.key)) add('fail', `khoá user meta ${u.key} khai hai lần`);
    metaSeen.add(u.key);
    const bad = FORBIDDEN_META.find((w) => u.key.split(/[._]/).includes(w));
    if (bad) add('fail', `khoá user meta ${u.key} chứa từ cấm "${bad}" — quyền, vai, tiền, trạng thái, bí mật không nằm ở user meta`);
  }
  for (const s of m.settings ?? []) if (!known(s.permission)) add('fail', `cài đặt ${s.key} gác bằng quyền không có: ${s.permission}`);
  return out;
}

/* ── SC-USER-5: repo ── */
function checkRepo(dir) {
  const out = [];
  const name = basename(resolve(dir));
  const add = (id, level, where, msg) => out.push({ id, level, where: `${name}/${where}`, msg });
  let app = null;
  try { app = JSON.parse(readFileSync(join(dir, 'bizcity.app.json'), 'utf8')); } catch { /* spine-check báo */ }
  const node = app?.runtime === 'node-ts';

  // bảng người dùng / vai tự tạo
  for (const mdir of ['db/migrations', ...(existsSync(join(dir, 'modules')) ? readdirSync(join(dir, 'modules')).map((m) => `modules/${m}/migrations`) : [])]) {
    const full = join(dir, mdir);
    if (!existsSync(full)) continue;
    for (const f of readdirSync(full).filter((x) => x.endsWith('.sql'))) {
      const sql = readFileSync(join(full, f), 'utf8');
      for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z_]+)"?/gi)) {
        if (!PLATFORM_TABLES.includes(m[1].toLowerCase())) continue;
        const origin = ORIGIN_APPS[app?.id];
        if (origin) add('SC-USER-5', 'info', `${mdir}/${f}`, `tạo bảng ${m[1]} — repo này là nguồn gốc của bảng nền; miễn tới ${origin}`);
        else add('SC-USER-5', node ? 'fail' : 'warn', `${mdir}/${f}`, `tạo bảng ${m[1]} — người dùng / vai / quyền dùng bảng của @bizcity/platform (R-USER-2)`);
      }
    }
  }
  // tệp khai báo
  const mf = join(dir, 'bizcity.authz.json');
  if (!existsSync(mf)) add('SC-USER-5', 'warn', 'bizcity.authz.json', node ? 'chưa có tệp khai báo quyền / vai — sinh bằng authzManifest() của @bizcity/platform' : 'chưa có tệp khai báo quyền / vai (plugin WordPress: viết tay theo bizcity_authz_manifest@1)');
  else {
    let m;
    try { m = JSON.parse(readFileSync(mf, 'utf8')); } catch (e) { add('SC-USER-4', 'fail', 'bizcity.authz.json', 'không đọc được JSON: ' + e.message); return out; }
    if (app?.id && m.app !== app.id) add('SC-USER-4', 'fail', 'bizcity.authz.json', `app "${m.app}" khác id "${app.id}" trong bizcity.app.json`);
    out.push(...checkManifest(m, `${name}/bizcity.authz.json`));
  }
  return out;
}

/* ── SC-USER-6: vector ── */
function checkVectors() {
  const out = [];
  const dir = join(USERS_DIR, 'vectors');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.vectors.json'))) {
    for (const c of JSON.parse(readFileSync(join(dir, f), 'utf8')).cases) {
      c.valid.forEach((v, i) => {
        const e = [...validate(SCHEMA, SCHEMA, v), ...(c.cross ? checkManifest(v, 'v').filter((x) => x.level === 'fail').map((x) => x.msg) : [])];
        if (e.length) out.push({ id: 'SC-USER-6', level: 'fail', where: `${c.name} valid[${i}]`, msg: 'bị từ chối: ' + e.join('; ') });
      });
      c.invalid.forEach((v, i) => {
        const e = c.cross ? checkManifest(v, 'v').filter((x) => x.level === 'fail') : validate(SCHEMA, SCHEMA, v);
        if (e.length === 0) out.push({ id: 'SC-USER-6', level: 'fail', where: `${c.name} invalid[${i}]`, msg: 'lọt: ' + JSON.stringify(v).slice(0, 160) });
      });
    }
  }
  return out;
}

/* ── chạy ── */
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const after = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args.slice(i + 1).filter((a) => !a.startsWith('--')) : []; };
const manifests = after('--manifest');
const repos = after('--repo');
let findings, checkIds, scope;
if (repos.length) { findings = repos.flatMap((r) => checkRepo(resolve(r))); checkIds = ['SC-USER-4', 'SC-USER-5']; scope = repos.map((r) => basename(resolve(r))); }
else if (manifests.length) {
  findings = manifests.flatMap((f) => { try { return checkManifest(JSON.parse(readFileSync(resolve(f), 'utf8')), basename(f)); } catch (e) { return [{ id: 'SC-USER-4', level: 'fail', where: basename(f), msg: 'không đọc được: ' + e.message }]; } });
  checkIds = ['SC-USER-4']; scope = manifests.map((f) => basename(f));
} else { findings = checkVectors(); checkIds = ['SC-USER-6']; scope = 'vectors'; }
const shown = findings.filter((f) => f.level !== 'info' || args.includes('--info'));
const fails = findings.filter((f) => f.level === 'fail').length;
const checks = checkIds.map((id) => ({ id, status: findings.some((f) => f.id === id && f.level === 'fail') ? 'fail' : (findings.some((f) => f.id === id && f.level === 'warn') ? 'warn' : 'pass') }));
const result = {
  schema: 'bizcity_conformance_report@1', tool: 'users-check', tool_version: '1.0.0', standard: 'bizcity_standard_map@1',
  ran_at: new Date().toISOString(), lane: 'HOUSE', scope, checks, findings, verdict: fails ? 'KHÔNG ĐẠT' : 'ĐẠT',
};
if (asJson) console.log(JSON.stringify(result, null, 2));
else {
  for (const f of shown) console.log(`${f.level === 'fail' ? '✗' : f.level === 'warn' ? '!' : '·'} ${f.id} ${f.where}: ${f.msg}`);
  const info = findings.length - shown.length;
  console.log(`KẾT LUẬN: ${result.verdict} (${findings.length} phát hiện, ${fails} chặn${info ? `, ${info} ghi chú ẩn — thêm --info để xem` : ''})`);
}
process.exit(fails ? 1 : 0);
