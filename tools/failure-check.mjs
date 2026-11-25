#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer platform
// [2026-11-25 05:18 PM Johnny Chu - Chu Hoàng Anh] STD-10 — bộ kiểm bản đồ lỗi theo màn (bizcity_failure_map@1, BIZCITY-FAILURE-MAP-v1.md). Chủ chỉ đạo 2026-11-25:
//   dev phải liệt kê trước mọi tình huống thêm / sửa / xoá / ghi sổ / duyệt không thành; màn chỉ đúng ô, đúng danh sách chọn (thêm / sửa tại chỗ),
//   đúng nguồn gốc dữ liệu (hợp đồng, phân tích mua, min / max), đúng bước của luồng kho; có công cụ tự chạy ở máy dev cho biết đã đủ chưa.
//   Chỉ đọc tệp; không chạy mã của repo. Không phụ thuộc gói ngoài (R-PLAT-5).
//
//   node tools/failure-check.mjs --repo <thư mục…>                 # SC-FAIL-1..7
//   node tools/failure-check.mjs --repo <thư mục> --report         # độ phủ từng màn
//   node tools/failure-check.mjs --repo <thư mục> --observed <tệp.jsonl>   # lỗi gặp thật {screen, code} chưa có trong bản đồ (SC-FAIL-7)
//   node tools/failure-check.mjs --repo <thư mục> --scaffold <tệp form> [--code MH05] [--label "…"] [--write]
//                                                                   # dựng khung bản đồ từ form (mã để trống — người làm gán)
//   node tools/failure-check.mjs --self-test                       # thử ngược trên tools/fixtures/failure
//   … --json                                                       # bizcity_conformance_report@1
// [2026-11-25 06:12 PM Johnny Chu - Chu Hoàng Anh] STD-11 — câu hỏi ngược (bizcity_feedback_loop@1 §2, docs/standard/cau-hoi-nguoc.json):
//   node tools/failure-check.mjs --questions <luồng,…>             # in câu hỏi ngược của luồng (luôn kèm "chung") để dev / AI trả lời trước khi viết mã lưu
//   … --scaffold <form> --flow mua,kho                               # khung bản đồ nhúng câu hỏi (answer: null); SC-FAIL-2 nhắc câu chưa trả lời

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { ROOT, validate } from './lib/json-schema.mjs';

const SCHEMA = JSON.parse(readFileSync(join(ROOT, 'packages/contracts/schema/failure-map/failure-map.schema.json'), 'utf8'));
const BANK = JSON.parse(readFileSync(join(ROOT, 'docs/standard/cau-hoi-nguoc.json'), 'utf8'));
/** Câu hỏi ngược của các luồng (luôn kèm "chung"). Luồng lạ → lỗi để người gọi sửa. */
export function questionsFor(flows) {
  const want = ['chung', ...flows.filter((f) => f && f !== 'chung')];
  for (const f of want) if (!BANK.flows[f]) throw new Error(`luồng "${f}" không có trong ngân hàng câu hỏi — có: ${Object.keys(BANK.flows).join(', ')}`);
  return BANK.questions.filter((q) => want.includes(q.flow));
}
const IDS = ['SC-FAIL-1', 'SC-FAIL-2', 'SC-FAIL-3', 'SC-FAIL-4', 'SC-FAIL-5', 'SC-FAIL-6', 'SC-FAIL-7'];
const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', 'coverage', '.next', 'out']);
const SRC = /\.(ts|tsx|js|jsx|mjs|cjs|vue|php|py|sql|json)$/;
const FORM = /(Form|Modal)\.(tsx|jsx|vue)$/;
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

/** Mã xuất hiện như một chữ trọn (không dính chữ / số / gạch nối liền) trong văn bản. */
const hasToken = (text, tok) => new RegExp(`(?<![A-Za-z0-9_-])${tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`, 'u').test(text);

function analyse(dir, opts = {}) {
  const name = basename(dir);
  const findings = [];
  const add = (id, level, where, msg) => findings.push({ id, level, where: `${name}/${where}`, msg });
  const files = walk(dir, (f) => SRC.test(f) || f.endsWith('.jsonl'));
  const mapFiles = files.filter((p) => /failure-map\.json$/.test(p));
  const srcFiles = files.filter((p) => !/failure-map\.json$/.test(p) && !p.endsWith('.jsonl'));
  let corpus = null; // nạp lười: cả repo, dùng khi bản đồ không khai codeSources
  const allText = () => (corpus ??= srcFiles.map(read).join('\n'));
  const maps = [];

  for (const mf of mapFiles) {
    const where = rel(dir, mf);
    let m;
    try { m = JSON.parse(read(mf)); } catch (e) { add('SC-FAIL-2', 'fail', where, 'không đọc được JSON: ' + e.message); continue; }
    // SC-FAIL-2: đúng khuôn
    const errs = validate(SCHEMA, SCHEMA, m);
    for (const e of errs.slice(0, 10)) add('SC-FAIL-2', 'fail', where, e);
    if (errs.length) continue;
    maps.push({ file: where, map: m });
    const screenPath = join(dir, m.screen.file);
    const screenText = existsSync(screenPath) ? read(screenPath) : null;
    if (!screenText) add('SC-FAIL-2', 'fail', where, `tệp màn ${m.screen.file} không có`);
    const seen = new Set();
    for (const r of m.rows) {
      const w = `${where}#${r.id}`;
      if (seen.has(r.id)) add('SC-FAIL-2', 'fail', w, 'trùng mã dòng');
      seen.add(r.id);
      if (!m.actions.includes(r.action)) add('SC-FAIL-2', 'fail', w, `thao tác "${r.action}" chưa khai ở actions`);
      const t = r.target;
      const need = { field: ['path'], selector: ['path', 'catalog'], origin: ['source'], flow: ['step'], state: [] }[t.kind];
      for (const k of need) if (!t[k]) add('SC-FAIL-2', 'fail', w, `đích ${t.kind} cần "${k}"`);
      if (/^TODO/i.test(r.hint) || r.hint.length < 10) add('SC-FAIL-2', 'warn', w, 'lời nhắc cho người dùng còn trống / quá ngắn — nói sai gì và làm gì tiếp (R-STD-FAIL-4)');
      if (/\b(select|insert|update|delete)\b.+\b(from|into|set)\b|\.ts:\d+|stack/i.test(r.hint)) add('SC-FAIL-2', 'fail', w, 'lời nhắc lộ SQL / đường dẫn / stack (R-STD-FAIL-4)');
      // SC-FAIL-3: mã có trong danh mục
      if (r.code === null) add('SC-FAIL-3', 'warn', w, 'khung chưa gán mã — chọn mã có sẵn trong danh mục, không có thì thêm mã mới vào danh mục (R-STD-FAIL-2)');
      else {
        const srcs = (m.codeSources ?? []).map((s) => join(dir, s));
        const missingSrc = srcs.filter((s) => !existsSync(s));
        for (const s of missingSrc) add('SC-FAIL-3', 'fail', where, `codeSources ${rel(dir, s)} không có`);
        const text = srcs.length ? srcs.filter(existsSync).map(read).join('\n') : allText();
        if (!hasToken(text, r.code)) add('SC-FAIL-3', 'fail', w, `mã ${r.code} không có trong ${srcs.length ? 'codeSources' : 'mã nguồn của repo'} (R-STD-FAIL-2)`);
      }
      // SC-FAIL-4: dòng chặn có test khoá đúng mã
      if (r.test) {
        const [tf, tok] = r.test.split('#');
        const tp = join(dir, tf);
        if (!existsSync(tp)) add('SC-FAIL-4', 'fail', w, `test ${tf} không có`);
        else {
          const want = tok || r.code;
          if (want && !hasToken(read(tp), want)) add('SC-FAIL-4', 'fail', w, `test ${tf} không nhắc "${want}" — test phải gây ra đúng mã (R-STD-FAIL-3)`);
        }
      } else if (r.level === 'block') add('SC-FAIL-4', r.code === null ? 'warn' : 'fail', w, 'dòng chặn chưa có test (R-STD-FAIL-3)');
      // SC-FAIL-5: đích có thật
      if (screenText && t.path && (t.kind === 'field' || t.kind === 'selector')) {
        const leaf = t.path.split('.').filter((s) => s !== '*' && !/^\d+$/.test(s)).pop();
        if (leaf && !new RegExp(`\\b${leaf}\\b`).test(screenText)) add('SC-FAIL-5', 'warn', w, `ô "${leaf}" không thấy trên ${m.screen.file} — màn không tô / cuộn tới được (R-STD-FAIL-5)`);
      }
      if (t.inlineFix && !hasToken(allText(), t.inlineFix)) add('SC-FAIL-5', 'warn', w, `sửa tại chỗ "${t.inlineFix}" không thấy trong mã (R-STD-FAIL-5)`);
      // SC-FAIL-6: bắt sớm
      if (r.level === 'block' && ['field', 'selector', 'origin'].includes(t.kind) && !r.catchAt.includes('ui')) add('SC-FAIL-6', 'warn', w, `lỗi ${t.kind} chỉ bắt ở ${r.catchAt.join(', ')} — màn biết trước được thì phải báo trước khi bấm (R-STD-FAIL-1)`);
    }
    for (const a of m.actions) if (!m.rows.some((r) => r.action === a)) add('SC-FAIL-2', 'warn', where, `thao tác "${a}" chưa có tình huống lỗi nào`);
    // [2026-11-25 06:12 PM Johnny Chu - Chu Hoàng Anh] STD-11 — câu hỏi ngược chưa trả lời (R-STD-LOOP-2)
    const open = (m.questions ?? []).filter((q) => q.answer === null || !String(q.answer).trim());
    if (open.length) add('SC-FAIL-2', 'warn', where, `${open.length} câu hỏi ngược chưa trả lời (${open.slice(0, 5).map((q) => q.id).join(', ')}${open.length > 5 ? '…' : ''}) — hỏi người yêu cầu, không đoán (R-STD-LOOP-2)`);
  }

  // SC-FAIL-1: form có bản đồ
  const covered = new Set(maps.map((x) => x.map.screen.file.replace(/\\/g, '/')));
  const forms = srcFiles.filter((p) => FORM.test(p) && !/[\\/](test|tests|__tests__|fixtures)[\\/]/.test(rel(dir, p)));
  for (const f of forms) if (!covered.has(rel(dir, f))) add('SC-FAIL-1', 'warn', rel(dir, f), 'form chưa có bản đồ lỗi — dựng khung: failure-check --scaffold (R-STD-FAIL-6)');

  // SC-FAIL-7: lỗi gặp thật chưa có trong bản đồ
  if (opts.observed) {
    const byScreen = new Map(maps.map((x) => [x.map.screen.code, new Set(x.map.rows.map((r) => r.code))]));
    const missing = new Map();
    for (const line of read(opts.observed).split(/\r?\n/).filter(Boolean)) {
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (!o.screen || !o.code) continue;
      if (!byScreen.get(o.screen)?.has(o.code)) missing.set(`${o.screen} ${o.code}`, (missing.get(`${o.screen} ${o.code}`) ?? 0) + 1);
    }
    for (const [k, n] of missing) add('SC-FAIL-7', 'warn', k.split(' ')[0], `lỗi gặp thật ${k.split(' ')[1]} (${n} lần) chưa có trong bản đồ — thêm dòng, lời nhắc, test (R-STD-FAIL-7)`);
  }
  return { findings, maps, forms: forms.length };
}

function report(dir) {
  const { maps, forms, findings } = analyse(dir);
  const L = [`Bản đồ lỗi theo màn — ${basename(dir)}: ${maps.length} bản đồ / ${forms} form`];
  for (const { file, map } of maps) {
    const rows = map.rows;
    const done = rows.filter((r) => r.code && (r.test || r.level !== 'block')).length;
    const kinds = ['field', 'selector', 'origin', 'flow', 'state'].map((k) => `${k} ${rows.filter((r) => r.target.kind === k).length}`).join(' · ');
    const early = rows.filter((r) => r.catchAt.includes('ui')).length;
    L.push(`  ${map.screen.code.padEnd(8)} ${map.screen.label} — ${rows.length} tình huống, đủ mã + test ${done}/${rows.length} (${rows.length ? Math.round((100 * done) / rows.length) : 0}%), bắt ở giao diện ${early}/${rows.length}`);
    L.push(`           ${kinds}   (${file})`);
  }
  const fails = findings.filter((f) => f.level === 'fail').length;
  L.push(`  Phát hiện: ${findings.length} (${fails} chặn) — chạy không --report để xem chi tiết`);
  return L.join('\n');
}

/* ── dựng khung từ form ── */
const HEADER = new Set(['v', 'form', 'values', 'state', 'data', 'doc', 'f', 'header', 'value']);
function catalogOf(tag) {
  const pairs = [[/Item|Hang|Product/, 'item'], [/Partner|Supplier|Customer|Ncc|Khach/, 'partner'], [/Branch|ChiNhanh/, 'branch'], [/Warehouse|Kho/, 'warehouse'], [/Account|TaiKhoan/, 'account'], [/Unit|Dvt/, 'uom'], [/Tax|Thue/, 'tax']];
  return pairs.find(([re]) => re.test(tag))?.[1] ?? 'list';
}
export function scaffold(dir, formRel, code, label, flows = []) {
  const text = read(join(dir, formRel));
  const rows = [];
  const seen = new Set();
  let n = 0;
  const push = (r) => { const k = `${r.action}|${r.target.kind}|${r.target.path ?? r.target.source ?? r.target.step ?? r.code}`; if (seen.has(k)) return; seen.add(k); rows.push({ id: `${code}-${String(++n).padStart(2, '0')}`, ...r }); };
  const TODO = 'TODO: nói sai gì và làm gì tiếp';
  for (const m of text.matchAll(/<([A-Za-z][A-Za-z0-9]*)\b([^>]{0,400}?)\/?>/g)) {
    const [, tag, attrs] = m;
    const vm = /value=\{([^}]*)\}/.exec(attrs);
    const pm = vm && /\b([a-z][A-Za-z0-9]*)\.([A-Za-z_][A-Za-z0-9_]*(?:\??\.[A-Za-z_][A-Za-z0-9_]*)*)/.exec(vm[1]);
    if (!pm || /type="checkbox"/.test(attrs)) continue;
    const path = (HEADER.has(pm[1]) ? '' : 'lines.*.') + pm[2].replace(/\?/g, '');
    const save = /ghi sổ|ghiSo|\bpost\(/i.test(text) ? 'ghi-so' : 'them';
    if (/^[A-Z]/.test(tag) && /Picker|Select|Combo|^O?Chon/.test(tag)) {
      const cat = catalogOf(tag);
      const add = /\bcanAdd\b|addKind=/.test(attrs);
      push({ action: save, code: null, level: 'block', when: `Chưa chọn / giá trị không còn hợp lệ ở danh sách ${cat} (${path})${add ? ' — có nút thêm tại chỗ' : ''}`, target: { kind: 'selector', path, catalog: cat, allow: 'active' }, catchAt: ['ui'], hint: TODO });
    } else if (/NumInput/.test(tag) || /type="number"|inputMode="numeric"|className="[^"]*\bnum\b/.test(attrs)) {
      push({ action: save, code: null, level: 'block', when: `Số âm, bằng 0 hoặc sai kiểu (${path})`, target: { kind: 'field', path }, catchAt: ['ui'], hint: TODO });
      if (/qty|soLuong|price|donGia|amount|budget|discount/i.test(path)) push({ action: save, code: null, level: 'warn', when: `Vượt giới hạn từ nguồn gốc (hợp đồng, phân tích mua, tồn min / max, hạn mức) ở ${path}`, target: { kind: 'origin', path, source: 'chua-ro' }, catchAt: ['ui', 'module'], hint: TODO });
    } else if (/type="date"/.test(attrs)) {
      push({ action: save, code: null, level: 'block', when: `Ngày trống, sai hoặc thuộc kỳ đã khoá (${path})`, target: { kind: 'field', path }, catchAt: ['ui'], hint: TODO });
    } else if (tag === 'input' || tag === 'select' || tag === 'textarea') {
      push({ action: save, code: null, level: 'warn', when: `Trống, quá dài hoặc ngoài danh sách cho phép (${path})`, target: { kind: 'field', path }, catchAt: ['ui'], hint: TODO });
    }
  }
  const save = /ghi sổ|ghiSo|\bpost\(/i.test(text) ? 'ghi-so' : null;
  const actions = ['them', 'sua', 'xoa', ...(save ? [save] : [])];
  if (/kho|warehouse/i.test(text)) {
    push({ action: save ?? 'them', code: null, level: 'warn', when: 'Kho không thuộc chi nhánh / bộ phận của chứng từ', target: { kind: 'flow', step: 'kho-thuoc-chi-nhanh' }, catchAt: ['ui', 'intake'], hint: TODO });
    push({ action: save ?? 'them', code: null, level: 'warn', when: 'Xuất quá tồn hoặc xuất trước ngày nhập', target: { kind: 'flow', step: 'ton-tai-ngay-xuat' }, catchAt: ['ui', 'intake'], hint: TODO });
  }
  for (const a of actions) push({ action: a, code: null, level: 'block', when: 'Người dùng không có quyền làm thao tác này', target: { kind: 'state' }, catchAt: ['ui', 'module'], hint: TODO });
  for (const a of actions.filter((x) => x !== 'them')) push({ action: a, code: null, level: 'block', when: 'Chứng từ đã ghi sổ / đã khoá kỳ / người khác vừa sửa', target: { kind: 'state' }, catchAt: ['ui', 'kernel'], hint: TODO });
  const questions = questionsFor(flows).map((q) => ({ id: q.id, ask: q.ask, answer: null }));
  return { schema: 'bizcity_failure_map@1', screen: { code, label, file: formRel.replace(/\\/g, '/'), entities: [] }, actions, codeSources: [], questions, rows };
}

/* ── tự kiểm ── */
function selfTest() {
  const fx = join(ROOT, 'tools/fixtures/failure');
  const good = analyse(join(fx, 'good'), { observed: join(fx, 'observed.jsonl') });
  const bad = analyse(join(fx, 'bad'));
  const errs = [];
  const goodIssues = good.findings.filter((f) => f.id !== 'SC-FAIL-7');
  if (goodIssues.length) errs.push('bộ mẫu good có phát hiện: ' + goodIssues.map((f) => `${f.id} ${f.where} ${f.msg}`).join('; '));
  if (!good.findings.some((f) => f.id === 'SC-FAIL-7' && f.msg.includes('IN-VAT-001'))) errs.push('SC-FAIL-7 không bắt được lỗi gặp thật IN-VAT-001');
  if (good.findings.some((f) => f.id === 'SC-FAIL-7' && f.msg.includes('IN-ITEM-009'))) errs.push('SC-FAIL-7 báo nhầm mã đã có trong bản đồ');
  for (const id of IDS.slice(0, 6)) if (!bad.findings.some((f) => f.id === id)) errs.push(`bộ mẫu bad không bắt được ${id}`);
  const sc = scaffold(join(fx, 'good'), 'web/PhieuForm.tsx', 'MH05', 'Phiếu mua hàng (mẫu)');
  const se = validate(SCHEMA, SCHEMA, sc);
  if (se.length) errs.push('khung dựng ra sai khuôn: ' + se.join('; '));
  for (const k of ['field', 'selector', 'origin', 'flow', 'state']) if (!sc.rows.some((r) => r.target.kind === k)) errs.push(`khung dựng ra thiếu đích ${k}`);
  if (!sc.rows.some((r) => r.target.path === 'lines.*.itemId')) errs.push('khung không nhận ra dòng hàng lines.*.itemId');
  // [2026-11-25 06:12 PM Johnny Chu - Chu Hoàng Anh] STD-11 — ngân hàng câu hỏi ngược đúng khuôn, mã câu không trùng; khung nhúng câu hỏi của luồng
  const QS = JSON.parse(readFileSync(join(ROOT, 'packages/contracts/schema/feedback/reverse-questions.schema.json'), 'utf8'));
  for (const e of validate(QS, QS, BANK)) errs.push('cau-hoi-nguoc.json: ' + e);
  if (new Set(BANK.questions.map((q) => q.id)).size !== BANK.questions.length) errs.push('cau-hoi-nguoc.json: trùng mã câu hỏi');
  for (const q of BANK.questions) if (!BANK.flows[q.flow]) errs.push(`cau-hoi-nguoc.json: ${q.id} trỏ luồng lạ ${q.flow}`);
  const sq = scaffold(join(fx, 'good'), 'web/PhieuForm.tsx', 'MH05', 'Phiếu mẫu', ['mua', 'kho']);
  if (!sq.questions.some((q) => q.id === 'Q-MUA-01') || !sq.questions.some((q) => q.id === 'Q-CHUNG-01') || sq.questions.some((q) => q.id.startsWith('Q-BAN'))) errs.push('khung nhúng sai câu hỏi ngược theo luồng');
  for (const e of validate(SCHEMA, SCHEMA, sq)) errs.push('khung có câu hỏi sai khuôn: ' + e);
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
if (args.includes('--questions')) {
  const flows = (arg('--questions') ?? '').split(',').filter((x) => x && !x.startsWith('--'));
  let qs; try { qs = questionsFor(flows); } catch (e) { console.error(e.message); process.exit(2); }
  if (args.includes('--json')) { console.log(JSON.stringify(qs, null, 2)); process.exit(0); }
  console.log(`Câu hỏi ngược — ${['chung', ...flows].map((f) => BANK.flows[f]).join(' · ')}\nTrả lời TRƯỚC khi viết mã lưu; chưa rõ thì hỏi người yêu cầu, không đoán (R-STD-LOOP-2). Mỗi câu trả lời thành dòng trong bản đồ lỗi.\n`);
  for (const q of qs) console.log(`${q.id.padEnd(11)} [${q.kind}] ${q.ask}\n            vì: ${q.why}${q.codes?.length ? `\n            mã hay gặp: ${q.codes.join(', ')}` : ''}`);
  process.exit(0);
}
const i = args.indexOf('--repo');
const repos = i >= 0 ? args.slice(i + 1).filter((a, j, all) => !a.startsWith('--') && !(j > 0 && all[j - 1].startsWith('--') && all[j - 1] !== '--repo')).map((r) => resolve(r)) : [];
if (!repos.length) { console.error('Cần --repo <thư mục…> hoặc --self-test'); process.exit(2); }
if (arg('--scaffold')) {
  const dir = repos[0];
  const form = rel(dir, resolve(arg('--scaffold')));
  const code = arg('--code') ?? 'MAN';
  const m = scaffold(dir, form, code, arg('--label') ?? basename(form).replace(/\.\w+$/, ''), (arg('--flow') ?? '').split(',').filter(Boolean));
  const out = join(dir, dirname(form), basename(form).replace(/\.\w+$/, '') + '.failure-map.json');
  const json = JSON.stringify(m, null, 2) + '\n';
  if (args.includes('--write')) {
    if (existsSync(out)) { console.log(`${rel(dir, out)} đã có — không ghi đè`); process.exit(0); }
    writeFileSync(out, json);
    console.log(`đã ghi ${rel(dir, out)}: ${m.rows.length} tình huống khung, mã để trống — gán mã, viết lời nhắc, thêm test, bỏ dòng không áp dụng`);
  } else process.stdout.write(json);
  process.exit(0);
}
if (args.includes('--report')) { console.log(repos.map(report).join('\n\n')); process.exit(0); }
const observed = arg('--observed') ? resolve(arg('--observed')) : undefined;
const findings = repos.flatMap((r) => analyse(r, { observed }).findings);
const fails = findings.filter((f) => f.level === 'fail').length;
const result = {
  schema: 'bizcity_conformance_report@1', tool: 'failure-check', tool_version: '0.1.0', standard: 'bizcity_standard_map@1',
  ran_at: new Date().toISOString(), lane: 'HOUSE', scope: repos.map((r) => basename(r)),
  checks: IDS.map((id) => ({ id, status: findings.some((f) => f.id === id && f.level === 'fail') ? 'fail' : (findings.some((f) => f.id === id && f.level === 'warn') ? 'warn' : 'pass') })),
  findings, verdict: fails ? 'KHÔNG ĐẠT' : 'ĐẠT',
};
if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  for (const f of findings) console.log(`${f.level === 'fail' ? '✗' : '!'} ${f.id} ${f.where}: ${f.msg}`);
  console.log(`KẾT LUẬN: ${result.verdict} (${findings.length} phát hiện, ${fails} chặn)`);
}
process.exit(fails ? 1 : 0);
