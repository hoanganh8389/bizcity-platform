# `bizcity_failure_map@1` — Bản đồ lỗi theo màn

<!-- [2026-11-25 05:18 PM Johnny Chu - Chu Hoàng Anh] STD-10 — chuẩn mới thuộc trụ cột T2 (kiểm đầu vào / đầu ra), nối T5 (truy lỗi), T9 (giao diện), T13 (nghiệm thu). Chủ duyệt hướng 2026-11-25 ("đồng ý"): phần mềm phải vừa chặn đúng vừa chỉ đúng chỗ — mỗi màn liệt kê trước mọi lý do thêm / sửa / xoá / lưu / ghi sổ / duyệt không thành, chỉ đúng ô, đúng danh sách chọn (thêm / sửa tại chỗ), đúng nguồn gốc dữ liệu, đúng bước của luồng kho; có công cụ tự chạy ở máy dev cho biết đã đủ chưa. -->

> **Phiên bản:** 0.1.0-draft · 2026-11-25 · **Trạng thái:** Nháp — chủ duyệt hướng 2026-11-25; chốt 1.0.0 sau màn thử ở open-ketoan (phiếu mua hàng)
> **Bản mẫu:** open-ketoan — mã lỗi `bizcity_errors@1` (`packages/contracts/src/errors.ts`), thư viện phát hiện `bizcity_findings@1` (Gate A / B / L, mã `IN-*`), phương án khắc phục `bizcity_remedy@1`, `error.fields`, nhật ký từ chối HT19, danh mục 93 tình huống lỗi ở tầng sổ (PHASE-022).
> **Máy đọc:** [`failure-map.schema.json`](../../packages/contracts/schema/failure-map/failure-map.schema.json) · **Kiểm:** `node tools/failure-check.mjs --repo <thư mục>` (SC-FAIL-1..7) · độ phủ: `--report` · dựng khung: `--scaffold`.

## 0. Một câu

**Mỗi màn có ghi dữ liệu mang theo một bản đồ: thao tác nào có thể không thành, vì sao, chỉ vào đâu, bắt ở tầng nào, người dùng được nhắc gì, test nào khoá — và một lệnh cho biết bản đồ đã đủ chưa.**

## 1. Vì sao cần

Phần mềm kế toán phải **chặn đúng**: sổ cân, kỳ khoá, mặt hàng nháp, kho sai chi nhánh… Nhưng chặn mà không chỉ chỗ thì người dùng bế tắc. Họ phải gọi dev, dev lại đi tra Tempo / Loki. Mã lỗi và lời giải thích ở máy chủ là cần nhưng chưa đủ. Bốn chỗ hở thường gặp:

| Dev thiếu | Hậu quả | Chuẩn này trả lời bằng |
|---|---|---|
| Không liệt kê trước tình huống làm thao tác không thành (thường do viết theo lời nhắc AI, chỉ nghĩ đường lưu thành công) | Lỗi lộ ra lần đầu khi người dùng bấm Ghi sổ | Bản đồ lỗi; công cụ **dựng khung máy móc** từ form (§5.1) để không bỏ sót |
| Màn không báo trước tình huống không ghi được | Người dùng nhập xong mới biết, không biết sửa ở đâu | Đích chỉ chỗ (§2.2) + luật **bắt sớm** (R-STD-FAIL-1) |
| Không có bảng lỗi để bổ sung dần | Lỗi cũ lặp lại; tooltip, playbook không lớn lên | Bản đồ là bảng sống; lỗi gặp thật chưa có ⇒ nợ (R-STD-FAIL-7) |
| Không có công cụ tự chạy ở máy dev | Không trả lời được "đủ chưa, đạt chưa" | `failure-check` (§5) nối vào nghiệm thu T13 |

## 2. Bản đồ lỗi (`*.failure-map.json`)

Đặt **cạnh tệp màn**: `PhieuMuaForm.tsx` → `PhieuMuaForm.failure-map.json`. Một màn một bản đồ. Khuôn máy đọc ở schema; ví dụ một dòng:

```json
{ "id": "MH05-02", "action": "ghi-so", "code": "IN-ITEM-009", "level": "block",
  "when": "Dòng hàng chọn mặt hàng còn nháp",
  "target": { "kind": "selector", "path": "lines.*.itemId", "catalog": "item",
              "allow": "active", "inlineFix": "core.item.update" },
  "catchAt": ["ui", "intake"],
  "hint": "Mặt hàng còn nháp — bấm để hoàn thiện đơn vị tính, nhóm hạch toán",
  "test": "apps/api/test/phieu-mua.failure.test.ts#IN-ITEM-009",
  "approvedBy": "ke-toan-truong" }
```

### 2.1 Thao tác (từ khoá đóng)

`them` · `sua` · `xoa` · `luu-nhap` · `ghi-so` · `duyet` · `bo-duyet` · `huy` · `nhap-file` · `gui` (gửi sang app khác). Thao tác riêng của repo: `x-<tên>`.

### 2.2 Năm loại đích — màn phải làm được gì

| `target.kind` | Chỉ vào | Màn phải | Trường bắt buộc |
|---|---|---|---|
| `field` | ô nhập sai / thiếu | tô đỏ, cuộn tới ô, tooltip nói sai gì và sửa thế nào | `path` |
| `selector` | danh sách chọn thiếu / giá trị không còn hợp lệ (nháp, ngừng dùng, khác chi nhánh) | chỉ vào danh sách, nói vì sao không nhận, **thêm / sửa ngay tại chỗ** qua action của chủ danh mục | `path`, `catalog` (+ `allow`, `inlineFix`) |
| `origin` | dữ liệu gốc / giới hạn: hợp đồng mua, phân tích mua, tồn min / max, hạn mức công nợ, ngân sách | nói số lấy từ đâu, mở được chỗ đó | `source` (+ `path`) |
| `flow` | luồng kho / nghiệp vụ không logic: kho không thuộc chi nhánh, xuất quá tồn, xuất trước nhập, chuyển kho thiếu phiếu nhận | nói thiếu / sai bước nào | `step` |
| `state` | trạng thái: không đủ quyền, kỳ khoá, đã ghi sổ, người khác vừa sửa | nói ai mở / làm gì tiếp | — |

`path` là toạ độ **trong chứng từ** (`docDate`, `lines.*.itemId`), cùng toạ độ với `error.fields` / `details.findings[].field` mà API trả. Nhờ vậy màn tô đúng ô từ chính phản hồi lỗi.

### 2.3 Bắt ở tầng nào (`catchAt`)

`ui` (trước khi bấm) · `module` · `intake` (cửa nạp, bể chờ) · `kernel` · `db` (trigger) · `ngoai` (app nhận ở đầu kia). Một lỗi có thể bắt ở nhiều tầng. Tầng sau **vẫn chặn**: giao diện báo sớm không thay luật của Kernel.

## 3. Luật

| Mã | Luật | Kiểm |
|---|---|---|
| **R-STD-FAIL-1** | **Bắt sớm.** Lỗi chặn có đích `field` / `selector` / `origin` mà màn biết trước được thì màn phải báo **trước khi bấm**. Người dùng không được biết lỗi lần đầu ở bước ghi sổ. Tầng sau vẫn chặn như cũ | SC-FAIL-6 |
| **R-STD-FAIL-2** | **Mã có trong danh mục.** Mỗi dòng dùng mã đã có trong danh mục mã của repo (open-ketoan: `ERROR_CATALOG`, `ERROR_REASONS`, thư viện phát hiện). Chưa có thì **thêm mã vào danh mục** theo luật của repo (R-ERR-1, R-INTAKE-11), không tự đặt chuỗi trên màn | SC-FAIL-3 |
| **R-STD-FAIL-3** | **Mỗi dòng chặn có test** gây ra đúng mã đó. Dòng cảnh báo nên có | SC-FAIL-4 |
| **R-STD-FAIL-4** | **Lời nhắc** (`hint`) tiếng Việt có dấu, ≤ 200 ký tự, nói **sai gì và làm gì tiếp**. Không có SQL, tên bảng, đường dẫn, stack, dữ liệu cá nhân (R-ERR-3 của open-ketoan). Cùng câu dùng cho tooltip, MCP `hint`, trang tra mã | SC-FAIL-2 |
| **R-STD-FAIL-5** | **Đích có thật.** Ô có trên màn; action sửa tại chỗ có trong mã. Sửa tại chỗ chỉ đi qua action của chủ danh mục (`core.item.*`, `core.partner.*`), không ghi bảng danh mục từ màn chứng từ | SC-FAIL-5 |
| **R-STD-FAIL-6** | **Mỗi màn có ghi dữ liệu có bản đồ.** Màn mới: dựng bản đồ **trước khi viết mã lưu** (phiếu nghiệm thu dẫn tới bản đồ). Màn cũ: ghi nợ ở `NO-CHUAN-NEN.md`, trả dần | SC-FAIL-1 |
| **R-STD-FAIL-7** | **Lỗi gặp thật về bản đồ.** Mã thấy trong nhật ký từ chối (open-ketoan HT19, DEV04) mà chưa có trong bản đồ của màn đó là một mục nợ: thêm dòng, lời nhắc, test. Bản đồ dày lên theo lỗi thật | SC-FAIL-7 |
| **R-STD-FAIL-8** | **Dòng có ý nghĩa kế toán phải được vai nghiệp vụ duyệt** (`approvedBy`): mức chặn hay cảnh báo, căn cứ. Đó là kỳ khoá, thuế, kho, giá vốn, công nợ, hạn mức. Dev không tự hạ `block` xuống `warn` | review (R-REV) |

## 4. Ba tầng

| Tầng | Đạt khi |
|---|---|
| **1. Repo tự chạy** | Màn có bản đồ; màn chỉ đúng ô / danh sách / nguồn gốc / luồng; dòng chặn có test; `failure-check --repo .` ĐẠT ở máy dev và CI |
| **2. API nội bộ** (module → lõi, màn → API) | Một khuôn lỗi `{ ok:false, error:{ code, message, requestId, traceId?, details } }` ([API-PROFILE](BIZCITY-API-PROFILE-v1.md)). Lỗi có đích trả `error.fields[] = { path, message, code? }` theo toạ độ chứng từ. Mỗi action có test hợp đồng sinh đủ các mã trong bản đồ |
| **3. API ngoài, chéo repo** (POS, cake, bridge → ketoan; ketoan → app khác) | `path` theo toạ độ **trong payload của bên gửi**, để bên gửi biết sửa trường nào của mình. Chứng từ sai giữ ở bể chờ, có `Idempotency-Key` và một phép đối chiếu (ECP). Mã của app khác có tiền tố chủ (`POS_*`, `CAKE_*`), không dùng lại mã của nhau. Bên nhận gặp mã lạ thì xử lý theo nhóm (`input` / `state` / `ledger` / `platform`). Màn `gui` của bên gửi có bản đồ với `catchAt: ["ngoai"]` |

Truy lỗi kỹ thuật (Tempo / Loki / Prometheus, [OBSERVABILITY](BIZCITY-OBSERVABILITY-v1.md)) vẫn là việc của dev. Người dùng chỉ cần lời nhắc đúng chỗ và **mã tra cứu** (`requestId` / `traceId`) để chép.

## 5. Công cụ (`tools/failure-check.mjs`)

### 5.1 Dựng khung — chống bỏ sót

```bash
node ../bizcity-platform/tools/failure-check.mjs --repo . --scaffold <tệp form> --code MH05 --label "Phiếu mua hàng" --write
```

Công cụ đọc form và **liệt kê máy móc**:
- mỗi danh sách chọn → chưa chọn / nháp / ngừng dùng / khác chi nhánh;
- mỗi ô số → âm, 0, sai kiểu; với số lượng / giá / tiền thêm một dòng `origin` vượt giới hạn;
- mỗi ô ngày → trống, sai, kỳ khoá;
- form có kho → hai dòng `flow`;
- mỗi thao tác → không đủ quyền, đã ghi sổ / khoá kỳ / người khác vừa sửa.

Mã để trống, lời nhắc `TODO`. Người làm gán mã, viết lời nhắc, bỏ dòng không áp dụng, thêm test. Thử trên phiếu mua hàng của open-ketoan: 72 tình huống khung (50 ô, 8 danh sách chọn, 8 nguồn gốc, 2 luồng, 4 trạng thái).

### 5.2 Kiểm

| Mã | Kiểm | Mức |
|---|---|---|
| SC-FAIL-1 | Form (`*Form` / `*Modal` .tsx / .jsx / .vue) có bản đồ. Màn tên khác: tự khai bản đồ | cảnh báo |
| SC-FAIL-2 | Bản đồ đúng khuôn, đích đủ trường, mỗi thao tác khai có ít nhất một tình huống, lời nhắc đủ và sạch | chặn / cảnh báo |
| SC-FAIL-3 | Mã có trong `codeSources` (bỏ trống: cả mã nguồn). Mã trống: cảnh báo | chặn |
| SC-FAIL-4 | Dòng chặn có test; tệp test có thật và nhắc đúng mã (hoặc chuỗi sau `#`) | chặn |
| SC-FAIL-5 | Ô có trên màn; action sửa tại chỗ có trong mã | cảnh báo |
| SC-FAIL-6 | Lỗi chặn có đích ô / danh sách / nguồn gốc mà không bắt ở `ui` | cảnh báo |
| SC-FAIL-7 | `--observed <tệp.jsonl>` (mỗi dòng `{ "screen", "code" }`, xuất từ nhật ký từ chối): lỗi gặp thật chưa có trong bản đồ | cảnh báo |

`--report` in độ phủ từng màn: số tình huống, % đủ mã + test, % bắt ở giao diện, số dòng theo loại đích. `--json` theo [CONFORMANCE-REPORT](BIZCITY-CONFORMANCE-REPORT-v1.md). `--self-test` thử ngược trên `tools/fixtures/failure`.

### 5.3 Nối với nghiệm thu (T13)

Phiếu nghiệm thu một màn có ghi dữ liệu dẫn tới bản đồ của màn đó. Phiếu chỉ lên **Chờ nghiệm thu** khi `failure-check` không còn phát hiện chặn trên bản đồ ấy ([DELIVERY](BIZCITY-DELIVERY-v1.md)). Bộ phận sử dụng nghiệm thu bằng cách **thử từng tình huống chặn** trên phần mềm thật: thấy đúng ô, đúng lời nhắc, sửa tại chỗ được.

## 6. Ai làm gì

| Vai | Việc |
|---|---|
| BA | Viết tình huống nghiệp vụ (`when`), nguồn gốc (`origin.source`), luồng (`flow.step`) |
| Kế toán trưởng · kế toán thuế · kế toán nội bộ | Duyệt mức chặn / cảnh báo và căn cứ của dòng có ý nghĩa kế toán (`approvedBy`, R-STD-FAIL-8) |
| Dev | Dựng khung, gán mã, làm màn chỉ đúng chỗ, viết test; `failure-check` ĐẠT trước khi mở PR |
| Tester | Mỗi dòng một ca thử; lỗi gặp thật ngoài bản đồ → mục nợ (R-STD-FAIL-7) |
| Kiểm soát / audit | Chấm độ phủ (`--report`) theo màn, so lần trước |

## 7. Chưa làm (lộ trình)

- **Màn thử:** phiếu mua hàng ở open-ketoan, theo nếp giữ chỗ và chữ chốt của repo. Thêm `code` vào `error.fields` và `target` vào `details.findings[]` là đổi thứ dùng chung, cần chốt trước. Chốt 1.0.0 sau màn thử.
- **`failure-check --contract`:** chạy các dòng của bản đồ với máy chủ thật (tầng 2 / 3), nối `spine-contract`. Chưa có.
- **Xuất `--observed` từ nhật ký** từ chối của open-ketoan (HT19 JSONL) thành `{ screen, code }`. Chưa có.
- SC-FAIL-1 nhận form theo tên tệp. Repo đặt tên khác (open-cake, plugin PHP) sẽ cần khai danh sách màn; chốt cùng bản 1.0.0.
