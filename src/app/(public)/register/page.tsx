"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useStudentLocale } from "@/components/public/PublicLocaleProvider";
import { t } from "@/i18n/student";

interface DuplicateInfo {
  existingStudents: Array<{
    student_id: string;
    student_name: string;
    mobile_number: string;
    national_id: string;
    code: string;
  }>;
  existingRequests: Array<{
    request_id: string;
    student_name: string;
    mobile_number: string;
    national_id: string;
  }>;
}

export default function RegisterPage() {
  const { locale } = useStudentLocale();
  const [formData, setFormData] = useState({
    student_name: "",
    mobile_number: "",
    mobile_number2: "",
    address: "",
    national_id: "",
  });

  const [userPhoto, setUserPhoto] = useState<File | null>(null);
  const [nationalIdPhoto, setNationalIdPhoto] = useState<File | null>(null);
  const [userPhotoPreview, setUserPhotoPreview] = useState<string>("");
  const [nationalIdPhotoPreview, setNationalIdPhotoPreview] = useState<string>("");

  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  // Submit form mutation
  const submitForm = useMutation({
    mutationFn: async (data: typeof formData) => {
      const formDataWithFiles = new FormData();
      
      // Add text fields
      Object.entries(data).forEach(([key, value]) => {
        formDataWithFiles.append(key, value);
      });
      
      // Add photos if selected
      if (userPhoto) {
        formDataWithFiles.append('user_photo', userPhoto);
      }
      if (nationalIdPhoto) {
        formDataWithFiles.append('national_id_photo', nationalIdPhoto);
      }
      
      const response = await fetch("/api/admin/requests", {
        method: "POST",
        body: formDataWithFiles, // Remove Content-Type header to let browser set it with boundary
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit request");
      }
      
      return response.json();
    },
    onSuccess: () => {
      setSuccess(true);
      setFormData({
        student_name: "",
        mobile_number: "",
        mobile_number2: "",
        address: "",
        national_id: "",
      });
      setUserPhoto(null);
      setNationalIdPhoto(null);
      setUserPhotoPreview("");
      setNationalIdPhotoPreview("");
      setDuplicateInfo(null);
    },
    onError: (error: Error) => {
      setErrors({ submit: error.message });
    }
  });

  // Check for duplicates when mobile number or national ID changes
  useEffect(() => {
    const checkDuplicates = async () => {
      if (!formData.mobile_number || formData.mobile_number.length < 10) {
        setDuplicateInfo(null);
        return;
      }

      setCheckingDuplicates(true);
      try {
        const response = await fetch("/api/public/check-duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mobile_number: formData.mobile_number,
            national_id: formData.national_id,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setDuplicateInfo(data);
        }
      } catch (error) {
        console.error("Error checking duplicates:", error);
      } finally {
        setCheckingDuplicates(false);
      }
    };

    const timeoutId = setTimeout(checkDuplicates, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.mobile_number, formData.national_id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setErrors({});

    // Validation
    const newErrors: Record<string, string> = {};
    
    if (!formData.student_name.trim()) {
      newErrors.student_name = t(locale, "student_name_required_error");
    }
    
    if (!formData.mobile_number.trim()) {
      newErrors.mobile_number = t(locale, "mobile_required_error");
    } else if (formData.mobile_number.replace(/\D/g, '').length < 10) {
      newErrors.mobile_number = t(locale, "valid_mobile_error");
    }
    
    if (!formData.mobile_number2.trim()) {
      newErrors.mobile_number2 = t(locale, "alternative_mobile_required_error");
    }
    
    if (!formData.address.trim()) {
      newErrors.address = t(locale, "address_required_error");
    }
    
    if (!formData.national_id.trim()) {
      newErrors.national_id = t(locale, "national_id_required_error");
    }
    
    if (!userPhoto) {
      newErrors.user_photo = t(locale, "personal_photo_required_error");
    }
    
    if (!nationalIdPhoto) {
      newErrors.national_id_photo = t(locale, "national_id_photo_required_error");
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Check for exact duplicates
    const hasExactDuplicates = 
      duplicateInfo?.existingStudents.some(s => 
        s.mobile_number === formData.mobile_number.replace(/\D/g, '') ||
        (formData.national_id && s.national_id === formData.national_id)
      ) ||
      duplicateInfo?.existingRequests.some(r => 
        r.mobile_number === formData.mobile_number.replace(/\D/g, '') ||
        (formData.national_id && r.national_id === formData.national_id)
      );

    if (hasExactDuplicates) {
      setErrors({ submit: t(locale, "duplicate_info_error") });
      return;
    }

    submitForm.mutate(formData);
  };

  const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const handlePhotoChange = (photoType: 'user' | 'national_id') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrors(prev => ({ ...prev, [photoType + '_photo']: t(locale, "valid_image_error") }));
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, [photoType + '_photo']: t(locale, "file_size_error") }));
        return;
      }

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (photoType === 'user') {
          setUserPhoto(file);
          setUserPhotoPreview(result);
        } else {
          setNationalIdPhoto(file);
          setNationalIdPhotoPreview(result);
        }
      };
      reader.readAsDataURL(file);
      
      // Clear any previous errors
      setErrors(prev => ({ ...prev, [photoType + '_photo']: "" }));
    }
  };

  const removePhoto = (photoType: 'user' | 'national_id') => {
    if (photoType === 'user') {
      setUserPhoto(null);
      setUserPhotoPreview("");
    } else {
      setNationalIdPhoto(null);
      setNationalIdPhotoPreview("");
    }
    setErrors(prev => ({ ...prev, [photoType + '_photo']: "" }));
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">{t(locale, "request_submitted")}</h2>
            <p className="text-gray-600 mb-6">
              {t(locale, "request_submitted_message")}
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setSuccess(false)}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
              >
                {t(locale, "submit_another_request")}
              </button>
              <Link
                href="/"
                className="block w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors text-center"
              >
                {t(locale, "back_to_home")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{t(locale, "student_registration")}</h1>
          
        </div>

        {/* Registration Form */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 shadow-lg p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Student Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t(locale, "student_name_required")}
                </label>
                <input
                  type="text"
                  value={formData.student_name}
                  onChange={handleInputChange('student_name')}
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                    errors.student_name ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'
                  }`}
                  placeholder={t(locale, "enter_full_name")}
                />
                {errors.student_name && (
                  <p className="text-red-600 text-sm mt-1">{errors.student_name}</p>
                )}
              </div>

              {/* Mobile Number */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t(locale, "mobile_number_required")}
                </label>
                <input
                  type="tel"
                  value={formData.mobile_number}
                  onChange={handleInputChange('mobile_number')}
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                    errors.mobile_number ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'
                  }`}
                  placeholder={t(locale, "enter_mobile_number")}
                />
                {checkingDuplicates && (
                  <div className="absolute right-3 top-11 text-gray-400">
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
                {errors.mobile_number && (
                  <p className="text-red-600 text-sm mt-1">{errors.mobile_number}</p>
                )}
              </div>

              {/* Alternative Mobile */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t(locale, "alternative_mobile")}
                </label>
                <input
                  type="tel"
                  value={formData.mobile_number2}
                  onChange={handleInputChange('mobile_number2')}
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                    errors.mobile_number2 ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'
                  }`}
                  placeholder={t(locale, "enter_alternative_mobile")}
                />
                {errors.mobile_number2 && (
                  <p className="text-red-600 text-sm mt-1">{errors.mobile_number2}</p>
                )}
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t(locale, "address_field")}
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={handleInputChange('address')}
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                    errors.address ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'
                  }`}
                  placeholder={t(locale, "enter_address")}
                />
                {errors.address && (
                  <p className="text-red-600 text-sm mt-1">{errors.address}</p>
                )}
              </div>

              {/* National ID */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t(locale, "national_id_field")}
                </label>
                <input
                  type="text"
                  value={formData.national_id}
                  onChange={handleInputChange('national_id')}
                  className={`w-full px-4 py-3 bg-gray-50 border rounded-xl focus:ring-2 focus:border-transparent transition-all ${
                    errors.national_id ? 'border-red-300 focus:ring-red-500' : 'border-gray-200 focus:ring-blue-500'
                  }`}
                  placeholder={t(locale, "enter_national_id")}
                />
                {errors.national_id && (
                  <p className="text-red-600 text-sm mt-1">{errors.national_id}</p>
                )}
              </div>

              {/* User Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t(locale, "personal_photo")}
                </label>
                <div className={`space-y-3 ${errors.user_photo ? 'border border-red-300 rounded-xl p-3 bg-red-50' : ''}`}>
                  {userPhotoPreview ? (
                    <div className="relative">
                      <img 
                        src={userPhotoPreview} 
                        alt="User preview" 
                        className="w-32 h-32 object-cover rounded-xl border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto('user')}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <p className="text-xs text-gray-500">{t(locale, "no_photo")}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      id="user_photo"
                      accept="image/*"
                      onChange={handlePhotoChange('user')}
                      className="hidden"
                    />
                    <label
                      htmlFor="user_photo"
                      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg font-medium transition-colors text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {t(locale, "upload_personal_photo")}
                    </label>
                  </div>
                  {errors.user_photo && (
                    <p className="text-red-600 text-sm font-medium">{errors.user_photo}</p>
                  )}
                  <p className={`text-xs ${errors.user_photo ? 'text-red-600' : 'text-gray-500'}`}>{t(locale, "photo_size_limit")}</p>
                </div>
              </div>

              {/* National ID Photo Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t(locale, "national_id_photo")}
                </label>
                <div className={`space-y-3 ${errors.national_id_photo ? 'border border-red-300 rounded-xl p-3 bg-red-50' : ''}`}>
                  {nationalIdPhotoPreview ? (
                    <div className="relative">
                      <img 
                        src={nationalIdPhotoPreview} 
                        alt="National ID preview" 
                        className="w-full max-w-sm h-32 object-cover rounded-xl border-2 border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto('national_id')}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-sm transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="w-full max-w-sm h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center">
                      <div className="text-center">
                        <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0v10a2 2 0 01-2 2H9a2 2 0 01-2-2V4m0 0H5a1 1 0 00-1 1v12a2 2 0 002 2h12a2 2 0 002-2V5a1 1 0 00-1-1h-2z" />
                        </svg>
                        <p className="text-xs text-gray-500">{t(locale, "no_id_photo")}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      id="national_id_photo"
                      accept="image/*"
                      onChange={handlePhotoChange('national_id')}
                      className="hidden"
                    />
                    <label
                      htmlFor="national_id_photo"
                      className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg font-medium transition-colors text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {t(locale, "upload_national_id_photo")}
                    </label>
                  </div>
                  {errors.national_id_photo && (
                    <p className="text-red-600 text-sm font-medium">{errors.national_id_photo}</p>
                  )}
                  <p className={`text-xs ${errors.national_id_photo ? 'text-red-600' : 'text-gray-500'}`}>{t(locale, "id_photo_instructions")}</p>
                </div>
              </div>


              {/* Submit Error */}
              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-red-700 text-sm">{errors.submit}</p>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Link
                  href="/"
                  className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors text-center"
                >
                  {t(locale, "cancel")}
                </Link>
                <button
                  type="submit"
                  disabled={submitForm.isPending}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
                >
                  {submitForm.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {t(locale, "submitting_dots")}
                    </span>
                  ) : (
                    t(locale, "submit_registration")
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
