#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer platform
// [2026-11-25 01:48 PM Johnny Chu - Chu Hoàng Anh] STD-9 — bảng việc sinh tự động cho repo bất kỳ (R-STD-DLV-6, bizcity_delivery@1 §3), bản chung của
//   open-ketoan scripts/bang-viec.mjs. Đọc docs/phases/PHASE-*/ (README: ô "Trạng thái"; *CHECKLIST*.md: dòng bảng `| <mã> | … | <ký hiệu> |`)
//   và docs/chuong-trinh/*/ *CHECKLIST*.md. Ký hiệu: ☐ [ ] chưa làm · 🟡 ◐ đang / có mã · ✅ ☑ [x] xong · ⛔ bị chặn · ⏸ 💤 hoãn · ❌ huỷ · ➡ đã chuyển.
//
//   node tools/bang-viec.mjs --repo <thư mục>            # in bảng
//   node tools/bang-viec.mjs --repo <thư mục> --write    # ghi docs/phases/BANG-VIEC.md + bang-viec.json

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

/** Trạng thái ghi ở repo điều phối (vd chương trình OKT: "→ open-setup") — không đếm lại ở đây, chỉ trỏ sang. */
const ELSEWHERE = /→\s*\[?\s*(open-setup|bizcity-open-setup|open-ketoan)/u;
const GROUPS = [
  ['Bị chặn', /⛔/u], ['Huỷ', /❌/u], ['Đã chuyển', /➡/u], ['Hoãn', /⏸|💤/u],
  ['Đang làm / có mã', /🟡|◐/u], ['Xong', /✅|☑|\[x\]/iu], ['Chưa làm', /☐|\[ \]/u],
];
const ORDER = ['Đang làm / có mã', 'Bị chặn', 'Chưa làm', 'Hoãn', 'Xong', 'Huỷ', 'Đã chuyển', 'Theo dõi ở repo khác'];
const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
const groupOf = (cell) => GROUPS.find(([, re]) => re.test(cell))?.[0] ?? null;
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s).replace(/\|/g, '\\|');

function phaseDirs(dir) {
  const out = [];
  for (const base of ['docs/phases', 'docs/chuong-trinh']) {
    const b = join(dir, base);
    if (!isDir(b)) continue;
    for (const f of readdirSync(b)) if (isDir(join(b, f)) && (base.endsWith('chuong-trinh') || /^PHASE-/.test(f))) out.push(join(b, f));
  }
  return out;
}

export function collect(dir) {
  const phases = [];
  for (const pd of phaseDirs(dir)) {
    const name = basename(pd);
    const readme = existsSync(join(pd, 'README.md')) ? readFileSync(join(pd, 'README.md'), 'utf8') : '';
    const st = /Trạng thái:?\*{0,2}:?\s*([☐◐☑✅🟡⛔⏸💤❌])/u.exec(readme)?.[1] ?? null;
    const items = [];
    for (const f of readdirSync(pd).filter((x) => /CHECKLIST/i.test(x) && x.endsWith('.md'))) {
      const lines = readFileSync(join(pd, f), 'utf8').split(/\r?\n/);
      lines.forEach((l, i) => {
        const m = /^\|\s*([A-Z][A-Z0-9]*-[A-Z0-9][A-Z0-9-]*)\s*\|(.*)\|\s*$/u.exec(l);
        if (!m) return;
        const cells = m[2].split('|').map((c) => c.trim());
        const away = cells.find((c) => ELSEWHERE.test(c));
        const g = away ? 'Theo dõi ở repo khác' : [...cells].reverse().map(groupOf).find(Boolean);
        if (!g) return;
        items.push({ id: m[1], group: g, text: (cells.find((c) => c.length > 12) ?? cells[0] ?? '').replace(/`/g, ''), file: relative(dir, join(pd, f)).replace(/\\/g, '/'), line: i + 1 });
      });
    }
    phases.push({ name, path: relative(dir, pd).replace(/\\/g, '/'), status: st ? groupOf(st) : null, items });
  }
  return phases;
}

function render(dir, phases) {
  const all = phases.flatMap((p) => p.items.map((it) => ({ ...it, phase: p.name })));
  const count = (arr, g) => arr.filter((x) => x.group === g).length;
  const L = [];
  L.push('# Bảng việc', '');
  L.push('<!-- Tệp sinh tự động bởi bizcity-platform tools/bang-viec.mjs (R-STD-DLV-6) — không sửa tay; đổi trạng thái ở checklist / README của phase rồi sinh lại. -->', '');
  L.push(`> **Tệp sinh tự động — không sửa tay.** Sinh lại: \`node ../bizcity-platform/tools/bang-viec.mjs --repo . --write\` · ngày sinh ${new Date().toISOString().slice(0, 10)}`, '');
  L.push('| Cột | Số việc |', '|---|---|');
  for (const g of ORDER) L.push(`| ${g} | ${count(all, g)} |`);
  L.push(`| **Tổng** | **${all.length}** |`, '');
  const away = all.filter((x) => x.group === 'Theo dõi ở repo khác').length;
  if (away) L.push(`> ${away} việc ghi trạng thái ở **repo điều phối** (một nguồn trạng thái — ví dụ chương trình OKT ở [bizcity-open-setup](https://github.com/hoanganh8389/bizcity-open-setup/blob/main/docs/chuong-trinh/OKT/40-CHECKLIST.md)); bảng này chỉ trỏ sang, không đếm lại.`, '');
  L.push('## Theo phase', '', '| Phase | Trạng thái phase | Xong | Đang / có mã | Bị chặn | Chưa làm | Tổng |', '|---|---|---|---|---|---|---|');
  for (const p of phases) L.push(`| [${p.name}](${p.path.replace(/^docs\/phases\//, '')}/) | ${p.status ?? '—'} | ${count(p.items, 'Xong')} | ${count(p.items, 'Đang làm / có mã')} | ${count(p.items, 'Bị chặn')} | ${count(p.items, 'Chưa làm')} | ${p.items.length} |`);
  for (const g of ['Đang làm / có mã', 'Bị chặn', 'Chưa làm']) {
    const rows = all.filter((x) => x.group === g);
    if (!rows.length) continue;
    L.push('', `## ${g} (${rows.length})`, '', '| Mã | Phase | Việc |', '|---|---|---|');
    for (const r of rows.slice(0, 80)) L.push(`| [${r.id}](${r.file.replace(/^docs\/phases\//, '')}#L${r.line}) | ${r.phase} | ${clip(r.text, 140)} |`);
    if (rows.length > 80) L.push(`| … | | còn ${rows.length - 80} việc — xem checklist của phase |`);
  }
  return L.join('\n') + '\n';
}

const args = process.argv.slice(2);
const i = args.indexOf('--repo');
if (i < 0 || !args[i + 1]) { console.error('Cần --repo <thư mục>'); process.exit(2); }
const dir = resolve(args[i + 1]);
const phases = collect(dir);
if (!phases.length) { console.log('Không có docs/phases/PHASE-* hay docs/chuong-trinh/* — không cần bảng việc.'); process.exit(0); }
const md = render(dir, phases);
if (args.includes('--write')) {
  const cur = join(dir, 'docs/phases/BANG-VIEC.md');
  if (existsSync(cur) && !readFileSync(cur, 'utf8').includes('bizcity-platform tools/bang-viec.mjs') && !args.includes('--force')) {
    console.log('docs/phases/BANG-VIEC.md do công cụ riêng của repo sinh — giữ nguyên (thêm --force nếu chủ repo muốn dùng bản chung)');
    process.exit(0);
  }
  writeFileSync(cur, md);
  writeFileSync(join(dir, 'docs/phases/bang-viec.json'), JSON.stringify({ schema: 'bizcity_task_board@1', generated: new Date().toISOString(), phases }, null, 2) + '\n');
  const n = phases.reduce((a, p) => a + p.items.length, 0);
  console.log(`đã ghi docs/phases/BANG-VIEC.md (${phases.length} phase, ${n} việc)`);
} else process.stdout.write(md);
