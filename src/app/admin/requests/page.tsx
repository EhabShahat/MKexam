"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface StudentRequest {
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
  notes?: string;
}

interface Student {
  student_id: string;
  code: string;
  student_name: string;
  mobile_number: string | null;
  mobile_number2?: string | null;
  national_id?: string | null;
  student_created_at: string;
}

export default function RequestsPage() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<StudentRequest | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<StudentRequest | null>(null);
  
  // Why Modal state
  const [whyModalData, setWhyModalData] = useState<{
    request: StudentRequest;
    matchingStudent: any;
    reason: string;
  } | null>(null);

  // Photo viewer state
  const [photoViewer, setPhotoViewer] = useState<{ url: string; title: string } | null>(null);

  // Fetch student requests
  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ["admin", "requests"],
    queryFn: async () => {
      const response = await fetch("/api/admin/requests");
      if (!response.ok) throw new Error("Failed to fetch requests");
      return response.json();
    }
  });


  // Update request mutation
  const updateRequest = useMutation({
    mutationFn: async ({ requestId, data }: { requestId: string; data: Partial<StudentRequest> }) => {
      const response = await fetch(`/api/admin/requests/${requestId}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update request");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "requests"] });
    }
  });

  // Approve request mutation
  const approveRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch(`/api/admin/requests/${requestId}/approve`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to approve request");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      setIsApproveModalOpen(false);
      setSelectedRequest(null);
    }
  });

  // Deny request mutation
  const denyRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch(`/api/admin/requests/${requestId}/deny`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to deny request");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "requests"] });
    }
  });

  const pendingRequests = requests?.filter((req: StudentRequest) => req.status === 'pending') || [];

  if (requestsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-1">Student Requests</h1>
                </div>
            </div>
            
          </div>

          
        </div>

        {/* Enhanced Requests Table */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
          <div className="px-8 py-6 bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Pending Requests</h2>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-indigo-100 rounded-xl">
                  <span className="text-indigo-700 font-semibold">{pendingRequests.length}</span>
                  <span className="text-indigo-600 text-sm ml-1">pending</span>
                </div>
              </div>
            </div>
          </div>


          <div className="overflow-x-auto">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-gray-500 text-lg">No pending requests</p>
                <p className="text-gray-400 text-sm">New student registration requests will appear here</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50/80">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">National ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submitted</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingRequests.map((request: StudentRequest) => (
                    <RequestRow 
                      key={request.request_id} 
                      request={request} 
                      onEdit={(req) => {
                        setEditingRequest(req);
                        setIsEditModalOpen(true);
                      }}
                      onApprove={(req) => {
                        setSelectedRequest(req);
                        setIsApproveModalOpen(true);
                      }}
                      onDeny={(requestId) => denyRequest.mutate(requestId)}
                      onShowWhy={(request, matchingStudent, reason) => {
                        setWhyModalData({ request, matchingStudent, reason });
                      }}
                      onViewPhoto={(url, title) => setPhotoViewer({ url, title })}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Edit Modal */}
        {isEditModalOpen && editingRequest && (
          <EditRequestModal 
            key={editingRequest.request_id}
            request={editingRequest}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditingRequest(null);
            }}
            onSave={(data) => {
              updateRequest.mutate({ requestId: editingRequest.request_id, data });
              setIsEditModalOpen(false);
              setEditingRequest(null);
            }}
            isSaving={updateRequest.isPending}
          />
        )}

        {/* Approve Modal */}
        {isApproveModalOpen && selectedRequest && (
          <ApproveModal 
            request={selectedRequest}
            onClose={() => {
              setIsApproveModalOpen(false);
              setSelectedRequest(null);
            }}
            onApprove={() => approveRequest.mutate(selectedRequest.request_id)}
            isApproving={approveRequest.isPending}
          />
        )}

        {/* Why Modal */}
        {whyModalData && (
          <WhyModal 
            request={whyModalData.request}
            matchingStudent={whyModalData.matchingStudent}
            duplicateReason={whyModalData.reason}
            onClose={() => setWhyModalData(null)}
            onDeny={() => {
              setWhyModalData(null);
              denyRequest.mutate(whyModalData.request.request_id);
            }}
          />
        )}

        {/* Photo Viewer Modal */}
        {photoViewer && (
          <PhotoViewerModal 
            url={photoViewer.url}
            title={photoViewer.title}
            onClose={() => setPhotoViewer(null)}
          />
        )}
      </div>
    </div>
  );
}


// Simple fullscreen photo viewer modal
function PhotoViewerModal({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      <div className="flex items-center justify-between p-4">
        <h4 className="text-white text-sm font-medium">{title}</h4>
        <button onClick={onClose} className="text-white/80 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <img src={url} alt={title} className="max-h-full max-w-full object-contain rounded-lg shadow-xl" />
      </div>
    </div>
  );
}
// Individual request row component
function RequestRow({ 
  request, 
  onEdit,
  onApprove, 
  onDeny,
  onShowWhy,
  onViewPhoto
}: { 
  request: StudentRequest;
  onEdit: (request: StudentRequest) => void;
  onApprove: (request: StudentRequest) => void;
  onDeny: (requestId: string) => void;
  onShowWhy: (request: StudentRequest, matchingStudent: any, reason: string) => void;
  onViewPhoto: (url: string, title: string) => void;
}) {
  const [checking, setChecking] = useState(false);
  const [hasDuplicate, setHasDuplicate] = useState(false);
  const [duplicateReason, setDuplicateReason] = useState("");
  const [matchingStudent, setMatchingStudent] = useState<any>(null);

  // Use ref to track previous values and prevent infinite re-renders
  const prevMobileNumber = useRef(request.mobile_number);
  const prevNationalId = useRef(request.national_id);
  const hasInitialized = useRef(false);

  // Check for exact duplicates using the dedicated API endpoint
  useEffect(() => {
    const mobileChanged = prevMobileNumber.current !== request.mobile_number;
    const nationalIdChanged = prevNationalId.current !== request.national_id;
    
    // Only run if it's the first time or if mobile/national_id actually changed
    if (!hasInitialized.current || mobileChanged || nationalIdChanged) {
      const checkDuplicates = async () => {
        if (!request.mobile_number && !request.national_id) {
          // Reset duplicate state if no identifying info
          setHasDuplicate(false);
          setDuplicateReason("");
          setMatchingStudent(null);
          return;
        }
        
        setChecking(true);
        try {
          // Use the dedicated duplicate checking API
          const response = await fetch("/api/admin/students/check-duplicates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mobile_number: request.mobile_number,
              mobile_number2: request.mobile_number2,
              national_id: request.national_id
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            const { duplicates } = data;
            
            if (duplicates && duplicates.length > 0) {
              // Find exact matches first
              const exactMatch = duplicates.find((d: any) => 
                d.match_type === 'exact' && 
                (d.reason.includes('mobile') || d.reason.includes('national_id'))
              );
              
              if (exactMatch) {
                setHasDuplicate(true);
                setDuplicateReason(exactMatch.reason);
                setMatchingStudent(exactMatch.student);
              } else {
                // No exact duplicates found, reset state
                setHasDuplicate(false);
                setDuplicateReason("");
                setMatchingStudent(null);
              }
            } else {
              // No duplicates found, reset state
              setHasDuplicate(false);
              setDuplicateReason("");
              setMatchingStudent(null);
            }
          } else {
            console.error("Failed to check duplicates:", response.status, response.statusText);
            // Fallback to no duplicates if API fails
            setHasDuplicate(false);
            setDuplicateReason("");
            setMatchingStudent(null);
          }
        } catch (error) {
          console.error("Error checking duplicates:", error);
          // Fallback to no duplicates if API fails
          setHasDuplicate(false);
          setDuplicateReason("");
          setMatchingStudent(null);
        } finally {
          setChecking(false);
        }
      };

      checkDuplicates();
      
      // Update refs
      prevMobileNumber.current = request.mobile_number;
      prevNationalId.current = request.national_id;
      hasInitialized.current = true;
    }
  }, [request.mobile_number, request.national_id, request.mobile_number2]);

  return (
    <tr className={`hover:bg-gray-50 transition-colors ${hasDuplicate ? 'bg-red-50/50' : ''}`}>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <div>
            <div className="text-sm font-medium text-gray-900">{request.student_name}</div>
            <div className="text-sm text-gray-500">{request.address || 'No address'}</div>
            {(request.user_photo_url || request.national_id_photo_url) && (
              <div className="mt-2 flex items-center gap-2">
                {request.user_photo_url && (
                  <button
                    type="button"
                    onClick={() => onViewPhoto(request.user_photo_url!, 'Personal Photo')}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-xs border border-blue-200"
                    title="View personal photo"
                  >
                    <img src={request.user_photo_url} alt="User" className="w-6 h-6 rounded object-cover border" />
                    <span>Photo</span>
                  </button>
                )}
                {request.national_id_photo_url && (
                  <button
                    type="button"
                    onClick={() => onViewPhoto(request.national_id_photo_url!, 'National ID Photo')}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-md text-xs border border-purple-200"
                    title="View national ID photo"
                  >
                    <img src={request.national_id_photo_url} alt="National ID" className="w-6 h-6 rounded object-cover border" />
                    <span>ID</span>
                  </button>
                )}
              </div>
            )}
            {hasDuplicate && (
              <div className="text-xs text-red-600 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {duplicateReason}
              </div>
            )}
            {checking && (
              <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Checking for duplicates...
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{request.mobile_number}</div>
        {request.mobile_number2 && (
          <div className="text-sm text-gray-500">{request.mobile_number2}</div>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-gray-900">{request.national_id || '-'}</div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {new Date(request.created_at).toLocaleDateString()}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex items-center gap-2">
          {/* Edit Button */}
          <button
            onClick={() => onEdit(request)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-sm font-medium transition-all hover:shadow-sm"
            title="Edit request details"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>

          {hasDuplicate ? (
            <button
              onClick={() => onShowWhy(request, matchingStudent, duplicateReason)}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-sm font-medium transition-all hover:shadow-sm"
              title="Click to see why this request cannot be approved"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Why?
            </button>
          ) : (
            <button
              onClick={() => onApprove(request)}
              disabled={checking}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:shadow-sm ${
                checking
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200'
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
              }`}
              title={checking ? 'Checking for duplicates...' : 'Approve request'}
            >
              {checking ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {checking ? 'Checking...' : 'Approve'}
            </button>
          )}
          
          <button
            onClick={() => onDeny(request.request_id)}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-sm font-medium transition-all hover:shadow-sm"
            title="Deny request"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Deny
          </button>
        </div>
      </td>
    </tr>
  );
}

// Edit Request Modal Component
function EditRequestModal({
  request,
  onClose,
  onSave,
  isSaving
}: {
  request: StudentRequest;
  onClose: () => void;
  onSave: (data: Partial<StudentRequest>) => void;
  isSaving: boolean;
}) {
  // Simple state initialization - React will unmount/remount for different requests due to key prop
  const [formData, setFormData] = useState({
    student_name: request.student_name || "",
    mobile_number: request.mobile_number || "",
    mobile_number2: request.mobile_number2 || "",
    address: request.address || "",
    national_id: request.national_id || "",
    notes: request.notes || ""
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: Record<string, string> = {};
    
    if (!formData.student_name.trim()) {
      newErrors.student_name = "Student name is required";
    }
    
    if (!formData.mobile_number.trim()) {
      newErrors.mobile_number = "Mobile number is required";
    } else if (formData.mobile_number.replace(/\D/g, '').length < 10) {
      newErrors.mobile_number = "Please enter a valid mobile number";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave(formData);
  };

  const handleChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[95vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-8 py-6 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Edit Request</h3>
                <p className="text-gray-600">Modify student registration details</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Student Photo Section */}
        {request.user_photo_url && (
          <div className="px-8 py-6 bg-gradient-to-b from-gray-50 to-white border-b border-gray-200">
            <div className="flex justify-center">
              <div className="relative">
                <img 
                  src={request.user_photo_url} 
                  alt="Student Photo" 
                  className="w-32 h-32 object-cover rounded-2xl border-4 border-white shadow-xl ring-2 ring-gray-200"
                />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="text-center mt-3">
              <h4 className="text-lg font-semibold text-gray-900">{formData.student_name || request.student_name || 'Student'}</h4>
              <p className="text-sm text-gray-600">Student Registration Photo</p>
            </div>
          </div>
        )}

        {/* Form */}
        <div className="p-8 overflow-y-auto max-h-[calc(95vh-200px)]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Student Name */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Student Name *
                </label>
                <input
                  type="text"
                  value={formData.student_name}
                  onChange={handleChange('student_name')}
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                    errors.student_name ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="Enter student's full name"
                />
                {errors.student_name && (
                  <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.student_name}
                  </p>
                )}
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  value={formData.mobile_number}
                  onChange={handleChange('mobile_number')}
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                    errors.mobile_number ? 'border-red-300 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="Primary mobile number"
                />
                {errors.mobile_number && (
                  <p className="text-red-600 text-sm mt-1 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {errors.mobile_number}
                  </p>
                )}
              </div>

              {/* Alternative Mobile */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Alternative Mobile
                </label>
                <input
                  type="tel"
                  value={formData.mobile_number2}
                  onChange={handleChange('mobile_number2')}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Alternative mobile number"
                />
              </div>

              {/* National ID */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  National ID
                </label>
                <input
                  type="text"
                  value={formData.national_id}
                  onChange={handleChange('national_id')}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="National ID number"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={handleChange('address')}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Student's address"
                />
              </div>

              {/* Notes */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Admin Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={handleChange('notes')}
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                  placeholder="Add notes about this request (optional)"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-4">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-3 text-gray-700 hover:text-gray-900 font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving Changes...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Why Modal Component (outside table structure to avoid hydration errors)
function WhyModal({
  request,
  matchingStudent,
  duplicateReason,
  onClose,
  onDeny
}: {
  request: StudentRequest;
  matchingStudent: any;
  duplicateReason: string;
  onClose: () => void;
  onDeny: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Why Can't This Request Be Approved?</h3>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Reason */}
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h4 className="font-semibold text-red-800">{duplicateReason}</h4>
          </div>
        </div>

        {/* Comparison View */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* New Request */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Request
            </h4>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Name:</span> {request.student_name}</div>
              <div><span className="font-medium">Mobile:</span> {request.mobile_number}</div>
              {request.mobile_number2 && (
                <div><span className="font-medium">Mobile 2:</span> {request.mobile_number2}</div>
              )}
              <div><span className="font-medium">National ID:</span> {request.national_id || '-'}</div>
              <div><span className="font-medium">Address:</span> {request.address || '-'}</div>
              <div><span className="font-medium">Submitted:</span> {new Date(request.created_at).toLocaleString()}</div>
            </div>
          </div>

          {/* Existing Student */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <h4 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Existing Student
            </h4>
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Code:</span> {matchingStudent.code}</div>
              <div><span className="font-medium">Name:</span> {matchingStudent.student_name || '-'}</div>
              <div className={duplicateReason.includes('Mobile') ? 'bg-red-200 px-2 py-1 rounded font-semibold' : ''}>
                <span className="font-medium">Mobile:</span> {matchingStudent.mobile_number || '-'}
              </div>
              {matchingStudent.mobile_number2 && (
                <div className={duplicateReason.includes('Mobile') ? 'bg-red-200 px-2 py-1 rounded font-semibold' : ''}>
                  <span className="font-medium">Mobile 2:</span> {matchingStudent.mobile_number2}
                </div>
              )}
              <div className={duplicateReason.includes('National ID') ? 'bg-red-200 px-2 py-1 rounded font-semibold' : ''}>
                <span className="font-medium">National ID:</span> {matchingStudent.national_id || '-'}
              </div>
              <div><span className="font-medium">Address:</span> {matchingStudent.address || '-'}</div>
              <div><span className="font-medium">Created:</span> {matchingStudent.student_created_at ? new Date(matchingStudent.student_created_at).toLocaleString() : '-'}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onDeny}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Deny This Request
          </button>
        </div>
      </div>
    </div>
  );
}

// Approve confirmation modal
function ApproveModal({ 
  request, 
  onClose, 
  onApprove, 
  isApproving 
}: {
  request: StudentRequest;
  onClose: () => void;
  onApprove: () => void;
  isApproving: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Approve Student Request</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Request Details */}
        <div className="mb-6 p-4 bg-gray-50 rounded-xl">
          <h4 className="font-semibold text-gray-800 mb-2">Student Details</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-600">Name:</span> {request.student_name}</div>
            <div><span className="text-gray-600">Mobile:</span> {request.mobile_number}</div>
            <div><span className="text-gray-600">National ID:</span> {request.national_id || '-'}</div>
            <div><span className="text-gray-600">Address:</span> {request.address || '-'}</div>
          </div>

          {(request.user_photo_url || request.national_id_photo_url) && (
            <div className="mt-4">
              <h5 className="text-sm font-medium text-gray-800 mb-2">Uploaded Photos</h5>
              <div className="flex items-center gap-3">
                {request.user_photo_url && (
                  <div className="flex items-center gap-2">
                    <img src={request.user_photo_url} alt="User" className="w-16 h-16 rounded-lg object-cover border" />
                    <span className="text-xs text-gray-600">Personal Photo</span>
                  </div>
                )}
                {request.national_id_photo_url && (
                  <div className="flex items-center gap-2">
                    <img src={request.national_id_photo_url} alt="National ID" className="w-24 h-16 rounded-lg object-cover border" />
                    <span className="text-xs text-gray-600">National ID</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            disabled={isApproving}
          >
            Cancel
          </button>
          <button
            onClick={onApprove}
            disabled={isApproving}
            className="px-6 py-2 rounded-lg text-white font-medium transition-colors bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isApproving ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Approving...
              </span>
            ) : (
              'Approve Request'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

