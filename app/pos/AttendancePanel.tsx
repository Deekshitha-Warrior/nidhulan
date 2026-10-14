"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Download,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from "lucide-react";
import type { AttendanceRecord, AttendanceStatus, Staff } from "@/lib/types";
import {
  createStaff,
  editStaff,
  fetchAttendance,
  fetchStaff,
  removeStaff,
  setAttendanceStatus,
} from "@/app/pos/actions";

type SubTab = "today" | "report" | "staff";
type SortField = "name" | "present" | "half" | "absent" | "leave";

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; active: string }[] = [
  { value: "PRESENT", label: "Present", active: "bg-[#15803D] border-[#15803D] text-white" },
  { value: "ABSENT", label: "Absent", active: "bg-[#DC2626] border-[#DC2626] text-white" },
  { value: "HALF_DAY", label: "Half Day", active: "bg-[#EA580C] border-[#EA580C] text-white" },
  { value: "LEAVE", label: "Leave", active: "bg-[#2563EB] border-[#2563EB] text-white" },
];

const inputCls =
  "w-full bg-[#181820] border border-[#C5A059]/25 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#FAF7F2] placeholder:text-[#B8B5AE]/40 focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 transition-colors";

const labelCls =
  "block text-[10px] font-extrabold uppercase tracking-widest text-[#B8B5AE] mb-1.5";

/** Today's date in the shop's time zone, as 'YYYY-MM-DD'. */
export function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** First and last day of a 'YYYY-MM' month, as 'YYYY-MM-DD' strings. */
function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}-${m}-${y}`;
}

function Initial({ name }: { name: string }) {
  return (
    <span className="w-9 h-9 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center text-xs font-black uppercase shrink-0">
      {name.trim().charAt(0) || "?"}
    </span>
  );
}

export default function AttendancePanel() {
  const [subTab, setSubTab] = useState<SubTab>("today");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const [retryKey, setRetryKey] = useState(0);

  const refreshStaff = useCallback(async () => {
    try {
      const rows = await fetchStaff();
      setStaff(rows);
      setStaffError(null);
    } catch (err: unknown) {
      console.error("Failed to load staff:", err);
      setStaffError(
        err instanceof Error
          ? err.message
          : "Could not load staff records. Database connection may be unavailable."
      );
    }
  }, []);

  const handleRetryStaff = useCallback(() => {
    setIsRetrying(true);
    setStaffError(null);
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchStaff()
      .then((rows) => {
        if (!cancelled) {
          setStaff(rows);
          setStaffError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("Failed to load staff:", err);
          setStaffError(
            err instanceof Error
              ? err.message
              : "Could not load staff records. Database connection may be unavailable."
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingStaff(false);
          setIsRetrying(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [retryKey]);

  return (
    <div className="flex-1 flex flex-col max-w-[1400px] mx-auto w-full pb-8 pr-2 animate-in fade-in duration-300 gap-6">
      <div className="flex items-center gap-3">
        <span className="w-1.5 h-10 bg-[var(--accent)] rounded-full" />
        <h2 className="text-[28px] font-black text-[#FAF7F2] tracking-tight">
          Attendance &amp; Staff
        </h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["today", "Today's Attendance"],
            ["report", "Monthly Report"],
            ["staff", "Staff Management"],
          ] as [SubTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-colors cursor-pointer ${
              subTab === key
                ? "bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] border-[#E5C378] text-[#0C0C0E] font-black shadow-sm"
                : "bg-[#181820] border-[#C5A059]/20 text-[#FAF7F2] hover:border-[var(--accent)]/40 hover:text-[var(--accent)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>



      {isLoadingStaff ? (
        <div className="flex items-center justify-center py-16 text-[#B8B5AE]">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent)]" />
        </div>
      ) : subTab === "today" ? (
        <TodayAttendance staff={staff} onAddStaff={() => setSubTab("staff")} />
      ) : subTab === "report" ? (
        <MonthlyReport staff={staff} />
      ) : (
        <StaffManagement staff={staff} onChanged={refreshStaff} />
      )}
    </div>
  );
}

/* ── Today's attendance ──────────────────────────────────────────── */

function TodayAttendance({ staff, onAddStaff }: { staff: Staff[]; onAddStaff: () => void }) {
  const [date, setDate] = useState(todayIST());
  // Records are tagged with the date they were loaded for, so a stale date
  // shows as loading until its fetch lands.
  const [loaded, setLoaded] = useState<{ date: string; records: AttendanceRecord[] } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const activeStaff = useMemo(() => staff.filter((s) => s.is_active), [staff]);
  const isToday = date === todayIST();
  // Staff punch in/out from their own login; poll today's view so those
  // punches show up here without a manual refresh.
  const [refreshTick, setRefreshTick] = useState(0);
  useEffect(() => {
    if (!isToday) return;
    const timer = window.setInterval(() => setRefreshTick((t) => t + 1), 30000);
    return () => window.clearInterval(timer);
  }, [isToday]);
  const isLoading = loaded?.date !== date;
  const records = useMemo(
    () => (loaded?.date === date ? loaded.records : []),
    [loaded, date],
  );

  const [retryKey, setRetryKey] = useState(0);

  const handleRetryAttendance = useCallback(() => {
    setAttendanceError(null);
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAttendance(date, date)
      .then((rows) => {
        if (!cancelled) {
          setLoaded({ date, records: rows });
          setAttendanceError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("Failed to load attendance:", err);
          setAttendanceError(
            err instanceof Error ? err.message : "Could not load attendance for this date."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [date, refreshTick, retryKey]);

  const byStaff = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of records) map.set(r.staff_id, r);
    return map;
  }, [records]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leaveHalf = 0;
    for (const s of activeStaff) {
      const status = byStaff.get(s.id)?.status;
      if (status === "PRESENT") present++;
      else if (status === "ABSENT") absent++;
      else if (status === "LEAVE" || status === "HALF_DAY") leaveHalf++;
    }
    return { total: activeStaff.length, present, absent, leaveHalf };
  }, [activeStaff, byStaff]);

  const run = async (staffId: string, action: () => Promise<void>) => {
    if (busyId) return;
    setBusyId(staffId);
    setActionError(null);
    try {
      await action();
      setLoaded({ date, records: await fetchAttendance(date, date) });
    } catch (err) {
      console.error("Attendance update failed:", err);
      setActionError(
        err instanceof Error ? err.message : "Could not update attendance. Please try again."
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleStatus = (staffId: string, status: AttendanceStatus) => {
    const current = byStaff.get(staffId)?.status ?? null;
    // Clicking the selected status again clears it.
    run(staffId, () => setAttendanceStatus(staffId, date, current === status ? null : status));
  };

  return (
    <>


      {actionError && (
        <div className="bg-[#181820] border border-red-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-red-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-[#B8B5AE] hover:text-[#FAF7F2] p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl px-5 py-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center shrink-0 border border-[var(--accent)]/20">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#B8B5AE]">
              Select Date
            </span>
            <input
              type="date"
              value={date}
              max={todayIST()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="text-lg font-black text-[#FAF7F2] bg-transparent focus:outline-none cursor-pointer [color-scheme:dark]"
            />
          </div>
        </div>
        <div className="flex items-center gap-6 sm:gap-8">
          {(
            [
              ["Total", counts.total, "text-[#FAF7F2]"],
              ["Present", counts.present, "text-[#15803D]"],
              ["Absent", counts.absent, "text-[#DC2626]"],
              ["Leave/Half", counts.leaveHalf, "text-[#EA580C]"],
            ] as [string, number, string][]
          ).map(([label, value, color]) => (
            <div key={label} className="text-center">
              <span className="block text-[10px] font-extrabold uppercase tracking-widest text-[#B8B5AE]">
                {label}
              </span>
              <span className={`text-2xl font-black ${color}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead>
            <tr className="bg-[#181820] border-b border-[#C5A059]/20 text-[11px] font-black uppercase tracking-wider text-[#FAF7F2]">
              <th className="px-5 py-3.5">Staff Member</th>
              <th className="px-5 py-3.5 text-[#B8B5AE]">Role</th>
              <th className="px-5 py-3.5 text-[#15803D]">Clock In</th>
              <th className="px-5 py-3.5 text-[#DC2626]">Clock Out</th>
              <th className="px-5 py-3.5 text-[#B8B5AE]">Override Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#C5A059]/10">
            {activeStaff.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-[#FAF7F2] font-semibold">
                  <span className="text-[#B8B5AE]">No active staff yet. </span>
                  <button
                    type="button"
                    onClick={onAddStaff}
                    className="text-[var(--accent)] font-bold hover:underline cursor-pointer"
                  >
                    Add staff
                  </button>{" "}
                  <span className="text-[#B8B5AE]">to start taking attendance.</span>
                </td>
              </tr>
            ) : (
              activeStaff.map((s) => {
                const record = byStaff.get(s.id);
                const isBusy = busyId === s.id;
                return (
                  <tr key={s.id} className={isLoading ? "opacity-50" : ""}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Initial name={s.name} />
                        <span className="text-sm font-bold text-[#FAF7F2]">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#B8B5AE]">{s.role || "—"}</td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-[#FAF7F2]">
                      {record?.clock_in ? (
                        formatTime(record.clock_in)
                      ) : (
                        <span className="text-[#B8B5AE]/40">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-[#FAF7F2]">
                      {record?.clock_out ? (
                        formatTime(record.clock_out)
                      ) : record?.clock_in && isToday ? (
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#15803D]">
                          On shift
                        </span>
                      ) : (
                        <span className="text-[#B8B5AE]/40">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {STATUS_OPTIONS.map((opt) => {
                          const selected = record?.status === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              disabled={isBusy || isLoading}
                              onClick={() => handleStatus(s.id, opt.value)}
                              className={`px-3 py-1.5 rounded-lg border text-[10px] font-extrabold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 ${
                                selected
                                  ? opt.active
                                  : "bg-[#181820] border-[#C5A059]/20 text-[#B8B5AE] hover:border-[#C5A059]/40 hover:text-[#FAF7F2]"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                        {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Monthly report ──────────────────────────────────────────────── */

function SortHeader({
  field,
  label,
  className,
  sortField,
  sortAsc,
  onSort,
}: {
  field: SortField;
  label: string;
  className: string;
  sortField: SortField;
  sortAsc: boolean;
  onSort: (field: SortField) => void;
}) {
  return (
    <th className={`px-5 py-3.5 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex items-center gap-1 uppercase cursor-pointer hover:opacity-70"
      >
        {label}
        {sortField === field &&
          (sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
      </button>
    </th>
  );
}

type ReportRow = {
  staff: Staff;
  present: number;
  half: number;
  absent: number;
  leave: number;
};

function MonthlyReport({ staff }: { staff: Staff[] }) {
  const currentMonth = todayIST().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [range, setRange] = useState(() => monthRange(currentMonth));
  const [loaded, setLoaded] = useState<{ key: string; records: AttendanceRecord[] } | null>(null);
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);

  const rangeKey = `${range.from}|${range.to}`;
  const isLoading = loaded?.key !== rangeKey;
  // Keep showing the previous range's numbers (dimmed) while the new one loads.
  const records = useMemo(() => loaded?.records ?? [], [loaded]);

  const [retryKey, setRetryKey] = useState(0);

  const handleRetryReport = useCallback(() => {
    setReportError(null);
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchAttendance(range.from, range.to)
      .then((rows) => {
        if (!cancelled) {
          setLoaded({ key: `${range.from}|${range.to}`, records: rows });
          setReportError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("Failed to load report:", err);
          setReportError(
            err instanceof Error ? err.message : "Could not load the attendance report."
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, retryKey]);

  // A complete, valid From–To range applies as soon as it is picked.
  const applyCustomRange = (from: string, to: string) => {
    if (from && to && from <= to) setRange({ from, to });
  };

  const applyFilter = () => {
    setFilterError(null);
    if (fromDate || toDate) {
      if (!fromDate || !toDate) {
        setFilterError("Pick both a From and a To date, or clear them to use the month.");
        return;
      }
      if (fromDate > toDate) {
        setFilterError("The From date must be on or before the To date.");
        return;
      }
      setRange({ from: fromDate, to: toDate });
    } else {
      setRange(monthRange(month));
    }
  };

  const resetFilter = () => {
    setFilterError(null);
    setMonth(currentMonth);
    setFromDate("");
    setToDate("");
    setSortField("name");
    setSortAsc(true);
    setRange(monthRange(currentMonth));
  };

  const rows = useMemo<ReportRow[]>(() => {
    const tally = new Map<string, ReportRow>();
    const staffById = new Map(staff.map((s) => [s.id, s]));
    // Active staff always appear; inactive staff only if they have records in range.
    for (const s of staff) {
      if (s.is_active) tally.set(s.id, { staff: s, present: 0, half: 0, absent: 0, leave: 0 });
    }
    for (const r of records) {
      const s = staffById.get(r.staff_id);
      if (!s || !r.status) continue;
      let row = tally.get(s.id);
      if (!row) {
        row = { staff: s, present: 0, half: 0, absent: 0, leave: 0 };
        tally.set(s.id, row);
      }
      if (r.status === "PRESENT") row.present++;
      else if (r.status === "HALF_DAY") row.half++;
      else if (r.status === "ABSENT") row.absent++;
      else if (r.status === "LEAVE") row.leave++;
    }
    const list = [...tally.values()];
    list.sort((a, b) => {
      const cmp =
        sortField === "name"
          ? a.staff.name.localeCompare(b.staff.name)
          : a[sortField] - b[sortField];
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [staff, records, sortField, sortAsc]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      // Counts read best with the highest first.
      setSortAsc(field === "name");
    }
  };

  const exportCsv = () => {
    if (rows.length === 0) {
      setFilterError("No staff records to export for this period.");
      return;
    }
    const quote = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = ["Staff Member", "Role", "Phone", "Present", "Half Day", "Absent", "Leave", "From", "To"];
    const lines = rows.map((r) =>
      [
        quote(r.staff.name),
        quote(r.staff.role),
        // Excel text formula keeps the phone number from turning into scientific notation.
        r.staff.phone ? `"=""${r.staff.phone}"""` : '""',
        r.present,
        r.half,
        r.absent,
        r.leave,
        quote(formatDate(range.from)),
        quote(formatDate(range.to)),
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance_${range.from}_to_${range.to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sortLabel: Record<SortField, string> = {
    name: "Name",
    present: "Present",
    half: "Half Day",
    absent: "Absent",
    leave: "Leave",
  };

  const sortProps = { sortField, sortAsc, onSort: toggleSort };

  return (
    <>


      {filterError && (
        <div className="bg-[#181820] border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{filterError}</span>
          </div>
          <button
            type="button"
            onClick={() => setFilterError(null)}
            className="text-[#B8B5AE] hover:text-[#FAF7F2] p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 bg-[#181820] border border-[#C5A059]/20 rounded-xl px-3 py-2">
            <CalendarDays className="w-4 h-4 text-[var(--accent)]" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#B8B5AE]">
              Month:
            </span>
            <input
              type="month"
              value={month}
              onChange={(e) => {
                if (!e.target.value) return;
                setMonth(e.target.value);
                setFromDate("");
                setToDate("");
                setRange(monthRange(e.target.value));
              }}
              className="text-sm font-bold text-[#FAF7F2] bg-transparent focus:outline-none cursor-pointer [color-scheme:dark]"
            />
          </label>
          <label className="flex items-center gap-2 bg-[#181820] border border-[#C5A059]/20 rounded-xl px-3 py-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#B8B5AE]">
              From
            </span>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => {
                setFromDate(e.target.value);
                applyCustomRange(e.target.value, toDate);
              }}
              className="text-sm font-bold text-[#FAF7F2] bg-transparent focus:outline-none cursor-pointer [color-scheme:dark]"
            />
          </label>
          <label className="flex items-center gap-2 bg-[#181820] border border-[#C5A059]/20 rounded-xl px-3 py-2">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#B8B5AE]">
              To
            </span>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => {
                setToDate(e.target.value);
                applyCustomRange(fromDate, e.target.value);
              }}
              className="text-sm font-bold text-[#FAF7F2] bg-transparent focus:outline-none cursor-pointer [color-scheme:dark]"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={applyFilter}
            className="bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:brightness-110 active:scale-[0.98] text-[#0C0C0E] border border-[#E5C378] text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer transition-all shadow-[0_2px_10px_rgba(197,160,89,0.2)]"
          >
            Apply Filter
          </button>
          <button
            type="button"
            onClick={resetFilter}
            className="bg-[#181820] border border-[#C5A059]/20 hover:border-[#C5A059]/40 text-[#FAF7F2] text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-1.5 bg-[#181820] border-2 border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-colors"
          >
            <Download className="w-4 h-4" /> Export to Excel
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-semibold text-[#B8B5AE]">
        <span>
          Showing records from:{" "}
          <span className="font-black text-[#FAF7F2]">{formatDate(range.from)}</span> to{" "}
          <span className="font-black text-[#FAF7F2]">{formatDate(range.to)}</span>
        </span>
        <span>
          Staff: <span className="font-black text-[#FAF7F2]">{rows.length}</span> · Sorted by:{" "}
          <span className="font-black text-[#FAF7F2] uppercase">
            {sortLabel[sortField]} ({sortAsc ? "asc" : "desc"})
          </span>
        </span>
      </div>

      <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead>
            <tr className="bg-[#181820] border-b border-[#C5A059]/20 text-[11px] font-black uppercase tracking-wider text-[#FAF7F2]">
              <SortHeader {...sortProps} field="name" label="Staff Member" className="" />
              <th className="px-5 py-3.5 text-[#B8B5AE]">Role</th>
              <SortHeader {...sortProps} field="present" label="Present" className="text-center text-[#15803D]" />
              <SortHeader {...sortProps} field="half" label="Half Day" className="text-center text-[#EA580C]" />
              <SortHeader {...sortProps} field="absent" label="Absent" className="text-center text-[#DC2626]" />
              <SortHeader {...sortProps} field="leave" label="Leave" className="text-center text-[#2563EB]" />
            </tr>
          </thead>
          <tbody className={`divide-y divide-[#C5A059]/10 ${isLoading ? "opacity-50" : ""}`}>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-[#FAF7F2] font-semibold">
                  <span className="text-[#B8B5AE]">No staff to report on yet.</span>
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.staff.id}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Initial name={r.staff.name} />
                      <span className="text-sm font-bold text-[#FAF7F2]">{r.staff.name}</span>
                      {!r.staff.is_active && (
                        <span className="text-[8px] font-black uppercase tracking-widest text-[#B8B5AE] bg-[#181820] border border-[#C5A059]/20 px-1.5 py-0.5 rounded">
                          Inactive
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-[#B8B5AE]">{r.staff.role || "—"}</td>
                  <td className="px-5 py-3.5 text-center text-lg font-black text-[#15803D]">{r.present}</td>
                  <td className="px-5 py-3.5 text-center text-lg font-black text-[#EA580C]">{r.half}</td>
                  <td className="px-5 py-3.5 text-center text-lg font-black text-[#DC2626]">{r.absent}</td>
                  <td className="px-5 py-3.5 text-center text-lg font-black text-[#2563EB]">{r.leave}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Staff management ────────────────────────────────────────────── */

const emptyStaffDraft = { name: "", role: "", phone: "", base_salary: "", is_active: true };

function StaffManagement({ staff, onChanged }: { staff: Staff[]; onChanged: () => Promise<void> }) {
  // null = closed, "new" = adding, otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyStaffDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const openNew = () => {
    setDraft(emptyStaffDraft);
    setFormError(null);
    setEditing("new");
  };

  const openEdit = (s: Staff) => {
    setDraft({
      name: s.name,
      role: s.role,
      phone: s.phone,
      base_salary: String(Number(s.base_salary) || 0),
      is_active: s.is_active,
    });
    setFormError(null);
    setEditing(s.id);
  };

  const handleSave = async () => {
    if (isSaving || !editing) return;
    setFormError(null);
    if (!draft.name.trim()) {
      setFormError("Enter the staff member's name.");
      return;
    }
    const phoneDigits = draft.phone.replace(/\D/g, "");
    if (phoneDigits && phoneDigits.length < 10) {
      setFormError("Enter a 10-digit phone number, or leave it blank.");
      return;
    }
    const payload = {
      name: draft.name,
      role: draft.role,
      phone: draft.phone,
      base_salary: Number(draft.base_salary) || 0,
      is_active: draft.is_active,
    };
    setIsSaving(true);
    try {
      if (editing === "new") await createStaff(payload);
      else await editStaff(editing, payload);
      await onChanged();
      setEditing(null);
    } catch (err) {
      console.error("Failed to save staff:", err);
      setFormError(
        err instanceof Error ? err.message : "Could not save the staff member. Please check database connection."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (s: Staff) => {
    if (
      !window.confirm(
        `Delete ${s.name}? Their attendance history will also be deleted.\n\nTo keep the history, edit them and set them to Inactive instead.`,
      )
    )
      return;
    setDeleteError(null);
    try {
      await removeStaff(s.id);
      await onChanged();
    } catch (err) {
      console.error("Failed to delete staff:", err);
      setDeleteError(
        err instanceof Error ? err.message : "Could not delete the staff member. Please check database connection."
      );
    }
  };

  return (
    <>
      {deleteError && (
        <div className="bg-[#181820] border border-red-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-red-300">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{deleteError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDeleteError(null)}
            className="text-[#B8B5AE] hover:text-[#FAF7F2] p-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:brightness-110 active:scale-[0.98] text-[#0C0C0E] border border-[#E5C378] text-sm font-black px-5 py-2.5 rounded-xl cursor-pointer transition-all shadow-[0_4px_16px_rgba(197,160,89,0.25)]"
        >
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      <div className="bg-[#131317] border border-[#C5A059]/20 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="bg-[#181820] border-b border-[#C5A059]/20 text-[11px] font-black uppercase tracking-wider text-[#FAF7F2]">
              <th className="px-5 py-3.5">Name</th>
              <th className="px-5 py-3.5 text-[#B8B5AE]">Role</th>
              <th className="px-5 py-3.5 text-[#B8B5AE]">Phone</th>
              <th className="px-5 py-3.5">Base Salary</th>
              <th className="px-5 py-3.5 text-center text-[#B8B5AE]">Status</th>
              <th className="px-5 py-3.5 text-right text-[#B8B5AE]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#C5A059]/10">
            {staff.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-sm text-[#FAF7F2] font-semibold">
                  <span className="text-[#B8B5AE]">No staff added yet. Use “Add Staff” to create your first staff member.</span>
                </td>
              </tr>
            ) : (
              staff.map((s) => (
                <tr key={s.id}>
                  <td className="px-5 py-3.5 text-sm font-bold text-[#FAF7F2]">{s.name}</td>
                  <td className="px-5 py-3.5 text-sm text-[#B8B5AE]">{s.role || "—"}</td>
                  <td className="px-5 py-3.5 text-sm text-[#B8B5AE] font-mono">{s.phone || "—"}</td>
                  <td className="px-5 py-3.5 text-sm font-black text-[#FAF7F2]">
                    ₹
                    {Number(s.base_salary).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span
                      className={`inline-block text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${
                        s.is_active
                          ? "text-[#15803D] bg-[#15803D]/10 border-[#15803D]/25"
                          : "text-[#B8B5AE] bg-[#181820] border border-[#C5A059]/20"
                      }`}
                    >
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        title="Edit staff"
                        className="w-8 h-8 flex items-center justify-center rounded-md bg-[#181820] hover:bg-[#C5A059]/20 text-[#FAF7F2] hover:text-[var(--accent)] cursor-pointer transition-colors border border-[#C5A059]/15"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s)}
                        title="Delete staff"
                        className="w-8 h-8 flex items-center justify-center rounded-md bg-[#DC2626]/10 hover:bg-[#DC2626]/20 text-[#EF4444] cursor-pointer transition-colors border border-[#DC2626]/20"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !isSaving && setEditing(null)}
        >
          <div
            className="bg-[#131317] border border-[#C5A059]/30 rounded-2xl shadow-2xl w-full max-w-md p-6 text-[#FAF7F2]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--accent)]">
                {editing === "new" ? "Add Staff" : "Edit Staff"}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={isSaving}
                className="w-8 h-8 rounded-lg hover:bg-[#181820] text-[#B8B5AE] hover:text-[#FAF7F2] flex items-center justify-center cursor-pointer transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-xs font-semibold flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="staff-name" className={labelCls}>Name</label>
                <input
                  id="staff-name"
                  autoFocus
                  className={inputCls}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Staff name"
                />
              </div>
              <div>
                <label htmlFor="staff-role" className={labelCls}>Role</label>
                <input
                  id="staff-role"
                  className={inputCls}
                  value={draft.role}
                  onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                  placeholder="e.g. Tailor"
                />
              </div>
              <div>
                <label htmlFor="staff-phone" className={labelCls}>Phone</label>
                <input
                  id="staff-phone"
                  className={inputCls}
                  inputMode="tel"
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  placeholder="10-digit number"
                />
              </div>
              <div>
                <label htmlFor="staff-salary" className={labelCls}>Base Salary (₹)</label>
                <input
                  id="staff-salary"
                  type="number"
                  min="0"
                  step="1"
                  className={inputCls}
                  value={draft.base_salary}
                  onWheel={(e) => e.currentTarget.blur()}
                  onChange={(e) => setDraft({ ...draft, base_salary: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div>
                <span className={labelCls}>Status</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {([true, false] as const).map((active) => (
                    <button
                      key={String(active)}
                      type="button"
                      onClick={() => setDraft({ ...draft, is_active: active })}
                      className={`py-2.5 rounded-lg border text-[10px] font-extrabold uppercase tracking-wider cursor-pointer transition-colors ${
                        draft.is_active === active
                          ? "bg-[var(--accent)] border-[var(--accent)] text-[#0C0C0E] font-black"
                          : "bg-[#181820] border-[#C5A059]/20 text-[#B8B5AE] hover:border-[#C5A059]/40"
                      }`}
                    >
                      {active ? "Active" : "Inactive"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setEditing(null)}
                disabled={isSaving}
                className="bg-[#181820] hover:bg-[#202028] border border-[#C5A059]/20 text-[#FAF7F2] text-[11px] font-extrabold uppercase tracking-wider px-4 py-2.5 rounded-lg cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] hover:brightness-110 active:scale-[0.98] text-[#0C0C0E] border border-[#E5C378] disabled:opacity-50 text-[11px] font-black uppercase tracking-wider px-4 py-2.5 rounded-lg cursor-pointer transition-all shadow-[0_2px_10px_rgba(197,160,89,0.2)]"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {isSaving ? "Saving..." : "Save Staff"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
