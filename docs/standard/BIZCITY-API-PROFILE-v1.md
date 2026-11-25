# `bizcity_api_profile@1` — API nội bộ, kiểm đầu vào và đầu ra

<!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — trụ cột T2: phần của bizcity_api@1 / bizcity_errors@1 / bizcity_action@1 (open-ketoan) mà MỌI app phải giống nhau, cộng hai chỗ chưa repo nào có chuẩn (phân trang con trỏ, giới hạn tần suất). -->

> **Phiên bản:** 1.0.0-draft · 2026-11-24 · **Trạng thái:** chờ duyệt (Q-API-1)
> **Luật gốc:** open-ketoan `docs/rules/RULE-API.md` (R-API-1..12), `docs/contracts/BIZCITY-API-v1.md`, `BIZCITY-ERRORS-v1.md` (R-ERR-1..11), `BIZCITY-ACTION-v1.md`; canon §8.
> **Bản mẫu:** `@bizcity/platform` `core/{http,errors,actions}.ts`; open-cake `docs/architecture/70-API-REST.md`.

## 0. Một câu

**Gọi API của app nào cũng nhận cùng một phong bì, cùng bảng mã lỗi, cùng cách chống gửi trùng; không dữ liệu nào vào hay ra mà chưa qua schema.**

## 1. Phong bì và lỗi

```json
{ "ok": true,  "data": { }, "meta": { "requestId": "req-…", "receipt": "…", "page": 1, "pageSize": 50, "total": 120 } }
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "details": { "reason": "CAKE_PHONE_INVALID", "field": "phone", "hint": "…" }, "requestId": "req-…", "traceId": "…" } }
```

| Luật | Nội dung | Kiểm ở bản mẫu |
|---|---|---|
| R-API-1 | mọi câu trả lời là một trong hai hình trên | SC-API-1 |
| R-API-2 · R-ERR-2 | lỗi chỉ ném bằng `Errors.*` / `AppError`; không `reply.status()` viết tay | SC-ERR-1 |
| R-ERR-1 | mã lỗi thuộc **bảng đóng**: `VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, IDEMPOTENCY_CONFLICT, CAPABILITY_MISSING, MODULE_DISABLED, RATE_LIMITED, NOT_READY, GATEWAY_UNAVAILABLE, INTERNAL_ERROR` (+ mã của sổ: `PERIOD_LOCKED, POSTING_FAILED, UNBALANCED_ENTRY`) | SC-ERR-2 |
| R-ERR-6 | lý do cụ thể ở `details.reason`, UPPER_SNAKE, **có tiền tố chủ** (`CAKE_…`, `IN-ITEM-…`); app đăng ký bằng `registerErrorReasons` | SC-CON-5 |
| R-ERR-7 | chỉ thử lại mã được đánh dấu thử lại được, có giãn cách | — |
| R-API-12 | 500 trả `INTERNAL_ERROR`, không lộ nội bộ (stack, SQL, đường dẫn) | test |
| R-OBS-1 | mọi câu trả lời mang `X-Request-Id`; lỗi mang `requestId` (và `traceId` khi có) | [OBSERVABILITY](BIZCITY-OBSERVABILITY-v1.md) §2 |

## 2. Route

| Luật | Nội dung |
|---|---|
| R-API-6 | route nào cũng khai `requirePermission(…)` hoặc `config.public` (SC-API-3) |
| R-API-7 | `/api/v1` ổn định; phá tương thích ⇒ `/api/v2` chạy song song |
| R-API-8 | bề mặt công khai cho bên ngoài là **danh sách đóng** trong hợp đồng của app; phần còn lại là nội bộ, đổi không báo |
| STD-ACT-1 | route ghi sinh từ `defineAction`; việc không phải CRUD dùng `POST /:id/<động-từ>`; sửa một phần dùng `PATCH` |
| R-STD-API-2 (mới) | route nội bộ giữa các app chỉ đi ba đường: REST có hợp đồng `bizcity_<tên>@N`, webhook outbox ký HMAC, MCP (canon R-CANON-4). Không đọc CSDL chéo |
| — | tài liệu OpenAPI sinh từ zod, phục vụ ở `/api/docs` |

## 3. Kiểm đầu vào

| Luật | Nội dung | Nguồn |
|---|---|---|
| R-API-3 | zod ở cửa mọi route; schema dùng chung nằm trong `packages/contracts`; route nội bộ dùng `.strict()` | R-SEC-4 |
| R-STD-API-3 (mới) | **không bao giờ** nhận `tenantId`, `siteId`, `actor` từ thân yêu cầu; lấy từ phiên / khoá | open-cake 70-API-REST |
| R-STD-API-4 (mới) | trần kích thước thân: 1 MB mặc định, 256 KB cho cửa nạp từ kênh; tệp tải lên kiểm kiểu thật | open-cake, R-SEC-4 |
| R-API-5 | tham số boolean trên query đi qua `queryBool` | open-ketoan |
| R-REV-13 | tra cứu trả tiền / số lượng **không trả mặc định** khi không tìm thấy; thiếu ⇒ lỗi | open-ketoan RULE-REVIEW |
| R-INTAKE-* | dữ liệu ngoài vào sổ qua các lớp L1 hình → L2 số học → L3 danh mục → L4 nghiệp vụ → L5 định khoản thử; phát hiện mang mã `IN-*` mức block / warn; đầu vào bị từ chối **giữ lại** ở hộp chờ, bản gốc bất biến | open-ketoan `RULE-INTAKE.md` |

## 4. Kiểm đầu ra

| Luật | Nội dung |
|---|---|
| STD-ACT-3 | đầu ra action cũng là zod; kiểm đầu ra **bật trong test** |
| R-STD-API-5 (mới) | adapter giả lập (mock) của giao diện kiểm cả đầu vào lẫn đầu ra bằng **cùng schema** với máy chủ, để màn dựng trước không lệch API thật (open-cake `packages/action-client`) |
| R-SEC-10 | đầu ra, log, bằng chứng không mang PII thô / bí mật; định danh nhạy cảm lưu `sha256:` |

## 5. Chống gửi trùng

| Luật | Nội dung |
|---|---|
| R-API-9 · STD-ACT-4 | lệnh ghi từ ngoài mang `Idempotency-Key` (8–128 ký tự); lưu `(tenant, action, key)` + băm thân trong 7 ngày; cùng khoá cùng thân ⇒ phát lại (`meta.replayed`); khác thân ⇒ 409 `IDEMPOTENCY_CONFLICT` |
| — | cửa nạp chứng từ dùng `docKey` + `version` thay cho khoá: cùng phiên bản ⇒ không đổi; cũ hơn ⇒ 409; mới hơn ⇒ đảo và ghi lại |
| R-SPINE-7 | sự kiện mang `Idempotency-Key = <doc_ref>@<version>`; bên nhận idempotent theo `(consumer, event_id)` |

## 6. Phân trang

| Kiểu | Hình | Trạng thái |
|---|---|---|
| Trang | `?page=&pageSize=` (trần 200) → `meta {page, pageSize, total}` | R-API-10, đang chạy |
| Con trỏ | `?cursor=&limit=` → `meta {nextCursor}`; con trỏ = base64url(`<thời điểm ISO>\|<id>`), ổn định khi có bản ghi mới, hàng đã xoá vẫn hiện trong luồng đồng bộ | **đề xuất Q-API-1**; `bizcity_sync@1` đã dùng dạng thô `<ISO>\|<id>` |
| Lô | tối đa 200 mục một lần gửi | R-API-11 |

## 7. Giới hạn tần suất (chỗ trống)

Hiện chỉ có giới hạn ở đăng nhập, SSO (30 lần sai / 15 phút / IP) và vài route lẻ. **Đề xuất R-STD-API-6:** ba hạng mặc định khai ở một chỗ — công khai (theo IP), có phiên (theo người dùng), khoá máy (theo khoá) — trả `RATE_LIMITED` kèm `Retry-After`; đếm trong tiến trình, chuyển sang Redis khi chạy ≥ 2 bản API ([CACHE](BIZCITY-CACHE-v1.md) §3).

## 8. Kiểm

| Mã | Lane | Kiểm | Có ở |
|---|---|---|---|
| SC-API-1/2/3, SC-ERR-1/2, SC-CON-6, SC-DOC-5 | HOUSE | phong bì, mã lỗi, khai quyền, route trong tài liệu có trong mã | open-ketoan selfcheck |
| SC-SPINE-4, 5 | CONTRACT | hộp đen: phong bì, lỗi chuẩn, changefeed | `tools/spine-contract.mjs` |
| SC-API-P1 | CONTRACT | gửi lại cùng `Idempotency-Key` ⇒ phát lại; khác thân ⇒ 409 | đề xuất (cần `--allow-write`, chỉ trên bản thử) |
| SC-API-P2 | CONTRACT | thân có `tenantId` lạ không đổi được đơn vị của phiên | đề xuất |

## 9. Khoảng cách hiện tại

| App | Thiếu |
|---|---|
| open-cake | SC-CAKE-API-1..4 mới có trên giấy; con trỏ, SSE, swagger, bộ header (`X-Bizcity-Standard`, `Deprecation`) chưa có trong mã |
| open-ketoan | con trỏ mỗi nơi một kiểu (sync, connections, provisioning); chưa có giới hạn tần suất chung |
| plugin WordPress | route `bizcity-*/v1` cũ không theo phong bì; hợp đồng mới phải theo (canon §6) |
