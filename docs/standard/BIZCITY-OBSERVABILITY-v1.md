# `bizcity_observability@1` — Quan sát và truy lỗi

<!-- [2026-11-24 11:48 PM Johnny Chu - Chu Hoàng Anh] STD-1 — trụ cột T5: một chuẩn log · số đo · trace cho mọi app (OpenTelemetry → Tempo, pino → Loki, Prometheus + Alertmanager, Grafana), rút từ open-ketoan ADR-0010, RULE-LOG, infrastructure/monitoring và phần mở rộng của open-cake. -->

> **Phiên bản:** 1.0.0 · 2026-11-25 · **Trạng thái:** **Chấp nhận** — chủ dự án duyệt 2026-11-25 <!-- [2026-11-25 10:30 AM Johnny Chu - Chu Hoàng Anh] STD-4 — chủ duyệt 2026-11-25 -->
> **Luật gốc:** open-ketoan `docs/rules/RULE-LOG.md` (R-LOG-1..11), R-OBS-1..9 (`docs/ops/OBSERVABILITY.md`), `RULE-SELF-DIAGNOSTICS.md` (R-DIAG-1..9), ADR-0010, `docs/ops/OBSERVABILITY.md`; canon §8.
> **Bản mẫu:** open-ketoan `infrastructure/monitoring/` + `packages/platform/src/core/{tracing,metrics,logger,request-context}.ts`.

## 0. Một câu

**Một lỗi ở bất kỳ app nào cũng truy được bằng một mã (`traceId`) qua cả chuỗi kênh → Hub → app → sự kiện, mà không cần xem dữ liệu của khách.**

## 1. Bộ công cụ (cố định, không mỗi app một kiểu)

| Việc | Công cụ | Cấu hình ở bản mẫu |
|---|---|---|
| Trace | OpenTelemetry SDK → otel-collector (lấy mẫu ở đuôi) → **Tempo** | `otel-collector/config.yml`, `tempo/tempo.yml` |
| Log | pino JSON ra stdout → promtail → **Loki** | `loki/loki-config.yml`, `promtail/promtail-config.yml` |
| Số đo | **Prometheus** + **Alertmanager** | `prometheus/{prometheus.yml,alerts.yml,alerts.test.yml}`, `alertmanager/alertmanager.yml` |
| Bảng | **Grafana** | `grafana/dashboards/01..09-*.json` |
| Máy chủ, CSDL | postgres-exporter, node-exporter, cadvisor | `docker-compose.monitoring.yml` |

Bộ giám sát chạy bằng **tệp compose riêng**, một bộ cho cả máy chủ (mọi app gửi về cùng collector / Loki / Prometheus), không nằm trong compose của app. Giữ: Tempo 7 ngày, Loki 30 ngày.

## 2. Hai mã đi xuyên suốt

| Mã | Dạng | Ở đâu |
|---|---|---|
| `requestId` | chuỗi của máy chủ HTTP | header `X-Request-Id` vào và ra; trường log `reqId`; `error.requestId` |
| `traceId` | 32 ký tự hex, W3C `traceparent` | truyền qua Cell → Hub → app → outbox → webhook; có trong log và trong lỗi; lưu cùng sự kiện |

| Luật | Nội dung |
|---|---|
| R-OBS-1 | mọi câu trả lời có `X-Request-Id`; mọi lỗi có `error.requestId` |
| R-STD-OBS-1 (mới) | app nhận `traceparent` thì **tiếp tục** trace đó, gọi ra ngoài (HTTP, webhook, MCP) thì **gửi kèm**; không tạo trace mới giữa chừng |
| R-OBS-7 | chỉ một tệp của nền được import thư viện OpenTelemetry (`tracing.ts`); mã khác dùng `withSpan` / `ctx.trace.step(…)` (SC-OBS-2) |
| R-STD-OBS-2 (mới) | màn lỗi hiện `code / message / hint` và `requestId` chép được (canon §8) |

## 3. Tên span và thuộc tính

`HTTP {method} {route}` · `mcp tools/call {tool}` · `action {id}` · `step {module}.{name}` · `kernel {op}` · `db {op} {table}` · `event publish | deliver`.

Thuộc tính span theo **danh sách cho phép** (`TRACE_ATTRIBUTES`, R-OBS-8); trace, số đo, log **không bao giờ** được đọc ngược vào nghiệp vụ; mọi span có `bizcity.outcome` = `ok | rejected | error` (`rejected` = hệ thống từ chối đúng luật, không phải lỗi kỹ thuật). Không đưa dữ liệu nghiệp vụ, PII, thân yêu cầu vào span.

## 4. Log

| Luật | Nội dung |
|---|---|
| R-LOG-1 | pino JSON; mỗi dòng có `service, version, commit, site, tenant, reqId, traceId` |
| — | `evt = bizcity.<miền>.<việc>`; `msg` tiếng Việt; nhãn Loki giới hạn: `service, level, site, errCode, evt` |
| R-LOG-2 | không `catch` nuốt lỗi im lặng; chỗ cố ý ghi chú `// nuot-loi: <lý do>` |
| R-LOG-3 | `uncaughtException` ghi `fatal` rồi thoát |
| R-LOG-4 | không PII, bí mật, thân yêu cầu; `REDACT_PATHS` (app thêm khoá PII của mình) |
| R-LOG-7 | lỗi 4xx không ghi mức `error` |
| R-LOG-9 | nhật ký lỗi cố định ra tệp `logs/<dịch vụ>/<YYYY-MM-DD>.log`, giữ 30 ngày, trần tổng 200 MB; `scripts/lay-log.sh` gom |
| R-LOG-10 | `ErrorBoundary` của web gửi lỗi về `POST /system/client-errors` có vân tay lỗi, ≤ 10 lỗi / phút |
| SC-OBS-3 | compose đặt trần log Docker (`max-size`, `max-file`) cho mọi dịch vụ |

## 5. Số đo

Tiền tố `bizcity_`. Nền cung cấp: `bizcity_http_*`, `bizcity_db_*`, `bizcity_outbox_*`, `bizcity_actions_total`, `bizcity_mcp_tool_calls_total`, `bizcity_build_info`. App thêm `bizcity_<app>_*`.

| Luật | Nội dung |
|---|---|
| R-OBS-4 | **không nhãn nhiều giá trị**: không `contact_id`, `tenant`, `user`, `doc_ref` làm nhãn |
| SC-OBS-1 | số đo dùng trong bảng Grafana và luật cảnh báo phải được khai trong mã |
| R-OBS-3 | `/metrics` không ra Internet qua nginx; có `METRICS_TOKEN` khi cổng API mở ra ngoài máy |
| R-OBS-5 | cảnh báo dựa trên số đo + mã lỗi, không dựa trên câu chữ log; cảnh báo có test (`alerts.test.yml`, chạy bằng `promtool`) và sổ tay xử lý cho từng cảnh báo (`RUNBOOK-CANH-BAO.md`) |

## 6. Sức khoẻ và tự chẩn đoán

| Route | Việc |
|---|---|
| `GET /api/v1/system/health` | phiên bản app, kernel, chuẩn |
| `GET /api/v1/system/health/ready` | 503 `NOT_READY` khi còn migration chưa chạy |
| `GET /api/v1/system/diagnostics` | mức L0–L3, kết quả lưu lại; "đạt trên dữ liệu rỗng" không tính là đạt (R-DIAG-7) |
| `GET /api/v1/system/devtools/…` | Bàn điều tra: tra `traceId` / `requestId`; quyền `devtools:read`; AI **không** được gọi |

Chép lỗi cho AI sửa: chỉ mã và tên bước, **không** dữ liệu khách (open-ketoan `docs/ops/SO-TAY-DIEU-TRA-LOI.md`).

## 7. Kiểm

| Mã | Lane | Kiểm | Có ở |
|---|---|---|---|
| SC-OBS-1/2/3, SC-LOG-1/2/3, SC-DEV-1/2/3, SC-DIAG-1 | HOUSE | như trên | open-ketoan selfcheck |
| CI `monitoring` | HOUSE | `promtool`, `amtool`, `otelcol validate` trên cấu hình | open-ketoan `.github/workflows/conformance.yml` |
| SC-OBS-P1 | CONTRACT | gọi một route với `traceparent` ⇒ lỗi trả về mang đúng `traceId` đó; mọi câu trả lời có `X-Request-Id` | đề xuất thêm vào `tools/spine-contract.mjs` |

## 8. Khoảng cách hiện tại

| App | Thiếu |
|---|---|
| open-cake | mới có log mặc định của Fastify + `health` / `health/ready`; chưa có OTel, `/metrics`, `infrastructure/` (PHASE-016) |
| plugin WordPress, Hub | chưa truyền `traceparent`; log theo kiểu riêng |
| chung | chưa có một bộ giám sát dùng chung cho nhiều app trên cùng máy chủ (mỗi app đang tự mang) |
