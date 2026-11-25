# `bizcity_release@1` — Phiên bản, migration SQL, sao lưu, nâng cấp, phát hành

<!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — trụ cột T8: một cách đánh phiên bản, một cách đổi CSDL, một trình tự nâng cấp cho mọi app. Rút từ open-ketoan VERSIONING, RULE-RELEASE, RULE-DATABASE, R-BAK và cách phát hành gói nền ở repo này. -->

> **Phiên bản:** 1.0.0-draft · 2026-11-24 · **Trạng thái:** chờ duyệt (Q-REL-1)
> **Luật gốc:** open-ketoan `docs/standard/VERSIONING.md` (VER-1..5), `docs/rules/RULE-RELEASE.md` (R-REL-1..11), `RULE-DATABASE.md` (R-DB-*), `RULE-INFRASTRUCTURE.md` (R-BAK-1..6), `docs/ops/{RELEASE,DEPLOY,SAO-LUU-KHOI-PHUC}.md`.

## 0. Một câu

**CSDL chỉ đi tới; muốn lùi thì khôi phục bản sao lưu — vì vậy không có nâng cấp nào chạy trước khi có bản sao lưu đã thử khôi phục được.**

## 1. Bốn trục phiên bản (độc lập)

| Trục | Dạng | Tăng khi |
|---|---|---|
| Chuẩn | `bizcity_standard_map@1` | đổi bản đồ chuẩn có phá tương thích |
| Hợp đồng | `bizcity_<tên>@MAJOR` + SemVer trong đầu tệp | thêm trường tuỳ chọn = minor; phá = tệp `-v2`, `@2`, ADR |
| Gói / app | SemVer `vX.Y.Z` | theo CHANGELOG |
| Lược đồ CSDL | số migration cuối + `schema_version` | mỗi migration |

| Luật | Nội dung |
|---|---|
| VER-3 | bản lớn cũ chạy song song bản mới **≥ 2 bản phát hành hoặc 6 tháng**; bên nhận bỏ qua trường lạ |
| R-REL-7 | báo ngừng dùng trước một bản minor rồi mới gỡ |
| R-REL-2 | `CHANGELOG.md` có mục `## [Chưa phát hành]`; mỗi thay đổi một dòng có ngày, mức K0–K3 nếu đụng nền |
| R-REL-1 | phát hành = tag `vX.Y.Z`; `GET /api/v1/system/health` trả phiên bản app, kernel, chuẩn |
| R-STD-REL-1 (mới) | phiên bản trong `package.json` / tiêu đề plugin, tag và CHANGELOG **phải khớp**; công cụ đóng gói kiểm trước khi phát hành (bản mẫu: `tools/dong-goi.mjs`) |

## 2. Migration: SQL là nguồn sự thật

| Luật | Nội dung | Kiểm |
|---|---|---|
| R-DB-14 (T0) | lược đồ là **tệp SQL**; không ORM sinh lược đồ; kiểu Kysely đi theo migration | SC-DATA-7 |
| R-DB-1 · R-DB-3 | `db/migrations/NNNN_mo_ta_khong_dau.sql`, chỉ thêm, số duy nhất, không hở | SC-DATA-1 |
| R-DB-15 | tệp đã phát hành **không sửa một byte**; khoá bằng checksum | `locks/migrations.lock.json`, `scripts/kiem-nang-cap.sh` |
| R-DB-4 | mỗi tệp một giao dịch; khoá tư vấn khi chạy (không hai tiến trình cùng migrate) | — |
| R-DB-5 | bảng, cột có `COMMENT ON` tiếng Việt | SC-DATA-3 |
| R-REL-5 | không có migration lùi; lùi = khôi phục sao lưu | — |
| R-DB-19 | migration do AI viết phải qua người duyệt và có sao lưu trước | — |
| — | số migration / ADR lấy bằng công cụ khi nhiều nhánh song song | `scripts/so-tiep-theo.mjs migration \| adr \| kiem` |
| R-STD-REL-2 (mới) | **dải số theo nguồn**: nền `00xx` (từ `@bizcity/platform`, `PLATFORM_MIGRATIONS_DIR`), app `01xx` trở lên; một trình chạy cho mọi nguồn, trùng tên ⇒ dừng | D-PLAT-5; open-cake `apps/api/src/migrate.ts` |
| R-SITE-11 | migration không ghi cứng tên CSDL, tên vai (để chạy được trên mọi site) | — |
| — | tiền `numeric(18,2)`; khoá chính bigint identity hoặc ULID cho ID trục | SC-DATA-4, SPINE §2 |

Chạy migration là **job riêng** (`db-migrate` trong compose) bằng vai chủ; API chỉ kiểm sẵn sàng và trả 503 `NOT_READY` khi còn thiếu.

## 3. Sao lưu

| Luật | Nội dung | Công cụ ở bản mẫu |
|---|---|---|
| R-BAK-1 | `pg_dump` hằng ngày, giữ 14 bản | `scripts/sao-luu.sh` |
| R-BAK-2 | khôi phục tới thời điểm (PITR): RPO ≤ 15 phút, RTO ≤ 4 giờ | `infrastructure/backup/docker-compose.pitr.yml`, `scripts/dien-tap-pitr.sh` |
| R-BAK-3 | **bản sao lưu chưa thử khôi phục coi như chưa có**: thử hằng tuần, ghi nhật ký | `scripts/kiem-khoi-phuc.sh` |
| — | nhiều site: sao lưu từng site, tự kiểm bằng `pg_restore --list`; khôi phục vào CSDL tạm rồi đổi tên | `bizcity site backup \| restore` |
| R-STD-REL-3 (mới) | thao tác có thể mất dữ liệu của khách (khôi phục mặc định, nâng cấp ảnh, nhập bản sao lưu) phải: tự sao lưu trước, có chạy thử (`--dry-run`), cảnh báo rõ bằng lời | chủ chỉ đạo; open-ketoan |

## 4. Nâng cấp

Trình tự cố định (R-REL-9, R-SITE-8..10), chỉ qua một script (`scripts/cap-nhat.sh`):

```text
1. sao lưu  →  2. kéo mã / ảnh mới  →  3. migrate (nhiều site: bản mẫu trước, rồi từng site, mỗi site sao lưu trước)
→ 4. khởi động  →  5. kiểm sức khoẻ + diagnostics  →  6. ghi phiên bản
site lỗi migration bị chặn riêng (SITE_MIGRATION_FAILED), các site khác chạy tiếp
```

CI thử nâng cấp **từ bản phát hành trước** lên bản hiện tại (`migrate-upgrade`).

## 5. Đóng gói và phát hành

| Thứ | Cách | Trạng thái |
|---|---|---|
| Gói nền `@bizcity/*` | tag ⇒ build + test ⇒ `tools/dong-goi.mjs` ⇒ tệp `.tgz` đính kèm GitHub Release; app cài bằng URL có phiên bản | đang chạy (v0.2.0) |
| App Node | ảnh Docker (`docker/api.Dockerfile`, `web.Dockerfile`), tài liệu đọc lúc chạy phải nằm trong ảnh (SC-REL-3) | đang chạy ở open-ketoan |
| Plugin WordPress | tệp zip theo tag; `Version:` trong tiêu đề plugin khớp tag | mỗi repo tự làm |
| Nhãn OCI, SBOM, checksum, tag có chữ ký (R-REL-8) | — | **mới trên giấy**: open-ketoan chưa có `release.yml`, chưa có tag |

## 6. Kiểm

| Mã | Lane | Kiểm | Có ở |
|---|---|---|---|
| SC-REL-1/2/3, SC-DATA-1/2/3/4/7 | HOUSE | changelog, migration, kiểu khớp lược đồ | open-ketoan selfcheck |
| `kiem-nang-cap.sh`, CI `migrate-upgrade` | HOUSE | checksum migration, nâng cấp từ bản trước | open-ketoan |
| SC-STD-REL-1 | HOUSE | có `CHANGELOG.md` với mục chưa phát hành; phiên bản trong manifest khớp `package.json` / tiêu đề plugin | `tools/standard-check.mjs` (mức cảnh báo) |

## 7. Khoảng cách hiện tại

| Repo | Thiếu |
|---|---|
| open-ketoan | chưa có tag, `package.json` còn 0.1.0, chưa có quy trình phát hành tự động |
| open-cake | CHANGELOG chỉ có mục chưa phát hành; sao lưu, nhiều site, phát hành là kế hoạch (PHASE-014 / 015) |
| plugin WordPress | chưa có luật chung về tag và changelog |
