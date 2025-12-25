import { NextResponse } from "next/server";

// Deprecated: centralize bootstrap deprecations here to minimize function count
export async function bootstrapPOST() {
  return NextResponse.json({ error: "bootstrap_deprecated" }, { status: 410 });
}

export async function bootstrapCreateFirstUserPOST() {
  return NextResponse.json({ error: "bootstrap_deprecated" }, { status: 410 });
}

export async function bootstrapResetPasswordPOST() {
  return NextResponse.json({ error: "bootstrap_deprecated" }, { status: 410 });
}
