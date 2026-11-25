# `bizcity_app_skeleton@1` — Khuôn repo, lớp, manifest, CLI, nếp làm việc

<!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — trụ cột T1: khuôn chung của một Open App, rút từ open-ketoan (bản đầy đủ) và open-cake (bản gọn dùng @bizcity/platform). -->

> **Phiên bản:** 1.0.0 · 2026-11-25 · **Trạng thái:** **Chấp nhận** — chủ dự án duyệt 2026-11-25 <!-- [2026-11-25 10:30 AM Johnny Chu - Chu Hoàng Anh] STD-4 — chủ duyệt 2026-11-25 --> · **Bản mẫu:** open-ketoan, open-cake
> **Đứng dưới:** canon §7 (R-CANON-5), §12.

## 0. Một câu

**Mở repo nào cũng thấy cùng thư mục, cùng tệp đầu vào, cùng lệnh kiểm; khác nhau chỉ ở nghiệp vụ.**

## 1. Chọn trục và trụ cột trước khi viết mã

Một app mới phải trả lời được năm câu, ghi vào `bizcity.app.json` và `docs/00-CANON.md`:

1. **Sổ chỉ thêm của app là gì?** (bút toán, giao dịch ba chân, sổ chạm khách, lượt chạy, lệnh sản xuất, bảng công…). Một app một sổ (R-CANON-1).
2. **ID trục của app là gì**, ai mint, dạng gì (ULID là mặc định).
3. **App dùng trục nào của app khác** và giữ bằng bản sao, tham chiếu, hay danh mục cục bộ ràng buộc muộn (SPINE §4).
4. **Chứng từ app phát hành** mang `doc_ref` `<module>.<loại>:<id>` nào; nối với chứng từ app khác bằng `document_links`.
5. **Cửa nạp duy nhất** vào sổ tên gì (ví dụ `postDocumentIn`, `submitTouchIn`). Không có đường ghi thứ hai.

Tiêu chí để một thứ thành **trục mới** của hệ: có chủ rõ, ≥ 2 app cần, có ID bất biến, có phép đối chiếu (SPINE §7). Chưa đủ thì để ở lớp mềm (`entity_meta`, canon R-CANON-15).

## 2. Thư mục

```text
<app>/
├── bizcity.app.json            manifest bizcity_app@1 (trục làm chủ / dùng, hợp đồng, giấy phép)
├── AGENTS.md · CLAUDE.md       luật cho người và agent; dòng đầu trỏ docs/00-CANON.md
├── README.md · CHANGELOG.md · LICENSE · TRADEMARK.md
├── apps/api                    Fastify + zod; /api/v1 · /mcp · /_sites/v1 · /metrics
├── apps/web                    React 18 + Vite + react-query + react-router
├── packages/contracts          hợp đồng riêng của app (zod + JSON Schema)
├── packages/<trục>-kernel      luật của sổ; không HTTP, không import module
├── modules/<key>/              bizcity.module.json · api/ · web/ · migrations/ · examples/
├── db/migrations/NNNN_mo_ta.sql
├── tests/conformance/          selfcheck + baseline
├── docker/ · docker-compose.yml · infrastructure/{monitoring,backup}/ · scripts/
└── docs/
    ├── 00-CANON.md             luật của repo; dòng 1 trỏ canon chung
    ├── canon/README.md         trỏ canon (open-hub) + bản đồ chuẩn (bizcity-platform)
    ├── rules/ · contracts/ · adr/ · architecture/ · ops/
    └── phases/                 README.md · CLAIMS.md · PHASE-NNN-…/
```

Plugin WordPress (`runtime: wordpress-php`) giữ phần áp dụng được: `bizcity.app.json`, `AGENTS.md`, `CHANGELOG.md`, `docs/00-CANON.md` hoặc `docs/canon/README.md`, `docs/phases/`, `tests/`.

| Luật | Nội dung | Nguồn |
|---|---|---|
| R-STD-1 | Gói nền (`@bizcity/platform`, `@bizcity/contracts`) **phụ thuộc theo phiên bản, không fork**; mở rộng qua cổng đăng ký; sửa nền = PR vào bizcity-platform | R-PLAT-1..3, open-cake ADR-0002 |
| R-STD-2 | Hợp đồng nền **import từ `@bizcity/contracts`**, không chép vào repo. Bản chép tạm phải có ADR và ngày gỡ | mới (open-cake đang chép tạm `packages/contracts/src/base/`, ADR-0003) |
| R-STD-3 | Mỗi tệp mã có nhãn lớp `// @bizcity-layer <lớp>`; lớp trên không bị lớp dưới import ngược (platform → kernel → module → app) | R-BOUND-10, SC-LAYER-1/2 |
| R-STD-4 | Module không import module khác, không ghi bảng nhân; route module sinh từ `defineAction` | R-BOUND-1/2, STD-ACT-1 |
| R-STD-5 | Một chức năng = một action (`<app>.<thực thể>.<việc>`, zod vào / ra, quyền, rủi ro, `expose`) ⇒ REST + MCP + hook React + bằng chứng | R-CANON-14 |
| R-STD-6 | Định danh tiếng Anh; chú thích, thông báo, tài liệu tiếng Việt có dấu; tên tệp kebab-case | open-ketoan AGENTS, open-cake R-SIG |

## 3. Lớp

| Lớp | Biết gì | Không được |
|---|---|---|
| **platform** (`@bizcity/platform`) | HTTP, lỗi, auth, authz, action, sự kiện, bằng chứng, cài đặt, CSDL, nhiều site, log, số đo, trace | biết nghiệp vụ app nào (R-PLAT-1) |
| **kernel** (`packages/<trục>-kernel`) | luật của sổ, cửa nạp | HTTP, UI, import module |
| **module** (`modules/<key>`) | một nghiệp vụ, qua `@bizcity/module-sdk` | import kernel đường con, module khác, bảng nhân |
| **app** (`apps/*`) | lắp ráp, cấu hình | chứa luật nghiệp vụ |

## 4. CLI

Một lệnh `bizcity` cho mọi app (bản mẫu: open-ketoan `packages/cli/bin/bizcity.mjs`; chuyển về `@bizcity/cli` theo kế hoạch gói nền).

| Nhóm | Lệnh đang có ở bản mẫu |
|---|---|
| module | `module new \| check \| accounting-check \| list` |
| CSDL, site | `migrate` · `site create \| list \| key-create \| migrate \| backup \| restore \| suspend \| resume \| delete \| undelete \| sweep` |
| kiểm | `doctor` · `ledger verify` · `evidence verify` · `event check` · `flow check` · `explain <MÃ>` |
| thư viện, skill | `library search \| check \| diff \| new` · `skills install` |

| Luật | Nội dung |
|---|---|
| R-STD-7 | Lệnh có thể làm mất dữ liệu phải có `--dry-run` và in trước việc sẽ làm; mặc định chạy trên CSDL thử (bài học 5 của open-cake `90-LESSONS`) |
| R-STD-8 | Lệnh in kết luận máy đọc được (`KẾT LUẬN: PASS / FAIL`, mã thoát); SKIP không phải PASS |

## 5. Nếp làm việc

Giữ nguyên ba luật đang chạy ở open-ketoan; repo khác dùng cùng khuôn.

| Nếp | Nội dung | Nguồn · kiểm |
|---|---|---|
| Giữ chỗ | dòng ở `docs/phases/CLAIMS.md` qua PR tài liệu trước khi viết mã; đổi thứ dùng chung thì chốt thiết kế trước; nhánh ≤ 1 ngày | R-FLOW-1..10 · `scripts/nhan-viec.mjs`, SC-FLOW-* |
| Dấu thay đổi | `[YYYY-MM-DD HH:MM AM/PM <người chỉ đạo>] <MÃ> — <đổi gì>` tại chỗ đổi; không tên agent / model; không sửa dấu cũ | R-SIG-1..8 · `scripts/ky-dau.mjs`, SC-SIG-1/2 |
| Rà soát | 11 trục, T1 / T2 / T4 / T5 là cổng; rủi ro R0–R3 | R-REV-1..16 · `scripts/ra-soat-dong-gop.mjs` |
| Quyết định | ADR chỉ thêm, thay bằng "Thay bởi"; số ADR / migration lấy bằng công cụ | SC-DOC-3 · `scripts/so-tiep-theo.mjs` |
| Phase | thư mục `PHASE-NNN-TÊN/` có README (mục tiêu, việc `S<nnn>-n`, quyết định `D`, câu hỏi `Q`, "xong khi"), checklist, bằng chứng | open-ketoan `docs/phases/README.md`, open-cake R-PHASE |
| Đổi mã X → sửa tài liệu Y | bảng ở `docs/00-CANON.md` §5 của repo | SC-DOC-1/4/5 |

## 6. Kiểm

| Mã | Lane | Kiểm | Công cụ |
|---|---|---|---|
| SC-SPINE-1 | MANIFEST | `bizcity.app.json` hợp lệ, luật chéo | `tools/spine-check.mjs --manifest` |
| SC-STD-1 | HOUSE | tệp trỏ canon (`docs/canon/README.md`, `docs/00-CANON.md`, hoặc `CANON-SPINE.md` ở plugin WordPress) trỏ canon open-hub **và** bản đồ chuẩn này | `tools/standard-check.mjs --repo` |
| SC-STD-2 | HOUSE | có `README`, `AGENTS.md` (hoặc `CLAUDE.md`) — thiếu là chặn với app Node, cảnh báo với plugin; `CHANGELOG.md`, `LICENSE`, và `docs/phases/CLAIMS.md` (app Node) — thiếu là cảnh báo | như trên |
| SC-STD-3 | HOUSE | repo khai được lệnh kiểm của mình (`tests/conformance/selfcheck.mjs` hoặc script `test`) | như trên (mức cảnh báo) |

## 7. Khoảng cách hiện tại

| Repo | Thiếu so với khuôn |
|---|---|
| open-cake | `scripts/`, `tests/conformance/`, `infrastructure/`, CI chưa có dù `AGENTS.md` đã dẫn tới; `@bizcity/contracts` cài nhưng chưa import (R-STD-2) |
| open-ketoan | chưa dùng gói nền từ bizcity-platform (kế hoạch P6) |
| plugin WordPress | chưa có khuôn kiểm chung cho PHP; mỗi repo tự viết test |
