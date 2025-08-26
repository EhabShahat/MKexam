import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT } from "jose";

function getAuthSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "dev-secret-do-not-use-in-prod"
  );
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();
    
    // Simple password check
    if (password !== "easteregg2024" && password !== "admin123") {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Create a temporary admin JWT token for easter egg access
    const secret = new TextEncoder().encode(getAuthSecret());
    const token = await new SignJWT({
      sub: "easter-egg-admin",
      email: "easter-egg@admin.local",
      is_admin: true,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret);

    // Set the auth cookie
    const cookieStore = await cookies();
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Easter egg auth error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}