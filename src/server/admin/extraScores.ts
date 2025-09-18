import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

// GET /api/admin/extra-scores/fields
export async function extraScoresFieldsGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();
    const { data, error } = await svc
      .from("extra_score_fields")
      .select(
        "id,key,label,type,order_index,hidden,include_in_pass,pass_weight,max_points,bool_true_points,bool_false_points,text_score_map,updated_at"
      )
      .order("order_index", { ascending: true, nullsFirst: false })
      .order("label", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// POST /api/admin/extra-scores/fields
export async function extraScoresFieldsPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const payload = await req.json().catch(() => ({}));
    const updates = Array.isArray(payload?.updates) ? payload.updates : [];
    if (updates.length === 0) {
      return NextResponse.json({ error: "no_updates" }, { status: 400 });
    }

    const toUpsert = updates.map((u: any) => ({
      id: u.id ?? undefined,
      key: u.key,
      label: u.label,
      type: u.type,
      order_index: u.order_index,
      hidden: u.hidden,
      include_in_pass: u.include_in_pass,
      pass_weight: u.pass_weight,
      max_points: u.max_points,
      bool_true_points: sanitizeNumber(u.bool_true_points, 0, 100, 100),
      bool_false_points: sanitizeNumber(u.bool_false_points, 0, 100, 0),
      text_score_map: sanitizeTextScoreMap(u.text_score_map),
      updated_at: new Date().toISOString(),
    }));

    const svc = supabaseServer();
    const { data, error } = await svc
      .from("extra_score_fields")
      .upsert(toUpsert, { onConflict: "key", ignoreDuplicates: false })
      .select(
        "id,key,label,type,order_index,hidden,include_in_pass,pass_weight,max_points,bool_true_points,bool_false_points,text_score_map,updated_at"
      );
    if (error) throw error;

    return NextResponse.json({ ok: true, items: data || [] });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

function clamp(n: any, min: number, max: number) {
  const x = Number(n);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}
function sanitizeNumber(n: any, min: number, max: number, fallback: number) {
  if (n == null) return fallback;
  const x = Number(n);
  if (Number.isNaN(x)) return fallback;
  return clamp(x, min, max);
}
function sanitizeTextScoreMap(input: any) {
  if (!input || typeof input !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(input)) {
    const key = String(k);
    const val = Number(v);
    if (!Number.isNaN(val)) out[key] = clamp(val, 0, 100);
  }
  return out;
}

// DELETE /api/admin/extra-scores/fields?key=:key
export async function extraScoresFieldsDELETE(req: NextRequest) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const key = url.searchParams.get("key")?.trim();
    if (!key) return NextResponse.json({ error: "key_required" }, { status: 400 });
    const svc = supabaseServer();
    // Remove key from all students' extra_scores.data in chunks to satisfy PostgREST filter requirements
    const pageSize = 500;
    let from = 0;
    let totalUpdated = 0;
    while (true) {
      const { data: rows, error: selErr } = await svc
        .from("extra_scores")
        .select("student_id,data")
        .range(from, from + pageSize - 1);
      if (selErr) throw selErr;
      const arr = rows || [];
      if (arr.length === 0) break;

      const payload: Array<{ student_id: string; data: any; updated_at: string }> = [];
      for (const r of arr) {
        const sid = (r as any)?.student_id as string;
        const dataObj = ((r as any)?.data || {}) as Record<string, any>;
        if (Object.prototype.hasOwnProperty.call(dataObj, key)) {
          const clone: Record<string, any> = { ...dataObj };
          delete clone[key];
          payload.push({ student_id: sid, data: clone, updated_at: new Date().toISOString() });
        }
      }
      if (payload.length > 0) {
        const { error: upErr } = await svc
          .from("extra_scores")
          .upsert(payload, { onConflict: "student_id", ignoreDuplicates: false });
        if (upErr) throw upErr;
        totalUpdated += payload.length;
      }
      if (arr.length < pageSize) break;
      from += pageSize;
    }

    // Delete the field definition itself
    const { error: delErr } = await svc
      .from("extra_score_fields")
      .delete()
      .eq("key", key);
    if (delErr) throw delErr;

    return NextResponse.json({ ok: true, updated_count: totalUpdated });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// GET /api/admin/extra-scores/fields/values?key=:key
export async function extraScoresFieldsValuesGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const url = new URL(req.url);
    const key = url.searchParams.get("key")?.trim();
    if (!key) return NextResponse.json({ error: "key_required" }, { status: 400 });
    const svc = supabaseServer();
    // Ensure the field exists and is text
    const { data: field, error: fErr } = await svc
      .from("extra_score_fields")
      .select("key,type")
      .eq("key", key)
      .maybeSingle();
    if (fErr) throw fErr;
    if (!field) return NextResponse.json({ error: "field_not_found" }, { status: 404 });
    // Gather distinct values from extra_scores.data
    const values = new Set<string>();
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: rows, error } = await svc
        .from("extra_scores")
        .select("data")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const arr = rows || [];
      for (const r of arr) {
        const v = (r as any)?.data?.[key];
        if (v == null) continue;
        const s = String(v).trim();
        if (s !== "") values.add(s);
      }
      if (arr.length < pageSize) break;
      from += pageSize;
    }
    return NextResponse.json({ key, values: Array.from(values).sort((a, b) => a.localeCompare(b)) });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// GET /api/admin/extra-scores/exams
export async function extraScoresExamsGET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();

    const { data: exams, error: examsErr } = await svc
      .from("exams")
      .select("id, title, status")
      .eq("status", "done")
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (examsErr) throw examsErr;

    const ids = (exams || []).map((e: any) => e.id);
    let configMap = new Map<string, any>();
    if (ids.length > 0) {
      const { data: cfg, error: cfgErr } = await svc
        .from("exam_public_config")
        .select("exam_id, order_index, hidden, include_in_pass")
        .in("exam_id", ids);
      if ((cfgErr as any) && (cfgErr as any).code !== "PGRST116") throw cfgErr;
      (cfg || []).forEach((c: any) => configMap.set(c.exam_id, c));
    }

    const items = (exams || [])
      .map((e: any) => {
        const c = configMap.get(e.id) || {};
        return {
          id: e.id,
          title: e.title,
          status: e.status,
          order_index: c.order_index ?? null,
          hidden: c.hidden === true,
          include_in_pass: c.include_in_pass !== false,
        };
      })
      .sort(
        (a, b) => (a.order_index ?? 9999) - (b.order_index ?? 9999) || a.title.localeCompare(b.title)
      );

    return NextResponse.json({ items });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// POST /api/admin/extra-scores/exams
export async function extraScoresExamsPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();
    const payload = await req.json().catch(() => ({}));
    const updates = Array.isArray(payload?.updates) ? payload.updates : [];
    if (updates.length === 0) {
      return NextResponse.json({ error: "no_updates" }, { status: 400 });
    }

    const toUpsert = updates.map((u: any) => ({
      exam_id: u.exam_id,
      hidden: u.hidden === true,
      include_in_pass: u.include_in_pass !== false,
      order_index: u.order_index ?? null,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await svc
      .from("exam_public_config")
      .upsert(toUpsert, { onConflict: "exam_id", ignoreDuplicates: false })
      .select("exam_id, hidden, include_in_pass, order_index");
    if (error) throw error;

    return NextResponse.json({ ok: true, items: data || [] });
  } catch (e: any) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}

// POST /api/admin/extra-scores/import
export async function extraScoresImportPOST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const svc = supabaseServer();

    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.rows) || !body.codeColumn) {
      return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
    }

    const rows: Record<string, any>[] = body.rows;
    const codeColumn: string = String(body.codeColumn);

    if (rows.length === 0) {
      return NextResponse.json({ error: "no_rows" }, { status: 400 });
    }

    const headerSet = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        if (k === codeColumn) continue;
        if (k == null || k === "") continue;
        headerSet.add(k.trim());
      }
    }
    const fieldKeys = Array.from(headerSet);

    const { data: existingFields, error: fieldsErr } = await svc
      .from("extra_score_fields")
      .select("id,key,label,type,order_index")
      .in("key", fieldKeys);
    if ((fieldsErr as any) && (fieldsErr as any).code !== "PGRST116") throw fieldsErr;

    const existingMap = new Map<string, any>();
    (existingFields || []).forEach((f: any) => existingMap.set(f.key, f));

    const toCreate: any[] = [];
    let nextOrder = (existingFields || []).length;
    for (const key of fieldKeys) {
      if (existingMap.has(key)) continue;
      let totalCount = 0;
      let booleanCount = 0;
      let numericCount = 0;
      for (const r of rows) {
        const v = r[key];
        if (v === null || v === undefined || v === "") continue;
        totalCount++;
        let isBool = false;
        if (typeof v === 'boolean') {
          isBool = true;
        } else if (typeof v === 'number') {
          isBool = (v === 1 || v === 0);
        } else {
          const s = String(v).trim().toLowerCase();
          if (["true","false","1","0","yes","no","y","n","on","off"].includes(s)) isBool = true;
        }
        if (isBool) booleanCount++;
        const n = Number(v);
        if (!Number.isNaN(n)) numericCount++;
      }
      let type: "number" | "text" | "boolean" = "text";
      if (totalCount > 0 && booleanCount === totalCount) type = "boolean";
      else if (totalCount > 0 && numericCount === totalCount) type = "number";
      else type = "text";
      toCreate.push({ key, label: key, type, order_index: nextOrder++ });
    }
    if (toCreate.length > 0) {
      const { error: createErr } = await svc.from("extra_score_fields").upsert(toCreate, { onConflict: "key" });
      if (createErr) throw createErr;
    }

    const { data: fieldsAfter, error: fieldsAfterErr } = await svc
      .from("extra_score_fields")
      .select("key,type")
      .in("key", fieldKeys);
    if ((fieldsAfterErr as any) && (fieldsAfterErr as any).code !== "PGRST116") throw fieldsAfterErr;
    const typeMap = new Map<string, string>();
    (fieldsAfter || []).forEach((f: any) => typeMap.set(f.key, f.type));

    const truthy = new Set(["true","1","yes","y","on"]);
    const falsy = new Set(["false","0","no","n","off"]);
    const toBool = (v: any): boolean | null => {
      if (typeof v === 'boolean') return v;
      if (typeof v === 'number') return v === 1;
      if (v == null) return null;
      const s = String(v).trim().toLowerCase();
      if (truthy.has(s)) return true;
      if (falsy.has(s)) return false;
      return null;
    };
    const coerce = (t: string, v: any) => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      switch (t) {
        case 'number': {
          if (typeof v === 'number') return v;
          const n = Number(v);
          return Number.isNaN(n) ? null : n;
        }
        case 'boolean': {
          return toBool(v);
        }
        default:
          return v;
      }
    };

    const codes = Array.from(new Set(rows.map(r => String(r[codeColumn] || "").trim()).filter(Boolean)));
    if (codes.length === 0) {
      return NextResponse.json({ error: "no_codes" }, { status: 400 });
    }

    const codeToId = new Map<string, string>();
    for (let i = 0; i < codes.length; i += 500) {
      const chunk = codes.slice(i, i + 500);
      const { data: students, error: stuErr } = await svc
        .from("students")
        .select("id,code")
        .in("code", chunk);
      if (stuErr) throw stuErr;
      (students || []).forEach((s: any) => codeToId.set(s.code, s.id));
    }

    const updates = new Map<string, Record<string, any>>();
    for (const r of rows) {
      const codeRaw = r[codeColumn];
      const code = (codeRaw == null ? "" : String(codeRaw)).trim();
      if (!code) continue;
      const sid = codeToId.get(code);
      if (!sid) continue;

      const current = updates.get(sid) || {};
      for (const key of fieldKeys) {
        const val = r[key];
        const t = typeMap.get(key) || 'text';
        const coerced = coerce(t, val);
        if (coerced !== undefined) current[key] = coerced;
      }
      updates.set(sid, current);
    }

    if (updates.size === 0) {
      return NextResponse.json({ error: "no_matching_students" }, { status: 400 });
    }

    const studentIds = Array.from(updates.keys());
    const existingScores = new Map<string, any>();
    for (let i = 0; i < studentIds.length; i += 500) {
      const chunk = studentIds.slice(i, i + 500);
      const { data: es, error: esErr } = await svc
        .from("extra_scores")
        .select("student_id,data")
        .in("student_id", chunk);
      if (esErr) throw esErr;
      (es || []).forEach((row: any) => existingScores.set(row.student_id, row.data || {}));
    }

    let upserted = 0;
    const payloads: any[] = [];
    for (const [sid, obj] of updates.entries()) {
      const base = existingScores.get(sid) || {};
      payloads.push({ student_id: sid, data: { ...base, ...obj }, updated_at: new Date().toISOString() });
    }

    for (let i = 0; i < payloads.length; i += 200) {
      const chunk = payloads.slice(i, i + 200);
      const { error: upErr } = await svc
        .from("extra_scores")
        .upsert(chunk, { onConflict: "student_id", ignoreDuplicates: false });
      if (upErr) throw upErr;
      upserted += chunk.length;
    }

    return NextResponse.json({ ok: true, upserted, fields_created: toCreate.length });
  } catch (e: any) {
    if (e instanceof Response) return e;
    console.error("extra-scores import error:", e);
    return NextResponse.json({ error: e?.message || "unexpected_error" }, { status: 500 });
  }
}
