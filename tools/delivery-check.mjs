#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer platform
// [2026-11-25 01:39 PM Johnny Chu - Chu Hoàng Anh] STD-8 — bộ kiểm nghiệm thu · bảng việc · rà soát · bàn giao (bizcity_delivery@1, BIZCITY-DELIVERY-v1.md):
//   trả lời "đã kiểm lại chưa, đạt chưa" cho một repo. Chỉ đọc tệp (+ git log cho ngày sửa cuối); không chạy mã của repo.
//
//   node tools/delivery-check.mjs --repo <thư mục…>            # phát hiện SC-DLV-1..8
//   node tools/delivery-check.mjs --repo <thư mục> --report    # bảng trạng thái nghiệm thu / bảng việc / rà soát / bàn giao
//   node tools/delivery-check.mjs --self-test                  # chạy trên bộ mẫu tools/fixtures/delivery (thử ngược)
//   node tools/delivery-check.mjs ... --json                   # bizcity_conformance_report@1

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, join, relative, resolve } from 'node:path';
import { ROOT } from './lib/json-schema.mjs';

const STATUSES = ['Nháp', 'Đã chốt', 'Đang làm', 'Chờ nghiệm thu', 'Đạt', 'Chưa đạt', 'Huỷ'];
const STALE_DAYS = 14;
const read = (p) => readFileSync(p, 'utf8');
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();

function walk(dir, test, out = []) {
  if (!isDir(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', 'vendor'].includes(f)) continue;
    const p = join(dir, f);
    if (isDir(p)) walk(p, test, out); else if (test(f, p)) out.push(p);
  }
  return out;
}

/** Ô "Trạng thái" của phiếu → từ khoá đóng (hoặc null) + chữ gốc. */
function statusOf(text) {
  const m = /^\|\s*Trạng thái\s*\|\s*([^|\n]*)\|/m.exec(text);
  if (!m) return { raw: null, key: null };
  const raw = m[1].replace(/\*\*/g, '').trim();
  // dài trước để "Chưa đạt" không bị đọc thành "Đạt"
  const key = [...STATUSES].sort((a, b) => b.length - a.length).find((s) => raw.startsWith(s)) ?? null;
  return { raw, key };
}

/** Lần sửa cuối của tệp trong git (ngày) — null nếu không có git. */
function lastChange(repo, file) {
  const r = spawnSync('git', ['-C', repo, 'log', '-1', '--format=%cs', '--', relative(repo, file)], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}

function analyse(dir, today = new Date()) {
  const name = basename(dir);
  const findings = [];
  const add = (id, level, where, msg) => findings.push({ id, level, where: `${name}/${where}`, msg });
  let app = null;
  try { app = JSON.parse(read(join(dir, 'bizcity.app.json'))); } catch { /* standard-check báo */ }
  const node = app?.runtime === 'node-ts';
  const ntDir = ['docs/nghiem-thu', 'NGHIEM-THU'].map((d) => join(dir, d)).find(isDir);

  // SC-DLV-1
  if (!ntDir) add('SC-DLV-1', node ? 'fail' : 'warn', 'docs/nghiem-thu/', 'chưa có thư mục phiếu nghiệm thu (README.md + _MAU.md) — R-DLV-1');
  else for (const f of ['README.md', '_MAU.md']) if (!existsSync(join(ntDir, f))) add('SC-DLV-1', node ? 'fail' : 'warn', relative(dir, join(ntDir, f)).replace(/\\/g, '/'), 'thiếu (R-DLV-1)');

  // phiếu
  const sheets = ntDir ? walk(ntDir, (f) => /^NT-[A-Z]+-\d+.*\.md$/.test(f)) : [];
  const testText = walk(dir, (f) => /\.(test|spec)\.(ts|tsx|js|mjs)$|test.*\.php$|Test\.php$/.test(f)).map(read).join('\n');
  const readme = ntDir && existsSync(join(ntDir, 'README.md')) ? read(join(ntDir, 'README.md')) : '';
  const rows = [];
  for (const p of sheets) {
    const rel = relative(dir, p).replace(/\\/g, '/');
    const t = read(p);
    const code = basename(p).match(/^(NT-[A-Z]+-\d+)/)[1];
    const st = statusOf(t);
    const inTest = testText.includes(code);
    const runSec = /## 7\.[^\n]*\n([\s\S]*?)(\n## 8|$)/.exec(t)?.[1] ?? '';
    const hasRun = /[0-9a-f]{7,40}/.test(runSec) && /\.(test|spec)\.(ts|tsx|js|mjs)|test.*\.php/.test(runSec);
    const bbSec = /## 8\.[^\n]*\n([\s\S]*?)(\n## 9|$)/.exec(t)?.[1] ?? '';
    const bbRows = bbSec.split('\n').filter((l) => /^\|/.test(l) && !/^\|[\s|:-]+\|$/.test(l) && !/Ngày\s*\|\s*Bộ phận/.test(l));
    const bbDat = bbRows.some((l) => /\d{1,2}\/\d{1,2}|\d{4}-\d{2}-\d{2}/.test(l) && /(?<!\p{L})Đạt(?!\p{L})/u.test(l) && !/Chưa đạt/i.test(l)); // \b của JS không hiểu chữ có dấu
    const changed = lastChange(dir, p);
    const ageDays = changed ? Math.floor((today - new Date(changed)) / 86400000) : null;
    rows.push({ code, rel, status: st.key, raw: st.raw, inTest, hasRun, bbDat, ageDays });

    if (!st.key) add('SC-DLV-2', 'warn', rel, `ô Trạng thái "${(st.raw ?? '(không có)').slice(0, 40)}" không bắt đầu bằng từ khoá: ${STATUSES.join(' · ')}`);
    if (st.key === 'Đạt' && !bbDat) add('SC-DLV-3', 'warn', rel, 'trạng thái Đạt nhưng §8 Biên bản chưa có dòng ngày + bộ phận + "Đạt"');
    if (st.key === 'Chờ nghiệm thu' && !hasRun) add('SC-DLV-3', 'warn', rel, 'Chờ nghiệm thu nhưng §7 Kết quả chạy chưa ghi commit + tệp test');
    if (['Chờ nghiệm thu', 'Đạt'].includes(st.key) && !inTest) add('SC-DLV-4', 'warn', rel, `không test nào nhắc mã ${code} (describe phải mở đầu bằng mã phiếu)`);
    if (st.key === 'Chờ nghiệm thu' && ageDays !== null && ageDays > STALE_DAYS) add('SC-DLV-8', 'warn', rel, `chờ nghiệm thu ${ageDays} ngày (> ${STALE_DAYS}) — đưa vào buổi nghiệm thu hoặc ghi lý do`);
    if (readme && !readme.includes(code)) add('SC-DLV-5', 'warn', rel, `README nghiệm thu chưa liệt kê ${code}`);
  }

  // SC-DLV-5 bảng việc
  const phases = join(dir, 'docs/phases');
  const board = join(phases, 'BANG-VIEC.md');
  const hasPhases = isDir(phases) && readdirSync(phases).some((f) => /^PHASE-/.test(f));
  const boardOk = existsSync(board) && /tệp sinh|không sửa tay/i.test(read(board).slice(0, 600));
  if (hasPhases && !boardOk) add('SC-DLV-5', 'warn', 'docs/phases/BANG-VIEC.md', existsSync(board) ? 'bảng việc không ghi là tệp sinh tự động' : 'repo có phase nhưng chưa có bảng việc sinh tự động (R-DLV-6)');

  // SC-DLV-6 rà soát
  const reviewDirs = ['docs/reviews', 'docs/audits'].filter((d) => isDir(join(dir, d)) && readdirSync(join(dir, d)).some((f) => f.endsWith('.md')));
  if (!reviewDirs.length) add('SC-DLV-6', 'warn', 'docs/reviews/', 'chưa có nơi ghi rà soát định kỳ (R-DLV-8)');

  // SC-DLV-7 bàn giao
  const phaseDirs = hasPhases ? readdirSync(phases).filter((f) => /^PHASE-/.test(f) && isDir(join(phases, f))) : [];
  let closed = 0, handed = 0;
  for (const ph of phaseDirs) {
    const files = readdirSync(join(phases, ph));
    if (files.includes('BAN-GIAO.md')) handed++;
    const cl = files.find((f) => /CHECKLIST/i.test(f));
    if (!cl) continue;
    const t = read(join(phases, ph, cl));
    const open = (t.match(/☐|🟡|◐|\[ \]/g) ?? []).length;
    const done = (t.match(/✅|☑|\[x\]/gi) ?? []).length;
    if (done > 0 && open === 0) { closed++; if (!files.includes('BAN-GIAO.md') && !files.some((f) => /70-REFLECT/.test(f))) add('SC-DLV-7', 'info', `docs/phases/${ph}/`, 'phase đã đóng (checklist không còn việc mở) nhưng chưa có BAN-GIAO.md (R-DLV-9)'); }
  }

  const count = (k) => rows.filter((r) => r.status === k).length;
  const summary = {
    phieu: rows.length,
    theo_trang_thai: Object.fromEntries([...STATUSES, null].map((k) => [k ?? 'không rõ', rows.filter((r) => r.status === k).length]).filter(([, v]) => v)),
    dat_co_bien_ban: rows.filter((r) => r.status === 'Đạt' && r.bbDat).length,
    cho_nghiem_thu: count('Chờ nghiệm thu'),
    treo: rows.filter((r) => r.status === 'Chờ nghiệm thu' && r.ageDays !== null && r.ageDays > STALE_DAYS).length,
    chua_co_test: rows.filter((r) => ['Chờ nghiệm thu', 'Đạt'].includes(r.status) && !r.inTest).length,
    bang_viec: boardOk ? 'có (sinh tự động)' : (hasPhases ? 'thiếu' : 'không có phase'),
    ra_soat: reviewDirs.length ? reviewDirs.join(', ') : 'chưa có',
    ban_giao: `${handed} / ${phaseDirs.length} phase (đã đóng: ${closed})`,
  };
  return { findings, summary, rows, app: app?.id };
}

function report(dir) {
  const { summary: s, rows } = analyse(dir);
  const lines = [
    `Trạng thái giao việc — ${basename(dir)} (${new Date().toISOString().slice(0, 10)})`,
    `  Phiếu nghiệm thu: ${s.phieu}  →  ${Object.entries(s.theo_trang_thai).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}`,
    `  Đạt có biên bản: ${s.dat_co_bien_ban}   Chờ nghiệm thu: ${s.cho_nghiem_thu} (treo > ${STALE_DAYS} ngày: ${s.treo})   Chờ/Đạt chưa có test: ${s.chua_co_test}`,
    `  Bảng việc: ${s.bang_viec}   Rà soát: ${s.ra_soat}   Bàn giao: ${s.ban_giao}`,
  ];
  const pending = rows.filter((r) => r.status === 'Chờ nghiệm thu').sort((a, b) => (b.ageDays ?? 0) - (a.ageDays ?? 0));
  if (pending.length) lines.push('  Chờ nghiệm thu (lâu nhất trước):', ...pending.slice(0, 15).map((r) => `    ${r.code.padEnd(12)} ${String(r.ageDays ?? '?').padStart(3)} ngày  ${r.inTest ? 'có test' : 'CHƯA có test'}  ${r.hasRun ? '§7 đủ' : '§7 thiếu'}`));
  return lines.join('\n');
}

/* ── tự kiểm: bộ mẫu good / bad ── */
function selfTest() {
  const fx = join(ROOT, 'tools/fixtures/delivery');
  const good = analyse(join(fx, 'good'), new Date('2026-11-25'));
  const bad = analyse(join(fx, 'bad'), new Date('2026-11-25'));
  const errs = [];
  if (good.findings.some((f) => f.level !== 'info')) errs.push('bộ mẫu good có phát hiện: ' + good.findings.map((f) => f.id + ' ' + f.msg).join('; '));
  for (const id of ['SC-DLV-1', 'SC-DLV-2', 'SC-DLV-3', 'SC-DLV-4', 'SC-DLV-5', 'SC-DLV-6']) if (!bad.findings.some((f) => f.id === id)) errs.push(`bộ mẫu bad không bắt được ${id}`);
  if (good.summary.dat_co_bien_ban !== 1) errs.push(`good: đếm Đạt có biên bản = ${good.summary.dat_co_bien_ban}, mong 1`);
  if (bad.rows.find((r) => r.code === 'NT-AB-002')?.status !== 'Chưa đạt') errs.push('"Chưa đạt" bị đọc nhầm');
  return errs;
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) {
  const errs = selfTest();
  for (const e of errs) console.log('✗ ' + e);
  console.log(`KẾT QUẢ TỰ KIỂM: ${errs.length ? 'KHÔNG ĐẠT' : 'ĐẠT'}`);
  process.exit(errs.length ? 1 : 0);
}
const i = args.indexOf('--repo');
const repos = i >= 0 ? args.slice(i + 1).filter((a) => !a.startsWith('--')).map((r) => resolve(r)) : [];
if (!repos.length) { console.error('Cần --repo <thư mục…> hoặc --self-test'); process.exit(2); }
if (args.includes('--report')) { console.log(repos.map(report).join('\n\n')); process.exit(0); }
const findings = repos.flatMap((r) => analyse(r).findings);
const fails = findings.filter((f) => f.level === 'fail').length;
const ids = ['SC-DLV-1', 'SC-DLV-2', 'SC-DLV-3', 'SC-DLV-4', 'SC-DLV-5', 'SC-DLV-6', 'SC-DLV-7', 'SC-DLV-8'];
const result = {
  schema: 'bizcity_conformance_report@1', tool: 'delivery-check', tool_version: '1.0.0', standard: 'bizcity_standard_map@1',
  ran_at: new Date().toISOString(), lane: 'HOUSE', scope: repos.map((r) => basename(r)),
  checks: ids.map((id) => ({ id, status: findings.some((f) => f.id === id && f.level === 'fail') ? 'fail' : (findings.some((f) => f.id === id && f.level === 'warn') ? 'warn' : 'pass') })),
  findings, verdict: fails ? 'KHÔNG ĐẠT' : 'ĐẠT',
};
if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
else {
  for (const f of findings.filter((x) => x.level !== 'info' || args.includes('--info'))) console.log(`${f.level === 'fail' ? '✗' : '!'} ${f.id} ${f.where}: ${f.msg}`);
  console.log(`KẾT LUẬN: ${result.verdict} (${findings.length} phát hiện, ${fails} chặn)`);
}
process.exit(fails ? 1 : 0);
