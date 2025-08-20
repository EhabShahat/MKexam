"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, Fragment } from "react";
import { authFetch } from "@/lib/authFetch";
import { useToast } from "@/components/ToastProvider";
import ModernCard from "@/components/admin/ModernCard";
import ModernTable from "@/components/admin/ModernTable";
import ActionButton from "@/components/admin/ActionButton";
import LogoUpload from "@/components/admin/LogoUpload";

type AppSettings = {
  id?: string;
  brand_name?: string | null;
  brand_logo_url?: string | null;
  default_language?: string | null;
  whatsapp_default_template?: string | null;
  welcome_instructions?: string | null;
  welcome_instructions_ar?: string | null;
  thank_you_title?: string | null;
  thank_you_title_ar?: string | null;
  thank_you_message?: string | null;
  thank_you_message_ar?: string | null;
  enable_name_search?: boolean;
  enable_code_search?: boolean;
};

type AdminUser = {
  user_id: string;
  username: string | null;
  email: string | null;
};

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  
  // Enhanced state management
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'branding' | 'messaging' | 'admins'>('general');
  const [showNewAdminForm, setShowNewAdminForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState("");
  
  // Form state for new admin creation
  const [newUsername, setNewUsername] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Enhanced validation
  const isValidNewEmail = !newEmail.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim());
  const hasUsernameOrEmail = !!(newUsername.trim() || newEmail.trim());
  const isFormValid = hasUsernameOrEmail && newPassword.length >= 8 && isValidNewEmail;

  const settingsQuery = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/settings");
      const result = await res.json();
      if (res.status === 501 && result?.error === "not_configured") {
        return { notConfigured: true };
      }
      if (!res.ok) throw new Error(result?.error || "Load failed");
      return { item: result.item as AppSettings | null };
    },
  });

  

  const adminsQuery = useQuery({
    queryKey: ["admin", "admins"],
    queryFn: async () => {
      const res = await authFetch("/api/admin/admins");
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Load failed");
      return (result.items as AdminUser[]) || [];
    },
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const settings = localSettings ?? settingsQuery.data?.item ?? {};
      const res = await authFetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Save failed");
      return result.item as AppSettings;
    },
    onSuccess: (savedSettings) => {
      setLocalSettings(savedSettings);
      queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success({ title: "Settings Saved", message: "Your changes have been saved successfully" });
    },
    onError: (error: any) => {
      toast.error({ title: "Save Failed", message: error.message || "Unknown error" });
    },
  });



  const addAdminMutation = useMutation({
    mutationFn: async () => {
      const email = newEmail.trim();
      if (!email) throw new Error("Email is required");
      
      const res = await authFetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Add failed");
      return result.item as { user_id: string; email: string };
    },
    onSuccess: () => {
      setNewEmail("");
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
      toast.success({ title: "Admin Added", message: "User has been granted admin access" });
    },
    onError: (error: any) => {
      toast.error({ title: "Add Admin Failed", message: error.message || "Unknown error" });
    },
  });

  // Create new admin account mutation
  const createUserMutation = useMutation({
    mutationFn: async () => {
      const username = newUsername.trim();
      const email = newEmail.trim();
      const password = newPassword;
      
      if (!username && !email) throw new Error("Username or email is required");
      if (!password || password.length < 8) throw new Error("Password must be at least 8 characters");
      
      const res = await authFetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, is_admin: true }),
      });
      
      const result = await res.json();
      if (!res.ok) {
        if (result?.error === "duplicate_username") throw new Error("Username already exists");
        if (result?.error === "duplicate_email") throw new Error("Email already exists");
        if (result?.error === "weak_password") throw new Error("Password is too weak");
        throw new Error(result?.error || "Creation failed");
      }
      return result.item;
    },
    onSuccess: () => {
      setNewUsername("");
      setNewEmail("");
      setNewPassword("");
      setShowNewAdminForm(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
      toast.success({ title: "Admin Created", message: "New admin account has been created successfully" });
    },
    onError: (error: any) => {
      toast.error({ title: "Creation Failed", message: error.message || "Unknown error" });
    },
  });

  const removeAdminMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await authFetch(`/api/admin/admins/${userId}`, { method: "DELETE" });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Remove failed");
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
      toast.success({ title: "Admin Removed", message: "Admin access has been revoked" });
    },
    onError: (error: any) => {
      toast.error({ title: "Remove Failed", message: error.message || "Unknown error" });
    },
  });

  const updateAdminMutation = useMutation({
    mutationFn: async ({ userId, email }: { userId: string; email: string }) => {
      const res = await authFetch(`/api/admin/admins/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Update failed");
      return result.item as AdminUser;
    },
    onSuccess: () => {
      setEditingUserId(null);
      setEditEmail("");
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
      toast.success({ title: "Admin Updated", message: "Admin email has been changed" });
    },
    onError: (error: any) => {
      toast.error({ title: "Update Failed", message: error.message || "Unknown error" });
    },
  });

  const currentSettings = localSettings ?? settingsQuery.data?.item ?? {};

  const updateSetting = (key: keyof AppSettings, value: any) => {
    setLocalSettings({ ...currentSettings, [key]: value });
  };

  const derivedSearchMode: "name" | "code" =
    currentSettings.enable_code_search && currentSettings.enable_name_search === false ? "code" : "name";

  const setSearchMode = (mode: "name" | "code") => {
    if (mode === "name") {
      setLocalSettings({ ...currentSettings, enable_name_search: true, enable_code_search: false });
    } else {
      setLocalSettings({ ...currentSettings, enable_name_search: false, enable_code_search: true });
    }
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48"></div>
        <div className="skeleton h-64 rounded-lg"></div>
      </div>
    );
  }

  if (settingsQuery.error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <ModernCard>
          <div className="text-center text-red-600">
            <p className="font-semibold">Error loading settings</p>
            <p className="text-sm mt-1">{(settingsQuery.error as any).message}</p>
          </div>
        </ModernCard>
      </div>
    );
  }

  if ((settingsQuery.data as any)?.notConfigured) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <ModernCard>
          <div className="text-center py-8">
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Settings Not Configured</h3>
            <p className="text-gray-600 mb-4">
              The settings backend is not configured. Create a table named <code className="bg-gray-100 px-2 py-1 rounded">app_settings</code> with a single row to store global configuration.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <p className="font-medium text-gray-900 mb-2">Required fields:</p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• brand_name (text)</li>
                <li>• brand_logo_url (text)</li>
                <li>• default_language (text)</li>
                <li>• whatsapp_default_template (text)</li>
              </ul>
            </div>
          </div>
        </ModernCard>
      </div>
    );
  }

  const adminColumns = [
    { key: "username", label: "Username", width: "200px" },
    { key: "email", label: "Email Address" },
    { key: "user_id", label: "User ID", width: "200px" },
    { key: "actions", label: "Actions", width: "200px" },
  ];

  const renderAdminCell = (admin: AdminUser, column: any) => {
    if (editingUserId === admin.user_id) {
      switch (column.key) {
        case "email":
          return (
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="user@example.com"
            />
          );
        case "username":
          return admin.username ? (
            <code className="bg-gray-100 px-2 py-1 rounded text-xs">{admin.username}</code>
          ) : (
            <span className="text-gray-400">No username</span>
          );
        case "user_id":
          return (
            <code className="bg-gray-100 px-2 py-1 rounded text-xs">
              {admin.user_id}
            </code>
          );
        case "actions":
          return (
            <div className="flex items-center gap-2">
              <ActionButton
                variant="primary"
                size="sm"
                onClick={() => updateAdminMutation.mutate({ userId: admin.user_id, email: editEmail })}
                loading={updateAdminMutation.isPending}
                disabled={!editEmail.trim()}
              >
                Save
              </ActionButton>
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingUserId(null);
                  setEditEmail("");
                }}
                disabled={updateAdminMutation.isPending}
              >
                Cancel
              </ActionButton>
            </div>
          );
        default:
          return null;
      }
    }

    switch (column.key) {
      case "username":
        return admin.username || <span className="text-gray-400">No username</span>;
      case "email":
        return admin.email || <span className="text-gray-400">No email set</span>;
      case "user_id":
        return (
          <code className="bg-gray-100 px-2 py-1 rounded text-xs">
            {admin.user_id}
          </code>
        );
      case "actions":
        return (
          <div className="flex items-center gap-2">
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditingUserId(admin.user_id);
                setEditEmail(admin.email || "");
              }}
              disabled={removeAdminMutation.isPending || updateAdminMutation.isPending}
            >
              Edit
            </ActionButton>
            <ActionButton
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm("Are you sure you want to remove this admin?")) {
                  removeAdminMutation.mutate(admin.user_id);
                }
              }}
              loading={removeAdminMutation.isPending}
            >
              Remove
            </ActionButton>
          </div>
        );
      default:
        return null;
    }
  };

  // Tab configuration
  const tabs = [
    {
      id: 'general' as const,
      name: 'General',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      description: 'Basic application configuration'
    },
    {
      id: 'branding' as const,
      name: 'Branding', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h4a1 1 0 011 1v2M7 4h10l1 16H6L7 4zM9 9h6M9 13h6" />
        </svg>
      ),
      description: 'Logo, colors, and brand identity'
    },
    {
      id: 'messaging' as const,
      name: 'Messaging',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      description: 'Templates and user communications'
    },
    {
      id: 'admins' as const,
      name: 'Administrators',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      description: 'Manage admin users and permissions'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-50/30">
      {/* Enhanced Header with Breadcrumb */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-100/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span>Admin</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-gray-900 font-medium">System Settings</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ActionButton
                variant="primary"
                onClick={() => saveSettingsMutation.mutate()}
                loading={saveSettingsMutation.isPending}
                className="px-6 py-2 text-sm font-medium"
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                }
              >
                Save Changes
              </ActionButton>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="mb-4 lg:mb-0">
              <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
              <p className="mt-2 text-gray-600">Configure your application settings and manage system administrators</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center px-3 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium">
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                System Healthy
              </div>
            </div>
          </div>
        </div>

        {/* Modern Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200 bg-white rounded-t-xl">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={
                    `flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200
                    ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`
                  }
                >
                  {tab.icon}
                  <span>{tab.name}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-xl shadow-sm border border-gray-200 border-t-0">
          {activeTab === 'general' && <GeneralSettings currentSettings={currentSettings} updateSetting={updateSetting} derivedSearchMode={derivedSearchMode} setSearchMode={setSearchMode} />}
          {activeTab === 'branding' && <BrandingSettings currentSettings={currentSettings} updateSetting={updateSetting} queryClient={queryClient} saveSettingsMutation={saveSettingsMutation} />}
          {activeTab === 'messaging' && <MessagingSettings currentSettings={currentSettings} updateSetting={updateSetting} />}
          {activeTab === 'admins' && <AdminManagement 
            adminsQuery={adminsQuery}
            adminColumns={adminColumns}
            renderAdminCell={renderAdminCell}
            showNewAdminForm={showNewAdminForm}
            setShowNewAdminForm={setShowNewAdminForm}
            newUsername={newUsername}
            setNewUsername={setNewUsername}
            newEmail={newEmail}
            setNewEmail={setNewEmail}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
            isFormValid={isFormValid}
            isValidNewEmail={isValidNewEmail}
            createUserMutation={createUserMutation}
          />}
        </div>
      </div>
    </div>
  );
}

// Tab Components
function GeneralSettings({ currentSettings, updateSetting, derivedSearchMode, setSearchMode }: {
  currentSettings: AppSettings;
  updateSetting: (key: keyof AppSettings, value: any) => void;
  derivedSearchMode: "name" | "code";
  setSearchMode: (mode: "name" | "code") => void;
}) {
  return (
    <div className="p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Student Language
          </label>
          <div className="flex items-center gap-6">
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="default_language"
                value="en"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                checked={(currentSettings.default_language || "en").toLowerCase() !== "ar"}
                onChange={() => updateSetting("default_language", "en")}
              />
              <span className="ml-2 block text-sm text-gray-700">English (LTR)</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                name="default_language"
                value="ar"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                checked={(currentSettings.default_language || "en").toLowerCase() === "ar"}
                onChange={() => updateSetting("default_language", "ar")}
              />
              <span className="ml-2 block text-sm text-gray-700">Arabic (RTL)</span>
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-2">Controls student-facing pages language and direction (RTL for Arabic).</p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Student Results Search Mode
          </label>
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="search_mode"
                  value="name"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  checked={derivedSearchMode === "name"}
                  onChange={() => setSearchMode("name")}
                />
                <span className="ml-2 block text-sm text-gray-700">Search by Name</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  name="search_mode"
                  value="code"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                  checked={derivedSearchMode === "code"}
                  onChange={() => setSearchMode("code")}
                />
                <span className="ml-2 block text-sm text-gray-700">Find by Code</span>
              </label>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Exactly one search method is enforced on the public results page.
          </p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Thank You Title (English)
          </label>
          <input
            type="text"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            value={currentSettings.thank_you_title ?? ""}
            onChange={(e) => updateSetting("thank_you_title", e.target.value)}
            placeholder="Thank You!"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Thank You Title (Arabic)
          </label>
          <input
            type="text"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            value={currentSettings.thank_you_title_ar ?? ""}
            onChange={(e) => updateSetting("thank_you_title_ar", e.target.value)}
            placeholder="شكرًا لك!"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Thank You Message (English)
          </label>
          <textarea
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            rows={4}
            value={currentSettings.thank_you_message ?? ""}
            onChange={(e) => updateSetting("thank_you_message", e.target.value)}
            placeholder="Your answers have been recorded and saved..."
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Thank You Message (Arabic)
          </label>
          <textarea
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            rows={4}
            value={currentSettings.thank_you_message_ar ?? ""}
            onChange={(e) => updateSetting("thank_you_message_ar", e.target.value)}
            placeholder="تم تسجيل إجاباتك وحفظها..."
          />
        </div>
      </div>
    </div>
  );
}

function BrandingSettings({ currentSettings, updateSetting, queryClient, saveSettingsMutation }: {
  currentSettings: AppSettings;
  updateSetting: (key: keyof AppSettings, value: any) => void;
  queryClient: any;
  saveSettingsMutation: any;
}) {
  return (
    <div className="p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Brand Name
          </label>
          <input
            type="text"
            className="w-full px-5 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors shadow-sm"
            value={currentSettings.brand_name ?? ""}
            onChange={(e) => updateSetting("brand_name", e.target.value)}
            placeholder="Your Organization Name"
          />
        </div>

        <div className="md:col-span-2">
          <LogoUpload
            currentLogoUrl={currentSettings.brand_logo_url}
            onLogoChange={(url) => {
              updateSetting("brand_logo_url", url || "");
              queryClient.invalidateQueries({ queryKey: ["admin", "settings"] });
            }}
            disabled={saveSettingsMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}

function MessagingSettings({ currentSettings, updateSetting }: {
  currentSettings: AppSettings;
  updateSetting: (key: keyof AppSettings, value: any) => void;
}) {
  return (
    <div className="p-8">
      <div className="space-y-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            WhatsApp Default Template
          </label>
          <textarea
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            rows={4}
            value={currentSettings.whatsapp_default_template ?? ""}
            onChange={(e) => updateSetting("whatsapp_default_template", e.target.value)}
            placeholder="Hello {name}! Your exam code is: {code}"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use {"{name}"} and {"{code}"} as placeholders
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Welcome Instructions (English)
          </label>
          <textarea
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            rows={6}
            value={currentSettings.welcome_instructions ?? ""}
            onChange={(e) => updateSetting("welcome_instructions", e.target.value)}
            placeholder="Welcome @name! Please read the following instructions carefully before starting your exam..."
          />
          <p className="text-xs text-gray-500 mt-1">
            Use @name to insert the student's name. This message will be shown before the exam starts.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Welcome Instructions (Arabic)
          </label>
          <textarea
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            rows={6}
            value={currentSettings.welcome_instructions_ar ?? ""}
            onChange={(e) => updateSetting("welcome_instructions_ar", e.target.value)}
            placeholder="@name مرحبًا! يرجى قراءة التعليمات التالية بعناية قبل بدء الاختبار..."
          />
          <p className="text-xs text-gray-500 mt-1">
            إذا تم تعيين اللغة العربية كافتراضية، سيتم استخدام هذه التعليمات بدلًا من النص الإنجليزي.
          </p>
        </div>
      </div>
    </div>
  );
}

function AdminManagement({ 
  adminsQuery, adminColumns, renderAdminCell, showNewAdminForm, setShowNewAdminForm,
  newUsername, setNewUsername, newEmail, setNewEmail, newPassword, setNewPassword,
  showPassword, setShowPassword, isFormValid, isValidNewEmail, createUserMutation 
}: {
  adminsQuery: any;
  adminColumns: any;
  renderAdminCell: any;
  showNewAdminForm: boolean;
  setShowNewAdminForm: (show: boolean) => void;
  newUsername: string;
  setNewUsername: (username: string) => void;
  newEmail: string;
  setNewEmail: (email: string) => void;
  newPassword: string;
  setNewPassword: (password: string) => void;
  showPassword: boolean;
  setShowPassword: (show: boolean) => void;
  isFormValid: boolean;
  isValidNewEmail: boolean;
  createUserMutation: any;
}) {
  return (
    <div className="p-8">
      {/* Toggle Button */}
      <div className="mb-8">
        <button
          onClick={() => setShowNewAdminForm(!showNewAdminForm)}
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showNewAdminForm ? "M6 18L18 6M6 6l12 12" : "M12 6v6m0 0v6m0-6h6m-6 0H6"} />
          </svg>
          {showNewAdminForm ? 'Cancel' : 'Create New Admin'}
        </button>
      </div>

      {/* New Admin Form */}
      {showNewAdminForm && (
        <div className="bg-gray-50 rounded-xl p-6 mb-8 border border-gray-200">
          <h3 className="text-lg font-medium text-gray-800 mb-6 flex items-center gap-3">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Create New Admin Account
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <input
                type="text"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Username (optional)"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
            <div>
              <input
                type="email"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
              {newEmail && !isValidNewEmail && (
                <p className="text-xs text-red-600 mt-2 ml-1">Please enter a valid email address.</p>
              )}
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                className="w-full px-4 py-3 pr-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464m1.414 1.414L8.464 8.464m5.656 5.656l1.415 1.415m-1.415-1.415l1.415 1.415" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <div className="flex justify-end">
            <ActionButton
              variant="primary"
              className="px-8 py-3 rounded-xl text-md font-medium transition-all duration-300 transform hover:scale-105 hover:shadow-md"
              onClick={() => createUserMutation.mutate()}
              loading={createUserMutation.isPending}
              disabled={!isFormValid}
            >
              Create Admin Account
            </ActionButton>
          </div>
        </div>
      )}

      {/* Admins Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <ModernTable
          columns={adminColumns}
          data={adminsQuery.data || []}
          renderCell={renderAdminCell}
          loading={adminsQuery.isLoading}
          emptyMessage="No administrators found"
        />
      </div>

      {adminsQuery.error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl shadow-sm">
          <p className="text-red-800 font-medium flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Error loading administrators
          </p>
          <p className="text-red-600 text-sm mt-1 ml-7">{(adminsQuery.error as any).message}</p>
        </div>
      )}
    </div>
  );
}