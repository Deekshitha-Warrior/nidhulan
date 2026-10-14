"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Loader2, LogIn, LogOut, CheckCircle2, AlertTriangle, RefreshCw, X } from "lucide-react";
import type { AttendanceRecord, Staff } from "@/lib/types";
import { clockInStaff, clockOutStaff, fetchAttendance, fetchStaff } from "@/app/pos/actions";
import { formatTime, todayIST } from "./AttendancePanel";

type Screen =
  | { kind: "list" }
  | { kind: "detail"; staffId: string }
  | { kind: "done"; staffId: string; action: "in" | "out"; at: string };

const fullDate = (d: Date) =>
  d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });

const clockTime = (d: Date) =>
  d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

function Avatar({ name, size }: { name: string; size: "sm" | "lg" }) {
  return (
    <span
      className={`rounded-2xl bg-[#181820] border border-[#C5A059]/30 text-[var(--accent)] font-black uppercase flex items-center justify-center shrink-0 ${
        size === "lg" ? "w-20 h-20 text-4xl" : "w-14 h-14 text-2xl"
      }`}
    >
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

/** Staff-facing punch in / punch out kiosk for today. */
export default function StaffPunch() {
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [loaded, setLoaded] = useState<{ date: string; records: AttendanceRecord[] } | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [screen, setScreen] = useState<Screen>({ kind: "list" });
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [punchError, setPunchError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const today = todayIST();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const [retryKey, setRetryKey] = useState(0);

  const handleRetryKiosk = React.useCallback(() => {
    setIsRetrying(true);
    setLoadError(null);
    setRetryKey((k) => k + 1);
  }, []);

  // Reload whenever the day rolls over (the kiosk may stay open overnight).
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchStaff(), fetchAttendance(today, today)])
      .then(([staffRows, records]) => {
        if (!cancelled) {
          setStaff(staffRows.filter((s) => s.is_active));
          setLoaded({ date: today, records });
          setLoadError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("Staff punch init failed:", err);
          setLoadError(
            err instanceof Error
              ? err.message
              : "Could not load staff attendance records. Database connection may be unavailable."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRetrying(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [today, retryKey]);

  const recordFor = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    if (loaded?.date === today) for (const r of loaded.records) map.set(r.staff_id, r);
    return map;
  }, [loaded, today]);

  const punch = async (s: Staff, action: "in" | "out") => {
    if (isSaving) return;
    setIsSaving(true);
    setPunchError(null);
    try {
      if (action === "in") await clockInStaff(s.id, today);
      else await clockOutStaff(s.id, today);
      const records = await fetchAttendance(today, today);
      setLoaded({ date: today, records });
      const record = records.find((r) => r.staff_id === s.id);
      const at = (action === "in" ? record?.clock_in : record?.clock_out) ?? new Date().toISOString();
      setScreen({ kind: "done", staffId: s.id, action, at });
    } catch (err) {
      console.error("Punch failed:", err);
      setPunchError(
        err instanceof Error ? err.message : "Could not record your punch. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!staff) {
    if (loadError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#181820] border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black text-[#FAF7F2] tracking-wide mb-2">Staff Kiosk Offline</h3>
          <p className="text-sm text-[#B8B5AE] mb-6">{loadError}</p>
          <button
            type="button"
            onClick={handleRetryKiosk}
            disabled={isRetrying}
            className="inline-flex items-center gap-2 bg-[var(--accent)] hover:brightness-110 active:scale-95 text-[#0C0C0E] border border-[#E5C378] text-sm font-black px-6 py-3 rounded-xl cursor-pointer transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "Connecting..." : "Retry Connection"}
          </button>
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center py-20 text-[#B8B5AE]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  const selected =
    screen.kind !== "list" ? staff.find((s) => s.id === screen.staffId) ?? null : null;

  if (screen.kind === "done" && selected) {
    const isIn = screen.action === "in";
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-16 animate-in fade-in duration-300">
        <div
          className={`w-24 h-24 rounded-full flex items-center justify-center mb-5 ${
            isIn ? "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30" : "bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30"
          }`}
        >
          {isIn ? <LogIn className="w-10 h-10" /> : <LogOut className="w-10 h-10" />}
        </div>
        <h2 className="text-2xl font-black text-[#FAF7F2]">{isIn ? "Punched In!" : "Punched Out!"}</h2>
        <p className="text-base font-bold text-[#B8B5AE] mt-1">{selected.name}</p>
        <p className="text-lg font-black text-[var(--accent)] mt-1">{formatTime(screen.at)}</p>
        <p className="text-sm text-[#B8B5AE] font-semibold mt-6">
          {isIn ? "Remember to punch out when you leave!" : "Have a good evening!"}
        </p>
        <button
          type="button"
          autoFocus
          onClick={() => setScreen({ kind: "list" })}
          className="mt-6 bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:opacity-90 text-[#0C0C0E] font-black px-9 py-3 rounded-xl cursor-pointer transition-colors shadow-sm"
        >
          Done
        </button>
      </div>
    );
  }

  if (screen.kind === "detail" && selected) {
    const record = recordFor.get(selected.id);
    const canPunchIn = !record?.clock_in;
    const canPunchOut = Boolean(record?.clock_in) && !record?.clock_out;
    return (
      <div className="flex-1 flex flex-col w-full max-w-[1400px] mx-auto animate-in fade-in duration-300">
        <button
          type="button"
          onClick={() => setScreen({ kind: "list" })}
          className="self-start inline-flex items-center gap-1 text-sm font-bold text-[var(--accent)] hover:underline cursor-pointer mb-6"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="w-full max-w-md mx-auto space-y-6">
          <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl shadow-sm p-7 flex flex-col items-center text-center">
            <Avatar name={selected.name} size="lg" />
            <h2 className="text-3xl font-black text-[#FAF7F2] mt-4">{selected.name}</h2>
            {selected.role && (
              <p className="text-lg font-bold text-[#B8B5AE]">{selected.role}</p>
            )}
            <p className="text-sm text-[#B8B5AE] font-semibold mt-2">{fullDate(now)}</p>
            {record?.clock_in && (
              <div className="mt-4 flex gap-6 text-sm font-bold">
                <span className="text-[#10B981]">In: {formatTime(record.clock_in)}</span>
                {record.clock_out && (
                  <span className="text-[#EF4444]">Out: {formatTime(record.clock_out)}</span>
                )}
              </div>
            )}
          </div>

          {punchError && (
            <div className="w-full bg-[#181820] border border-red-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-red-300">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{punchError}</span>
              </div>
              <button
                type="button"
                onClick={() => setPunchError(null)}
                className="text-[#B8B5AE] hover:text-[#FAF7F2] p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {canPunchIn || canPunchOut ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => punch(selected, canPunchIn ? "in" : "out")}
              className={`w-full inline-flex items-center justify-center gap-3 text-xl font-black uppercase py-5 rounded-2xl shadow-lg cursor-pointer transition-colors disabled:opacity-60 ${
                canPunchIn
                  ? "bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E]"
                  : "bg-[#EF4444] hover:bg-[#DC2626] text-white"
              }`}
            >
              {isSaving ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : canPunchIn ? (
                <LogIn className="w-6 h-6" />
              ) : (
                <LogOut className="w-6 h-6" />
              )}
              {canPunchIn ? "Punch In" : "Punch Out"}
            </button>
          ) : (
            <div className="w-full flex items-center justify-center gap-2 bg-[#10B981]/15 border border-[#10B981]/30 text-[#10B981] font-black uppercase py-5 rounded-2xl">
              <CheckCircle2 className="w-5 h-5" /> Shift complete for today
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setPunchError(null);
              setScreen({ kind: "list" });
            }}
            className="w-full text-sm font-bold text-[#B8B5AE] hover:text-[#FAF7F2] cursor-pointer"
          >
            Back to staff list
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full max-w-[1400px] mx-auto gap-5 animate-in fade-in duration-300">
      <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl shadow-sm px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="block text-[10px] font-black uppercase tracking-widest text-[var(--accent)]">
            Attendance
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-[#FAF7F2]">{fullDate(now)}</h2>
          <p className="text-sm text-[#B8B5AE] font-semibold">Select your name to punch</p>
        </div>
        <span className="text-2xl sm:text-3xl font-black text-[var(--accent)] tabular-nums">
          {clockTime(now)}
        </span>
      </div>

      {staff.length === 0 ? (
        <p className="text-center text-sm text-[#B8B5AE] font-semibold py-12">
          No staff have been added yet. Ask the admin to add staff under Attendance → Staff Management.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map((s) => {
            const record = recordFor.get(s.id);
            const badge = record?.clock_out
              ? { text: `Out ${formatTime(record.clock_out)}`, cls: "bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30" }
              : record?.clock_in
                ? { text: `In ${formatTime(record.clock_in)}`, cls: "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30" }
                : null;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setPunchError(null);
                  setScreen({ kind: "detail", staffId: s.id });
                }}
                className="text-left bg-[#131317] border border-[#C5A059]/20 rounded-2xl shadow-sm p-5 hover:border-[#C5A059]/50 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-2">
                  <Avatar name={s.name} size="sm" />
                  {badge && (
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${badge.cls}`}>
                      {badge.text}
                    </span>
                  )}
                </div>
                <p className="text-base font-black text-[#FAF7F2] mt-4">{s.name}</p>
                <p className="text-xs font-semibold text-[#B8B5AE]">{s.role || "Staff"}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
