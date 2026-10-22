"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Edit3,
  Copy,
  Check,
  Loader2,
  X,
  AlertCircle,
  UserCheck,
  User,
  Info,
} from "lucide-react";
import {
  fetchPortalCredentials,
  updatePortalCredential,
  getAdminPublicLoginId,
  type PortalCredentialsMap,
} from "@/lib/portalCredentialsService";

export default function PortalCredentialsCard() {
  // Zero-trust state: no credentials in localStorage/sessionStorage
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [credentials, setCredentials] = useState<PortalCredentialsMap | null>(null);
  const [sessionAdminPassword, setSessionAdminPassword] = useState<string>("");
  const [adminLoginId, setAdminLoginId] = useState<string>("admin");

  // Verification Modal State
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [verifyPassword, setVerifyPassword] = useState<string>("");
  const [showVerifyPass, setShowVerifyPass] = useState<boolean>(false);
  const [verifyLoading, setVerifyLoading] = useState<boolean>(false);
  const [verifyError, setVerifyError] = useState<string>("");
  const [pendingEditRole, setPendingEditRole] = useState<"admin" | "staff" | null>(null);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editRole, setEditRole] = useState<"admin" | "staff">("admin");
  const [editLoginId, setEditLoginId] = useState<string>("");
  const [editPassword, setEditPassword] = useState<string>("");
  const [editConfirmPassword, setEditConfirmPassword] = useState<string>("");
  const [showEditPass, setShowEditPass] = useState<boolean>(false);
  const [showEditConfirmPass, setShowEditConfirmPass] = useState<boolean>(false);
  const [editLoading, setEditLoading] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>("");

  // Notification Toast / Feedback
  const [toastMessage, setToastMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Probe public admin username on mount
  useEffect(() => {
    let isMounted = true;
    getAdminPublicLoginId().then((id) => {
      if (isMounted && id) setAdminLoginId(id);
    });

    // Zero-trust unmount clean-up
    return () => {
      isMounted = false;
      setCredentials(null);
      setSessionAdminPassword("");
      setIsRevealed(false);
    };
  }, []);

  const triggerToast = (text: string, tone: "ok" | "err" = "ok") => {
    setToastMessage({ text, tone });
    setTimeout(() => {
      setToastMessage((cur) => (cur?.text === text ? null : cur));
    }, 4000);
  };

  const handleCopy = (text: string, fieldKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => {
      setCopiedField((cur) => (cur === fieldKey ? null : cur));
    }, 2000);
  };

  // Toggle Reveal / Hide
  const handleToggleReveal = () => {
    if (isRevealed) {
      // Hide immediately and wipe in-memory credentials & active session password
      setIsRevealed(false);
      setCredentials(null);
      setSessionAdminPassword("");
      triggerToast("Credentials hidden and in-memory secrets purged.", "ok");
    } else {
      // Require admin password verification
      setVerifyError("");
      setVerifyPassword("");
      setPendingEditRole(null);
      setShowVerifyModal(true);
    }
  };

  // Submit Password Verification Modal
  const handleVerifySubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!verifyPassword.trim()) {
      setVerifyError("Please enter your admin password.");
      return;
    }

    setVerifyLoading(true);
    setVerifyError("");

    const res = await fetchPortalCredentials(adminLoginId, verifyPassword.trim());
    setVerifyLoading(false);

    if (!res.success || !res.data) {
      setVerifyError(res.error || "Authentication failed. Incorrect admin password.");
      return;
    }

    // Success! Update in-memory credentials & active session password
    setCredentials(res.data);
    setSessionAdminPassword(verifyPassword.trim());
    setIsRevealed(true);
    setShowVerifyModal(false);
    setVerifyPassword("");

    if (pendingEditRole) {
      // Transition directly to edit modal
      openEditModal(pendingEditRole, res.data);
      setPendingEditRole(null);
    } else {
      triggerToast("Admin authenticated. Credentials unmasked.", "ok");
    }
  };

  // Open Edit Modal with prefilled values
  const openEditModal = (role: "admin" | "staff", credsData?: PortalCredentialsMap) => {
    const currentCreds = credsData || credentials;
    const item = currentCreds ? currentCreds[role] : null;

    setEditRole(role);
    setEditLoginId(item?.login_id || (role === "admin" ? adminLoginId : "staff"));
    setEditPassword(item?.password || "");
    setEditConfirmPassword(item?.password || "");
    setEditError("");
    setShowEditPass(false);
    setShowEditConfirmPass(false);
    setShowEditModal(true);
  };

  // Edit Button clicked
  const handleEditClick = (role: "admin" | "staff") => {
    if (!sessionAdminPassword || !credentials) {
      // Intercept with password verification
      setPendingEditRole(role);
      setVerifyError("");
      setVerifyPassword("");
      setShowVerifyModal(true);
    } else {
      openEditModal(role);
    }
  };

  // Submit Edit Modal
  const handleEditSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanId = editLoginId.trim();
    const cleanPass = editPassword.trim();
    const cleanConfirm = editConfirmPassword.trim();

    if (cleanId.length < 3) {
      setEditError("Login ID must be at least 3 characters.");
      return;
    }
    if (cleanPass.length < 6) {
      setEditError("Password must be at least 6 characters.");
      return;
    }
    if (cleanPass !== cleanConfirm) {
      setEditError("Password and Confirm Password do not match.");
      return;
    }

    setEditLoading(true);
    setEditError("");

    const res = await updatePortalCredential(
      adminLoginId,
      sessionAdminPassword,
      editRole,
      cleanId,
      cleanPass
    );

    setEditLoading(false);

    if (!res.success) {
      setEditError(res.error || `Failed to update ${editRole} credentials.`);
      return;
    }

    // Success! Update in-memory state
    if (editRole === "admin") {
      setAdminLoginId(cleanId);
      setSessionAdminPassword(cleanPass);
    }

    // Refetch fresh credentials
    const refreshed = await fetchPortalCredentials(
      editRole === "admin" ? cleanId : adminLoginId,
      editRole === "admin" ? cleanPass : sessionAdminPassword
    );
    if (refreshed.success && refreshed.data) {
      setCredentials(refreshed.data);
    }

    setShowEditModal(false);
    triggerToast(
      `${editRole === "admin" ? "Admin" : "Staff"} credentials updated successfully!`,
      "ok"
    );
  };

  return (
    <div className="bg-white border border-[#C5A059]/30 rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-5 relative">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`absolute top-4 right-4 z-20 flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shadow-lg animate-in fade-in slide-in-from-top-2 border ${
            toastMessage.tone === "ok"
              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
              : "bg-red-50 text-red-800 border-red-300"
          }`}
        >
          {toastMessage.tone === "ok" ? (
            <Check className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Card Header & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 pb-4 border-b border-[#C5A059]/20">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent-strong)]">
              <KeyRound className="w-4 h-4" />
            </div>
            <h3
              className="text-xs font-black uppercase tracking-widest text-black"
              style={{ color: "#000000", WebkitTextFillColor: "#000000" }}
            >
              Portal Access &amp; Passwords
            </h3>
          </div>
          <p className="text-[10px] text-zinc-600 font-semibold mt-1">
            Zero-trust credential manager for Administrator and Staff terminal access.
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Security Status Badge */}
          {isRevealed ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300 text-[10px] font-black uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Credentials Unmasked
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-300 text-[10px] font-black uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              Protected by Admin Password
            </span>
          )}

          {/* Reveal / Hide Button */}
          <button
            type="button"
            onClick={handleToggleReveal}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs border ${
              isRevealed
                ? "bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300"
                : "bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white border-[var(--accent-strong)]"
            }`}
          >
            {isRevealed ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                Hide Credentials
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                Reveal Credentials
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4-Box Grid Partitioned by Role */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* ── ADMIN BLOCK ── */}
        <div className="bg-[#FAF7F2] border border-[#C5A059]/30 rounded-xl p-4 flex flex-col justify-between gap-3.5 shadow-2xs">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#C5A059]/20">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#8A6815]" />
                <span className="text-[11px] font-black uppercase tracking-wider text-black">
                  Admin Credentials
                </span>
              </div>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-white border border-[#C5A059]/30 px-2 py-0.5 rounded-md">
                Full POS &amp; Settings
              </span>
            </div>

            {/* Boxes 1 & 2 */}
            <div className="space-y-2.5">
              {/* Box 1: Admin Login ID */}
              <div className="bg-white border border-[#C5A059]/30 rounded-lg p-2.5 flex items-center justify-between">
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Admin Login ID
                  </span>
                  <span className="text-xs font-mono font-bold text-black">
                    {isRevealed && credentials ? credentials.admin.login_id : adminLoginId}
                  </span>
                </div>
                {isRevealed && credentials && (
                  <button
                    type="button"
                    onClick={() => handleCopy(credentials.admin.login_id, "admin_id")}
                    className="p-1 text-zinc-400 hover:text-black rounded transition-colors"
                    title="Copy Login ID"
                  >
                    {copiedField === "admin_id" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              {/* Box 2: Admin Password */}
              <div className="bg-white border border-[#C5A059]/30 rounded-lg p-2.5 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Admin Password
                  </span>
                  <span className="text-xs font-mono font-bold text-black tracking-wider truncate block">
                    {isRevealed && credentials?.admin.password
                      ? credentials.admin.password
                      : "••••••••••••"}
                  </span>
                </div>
                {isRevealed && credentials?.admin.password && (
                  <button
                    type="button"
                    onClick={() => handleCopy(credentials.admin.password || "", "admin_pass")}
                    className="p-1 text-zinc-400 hover:text-black rounded transition-colors"
                    title="Copy Password"
                  >
                    {copiedField === "admin_pass" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action: Edit Admin */}
          <div className="pt-2 flex items-center justify-between border-t border-[#C5A059]/15">
            <span className="text-[9px] text-zinc-500 font-semibold">
              {isRevealed && credentials?.admin.updated_at
                ? `Updated: ${new Date(credentials.admin.updated_at).toLocaleDateString()}`
                : "Secured with bcrypt"}
            </span>
            <button
              type="button"
              onClick={() => handleEditClick("admin")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-zinc-800 text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors shadow-2xs"
            >
              <Edit3 className="w-3 h-3 text-white" />
              Edit Admin
            </button>
          </div>
        </div>

        {/* ── STAFF BLOCK ── */}
        <div className="bg-[#FAF7F2] border border-[#C5A059]/30 rounded-xl p-4 flex flex-col justify-between gap-3.5 shadow-2xs">
          <div>
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#C5A059]/20">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#8A6815]" />
                <span className="text-[11px] font-black uppercase tracking-wider text-black">
                  Staff Credentials
                </span>
              </div>
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest bg-white border border-[#C5A059]/30 px-2 py-0.5 rounded-md">
                Billing &amp; Counter Only
              </span>
            </div>

            {/* Boxes 3 & 4 */}
            <div className="space-y-2.5">
              {/* Box 3: Staff Login ID */}
              <div className="bg-white border border-[#C5A059]/30 rounded-lg p-2.5 flex items-center justify-between">
                <div>
                  <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Staff Login ID
                  </span>
                  <span className="text-xs font-mono font-bold text-black">
                    {isRevealed && credentials ? credentials.staff.login_id : "staff"}
                  </span>
                </div>
                {isRevealed && credentials && (
                  <button
                    type="button"
                    onClick={() => handleCopy(credentials.staff.login_id, "staff_id")}
                    className="p-1 text-zinc-400 hover:text-black rounded transition-colors"
                    title="Copy Login ID"
                  >
                    {copiedField === "staff_id" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              {/* Box 4: Staff Password */}
              <div className="bg-white border border-[#C5A059]/30 rounded-lg p-2.5 flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-500">
                    Staff Password
                  </span>
                  <span className="text-xs font-mono font-bold text-black tracking-wider truncate block">
                    {isRevealed && credentials?.staff.password
                      ? credentials.staff.password
                      : "••••••••••••"}
                  </span>
                </div>
                {isRevealed && credentials?.staff.password && (
                  <button
                    type="button"
                    onClick={() => handleCopy(credentials.staff.password || "", "staff_pass")}
                    className="p-1 text-zinc-400 hover:text-black rounded transition-colors"
                    title="Copy Password"
                  >
                    {copiedField === "staff_pass" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action: Edit Staff */}
          <div className="pt-2 flex items-center justify-between border-t border-[#C5A059]/15">
            <span className="text-[9px] text-zinc-500 font-semibold">
              {isRevealed && credentials?.staff.updated_at
                ? `Updated: ${new Date(credentials.staff.updated_at).toLocaleDateString()}`
                : "Secured with bcrypt"}
            </span>
            <button
              type="button"
              onClick={() => handleEditClick("staff")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-zinc-800 text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer transition-colors shadow-2xs"
            >
              <Edit3 className="w-3 h-3 text-white" />
              Edit Staff
            </button>
          </div>
        </div>
      </div>

      {/* Security Notice Note */}
      <div className="flex items-start gap-2 bg-[#FAF7F2] p-3 rounded-xl border border-[#C5A059]/20 text-[10px] text-zinc-600 font-medium">
        <Info className="w-4 h-4 text-[#8A6815] shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-black">Brute-Force Guard:</strong> 5 consecutive incorrect
          password attempts temporarily lock an account for 15 minutes. Passwords are encrypted
          using Blowfish bcrypt (<code className="font-mono text-[9px]">pgcrypto</code>).
        </p>
      </div>

      {/* ── MODAL 1: ADMIN PASSWORD VERIFICATION MODAL ── */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#C5A059]/35 shadow-2xl max-w-sm w-full p-6 text-zinc-900 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-700">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-zinc-900 tracking-tight">
                    Verify Admin Password
                  </h4>
                  <p className="text-[10px] text-zinc-500 font-semibold">
                    Re-authentication required
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowVerifyModal(false);
                  setPendingEditRole(null);
                }}
                className="p-1.5 text-zinc-400 hover:text-zinc-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {verifyError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{verifyError}</span>
              </div>
            )}

            <form onSubmit={handleVerifySubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-700 mb-1">
                  Admin Login ID
                </label>
                <input
                  type="text"
                  value={adminLoginId}
                  onChange={(e) => setAdminLoginId(e.target.value)}
                  className="w-full h-10 bg-zinc-50 border border-zinc-300 rounded-lg px-3 text-xs font-mono font-bold text-zinc-900 focus:outline-none focus:border-[#C5A059]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-700 mb-1">
                  Current Admin Password *
                </label>
                <div className="relative">
                  <input
                    type={showVerifyPass ? "text" : "password"}
                    value={verifyPassword}
                    onChange={(e) => {
                      setVerifyPassword(e.target.value);
                      if (verifyError) setVerifyError("");
                    }}
                    placeholder="Enter admin password"
                    autoFocus
                    required
                    className="w-full h-10 bg-white border border-zinc-300 hover:border-[#D4AF37] focus:border-[#D4AF37] rounded-lg px-3 pr-10 text-xs font-mono font-bold text-zinc-900 focus:outline-none transition-colors shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowVerifyPass(!showVerifyPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    {showVerifyPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowVerifyModal(false);
                    setPendingEditRole(null);
                  }}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyLoading}
                  className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 border border-[var(--accent-strong)] disabled:opacity-50"
                >
                  {verifyLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5" />
                  )}
                  {verifyLoading ? "Verifying..." : "Authenticate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: EDIT CREDENTIALS MODAL ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-[#C5A059]/35 shadow-2xl max-w-md w-full p-6 text-zinc-900 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3.5 border-b border-zinc-200 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent-strong)]">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-zinc-900 tracking-tight">
                    Edit {editRole === "admin" ? "Admin" : "Staff"} Credentials
                  </h4>
                  <p className="text-[10px] text-zinc-500 font-semibold">
                    Set a new login username and password
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-800 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Login ID field */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-700 mb-1">
                  Login ID (Username) *
                </label>
                <input
                  type="text"
                  value={editLoginId}
                  onChange={(e) => {
                    setEditLoginId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
                    if (editError) setEditError("");
                  }}
                  placeholder="e.g. admin or staff"
                  required
                  className="w-full h-10 bg-white border border-zinc-300 hover:border-[#D4AF37] focus:border-[#D4AF37] rounded-lg px-3 text-xs font-mono font-bold text-zinc-900 focus:outline-none transition-colors shadow-xs"
                />
                <p className="text-[9px] text-zinc-500 mt-1">
                  Minimum 3 characters (letters, numbers, hyphens).
                </p>
              </div>

              {/* New Password field */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-700 mb-1">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type={showEditPass ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => {
                      setEditPassword(e.target.value);
                      if (editError) setEditError("");
                    }}
                    placeholder="Minimum 6 characters"
                    required
                    className="w-full h-10 bg-white border border-zinc-300 hover:border-[#D4AF37] focus:border-[#D4AF37] rounded-lg px-3 pr-10 text-xs font-mono font-bold text-zinc-900 focus:outline-none transition-colors shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPass(!showEditPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    {showEditPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password field */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-700 mb-1">
                  Confirm New Password *
                </label>
                <div className="relative">
                  <input
                    type={showEditConfirmPass ? "text" : "password"}
                    value={editConfirmPassword}
                    onChange={(e) => {
                      setEditConfirmPassword(e.target.value);
                      if (editError) setEditError("");
                    }}
                    placeholder="Re-enter password"
                    required
                    className="w-full h-10 bg-white border border-zinc-300 hover:border-[#D4AF37] focus:border-[#D4AF37] rounded-lg px-3 pr-10 text-xs font-mono font-bold text-zinc-900 focus:outline-none transition-colors shadow-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditConfirmPass(!showEditConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    {showEditConfirmPass ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 border border-[var(--accent-strong)] disabled:opacity-50"
                >
                  {editLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
