# `bizcity_document_workflow@1` — Máy trạng thái chứng từ khai bằng YAML (hồ sơ của bizcity_document@1 §5)

<!-- [2026-11-28 02:55 PM Johnny Chu - Chu Hoàng Anh] D1 — chuẩn mới (NC-004 P-6, §10): viết ra từ mã đang chạy `@bizcity/platform/core/workflow.ts` (open-core 0.3.1, gốc open-ketoan PHASE-012 / PHASE-014) và hai tệp mẫu của open-ketoan; luật R-WF-* giữ mã gốc của bizcity_document@1 §5. -->

> **Phiên bản:** 0.1.0-draft · 2026-11-28 · **Trạng thái:** Đề xuất · **Thuộc:** trụ chứng từ ([DOCUMENT](BIZCITY-DOCUMENT-v1.md) §5) · **Hiện thực:** open-core `@bizcity/platform/core/workflow.ts`
> **Bản mẫu:** open-ketoan `apps/api/src/phan-he/mua-hang/purchase-document.workflow.yaml`, `apps/api/src/phan-he/quy/payment-requests/payment-request.workflow.yaml`

<!-- [2026-11-28 03:38 PM Johnny Chu - Chu Hoàng Anh] D1 — đổi mã: `bizcity_workflow@1` đã bị bỏ ở open-ketoan (gộp vào bizcity_document@1 §5, 00-CANON dòng 345) ⇒ không đặt lại; dùng `bizcity_document_workflow@1` = hồ sơ máy đọc của DOCUMENT §5 -->
> **Mã:** `bizcity_document_workflow@1` là **hồ sơ máy đọc của [`bizcity_document@1`](BIZCITY-DOCUMENT-v1.md) §5** (năng lực `documents.workflow`), không phải hợp đồng riêng. Mã cũ `bizcity_workflow@1` đã gộp vào DOCUMENT và **không dùng lại** (R-PLAT-7).

## 0. Một câu

**Mỗi loại chứng từ một tệp `<module>.<loại>.workflow.yaml`:** trạng thái thuộc nhóm chuẩn, chuyển trạng thái có quyền, duyệt nhiều cấp, tách nhiệm. Lõi chỉ **quyết định** (`plan`): được chuyển không, ai được, sang đâu; ghi trạng thái, cột riêng và nộp sổ là việc của action module; bằng chứng do action runtime ghi. App nào trên open-core (mua, kho, POS, HRM, MRP…) cũng khai cùng một khuôn — không tự viết máy trạng thái.

## 1. Khuôn tệp

```yaml
type: purchase.order            # <module>.<loại> — trùng phần trước dấu ":" của doc_ref
label: Đơn mua hàng
states:
  draft:     { group: draft,    label: Nháp }
  submitted: { group: pending,  label: Chờ duyệt }
  approved:  { group: approved, label: Đã duyệt }
  cancelled: { group: cancelled, label: Đã huỷ }
transitions:
  submit:  { title: Trình duyệt, from: [draft], to: submitted, permission: mua-hang:don-lap, owner: mua-hang:don-sua-moi }
  approve:
    title: Duyệt
    levels:                       # duyệt nhiều cấp — số cấp cần do module tính từ ngưỡng cấu hình (R-WF-6)
      - { from: submitted, to: submitted, permission: mua-hang:don-duyet-c1 }
      - { from: submitted, to: approved,  permission: mua-hang:don-duyet-c2 }
    sod: true                     # người duyệt khác người lập; "warn" = ghi dấu, không chặn
  cancel:  { from: [draft, submitted], to: cancelled, permission: mua-hang:don-huy, requires: [reason], blocked: { approved: "Đơn đã duyệt — lập phiếu điều chỉnh" } }
```

| Khoá | Luật |
|---|---|
| `type` | `^[a-z0-9-]+\.[a-z0-9-]+$` (mã hiện tại). **Lệch:** `doc_ref` spine 1.2 cho phép `_` ở phần loại — đề xuất 0.2 nhận `_` cho khớp (Q-WF-1) |
| `states.<tên>` | `^[a-z][a-z0-9_]*$`; `group` ∈ `draft · pending · approved · in_progress · done · cancelled` (sáu nhóm, `STATUS_GROUPS`); `done` **không** có nghĩa đã ghi sổ |
| `transitions.<động-từ>` | `^[a-z][a-z0-9-]*$`; `from[]`, `to`, `permission` (một quyền, hoặc theo trạng thái nguồn `{state: perm}`), hoặc `levels[]` (≥ 2 cấp) |
| `permission` | quyền lõi có thật, hoặc quyền module `<module>:<việc>` đã khai trong manifest; tiền tố trùng nhóm quyền lõi mà không có thật ⇒ lỗi lúc nạp |
| `sod` | `false` (mặc định) · `true` chặn người lập tự duyệt · `warn` ghi dấu |
| `owner` | chỉ người lập được chuyển, trừ khi có quyền này |
| `requires` | `[reason]` — bắt buộc lý do |
| `ledger` | chuyển này nộp / huỷ sự việc kế toán (R-WF-3) |
| `blocked` / `denied` | thông báo riêng khi trạng thái không cho chuyển / khi thiếu quyền (theo R-ERROR-UX: nói cách sửa) |

## 2. Luật

| Mã | Luật |
|---|---|
| R-WF-1…7, R-WF-17 | giữ nguyên ở [DOCUMENT](BIZCITY-DOCUMENT-v1.md) §5 (mã gốc, không đặt lại) |
| R-STD-WF-1 | Tệp nằm cạnh mã module, được **nạp và kiểm bằng zod chặt** lúc khởi động; khoá lạ ⇒ không chạy (không âm thầm bỏ qua) |
| R-STD-WF-2 | Sửa trước khi ghi sổ = **phiên bản mới** của chứng từ (`version + 1`); sau khi ghi sổ = chứng từ điều chỉnh (`adjusts`) hoặc đảo (`reverses`) — không có chuyển "mở lại" chứng từ đã ghi sổ |
| R-STD-WF-3 | Mỗi lần chuyển ghi một dòng `audit_logs` (người, vai, cấp duyệt, lý do) — do action runtime, không do module tự ghi |
| R-STD-WF-4 | Loại chứng từ có workflow phải đăng ký `registerDocumentType` (đánh số, nhóm trạng thái) cùng `type` |

## 3. Câu hỏi mở

| Mã | Câu hỏi | Đề xuất |
|---|---|---|
| Q-WF-1 | `type` có nhận `_` | có — khớp `doc_ref` spine 1.2 |
| Q-WF-2 | Chuyển theo sự kiện (`by: event, on:` ở DOCUMENT §5) | chưa có trong schema chặt; chốt hoặc bỏ khỏi DOCUMENT ở 0.2 |
| Q-WF-3 | Schema máy đọc (`schema/workflow/workflow.schema.json`) + `cli workflow check` | có, ở 0.2 cùng vector |

## Lịch sử

- **0.1.0-draft (2026-11-28):** bản đầu, viết ra từ mã đang chạy.
