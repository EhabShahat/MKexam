import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCodeFormatSettings, generateRandomCode } from '@/lib/codeGenerator';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export interface StudentRequest {
  request_id: string;
  student_name: string;
  mobile_number: string;
  mobile_number2?: string | null;
  address?: string | null;
  national_id?: string | null;
  user_photo_url?: string | null;
  national_id_photo_url?: string | null;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  updated_at: string;
  notes?: string;
}

// GET /api/admin/requests - Get all requests
export async function getRequests() {
  const { data, error } = await supabase
    .from('student_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching requests:', error);
    throw new Error('Failed to fetch requests');
  }

  return data;
}

// POST /api/admin/requests - Create new request (from public form)
export async function createRequest(requestData: {
  student_name: string;
  mobile_number: string;
  mobile_number2?: string;
  address?: string;
  national_id?: string;
  user_photo_url?: string | null;
  national_id_photo_url?: string | null;
}) {
  // Check for existing students with same mobile or national_id
  let query = supabase
    .from('students')
    .select('id, student_name, mobile_number, mobile_number2, national_id');

  // Build OR conditions for mobile numbers
  const conditions = [
    `mobile_number.eq.${requestData.mobile_number}`,
    `mobile_number2.eq.${requestData.mobile_number}`
  ];

  // Add national ID condition if provided
  if (requestData.national_id) {
    conditions.push(`national_id.eq.${requestData.national_id}`);
  }

  let existingStudents: any[] = [];
  try {
    const { data, error } = await query.or(conditions.join(','));
    if (error) throw error;
    existingStudents = data || [];
  } catch (err: any) {
    // Do not block submissions if duplicate check fails; log and continue
    console.warn('Duplicate check (students) failed, proceeding without check:', err?.message || err);
    existingStudents = [];
  }

  // If exact duplicates exist, reject the request
  if (existingStudents && existingStudents.length > 0) {
    const mobileMatch = existingStudents.find(s => 
      s.mobile_number === requestData.mobile_number
    );
    const nationalIdMatch = existingStudents.find(s => 
      requestData.national_id && s.national_id === requestData.national_id
    );

    if (mobileMatch) {
      throw new Error('A student with this mobile number already exists');
    }
    if (nationalIdMatch) {
      throw new Error('A student with this national ID already exists');
    }
  }

  // Check for existing pending requests with same mobile or national_id
  const requestConditions = [`mobile_number.eq.${requestData.mobile_number}`];
  if (requestData.national_id) {
    requestConditions.push(`national_id.eq.${requestData.national_id}`);
  }

  let existingRequests: any[] = [];
  try {
    const { data, error } = await supabase
      .from('student_requests')
      .select('request_id, mobile_number, national_id')
      .eq('status', 'pending')
      .or(requestConditions.join(','));
    if (error) throw error;
    existingRequests = data || [];
  } catch (err: any) {
    console.warn('Duplicate check (pending requests) failed, proceeding without check:', err?.message || err);
    existingRequests = [];
  }

  if (existingRequests && existingRequests.length > 0) {
    throw new Error('A request with this mobile number or national ID is already pending');
  }

  // Create the request
  const { data, error } = await supabase
    .from('student_requests')
    .insert([{
      student_name: requestData.student_name,
      mobile_number: requestData.mobile_number,
      mobile_number2: requestData.mobile_number2 ?? null,
      address: requestData.address ?? null,
      national_id: requestData.national_id ?? null,
      user_photo_url: requestData.user_photo_url ?? null,
      national_id_photo_url: requestData.national_id_photo_url ?? null,
      status: 'pending'
    }])
    .select()
    .single();

  if (error) {
    console.error('Error creating request:', error);
    throw new Error('Failed to create request');
  }

  return data;
}

// POST /api/admin/requests/[id]/approve - Approve request and create student
export async function approveRequest(requestId: string) {
  // Get the request
  const { data: request, error: fetchError } = await supabase
    .from('student_requests')
    .select('*')
    .eq('request_id', requestId)
    .eq('status', 'pending')
    .single();

  if (fetchError || !request) {
    console.error('Error fetching request:', fetchError);
    throw new Error('Request not found or already processed');
  }

  // Generate random student code (same as Add New Student)
  const codeSettings = await getCodeFormatSettings();
  let newCode: string;
  let attempts = 0;
  
  while (true) {
    newCode = generateRandomCode(codeSettings);
    attempts++;
    if (attempts > 100) {
      throw new Error('Failed to generate unique code after 100 attempts');
    }
    
    // Check if code already exists
    const { data: existing } = await supabase
      .from('students')
      .select('id')
      .eq('code', newCode)
      .maybeSingle();
    
    if (!existing) break; // Code is unique, use it
  }

  // Start transaction - Create student and update request
  const { data: newStudent, error: studentError } = await supabase
    .from('students')
    .insert([{
      code: newCode,
      student_name: request.student_name,
      mobile_number: request.mobile_number,
      mobile_number2: request.mobile_number2,
      address: request.address,
      national_id: request.national_id,
      photo_url: (request as any).user_photo_url ?? null,
      national_id_photo_url: (request as any).national_id_photo_url ?? null,
    }])
    .select()
    .single();

  if (studentError) {
    console.error('Error creating student:', studentError);
    throw new Error('Failed to create student');
  }

  // Update request status to approved
  const { error: updateError } = await supabase
    .from('student_requests')
    .update({ 
      status: 'approved',
      updated_at: new Date().toISOString()
    })
    .eq('request_id', requestId);

  if (updateError) {
    console.error('Error updating request:', updateError);
    // Rollback - delete the created student
    await supabase
      .from('students')
      .delete()
      .eq('student_id', newStudent.student_id);
    
    throw new Error('Failed to update request status');
  }

  return { student: newStudent, request };
}

// POST /api/admin/requests/[id]/deny - Deny request
export async function denyRequest(requestId: string, reason?: string) {
  const { data, error } = await supabase
    .from('student_requests')
    .update({ 
      status: 'denied',
      notes: reason,
      updated_at: new Date().toISOString()
    })
    .eq('request_id', requestId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error) {
    console.error('Error denying request:', error);
    throw new Error('Failed to deny request');
  }

  return data;
}

// Check for duplicates in existing students (for public form validation)
export async function checkDuplicatesForPublicForm(data: {
  mobile_number: string;
  national_id?: string;
}) {
  const conditions = [`mobile_number.eq.${data.mobile_number}`, `mobile_number2.eq.${data.mobile_number}`];
  
  if (data.national_id) {
    conditions.push(`national_id.eq.${data.national_id}`);
  }

  let existingStudents: any[] = [];
  try {
    const { data, error } = await supabase
      .from('students')
      .select('id, student_name, mobile_number, national_id, code')
      .or(conditions.join(','));
    if (error) throw error;
    existingStudents = data || [];
  } catch (err: any) {
    console.warn('Public duplicate check (students) failed:', err?.message || err);
    existingStudents = [];
  }

  // Check pending requests too
  let existingRequests: any[] = [];
  try {
    const { data, error } = await supabase
      .from('student_requests')
      .select('request_id, student_name, mobile_number, national_id')
      .eq('status', 'pending')
      .or(conditions.join(','));
    if (error) throw error;
    existingRequests = data || [];
  } catch (err: any) {
    console.warn('Public duplicate check (requests) failed:', err?.message || err);
    existingRequests = [];
  }

  return { existingStudents, existingRequests };
}

// PATCH /api/admin/requests/[id]/update - Update request data
export async function updateRequest(requestId: string, updateData: Partial<StudentRequest>) {
  const { data, error } = await supabase
    .from('student_requests')
    .update({
      student_name: updateData.student_name,
      mobile_number: updateData.mobile_number,
      mobile_number2: updateData.mobile_number2,
      address: updateData.address,
      national_id: updateData.national_id,
      notes: updateData.notes,
      updated_at: new Date().toISOString()
    })
    .eq('request_id', requestId)
    .eq('status', 'pending') // Only allow updating pending requests
    .select()
    .single();

  if (error) {
    console.error('Error updating request:', error);
    throw new Error('Failed to update request');
  }

  return data;
}
