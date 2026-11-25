# `bizcity_multisite@1` — Một bản mã, nhiều CSDL: registry site, định tuyến, cấp site

<!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — trụ cột T10: cách một bản mã phục vụ nhiều tên miền / pháp nhân, mỗi site một CSDL. Rút từ open-ketoan ADR-0036, RULE-SITE (R-SITE-1..13), PHASE-039 và mã packages/platform/src/db/site-*.ts (nay nằm trong @bizcity/platform); open-cake PHASE-014 dùng lại. -->

> **Phiên bản:** 1.0.0-draft · 2026-11-24 · **Trạng thái:** chờ duyệt (Q-STD-1, Q-STD-2)
> **Luật gốc:** open-ketoan `docs/adr/ADR-0036-…`, `docs/rules/RULE-SITE.md`, `docs/contracts/BIZCITY-SITE-PROVISIONING-v1.md`, `docs/ops/NHIEU-SITE.md`; canon R-CANON-5, R-CANON-13.

## 0. Một câu

**Một bản mã chạy cho mọi khách; mỗi khách một CSDL riêng cho mỗi app; không yêu cầu nào chạm CSDL khi chưa biết chắc nó thuộc site nào.**

## 1. Từ vựng (đề xuất Q-STD-1 — hiện mỗi repo hiểu một kiểu)

| Từ | Nghĩa đề xuất | Ví dụ | Ai làm chủ |
|---|---|---|---|
| **site** | một doanh nghiệp thuê hệ thống: một `slug`, mỗi app bật một CSDL (`kt_<slug>`, `cake_<slug>`), một khoá `biz-…` | `hoa-mai` | registry (open-setup + control DB của từng app) |
| **tenant** (đơn vị) | một pháp nhân / sổ / cửa hàng **bên trong** site: một dòng `tenants`, cách ly bằng `tenant_id` + RLS | `hoa-mai-q1`, `hoa-mai-q7` | app (open-ketoan mint `tenants.code`) |
| **blog** | một site con trong mạng WordPress; ánh xạ 1–1 sang một **tenant** (bất biến I-1 của chương trình OKT) | blog 2 → tenant `shopa` | WordPress |
| **chi nhánh / kho** | `branch_code` thuộc một tenant | `CN01` | open-ketoan |

Doanh nghiệp nhỏ: một site, một tenant, cùng mã — khi đó hai từ trùng nhau, và đó là lý do các tài liệu cũ dùng lẫn. **Hệ quả nếu được duyệt:** trục `tenant` của [SPINE](BIZCITY-SPINE-v1.md) §2 đang mô tả là "slug site" cần tách thành `site` (slug) và `tenant` (mã đơn vị) — đổi chuẩn spine nên cần ADR riêng; cho tới lúc đó spine giữ nguyên.

**Khuôn slug (Q-STD-2):** đề xuất một khuôn `^[a-z][a-z0-9-]{2,29}$` (đang chạy ở control DB). Spine đang ghi `{1,30}`, bizcity-web đang dùng `^[a-z][a-z0-9]{2,19}$` (chặt hơn, vẫn hợp lệ theo khuôn chung).

## 2. Hai chế độ, một đường mã

| | `SITE_MODE=single` (mặc định) | `SITE_MODE=multi` |
|---|---|---|
| Dùng cho | một công ty tự cài | mạng nhiều khách (bizcity) hoặc chuỗi nhiều pháp nhân |
| CSDL | một (`DATABASE_URL`) | control DB + mỗi site một CSDL từ CSDL mẫu |
| Biến | — | `CONTROL_DATABASE_URL`, `SITE_TEMPLATE_DB`, `SITE_SECRET_KEY` (≥ 32 ký tự), `PROVISION_DATABASE_URL`, `SITE_APP_PARENT_ROLE`, `SITE_ADMIN_HOST`, `SITE_BACKUP_DIR` |

| Luật | Nội dung |
|---|---|
| R-SITE-5 | chỉ **bộ định tuyến CSDL** và `forEachSite` biết có nhiều site; mã nghiệp vụ không rẽ nhánh theo chế độ |
| R-SITE-1 | một site = một CSDL; tenant và RLS vẫn nằm trong site |
| R-SITE-2 | mỗi site một vai CSDL riêng (`<tiền tố>_<slug>_app`), mật khẩu mã hoá trong registry |
| R-SITE-3 | **đóng khi thiếu**: không rõ site ⇒ `SITE_NOT_FOUND` (404) / `SITE_CONTEXT_MISSING`; không rơi về CSDL mặc định |
| R-SITE-4 | phiên mang `sid`; `sid` phải khớp site của `Host` |
| R-SITE-6 | mọi khoá đệm có site ([CACHE](BIZCITY-CACHE-v1.md)) |
| R-SITE-11 | migration không ghi cứng tên CSDL / vai |
| R-SITE-13 | khoá bản quyền **không bao giờ** chặn sổ: hết hạn thì hạ gói, không khoá dữ liệu |

## 3. Registry (control DB)

Mỗi app một control DB cùng lược đồ (migration riêng `db/control-migrations/`, khoá tư vấn riêng):

| Bảng | Giữ |
|---|---|
| `sites` | `id` ULID, `slug`, `status` (`provisioning · active · suspended · upgrading · migration_failed · deleted`), nơi đặt CSDL, `schema_version`, `app_version`, `owner_email`, `external_ref`, vai và bí mật đã mã hoá, dấu vết khôi phục / xoá |
| `site_domains` | tên miền → site (`is_primary`) |
| `provision_keys` | khoá `prov_…` (băm, danh sách IP) |
| `site_jobs` | việc cấp site: `Idempotency-Key`, băm yêu cầu, các bước, kết quả đã mã hoá |
| `site_backups` | bản sao lưu từng site |

Định tuyến: `Host` → `site_domains` → site (đệm 30 giây) → kết nối riêng (tối đa 4 kết nối / site, đóng sau 30 giây rảnh). Cổng lược đồ: site đang nâng cấp trả 503 `SITE_UPGRADING` / `SITE_MIGRATION_FAILED` (R-SITE-9).

## 4. Cấp site — hợp đồng `bizcity_site_provisioning@1`

```text
bizcity-web (trang dùng thử)  →  open-setup (Site Manager: khách, site, sản phẩm bật)  →  /_sites/v1 của từng app (khoá prov_…, chỉ ở SITE_ADMIN_HOST)
```

Các bước của app (có hoàn tác từng bước): ghi registry → tạo vai → `CREATE DATABASE … TEMPLATE <mẫu>` → thu quyền CONNECT của PUBLIC → lưu bí mật đã mã hoá → tạo đơn vị đầu và chủ → bật site.

| Luật | Nội dung | Nguồn |
|---|---|---|
| R-STD-SITE-1 (mới) | mọi app nhiều site dùng **cùng** hợp đồng cấp site và cùng mã registry của `@bizcity/platform` (`db/site-*`); khác nhau chỉ ở tiền tố CSDL và trường `product` | open-cake PHASE-014, canon §6 |
| R-STD-SITE-2 (mới) | open-setup **không** nối PostgreSQL của app; chỉ gọi `/_sites/v1` | open-setup R-ROLE-3 |
| R-STD-SITE-3 (mới) | cùng một `slug` cho mọi app của một site; bật thêm app = thêm một CSDL, không thêm khoá, không nối tay | R-CANON-13 |
| R-SITE-12 | xoá mềm: đổi tên CSDL, giữ 30 ngày rồi mới dọn | open-ketoan |
| — | việc cấp site idempotent theo `Idempotency-Key`; `external_ref` nối site với người dùng Hub đã tạo nó | PHASE-039 S039-21 |

## 5. Nâng cấp và sao lưu nhiều site

Theo [RELEASE](BIZCITY-RELEASE-v1.md) §3–4: CSDL mẫu trước, rồi từng site, mỗi site sao lưu trước; site lỗi bị chặn riêng, site khác chạy tiếp (R-SITE-8, R-SITE-10). Việc nền chạy qua `forEachSite`. Lệnh: `bizcity site create | list | migrate --all | backup | restore | suspend | resume | delete | undelete | sweep`.

## 6. Ba kiểu cài của bên bán hàng (POS ↔ kế toán)

Kiểu cài **khai rõ**, không đoán từ khoá (`TGS_ACC_DEPLOYMENT`; WordPress một site tự là `single`).

| | bizcity (mạng nhiều khách) | chain (tự cài, nhiều cửa hàng) | single |
|---|---|---|---|
| Khoá gọi kế toán | mỗi blog một khoá của đơn vị | một khoá cài đặt + `X-OKT-Blog` + `X-OKT-Install` | một khoá |
| blog → tenant | theo khoá | bảng duyệt ở open-ketoan (ADR-0037) | theo khoá |
| Dữ liệu | blog = tenant = sổ ở mọi kiểu | như trên | như trên |

Nguồn: chương trình OKT (open-setup `docs/chuong-trinh/OKT/`, P-0 và I-1), bridge `includes/class-tgs-acc-profile.php`.

## 7. Kiểm

| Mã | Lane | Kiểm | Trạng thái |
|---|---|---|---|
| test `site-registry`, `site-env` | test | registry, biến môi trường | có ở open-ketoan |
| (S039-8) | HOUSE | khoá đệm có site | có, còn 2 chỗ thiếu |
| SC-SITE-P1 | HOUSE | không tệp nào ngoài bộ định tuyến đọc `SITE_MODE` / mở kết nối theo site | đề xuất — hiện **chưa có họ SC-SITE nào** |
| SC-SITE-P2 | CONTRACT | `Host` lạ ⇒ 404 `SITE_NOT_FOUND`; phiên của site A gọi sang `Host` của site B ⇒ từ chối | đề xuất |
| T039-1..14 | nghiệm thu | chạy cùng Site Manager | chưa chạy (S039-20) |

## 8. Khoảng cách hiện tại

| Nơi | Thiếu |
|---|---|
| open-ketoan | nghiệm thu cùng Site Manager (S039-20); khoá bản quyền mềm `biz-…` (S039-14) chưa có ở cả hai phía; còn 2 chỗ đệm thiếu khoá site |
| open-cake | nhiều site là kế hoạch (PHASE-014) |
| open-setup | chưa có trường `product`; chưa có sổ ánh xạ **blog ↔ site ↔ bản app** (hiện chỉ là user meta + `external_ref`) |
| tài liệu | tiêu đề ADR-OKT-1 còn ghi "tám bất biến" (nay chín); `CAU-HINH-KET-NOI.md` của bridge viết trước kiểu chain |
