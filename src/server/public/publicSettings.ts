import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function publicSettingsGET() {
  try {
    const svc = supabaseServer();
    let { data, error } = await svc
      .from("app_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (error && (error as any).code === "42703") {
      const result = await svc
        .from("app_settings")
        .select(
          [
            "brand_name",
            "brand_logo_url",
            "default_language",
            "welcome_instructions",
            "welcome_instructions_ar",
            "thank_you_title",
            "thank_you_title_ar",
            "thank_you_message",
            "thank_you_message_ar",
            "enable_name_search",
            "enable_code_search",
            "results_show_view_attempt",
          ].join(", ")
        )
        .limit(1)
        .maybeSingle();
      data = result.data;
      error = result.error as any;

      if (error && (error as any).code === "42703") {
        const result2 = await svc
          .from("app_settings")
          .select(["brand_name", "brand_logo_url"].join(", "))
          .limit(1)
          .maybeSingle();
        data = result2.data;
        error = result2.error as any;
      }
    }

    if (error) {
      if ((error as any).code === "42P01") {
        return NextResponse.json({});
      }
      const res = NextResponse.json({ error: (error as any).message }, { status: 400 });
      res.headers.set("Cache-Control", "public, max-age=60, s-maxage=60");
      return res;
    }

    const result = data || {};
    const res = NextResponse.json(result);
    res.headers.set(
      "Cache-Control",
      "public, max-age=600, s-maxage=600, stale-while-revalidate=600"
    );
    return res;
  } catch (e: any) {
    const res = NextResponse.json(
      { error: e?.message || "unexpected_error" },
      { status: 500 }
    );
    res.headers.set("Cache-Control", "public, max-age=60, s-maxage=60");
    return res;
  }
}
