#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer platform
// [2026-11-25 01:48 PM Johnny Chu - Chu Hoàng Anh] STD-9 — dựng khung nghiệm thu · rà soát · bàn giao · bảng việc cho một repo (bizcity_delivery@1),
//   từ templates/delivery. CHỈ TẠO TỆP CÒN THIẾU, không bao giờ ghi đè. Không viết phiếu hay biên bản thay bộ phận sử dụng.
//   Repo để git bỏ qua docs/ ⇒ đặt ở gốc: NGHIEM-THU/, RA-SOAT/ (và mở dòng .gitignore nếu repo dùng danh sách cho phép).
//
//   node tools/scaffold-delivery.mjs --repo <thư mục>            # in việc sẽ làm (chạy thử)
//   node tools/scaffold-delivery.mjs --repo <thư mục> --write    # tạo tệp, sinh bảng việc

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { ROOT } from './lib/json-schema.mjs';

const T = join(ROOT, 'templates/delivery');
const args = process.argv.slice(2);
const i = args.indexOf('--repo');
if (i < 0 || !args[i + 1]) { console.error('Cần --repo <thư mục>'); process.exit(2); }
const dir = resolve(args[i + 1]);
const write = args.includes('--write');
const ignored = (rel) => spawnSync('git', ['-C', dir, 'check-ignore', '-q', rel]).status === 0;

const rootMode = ignored('docs/nghiem-thu/README.md');
const ntBase = rootMode ? 'NGHIEM-THU' : 'docs/nghiem-thu';
const rvBase = rootMode ? 'RA-SOAT' : 'docs/reviews';
const hasPhases = existsSync(join(dir, 'docs/phases')) && readdirSync(join(dir, 'docs/phases')).some((f) => /^PHASE-/.test(f));
const plan = [
  [join(T, 'nghiem-thu/README.md'), `${ntBase}/README.md`],
  [join(T, 'nghiem-thu/_MAU.md'), `${ntBase}/_MAU.md`],
  [join(T, 'reviews/README.md'), `${rvBase}/README.md`],
  ...(hasPhases ? [[join(T, 'phases/_MAU-BAN-GIAO.md'), 'docs/phases/_MAU-BAN-GIAO.md']] : []),
];
// thư mục khác có sẵn tên khác (docs/audits) vẫn tính là có nơi rà soát — không tạo thêm
const hasReview = ['docs/reviews', 'docs/audits', 'RA-SOAT'].some((d) => existsSync(join(dir, d)));
const done = [];
for (const [src, rel] of plan) {
  if (rel.endsWith('reviews/README.md') || rel.startsWith('RA-SOAT')) { if (hasReview) continue; }
  if (existsSync(join(dir, rel))) continue;
  done.push(rel);
  if (write) { mkdirSync(dirname(join(dir, rel)), { recursive: true }); copyFileSync(src, join(dir, rel)); }
}

// .gitignore kiểu danh sách cho phép (/* rồi !/…): mở thư mục mới
const gi = join(dir, '.gitignore');
const opened = [];
if (rootMode && existsSync(gi)) {
  for (const d of [ntBase, rvBase]) if (ignored(`${d}/README.md`)) opened.push(`!/${d}/`);
  if (opened.length && write) {
    const s = readFileSync(gi, 'utf8'); const nl = s.includes('\r\n') ? '\r\n' : '\n';
    writeFileSync(gi, s.replace(/\s*$/, '') + nl + '# [2026-11-25 01:48 PM Johnny Chu - Chu Hoàng Anh] STD-9 — nghiệm thu, rà soát (bizcity-platform bizcity_delivery@1)' + nl + opened.join(nl) + nl);
  }
}

// bảng việc: chỉ sinh khi chưa có, hoặc bảng hiện có do chính công cụ chung sinh — không đè bảng của công cụ riêng (open-ketoan scripts/bang-viec.mjs)
const boardFile = join(dir, 'docs/phases/BANG-VIEC.md');
const boardOurs = !existsSync(boardFile) || readFileSync(boardFile, 'utf8').includes('bizcity-platform tools/bang-viec.mjs');
let board = hasPhases && !boardOurs ? 'giữ bảng việc riêng của repo' : '';
if (hasPhases && boardOurs && write) board = spawnSync(process.execPath, [join(ROOT, 'tools/bang-viec.mjs'), '--repo', dir, '--write'], { encoding: 'utf8' }).stdout.trim();
console.log(`${write ? 'Đã tạo' : 'Sẽ tạo'} (${done.length}): ${done.join(', ') || '—'}${opened.length ? ` · .gitignore mở ${opened.join(' ')}` : ''}${hasPhases ? ` · bảng việc: ${board || (write ? '' : 'sẽ sinh')}` : ''}`);
