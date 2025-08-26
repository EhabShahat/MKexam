"use client";

import { useState, useEffect } from "react";
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

export default function EasterEggPage() {
  const [newType, setNewType] = useState<"name" | "ip" | "mobile">("name");
  const [newValue, setNewValue] = useState("");
  const [newReason, setNewReason] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  // ALL HOOKS MUST BE AT THE TOP LEVEL - NO CONDITIONAL HOOKS!
  const toast = useToast();
  const queryClient = useQueryClient();

  // Check if already authenticated on page load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await authFetch("/api/admin/blocked-entries");
        if (response.ok) {
          setAuthenticated(true);
        }
      } catch (error) {
        // Not authenticated, that's fine
      } finally {
        setCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  // Query blocked entries - only enabled when authenticated
  const { data: blockedEntries = [], isLoading } = useQuery({
    queryKey: ["blocked-entries"],
    queryFn: async () => {
      const response = await authFetch("/api/admin/blocked-entries");
      if (!response.ok) throw new Error("Failed to fetch blocked entries");
      return response.json();
    },
    enabled: authenticated, // Only run query when authenticated
  });

  // Add blocked entry mutation - MUST BE AT TOP LEVEL
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

  // Remove blocked entry mutation - MUST BE AT TOP LEVEL
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

  // Authentication with backend
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch("/api/easter-egg/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setAuthenticated(true);
        toast.success({ title: "Success", message: "🥚 Welcome to the easter egg panel!" });
      } else {
        toast.error({ title: "Error", message: "🥚 Wrong password! Try again..." });
      }
    } catch (error) {
      toast.error({ title: "Error", message: "Authentication failed" });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    
    addMutation.mutate({
      type: newType,
      value: newValue.trim(),
      reason: newReason.trim() || undefined,
    });
  };

  // Add logout function
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setAuthenticated(false);
      setPassword("");
      toast.success({ title: "Success", message: "Logged out successfully" });
    } catch (error) {
      // Ignore logout errors
    }
  };

  // Show loading state while checking authentication
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md w-full mx-4 border border-white/20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white">Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  // Conditional rendering - but all hooks are already called above
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md w-full mx-4 border border-white/20">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🥚</div>
            <h1 className="text-2xl font-bold text-white mb-2">
              Secret Access Required
            </h1>
            <p className="text-white/70 text-sm">
              Enter the easter egg password to continue
            </p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
              required
            />
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition-all"
            >
              🔓 Unlock Easter Egg
            </button>
          </form>
          <p className="text-center text-white/50 text-xs mt-4">
            Hint: It's either "easteregg2024" or "admin123" 😉
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header with Easter Egg Theme */}
        <div className="text-center mb-8">
          <div className="flex justify-end mb-4">
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
            >
              Logout
            </button>
          </div>
          <div className="text-6xl mb-4">🥚</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Easter Egg Admin Panel
          </h1>
          <p className="text-gray-600">
            Secret admin tools for blocking attempts by name, IP, or mobile number
          </p>
        </div>

        {/* Add New Block Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Block New Entry</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addMutation.isPending}
                  className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {addMutation.isPending ? "Adding..." : "Block Entry"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Blocked Entries List */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Blocked Entries ({blockedEntries.length})
            </h2>
          </div>
          
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading blocked entries...</p>
            </div>
          ) : blockedEntries.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-4">🎯</div>
              <p>No entries are currently blocked</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {blockedEntries.map((entry: BlockedEntry) => (
                <div key={entry.id} className="p-6 hover:bg-gray-50">
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
                      className="ml-4 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      {removeMutation.isPending ? "..." : "Unblock"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>🤫 This is a secret admin panel. Keep it between us!</p>
        </div>
      </div>
    </div>
  );
}