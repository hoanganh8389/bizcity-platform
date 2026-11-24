#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer platform
// [2026-11-24 06:05 PM Johnny Chu - Chu Hoàng Anh] SPINE-2 — chuẩn đã duyệt: bỏ -draft, cảnh báo manifest còn -draft.
// [2026-11-24 05:08 PM Johnny Chu - Chu Hoàng Anh] SPINE-1 — bộ kiểm lane MANIFEST cho bizcity_spine@1: SC-SPINE-2 (vector schema) + SC-SPINE-1 (bizcity.app.json + luật chéo §5). Không phụ thuộc gói ngoài (R-PLAT-5): bộ kiểm JSON Schema tối thiểu đủ cho schema của spine.
//
//   node tools/spine-check.mjs                       # kiểm vector (SC-SPINE-2)
//   node tools/spine-check.mjs --manifest <tệp…>     # kiểm bizcity.app.json của repo khác (SC-SPINE-1)
//   node tools/spine-check.mjs --json                # in kết quả JSON theo bizcity_conformance_report@1 (cho CI / bizcity.vn)
//
// Kết luận ĐẠT / KHÔNG ĐẠT theo cổng: một phát hiện mức fail là KHÔNG ĐẠT (mã thoát 1).

import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
// [2026-11-24 08:10 PM Johnny Chu - Chu Hoàng Anh] SPINE-4 — bộ kiểm JSON Schema dùng chung với spine-contract (tools/lib/json-schema.mjs); bỏ bản sao ở tệp này.
import { SCHEMA_DIR, loadSchema, validate } from './lib/json-schema.mjs';

/* ── Trục chuẩn và chủ (BIZCITY-SPINE-v1.md §2). Trục sổ riêng của app không nằm đây. ── */
const AXIS_OWNER = {
  tenant: 'bizcity-open-setup',
  user: 'bizcity-wordpress',
  item: 'open-ketoan',
  uom: 'open-ketoan',
  branch: 'open-ketoan',
  partner: 'open-ketoan',
  contact: 'open-cake',
  document: '*', // mỗi app làm chủ chứng từ mình phát hành
};
const FREE_LICENSES = ['GPL-2.0-or-later', 'GPL-2.0-only', 'GPL-3.0-or-later', 'AGPL-3.0-or-later', 'MIT', 'Apache-2.0'];

/* ── SC-SPINE-2: vector ── */
function checkVectors() {
  const out = [];
  const dir = join(SCHEMA_DIR, 'vectors');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.vectors.json'))) {
    const { cases } = JSON.parse(readFileSync(join(dir, f), 'utf8'));
    for (const c of cases) {
      const root = loadSchema(c.schema);
      const schema = c.def ? root.$defs[c.def] : root;
      if (!schema) { out.push({ id: 'SC-SPINE-2', level: 'fail', where: `${f} › ${c.name}`, msg: `không có $defs.${c.def} trong ${c.schema}` }); continue; }
      c.valid.forEach((v, i) => {
        const e = validate(root, schema, v);
        if (e.length) out.push({ id: 'SC-SPINE-2', level: 'fail', where: `${c.name} valid[${i}]`, msg: 'bị từ chối: ' + e.join('; ') });
      });
      c.invalid.forEach((v, i) => {
        if (validate(root, schema, v).length === 0) out.push({ id: 'SC-SPINE-2', level: 'fail', where: `${c.name} invalid[${i}]`, msg: 'lọt: ' + JSON.stringify(v) });
      });
    }
  }
  return out;
}

/* ── SC-SPINE-1: manifest + luật chéo §5 ── */
function checkManifest(file) {
  const out = [];
  const where = file;
  let m;
  try { m = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { return [{ id: 'SC-SPINE-1', level: 'fail', where, msg: 'không đọc được JSON: ' + e.message }]; }
  const root = loadSchema('app-manifest.schema.json');
  for (const e of validate(root, root, m)) out.push({ id: 'SC-SPINE-1', level: 'fail', where, msg: e });
  if (out.length) return out;

  const { owns = [], uses = [], replica = [], local = [] } = m.axes;
  const both = owns.filter((a) => uses.includes(a));
  if (both.length) out.push({ id: 'SC-SPINE-1', level: 'fail', where, msg: `trục vừa owns vừa uses: ${both.join(', ')}` });
  for (const a of owns) {
    const owner = AXIS_OWNER[a];
    if (owner && owner !== '*' && owner !== m.id) out.push({ id: 'SC-SPINE-1', level: 'fail', where, msg: `trục "${a}" do ${owner} làm chủ, ${m.id} không được owns` });
  }
  for (const a of uses) if (!(a in AXIS_OWNER)) out.push({ id: 'SC-SPINE-1', level: 'warn', where, msg: `uses trục "${a}" không có trong §2 (trục sổ riêng của app khác?)` });
  for (const a of replica) if (!uses.includes(a)) out.push({ id: 'SC-SPINE-1', level: 'fail', where, msg: `replica "${a}" phải nằm trong uses` });
  for (const a of local) {
    if (!uses.includes(a)) out.push({ id: 'SC-SPINE-1', level: 'fail', where, msg: `local "${a}" phải nằm trong uses` });
    const rc = `RC-SPINE-${a}`;
    if (!(m.sync?.reconcile || []).includes(rc)) out.push({ id: 'SC-SPINE-1', level: 'fail', where, msg: `local "${a}" cần phép đối chiếu ${rc} (R-SPINE-9)` });
  }
  for (const a of m.sync?.outbox || []) if (!owns.includes(a)) out.push({ id: 'SC-SPINE-1', level: 'fail', where, msg: `outbox "${a}" chỉ cho trục mình làm chủ (R-SPINE-7)` });
  if (FREE_LICENSES.includes(m.license) && m.paid === true) out.push({ id: 'SC-SPINE-1', level: 'fail', where, msg: 'license mở nhưng paid=true — mọi ứng dụng Bizcity Open 0đ (chủ chốt 2026-11-24)' });
  if (!m.contracts.some((c) => c.startsWith('bizcity_spine@'))) out.push({ id: 'SC-SPINE-1', level: 'warn', where, msg: 'chưa khai bizcity_spine@1' });
  // [2026-11-24 06:05 PM Johnny Chu - Chu Hoàng Anh] SPINE-2 — chuẩn đã duyệt: còn ghi -draft thì nhắc đổi.
  if (String(m.schema).endsWith('-draft') || m.contracts.some((c) => c.endsWith('-draft'))) out.push({ id: 'SC-SPINE-1', level: 'warn', where, msg: 'còn hậu tố -draft; chuẩn đã duyệt 2026-11-24, đổi sang bizcity_app@1 / bizcity_spine@1' });
  return out;
}

/* ── chạy ── */
const args = process.argv.slice(2);
const asJson = args.includes('--json');
const mi = args.indexOf('--manifest');
const manifests = mi >= 0 ? args.slice(mi + 1).filter((a) => !a.startsWith('--')) : [];
const findings = manifests.length ? manifests.flatMap((f) => checkManifest(resolve(f))) : checkVectors();
const fails = findings.filter((f) => f.level === 'fail').length;
// [2026-11-24 08:10 PM Johnny Chu - Chu Hoàng Anh] SPINE-4 — kết quả theo bizcity_conformance_report@1 (schema/spine/conformance-report.schema.json): bizcity.vn đọc tệp này để hiện nhãn.
const checkIds = manifests.length ? ['SC-SPINE-1'] : ['SC-SPINE-2'];
const checks = checkIds.map((id) => ({ id, status: findings.some((f) => f.id === id && f.level === 'fail') ? 'fail' : (findings.some((f) => f.id === id && f.level === 'warn') ? 'warn' : 'pass') }));
const appIds = manifests.map((f) => { try { return JSON.parse(readFileSync(resolve(f), 'utf8')).id; } catch { return null; } }).filter(Boolean);
const result = {
  schema: 'bizcity_conformance_report@1', tool: 'spine-check', tool_version: '1.1.0', standard: 'bizcity_spine@1',
  ran_at: new Date().toISOString(), lane: 'MANIFEST',
  ...(appIds.length === 1 ? { app_id: appIds[0] } : {}),
  scope: manifests.length ? manifests : 'vectors',
  ...(manifests.length && !fails ? { level: 'C0' } : {}),
  checks, findings, verdict: fails ? 'KHÔNG ĐẠT' : 'ĐẠT',
};
if (asJson) console.log(JSON.stringify(result, null, 2));
else {
  for (const f of findings) console.log(`${f.level === 'fail' ? '✗' : '!'} ${f.id} ${f.where}: ${f.msg}`);
  console.log(`KẾT LUẬN: ${result.verdict} (${findings.length} phát hiện, ${fails} chặn) — ${manifests.length ? manifests.length + ' manifest' : 'vector'}`);
}
process.exit(fails ? 1 : 0);
