// This is the new sidebar split layout for EditStudentModal
// Copy this to replace the existing EditStudentModal in page.tsx (lines 1259-1630)

// Edit Student Modal Component - Sidebar Split Layout (Option 2)
function EditStudentModal({
  student,
  onClose,
  onSave,
  onResetAttempts,
  onDelete,
  onImageClick,
  isSaving,
  isResetting,
  isDeleting,
}: {
  student: Student;
  onClose: () => void;
  onSave: (studentId: string, payload: Partial<Student>) => void;
  onResetAttempts: (studentId: string) => void;
  onDelete: (studentId: string) => void;
  onImageClick: (url: string, title: string) => void;
  isSaving: boolean;
  isResetting: boolean;
  isDeleting: boolean;
}) {
  const [formData, setFormData] = useState({
    student_name: student.student_name || "",
    mobile_number: student.mobile_number || "",
    mobile_number2: student.mobile_number2 || "",
    address: student.address || "",
    national_id: student.national_id || "",
  });
  
  const [photoPreview, setPhotoPreview] = useState<string | null>(student.photo_url || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [nationalIdPhotoPreview, setNationalIdPhotoPreview] = useState<string | null>(student.national_id_photo_url || null);
  const [nationalIdPhotoFile, setNationalIdPhotoFile] = useState<File | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    const originalData = {
      student_name: student.student_name || "",
      mobile_number: student.mobile_number || "",
      mobile_number2: student.mobile_number2 || "",
      address: student.address || "",
      national_id: student.national_id || "",
    };
    
    const dataChanged = JSON.stringify(formData) !== JSON.stringify(originalData);
    const photoChanged = photoFile !== null;
    const nationalIdChanged = nationalIdPhotoFile !== null;
    
    setHasChanges(dataChanged || photoChanged || nationalIdChanged);
  }, [formData, photoFile, nationalIdPhotoFile, student]);

  const handleChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Photo must be less than 5MB");
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNationalIdPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("Photo must be less than 5MB");
        return;
      }
      setNationalIdPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNationalIdPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (hasChanges) {
      // For now, just save the text fields. Photo upload would need backend support
      onSave(student.student_id, formData);
      // TODO: Handle photo uploads separately if backend supports it
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-5xl h-[95vh] overflow-hidden shadow-2xl flex flex-col md:flex-row">
        
        {/* LEFT SIDEBAR */}
        <div className="w-full md:w-80 bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50 border-r border-gray-200 flex flex-col overflow-y-auto">
          
          {/* Close Button - Top Right */}
          <div className="absolute top-4 right-4 md:relative md:top-0 md:right-0 md:flex md:justify-end md:p-4 z-10">
            <button 
              onClick={onClose}
              className="p-2 bg-white/80 hover:bg-white rounded-lg transition-colors shadow-md"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Photo Section */}
          <div className="p-6 flex flex-col items-center space-y-4">
            {/* Student Photo */}
            <div className="relative">
              {photoPreview ? (
                <button
                  onClick={() => photoPreview && onImageClick(photoPreview, student.student_name || "Student Photo")}
                  className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-white shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
                >
                  <img 
                    src={photoPreview} 
                    alt={student.student_name || "Student"} 
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center border-4 border-white shadow-lg">
                  <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              {/* Photo Upload Button */}
              <label 
                htmlFor="photo-upload"
                className="absolute bottom-0 right-0 bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-full shadow-lg cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Student Code */}
            <div className="text-center">
              <span className="px-4 py-2 bg-white rounded-xl font-mono font-bold text-xl text-indigo-700 shadow-md">
                #{student.code}
              </span>
            </div>
            
            {/* Student Name */}
            <h3 className="text-xl font-bold text-gray-900 text-center">
              {student.student_name || "No Name"}
            </h3>
          </div>

          {/* Stats Section */}
          <div className="px-6 py-4 bg-white/50 border-y border-gray-200">
            <h4 className="text-sm font-semibold text-gray-600 mb-3">📊 Quick Stats</h4>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total</span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                  {student.total_exams_attempted || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Completed</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                  {student.completed_exams || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">In Progress</span>
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                  {student.in_progress_exams || 0}
                </span>
              </div>
            </div>
          </div>

          {/* National ID Photo Section */}
          <div className="px-6 py-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">🆔 National ID Card Photo</h4>
            <div className="relative">
              {nationalIdPhotoPreview ? (
                <button
                  onClick={() => nationalIdPhotoPreview && onImageClick(nationalIdPhotoPreview, "National ID Card")}
                  className="w-full h-32 rounded-xl overflow-hidden border-2 border-gray-200 shadow hover:shadow-lg transition-all"
                >
                  <img 
                    src={nationalIdPhotoPreview} 
                    alt="National ID" 
                    className="w-full h-full object-cover"
                  />
                </button>
              ) : (
                <div className="w-full h-32 rounded-xl bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                    </svg>
                    <p className="text-xs text-gray-500">No ID card photo</p>
                  </div>
                </div>
              )}
              <label 
                htmlFor="national-id-upload"
                className="absolute bottom-2 right-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg cursor-pointer transition-colors text-sm font-medium shadow"
              >
                Upload
                <input
                  id="national-id-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleNationalIdPhotoChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-6 mt-auto space-y-2">
            <button
              onClick={() => onResetAttempts(student.student_id)}
              disabled={isResetting || (student.total_exams_attempted || 0) === 0}
              className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
              title={(student.total_exams_attempted || 0) === 0 ? "No attempts to reset" : "Reset attempts"}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isResetting ? "Resetting..." : "Reset Attempts"}
            </button>
            
            <button
              onClick={() => onDelete(student.student_id)}
              disabled={isDeleting}
              className="w-full px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {isDeleting ? "Deleting..." : "Delete Student"}
            </button>
          </div>
        </div>

        {/* RIGHT MAIN CONTENT */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-2xl font-bold text-gray-900">Edit Student Information</h2>
            <p className="text-sm text-gray-600 mt-1">Update student details below</p>
          </div>

          {/* Form Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="space-y-5">
              {/* Student Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Student Name *
                </label>
                <input
                  type="text"
                  value={formData.student_name}
                  onChange={handleChange('student_name')}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Enter student's full name"
                />
              </div>

              {/* Mobile Numbers Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Mobile Number *
                  </label>
                  <input
                    type="tel"
                    value={formData.mobile_number}
                    onChange={handleChange('mobile_number')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Primary mobile"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Alternative Mobile
                  </label>
                  <input
                    type="tel"
                    value={formData.mobile_number2}
                    onChange={handleChange('mobile_number2')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Alternative mobile"
                  />
                </div>
              </div>

              {/* National ID & Address Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    National ID
                  </label>
                  <input
                    type="text"
                    value={formData.national_id}
                    onChange={handleChange('national_id')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="National ID number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={handleChange('address')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Student's address"
                  />
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-900">Photo Upload Note</p>
                    <p className="text-sm text-blue-700 mt-1">
                      Photo changes will be previewed but require backend support to save permanently.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer - Save/Cancel */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-2.5 text-gray-700 hover:text-gray-900 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {hasChanges ? "Save Changes" : "No Changes"}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
