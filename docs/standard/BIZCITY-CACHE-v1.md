# `bizcity_cache@1` — Bộ nhớ đệm, hàng đợi, Redis

<!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — trụ cột T6: luật đệm đã có ở open-ketoan (R-CACHE, R-OUTBOX) + vị trí của Redis theo canon §8. Trung thực về hiện trạng: CHƯA repo nào có Redis hay lớp đệm dùng chung; các chỗ đệm hiện là Map trong tiến trình. -->

> **Phiên bản:** 1.0.0 · 2026-11-25 · **Trạng thái:** **Chấp nhận** — chủ dự án duyệt 2026-11-25 <!-- [2026-11-25 10:30 AM Johnny Chu - Chu Hoàng Anh] STD-4 — chủ duyệt 2026-11-25 --> · **Mức hiện tại:** tài liệu
> **Luật gốc:** open-ketoan `docs/rules/RULE-INFRASTRUCTURE.md` (R-CACHE-1..6, R-OUTBOX-1..7), R-SITE-6; canon §8.

## 0. Một câu

**Đệm chỉ để nhanh hơn, không bao giờ để đúng: tắt đệm hay Redis chết thì hệ chậm đi, không sai đi.**

## 1. Cái gì không bao giờ đệm

| Luật | Nội dung |
|---|---|
| R-CACHE-1 (T0) | **không đệm** số dư, sổ cái, công nợ, tồn kho, báo cáo, trạng thái chứng từ |
| R-CACHE-2 | đọc ngay sau ghi phải thấy bản ghi vừa ghi |
| R-OUTBOX-1 | hàng đợi sự kiện là **outbox trong PostgreSQL** (`FOR UPDATE SKIP LOCKED`), ghi cùng giao dịch với nghiệp vụ; Redis / NATS không thay outbox |
| — | đếm, khoá, chống trùng dựa vào CSDL (`pg_advisory_xact_lock`, ràng buộc duy nhất), không dựa vào đệm |

## 2. Cái gì được đệm và đệm thế nào

| Luật | Nội dung |
|---|---|
| R-CACHE-3 | chỉ danh mục chậm đổi và kết quả tra cứu ngoài (cấu hình, quyền, registry site, tra MST): TTL ≤ 5 phút |
| R-CACHE-4 · R-SITE-6 | khoá đệm có đủ `site + tenant + config_version`; thiếu một phần là lỗi cách ly |
| R-CACHE-5 | xoá đệm **sau commit**, qua sự kiện; không xoá trong giao dịch |
| R-CACHE-6 | mặc định đệm **trong tiến trình**; Redis là adapter tuỳ chọn; CI và test chạy **không** Redis |

## 3. Redis — khi nào và cho việc gì

**Q-CACHE-1 (chủ duyệt 2026-11-25): Redis không vào bản cài mặc định.** Redis chỉ vào khi chạy **≥ 2 bản API** cho cùng site, và chỉ cho ba việc:

| Việc | Khoá | Mất Redis thì |
|---|---|---|
| đệm dùng chung (mục 2) | `bz:<app>:<site>:<tenant>:<miền>:<khoá>:v<config_version>` | đọc thẳng CSDL |
| giới hạn tần suất mềm | `bz:<app>:rl:<hạng>:<chủ thể>` | đếm trong tiến trình |
| phát realtime giữa các bản API (SSE) | kênh `bz:<app>:<site>:stream` | client tự hỏi lại (polling) |

| Luật (mới) | Nội dung |
|---|---|
| R-STD-CACHE-1 | mọi truy cập đệm đi qua **một giao diện** của nền (`cache.get / set / del / wrap`), có hai adapter `memory` và `redis`; mã nghiệp vụ không gọi `new Map()` làm đệm và không import thư viện Redis |
| R-STD-CACHE-2 | Redis không lưu phiên đăng nhập, không lưu bí mật, không là nguồn duy nhất của dữ liệu nào; khởi động được khi Redis vắng |
| R-STD-CACHE-3 | compose khai Redis dưới `profiles: [redis]`, không bật mặc định; cổng chỉ trong mạng nội bộ, có mật khẩu |
| R-STD-CACHE-4 | mỗi chỗ đệm khai: khoá, TTL, sự kiện làm mất hiệu lực, và test "tắt đệm vẫn đúng" |

## 4. Kiểm

| Mã | Lane | Kiểm | Trạng thái |
|---|---|---|---|
| (S039-8) | HOUSE | khoá đệm có site | có ở open-ketoan, còn 2 chỗ thiếu |
| SC-CACHE-P1 | HOUSE | không import thư viện Redis ngoài adapter của nền; không `new Map` gắn nhãn đệm ngoài nền | đề xuất |
| SC-CACHE-P2 | test | bộ test xanh khi `CACHE=off` | đề xuất |

## 5. Khoảng cách hiện tại

| App | Đang |
|---|---|
| open-ketoan | **không có Redis**; đệm là `Map` kèm thời điểm ở nhiều tệp (`module-registry.ts`, `security/role-assignments.ts`, `session-state.ts`, `workflow.ts`, `branch-sites.ts`, `tra-mst.ts`…); chưa có giao diện đệm chung |
| open-cake | Redis mới có trên tài liệu (compose profile `redis`); mã chưa đệm gì ngoài sổ vai của nền |
| nền | chưa có `cache` trong `@bizcity/platform` — việc đầu tiên nếu chuẩn này được duyệt (R-STD-CACHE-1) |
