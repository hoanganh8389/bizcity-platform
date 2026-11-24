#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer platform
// [2026-11-24 08:10 PM Johnny Chu - Chu Hoàng Anh] SPINE-4 — lane CONTRACT (hộp đen) của bộ kiểm tương thích: gọi HTTP vào một bản ĐANG CHẠY, không đọc mã. Profile `ledger` (open-ketoan): SC-SPINE-4 (phần đọc + phần ghi khi --allow-write), SC-SPINE-5 (changefeed / digest theo bizcity_sync@1). Không phụ thuộc gói ngoài.
//
//   node tools/spine-contract.mjs --target http://127.0.0.1:4100 --api-key <khoá> --profile ledger [--allow-write] [--json]
//
// --allow-write: cho phép ca ghi (tạo đối tượng thử SPINECHK-…) — CHỈ chạy trên bản thử / CSDL test, không bao giờ trên bản cài thật.
// Kết quả theo bizcity_conformance_report@1. Không có "level" khi còn ca bị bỏ qua (R-REP-2: SKIP không phải PASS).

import { randomUUID } from 'node:crypto';
import { loadSchema, validate, report, print } from './lib/json-schema.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const target = (opt('--target', '') || '').replace(/\/+$/, '');
const apiKey = opt('--api-key', process.env.BIZCITY_API_KEY || '');
const profile = opt('--profile', 'ledger');
const allowWrite = args.includes('--allow-write');
const asJson = args.includes('--json');
if (!target || !apiKey) { console.error('cần --target <url> và --api-key <khoá> (hoặc BIZCITY_API_KEY)'); process.exit(2); }
if (profile !== 'ledger') { console.error('profile chưa có: ' + profile + ' (hiện chỉ ledger)'); process.exit(2); }

const sync = loadSchema('sync.schema.json');
const findings = [];
const checks = [];
const note = (id, status, text) => checks.push({ id, status, ...(text ? { note: text } : {}) });
const fail = (id, where, msg) => findings.push({ id, level: 'fail', where, msg });

async function http(method, path, body, headers = {}) {
  const res = await fetch(target + path, {
    method, headers: { 'x-api-key': apiKey, 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json };
}

/* ── SC-SPINE-5: changefeed / digest ── */
async function checkChangefeed() {
  let ok = true;
  for (const axis of ['items', 'partners', 'branches']) {
    const r = await http('GET', `/api/v1/sync/${axis}?limit=50`);
    if (r.status !== 200 || !r.json || r.json.ok !== true) { fail('SC-SPINE-5', `GET /api/v1/sync/${axis}`, `HTTP ${r.status}: ${JSON.stringify(r.json).slice(0, 160)}`); ok = false; continue; }
    const page = { data: r.json.data, meta: r.json.meta };
    const errs = validate(sync, sync.$defs.ChangePage, page);
    if (errs.length) { fail('SC-SPINE-5', `GET /api/v1/sync/${axis}`, 'không khớp ChangePage: ' + errs.slice(0, 3).join('; ')); ok = false; }
    // thứ tự (updated_at, id) tăng dần, con trỏ = dòng cuối
    for (let i = 1; i < page.data.length; i++) {
      const a = page.data[i - 1], b = page.data[i];
      if (a.updated_at > b.updated_at || (a.updated_at === b.updated_at && a.id >= b.id)) { fail('SC-SPINE-5', `GET /api/v1/sync/${axis}`, `thứ tự không tăng ở dòng ${i}`); ok = false; break; }
    }
    const last = page.data[page.data.length - 1];
    if (last && page.meta.cursor !== `${last.updated_at}|${last.id}`) { fail('SC-SPINE-5', `GET /api/v1/sync/${axis}`, 'meta.cursor không bằng <updated_at>|<id> của dòng cuối'); ok = false; }
    // sau con trỏ cuối: trang rỗng, con trỏ giữ nguyên
    if (last) {
      const r2 = await http('GET', `/api/v1/sync/${axis}?since=${encodeURIComponent(page.meta.cursor)}&limit=50`);
      if (r2.status !== 200 || (r2.json?.data || []).length !== 0 || r2.json?.meta?.cursor !== page.meta.cursor) { fail('SC-SPINE-5', `GET /api/v1/sync/${axis}?since=<cuối>`, 'sau con trỏ cuối phải rỗng và giữ con trỏ'); ok = false; }
      // phân trang limit=1 phải cho cùng dãy id
      const ids = [];
      let cur = '';
      for (let i = 0; i < Math.min(page.data.length, 5); i++) {
        const p = await http('GET', `/api/v1/sync/${axis}?limit=1${cur ? '&since=' + encodeURIComponent(cur) : ''}`);
        if (p.status !== 200 || !p.json?.data?.length) break;
        ids.push(p.json.data[0].id); cur = p.json.meta.cursor;
      }
      const want = page.data.slice(0, ids.length).map((x) => x.id);
      if (JSON.stringify(ids) !== JSON.stringify(want)) { fail('SC-SPINE-5', `GET /api/v1/sync/${axis}?limit=1`, 'phân trang limit=1 lệch với trang lớn'); ok = false; }
    }
    // digest khớp version
    const d = await http('GET', `/api/v1/sync/${axis}/digest`);
    if (d.status !== 200 || !Array.isArray(d.json?.data)) { fail('SC-SPINE-5', `GET /api/v1/sync/${axis}/digest`, `HTTP ${d.status}`); ok = false; continue; }
    const derrs = validate(sync, sync.$defs.Digest, d.json.data);
    if (derrs.length) { fail('SC-SPINE-5', `GET /api/v1/sync/${axis}/digest`, 'không khớp Digest: ' + derrs.slice(0, 3).join('; ')); ok = false; }
    const byId = new Map(d.json.data.map((x) => [x.id, x]));
    for (const row of page.data) {
      const g = byId.get(row.id);
      if (!g || g.version !== row.version || g.deleted !== row.deleted) { fail('SC-SPINE-5', `digest ${axis}`, `id ${row.id}: digest lệch với trang (version / deleted)`); ok = false; break; }
    }
  }
  note('SC-SPINE-5', ok ? 'pass' : 'fail', 'changefeed + digest: hình, thứ tự, con trỏ, phân trang, digest khớp');
}

/* ── SC-SPINE-4: mã lạ bị giữ, id lạ bị từ chối, cửa chặn con trỏ sai, ghi lặp một kết quả ── */
async function checkIntake() {
  let ok = true;
  const unknown = 'SPINECHK-' + randomUUID().slice(0, 8).toUpperCase();
  const r1 = await http('GET', `/api/v1/items/resolve?code=${unknown}`);
  if (r1.status !== 404) { fail('SC-SPINE-4', 'GET /api/v1/items/resolve?code=<lạ>', `mã lạ phải 404 NOT_FOUND, nhận ${r1.status}`); ok = false; }
  const r1b = await http('GET', `/api/v1/items/resolve?code=${unknown}`);
  if (r1b.status !== 404) { fail('SC-SPINE-4', 'GET /api/v1/items/resolve (lần 2)', 'tra mã lạ không được tự tạo mặt hàng (R-SPINE-2)'); ok = false; }
  const r2 = await http('GET', '/api/v1/sync/items?since=abc');
  if (r2.status !== 400) { fail('SC-SPINE-4', 'GET /api/v1/sync/items?since=abc', `con trỏ sai khuôn phải 400, nhận ${r2.status}`); ok = false; }
  const r3 = await http('GET', '/api/v1/sync/items', undefined, { 'x-api-key': 'kt_khoa_khong_ton_tai' });
  if (r3.status !== 401 && r3.status !== 403) { fail('SC-SPINE-4', 'GET /api/v1/sync/items (khoá lạ)', `khoá lạ phải 401/403, nhận ${r3.status}`); ok = false; }

  if (!allowWrite) {
    note('SC-SPINE-4', ok ? 'warn' : 'fail', 'phần đọc ' + (ok ? 'đạt' : 'lỗi') + '; phần ghi (Idempotency-Key lặp) BỎ QUA — chạy lại với --allow-write trên bản thử');
    return;
  }
  const code = unknown;
  const key = 'spinechk-' + randomUUID();
  const w1 = await http('POST', '/api/v1/partners/upsert', { code, name: 'Đối tượng kiểm hộp đen', kind: 'customer' }, { 'idempotency-key': key });
  const w2 = await http('POST', '/api/v1/partners/upsert', { code, name: 'Đối tượng kiểm hộp đen', kind: 'customer' }, { 'idempotency-key': key });
  if (w1.status < 200 || w1.status >= 300) { fail('SC-SPINE-4', 'POST /api/v1/partners/upsert', `ghi thử thất bại HTTP ${w1.status}: ${JSON.stringify(w1.json).slice(0, 160)}`); ok = false; }
  else if (w2.status !== w1.status || JSON.stringify(w2.json?.data) !== JSON.stringify(w1.json?.data)) { fail('SC-SPINE-4', 'POST /api/v1/partners/upsert (lặp cùng Idempotency-Key)', 'gửi lặp phải trả cùng kết quả (R-SPINE-7)'); ok = false; }
  else {
    const d = await http('GET', '/api/v1/sync/partners/digest');
    const n = (d.json?.data || []).filter((x) => x.id === String(w1.json.data.id)).length;
    if (n !== 1) { fail('SC-SPINE-4', 'digest partners', `đối tượng ghi lặp phải có đúng 1 dòng, thấy ${n}`); ok = false; }
    const f = await http('GET', '/api/v1/sync/partners?limit=1000');
    if (!(f.json?.data || []).some((x) => x.data?.code === code)) { fail('SC-SPINE-4', 'GET /api/v1/sync/partners', 'đối tượng vừa ghi phải xuất hiện trong changefeed'); ok = false; }
  }
  note('SC-SPINE-4', ok ? 'pass' : 'fail', 'mã lạ 404 không tạo; con trỏ sai 400; khoá lạ 401/403; ghi lặp cùng Idempotency-Key một kết quả');
}

await checkChangefeed();
await checkIntake();
note('SC-SPINE-6', 'skip', 'chuỗi vàng khách → đơn POS → hoá đơn kế toán cần bản ghép nhiều app; chưa chạy');
// Không ghi `level`: mức C1+ cần cả lane MANIFEST (SC-SPINE-1, 2) — bước gộp báo cáo sẽ tính (R-REP-2).
const result = report({ tool: 'spine-contract', lane: 'CONTRACT', checks, findings, scope: ['SC-SPINE-4', 'SC-SPINE-5'], app_id: 'open-ketoan', target });
process.exit(print(result, asJson));
