# `bizcity_feedback_loop@1` — Vòng phản hồi lỗi: dev và người dùng thấy nguyên nhân, biết hướng xử lý

<!-- [2026-11-25 06:12 PM Johnny Chu - Chu Hoàng Anh] STD-11 — chuẩn mới thuộc trụ cột T5 (quan sát, truy lỗi), nối FAILURE-MAP (T2) và DELIVERY (T13). Chủ duyệt 2026-11-25 ("đồng ý"). Khảo sát của chủ: 100% dev không thấy log, lần ghi bị từ chối, bộ kiểm đầu vào, công cụ truy vết. Việc của nhóm Lõi là dựng môi trường; contributors code từng màn. -->

> **Phiên bản:** 0.1.0-draft · 2026-11-25 · **Trạng thái:** Nháp — chủ duyệt hướng 2026-11-25
> **Máy đọc:** ngân hàng câu hỏi [`cau-hoi-nguoc.json`](cau-hoi-nguoc.json) ([schema](../../schema/feedback/reverse-questions.schema.json))
> **Công cụ:** `tools/loi.mjs` (lỗi thật ở máy dev, gói chỉ mã, SC-LOOP-1) · `tools/failure-check.mjs --questions` · skill [`skills/tu-duy-nguoc`](../../skills/tu-duy-nguoc/SKILL.md)
> **Liên quan:** [FAILURE-MAP](BIZCITY-FAILURE-MAP-v1.md) · [OBSERVABILITY](BIZCITY-OBSERVABILITY-v1.md) · [DELIVERY](BIZCITY-DELIVERY-v1.md)

## 0. Một câu

**Tín hiệu lỗi phải tự đi tới chỗ dev đang làm (khung chat với AI, terminal, PR) và chỗ người dùng đang nhập. Lỗi người dùng gặp thật phải quay về thành tình huống, lời nhắc, test mới, không cần ai đi tìm.**

## 1. Vì sao cần

Open-ketoan đã có gần đủ tín hiệu:
- mã lỗi, mã phát hiện, lời giải thích (`explain`);
- nhật ký mọi lần ghi bị từ chối (HT19);
- màn Tra mã, Lỗi theo module (DEV02 / DEV04);
- Tempo / Loki / Grafana;
- gói log (`lay-log.sh`).

Nhưng tất cả đều là **"phải tự đi tìm"**: mở màn có quyền, bật bộ giám sát, biết sẵn mã để tra. Còn vòng làm việc của dev khi vibe chỉ có ba chỗ: **khung chat với AI, terminal, localhost**. Không tín hiệu nào được đẩy tới ba chỗ đó, và AI không được dặn chạy gì. Kết quả là dev không thấy, AI không hỏi, người dùng không biết sửa ở đâu.

## 2. Bốn vòng

| Vòng | Lúc nào | Ai thấy | Thấy ở đâu | Công cụ |
|---|---|---|---|---|
| **A. Hỏi ngược** | trước khi viết mã lưu | dev + AI + người yêu cầu | khung chat | `failure-check --questions <luồng>`, `--scaffold --flow`, skill `tu-duy-nguoc` |
| **B. Thấy lỗi thật khi đang làm** | sau mỗi lần thử | dev + AI | terminal | `loi.mjs --repo . --since 2h`, `failure-check --report` |
| **C. Rà ở PR** | mở PR | người duyệt + AI | khối bằng chứng PR | độ phủ bản đồ trước / sau trong khối bằng chứng (repo: open-ketoan `cham-pr.mjs`) |
| **D. Người dùng phản hồi** | sau khi dùng | người dùng → dev | lời nhắc trên màn → gói chỉ mã → bảng việc | nút "Không hiểu / không sửa được", `loi.mjs --export`, `failure-check --observed` |

Vòng D khép lại vòng A: mã lỗi gặp thật mà chưa có trong bản đồ trở thành dòng mới, câu hỏi ngược mới và test mới. Nhờ vậy thư viện mã, lời nhắc và playbook lớn lên theo lỗi thật.

### 2.1 Ngân hàng câu hỏi ngược

`cau-hoi-nguoc.json` gồm 41 câu cho 10 luồng: chung, danh mục, mua, bán, kho, tiền, công nợ, thuế, cuối kỳ, gửi giữa app. Mỗi câu có:
- loại đích (cùng năm loại của FAILURE-MAP);
- câu hỏi;
- lý do kế toán cần;
- mã hay gặp.

Câu hỏi **không** chứa số tài khoản hay thuế suất cụ thể; chỉ trỏ tới chỗ phải tra. Câu trả lời ghi vào `questions[]` của bản đồ lỗi.

## 3. Nhật ký lần ghi bị từ chối (khuôn tối thiểu)

Mỗi app có ghi dữ liệu ghi **một dòng JSONL cho mỗi lần ghi bị từ chối**:

```json
{ "at": "2026-11-25T08:00:00Z", "data": {
  "entity": "mua-hang/phieu-mua", "screen": "MH05", "ok": false,
  "failed": [{ "code": "IN-ITEM-009", "level": "block", "field": "lines.0.itemId" }],
  "requestId": "req-…", "status": 422 } }
```

- Vị trí: `<DATA_DIR>/nhat-ky/kiem-khai-bao/<đơn vị>/<yyyy-mm>.jsonl`. Đây là khuôn của open-ketoan, chạy từ 11/2026 (`packages/platform/src/core/nhat-ky-kiem.ts`).
- App khác ghi cùng khuôn để `loi.mjs` đọc được.
- Lỗi kỹ thuật (mức error trở lên) đọc từ `<LOG_DIR>/<dịch vụ>/<YYYY-MM-DD>.log` (khuôn OBSERVABILITY).

## 4. Luật

| Mã | Luật | Kiểm |
|---|---|---|
| **R-STD-LOOP-1** | **Đẩy, không kéo.** Dev phải thấy lỗi thật của màn mình **ngay trong terminal, bằng một lệnh**, không cần mở màn quản trị, xin quyền hay bật Grafana. Bộ giám sát vẫn là công cụ sâu hơn, không phải cửa vào | `loi.mjs` |
| **R-STD-LOOP-2** | **Hỏi ngược trước khi viết mã lưu.** Dev / AI trả lời câu hỏi ngược của luồng; chưa rõ thì **hỏi người yêu cầu, không đoán**. Câu có ý nghĩa kế toán do kế toán trưởng trả lời. Câu trả lời ghi vào bản đồ lỗi | SC-FAIL-2 (câu chưa trả lời) |
| **R-STD-LOOP-3** | **Chỉ mã.** Nhật ký và gói xuất cho dev chỉ mang: màn, đối tượng API, mã, ô, mã tra cứu, số lần. **Không** khoá bản ghi trong gói xuất, không tên người, không câu lỗi gốc, không số tiền, không mã số thuế (R-SEC-10 của open-ketoan) | `loi.mjs --self-test` |
| **R-STD-LOOP-4** | **Người dùng nói lại được.** Cạnh lời nhắc có nút "Không hiểu / không sửa được". Bấm thì ghi một dòng nhật ký (cùng khuôn §3, `failed[].code` = mã đang nhắc, thêm `feedback: "khong-hieu"`) và hiện mã tra cứu để chép | review |
| **R-STD-LOOP-5** | **Gom định kỳ.** Mỗi ngày (hoặc mỗi tuần với bản cài nhỏ), gom nhật ký thành gói chỉ mã rồi so với bản đồ. Ra ba danh sách: lỗi thật chưa có trong bản đồ · lời nhắc bị bấm "không hiểu" nhiều · màn có tỉ lệ bị chặn cao. Câu hỏi ngược mới thì thêm vào ngân hàng | `loi.mjs --export`, `failure-check --observed` |
| **R-STD-LOOP-6** | **Tới tay dev.** Ba danh sách trên thành mục trong bảng việc / nợ của repo. Không để nằm trên màn quản trị chờ ai đó mở | review |
| **R-STD-LOOP-7** | **PR nói độ phủ.** Khối bằng chứng của PR chạm màn có ghi dữ liệu có: độ phủ bản đồ trước / sau, dòng chặn chưa có test, mã mới chưa có trong danh mục | review; công cụ PR của repo |
| **R-STD-LOOP-8** | **Agent được dặn.** Hướng dẫn agent của repo (AGENTS.md / CLAUDE.md / copilot-instructions) nói ba lệnh: `failure-check --questions` trước khi viết mã lưu, `loi.mjs` và `failure-check --report` sau khi thử. Repo cài skill `tu-duy-nguoc` | SC-LOOP-1 |
| **R-STD-LOOP-9** | **Môi trường dev một lệnh, agent tự dựng.** Repo có một lệnh kiểm + tự sửa môi trường dev: phiên bản runtime, cài gói, build gói dùng chung, lấy `../bizcity-platform`, tệp env cục bộ có bí mật ngẫu nhiên, CSDL test, bật hook. Lệnh này **không tạo lại** container / CSDL đã có, không ghi đè env, không xoá gì. Agent chạy lệnh ở đầu mỗi phiên (AGENTS.md; Claude Code: hook SessionStart). Hook `pre-push` chạy bộ kiểm của repo và **chỉ chặn phát hiện mới so với nhánh chính**, đỏ có sẵn không chặn. Mẫu: open-ketoan `scripts/moi-truong-dev.mjs` (#662) <!-- [2026-11-25 08:41 PM Johnny Chu - Chu Hoàng Anh] STD-12 --> | review; SC-LOOP-1 |

## 5. Dev vibe cùng AI sẽ thấy gì

**Trước khi code:** AI in câu hỏi ngược của luồng và hỏi lại dev những câu chưa rõ. Sau đó dựng bảng tình huống: thao tác · tình huống · chỉ vào đâu · bắt ở tầng nào · mã · lời nhắc.

**Sau khi thử** (`loi.mjs`, đầu ra thật trên bộ mẫu):

```text
Lỗi ở repo — 7 ngày qua: 5 lần ghi bị từ chối, 1 lỗi kỹ thuật

MH05  Phiếu mua hàng (mẫu)
  ✗ IN-ITEM-009            ×2   lines.*.itemId         có trong bản đồ · có test · màn báo trước
  ✗ DB_REFERENCE_MISSING   ×1   lines.*.warehouseCode  KHÔNG có trong bản đồ → thêm dòng, lời nhắc, test (R-STD-FAIL-7)
Lỗi kỹ thuật (log mức error)
  ! INTERNAL_ERROR         /api/v1/mua-hang/phieu-mua reqId=req-9 traceId=abc123 → logs/api/2026-11-25.log:2
Bản đồ MH05: 5/5 tình huống đủ mã + test · báo trước 5/5
```

## 6. Người dùng phản hồi thế nào

```text
người dùng bấm Lưu → bị chặn → lời nhắc đúng ô + mã tra cứu (+ nút "Không hiểu")
   → nhật ký §3 (chỉ mã)
   → gom ngày: loi.mjs --export → gói { screen, code, n }
   → failure-check --observed: mã chưa có trong bản đồ → mục nợ / bảng việc của repo
   → contributor thêm dòng + lời nhắc + test → bản sau: màn báo trước
```

## 7. Kiểm

| Mã | Kiểm | Mức |
|---|---|---|
| SC-LOOP-1 | Hướng dẫn agent của repo nói `failure-check` và `loi.mjs` (`loi.mjs --repo . --check`) | cảnh báo |
| SC-LOOP-2 | Ngân hàng câu hỏi đúng khuôn, mã câu không trùng, luồng có thật (`failure-check --self-test`) | chặn (bizcity-platform) |
| SC-LOOP-3 | Gói xuất chỉ có `screen`, `code`, `n`; không lộ khoá bản ghi, người dùng, câu lỗi, mã tra cứu (`loi.mjs --self-test`) | chặn (bizcity-platform) |

## 8. Chưa làm (lộ trình)

- **open-ketoan:**
  - lệnh `npx bizcity loi` gọi `loi.mjs`;
  - phần bản đồ lỗi trong khối bằng chứng PR (`scripts/cham-pr.mjs`, đang thuộc dòng S040-30);
  - nút "Không hiểu" ở ui-kit;
  - job gom hằng ngày.

  Ghi ở sổ nợ, làm theo nếp giữ chỗ của repo.
- **App khác** (open-pos, open-cake…): ghi nhật ký từ chối theo khuôn §3. Ghi ở sổ nợ.
- **Bản cài chạy docker:** `loi.mjs` đọc qua thư mục gắn ra ngoài (`--data`, `--logs`). Lệnh đọc thẳng từ container để sau.
- **Bản tóm tắt định kỳ** gửi qua kênh của nhóm (Zalo Hub). Để sau.
