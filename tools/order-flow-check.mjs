#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer platform
// [2026-11-25 06:00 PM Johnny Chu - Chu Hoàng Anh] ORDER-2 — bộ kiểm bizcity_order_flow@1 (docs/standard/BIZCITY-ORDER-FLOW-v1.md). Không phụ thuộc gói ngoài (R-PLAT-5).
//
//   node tools/order-flow-check.mjs                                   # HOUSE: vector (SC-ORD-1) + chuẩn ↔ schema (SC-ORD-2)
//   node tools/order-flow-check.mjs --profile receiver --target <gốc site POS> --key <opb_…> --secret <bí mật>
//        --tenant <slug> --branch <mã> --item-code <SKU có thật> --allow-write        # CONTRACT bên nhận đơn chờ (SC-ORD-3) — CHỈ bản thử
//   node tools/order-flow-check.mjs --profile stock --target <gốc API Kế Toán> --key <kt_…> --branch <mã> --skus <a,b>  # CONTRACT đọc tồn (SC-ORD-4)
//   node tools/order-flow-check.mjs --self-test                       # dựng bên nhận / Kế Toán giả ĐÚNG và SAI: bộ kiểm phải phân biệt được
//   thêm --json: kết quả theo bizcity_conformance_report@1. Một phát hiện mức fail là KHÔNG ĐẠT (mã thoát 1).

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, print, validate } from './lib/json-schema.mjs';

const ORDER_DIR = join(ROOT, 'packages/contracts/schema/order');
const SCHEMA = JSON.parse(readFileSync(join(ORDER_DIR, 'order-flow.schema.json'), 'utf8'));
const STD = readFileSync(join(ROOT, 'docs/standard/BIZCITY-ORDER-FLOW-v1.md'), 'utf8');
const RECEIVER_PATH = '/wp-json/open-pos/v1/order-requests';
const STOCK_PATH = '/api/v1/inventory/availability';
const check = (def, v) => validate(SCHEMA, { $ref: `#/$defs/${def}` }, v);
const result = (lane, scope, checkIds, findings) => {
  const fails = findings.filter((f) => f.level === 'fail').length;
  return {
    schema: 'bizcity_conformance_report@1', tool: 'order-flow-check', tool_version: '1.0.0', standard: 'bizcity_order_flow@1',
    ran_at: new Date().toISOString(), lane, scope,
    checks: checkIds.map((id) => ({ id, status: findings.some((f) => f.id === id && f.level === 'fail') ? 'fail' : 'pass' })),
    findings, verdict: fails ? 'KHÔNG ĐẠT' : 'ĐẠT',
  };
};

/* ── SC-ORD-1: vector ── */
function checkVectors() {
  const out = [];
  for (const f of readdirSync(join(ORDER_DIR, 'vectors')).filter((x) => x.endsWith('.vectors.json'))) {
    for (const c of JSON.parse(readFileSync(join(ORDER_DIR, 'vectors', f), 'utf8')).cases) {
      c.valid.forEach((v, i) => { const e = check(c.def, v); if (e.length) out.push({ id: 'SC-ORD-1', level: 'fail', where: `${c.name} valid[${i}]`, msg: 'bị từ chối: ' + e.join('; ') }); });
      c.invalid.forEach((v, i) => { if (!check(c.def, v).length) out.push({ id: 'SC-ORD-1', level: 'fail', where: `${c.name} invalid[${i}]`, msg: 'lọt: ' + JSON.stringify(v).slice(0, 160) }); });
    }
  }
  return out;
}

/* ── SC-ORD-2: chuẩn ↔ schema ── */
function checkStandard() {
  const out = [];
  const section = (n) => STD.split(/\n## /).find((s) => s.startsWith(`${n}.`)) ?? '';
  const inDoc = new Set([...section(5).matchAll(/`(pos\.order(?:_request)?\.[a-z_]+)`/g)].map((m) => m[1]));
  const inSchema = new Set(SCHEMA.$defs.event.properties.type.enum);
  for (const t of inSchema) if (!inDoc.has(t)) out.push({ id: 'SC-ORD-2', level: 'fail', where: 'chuẩn §5', msg: `thiếu loại sự kiện ${t} có trong schema` });
  for (const t of inDoc) if (!inSchema.has(t)) out.push({ id: 'SC-ORD-2', level: 'fail', where: 'schema $defs.event', msg: `thiếu loại sự kiện ${t} có trong chuẩn §5` });
  for (const s of SCHEMA.$defs.status.enum) if (!new RegExp(`\\b${s}\\b`).test(section(4))) out.push({ id: 'SC-ORD-2', level: 'fail', where: 'chuẩn §4', msg: `trạng thái ${s} của schema không có trong máy trạng thái` });
  return out;
}

/* ── tiện ích HTTP ── */
const sign = (secret, body, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ulid = () => [...randomBytes(26)].map((b) => CROCKFORD[b % 32]).join('');
async function call(base, method, path, { body, headers = {} } = {}) {
  const raw = body === undefined ? undefined : JSON.stringify(body);
  const res = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...headers }, body: raw });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

/* ── SC-ORD-3: bên nhận đơn chờ (hộp đen) ── */
async function checkReceiver(o) {
  const out = [];
  const bad = (where, msg) => out.push({ id: 'SC-ORD-3', level: 'fail', where, msg });
  const docRef = `cake.order_request:${ulid()}`;
  const order = (extra = {}, version = 1, itemCode = o.itemCode) => ({
    docRef, version, tenant: o.tenant, branchCode: o.branch, channel: 'other',
    customer: { partner: { code: 'KHACH-LE' }, name: 'ORDERCHK thử bộ kiểm' },
    lines: [{ line: 1, item: { code: itemCode }, uom: o.uom, qty: 1 }],
    payment: { method: 'pay_at_store' }, shipping: { method: 'pickup' }, createdBy: { sub: 'biz:order-flow-check' }, ...extra,
  });
  const post = (path, body, key, { secret = o.secret } = {}) => {
    const raw = JSON.stringify(body);
    return call(o.target, 'POST', path, { body, headers: { authorization: `Bearer ${o.key}`, 'bizcity-signature': sign(secret, raw), ...(key ? { 'idempotency-key': key } : {}) } });
  };
  const posRefOf = (r) => r.json?.data?.posRef;

  const forged = await post(RECEIVER_PATH, order(), `${docRef}@1`, { secret: 'sai-bi-mat' });
  if (forged.status !== 401) bad('chữ ký sai', `cần 401, nhận ${forged.status}`);
  const first = await post(RECEIVER_PATH, order(), `${docRef}@1`);
  if (first.status !== 202) { bad('gửi đơn', `cần 202, nhận ${first.status} ${JSON.stringify(first.json).slice(0, 160)}`); return out; }
  const e = check('accepted', first.json?.data);
  if (e.length) bad('gửi đơn', 'trả lời sai khuôn: ' + e.join('; '));
  if (first.json?.data?.status !== 'pending') bad('gửi đơn', `trạng thái phải pending, nhận ${first.json?.data?.status}`);
  const again = await post(RECEIVER_PATH, order(), `${docRef}@1`);
  if (posRefOf(again) !== posRefOf(first)) bad('gửi lặp', `cùng khoá phải cùng posRef (${posRefOf(first)} ≠ ${posRefOf(again)}) — R-STD-ORD-6`);
  const conflict = await post(RECEIVER_PATH, order({ note: 'khác thân' }), `${docRef}@1`);
  if (conflict.status !== 409 || conflict.json?.error?.code !== 'IDEMPOTENCY_CONFLICT') bad('cùng khoá khác thân', `cần 409 IDEMPOTENCY_CONFLICT, nhận ${conflict.status} ${conflict.json?.error?.code ?? ''}`);
  const v2 = await post(RECEIVER_PATH, order({ note: 'bản 2' }, 2), `${docRef}@2`);
  if (posRefOf(v2) !== posRefOf(first)) bad('sửa bản 2', `bản mới khi pending phải giữ posRef — R-STD-ORD-7 (nhận ${v2.status} ${posRefOf(v2)})`);
  const unknownRef = `cake.order_request:${ulid()}`;
  const unknown = await post(RECEIVER_PATH, { ...order({}, 1, 'ORDERCHK-KHONG-CO'), docRef: unknownRef }, `${unknownRef}@1`);
  if (unknown.status !== 422 || unknown.json?.error?.code !== 'ORD-ITEM-UNKNOWN') bad('mã hàng lạ', `cần 422 ORD-ITEM-UNKNOWN, nhận ${unknown.status} ${unknown.json?.error?.code ?? ''} — R-STD-ORD-8`);
  const tidRef = `cake.order_request:${ulid()}`;
  const withTenantId = await post(RECEIVER_PATH, { ...order(), docRef: tidRef, tenantId: 1 }, `${tidRef}@1`);
  if (withTenantId.status !== 400) bad('thân có tenantId', `cần 400, nhận ${withTenantId.status} — R-STD-ORD-9`);
  const cancel = await post(`${RECEIVER_PATH}/cancel`, { docRef, reason: 'ORDERCHK dọn ca thử' });
  if (cancel.status !== 200 || cancel.json?.data?.status !== 'cancelled') bad('huỷ khi pending', `cần 200 cancelled, nhận ${cancel.status} ${cancel.json?.data?.status ?? ''}`);
  const read = await call(o.target, 'GET', `${RECEIVER_PATH}?docRefs=${encodeURIComponent(docRef)}`, { headers: { authorization: `Bearer ${o.key}`, 'bizcity-signature': sign(o.secret, '') } });
  const row = read.json?.data?.[0];
  if (read.status !== 200 || !row) bad('đọc trạng thái', `cần 200 + một dòng, nhận ${read.status}`);
  else {
    const re = check('statusRow', row);
    if (re.length) bad('đọc trạng thái', 'sai khuôn: ' + re.join('; '));
    if (row.status !== 'cancelled' || row.version !== 2) bad('đọc trạng thái', `cần cancelled bản 2, nhận ${row.status} bản ${row.version}`);
  }
  return out;
}

/* ── SC-ORD-4: đọc tồn Kế Toán (hộp đen) ── */
async function checkStock(o) {
  const out = [];
  const bad = (where, msg) => out.push({ id: 'SC-ORD-4', level: 'fail', where, msg });
  const q = `${STOCK_PATH}?branchCode=${encodeURIComponent(o.branch)}&skus=${encodeURIComponent(o.skus)}`;
  const anon = await call(o.target, 'GET', q);
  if (anon.status !== 401) bad('không khoá', `cần 401, nhận ${anon.status}`);
  const r = await call(o.target, 'GET', q, { headers: { 'x-api-key': o.key } });
  if (r.status !== 200) { bad('đọc tồn', `cần 200, nhận ${r.status}`); return out; }
  const e = check('stockResponse', r.json);
  if (e.length) bad('đọc tồn', 'sai khuôn: ' + e.join('; '));
  for (const row of r.json?.data ?? []) {
    if (!row.error && row.available !== row.onHand - row.pendingOut - row.held) bad(`dòng ${row.item?.code ?? row.item?.id}`, `available ${row.available} ≠ onHand − pendingOut − held — R-STD-ORD-1`);
  }
  return out;
}

/* ── --self-test: bên nhận / Kế Toán giả ── */
function mockReceiver({ honest }) {
  const SECRET = 'bi-mat-thu', KEY = 'opb_thu';
  const byKey = new Map(), byDoc = new Map();
  let seq = 7000;
  const send = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  const fail = (res, status, code) => send(res, status, { ok: false, error: { code, message: code, requestId: 'req-thu' } });
  const server = createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    if (req.headers.authorization !== `Bearer ${KEY}`) return fail(res, 401, 'UNAUTHORIZED');
    const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(req.headers['bizcity-signature'] ?? '');
    const want = m && createHmac('sha256', SECRET).update(`${m[1]}.${raw}`).digest('hex');
    if (!m || !timingSafeEqual(Buffer.from(m[2]), Buffer.from(want))) return fail(res, 401, 'UNAUTHORIZED');
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && url.pathname === RECEIVER_PATH) {
      const rows = (url.searchParams.get('docRefs') ?? '').split(',').map((d) => byDoc.get(d)).filter(Boolean);
      return send(res, 200, { ok: true, data: rows.map((r) => ({ docRef: r.docRef, version: r.version, status: r.status, posRef: r.posRef, updatedAt: new Date().toISOString() })) });
    }
    const body = JSON.parse(raw || '{}');
    if (url.pathname === `${RECEIVER_PATH}/cancel`) {
      const r = byDoc.get(body.docRef);
      if (!r) return fail(res, 404, 'NOT_FOUND');
      if (r.status !== 'pending') return fail(res, 409, 'ORD-LOCKED');
      r.status = 'cancelled';
      return send(res, 200, { ok: true, data: { status: 'cancelled', posRef: r.posRef } });
    }
    if (honest && check('orderRequest', body).length) return fail(res, 400, 'VALIDATION_ERROR');
    const key = req.headers['idempotency-key'];
    if (honest && byKey.has(key)) {
      const prev = byKey.get(key);
      return prev.raw === raw ? send(res, 202, prev.reply) : fail(res, 409, 'IDEMPOTENCY_CONFLICT');
    }
    if (body.lines?.some((l) => !String(l.item?.code ?? '').startsWith('SP-'))) return fail(res, 422, 'ORD-ITEM-UNKNOWN');
    const existing = byDoc.get(body.docRef);
    if (existing && honest && existing.status !== 'pending') return fail(res, 409, 'ORD-LOCKED');
    const rec = existing && honest ? Object.assign(existing, { version: body.version }) : { docRef: body.docRef, version: body.version, status: 'pending', posRef: `pos.order_request:${++seq}` };
    byDoc.set(body.docRef, rec);
    const reply = { ok: true, data: { status: 'pending', posRef: rec.posRef, expiresAt: new Date(Date.now() + 72 * 3600e3).toISOString().replace(/\.\d+Z$/, 'Z') } };
    byKey.set(key, { raw, reply });
    return send(res, 202, reply);
  });
  return { server, KEY, SECRET };
}
function mockStock({ honest }) {
  return createServer((req, res) => {
    res.writeHead(req.headers['x-api-key'] === 'kt_thu' ? 200 : 401, { 'content-type': 'application/json' });
    if (req.headers['x-api-key'] !== 'kt_thu') return res.end(JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: 'x', requestId: 'r' } }));
    res.end(JSON.stringify({ ok: true, meta: { asOf: '2026-11-25T10:31:02Z', tenant: 'hoa-mai' }, data: [
      { item: { id: '01JD8K2Q4F3M9R7X5T1V0W6Y8Z', code: 'SP-0042' }, branchCode: 'Q3', uom: 'Cái', onHand: 5, pendingOut: 1, held: 0, available: honest ? 4 : 5 },
    ] }));
  });
}
const listen = (server) => new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(`http://127.0.0.1:${server.address().port}`)));

async function selfTest() {
  const out = [];
  for (const honest of [true, false]) {
    const r = mockReceiver({ honest });
    const s = mockStock({ honest });
    const [rt, st] = [await listen(r.server), await listen(s)];
    const found = [
      ...(await checkReceiver({ target: rt, key: r.KEY, secret: r.SECRET, tenant: 'hoa-mai', branch: 'Q3', itemCode: 'SP-0042', uom: 'Cái' })),
      ...(await checkStock({ target: st, key: 'kt_thu', branch: 'Q3', skus: 'SP-0042' })),
    ];
    for (const srv of [r.server, s]) await new Promise((ok) => { srv.close(ok); srv.closeAllConnections(); });
    const fails = found.filter((f) => f.level === 'fail');
    if (honest && fails.length) out.push(...fails.map((f) => ({ ...f, id: 'SC-ORD-SELF', where: `bên ĐÚNG · ${f.where}`, msg: 'bộ kiểm báo sai: ' + f.msg })));
    if (!honest) {
      for (const need of ['gửi lặp', 'thân có tenantId']) if (!fails.some((f) => f.where === need)) out.push({ id: 'SC-ORD-SELF', level: 'fail', where: `bên SAI · ${need}`, msg: 'bộ kiểm không bắt được lỗi cài sẵn' });
      if (!fails.some((f) => f.id === 'SC-ORD-4')) out.push({ id: 'SC-ORD-SELF', level: 'fail', where: 'Kế Toán SAI', msg: 'không bắt được available sai công thức' });
      if (!args.includes('--json')) console.log(`· bên SAI bị bắt ${fails.length} lỗi: ${[...new Set(fails.map((f) => f.where))].join(', ')}`);
    }
  }
  return out;
}

/* ── chạy ── */
const args = process.argv.slice(2);
const opt = (k, d = '') => { const i = args.indexOf(k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const profile = opt('--profile');
let res;
if (args.includes('--self-test')) {
  res = result('HOUSE', 'self-test', ['SC-ORD-1', 'SC-ORD-2', 'SC-ORD-SELF'], [...checkVectors(), ...checkStandard(), ...(await selfTest())]);
} else if (profile === 'receiver') {
  const o = { target: opt('--target').replace(/\/+$/, ''), key: opt('--key', process.env.ORDER_FLOW_KEY), secret: opt('--secret', process.env.ORDER_FLOW_SECRET), tenant: opt('--tenant'), branch: opt('--branch'), itemCode: opt('--item-code'), uom: opt('--uom', 'Cái') };
  if (!o.target || !o.key || !o.secret || !o.tenant || !o.branch || !o.itemCode) { console.error('cần --target --key --secret --tenant --branch --item-code'); process.exit(2); }
  if (!args.includes('--allow-write')) { console.error('profile receiver tạo đơn chờ thử (rồi huỷ): thêm --allow-write và CHỈ chạy trên bản thử'); process.exit(2); }
  res = result('CONTRACT', o.target, ['SC-ORD-3'], await checkReceiver(o));
} else if (profile === 'stock') {
  const o = { target: opt('--target').replace(/\/+$/, ''), key: opt('--key', process.env.ORDER_FLOW_KEY), branch: opt('--branch'), skus: opt('--skus') };
  if (!o.target || !o.key || !o.branch || !o.skus) { console.error('cần --target --key --branch --skus'); process.exit(2); }
  res = result('CONTRACT', o.target, ['SC-ORD-4'], await checkStock(o));
} else {
  res = result('HOUSE', 'vectors', ['SC-ORD-1', 'SC-ORD-2'], [...checkVectors(), ...checkStandard()]);
}
process.exitCode = print(res, args.includes('--json'));
