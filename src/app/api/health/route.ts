import { NextResponse } from "next/server";

/**
 * Health check endpoint for network monitoring
 * Used by offlineHandler to check if the server is reachable
 */
export async function HEAD() {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    }
  });
}

export async function GET() {
  return NextResponse.json(
    { status: 'ok', timestamp: new Date().toISOString() },
    { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    }
  );
}
