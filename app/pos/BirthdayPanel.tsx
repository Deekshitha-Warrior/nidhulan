"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Gift,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Save,
  Search,
  Check,
  Send,
  MessageCircle,
  AlertCircle,
  Database,
  Info,
  X,
  RefreshCw,
  Menu,
} from "lucide-react";
import type { Customer, Offer, BirthdaySettings } from "@/lib/types";
import {
  fetchCustomers,
  createCustomer,
  editCustomer,
  removeCustomer,
  fetchOffers,
  createOffer,
  editOffer,
  removeOffer,
  fetchBirthdaySettings,
  saveBirthdaySettingsAction,
  recordBirthdaySend,
  checkDatabaseConfigured,
} from "@/app/pos/actions";

// Default message template matching NIDHULAN branding
const DEFAULT_TEMPLATE = `Hi {name}! 🎂 Happy Birthday!

Here's a special treat from NIDHULAN:
🎁 {offer}

Visit us in store or call +91 98714 80705.

— NIDHULAN`;

// Seed fallback data for demo / offline mode
const SEED_OFFERS: Offer[] = [
  {
    id: "off-1",
    name: "20% OFF",
    discount_type: "PERCENT",
    discount_value: 20,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "off-2",
    name: "Flat ₹500 OFF",
    discount_type: "FIXED",
    discount_value: 500,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "off-3",
    name: "15% OFF Birthday Special",
    discount_type: "PERCENT",
    discount_value: 15,
    is_active: true,
    created_at: new Date().toISOString(),
  },
];

const SEED_CUSTOMERS: Customer[] = [
  {
    id: "cust-1",
    name: "Aarav Sharma",
    phone: "9159600067",
    dob: "1998-10-13",
    address: "Anna Nagar, Chennai",
    created_at: new Date().toISOString(),
  },
  {
    id: "cust-2",
    name: "Priya Patel",
    phone: "9876543210",
    dob: "1996-10-14",
    address: "Race Course, Coimbatore",
    created_at: new Date().toISOString(),
  },
  {
    id: "cust-3",
    name: "Rohan Verma",
    phone: "9823456789",
    dob: "2001-10-20",
    address: "Salem Road, Namakkal",
    created_at: new Date().toISOString(),
  },
  {
    id: "cust-4",
    name: "Ananya Iyer",
    phone: "9443219876",
    dob: "1999-10-27",
    address: "T. Nagar, Chennai",
    created_at: new Date().toISOString(),
  },
  {
    id: "cust-5",
    name: "Karthik Sundaram",
    phone: "9884123456",
    dob: "1995-10-13",
    address: "Gandhipuram, Coimbatore",
    created_at: new Date().toISOString(),
  },
  {
    id: "cust-6",
    name: "Sneha Kulkarni",
    phone: "9845123456",
    dob: "1997-11-18",
    address: "Bypass Road, Madurai",
    created_at: new Date().toISOString(),
  },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

interface BirthdayPanelProps {
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
}

export default function BirthdayPanel({
  isSidebarOpen,
  onToggleSidebar,
}: BirthdayPanelProps = {}) {
  // Navigation tabs: Calendar | Customers
  const [activeTab, setActiveTab] = useState<"calendar" | "customers">("calendar");

  // Database status
  const [isDbConfigured, setIsDbConfigured] = useState<boolean | null>(null);
  const [dbStatusMsg, setDbStatusMsg] = useState<string>("");

  // Data states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string>("");
  const [messageTemplate, setMessageTemplate] = useState<string>(DEFAULT_TEMPLATE);

  // Loading & feedback states
  const [loading, setLoading] = useState<boolean>(false);
  const [savingTemplate, setSavingTemplate] = useState<boolean>(false);
  const [templateSavedToast, setTemplateSavedToast] = useState<boolean>(false);

  // Calendar State (defaults to current month or October for reference)
  const today = useMemo(() => new Date(), []);
  const [calendarYear, setCalendarYear] = useState<number>(today.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(today.getMonth()); // 0-indexed (9 = Oct)
  const [selectedDate, setSelectedDate] = useState<{ month: number; day: number } | null>({
    month: today.getMonth(),
    day: today.getDate(),
  });

  // Date Range Filter State
  const [rangePreset, setRangePreset] = useState<"today" | "week" | "month" | "all">("all");
  const [fromMonth, setFromMonth] = useState<number>(today.getMonth());
  const [fromDay, setFromDay] = useState<number>(today.getDate());
  const [toMonth, setToMonth] = useState<number>(today.getMonth());
  const [toDay, setToDay] = useState<number>(today.getDate());

  // Customer Selection for Sending Offers
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);

  // Modals
  const [showAddOfferModal, setShowAddOfferModal] = useState<boolean>(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [offerNameInput, setOfferNameInput] = useState<string>("");
  const [offerTypeInput, setOfferTypeInput] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [offerValueInput, setOfferValueInput] = useState<number | "">(20);
  const [offerSaving, setOfferSaving] = useState<boolean>(false);

  const [deleteConfirmOfferId, setDeleteConfirmOfferId] = useState<string | null>(null);

  // Send Offer Confirmation Modal
  const [showSendConfirmModal, setShowSendConfirmModal] = useState<boolean>(false);
  const [sendTargetCustomer, setSendTargetCustomer] = useState<Customer | null>(null);
  const [sendSuccessMsg, setSendSuccessMsg] = useState<string | null>(null);

  // Customers Tab States
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [customerMonthFilter, setCustomerMonthFilter] = useState<number | "ALL">("ALL");
  const [showCustomerModal, setShowCustomerModal] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [custNameInput, setCustNameInput] = useState<string>("");
  const [custPhoneInput, setCustPhoneInput] = useState<string>("");
  const [custDobMonth, setCustDobMonth] = useState<number>(today.getMonth());
  const [custDobDay, setCustDobDay] = useState<number>(today.getDate());
  const [custDobYear, setCustDobYear] = useState<string>("");
  const [custAddressInput, setCustAddressInput] = useState<string>("");
  const [custModalError, setCustModalError] = useState<string>("");
  const [custModalSaving, setCustModalSaving] = useState<boolean>(false);

  // Refresh data handler
  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const dbCheck = await checkDatabaseConfigured();
      setIsDbConfigured(dbCheck.configured);
      setDbStatusMsg(dbCheck.message);

      let loadedCustomers: Customer[] = [];
      let loadedOffers: Offer[] = [];
      let loadedSettings: BirthdaySettings | null = null;

      if (dbCheck.configured) {
        try {
          loadedCustomers = await fetchCustomers();
          loadedOffers = await fetchOffers();
          loadedSettings = await fetchBirthdaySettings();
        } catch (e) {
          console.error("Cloud DB fetch error, falling back:", e);
        }
      }

      if (typeof window !== "undefined") {
        if (!loadedCustomers || loadedCustomers.length === 0) {
          const cachedCust = localStorage.getItem("ul_birthday_customers");
          loadedCustomers = cachedCust ? JSON.parse(cachedCust) : SEED_CUSTOMERS;
        }
        if (!loadedOffers || loadedOffers.length === 0) {
          const cachedOffers = localStorage.getItem("ul_birthday_offers");
          loadedOffers = cachedOffers ? JSON.parse(cachedOffers) : SEED_OFFERS;
        }
        if (!loadedSettings) {
          const cachedTpl = localStorage.getItem("ul_birthday_template");
          const cachedOfferId = localStorage.getItem("ul_birthday_selected_offer");
          loadedSettings = {
            id: "default",
            message_template: cachedTpl || DEFAULT_TEMPLATE,
            selected_offer_id: cachedOfferId || null,
            updated_at: new Date().toISOString(),
          };
        }
      }

      setCustomers(loadedCustomers);
      setOffers(loadedOffers);
      if (loadedOffers.length > 0) {
        setSelectedOfferId(loadedSettings?.selected_offer_id || loadedOffers[0].id);
      }
      if (loadedSettings?.message_template) {
        setMessageTemplate(loadedSettings.message_template);
      }
    } catch (err) {
      console.error("Error loading birthday data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial mount data load
  useEffect(() => {
    let ignore = false;
    const loadInitialData = async () => {
      try {
        const dbCheck = await checkDatabaseConfigured();
        if (ignore) return;
        setIsDbConfigured(dbCheck.configured);
        setDbStatusMsg(dbCheck.message);

        let loadedCustomers: Customer[] = [];
        let loadedOffers: Offer[] = [];
        let loadedSettings: BirthdaySettings | null = null;

        if (dbCheck.configured) {
          try {
            loadedCustomers = await fetchCustomers();
            loadedOffers = await fetchOffers();
            loadedSettings = await fetchBirthdaySettings();
          } catch (e) {
            console.error("Cloud DB fetch error, falling back:", e);
          }
        }

        if (typeof window !== "undefined") {
          if (!loadedCustomers || loadedCustomers.length === 0) {
            const cachedCust = localStorage.getItem("ul_birthday_customers");
            loadedCustomers = cachedCust ? JSON.parse(cachedCust) : SEED_CUSTOMERS;
          }
          if (!loadedOffers || loadedOffers.length === 0) {
            const cachedOffers = localStorage.getItem("ul_birthday_offers");
            loadedOffers = cachedOffers ? JSON.parse(cachedOffers) : SEED_OFFERS;
          }
          if (!loadedSettings) {
            const cachedTpl = localStorage.getItem("ul_birthday_template");
            const cachedOfferId = localStorage.getItem("ul_birthday_selected_offer");
            loadedSettings = {
              id: "default",
              message_template: cachedTpl || DEFAULT_TEMPLATE,
              selected_offer_id: cachedOfferId || null,
              updated_at: new Date().toISOString(),
            };
          }
        }

        if (!ignore) {
          setCustomers(loadedCustomers);
          setOffers(loadedOffers);
          if (loadedOffers.length > 0) {
            setSelectedOfferId(loadedSettings?.selected_offer_id || loadedOffers[0].id);
          }
          if (loadedSettings?.message_template) {
            setMessageTemplate(loadedSettings.message_template);
          }
        }
      } catch (err) {
        console.error("Error loading birthday data on mount:", err);
      }
    };
    void loadInitialData();
    return () => {
      ignore = true;
    };
  }, []);

  // Persist demo changes to localStorage
  const persistLocalCustomers = (newList: Customer[]) => {
    setCustomers(newList);
    if (typeof window !== "undefined") {
      localStorage.setItem("ul_birthday_customers", JSON.stringify(newList));
    }
  };

  const persistLocalOffers = (newList: Offer[]) => {
    setOffers(newList);
    if (typeof window !== "undefined") {
      localStorage.setItem("ul_birthday_offers", JSON.stringify(newList));
    }
  };

  // Helper to parse DOB (supports "YYYY-MM-DD" or "MM-DD")
  const parseDob = (dobStr?: string | null): { month: number; day: number; year?: number } | null => {
    if (!dobStr) return null;
    const parts = dobStr.split("-");
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1; // 0-indexed
      const d = parseInt(parts[2], 10);
      if (!isNaN(m) && !isNaN(d)) return { month: m, day: d, year: y };
    } else if (parts.length === 2) {
      const m = parseInt(parts[0], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(m) && !isNaN(d)) return { month: m, day: d };
    }
    return null;
  };

  // Set of dates in current calendar month that have birthdays: day -> count
  const birthdayDaysInMonth = useMemo(() => {
    const map = new Map<number, number>();
    customers.forEach((c) => {
      const parsed = parseDob(c.dob);
      if (parsed && parsed.month === calendarMonth) {
        map.set(parsed.day, (map.get(parsed.day) || 0) + 1);
      }
    });
    return map;
  }, [customers, calendarMonth]);

  // Calendar calculations
  const firstDayOfWeek = useMemo(() => {
    // 0 = Sunday, 1 = Monday, etc.
    return new Date(calendarYear, calendarMonth, 1).getDay();
  }, [calendarYear, calendarMonth]);

  const daysInCurrentMonth = useMemo(() => {
    return new Date(calendarYear, calendarMonth + 1, 0).getDate();
  }, [calendarYear, calendarMonth]);

  // Filter matching customers based on active range
  const matchingCustomers = useMemo(() => {
    if (rangePreset === "all") {
      // Return all customers that have birthdays, sorted by month & day
      return [...customers]
        .filter((c) => Boolean(c.dob))
        .sort((a, b) => {
          const pa = parseDob(a.dob)!;
          const pb = parseDob(b.dob)!;
          if (pa.month !== pb.month) return pa.month - pb.month;
          return pa.day - pb.day;
        });
    }

    if (rangePreset === "today") {
      const tMonth = today.getMonth();
      const tDay = today.getDate();
      return customers.filter((c) => {
        const p = parseDob(c.dob);
        return p && p.month === tMonth && p.day === tDay;
      });
    }

    if (rangePreset === "month") {
      return customers.filter((c) => {
        const p = parseDob(c.dob);
        return p && p.month === calendarMonth;
      });
    }

    // Custom or "week": Check between from and to
    const fromVal = fromMonth * 100 + fromDay;
    const toVal = toMonth * 100 + toDay;

    return customers.filter((c) => {
      const p = parseDob(c.dob);
      if (!p) return false;
      const cVal = p.month * 100 + p.day;
      if (fromVal <= toVal) {
        return cVal >= fromVal && cVal <= toVal;
      } else {
        // Crosses year boundary (e.g. Dec to Jan)
        return cVal >= fromVal || cVal <= toVal;
      }
    });
  }, [customers, rangePreset, calendarMonth, fromMonth, fromDay, toMonth, toDay, today]);

  // Quick preset handlers
  const handlePresetSelect = (preset: "today" | "week" | "month" | "all") => {
    setRangePreset(preset);
    const tM = today.getMonth();
    const tD = today.getDate();

    if (preset === "today") {
      setFromMonth(tM);
      setFromDay(tD);
      setToMonth(tM);
      setToDay(tD);
      setSelectedDate({ month: tM, day: tD });
      setCalendarMonth(tM);
      setCalendarYear(today.getFullYear());
    } else if (preset === "week") {
      // 7 days window starting today
      setFromMonth(tM);
      setFromDay(tD);
      const nextWeek = new Date(today.getFullYear(), tM, tD + 6);
      setToMonth(nextWeek.getMonth());
      setToDay(nextWeek.getDate());
      setSelectedDate(null);
    } else if (preset === "month") {
      setFromMonth(calendarMonth);
      setFromDay(1);
      setToMonth(calendarMonth);
      setToDay(daysInCurrentMonth);
      setSelectedDate(null);
    } else if (preset === "all") {
      setSelectedDate(null);
    }
  };

  // Calendar Day Click Handler
  const handleCalendarDayClick = (day: number) => {
    setSelectedDate({ month: calendarMonth, day });
    setRangePreset("today");
    setFromMonth(calendarMonth);
    setFromDay(day);
    setToMonth(calendarMonth);
    setToDay(day);
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear((y) => y - 1);
    } else {
      setCalendarMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear((y) => y + 1);
    } else {
      setCalendarMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const tM = today.getMonth();
    setCalendarMonth(tM);
    setCalendarYear(today.getFullYear());
    handlePresetSelect("today");
  };

  // Active Offer Object
  const currentOffer = useMemo(() => {
    return offers.find((o) => o.id === selectedOfferId) || offers[0] || null;
  }, [offers, selectedOfferId]);

  // Live Message Preview generator
  const previewText = useMemo(() => {
    const sampleCustomer =
      matchingCustomers.find((c) => selectedCustomerIds.includes(c.id)) ||
      matchingCustomers[0] || { name: "Aarav" };

    const offerDisplay = currentOffer
      ? currentOffer.name
      : "20% OFF Birthday Special";

    return messageTemplate
      .replace(/{name}/g, sampleCustomer.name)
      .replace(/{offer}/g, offerDisplay);
  }, [messageTemplate, matchingCustomers, selectedCustomerIds, currentOffer]);

  // Save Message Template
  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      if (isDbConfigured) {
        await saveBirthdaySettingsAction(messageTemplate, selectedOfferId);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("ul_birthday_template", messageTemplate);
        localStorage.setItem("ul_birthday_selected_offer", selectedOfferId);
      }
      setTemplateSavedToast(true);
      setTimeout(() => setTemplateSavedToast(false), 3000);
    } catch (e) {
      console.error("Failed to save birthday settings:", e);
      alert("Failed to save message template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  // Offer CRUD Handlers
  const handleSaveOffer = async () => {
    const name = offerNameInput.trim();
    if (!name) return;
    const val = Number(offerValueInput) || 0;

    setOfferSaving(true);
    try {
      if (editingOffer) {
        // Edit
        if (isDbConfigured) {
          const updated = await editOffer(editingOffer.id, {
            name,
            discount_type: offerTypeInput,
            discount_value: val,
          });
          if (updated) {
            setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
          }
        } else {
          const updated: Offer = {
            ...editingOffer,
            name,
            discount_type: offerTypeInput,
            discount_value: val,
          };
          persistLocalOffers(offers.map((o) => (o.id === updated.id ? updated : o)));
        }
      } else {
        // Add
        if (isDbConfigured) {
          const created = await createOffer({
            name,
            discount_type: offerTypeInput,
            discount_value: val,
          });
          setOffers((prev) => [...prev, created]);
          setSelectedOfferId(created.id);
        } else {
          const created: Offer = {
            id: `off-${Date.now()}`,
            name,
            discount_type: offerTypeInput,
            discount_value: val,
            is_active: true,
            created_at: new Date().toISOString(),
          };
          persistLocalOffers([...offers, created]);
          setSelectedOfferId(created.id);
        }
      }
      setShowAddOfferModal(false);
      setEditingOffer(null);
      setOfferNameInput("");
      setOfferValueInput(20);
    } catch (e) {
      console.error("Save offer error:", e);
      alert("Failed to save offer.");
    } finally {
      setOfferSaving(false);
    }
  };

  const handleDeleteOffer = async (id: string) => {
    try {
      if (isDbConfigured) {
        await removeOffer(id);
      }
      const updated = offers.filter((o) => o.id !== id);
      persistLocalOffers(updated);
      if (selectedOfferId === id && updated.length > 0) {
        setSelectedOfferId(updated[0].id);
      }
      setDeleteConfirmOfferId(null);
    } catch (e) {
      console.error("Delete offer error:", e);
      alert("Failed to delete offer.");
    }
  };

  // Build Personalized Message for WhatsApp
  const buildPersonalizedMessage = (customerName: string): string => {
    const offerDisplay = currentOffer ? currentOffer.name : "Birthday Special";
    return messageTemplate
      .replace(/{name}/g, customerName)
      .replace(/{offer}/g, offerDisplay);
  };

  // WhatsApp click-to-chat fallback
  const executeSendWhatsApp = (targetCustomer: Customer) => {
    const text = buildPersonalizedMessage(targetCustomer.name);
    const cleanPhone = targetCustomer.phone.replace(/\D/g, "");
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;

    if (isDbConfigured) {
      void recordBirthdaySend({
        customer_id: targetCustomer.id,
        customer_name: targetCustomer.name,
        customer_phone: targetCustomer.phone,
        offer_name: currentOffer?.name || "Standard Offer",
        message: text,
        status: "SENT",
      });
    }

    if (typeof window !== "undefined") {
      window.open(url, "_blank");
    }
  };

  // Confirm Send Offer
  const handleConfirmSendOffers = () => {
    if (sendTargetCustomer) {
      executeSendWhatsApp(sendTargetCustomer);
      setSendSuccessMsg(`WhatsApp chat opened for ${sendTargetCustomer.name}`);
      setTimeout(() => setSendSuccessMsg(null), 5000);
      setShowSendConfirmModal(false);
      setSendTargetCustomer(null);
      return;
    }

    const selectedCusts = customers.filter((c) => selectedCustomerIds.includes(c.id));
    if (selectedCusts.length === 0) return;

    if (selectedCusts.length === 1) {
      executeSendWhatsApp(selectedCusts[0]);
      setSendSuccessMsg(`WhatsApp chat opened for ${selectedCusts[0].name}`);
    } else {
      executeSendWhatsApp(selectedCusts[0]);
      setSendSuccessMsg(
        `WhatsApp chat opened for ${selectedCusts[0].name} (1/${selectedCusts.length}). Browser popup controls require sending individually via click-to-chat.`
      );
    }
    setTimeout(() => setSendSuccessMsg(null), 6000);
    setShowSendConfirmModal(false);
  };

  // Customers Tab CRUD
  const handleSaveCustomer = async () => {
    const name = custNameInput.trim();
    const phone = custPhoneInput.replace(/\D/g, "").slice(-10);
    if (!name) {
      setCustModalError("Customer name is required");
      return;
    }
    if (!phone || phone.length < 10) {
      setCustModalError("A valid 10-digit mobile number is required");
      return;
    }

    // Format DOB as YYYY-MM-DD (or 2000-MM-DD if year omitted)
    const y = custDobYear.trim() ? custDobYear.trim() : "2000";
    const m = String(custDobMonth + 1).padStart(2, "0");
    const d = String(custDobDay).padStart(2, "0");
    const formattedDob = `${y}-${m}-${d}`;

    setCustModalSaving(true);
    setCustModalError("");

    try {
      if (editingCustomer) {
        if (isDbConfigured) {
          const updated = await editCustomer(editingCustomer.id, {
            name,
            phone,
            address: custAddressInput.trim() || null,
            dob: formattedDob,
          });
          if (updated) {
            setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          }
        } else {
          const updated: Customer = {
            ...editingCustomer,
            name,
            phone,
            address: custAddressInput.trim() || null,
            dob: formattedDob,
          };
          persistLocalCustomers(customers.map((c) => (c.id === updated.id ? updated : c)));
        }
      } else {
        // Check duplicate phone
        if (customers.some((c) => c.phone.replace(/\D/g, "").slice(-10) === phone)) {
          setCustModalError("A customer with this phone number already exists.");
          setCustModalSaving(false);
          return;
        }

        if (isDbConfigured) {
          const created = await createCustomer({
            name,
            phone,
            address: custAddressInput.trim() || null,
            dob: formattedDob,
          });
          setCustomers((prev) => [created, ...prev]);
        } else {
          const created: Customer = {
            id: `cust-${Date.now()}`,
            name,
            phone,
            address: custAddressInput.trim() || null,
            dob: formattedDob,
            created_at: new Date().toISOString(),
          };
          persistLocalCustomers([created, ...customers]);
        }
      }

      setShowCustomerModal(false);
      setEditingCustomer(null);
    } catch (e) {
      console.error("Save customer error:", e);
      setCustModalError(e instanceof Error ? e.message : "Failed to save customer");
    } finally {
      setCustModalSaving(false);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Are you sure you want to remove this customer?")) return;
    try {
      if (isDbConfigured) {
        await removeCustomer(id);
      }
      persistLocalCustomers(customers.filter((c) => c.id !== id));
      setSelectedCustomerIds((prev) => prev.filter((cid) => cid !== id));
    } catch (e) {
      console.error("Error removing customer:", e);
      alert("Failed to delete customer.");
    }
  };

  const openAddCustomerModal = () => {
    setEditingCustomer(null);
    setCustNameInput("");
    setCustPhoneInput("");
    setCustDobMonth(calendarMonth);
    setCustDobDay(today.getDate());
    setCustDobYear("");
    setCustAddressInput("");
    setCustModalError("");
    setShowCustomerModal(true);
  };

  const openEditCustomerModal = (c: Customer) => {
    setEditingCustomer(c);
    setCustNameInput(c.name);
    setCustPhoneInput(c.phone);
    const parsed = parseDob(c.dob);
    if (parsed) {
      setCustDobMonth(parsed.month);
      setCustDobDay(parsed.day);
      setCustDobYear(parsed.year && parsed.year !== 2000 ? String(parsed.year) : "");
    } else {
      setCustDobMonth(today.getMonth());
      setCustDobDay(today.getDate());
      setCustDobYear("");
    }
    setCustAddressInput(c.address || "");
    setCustModalError("");
    setShowCustomerModal(true);
  };

  // Filtered customer list for the Customers tab
  const filteredCustomersList = useMemo(() => {
    return customers.filter((c) => {
      const q = customerSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.address && c.address.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (customerMonthFilter !== "ALL") {
        const parsed = parseDob(c.dob);
        return parsed && parsed.month === customerMonthFilter;
      }
      return true;
    });
  }, [customers, customerSearch, customerMonthFilter]);

  return (
    <div className="birthday-dashboard text-black font-sans w-full max-w-[1400px] mx-auto animate-in fade-in duration-300">
      {/* Toast Notification */}
      {templateSavedToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold animate-bounce">
          <Check className="w-4 h-4" /> Message template saved successfully!
        </div>
      )}

      {sendSuccessMsg && (
        <div className="fixed top-5 right-5 z-50 bg-amber-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold">
          <MessageCircle className="w-4 h-4" /> {sendSuccessMsg}
        </div>
      )}

      {/* Top Header & DB Diagnostic Banner */}
      <div className="w-full mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#C5A059]/20">
          <div className="flex items-center gap-3.5">
            {!isSidebarOpen && onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="w-10 h-10 rounded-xl bg-[#181820] border border-[#C5A059]/30 hover:border-[var(--accent)] hover:bg-[#202028] flex items-center justify-center text-[var(--accent)] shadow-xs mr-1 transition-colors cursor-pointer shrink-0"
                title="Open Menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] shadow-xs shrink-0">
              <Gift className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#FAF7F2] tracking-tight">
                Date of Birth
              </h1>
              <p className="text-xs sm:text-sm font-medium text-[#B8B5AE] mt-0.5">
                Customer birthdays &amp; one-tap offer sender
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status indicator */}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                isDbConfigured
                  ? "bg-emerald-950/60 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-950/60 text-amber-400 border-amber-500/30"
              }`}
              title={dbStatusMsg}
            >
              <Database className="w-3.5 h-3.5" />
              {isDbConfigured ? "PostgreSQL Active" : "Local Mode (Demo)"}
            </span>

            <button
              onClick={handleRefresh}
              title="Refresh birthday records"
              className="p-2.5 text-[#B8B5AE] hover:text-[#FAF7F2] bg-[#181820] hover:bg-[#22222E] rounded-xl border border-[#C5A059]/25 transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Tab switchers: Calendar & Customers */}
        <div className="flex items-center gap-8 mt-4 border-b border-[#C5A059]/20">
          <button
            onClick={() => setActiveTab("calendar")}
            className={`pb-3 text-sm sm:text-base font-bold tracking-wide transition-all cursor-pointer relative ${
              activeTab === "calendar"
                ? "text-[var(--accent)] border-b-2 border-[var(--accent)] font-black"
                : "text-[#B8B5AE] hover:text-[#FAF7F2]"
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setActiveTab("customers")}
            className={`pb-3 text-sm sm:text-base font-bold tracking-wide transition-all cursor-pointer relative ${
              activeTab === "customers"
                ? "text-[var(--accent)] border-b-2 border-[var(--accent)] font-black"
                : "text-[#B8B5AE] hover:text-[#FAF7F2]"
            }`}
          >
            Customers
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full">
        {/* ============================================================== */}
        {/* CALENDAR TAB VIEW (Reference Layout from Screenshot)           */}
        {/* ============================================================== */}
        {activeTab === "calendar" && (
          <div className="flex flex-col lg:flex-row gap-6 w-full items-start">
            {/* LEFT COLUMN: Calendar & Range Picker (Fixed ~285px-295px matching reference) */}
            <div className="w-full lg:w-[285px] xl:w-[295px] shrink-0 space-y-5">
              {/* Monthly Calendar Card */}
              <div className="bg-[#131317] rounded-2xl border border-[#C5A059]/25 shadow-md p-4 sm:p-4.5">
                {/* Calendar Navigation Top Bar */}
                <div className="flex items-center justify-between mb-3.5">
                  <div className="relative">
                    <select
                      value={calendarMonth}
                      onChange={(e) => setCalendarMonth(Number(e.target.value))}
                      className="appearance-none bg-[#181820] text-[#FAF7F2] border border-[#C5A059]/30 rounded-lg pl-2.5 pr-7 py-1.5 text-xs font-bold focus:outline-none focus:border-[var(--accent)] cursor-pointer shadow-xs"
                    >
                      {SHORT_MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx}>
                          {m} {calendarYear}
                        </option>
                      ))}
                    </select>
                    <ChevronRight className="w-3.5 h-3.5 text-[#B8B5AE] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none rotate-90" />
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={handlePrevMonth}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#181820] hover:bg-[#22222E] text-[#FAF7F2] border border-[#C5A059]/30 transition-colors cursor-pointer"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleJumpToToday}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#181820] hover:bg-[#22222E] text-[var(--accent)] border border-[#C5A059]/30 transition-colors cursor-pointer"
                    >
                      Today
                    </button>
                    <button
                      onClick={handleNextMonth}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#181820] hover:bg-[#22222E] text-[#FAF7F2] border border-[#C5A059]/30 transition-colors cursor-pointer"
                      title="Next Month"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Day Headers (Sun - Sat) */}
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
                    <span key={i} className="text-[11px] font-bold text-[#B8B5AE] py-0.5">
                      {d}
                    </span>
                  ))}
                </div>

                {/* Days Grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {/* Empty cells for leading offset */}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-8 sm:h-8.5" />
                  ))}

                  {/* Day numbers */}
                  {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                    const day = i + 1;
                    const hasBirthdays = birthdayDaysInMonth.has(day);
                    const isSelected =
                      selectedDate &&
                      selectedDate.month === calendarMonth &&
                      selectedDate.day === day;
                    const isToday =
                      today.getDate() === day &&
                      today.getMonth() === calendarMonth &&
                      today.getFullYear() === calendarYear;

                    return (
                      <button
                        key={day}
                        onClick={() => handleCalendarDayClick(day)}
                        className={`h-8 sm:h-8.5 rounded-lg flex flex-col items-center justify-center relative text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? "border-2 border-[var(--accent)] bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black shadow-sm"
                            : isToday
                            ? "border border-[#C5A059]/60 text-[var(--accent)] bg-[#C5A059]/10"
                            : "hover:bg-[#22222E] text-[#FAF7F2] border border-white/5 bg-[#181820]"
                        }`}
                      >
                        <span>{day}</span>
                        {/* Red birthday indicator dot */}
                        {hasBirthdays && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-red-500 absolute bottom-0.5 shadow-xs"
                            title={`${birthdayDaysInMonth.get(day)} birthday(s)`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Legend at bottom */}
                <div className="flex items-center gap-1.5 text-xs font-medium text-[#B8B5AE] mt-3 pt-2.5 border-t border-white/5">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span>Dot = birthday</span>
                </div>
              </div>

              {/* Step 1 · Pick a date or range card */}
              <div className="bg-[#131317] rounded-2xl border border-[#C5A059]/25 shadow-md p-4 sm:p-4.5">
                <h3 className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider mb-2.5">
                  Step 1 · Pick a date or range
                </h3>

                {/* Presets: Today, This Week, This Month, All */}
                <div className="flex items-center gap-1.5 mb-3.5 flex-wrap">
                  {(["today", "week", "month", "all"] as const).map((preset) => {
                    const labels = {
                      today: "Today",
                      week: "This Week",
                      month: "This Month",
                      all: "All",
                    };
                    const isActive = rangePreset === preset;
                    return (
                      <button
                        key={preset}
                        onClick={() => handlePresetSelect(preset)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          isActive
                            ? "bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black shadow-sm"
                            : "bg-[#181820] text-[#FAF7F2]/80 hover:bg-[#22222E] border border-white/5"
                        }`}
                      >
                        {labels[preset]}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Date Range Selectors (FROM / TO) */}
                <div className="space-y-3 pt-2.5 border-t border-white/5">
                  {/* FROM */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#B8B5AE] mb-1">
                      From
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={fromMonth}
                        onChange={(e) => {
                          setFromMonth(Number(e.target.value));
                          setRangePreset("week");
                        }}
                        className="h-9 bg-[#181820] border border-[#C5A059]/30 rounded-lg px-2 text-xs font-semibold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] cursor-pointer shadow-xs"
                      >
                        {MONTH_NAMES.map((m, idx) => (
                          <option key={m} value={idx}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        value={fromDay}
                        onChange={(e) => {
                          setFromDay(Number(e.target.value));
                          setRangePreset("week");
                        }}
                        className="h-9 bg-[#181820] border border-[#C5A059]/30 rounded-lg px-2 text-xs font-semibold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] cursor-pointer shadow-xs"
                      >
                        {Array.from({ length: DAYS_IN_MONTH[fromMonth] }).map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* TO */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#B8B5AE] mb-1">
                      To
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={toMonth}
                        onChange={(e) => {
                          setToMonth(Number(e.target.value));
                          setRangePreset("week");
                        }}
                        className="h-9 bg-[#181820] border border-[#C5A059]/30 rounded-lg px-2 text-xs font-semibold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] cursor-pointer shadow-xs"
                      >
                        {MONTH_NAMES.map((m, idx) => (
                          <option key={m} value={idx}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <select
                        value={toDay}
                        onChange={(e) => {
                          setToDay(Number(e.target.value));
                          setRangePreset("week");
                        }}
                        className="h-9 bg-[#181820] border border-[#C5A059]/30 rounded-lg px-2 text-xs font-semibold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] cursor-pointer shadow-xs"
                      >
                        {Array.from({ length: DAYS_IN_MONTH[toMonth] }).map((_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Customers with birthdays & Offer message editor (Fills remaining width) */}
            <div className="flex-1 min-w-0 w-full space-y-6">
              {/* Step 2 · Customers with birthdays Card */}
              <div className="bg-[#131317] rounded-2xl border border-[#C5A059]/25 shadow-md p-5 sm:p-6">
                <div className="flex items-center justify-between mb-1.5">
                  <h2 className="text-base sm:text-lg font-black text-[#FAF7F2] tracking-tight">
                    Step 2 · Customers with birthdays ({matchingCustomers.length})
                  </h2>
                  {matchingCustomers.length > 0 && (
                    <button
                      onClick={() => {
                        if (selectedCustomerIds.length === matchingCustomers.length) {
                          setSelectedCustomerIds([]);
                        } else {
                          setSelectedCustomerIds(matchingCustomers.map((c) => c.id));
                        }
                      }}
                      className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      {selectedCustomerIds.length === matchingCustomers.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  )}
                </div>
                <p className="text-xs sm:text-sm font-medium text-[#B8B5AE] mb-4">
                  Pick a date or range on the left, then tap Send Offer on a customer.
                </p>

                {/* Empty State */}
                {matchingCustomers.length === 0 ? (
                  <div className="py-12 text-center bg-[#181820]/70 rounded-xl border border-white/5">
                    <p className="text-sm font-medium text-[#B8B5AE]">
                      No birthdays found for this range
                    </p>
                    <button
                      onClick={() => handlePresetSelect("all")}
                      className="mt-2 text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      View All Birthdays
                    </button>
                  </div>
                ) : (
                  /* Customer records list: Dark charcoal rows with gold borders */
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {matchingCustomers.map((cust) => {
                      const isSelected = selectedCustomerIds.includes(cust.id);
                      const parsed = parseDob(cust.dob);
                      const birthdayLabel = parsed
                        ? `${parsed.day} ${SHORT_MONTH_NAMES[parsed.month]}`
                        : "No date";

                      return (
                        <div
                          key={cust.id}
                          className={`p-3.5 sm:p-4 rounded-xl border transition-all flex items-center justify-between gap-3.5 shadow-xs ${
                            isSelected
                              ? "bg-[#1E1E28] border-[var(--accent)]/70 ring-1 ring-[var(--accent)]/30"
                              : "bg-[#181820] border-white/5 hover:border-[#C5A059]/30"
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCustomerIds((prev) => [...prev, cust.id]);
                                } else {
                                  setSelectedCustomerIds((prev) =>
                                    prev.filter((id) => id !== cust.id)
                                  );
                                }
                              }}
                              className="w-4.5 h-4.5 rounded accent-[var(--accent)] cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-sm sm:text-base font-bold text-[#FAF7F2] flex items-center gap-2 flex-wrap">
                                <span className="truncate">{cust.name}</span>
                                <span className="text-xs font-bold text-[var(--accent)] bg-[#C5A059]/15 border border-[#C5A059]/30 px-2 py-0.5 rounded-full inline-flex items-center gap-1 shrink-0">
                                  🎂 {birthdayLabel}
                                </span>
                              </div>
                              <div className="text-xs sm:text-sm text-[#B8B5AE] font-mono mt-0.5">
                                +91 {cust.phone}
                                {cust.address && (
                                  <span className="text-[#8E8B85] font-sans ml-2 text-xs truncate">
                                    • {cust.address}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSendTargetCustomer(cust);
                              setShowSendConfirmModal(true);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
                          >
                            <Send className="w-3.5 h-3.5 text-emerald-400" />
                            Send Offer
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 3 · Customise offer message Card */}
              <div className="bg-[#131317] rounded-2xl border border-[#C5A059]/25 shadow-md p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/30 flex items-center justify-center text-[var(--accent)] shrink-0">
                      <Gift className="w-5 h-5 text-[var(--accent)]" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-[#FAF7F2] tracking-tight">
                        Step 3 · Customise offer message
                      </h3>
                      <p className="text-xs sm:text-sm text-[#B8B5AE] font-medium mt-0.5">
                        Sent on WhatsApp when you tap &quot;Send Offer&quot;.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate}
                    className="px-4 py-2 rounded-xl bg-[#181820] hover:bg-[#22222E] text-[#FAF7F2] border border-[#C5A059]/30 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  >
                    <Save className="w-4 h-4 text-[var(--accent)]" />
                    {savingTemplate ? "Saving..." : "Save"}
                  </button>
                </div>

                {/* SELECT OFFER */}
                <div className="mb-5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#B8B5AE] mb-2">
                    Select Offer
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedOfferId}
                      onChange={(e) => setSelectedOfferId(e.target.value)}
                      className="flex-1 h-11 bg-[#181820] border border-[#C5A059]/30 rounded-xl px-3.5 text-sm font-bold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] cursor-pointer shadow-xs"
                    >
                      {offers.map((off) => (
                        <option key={off.id} value={off.id}>
                          {off.name}
                        </option>
                      ))}
                    </select>

                    {currentOffer && (
                      <>
                        <button
                          onClick={() => {
                            setEditingOffer(currentOffer);
                            setOfferNameInput(currentOffer.name);
                            setOfferTypeInput(currentOffer.discount_type);
                            setOfferValueInput(currentOffer.discount_value);
                            setShowAddOfferModal(true);
                          }}
                          className="w-11 h-11 flex items-center justify-center rounded-xl bg-[#181820] hover:bg-[#22222E] border border-[#C5A059]/30 text-[var(--accent)] transition-colors cursor-pointer shadow-xs"
                          title="Edit selected offer"
                        >
                          <Pencil className="w-4 h-4 text-[var(--accent)]" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirmOfferId(currentOffer.id)}
                          className="w-11 h-11 flex items-center justify-center rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-400 transition-colors cursor-pointer shadow-xs"
                          title="Delete selected offer"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </>
                    )}
                  </div>

                  {/* + Add Offer Dashed Button */}
                  <button
                    onClick={() => {
                      setEditingOffer(null);
                      setOfferNameInput("");
                      setOfferTypeInput("PERCENT");
                      setOfferValueInput(20);
                      setShowAddOfferModal(true);
                    }}
                    className="w-full mt-3 h-11 border border-dashed border-[#C5A059]/40 hover:border-[var(--accent)] rounded-xl text-[var(--accent)] hover:bg-[#C5A059]/10 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Offer
                  </button>
                </div>

                {/* CUSTOMIZE MESSAGE */}
                <div className="mb-5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#B8B5AE] mb-2">
                    Customize Message
                  </label>
                  <textarea
                    rows={7}
                    value={messageTemplate}
                    onChange={(e) => setMessageTemplate(e.target.value)}
                    className="w-full bg-[#181820] border border-[#C5A059]/30 rounded-xl p-3.5 text-sm text-[#FAF7F2] leading-relaxed font-sans focus:outline-none focus:border-[var(--accent)] shadow-xs resize-y"
                  />
                  <p className="text-xs text-[#8E8B85] mt-1.5">
                    Use <span className="font-mono text-[var(--accent)] font-bold">&#123;name&#125;</span> for customer name and{" "}
                    <span className="font-mono text-[var(--accent)] font-bold">&#123;offer&#125;</span> for selected offer.
                  </p>
                </div>

                {/* MESSAGE PREVIEW - Authentic WhatsApp Chat Bubble */}
                <div className="whatsapp-preview-card bg-[#EFEAE2] border border-[#D1C7B7] rounded-2xl p-4 sm:p-5 shadow-inner">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-[#075E54] flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4 text-[#25D366] fill-[#25D366]" />
                      WhatsApp Message Preview
                    </span>
                    <span className="text-[10px] font-bold text-[#667781] bg-black/5 px-2.5 py-0.5 rounded-full">
                      End-to-end encrypted
                    </span>
                  </div>

                  <div className="whatsapp-bubble max-w-[95%] sm:max-w-[85%] ml-auto bg-[#D9FDD3] border border-[#C2E7BD] rounded-2xl rounded-tr-xs p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
                    <div className="text-[13.5px] sm:text-sm text-[#111B21] font-medium whitespace-pre-line leading-relaxed font-sans select-text">
                      {previewText}
                    </div>
                    <div className="flex items-center justify-end gap-1 text-[11px] text-[#667781] mt-2 font-medium select-none">
                      <span>10:30 AM</span>
                      <span className="text-[#53BDEB] font-bold text-xs tracking-tighter">✓✓</span>
                    </div>
                  </div>
                </div>

                {/* Global Send Offer Button (when multiple selected) */}
                {selectedCustomerIds.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-[#B8B5AE]">
                      {selectedCustomerIds.length} customer(s) selected
                    </span>
                    <button
                      onClick={() => {
                        setSendTargetCustomer(null);
                        setShowSendConfirmModal(true);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      Send Offer to Selected ({selectedCustomerIds.length})
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* CUSTOMERS TAB VIEW                                             */}
        {/* ============================================================== */}
        {activeTab === "customers" && (
          <div className="space-y-6 w-full">
            <div className="bg-[#131317] rounded-2xl border border-[#C5A059]/25 shadow-md p-5 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-[#FAF7F2] tracking-tight">
                    Customer Birthday Records
                  </h2>
                  <p className="text-xs sm:text-sm text-[#B8B5AE] font-medium mt-0.5">
                    Manage customer birthdays, phone contacts, and special offers.
                  </p>
                </div>

                <button
                  onClick={openAddCustomerModal}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] font-black text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Add Customer
                </button>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-center gap-3 mb-6">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-[#B8B5AE] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search by customer name, phone, or address..."
                    className="w-full h-11 bg-[#181820] border border-[#C5A059]/30 rounded-xl pl-10 pr-4 text-sm font-medium text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] shadow-xs"
                  />
                </div>

                <div className="w-full sm:w-auto">
                  <select
                    value={customerMonthFilter}
                    onChange={(e) =>
                      setCustomerMonthFilter(
                        e.target.value === "ALL" ? "ALL" : Number(e.target.value)
                      )
                    }
                    className="w-full sm:w-auto h-11 bg-[#181820] border border-[#C5A059]/30 rounded-xl px-4 text-sm font-bold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] cursor-pointer shadow-xs"
                  >
                    <option value="ALL">All Birthday Months</option>
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Customers Table */}
              <div className="overflow-x-auto border border-[#C5A059]/20 rounded-xl">
                <table className="w-full text-left border-collapse min-w-[650px]">
                  <thead>
                    <tr className="bg-[#181820] border-b border-[#C5A059]/25 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Phone</th>
                      <th className="py-3.5 px-4">Date of Birth</th>
                      <th className="py-3.5 px-4">Address</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredCustomersList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-sm text-[#B8B5AE] font-medium">
                          No matching customer records found.
                        </td>
                      </tr>
                    ) : (
                      filteredCustomersList.map((cust) => {
                        const parsed = parseDob(cust.dob);
                        const dobDisplay = parsed
                          ? `${parsed.day} ${SHORT_MONTH_NAMES[parsed.month]}${
                              parsed.year && parsed.year !== 2000 ? ` ${parsed.year}` : ""
                            }`
                          : "Not set";

                        return (
                          <tr key={cust.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--accent)] font-bold text-xs flex items-center justify-center shrink-0">
                                  {cust.name.slice(0, 2).toUpperCase()}
                                </div>
                                <span className="text-sm font-bold text-[#FAF7F2]">{cust.name}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-sm font-mono text-[#B8B5AE]">
                              +91 {cust.phone}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] bg-[#C5A059]/15 border border-[#C5A059]/30 px-2.5 py-1 rounded-full">
                                🎂 {dobDisplay}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-sm text-[#B8B5AE] max-w-[220px] truncate">
                              {cust.address || "—"}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setSendTargetCustomer(cust);
                                    setShowSendConfirmModal(true);
                                  }}
                                  className="p-2 text-emerald-400 hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer"
                                  title="Send Birthday Offer"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openEditCustomerModal(cust)}
                                  className="p-2 text-[var(--accent)] hover:bg-[#C5A059]/15 rounded-lg transition-colors cursor-pointer"
                                  title="Edit Customer"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCustomer(cust.id)}
                                  className="p-2 text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                  title="Delete Customer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT OFFER                                        */}
      {/* ============================================================== */}
      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT OFFER                                        */}
      {/* ============================================================== */}
      {showAddOfferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#131317] rounded-2xl border border-[#C5A059]/30 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 text-[#FAF7F2]">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#C5A059]/20 mb-5">
              <h3 className="text-base font-black text-[#FAF7F2] tracking-tight">
                {editingOffer ? "Edit Offer" : "Add New Offer"}
              </h3>
              <button
                onClick={() => setShowAddOfferModal(false)}
                className="p-1.5 text-[#B8B5AE] hover:text-[#FAF7F2] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#B8B5AE] mb-1.5">
                  Offer Display Name *
                </label>
                <input
                  type="text"
                  value={offerNameInput}
                  onChange={(e) => setOfferNameInput(e.target.value)}
                  placeholder="e.g. 20% OFF or ₹500 Birthday Voucher"
                  className="w-full h-11 bg-[#181820] border border-[#C5A059]/30 rounded-xl px-3.5 text-sm font-semibold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] shadow-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#B8B5AE] mb-1.5">
                    Discount Type
                  </label>
                  <select
                    value={offerTypeInput}
                    onChange={(e) => setOfferTypeInput(e.target.value as "PERCENT" | "FIXED")}
                    className="w-full h-11 bg-[#181820] border border-[#C5A059]/30 rounded-xl px-3 text-sm font-semibold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] cursor-pointer shadow-xs"
                  >
                    <option value="PERCENT">Percentage (%)</option>
                    <option value="FIXED">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#B8B5AE] mb-1.5">
                    Value
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={offerValueInput}
                    onChange={(e) =>
                      setOfferValueInput(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="w-full h-11 bg-[#181820] border border-[#C5A059]/30 rounded-xl px-3.5 text-sm font-semibold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] shadow-xs"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddOfferModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-[#B8B5AE] hover:text-[#FAF7F2] bg-[#181820] hover:bg-[#22222E] border border-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveOffer}
                  disabled={offerSaving || !offerNameInput.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] text-xs sm:text-sm font-black transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {offerSaving ? "Saving..." : editingOffer ? "Update Offer" : "Create Offer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: DELETE OFFER CONFIRMATION                               */}
      {/* ============================================================== */}
      {deleteConfirmOfferId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#131317] rounded-2xl border border-[#C5A059]/30 shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 text-[#FAF7F2]">
            <h3 className="text-base font-black text-[#FAF7F2] mb-2">Delete this offer?</h3>
            <p className="text-sm text-[#B8B5AE] mb-6">
              Are you sure you want to delete this offer? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDeleteConfirmOfferId(null)}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-[#B8B5AE] hover:text-[#FAF7F2] bg-[#181820] hover:bg-[#22222E] border border-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteOffer(deleteConfirmOfferId)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-bold cursor-pointer shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: SEND OFFER CONFIRMATION (WhatsApp fallback disclosure)  */}
      {/* ============================================================== */}
      {showSendConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#131317] rounded-2xl border border-[#C5A059]/30 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 text-[#FAF7F2]">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#C5A059]/20 mb-4">
              <h3 className="text-base font-black text-[#FAF7F2] tracking-tight flex items-center gap-2">
                <Send className="w-4 h-4 text-[var(--accent)]" />
                Confirm Send Offer
              </h3>
              <button
                onClick={() => setShowSendConfirmModal(false)}
                className="p-1.5 text-[#B8B5AE] hover:text-[#FAF7F2] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-[#B8B5AE] mb-1">
                  Recipient(s)
                </span>
                <p className="text-sm font-bold text-[#FAF7F2]">
                  {sendTargetCustomer
                    ? `${sendTargetCustomer.name} (+91 ${sendTargetCustomer.phone})`
                    : `${selectedCustomerIds.length} customer(s) selected`}
                </p>
              </div>

              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-[#B8B5AE] mb-1">
                  Offer
                </span>
                <p className="text-sm font-bold text-[var(--accent)]">
                  {currentOffer?.name || "Standard Birthday Special"}
                </p>
              </div>

              {/* Message Sample */}
              <div className="whatsapp-preview-card bg-[#EFEAE2] border border-[#D1C7B7] rounded-xl p-3 sm:p-3.5 shadow-inner">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#075E54] mb-2">
                  <MessageCircle className="w-3.5 h-3.5 text-[#25D366] fill-[#25D366]" />
                  <span>WhatsApp Message Preview</span>
                </div>
                <div className="whatsapp-bubble bg-[#D9FDD3] border border-[#C2E7BD] rounded-xl rounded-tr-xs p-3.5 shadow-xs">
                  <div className="text-sm text-[#111B21] font-medium whitespace-pre-line leading-relaxed font-sans select-text">
                    {buildPersonalizedMessage(sendTargetCustomer?.name || "Customer Name")}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-[10.5px] text-[#667781] mt-1.5 font-medium select-none">
                    <span>10:30 AM</span>
                    <span className="text-[#53BDEB] font-bold text-xs tracking-tighter">✓✓</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-[#C5A059]/10 rounded-xl border border-[#C5A059]/30 text-xs text-[#FAF7F2]/90 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <span>
                  WhatsApp Business API credentials are not configured on this server. Tapping confirm will open a verified WhatsApp click-to-chat window with this customer and message pre-filled.
                </span>
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowSendConfirmModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-[#B8B5AE] hover:text-[#FAF7F2] bg-[#181820] hover:bg-[#22222E] border border-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSendOffers}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" /> Open WhatsApp Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT CUSTOMER                                     */}
      {/* ============================================================== */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#131317] rounded-2xl border border-[#C5A059]/30 shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 text-[#FAF7F2]">
            <div className="flex items-center justify-between pb-3.5 border-b border-[#C5A059]/20 mb-4">
              <h3 className="text-base font-black text-[#FAF7F2] tracking-tight">
                {editingCustomer ? "Edit Customer" : "Add New Customer"}
              </h3>
              <button
                onClick={() => setShowCustomerModal(false)}
                className="p-1.5 text-[#B8B5AE] hover:text-[#FAF7F2] rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {custModalError && (
              <div className="mb-4 p-3 bg-red-950/60 text-red-300 border border-red-500/40 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {custModalError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#B8B5AE] mb-1.5">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={custNameInput}
                  onChange={(e) => setCustNameInput(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="w-full h-11 bg-[#181820] border border-[#C5A059]/30 rounded-xl px-3.5 text-sm font-semibold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] shadow-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#B8B5AE] mb-1.5">
                  Phone Number (10 digits) *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[#B8B5AE] bg-[#181820] border border-[#C5A059]/30 px-3 py-2.5 rounded-xl">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    value={custPhoneInput}
                    onChange={(e) => setCustPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="9159600067"
                    className="flex-1 h-11 bg-[#181820] border border-[#C5A059]/30 rounded-xl px-3.5 text-sm font-semibold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] font-mono shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#B8B5AE] mb-1.5">
                  Date of Birth *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={custDobMonth}
                    onChange={(e) => setCustDobMonth(Number(e.target.value))}
                    className="h-11 bg-[#181820] border border-[#C5A059]/30 rounded-xl px-3 text-xs sm:text-sm font-semibold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] cursor-pointer shadow-xs"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx}>
                        {m}
                      </option>
                    ))}
                  </select>

                  <select
                    value={custDobDay}
                    onChange={(e) => setCustDobDay(Number(e.target.value))}
                    className="h-11 bg-[#181820] border border-[#C5A059]/30 rounded-xl px-3 text-xs sm:text-sm font-semibold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] cursor-pointer shadow-xs"
                  >
                    {Array.from({ length: DAYS_IN_MONTH[custDobMonth] }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Day {i + 1}
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    min="1930"
                    max={today.getFullYear()}
                    value={custDobYear}
                    onChange={(e) => setCustDobYear(e.target.value)}
                    placeholder="Year (opt)"
                    className="h-11 bg-[#181820] border border-[#C5A059]/30 rounded-xl px-3 text-xs sm:text-sm font-semibold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] shadow-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#B8B5AE] mb-1.5">
                  Address (Optional)
                </label>
                <input
                  type="text"
                  value={custAddressInput}
                  onChange={(e) => setCustAddressInput(e.target.value)}
                  placeholder="e.g. Salem Road, Namakkal"
                  className="w-full h-11 bg-[#181820] border border-[#C5A059]/30 rounded-xl px-3.5 text-sm font-semibold text-[#FAF7F2] focus:outline-none focus:border-[var(--accent)] shadow-xs"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2.5 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-[#B8B5AE] hover:text-[#FAF7F2] bg-[#181820] hover:bg-[#22222E] border border-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomer}
                  disabled={custModalSaving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--accent)] via-[#D4AF37] to-[var(--accent)] text-[#0C0C0E] text-xs sm:text-sm font-black transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {custModalSaving ? "Saving..." : editingCustomer ? "Update Customer" : "Save Customer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
