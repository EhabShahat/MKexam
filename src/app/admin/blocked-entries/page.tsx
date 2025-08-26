"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";

interface BlockedEntry {
  id: string;
  type: "name" | "ip" | "mobile";
  value: string;
  reason?: string;
  created_at: string;
  created_by: string;
}

export default function BlockedEntriesPage() {
  const [newType, setNewType] = useState<"name" | "ip" | "mobile">("name");
  const [newValue, setNewValue] = useState("");
  const [newReason, setNewReason] = useState("");
  const [showForm, setShowForm] = useState(false);

  const toast = useToast();
  const queryClient = useQueryClient();

  // Query blocked entries
  const { data: blockedEntries = [], isLoading, error } = useQuery({
    queryKey: ["blocked-entries"],
    queryFn: async () => {
      const response = await authFetch("/api/admin/blocked-entries");
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch blocked entries");
      }
      return response.json();
    },
  });

  // Add blocked entry mutation
  const addMutation = useMutation({
    mutationFn: async (data: { type: "name" | "ip" | "mobile"; value: string; reason?: string }) => {
      const response = await authFetch("/api/admin/blocked-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add blocked entry");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-entries"] });
      setNewValue("");
      setNewReason("");
      setShowForm(false);
      toast.success({ title: "Success", message: "Entry blocked successfully" });
    },
    onError: (error: Error) => {
      toast.error({ title: "Error", message: error.message });
    },
  });

  // Remove blocked entry mutation
  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await authFetch(`/api/admin/blocked-entries/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to remove blocked entry");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["blocked-entries"] });
      toast.success({ title: "Success", message: "Entry unblocked successfully" });
    },
    onError: (error: Error) => {
      toast.error({ title: "Error", message: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    
    addMutation.mutate({
      type: newType,
      value: newValue.trim(),
      reason: newReason.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Blocked Entries</h1>
        <p className="text-gray-600 mt-1">
          Manage blocked students, IP addresses, and mobile numbers
        </p>
      </div>

      {/* Add New Block Form */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Add New Block</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn btn-danger"
          >
            {showForm ? "Cancel" : "Add Block"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Block Type
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as "name" | "ip" | "mobile")}
                  className="input"
                >
                  <option value="name">Student Name</option>
                  <option value="ip">IP Address</option>
                  <option value="mobile">Mobile Number</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {newType === "name" ? "Student Name" : newType === "ip" ? "IP Address" : "Mobile Number"}
                </label>
                <input
                  type={newType === "mobile" ? "tel" : "text"}
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  placeholder={
                    newType === "name" 
                      ? "Enter student name..." 
                      : newType === "ip" 
                      ? "Enter IP address..." 
                      : "Enter mobile number..."
                  }
                  className="input"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (Optional)
              </label>
              <input
                type="text"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Why is this being blocked?"
                className="input"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addMutation.isPending}
                className="btn btn-danger"
              >
                {addMutation.isPending ? "Adding..." : "Block Entry"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Blocked Entries List */}
      <div className="card">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Blocked Entries ({blockedEntries.length})
          </h2>
        </div>
        
        {error ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Database Setup Required</h3>
            <p className="text-gray-600 mb-4">
              The blocked entries table hasn't been created yet.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left max-w-2xl mx-auto">
              <p className="text-sm text-gray-700 mb-2">
                <strong>To set up the blocked entries feature:</strong>
              </p>
              <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
                <li>Go to your Supabase dashboard</li>
                <li>Navigate to the SQL Editor</li>
                <li>Copy and paste the contents of <code>scripts/setup-easter-egg.sql</code></li>
                <li>Run the script</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </div>
        ) : isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading blocked entries...</p>
          </div>
        ) : blockedEntries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">🚫</div>
            <p>No entries are currently blocked</p>
          </div>
        ) : (
          <div className="space-y-4">
            {blockedEntries.map((entry: BlockedEntry) => (
              <div key={entry.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        entry.type === "name" 
                          ? "bg-blue-100 text-blue-800" 
                          : entry.type === "ip"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-green-100 text-green-800"
                      }`}>
                        {entry.type === "name" ? "👤 Name" : entry.type === "ip" ? "🌐 IP" : "📱 Mobile"}
                      </span>
                      <span className="font-medium text-gray-900">
                        {entry.value}
                      </span>
                    </div>
                    {entry.reason && (
                      <p className="text-sm text-gray-600 mb-2">
                        <strong>Reason:</strong> {entry.reason}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">
                      Blocked on {new Date(entry.created_at).toLocaleString()} by {entry.created_by}
                    </p>
                  </div>
                  <button
                    onClick={() => removeMutation.mutate(entry.id)}
                    disabled={removeMutation.isPending}
                    className="btn btn-secondary btn-sm"
                  >
                    {removeMutation.isPending ? "..." : "Unblock"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              How Blocking Works
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Name blocking:</strong> Prevents students with matching names from accessing exams</li>
                <li><strong>IP blocking:</strong> Blocks access from specific IP addresses</li>
                <li><strong>Mobile blocking:</strong> Blocks students by mobile number (only works with student codes)</li>
                <li>Blocks take effect immediately and are logged in the audit trail</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}