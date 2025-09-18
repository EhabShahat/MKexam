import { NextResponse } from "next/server";
import { getCodeFormatSettings } from "@/lib/codeGenerator";

export async function codeSettingsGET() {
  try {
    const settings = await getCodeFormatSettings();
    const res = NextResponse.json(settings);
    res.headers.set("Cache-Control", "public, max-age=300, s-maxage=300, stale-while-revalidate=300");
    return res;
  } catch (error) {
    console.error("Error fetching code settings:", error);
    const res = NextResponse.json(
      {
        code_length: 4,
        code_format: "numeric",
        code_pattern: null,
      },
      { status: 500 }
    );
    res.headers.set("Cache-Control", "public, max-age=120, s-maxage=120");
    return res;
  }
}
