#!/usr/bin/env node
// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer platform
// [2026-11-25 01:45 PM Johnny Chu - Chu Hoàng Anh] STD-6 — đường dẫn của bizcity-platform viết thành liên kết (không đặt trong dấu huyền), để bộ kiểm đường dẫn của repo nhận (open-ketoan SC-DOC-4) không hiểu là tệp của repo đó.
// [2026-11-25 01:16 PM Johnny Chu - Chu Hoàng Anh] STD-5 — sinh docs/NO-CHUAN-NEN.md cho một repo app (R-STD-9): nợ do bộ kiểm đo
//   (spine-check, standard-check, users-check) + nợ đã biết trong sổ docs/standard/no-chuan.json. Chủ chỉ đạo 2026-11-25: bizcity-platform
//   giữ khuôn; việc từng repo ghi thành nợ để dev repo đó cải thiện, tuân định hướng. Chỉ đọc repo; ghi đúng một tệp khi có --write.
//
//   node tools/no-chuan.mjs --repo <thư mục>            # in tệp nợ ra màn hình
//   node tools/no-chuan.mjs --repo <thư mục> --write    # ghi <thư mục>/docs/NO-CHUAN-NEN.md
//   node tools/no-chuan.mjs --check                     # tự kiểm sổ nợ: mã luật đúng khuôn, tệp chuẩn có thật (SC-STD-DEBT-1)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, join, resolve } from 'node:path';
import { ROOT } from './lib/json-schema.mjs';

const STD = join(ROOT, 'docs/standard');
const REG = JSON.parse(readFileSync(join(STD, 'no-chuan.json'), 'utf8'));
const B = 'https://github.com/hoanganh8389/bizcity-platform/blob/main/docs';
const RULE_RE = /^(R-[A-Z]+(-[A-Z]+)*-[0-9]+|R-ECP-SCORE|SC-[A-Z]+(-[A-Z]+)*-[0-9]+|Q-[A-Z]+-[0-9]+|C-[0-9]+-[0-9]+)$/;
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

function selfCheck() {
  const out = [];
  for (const [repo, items] of Object.entries(REG.repos)) {
    items.forEach((it, i) => {
      const where = `no-chuan.json › ${repo}[${i}]`;
      if (!RULE_RE.test(it.rule)) out.push(`${where}: mã luật "${it.rule}" sai khuôn`);
      if (!existsSync(join(STD, it.std))) out.push(`${where}: tệp chuẩn ${it.std} không có`);
      if (!it.todo || it.todo.length < 10) out.push(`${where}: thiếu việc phải làm`);
    });
  }
  return out;
}

/** Chạy một công cụ kiểm của repo này ở chế độ --json, trả phát hiện mức fail / warn. */
function run(tool, args) {
  const r = spawnSync(process.execPath, [join(ROOT, 'tools', tool), ...args, '--json'], { encoding: 'utf8' });
  try { return JSON.parse(r.stdout).findings.filter((f) => f.level === 'fail' || f.level === 'warn').map((f) => ({ ...f, tool })); } catch { return [{ id: tool, level: 'fail', where: '', msg: 'không chạy được: ' + (r.stderr || r.stdout).slice(0, 160), tool }]; }
}

function render(dir) {
  let app = {};
  try { app = JSON.parse(readFileSync(join(dir, 'bizcity.app.json'), 'utf8')); } catch { /* standard-check báo */ }
  const id = app.id || basename(dir);
  const measured = [
    ...(existsSync(join(dir, 'bizcity.app.json')) ? run('spine-check.mjs', ['--manifest', join(dir, 'bizcity.app.json')]) : []),
    ...run('standard-check.mjs', ['--repo', dir]),
    ...run('users-check.mjs', ['--repo', dir]),
  ].filter((f) => f.id !== 'SC-STD-2' || !f.where.endsWith('NO-CHUAN-NEN.md'));
  const known = REG.repos[id] ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const strip = (w) => w.replace(new RegExp(`^${basename(dir)}/`), '');
  return `# Nợ chuẩn nền — ${app.name || id}

<!-- [${stamp()} Johnny Chu - Chu Hoàng Anh] STD-5 — sinh bởi bizcity-platform tools/no-chuan.mjs (R-STD-9). Sửa nợ ở repo này; thêm / bớt mục "đã biết" thì sửa sổ docs/standard/no-chuan.json bên bizcity-platform rồi sinh lại. -->

> Ngày đo: ${today} · Repo: \`${id}\` · Chuẩn: [bản đồ chuẩn nền \`bizcity_standard_map@1\`](${B}/standard/README.md) · Kiến trúc: [ARCHITECTURE](${B}/ARCHITECTURE.md)

Tệp này liệt kê chỗ repo **chưa theo khuôn chung** của hệ. Dev của repo trả dần, mỗi lần một mục, theo nếp giữ chỗ / PR của repo. bizcity-platform giữ khuôn và bộ kiểm; **không ai sửa hộ** và **không nới chuẩn để trả nợ**.

## Định hướng phải giữ khi trả nợ

1. Mỗi app một sổ, một trục; tham chiếu app khác bằng ID của chủ (\`item_id\`, \`doc_ref\`, \`contact_id\`, \`sub\`), không bịa ID, không đọc CSDL chéo.
2. Người dùng · vai · quyền theo một khuôn ([USERS-ROLES](${B}/standard/BIZCITY-USERS-ROLES-v1.md)): bảng của gói nền, quyền \`<module>:<chức-năng>-<động-từ>\` tiếng Việt không dấu, từ chối luôn thắng, khoá API không mang quyền rủi ro cao. App tự đứng được không cần Hub; SSO nối sau.
3. Không ghi "xong" khi chưa có phép kiểm chạy được; nợ mới không vào baseline.
4. Đổi thứ dùng chung (hợp đồng, quyền, migration) có chữ chốt trước, có bằng chứng chạy máy trong PR.
5. Mọi ứng dụng 0 đồng; chỉ 1API của Zalo Hub và dịch vụ theo liên hệ tính phí.

## Nợ do bộ kiểm đo (${measured.length})

${measured.length ? `| Mã | Mức | Ở đâu | Việc |\n|---|---|---|---|\n${measured.map((f) => `| ${f.id} | ${f.level === 'fail' ? 'chặn' : 'cảnh báo'} | \`${cell(strip(f.where))}\` | ${cell(f.msg)} |`).join('\n')}` : 'Không có.'}

## Nợ đã biết từ rà soát (${known.length})

${known.length ? `| # | Luật | Việc | Lưu ý | Chuẩn |\n|---|---|---|---|---|\n${known.map((k, i) => `| ${i + 1} | ${k.rule} | ${cell(k.todo)} | ${cell(k.note) || '—'} | [${k.std.replace(/^BIZCITY-|-v1\.md$/g, '')}](${B}/standard/${k.std}) |`).join('\n')}` : 'Không có.'}

## Trả nợ thế nào

1. Chọn một mục; nhận việc theo nếp của repo (giữ chỗ nếu có \`docs/phases/CLAIMS.md\`).
2. Làm theo chuẩn được dẫn; có phép kiểm hoặc test chứng minh.
3. Chạy lại bộ kiểm (bizcity-platform cạnh repo này):

\`\`\`bash
node ../bizcity-platform/tools/standard-check.mjs --repo .
node ../bizcity-platform/tools/users-check.mjs --repo .
node ../bizcity-platform/tools/no-chuan.mjs --repo . --write   # sinh lại tệp này
\`\`\`

4. Mục "đã biết" trả xong: PR nhỏ vào bizcity-platform gỡ mục khỏi [sổ nợ chuẩn nền](${B}/standard/no-chuan.json), rồi sinh lại tệp này.
`;
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const h = d.getHours() % 12 || 12;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(h)}:${p(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

const args = process.argv.slice(2);
if (args.includes('--check')) {
  const errs = selfCheck();
  for (const e of errs) console.log('✗ SC-STD-DEBT-1 ' + e);
  console.log(`KẾT LUẬN: ${errs.length ? 'KHÔNG ĐẠT' : 'ĐẠT'} (${Object.values(REG.repos).flat().length} mục nợ đã biết, ${Object.keys(REG.repos).length} repo)`);
  process.exit(errs.length ? 1 : 0);
}
const i = args.indexOf('--repo');
if (i < 0 || !args[i + 1]) { console.error('Cần --repo <thư mục>'); process.exit(2); }
const dir = resolve(args[i + 1]);
const md = render(dir);
if (args.includes('--write')) {
  // [2026-11-25 02:00 PM Johnny Chu - Chu Hoàng Anh] STD-7 — repo để git bỏ qua docs/ (vài plugin WordPress) ⇒ ghi ra gốc, cạnh CANON-SPINE.md.
  const ignored = spawnSync('git', ['-C', dir, 'check-ignore', '-q', 'docs/NO-CHUAN-NEN.md']).status === 0;
  const rel = ignored ? 'NO-CHUAN-NEN.md' : 'docs/NO-CHUAN-NEN.md';
  if (!ignored) mkdirSync(join(dir, 'docs'), { recursive: true });
  writeFileSync(join(dir, rel), md);
  console.log('đã ghi ' + rel);
} else process.stdout.write(md);
