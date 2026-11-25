# `bizcity_testing@1` — Kiểm thử, selfcheck, bằng chứng

<!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — trụ cột T7: "chuẩn nào cũng phải có phép kiểm chạy được". Rút từ open-ketoan RULE-QUALITY-GATE, tests/conformance (159 phép kiểm, baseline chỉ được bớt) và cách test của open-cake. -->

> **Phiên bản:** 1.0.0-draft · 2026-11-24 · **Trạng thái:** chờ duyệt
> **Luật gốc:** open-ketoan `docs/rules/RULE-QUALITY-GATE.md` (R-QG-1..10), `docs/standard/CONFORMANCE.md`, `tests/conformance/README.md`, ADR-0006, `docs/ops/DIAGNOSTICS.md` §4.
> **Báo cáo:** [`bizcity_conformance_report@1`](BIZCITY-CONFORMANCE-REPORT-v1.md).

## 0. Một câu

**Không ai được ghi "đạt" nếu không có một lệnh chạy lại được cho ra chữ ĐẠT; nợ cũ chỉ được bớt, không được thêm.**

## 1. Bốn làn kiểm

| Làn | Hỏi gì | Chạy trên | Công cụ |
|---|---|---|---|
| **MANIFEST** | repo khai đúng vai trong hệ chưa | tệp `bizcity.app.json` | `tools/spine-check.mjs --manifest` |
| **HOUSE** (tĩnh) | mã và tài liệu trong repo có theo luật không | cây mã | selfcheck của repo (`SC-*`) · `tools/standard-check.mjs --repo` |
| **Chẩn đoán** | dữ liệu thật có nhất quán không | CSDL, **chỉ đọc** | diagnostics của app (`DG-*`, L0–L3) |
| **CONTRACT** (hộp đen) | API đang chạy có đúng hợp đồng không | HTTP vào một bản thử | `tools/spine-contract.mjs --target …` |

Cộng với **test** của repo (đơn vị, HTTP qua cửa thật) và **kịch bản vàng** đi hết một chuỗi nghiệp vụ.

## 2. Selfcheck

| Luật | Nội dung | Nguồn |
|---|---|---|
| R-STD-TEST-1 (mới) | mỗi repo có **một lệnh** kiểm tĩnh không cần cài đặt gì thêm (`node tests/conformance/selfcheck.mjs`), in bảng điểm và kết luận ĐẠT / KHÔNG ĐẠT, mã thoát đúng | open-ketoan |
| — | mỗi phép kiểm có mức: `block` (chặn) · `ratchet` (nợ cũ, chỉ được bớt) · `info` · `planned` | `tests/conformance/README.md` |
| — | nợ nằm trong `baseline.json`; bộ kiểm báo nợ **mới** ⇒ sửa, không thêm vào baseline; nợ cũ hết ⇒ `--update-baseline` | AGENTS open-ketoan |
| — | bộ kiểm tự thử chính nó (`--self-test`): mỗi phép kiểm phải bắt được ca sai đã biết | open-ketoan |
| SC-DOC-2 | mỗi luật trong `docs/rules/` ghi rõ "kiểm bằng" trỏ tới tệp thật; mỗi mã luật định nghĩa đúng một chỗ (SC-CON-5) | open-ketoan |
| R-STD-TEST-2 (mới) | viết luật mới cùng PR với phép kiểm của nó, hoặc ghi rõ `planned` kèm việc lộ trình. Lỗi lặp lại ⇒ thêm luật dò (R-REV-10) | — |

## 3. Test

| Luật | Nội dung | Nguồn |
|---|---|---|
| R-QG-* | test chạy trên **PostgreSQL thật** (cùng bản lớn với sản xuất), không giả lập CSDL | open-ketoan |
| R-STD-SEC-5 | tên CSDL test phải có chữ `test`; thiếu thì **dừng**, không bỏ qua | [SECURITY](BIZCITY-SECURITY-v1.md) §5 |
| R-QG-3 | mỗi lần chạy một đơn vị mới (`setupTenant()`); không dùng lại dữ liệu lần trước | open-ketoan |
| — | CSDL test dùng chung dễ bẩn: mỗi nhánh / mỗi tệp test một CSDL sạch, xoá sau khi xong (open-cake `apps/api/test/fresh-db.ts`) | open-cake |
| R-QG-5 | app có sổ kiểm bất biến của sổ ở `afterAll` (`assertLedgerInvariants`) | open-ketoan |
| — | test đi qua **cửa thật** (HTTP / `buildApp`), chạy bằng vai CSDL của ứng dụng | open-cake |
| R-QG-8 | không thêm `.only` / `.skip` | open-ketoan |
| R-STD-TEST-3 (mới) | test liên repo dùng **vật thật của bên kia**: vé do mã PHP của plugin dựng, không tự viết vé trong test (bản mẫu: `tools/hub-local/check.sh`) | bài học SSO 2026-11-24 |
| R-STD-TEST-4 (mới) | sửa lỗi: viết test **đỏ đúng mã lỗi** trước, rồi mới sửa; đổi mã xong thử ngược (bỏ thay đổi ⇒ test phải đỏ) | open-ketoan AGENTS "Sửa lỗi bằng AI" |

## 4. Bằng chứng

| Luật | Nội dung |
|---|---|
| R-QG-6 | PR đụng phần bất biến dán **khối bằng chứng** (lệnh đã chạy + kết quả); selfcheck sinh sẵn `output/latest/evidence.txt` |
| R-DIAG-7 | "đạt trên dữ liệu rỗng" không phải đạt: phép kiểm phải có dữ liệu để kiểm |
| R-ECP-SCORE | không ghi "đạt" cho trụ cột khi không có check / chẩn đoán / test chạy được |
| — | mockup được duyệt là **đích 100%** của màn; ảnh chụp màn dựng xong lưu cạnh phase ([WEB](BIZCITY-WEB-v1.md) §5) |
| — | chấm PR đã merge: `scripts/cham-pr.mjs` (3 mặt × 12 trục); rà đóng góp: `scripts/ra-soat-dong-gop.mjs` |

## 5. CI

| Việc | Bản mẫu |
|---|---|
| mọi PR: kiểm tĩnh + typecheck + test trên PostgreSQL 16 | open-ketoan `.github/workflows/ci.yml`; bizcity-platform `ci.yml` |
| nâng cấp từ bản phát hành trước (`migrate-upgrade`) | open-ketoan `ci.yml` |
| cấu hình giám sát (`promtool`, `amtool`, `otelcol`) | open-ketoan `conformance.yml` |
| gói nền: chạy test của **mọi app đang dùng** trước khi phát hành (R-PLAT-4) | kế hoạch, chưa có ma trận |

**Ghi nhận:** CI trên GitHub của các repo đang bị khoá do thanh toán (từ 2026-11-22). Cho tới khi mở lại, kết luận ĐẠT lấy từ lần chạy trên máy và phải dán kèm khối bằng chứng.

## 6. Mức tối thiểu cho từng loại repo

| Loại | Bắt buộc |
|---|---|
| App Node (ketoan, cake, MRP, HRM…) | selfcheck + test PostgreSQL + `spine-check` + `standard-check`; qua `spine-contract` trước khi nối app khác |
| Plugin WordPress | `spine-check` + `standard-check` + test PHP chạy không cần WordPress (bản mẫu: bridge `tests/*.php`, mỗi kịch bản một tiến trình) |
| Gói nền | test của gói + vector schema + chạy `spine-contract` vào một bản open-ketoan thử |

## 7. Khoảng cách hiện tại

| Repo | Thiếu |
|---|---|
| open-cake | chưa có selfcheck, `scripts/kiem-chuan.sh`, CI (tài liệu đã dẫn tới) — 106 test vitest là thứ đang thi hành |
| plugin WordPress | chưa có khung selfcheck chung cho PHP |
| bizcity-platform | `@bizcity/conformance` (khung selfcheck dùng chung) chưa tách khỏi open-ketoan; lane CONTRACT mới có profile `ledger` |
