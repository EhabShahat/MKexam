import { NextRequest, NextResponse } from 'next/server';
import { getRequests, createRequest } from '@/server/admin/requests';
import { supabaseServer } from '@/lib/supabase/server';

// GET /api/admin/requests
export async function GET() {
  try {
    const requests = await getRequests();
    return NextResponse.json(requests);
  } catch (error) {
    console.error('GET /api/admin/requests error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch requests' },
      { status: 500 }
    );
  }
}

// POST /api/admin/requests (for public form submissions)
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Multipart form-data path (with optional photos)
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();

      const student_name = String(form.get('student_name') || '').trim();
      const mobile_number_raw = String(form.get('mobile_number') || '').trim();
      const mobile_number2_raw = String(form.get('mobile_number2') || '').trim();
      const address = String(form.get('address') || '').trim() || undefined;
      const national_id = String(form.get('national_id') || '').trim() || undefined;

      if (!student_name || !mobile_number_raw) {
        return NextResponse.json(
          { error: 'Student name and mobile number are required' },
          { status: 400 }
        );
      }

      const mobile_number = mobile_number_raw.replace(/\D/g, '');
      if (mobile_number.length < 10) {
        return NextResponse.json(
          { error: 'Please enter a valid mobile number' },
          { status: 400 }
        );
      }

      // Optional uploads
      const svc = supabaseServer();
      let user_photo_url: string | undefined;
      let national_id_photo_url: string | undefined;

      const userPhoto = form.get('user_photo') as File | null;
      const idPhoto = form.get('national_id_photo') as File | null;

      async function uploadToStorage(file: File, prefix: string) {
        const ts = Date.now();
        const rand = Math.random().toString(36).slice(2, 8);
        const ext = (file.name.split('.').pop() || 'png');
        const path = `${prefix}/${ts}-${rand}.${ext}`;
        const buf = new Uint8Array(await file.arrayBuffer());
        const { error: upErr } = await svc.storage
          .from('student-files')
          .upload(path, buf, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
        const { data } = svc.storage.from('student-files').getPublicUrl(path);
        if (!data?.publicUrl) throw new Error('Failed to get public URL');
        return data.publicUrl as string;
      }

      if (userPhoto && userPhoto.size > 0) {
        user_photo_url = await uploadToStorage(userPhoto, 'requests/user');
      }
      if (idPhoto && idPhoto.size > 0) {
        national_id_photo_url = await uploadToStorage(idPhoto, 'requests/national');
      }

      const newRequest = await createRequest({
        student_name,
        mobile_number,
        mobile_number2: mobile_number2_raw ? mobile_number2_raw.replace(/\D/g, '') : undefined,
        address,
        national_id,
        user_photo_url,
        national_id_photo_url,
      });
      return NextResponse.json(newRequest, { status: 201 });
    }

    // JSON fallback
    const body = await request.json();
    if (!body.student_name || !body.mobile_number) {
      return NextResponse.json(
        { error: 'Student name and mobile number are required' },
        { status: 400 }
      );
    }
    const cleanMobile = String(body.mobile_number).replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      return NextResponse.json(
        { error: 'Please enter a valid mobile number' },
        { status: 400 }
      );
    }
    const requestData = {
      student_name: String(body.student_name).trim(),
      mobile_number: cleanMobile,
      mobile_number2: body.mobile_number2 ? String(body.mobile_number2).replace(/\D/g, '') : undefined,
      address: body.address?.trim(),
      national_id: body.national_id?.trim(),
    };
    const newRequest = await createRequest(requestData);
    return NextResponse.json(newRequest, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/admin/requests error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create request' },
      { status: 400 }
    );
  }
}
