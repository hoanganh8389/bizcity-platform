// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// [2026-11-28 06:41 PM Johnny Chu - Chu Hoàng Anh] STD-LIST-2 — bản tham chiếu: tham số URL bizcity_list@1 ⇄ ListQuery JSON (open-core hiện thực theo cùng vector).
//   q · f.<field>.<op>=v (danh sách cách ',' — thoát bằng gạch ngược trước dấu phẩy; between: a..b; null: true|false) · sort=-a,b · cursor · limit · count · sums=1
const BS = String.fromCharCode(92); // dấu gạch ngược — viết bằng mã để khỏi lỗi thoát chuỗi
function splitList(v) {
  const out = []; let cur = '';
  for (let i = 0; i < v.length; i++) {
    if (v[i] === BS && v[i + 1] === ',') { cur += ','; i++; }
    else if (v[i] === ',') { out.push(cur); cur = ''; }
    else cur += v[i];
  }
  out.push(cur); return out;
}
const LIST_OPS = new Set(['in', 'nin']);

/** URLSearchParams | chuỗi ⇒ ListQuery (chưa kiểm cột — việc của máy chủ theo ListDef). Lỗi cú pháp ⇒ ném { field, message }. */
export function parseListQuery(input) {
  const p = typeof input === 'string' ? new URLSearchParams(input) : input;
  const q = {}; const filters = [];
  for (const [k, v] of p) {
    if (k === 'q') q.q = v;
    else if (k === 'cursor') q.cursor = v;
    else if (k === 'limit') { if (!/^[0-9]{1,3}$/.test(v)) throw { field: 'limit', message: 'limit là số 1–200' }; q.limit = Number(v); }
    else if (k === 'count') q.count = v;
    else if (k === 'sums') q.sums = v === '1' || v === 'true';
    else if (k === 'sort') q.sort = v.split(',').filter(Boolean).map((s) => (s.startsWith('-') ? { field: s.slice(1), dir: 'desc' } : { field: s, dir: 'asc' }));
    else if (k.startsWith('f.')) {
      const m = /^f\.([a-z][a-z0-9_]{0,62})\.([a-z]+)$/.exec(k);
      if (!m) throw { field: k, message: 'bộ lọc dạng f.<cột>.<phép>' };
      const [, field, op] = m;
      let value;
      if (LIST_OPS.has(op)) value = splitList(v);
      else if (op === 'between') { const parts = v.split('..'); if (parts.length !== 2) throw { field: k, message: 'between dạng a..b' }; value = parts; }
      else if (op === 'null') value = v === 'true';
      else value = v;
      filters.push({ field, op, value });
    } else throw { field: k, message: 'tham số lạ' };
  }
  if (filters.length) q.filters = filters;
  // thứ tự khoá CHUẨN (q, filters, sort, cursor, limit, count, sums) ⇒ cùng truy vấn ⇒ cùng JSON (bộ lọc đã lưu, băm bằng chứng xuất)
  const canon = {};
  for (const k of ['q', 'filters', 'sort', 'cursor', 'limit', 'count', 'sums']) if (q[k] !== undefined) canon[k] = q[k];
  return canon;
}

/** ListQuery ⇒ chuỗi tham số URL ổn định (thứ tự khoá cố định) — link / bộ lọc đã lưu giống nhau ở mọi app. */
export function formatListQuery(q) {
  const p = [];
  const enc = (s) => encodeURIComponent(s).replace(/%2C/g, ',');
  if (q.q) p.push(`q=${enc(q.q)}`);
  for (const f of q.filters ?? []) {
    const v = Array.isArray(f.value)
      ? (f.op === 'between' ? f.value.join('..') : f.value.map((x) => String(x).split(',').join(BS + ',')).join(','))
      : String(f.value);
    p.push(`f.${f.field}.${f.op}=${enc(v)}`);
  }
  if (q.sort?.length) p.push(`sort=${q.sort.map((s) => (s.dir === 'desc' ? '-' : '') + s.field).join(',')}`);
  if (q.cursor) p.push(`cursor=${q.cursor}`);
  if (q.limit) p.push(`limit=${q.limit}`);
  if (q.count) p.push(`count=${q.count}`);
  if (q.sums) p.push('sums=1');
  return p.join('&');
}
