import { ImageResponse } from 'next/og';
import { supabaseServer } from '@/lib/supabase/server';

// Route segment config
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Image metadata
export const size = {
  width: 32,
  height: 32,
};
export const contentType = 'image/png';

// Image generation
export default async function Icon() {
  try {
    // Fetch brand logo URL and name from settings
    const svc = supabaseServer();
    const { data } = await svc
      .from('app_settings')
      .select('brand_logo_url, brand_name')
      .limit(1)
      .maybeSingle();

    const logoUrl = data?.brand_logo_url;

    // If brand logo exists, fetch and return it
    if (logoUrl) {
      try {
        const response = await fetch(logoUrl);
        if (response.ok) {
          const imageBuffer = await response.arrayBuffer();
          return new Response(imageBuffer, {
            headers: {
              'Content-Type': response.headers.get('Content-Type') || 'image/png',
              'Cache-Control': 'public, max-age=3600, s-maxage=3600',
            },
          });
        }
      } catch (error) {
        console.error('Error fetching brand logo for icon:', error);
      }
    }

    // Fallback: Generate a simple icon with first letter of brand name or default
    const brandName = data?.brand_name || 'E';
    const initial = brandName.charAt(0).toUpperCase();

    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 20,
            background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontFamily: 'sans-serif',
          }}
        >
          {initial}
        </div>
      ),
      {
        ...size,
      }
    );
  } catch (error) {
    console.error('Error generating icon:', error);
    
    // Ultimate fallback
    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 20,
            background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
          }}
        >
          E
        </div>
      ),
      {
        ...size,
      }
    );
  }
}
