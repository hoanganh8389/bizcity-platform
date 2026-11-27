// Copyright (c) 2026 Johnny Chu (Chu Hoàng Anh) / BizCity. GPL-2.0-or-later. See LICENSE.
// @bizcity-layer platform
// [2026-11-24 08:10 PM Johnny Chu - Chu Hoàng Anh] SPINE-4 — tách bộ kiểm JSON Schema tối thiểu ra lib để spine-check (MANIFEST) và spine-contract (CONTRACT) dùng chung; không phụ thuộc gói ngoài (R-PLAT-5). Phần hỗ trợ: type, enum, const, pattern, min/maxLength, minimum, required, properties, additionalProperties:false, items, minItems, uniqueItems, allOf/anyOf/oneOf/not, $ref nội bộ (#/$defs/…).

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SCHEMA_DIR = join(ROOT, 'schema/spine');

export function loadSchema(name) {
  return JSON.parse(readFileSync(join(SCHEMA_DIR, name), 'utf8'));
}

export function deref(root, ref) {
  if (!ref.startsWith('#/')) throw new Error('chỉ hỗ trợ $ref nội bộ: ' + ref);
  return ref.slice(2).split('/').reduce((o, k) => o[k], root);
}

function typeOf(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
}

/** Trả mảng lỗi (rỗng = hợp lệ). `root` là schema gốc để giải $ref. */
export function validate(root, schema, value, path = '$', errs = []) {
  if (schema.$ref) return validate(root, deref(root, schema.$ref), value, path, errs);
  const t = typeOf(value);
  if (schema.type) {
    const ok = [].concat(schema.type).some((x) => x === t || (x === 'number' && t === 'integer'));
    if (!ok) { errs.push(`${path}: kiểu ${t}, cần ${schema.type}`); return errs; }
  }
  if (schema.const !== undefined && value !== schema.const) errs.push(`${path}: phải là ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path}: không trong ${JSON.stringify(schema.enum)}`);
  if (t === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errs.push(`${path}: "${value}" không khớp ${schema.pattern}`);
    if (schema.minLength !== undefined && value.length < schema.minLength) errs.push(`${path}: ngắn hơn ${schema.minLength}`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errs.push(`${path}: dài hơn ${schema.maxLength}`);
  }
  if (t === 'integer' || t === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errs.push(`${path}: nhỏ hơn ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errs.push(`${path}: lớn hơn ${schema.maximum}`);
  }
  if (t === 'array') {
    if (schema.minItems !== undefined && value.length < schema.minItems) errs.push(`${path}: ít hơn ${schema.minItems} phần tử`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errs.push(`${path}: nhiều hơn ${schema.maxItems} phần tử`);
    if (schema.uniqueItems && new Set(value.map((x) => JSON.stringify(x))).size !== value.length) errs.push(`${path}: có phần tử trùng`);
    if (schema.items) value.forEach((v, i) => validate(root, schema.items, v, `${path}[${i}]`, errs));
  }
  if (t === 'object') {
    for (const k of schema.required || []) if (!(k in value)) errs.push(`${path}: thiếu "${k}"`);
    for (const [k, sub] of Object.entries(schema.properties || {})) if (k in value) validate(root, sub, value[k], `${path}.${k}`, errs);
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(value)) if (!(schema.properties && k in schema.properties)) errs.push(`${path}: thuộc tính lạ "${k}"`);
    }
  }
  if (schema.allOf) for (const s of schema.allOf) validate(root, s, value, path, errs);
  if (schema.anyOf && !schema.anyOf.some((s) => validate(root, s, value, path, []).length === 0)) errs.push(`${path}: không thoả anyOf`);
  if (schema.oneOf && schema.oneOf.filter((s) => validate(root, s, value, path, []).length === 0).length !== 1) errs.push(`${path}: oneOf phải đúng một`);
  if (schema.not && validate(root, schema.not, value, path, []).length === 0) errs.push(`${path}: vi phạm "not"`);
  return errs;
}

/** Khung báo cáo bizcity_conformance_report@1 — dùng chung cho mọi lane. */
export function report({ tool, lane, checks, findings, scope, app_id, target, level, tool_version = '1.1.0' }) {
  const fails = findings.filter((f) => f.level === 'fail').length;
  return {
    schema: 'bizcity_conformance_report@1', tool, tool_version, standard: 'bizcity_spine@1',
    ran_at: new Date().toISOString(), lane,
    ...(app_id ? { app_id } : {}), ...(target ? { target } : {}),
    scope, ...(level && !fails ? { level } : {}),
    checks, findings, verdict: fails ? 'KHÔNG ĐẠT' : 'ĐẠT',
  };
}

/** In ngắn gọn ra terminal, trả mã thoát. */
export function print(result, asJson) {
  if (asJson) { console.log(JSON.stringify(result, null, 2)); return result.verdict === 'ĐẠT' ? 0 : 1; }
  for (const c of result.checks) console.log(`${c.status === 'pass' ? '✔' : c.status === 'fail' ? '✗' : c.status === 'warn' ? '!' : '·'} ${c.id}${c.note ? ' — ' + c.note : ''}`);
  for (const f of result.findings) console.log(`   ${f.level === 'fail' ? '✗' : '!'} ${f.id} ${f.where}: ${f.msg}`);
  const fails = result.findings.filter((f) => f.level === 'fail').length;
  console.log(`KẾT LUẬN: ${result.verdict} (${result.findings.length} phát hiện, ${fails} chặn${result.level ? ', mức ' + result.level : ''}) — ${result.lane}`);
  return fails ? 1 : 0;
}
