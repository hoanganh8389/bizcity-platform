# NC-005 — Lõi ERP gọn: học WordPress + Odoo, mười hai thứ open-core bảo đảm cho mọi app
<!-- [2026-11-28 06:49 PM Johnny Chu - Chu Hoàng Anh] NC-005 — chủ (2026-11-28): "học từ wp, những gì cần chuẩn hoá universal về open-core; đứng ở góc độ ERP, phần nào vừa đảm bảo xuyên suốt, vừa lean, học odoo điểm gì; có UI UX thống nhất chuẩn hoá không?" → "đồng ý theo đề xuất, bổ sung vào; đánh giá code base đáp ứng so với tài liệu, lập scoreboard theo dõi". -->

> **Loại:** nghiên cứu + chốt phạm vi lõi · **Trạng thái:** chủ đồng ý đề xuất (2026-11-28); Q-ERP-1 (đa tiền tệ) chờ chủ
> **Đứng trên:** [NC-001](NC-001-KERNEL-TU-WORDPRESS.md) (học WordPress) · [NC-003](NC-003-TACH-OPEN-CORE.md) · [NC-004](NC-004-TRU-COT-XUYEN-DOANH-NGHIEP.md) · canon R-CANON-17 / 18 / 19
> **Kéo theo:** chuẩn mới [`bizcity_ux@1`](../standard/BIZCITY-UX-v1.md) · open-core PHASE-003 thêm S003-9…12 · scoreboard tiến độ ở open-core `docs/scoreboard/`

## 0. Một câu

**Odoo mạnh vì mọi app giống nhau; WordPress mạnh vì lõi nhỏ, registry rõ.** open-core lấy cả hai: **mười hai thứ dùng chung** do lõi bảo đảm và khai báo một lần; mọi thứ khác là module. Không lấy phần nặng (kế thừa ORM chéo module, view XML, một CSDL cho mọi app).

## 1. Mười hai thứ lõi bảo đảm (ERP-12)

| # | Thứ dùng chung | Học từ | Chuẩn | Ghi |
|---|---|---|---|---|
| E-1 | Người dùng · danh tính · `user_meta` | WP `wp_users` / `wp_usermeta`; Odoo `res.users` | IDENTITY, USERS-ROLES | `sub = wp:<id>`; tuỳ chọn cá nhân ở `user_meta` |
| E-2 | Vai · quyền · phạm vi · màn × thao tác | WP capabilities; Odoo groups + **record rules** | USERS-ROLES, AUTHORIZATION | RLS + phạm vi vai = record rules; quyền xuất tách quyền xem |
| E-3 | Cài đặt + meta + bản ghi mềm | WP options / postmeta / CPT; Odoo `ir.config_parameter` | SETTINGS-MATRIX, lớp mềm R-CANON-15 | thang `install → site → tenant → branch → user` + bậc app khai |
| E-4 | Chứng từ + đánh số + phiên bản + liên kết + workflow | Odoo `ir.sequence`, state, approvals | DOCUMENT, LINEAGE, `bizcity_document_workflow@1` | đã có ở `0001` lõi |
| E-5 | **Danh sách · lọc · nhóm · xuất · nhập** | WP `WP_List_Table`; Odoo search view + favorites + **base_import** | `bizcity_list@1` | **nhập chung** đối xứng xuất (§2.2); "nhóm theo" ở 0.3 |
| E-6 | **Hoạt động (chatter)** | Odoo `mail.thread` / `mail.activity` | (mới — §2.1) | một khung cho mọi chứng từ ở mọi app |
| E-7 | Tệp | WP media; Odoo `ir.attachment` | `bizcity_storage@1` | đường dẫn ký, R2 / đĩa |
| E-8 | **Việc nền + định kỳ** | WP-cron; Odoo `ir.cron` + queue | (mới — §2.3) | xuất / nhập lớn, gửi lại chứng từ, changefeed cần |
| E-9 | Đệm | WP object cache / transients | CACHE | chạy khi vắng Redis |
| E-10 | Bí mật | — | SECRETS | đã có (0.3.1) |
| E-11 | Sự kiện / outbox / changefeed / bằng chứng / trace | WP hooks (phần "sau khi…"); Odoo bus | EVENT, EVIDENCE, OBSERVABILITY | hook **đóng** (lõi hỏi), "sau khi…" = sự kiện |
| E-12 | Menu · màn · khung app (web-shell) · bốn bước | WP `add_menu_page`; Odoo menus + actions + views | WEB, **`bizcity_ux@1`**, HUB-SETUP | một khung, một bộ màn mẫu cho mọi app |

## 2. Ba thứ còn thiếu (thêm vào open-core PHASE-003)

### 2.1 Hoạt động (chatter) — S003-9
- Bảng lõi `activities(tenant_id, doc_ref, kind, body, author, due_at, done_at, attachments[], created_at)` — `kind` ∈ `note · message · task · change · system`; **chỉ thêm** (sửa = dòng mới, lịch sử còn).
- "Thay đổi" sinh tự động từ `audit_logs` của action ghi (trường đổi, trước / sau — che trường bí mật); không app nào tự ghi lịch sử.
- Việc cần làm (task) có hạn + người nhận ⇒ thông báo (`notifications` đã có) + danh sách "Việc của tôi" theo `bizcity_list@1`.
- Người theo dõi (`followers`) để sau (0.2) — tránh phình.
- Giao diện: khối `<Activity docRef>` ở `DetailScreen` (bizcity_ux@1).

### 2.2 Nhập chung — S003-10
- Đối xứng xuất: `POST …/import` cùng cột của `ListDef` (+ cột khoá để khớp bản ghi có sẵn), tệp CSV / XLSX qua Storage.
- **Chạy thử bắt buộc** (`dryRun: true` ⇒ báo từng dòng: tạo / sửa / bỏ / lỗi + `field`), rồi mới chạy thật bằng cùng `Idempotency-Key` ⇒ chạy lại không nhân đôi.
- Mỗi dòng đi qua **action ghi** của module (quyền, kiểm, bằng chứng như nhập tay) — không ghi thẳng bảng.
- Lớn ⇒ việc nền (E-8); kết quả tải về theo `bizcity_list_export@1` có cột `ket_qua`.

### 2.3 Việc nền + định kỳ — S003-11
- Bảng lõi `jobs(tenant_id, kind, payload, state, attempts, run_at, locked_by, result, error)` — lấy việc bằng `FOR UPDATE SKIP LOCKED` (không cần Redis / hàng đợi ngoài), thử lại giãn dần, quá số lần ⇒ `failed` hiện ở bàn điều tra.
- `registerJob(kind, handler)` + `registerSchedule(kind, cron)`; chạy trong ngữ cảnh tenant (RLS), có `traceparent`.
- Dùng cho: xuất / nhập lớn (R-STD-LIST-8), gửi lại chứng từ xuyên app (PHASE-002), đối chiếu changefeed, nhắc việc.

## 3. Không lấy (để lean)

| Của Odoo / WP | Vì sao không |
|---|---|
| Kế thừa ORM chéo module (`_inherit`) | chuỗi kế thừa dài, nâng cấp gãy — ta mở rộng bằng meta, cổng `register*`, sự kiện |
| View XML, Studio sửa giao diện trên màn | khai bằng TypeScript + zod; màn sửa qua mockup duyệt (R-STD-WEB-2) |
| Một CSDL chung mọi app | mỗi app một CSDL, nối bằng hợp đồng (R-CANON-13) |
| `apply_filters` mở cho mọi thứ | khó truy lỗi — hook danh sách đóng |
| Báo cáo QWeb | in theo hồ sơ in của DOCUMENT; báo cáo phân tích là module |

## 4. UI / UX thống nhất

Hôm nay **có luật màn** (WEB: view / model, URL là nguồn vị trí, bốn trạng thái, sheet, token, ≥ 15 px, bàn phím, mockup trước) nhưng **chưa có hệ thiết kế chung**: open-cake `tokens.css` (179 biến), open-ketoan style riêng, bizcity-twin-ai PHP riêng, open-hub brandbook (đỏ `#d0021b`); khung app mỗi app tự dựng. ⇒ chuẩn **[`bizcity_ux@1`](../standard/BIZCITY-UX-v1.md)**: một bộ token từ brandbook, một khung app, bảy màn mẫu, mẫu tương tác chung, mockup duyệt + chụp so khung.

## 5. Theo dõi

Scoreboard ERP-12 × repo (mức 0–4, có bằng chứng) ở open-core `docs/scoreboard/` (máy đọc `scoreboard.json`, bản người đọc `SCOREBOARD.md`), hiện trong app ở **Cài đặt hệ thống › Tình trạng nền tảng** (mockup của `bizcity_ux@1`).

## 6. Quyết định

| Mã | Câu hỏi | Chốt / đề xuất |
|---|---|---|
| Q-ERP-1 | Đa tiền tệ (ngoại tệ, tỷ giá) ở lõi? | **chờ chủ** — đề xuất: lõi giữ kiểu `Money { amount, currency = 'VND' }` + bảng tỷ giá trong module kế toán; app khác chỉ VND tới khi có nhu cầu |
| Q-ERP-2 | Chatter có "người theo dõi" ngay? | đề xuất: để 0.2 |
| Q-ERP-3 | Việc nền dùng Postgres (`SKIP LOCKED`) thay hàng đợi ngoài? | **đồng ý (chủ, theo đề xuất)** — đủ cho quy mô hiện tại; NATS chỉ sau outbox (NC-002 Q-OC-3) |

## Nhật ký

- 2026-11-28: mở NC-005; chủ đồng ý đề xuất (ERP-12, chatter, nhập chung, việc nền, `bizcity_ux@1`, scoreboard).
