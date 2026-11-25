#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer platform
// [2026-11-25 06:12 PM Johnny Chu - Chu Hoàng Anh] STD-11 — vòng phản hồi lỗi (bizcity_feedback_loop@1, BIZCITY-FEEDBACK-LOOP-v1.md). Chủ chỉ đạo 2026-11-25:
//   khảo sát "100% dev không thấy log, fail, validator, công cụ trace" — đưa tín hiệu tới terminal và ngữ cảnh của AI, không cần mở màn hay bật Grafana.
//   Đọc nhật ký từ chối (JSONL) + nhật ký lỗi API ở máy dev, gom theo màn × mã, đối chiếu bản đồ lỗi (bizcity_failure_map@1).
//   Chỉ đọc tệp; không gọi API, không đọc CSDL. Không phụ thuộc gói ngoài (R-PLAT-5).
//
//   node tools/loi.mjs --repo <thư mục> [--since 30m|2h|1d|7d]         # bảng lỗi theo màn (mặc định 1 ngày)
//       [--data <DATA_DIR>] [--logs <LOG_DIR>]                          # mặc định <repo>/data, <repo>/logs (open-ketoan: DATA_DIR, LOG_DIR)
//   node tools/loi.mjs --repo <thư mục> --export <tệp.jsonl>           # gói CHỈ MÃ { screen, code, n } cho failure-check --observed (R-STD-LOOP-3)
//   node tools/loi.mjs --repo <thư mục> --check                         # SC-LOOP-1: hướng dẫn agent của repo có nói vòng phản hồi
//   node tools/loi.mjs --self-test                                      # thử ngược trên tools/fixtures/loop
//   … --json

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { ROOT } from './lib/json-schema.mjs';

const REJECT_STREAM = 'kiem-khai-bao';
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', 'coverage', 'data', 'logs']);
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const read = (p) => readFileSync(p, 'utf8');
const rel = (dir, p) => relative(dir, p).replace(/\\/g, '/');

function walk(dir, test, out = []) {
  if (!isDir(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (SKIP.has(f)) continue;
    const p = join(dir, f);
    if (isDir(p)) walk(p, test, out); else if (test(f, p)) out.push(p);
  }
  return out;
}
function allFiles(dir, re, out = []) {
  if (!isDir(dir)) return out;
  for (const f of readdirSync(dir)) { const p = join(dir, f); if (isDir(p)) allFiles(p, re, out); else if (re.test(f)) out.push(p); }
  return out;
}
const jsonLines = (p) => read(p).split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

export function parseSince(s, now) {
  const m = /^(\d+)\s*([mhd])$/.exec(s ?? '1d');
  if (!m) throw new Error(`--since "${s}" sai — dùng 30m, 2h, 1d, 7d`);
  return new Date(now.getTime() - Number(m[1]) * { m: 60e3, h: 3600e3, d: 86400e3 }[m[2]]);
}

/** Bản đồ lỗi của repo: tra theo mã màn và theo đối tượng API (screen.entities). */
function loadMaps(dir) {
  const maps = [];
  for (const f of walk(dir, (n) => /failure-map\.json$/.test(n))) {
    try { const m = JSON.parse(read(f)); if (m.schema === 'bizcity_failure_map@1') maps.push({ file: rel(dir, f), map: m }); } catch { /* failure-check báo khuôn sai */ }
  }
  const byScreen = new Map(), byEntity = new Map();
  for (const x of maps) { byScreen.set(x.map.screen.code, x); for (const e of x.map.screen.entities ?? []) byEntity.set(e, x); }
  return { maps, byScreen, byEntity };
}

/** Lượt ghi bị từ chối trong khung giờ (khuôn nhật ký §3 của chuẩn; open-ketoan: <DATA_DIR>/nhat-ky/kiem-khai-bao/<đơn vị>/<yyyy-mm>.jsonl). */
function rejections(dataDir, since, until) {
  const out = [];
  const root = join(dataDir, 'nhat-ky');
  const dirs = [join(root, REJECT_STREAM)];
  if (isDir(join(root, '_sites'))) for (const s of readdirSync(join(root, '_sites'))) dirs.push(join(root, '_sites', s, REJECT_STREAM));
  for (const d of dirs) for (const f of allFiles(d, /^\d{4}-\d{2}\.jsonl$/)) for (const e of jsonLines(f)) {
    const at = new Date(e.at ?? 0);
    const r = e.data ?? e;
    if (at < since || at > until || r.ok === true && !(r.failed ?? []).length) continue;
    for (const x of r.failed?.length ? r.failed : [{ code: 'UNKNOWN', level: 'block' }]) out.push({ at, entity: r.entity ?? '?', screen: r.screen, code: x.code, level: x.level ?? 'block', field: x.field, requestId: r.requestId, status: r.status });
  }
  return out;
}

/** Lỗi mức ≥ 50 (error / fatal) trong nhật ký lỗi của API và lỗi giao diện. */
function techErrors(logDir, since, until) {
  const out = [];
  for (const svc of ['api', 'web-client']) {
    const d = join(logDir, svc);
    for (const f of allFiles(d, /^\d{4}-\d{2}-\d{2}(\.\d+)?\.log$/)) {
      const lines = read(f).split(/\r?\n/);
      lines.forEach((l, i) => {
        if (!l.startsWith('{')) return;
        let j; try { j = JSON.parse(l); } catch { return; }
        const at = new Date(j.time ?? j.at ?? 0);
        if ((svc === 'api' && (j.level ?? 0) < 50) || at < since || at > until) return;
        out.push({ svc, at, code: j.errCode ?? j.code ?? j.kind ?? 'ERROR', reqId: j.reqId ?? j.requestId ?? j.cid, traceId: j.traceId, where: j.req?.url ?? j.url ?? j.screen ?? '', fp: j.errFp, file: `${svc}/${basename(f)}`, line: i + 1 });
      });
    }
  }
  return out;
}

export function analyse(dir, opts = {}) {
  const now = opts.now ?? new Date();
  const since = parseSince(opts.since, now);
  const { maps, byScreen, byEntity } = loadMaps(dir);
  const rej = rejections(resolve(opts.data ?? process.env.DATA_DIR ?? join(dir, 'data')), since, now);
  const tech = techErrors(resolve(opts.logs ?? process.env.LOG_DIR ?? join(dir, 'logs')), since, now);
  const groups = new Map();
  for (const r of rej) {
    const m = (r.screen && byScreen.get(r.screen)) || byEntity.get(r.entity) || null;
    const screen = m ? m.map.screen.code : `entity:${r.entity}`;
    const k = `${screen}|${r.code}`;
    const g = groups.get(k) ?? { screen, label: m?.map.screen.label ?? r.entity, mapFile: m?.file ?? null, code: r.code, n: 0, fields: new Set(), last: null, row: null };
    g.n++; if (r.field) g.fields.add(r.field.replace(/\.\d+\./g, '.*.').replace(/\.\d+$/, '.*'));
    if (!g.last || r.at > g.last.at) g.last = r;
    if (m) g.row = m.map.rows.find((x) => x.code === r.code) ?? null;
    groups.set(k, g);
  }
  return { since, now, maps, groups: [...groups.values()].sort((a, b) => a.screen.localeCompare(b.screen) || b.n - a.n), tech };
}

function verdictOf(g) {
  if (!g.mapFile) return 'màn CHƯA có bản đồ lỗi → failure-check --scaffold (R-STD-FAIL-6)';
  if (!g.row) return 'KHÔNG có trong bản đồ → thêm dòng, lời nhắc, test (R-STD-FAIL-7)';
  const parts = ['có trong bản đồ', g.row.test ? 'có test' : 'CHƯA có test'];
  parts.push(g.row.catchAt.includes('ui') ? 'màn báo trước' : `màn CHƯA báo trước (bắt ở ${g.row.catchAt.join(', ')})`);
  return parts.join(' · ');
}

function print(dir, a) {
  const L = [];
  const span = Math.round((a.now - a.since) / 3600e3);
  L.push(`Lỗi ở ${basename(dir)} — ${span >= 24 ? `${Math.round(span / 24)} ngày` : `${span} giờ`} qua: ${a.groups.reduce((s, g) => s + g.n, 0)} lần ghi bị từ chối, ${a.tech.length} lỗi kỹ thuật`);
  let cur = null;
  for (const g of a.groups) {
    if (g.screen !== cur) { cur = g.screen; L.push('', `${g.screen}  ${g.label}`); }
    L.push(`  ✗ ${g.code.padEnd(22)} ×${String(g.n).padEnd(3)} ${[...g.fields].join(', ').padEnd(22)} ${verdictOf(g)}`);
    if (g.last?.requestId) L.push(`      mã tra cứu gần nhất: ${g.last.requestId}`);
  }
  if (a.tech.length) {
    L.push('', 'Lỗi kỹ thuật (log mức error)');
    for (const t of a.tech.slice(-15)) L.push(`  ! ${t.code.padEnd(22)} ${t.where} reqId=${t.reqId ?? '—'}${t.traceId ? ` traceId=${t.traceId}` : ''} → logs/${t.file}:${t.line}`);
  }
  for (const { map, file } of a.maps) {
    const rows = map.rows;
    const done = rows.filter((r) => r.code && (r.test || r.level !== 'block')).length;
    const early = rows.filter((r) => r.catchAt.includes('ui')).length;
    const open = (map.questions ?? []).filter((q) => q.answer === null).length;
    L.push('', `Bản đồ ${map.screen.code}: ${done}/${rows.length} tình huống đủ mã + test · báo trước ${early}/${rows.length}${open ? ` · ${open} câu hỏi ngược chưa trả lời` : ''}   (${file})`);
  }
  if (!a.groups.length && !a.tech.length) L.push('', 'Không có lỗi trong khung giờ. Thử --since 7d, hoặc chỉ --data / --logs nếu bản cài đặt DATA_DIR / LOG_DIR khác.');
  L.push('', 'Tiếp: dòng "KHÔNG có trong bản đồ" → thêm vào bản đồ; "CHƯA báo trước" → sửa màn; lỗi kỹ thuật → mở logs/… đúng dòng, hoặc Tempo theo traceId.');
  return L.join('\n');
}

/** Gói chỉ mã (R-STD-LOOP-3): không khoá bản ghi, không người dùng, không câu lỗi, không số tiền. */
export const exportRows = (a) => a.groups.map((g) => ({ screen: g.screen, code: g.code, n: g.n }));

/* ── SC-LOOP-1: hướng dẫn agent của repo nói vòng phản hồi ── */
function checkRepo(dir) {
  const findings = [];
  const docs = ['AGENTS.md', 'CLAUDE.md', '.github/copilot-instructions.md', '.cursorrules'].map((f) => join(dir, f)).filter(existsSync);
  const text = docs.map(read).join('\n');
  const where = `${basename(dir)}/${docs.length ? rel(dir, docs[0]) : 'AGENTS.md'}`;
  if (!docs.length) findings.push({ id: 'SC-LOOP-1', level: 'warn', where, msg: 'repo chưa có hướng dẫn cho agent (AGENTS.md / CLAUDE.md / copilot-instructions) — R-STD-LOOP-8' });
  else {
    if (!/failure-check/.test(text)) findings.push({ id: 'SC-LOOP-1', level: 'warn', where, msg: 'hướng dẫn agent chưa bảo chạy failure-check (--questions trước khi viết mã lưu, --report sau) — R-STD-LOOP-8' });
    if (!/loi\.mjs|bizcity loi/.test(text)) findings.push({ id: 'SC-LOOP-1', level: 'warn', where, msg: 'hướng dẫn agent chưa bảo chạy loi.mjs để xem lỗi thật sau khi thử — R-STD-LOOP-8' });
  }
  return findings;
}

/* ── tự kiểm ── */
function selfTest() {
  const errs = [];
  const fx = join(ROOT, 'tools/fixtures/loop/repo');
  const a = analyse(fx, { now: new Date('2026-11-25T12:00:00Z'), since: '1d' });
  const g = (s, c) => a.groups.find((x) => x.screen === s && x.code === c);
  if (g('MH05', 'IN-ITEM-009')?.n !== 2) errs.push('không gom được IN-ITEM-009 ×2 về màn MH05 qua screen.entities');
  if (!/có trong bản đồ · có test/.test(verdictOf(g('MH05', 'IN-ITEM-009') ?? {}))) errs.push('IN-ITEM-009 phải được nhận là có trong bản đồ, có test');
  if (!g('MH05', 'IN-ITEM-009')?.fields.has('lines.*.itemId')) errs.push('không quy ô lines.0.itemId về lines.*.itemId');
  if (!/KHÔNG có trong bản đồ/.test(verdictOf(g('MH05', 'DB_REFERENCE_MISSING') ?? {}))) errs.push('DB_REFERENCE_MISSING phải bị báo là chưa có trong bản đồ');
  if (!/CHƯA có bản đồ/.test(verdictOf(g('entity:catalog/products', 'VALIDATION_ERROR') ?? {}))) errs.push('màn không có bản đồ phải được báo');
  if (a.groups.some((x) => x.code === 'PERIOD_LOCKED')) errs.push('lọc khung giờ sai: lượt 2026-11-20 lọt vào 1d');
  if (a.groups.some((x) => x.n === 0)) errs.push('lượt ghi đạt bị đếm là lỗi');
  if (a.tech.length !== 1 || a.tech[0].traceId !== 'abc123') errs.push('không đọc được lỗi mức error trong logs/api');
  const ex = JSON.stringify(exportRows(a));
  for (const leak of ['PM-000', 'Nguyễn', 'Trần', 'req-', 'riêng tư', 'lines.']) if (ex.includes(leak)) errs.push(`gói xuất lộ "${leak}" — chỉ được có màn, mã, số lần (R-STD-LOOP-3)`);
  if (exportRows(a).some((r) => Object.keys(r).join() !== 'screen,code,n')) errs.push('gói xuất có trường ngoài screen, code, n');
  if (!checkRepo(fx).some((f) => f.id === 'SC-LOOP-1')) errs.push('SC-LOOP-1 không bắt repo thiếu hướng dẫn agent');
  try { parseSince('5x', new Date()); errs.push('--since sai không bị từ chối'); } catch { /* đúng: từ chối */ }
  return errs;
}

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
if (args.includes('--self-test')) {
  const errs = selfTest();
  for (const e of errs) console.log('✗ ' + e);
  console.log(`KẾT QUẢ TỰ KIỂM: ${errs.length ? 'KHÔNG ĐẠT' : 'ĐẠT'}`);
  process.exit(errs.length ? 1 : 0);
}
const repo = arg('--repo');
if (!repo) { console.error('Cần --repo <thư mục> hoặc --self-test'); process.exit(2); }
const dir = resolve(repo);
if (args.includes('--check')) {
  const findings = checkRepo(dir);
  const result = { schema: 'bizcity_conformance_report@1', tool: 'loi', tool_version: '0.1.0', standard: 'bizcity_standard_map@1', ran_at: new Date().toISOString(), lane: 'HOUSE', scope: [basename(dir)], checks: [{ id: 'SC-LOOP-1', status: findings.length ? 'warn' : 'pass' }], findings, verdict: 'ĐẠT' };
  if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
  else { for (const f of findings) console.log(`! ${f.id} ${f.where}: ${f.msg}`); console.log(`KẾT LUẬN: ĐẠT (${findings.length} cảnh báo)`); }
  process.exit(0);
}
let a;
try { a = analyse(dir, { since: arg('--since'), data: arg('--data'), logs: arg('--logs') }); } catch (e) { console.error(e.message); process.exit(2); }
if (arg('--export')) {
  const rows = exportRows(a);
  writeFileSync(resolve(arg('--export')), rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  console.log(`đã ghi ${rows.length} dòng (chỉ màn, mã, số lần) → ${arg('--export')}. Dùng: failure-check --repo . --observed ${arg('--export')}`);
} else if (args.includes('--json')) console.log(JSON.stringify({ since: a.since, now: a.now, groups: a.groups.map((g) => ({ ...g, fields: [...g.fields], last: g.last && { at: g.last.at, requestId: g.last.requestId }, row: g.row?.id ?? null, verdict: verdictOf(g) })), tech: a.tech }, null, 2));
else console.log(print(dir, a));
