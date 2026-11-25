#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer platform
// [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — bộ kiểm lane HOUSE cho bản đồ chuẩn nền (docs/standard/README.md): tự kiểm sổ chuẩn (SC-STD-0) và kiểm khuôn của một repo app (SC-STD-1..3, SC-STD-REL-1, SC-SEC-P1). Không phụ thuộc gói ngoài (R-PLAT-5).
//
//   node tools/standard-check.mjs                    # tự kiểm sổ chuẩn: standards.json ↔ tệp chuẩn ↔ bản đồ ↔ liên kết (SC-STD-0)
//   node tools/standard-check.mjs --repo <thư mục…>  # kiểm khuôn một hay nhiều repo app, in mức S0–S2
//   node tools/standard-check.mjs --json             # kết quả theo bizcity_conformance_report@1
//
// Kết luận theo cổng: một phát hiện mức fail là KHÔNG ĐẠT (mã thoát 1). Chỉ đọc tệp; không chạy mã của repo được kiểm.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib/json-schema.mjs';

const STD_DIR = join(ROOT, 'docs/standard');
const MAP_LINK = 'bizcity-platform/blob/main/docs/standard/README.md';
const CANON_LINK = 'open-hub/blob/main/docs/canon';
// Tệp trỏ canon: app Node dùng docs/canon/README.md; plugin WordPress hiện đặt CANON-SPINE.md ở gốc hoặc docs/developer/.
const POINTERS = ['docs/canon/README.md', 'docs/00-CANON.md', 'CANON-SPINE.md', 'docs/developer/CANON-SPINE.md'];
const read = (p) => readFileSync(p, 'utf8');
const has = (p) => existsSync(p);

/* ── SC-STD-0: sổ chuẩn tự nhất quán ── */
function checkRegistry() {
  const out = [];
  const bad = (where, msg, level = 'fail') => out.push({ id: 'SC-STD-0', level, where, msg });
  let reg;
  try { reg = JSON.parse(read(join(STD_DIR, 'standards.json'))); } catch (e) { bad('standards.json', 'không đọc được JSON: ' + e.message); return out; }
  const map = read(join(STD_DIR, 'README.md'));
  const registered = new Set();
  const ids = new Set();
  for (const s of reg.standards || []) {
    if (ids.has(s.id)) bad('standards.json', `trùng id ${s.id}`);
    ids.add(s.id);
    registered.add(s.file);
    const p = join(STD_DIR, s.file);
    if (!has(p)) { bad(s.file, 'có trong sổ nhưng không có tệp'); continue; }
    const m = /\*\*Phiên bản:\*\*\s*([0-9]+\.[0-9]+\.[0-9]+(?:-draft)?)/.exec(read(p));
    if (!m) bad(s.file, 'không thấy dòng "**Phiên bản:** x.y.z"');
    else if (m[1] !== s.version) bad(s.file, `phiên bản trong tệp ${m[1]} ≠ sổ ${s.version}`);
    if ((s.status === 'draft') !== s.version.endsWith('-draft')) bad(s.file, `trạng thái ${s.status} không khớp hậu tố phiên bản ${s.version}`);
    if (!map.includes(`(${s.file})`)) bad('README.md', `bản đồ chưa trỏ tới ${s.file}`);
    if (s.tool && !has(join(ROOT, s.tool))) bad('standards.json', `${s.id}: công cụ ${s.tool} không có`);
  }
  for (const f of readdirSync(STD_DIR)) if (/^BIZCITY-.+-v[0-9]+\.md$/.test(f) && !registered.has(f)) bad(f, 'tệp chuẩn chưa đăng ký trong standards.json');
  for (const q of reg.open_questions || []) if (!map.includes(q)) bad('README.md', `câu hỏi mở ${q} có trong sổ nhưng không có ở bản đồ §6`);
  // liên kết tương đối trong tài liệu chuẩn phải tới tệp có thật
  const docs = [...readdirSync(STD_DIR).filter((f) => f.endsWith('.md')).map((f) => join(STD_DIR, f)), join(ROOT, 'docs/ARCHITECTURE.md')];
  for (const d of docs) {
    if (!has(d)) { bad(basename(d), 'thiếu tệp'); continue; }
    for (const m of read(d).matchAll(/\]\(([^)\s]+)\)/g)) {
      const href = m[1].split('#')[0];
      if (!href || /^[a-z]+:/i.test(href)) continue;
      if (!has(resolve(dirname(d), href))) bad(basename(d), `liên kết hỏng: ${m[1]}`);
    }
  }
  return out;
}

/* ── Kiểm khuôn một repo app ── */
function checkRepo(dir) {
  const out = [];
  const name = basename(resolve(dir));
  const add = (id, level, where, msg) => out.push({ id, level, where: `${name}/${where}`, msg });
  const p = (...x) => join(dir, ...x);
  if (!has(dir) || !statSync(dir).isDirectory()) { add('SC-STD-1', 'fail', '', 'không phải thư mục'); return { out, id: null, level: null }; }

  // S0 — manifest (chi tiết do spine-check kiểm; ở đây chỉ cần đọc được để biết loại repo)
  let manifest = null;
  if (!has(p('bizcity.app.json'))) add('SC-STD-1', 'fail', 'bizcity.app.json', 'thiếu manifest (chạy thêm: node tools/spine-check.mjs --manifest)');
  else { try { manifest = JSON.parse(read(p('bizcity.app.json'))); } catch (e) { add('SC-STD-1', 'fail', 'bizcity.app.json', 'không đọc được JSON: ' + e.message); } }
  const runtime = manifest?.runtime || 'other';

  // SC-STD-1 — trỏ canon và bản đồ chuẩn
  const pointer = POINTERS.map((f) => p(f)).find(has);
  if (!pointer) add('SC-STD-1', 'fail', 'docs/canon/README.md', 'thiếu tệp trỏ canon (' + POINTERS.join(', ') + ')');
  else {
    const t = read(pointer), rel = pointer.slice(resolve(dir).length + 1).replace(/\\/g, '/');
    if (!t.includes(CANON_LINK)) add('SC-STD-1', 'fail', rel, 'chưa trỏ canon chung ở open-hub');
    if (!t.includes(MAP_LINK)) add('SC-STD-1', 'fail', rel, `chưa trỏ bản đồ chuẩn nền (${MAP_LINK})`);
  }

  // SC-STD-2 — khuôn tài liệu tối thiểu
  // App Node: thiếu là chặn. Plugin WordPress: cảnh báo (nhiều plugin dùng readme.txt, CLAUDE.md).
  const hard = runtime === 'node-ts' ? 'fail' : 'warn';
  if (!['README.md', 'readme.txt', 'readme.md'].some((f) => has(p(f)))) add('SC-STD-2', hard, 'README.md', 'thiếu');
  if (!['AGENTS.md', 'CLAUDE.md'].some((f) => has(p(f)))) add('SC-STD-2', hard, 'AGENTS.md', 'thiếu hướng dẫn cho người và agent (AGENTS.md hoặc CLAUDE.md)');
  for (const f of ['CHANGELOG.md', 'LICENSE']) if (!has(p(f))) add('SC-STD-2', 'warn', f, 'thiếu');
  if (runtime === 'node-ts' && !has(p('docs/phases/CLAIMS.md'))) add('SC-STD-2', 'warn', 'docs/phases/CLAIMS.md', 'app Node chưa có bảng giữ chỗ (R-FLOW)');

  // SC-STD-3 — repo khai được lệnh kiểm của mình
  let pkg = null;
  if (has(p('package.json'))) { try { pkg = JSON.parse(read(p('package.json'))); } catch { /* bỏ qua */ } }
  const selfcheck = has(p('tests/conformance/selfcheck.mjs'));
  const anyTest = selfcheck || Boolean(pkg?.scripts?.test) || (has(p('tests')) && readdirSync(p('tests')).some((f) => /\.(php|mjs|js|ts)$/.test(f)));
  if (!anyTest) add('SC-STD-3', 'warn', 'tests/', 'không thấy selfcheck, script test hay tệp test nào');
  else if (runtime === 'node-ts' && !selfcheck) add('SC-STD-3', 'warn', 'tests/conformance/selfcheck.mjs', 'app Node chưa có selfcheck (R-STD-TEST-1)');

  // SC-STD-REL-1 — changelog và phiên bản
  if (has(p('CHANGELOG.md')) && !/Chưa phát hành|Unreleased/i.test(read(p('CHANGELOG.md')))) add('SC-STD-REL-1', 'warn', 'CHANGELOG.md', 'thiếu mục "Chưa phát hành"');
  if (manifest?.version && pkg?.version && manifest.version !== pkg.version) add('SC-STD-REL-1', 'warn', 'bizcity.app.json', `version ${manifest.version} ≠ package.json ${pkg.version}`);

  // SC-SEC-P1 — bí mật
  for (const f of ['docker-compose.yml', 'docker-compose.yaml']) {
    if (!has(p(f))) continue;
    const m = /JWT_SECRET:\s*\$\{JWT_SECRET:-[^}]+\}/.exec(read(p(f)));
    if (m) add('SC-SEC-P1', 'fail', f, 'JWT_SECRET có giá trị mặc định trong compose (R-TEN-7: phải dừng khi thiếu, dùng ${JWT_SECRET:?…})');
  }
  if (has(p('.git'))) {
    try {
      const tracked = execFileSync('git', ['-C', dir, 'ls-files', '.env', '.env.local', '.env.production'], { encoding: 'utf8' }).trim();
      if (tracked) add('SC-SEC-P1', 'fail', tracked.split('\n')[0], 'tệp .env đang được git theo dõi (R-SEC-1)');
    } catch { /* không có git: bỏ qua */ }
  }

  // mức S: S0 có manifest đọc được · S1 thêm SC-STD-1/2 không fail · S2 thêm có selfcheck / test, không cảnh báo SC-STD-3
  const failed = (id) => out.some((f) => f.id === id && f.level === 'fail');
  const warned = (id) => out.some((f) => f.id === id);
  let level = null;
  if (manifest) { level = 'S0'; if (!failed('SC-STD-1') && !failed('SC-STD-2') && !failed('SC-SEC-P1')) { level = 'S1'; if (!warned('SC-STD-3')) level = 'S2'; } }
  return { out, id: manifest?.id || null, level };
}

/* ── chạy ── */
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const ri = args.indexOf('--repo');
const repos = ri >= 0 ? args.slice(ri + 1).filter((a) => !a.startsWith('--')) : [];
let findings = [], checkIds, level, appId;
const rows = [];
if (repos.length) {
  checkIds = ['SC-STD-1', 'SC-STD-2', 'SC-STD-3', 'SC-STD-REL-1', 'SC-SEC-P1'];
  for (const r of repos) { const x = checkRepo(resolve(r)); findings.push(...x.out); rows.push({ repo: basename(resolve(r)), level: x.level, fails: x.out.filter((f) => f.level === 'fail').length, warns: x.out.filter((f) => f.level === 'warn').length }); if (repos.length === 1) { level = x.level; appId = x.id; } }
} else { checkIds = ['SC-STD-0']; findings = checkRegistry(); }
const fails = findings.filter((f) => f.level === 'fail').length;
const checks = checkIds.map((id) => ({ id, status: findings.some((f) => f.id === id && f.level === 'fail') ? 'fail' : (findings.some((f) => f.id === id && f.level === 'warn') ? 'warn' : 'pass') }));
const result = {
  schema: 'bizcity_conformance_report@1', tool: 'standard-check', tool_version: '1.0.0', standard: 'bizcity_standard_map@1',
  ran_at: new Date().toISOString(), lane: 'HOUSE',
  ...(appId ? { app_id: appId } : {}),
  scope: repos.length ? repos : 'registry',
  ...(level && !fails ? { level } : {}),
  checks, findings, verdict: fails ? 'KHÔNG ĐẠT' : 'ĐẠT',
};
if (asJson) console.log(JSON.stringify(result, null, 2));
else {
  for (const f of findings) console.log(`${f.level === 'fail' ? '✗' : '!'} ${f.id} ${f.where}: ${f.msg}`);
  for (const r of rows) console.log(`  ${r.repo.padEnd(26)} mức ${r.level || '—'}   chặn ${r.fails}   cảnh báo ${r.warns}`);
  console.log(`KẾT LUẬN: ${result.verdict} (${findings.length} phát hiện, ${fails} chặn) — ${repos.length ? repos.length + ' repo' : 'sổ chuẩn'}`);
}
process.exit(fails ? 1 : 0);
