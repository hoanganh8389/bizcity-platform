#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer platform
// [2026-11-28 06:41 PM Johnny Chu - Chu Hoàng Anh] STD-LIST-2 — bộ kiểm bizcity_list@1. Không phụ thuộc gói ngoài (R-PLAT-5).
//   node tools/list-check.mjs --self-test            # SC-LIST-1 vector schema (ListDef / ListQuery / ListPage / ListExport) + SC-LIST-2 URL ⇄ JSON hai chiều
//   node tools/list-check.mjs --target <gốc API> --list <đường danh sách> --key <khoá API>   # SC-LIST-3 CONTRACT (hộp đen, chỉ đọc): trang đúng ListPage, con trỏ đi được, lọc sai ⇒ 400 có field
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, print, validate } from './lib/json-schema.mjs';
import { formatListQuery, parseListQuery } from './lib/list-query.mjs';

const DIR = join(ROOT, 'schema/list');
const SCHEMA = JSON.parse(readFileSync(join(DIR, 'list.schema.json'), 'utf8'));
const V = JSON.parse(readFileSync(join(DIR, 'vectors/list.vectors.json'), 'utf8'));
const check = (def, v) => validate(SCHEMA, { $ref: `#/$defs/${def}` }, v);
const out = [];
const bad = (id, where, msg) => out.push({ id, level: 'fail', where, msg });

function selfTest() {
  for (const c of V.cases) {
    c.valid.forEach((v, i) => { const e = check(c.def, v); if (e.length) bad('SC-LIST-1', `${c.name} valid[${i}]`, 'bị từ chối: ' + e.join('; ')); });
    c.invalid.forEach((v, i) => { if (!check(c.def, v).length) bad('SC-LIST-1', `${c.name} invalid[${i}]`, 'lọt: ' + JSON.stringify(v)); });
  }
  for (const [i, u] of V.url.entries()) {
    let got; try { got = parseListQuery(u.url); } catch (e) { bad('SC-LIST-2', `url[${i}]`, `không đọc được: ${e.message}`); continue; }
    if (JSON.stringify(got) !== JSON.stringify(u.query)) bad('SC-LIST-2', `url[${i}] → JSON`, `${JSON.stringify(got)} ≠ ${JSON.stringify(u.query)}`);
    const e = check('ListQuery', got); if (e.length) bad('SC-LIST-2', `url[${i}]`, 'JSON không đúng ListQuery: ' + e.join('; '));
    const back = parseListQuery(formatListQuery(got));
    if (JSON.stringify(back) !== JSON.stringify(got)) bad('SC-LIST-2', `url[${i}] JSON → URL → JSON`, 'không về như cũ');
  }
  for (const u of V.urlInvalid) { try { const q = parseListQuery(u); if (!check('ListQuery', q).length) bad('SC-LIST-2', `urlInvalid ${u}`, 'lọt'); } catch { /* đúng: bị chặn */ } }
  const std = readFileSync(join(ROOT, 'docs/standard/BIZCITY-LIST-v1.md'), 'utf8');
  for (const d of Object.keys(SCHEMA.$defs).filter((k) => /^[A-Z]/.test(k))) if (!std.includes(d)) bad('SC-LIST-1', 'BIZCITY-LIST-v1.md', `chuẩn chưa nhắc ${d} của schema`);
}

async function contract(target, list, key) {
  const get = async (q) => { const r = await fetch(`${target.replace(/\/$/, '')}${list}${q ? '?' + q : ''}`, { headers: { authorization: `Bearer ${key}` } }); return { status: r.status, body: await r.json().catch(() => null) }; };
  const p1 = await get('limit=2');
  if (p1.status !== 200) return bad('SC-LIST-3', list, `trang đầu ${p1.status}`);
  const e = check('ListPage', p1.body); if (e.length) bad('SC-LIST-3', list, 'không đúng ListPage: ' + e.join('; '));
  if (p1.body?.meta?.nextCursor) { const p2 = await get(`limit=2&cursor=${p1.body.meta.nextCursor}`); if (p2.status !== 200) bad('SC-LIST-3', list, `trang 2 bằng con trỏ ${p2.status}`); }
  const wrong = await get('f.khong_co_cot.eq=1');
  if (wrong.status !== 400 || !String(JSON.stringify(wrong.body?.error ?? {})).includes('f.khong_co_cot')) bad('SC-LIST-3', list, `lọc cột lạ phải 400 VALIDATION_ERROR có field — được ${wrong.status}`);
}

const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
if (process.argv.includes('--self-test') || !arg('target')) selfTest();
else await contract(arg('target'), arg('list'), arg('key'));
const lane = process.argv.includes('--self-test') || !arg('target') ? 'vector' : 'contract';
const ids = lane === 'vector' ? ['SC-LIST-1', 'SC-LIST-2'] : ['SC-LIST-3'];
const fails = out.filter((x) => x.level === 'fail').length;
const result = { schema: 'bizcity_conformance_report@1', tool: 'list-check', tool_version: '0.1.0', standard: 'bizcity_list@1', ran_at: new Date().toISOString(), lane, scope: lane === 'vector' ? 'schema/list' : arg('target'),
  checks: ids.map((id) => ({ id, status: out.some((x) => x.id === id && x.level === 'fail') ? 'fail' : 'pass' })), findings: out, verdict: fails ? 'KHÔNG ĐẠT' : 'ĐẠT' };
process.exitCode = print(result, process.argv.includes('--json'));
