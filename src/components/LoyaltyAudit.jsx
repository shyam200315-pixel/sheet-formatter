import React, { useState, useEffect, useMemo, useDeferredValue } from "react";
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Phone,
  User,
  Store,
  Calendar,
  Gift,
  ExternalLink,
  ChevronRight,
  X,
  Lock,
  ArrowUpDown,
  Building,
  UserCheck,
  Eye,
  FileSpreadsheet,
  AlertCircle,
  Ticket,
  ArrowLeft
} from "lucide-react";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import {
  loadLoyaltyFromCloud,
  getLoyaltyCloudMetadata,
  clearLoyaltyFromCloud,
  subscribeToLoyaltyUpdates,
  formatDateDisplay,
  parseBillDate,
  normalizeStoreName
} from "../helpers";

// Common dummy / bogus phone numbers used by store staff to bypass CRM or harvest points
const DUMMY_MOBILE_PATTERNS = [
  "9999999999",
  "8888888888",
  "7777777777",
  "6666666666",
  "5555555555",
  "4444444444",
  "3333333333",
  "2222222222",
  "1111111111",
  "0000000000",
  "1234567890",
  "9876543210",
  "9898989898",
  "9090909090"
];

export default function LoyaltyAudit({ onBack = null }) {
  // Password Protection ('shyam') - Always locked on page refresh
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  const [bills, setBills] = useState([]);
  const [metadata, setMetadata] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active view tab: 'leaderboard' | 'all-bills'
  const [viewTab, setViewTab] = useState("leaderboard");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [selectedState, setSelectedState] = useState("ALL");
  const [selectedStore, setSelectedStore] = useState("ALL");
  const [selectedSalesman, setSelectedSalesman] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("REPEAT"); // Default 'REPEAT' (2+ bills or points) for lightning fast 0ms render!
  const [sortBy, setSortBy] = useState("billCount"); // 'billCount' | 'totalAmount' | 'pointsRedeemed' | 'recent'

  // Pagination for leaderboard view (50 items per page prevents browser lag)
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  // Pagination for all-bills view
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Drilldown modal for a single customer
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Reset DB modal state (protected by 'shyam')
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // 1. Fetch data from Cloud (Uses in-memory cache on subsequent tab switches)
  const fetchData = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [records, meta] = await Promise.all([
        loadLoyaltyFromCloud(isManual),
        getLoyaltyCloudMetadata()
      ]);
      setBills(records || []);
      setMetadata(meta || null);
      if (isManual) toast.success("Loyalty & Customer data refreshed!");
    } catch (err) {
      console.error("Error loading loyalty data:", err);
      toast.error(`Could not load loyalty data: ${err.message}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    if (password.trim().toLowerCase() === "shyam") {
      setIsAuthenticated(true);
      toast.success("Loyalty Audit Unlocked");
    } else {
      toast.error("Incorrect Password");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword("");
    toast("Loyalty Audit Locked", { icon: "🔒" });
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchData();

    // Subscribe to real-time Cloud SSE updates
    const unsubscribe = subscribeToLoyaltyUpdates(() => {
      fetchData(false);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isAuthenticated]);

  // 2. Extract unique Stores and Salesmen for filter dropdowns
  const { storeOptions, salesmanOptions } = useMemo(() => {
    const storesSet = new Set();
    const salesmenSet = new Set();

    bills.forEach((b) => {
      if (b.store) storesSet.add(b.store);
      if (b.salesman) salesmenSet.add(b.salesman);
    });

    return {
      storeOptions: Array.from(storesSet).sort(),
      salesmanOptions: Array.from(salesmenSet).sort()
    };
  }, [bills]);

  // 3. Filter raw bills based on search & filter criteria (Uses deferredSearch for 120fps input response)
  const filteredBills = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();

    return bills.filter((bill) => {
      // State filter (MH vs MP from store code prefix)
      if (selectedState === "MH" && !bill.store?.toUpperCase().includes("WMH")) return false;
      if (selectedState === "MP" && !bill.store?.toUpperCase().includes("WMP")) return false;

      // Store filter
      if (selectedStore !== "ALL" && bill.store !== selectedStore) return false;

      // Salesman filter
      if (selectedSalesman !== "ALL" && bill.salesman !== selectedSalesman) return false;

      // Search query (Mobile, Name, Bill No, Salesman, Store)
      if (q) {
        const mob = (bill.customerMobile || "").toLowerCase();
        const name = (bill.customerName || "").toLowerCase();
        const bNo = (bill.billNo || "").toLowerCase();
        const sm = (bill.salesman || "").toLowerCase();
        const st = (bill.store || "").toLowerCase();
        const usr = (bill.userName || "").toLowerCase();

        if (
          !mob.includes(q) &&
          !name.includes(q) &&
          !bNo.includes(q) &&
          !sm.includes(q) &&
          !st.includes(q) &&
          !usr.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [bills, deferredSearch, selectedState, selectedStore, selectedSalesman]);

  // 4. Aggregate bills by Customer (Leaderboard view & Fraud Analysis)
  const customerLeaderboard = useMemo(() => {
    const map = new Map();

    filteredBills.forEach((b) => {
      const mob = b.customerMobile ? b.customerMobile.trim() : "NO_MOBILE";
      const key = mob !== "NO_MOBILE" ? mob : `UNNAMED_${b.customerName || 'UNKNOWN'}_${b.store}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          customerMobile: mob !== "NO_MOBILE" ? mob : "N/A",
          customerName: b.customerName || "Customer",
          billCount: 0,
          totalAmount: 0,
          pointsRedeemed: 0,
          giftVoucherAmount: 0,
          itemsCount: 0,
          stores: new Set(),
          salesmen: new Set(),
          users: new Set(),
          bills: [],
          minDate: b.billDate,
          maxDate: b.billDate,
          isDummy: DUMMY_MOBILE_PATTERNS.includes(mob) || /^(\d)\1{9}$/.test(mob),
        });
      }

      const entry = map.get(key);
      entry.billCount += 1;
      entry.totalAmount += Number(b.billAmount || 0);
      entry.pointsRedeemed += Math.abs(Number(b.pointsRedeemed || 0));
      entry.giftVoucherAmount += Math.abs(Number(b.giftVoucherAmount || 0));
      entry.itemsCount += Number(b.itemsCount || 1);
      if (b.store) entry.stores.add(b.store);
      if (b.salesman) entry.salesmen.add(b.salesman);
      if (b.userName) entry.users.add(b.userName);
      entry.bills.push(b);

      if (b.customerName && entry.customerName === "Customer") {
        entry.customerName = b.customerName;
      }
      if (b.billDate && (!entry.minDate || b.billDate < entry.minDate)) entry.minDate = b.billDate;
      if (b.billDate && (!entry.maxDate || b.billDate > entry.maxDate)) entry.maxDate = b.billDate;
    });

    const list = Array.from(map.values()).map((c) => {
      // Determine Risk Level
      let riskLevel = "NORMAL";
      if (c.billCount >= 5 || c.isDummy) {
        riskLevel = "HIGH"; // 🚨 High Suspicion (5+ bills or known dummy phone number)
      } else if (c.billCount >= 3) {
        riskLevel = "WATCHLIST"; // ⚠️ Moderate / Watchlist (3-4 bills)
      }

      return {
        ...c,
        riskLevel,
        storesList: Array.from(c.stores),
        salesmenList: Array.from(c.salesmen),
        usersList: Array.from(c.users),
        isMultiStore: c.stores.size > 1
      };
    });

    // Apply Risk / Amount / Voucher Filter
    let filteredList = list;
    if (riskFilter === "GIFT_VOUCHER") {
      filteredList = list.filter((c) => c.giftVoucherAmount > 0);
    } else if (riskFilter === "HIGH_AMOUNT") {
      filteredList = list.filter((c) => c.totalAmount >= 50000);
    } else if (riskFilter === "HIGH_AMOUNT_20K") {
      filteredList = list.filter((c) => c.totalAmount >= 20000);
    } else if (riskFilter === "REPEAT") {
      filteredList = list.filter((c) => c.billCount >= 2 || c.isDummy || c.pointsRedeemed > 0 || c.giftVoucherAmount > 0);
    } else if (riskFilter === "HIGH") {
      filteredList = list.filter((c) => c.riskLevel === "HIGH");
    } else if (riskFilter === "WATCHLIST") {
      filteredList = list.filter((c) => c.riskLevel === "WATCHLIST");
    } else if (riskFilter === "REDEEMED") {
      filteredList = list.filter((c) => c.pointsRedeemed > 0);
    } else if (riskFilter === "NORMAL") {
      filteredList = list.filter((c) => c.riskLevel === "NORMAL" && !c.isDummy);
    }

    // Sort
    filteredList.sort((a, b) => {
      if (sortBy === "totalAmount") return b.totalAmount - a.totalAmount;
      if (sortBy === "giftVoucherAmount") return b.giftVoucherAmount - a.giftVoucherAmount;
      if (sortBy === "billCount") return b.billCount - a.billCount;
      if (sortBy === "pointsRedeemed") return b.pointsRedeemed - a.pointsRedeemed;
      if (sortBy === "recent") return (b.maxDate || "").localeCompare(a.maxDate || "");
      return 0;
    });

    return filteredList;
  }, [filteredBills, riskFilter, sortBy]);

  // Paginated Leaderboard Slice (Limits DOM to 50 items for smooth 60fps rendering)
  const paginatedLeaderboard = useMemo(() => {
    const start = (leaderboardPage - 1) * pageSize;
    return customerLeaderboard.slice(start, start + pageSize);
  }, [customerLeaderboard, leaderboardPage, pageSize]);

  const totalLeaderboardPages = Math.ceil(customerLeaderboard.length / pageSize) || 1;

  // 5. Global Metrics & Suspicion Telemetry
  const metrics = useMemo(() => {
    let totalBillsCount = filteredBills.length;
    let totalUniqueMobiles = new Set(
      filteredBills.map((b) => b.customerMobile).filter((m) => m && m !== "NO_MOBILE" && m.length >= 10)
    ).size;

    let highRiskCount = 0;
    let highRiskAmount = 0;
    let totalPoints = 0;
    let totalGiftVoucherAmount = 0;
    let giftVoucherUsersCount = 0;
    let multiStoreCount = 0;

    customerLeaderboard.forEach((c) => {
      if (c.riskLevel === "HIGH") {
        highRiskCount += 1;
        highRiskAmount += c.totalAmount;
      }
      totalPoints += c.pointsRedeemed;
      if (c.giftVoucherAmount > 0) {
        giftVoucherUsersCount += 1;
        totalGiftVoucherAmount += c.giftVoucherAmount;
      }
      if (c.isMultiStore) multiStoreCount += 1;
    });

    return {
      totalBillsCount,
      totalUniqueMobiles,
      highRiskCount,
      highRiskAmount,
      totalPoints,
      totalGiftVoucherAmount,
      giftVoucherUsersCount,
      multiStoreCount
    };
  }, [filteredBills, customerLeaderboard]);

  // 6. Reset Loyalty DB (Requires 'shyam' password)
  const handleResetDatabase = async () => {
    if (resetPassword.trim().toLowerCase() !== "shyam") {
      toast.error("Incorrect password! Reset denied.");
      return;
    }

    setIsResetting(true);
    try {
      const ok = await clearLoyaltyFromCloud();
      if (ok) {
        toast.success("Loyalty & Customer Audit database wiped successfully.");
        setBills([]);
        setMetadata(null);
        setResetModalOpen(false);
        setResetPassword("");
      } else {
        throw new Error("Server returned non-ok status");
      }
    } catch (err) {
      toast.error(`Reset failed: ${err.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  // 7. Export to Excel (Styled Workbook with 2 sheets)
  const handleExportExcel = async () => {
    if (bills.length === 0) {
      toast.error("No data to export!");
      return;
    }

    const toastId = toast.loading("Generating Loyalty Audit Excel Report...");
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = "Stovekraft Retail Audit";
      wb.created = new Date();

      // Sheet 1: Suspicious Repeat Customers Leaderboard
      const wsLeaderboard = wb.addWorksheet("Customer Fraud Leaderboard");
      wsLeaderboard.columns = [
        { header: "Customer Mobile", key: "mobile", width: 16 },
        { header: "Customer Name", key: "name", width: 22 },
        { header: "Risk Level", key: "risk", width: 16 },
        { header: "Bill Count", key: "bills", width: 12 },
        { header: "Total Value (₹)", key: "amount", width: 16 },
        { header: "Points Redeemed", key: "points", width: 16 },
        { header: "Gift Voucher (₹)", key: "giftVoucher", width: 16 },
        { header: "Multi-Store?", key: "multiStore", width: 14 },
        { header: "Stores Visited", key: "stores", width: 30 },
        { header: "Salesmen Involved", key: "salesmen", width: 30 },
        { header: "Cashiers / Users", key: "users", width: 24 },
        { header: "First Bill Date", key: "minDate", width: 15 },
        { header: "Last Bill Date", key: "maxDate", width: 15 }
      ];

      // Header style
      wsLeaderboard.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsLeaderboard.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFBE185D" } // Deep Pink
      };

      customerLeaderboard.forEach((c) => {
        const row = wsLeaderboard.addRow({
          mobile: c.customerMobile,
          name: c.customerName,
          risk: c.isDummy ? "DUMMY NUMBER" : c.riskLevel === "HIGH" ? "HIGH RISK (5+ Bills)" : c.riskLevel === "WATCHLIST" ? "WATCHLIST (3-4 Bills)" : "NORMAL",
          bills: c.billCount,
          amount: Math.round(c.totalAmount * 100) / 100,
          points: Math.round(c.pointsRedeemed * 100) / 100,
          giftVoucher: Math.round((c.giftVoucherAmount || 0) * 100) / 100,
          multiStore: c.isMultiStore ? "YES" : "NO",
          stores: c.storesList.join(", "),
          salesmen: c.salesmenList.join(", "),
          users: c.usersList.join(", "),
          minDate: formatDateDisplay(c.minDate) || "",
          maxDate: formatDateDisplay(c.maxDate) || ""
        });

        // Highlight high risk in light red
        if (c.riskLevel === "HIGH") {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEE2E2" } // Light red fill
          };
          row.font = { color: { argb: "FF991B1B" }, bold: true };
        }
      });

      // Sheet 2: All Audited Bills
      const wsBills = wb.addWorksheet("All Audited Bills");
      wsBills.columns = [
        { header: "Bill No.", key: "billNo", width: 18 },
        { header: "Bill Date", key: "billDate", width: 14 },
        { header: "Bill Time", key: "billTime", width: 12 },
        { header: "Store", key: "store", width: 28 },
        { header: "Salesman", key: "salesman", width: 20 },
        { header: "Cashier / User", key: "userName", width: 18 },
        { header: "Customer Mobile", key: "customerMobile", width: 16 },
        { header: "Customer Name", key: "customerName", width: 22 },
        { header: "Bill Amount (₹)", key: "billAmount", width: 16 },
        { header: "Points Redeemed", key: "pointsRedeemed", width: 16 },
        { header: "Gift Voucher (₹)", key: "giftVoucher", width: 16 },
        { header: "Items Count", key: "itemsCount", width: 12 },
        { header: "Source File", key: "fileName", width: 25 }
      ];

      wsBills.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
      wsBills.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" } // Dark Slate
      };

      filteredBills.forEach((b) => {
        wsBills.addRow({
          billNo: b.billNo,
          billDate: formatDateDisplay(b.billDate) || b.billDate,
          billTime: b.billTime || "",
          store: b.store,
          salesman: b.salesman || "N/A",
          userName: b.userName || "N/A",
          customerMobile: b.customerMobile || "N/A",
          customerName: b.customerName || "N/A",
          billAmount: Number(b.billAmount || 0),
          pointsRedeemed: Number(b.pointsRedeemed || 0),
          giftVoucher: Number(b.giftVoucherAmount || 0),
          itemsCount: Number(b.itemsCount || 1),
          fileName: b.fileName || ""
        });
      });

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const dateTag = new Date().toISOString().split("T")[0];
      saveAs(blob, `Loyalty_Fraud_Audit_Report_${dateTag}.xlsx`);

      toast.success("Audit report exported successfully!", { id: toastId });
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error(`Export failed: ${err.message}`, { id: toastId });
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  // Sliced & sorted bills for All-Bills view
  const sortedBills = useMemo(() => {
    const list = [...filteredBills];
    if (sortBy === "totalAmount") {
      list.sort((a, b) => Number(b.billAmount || 0) - Number(a.billAmount || 0));
    } else if (sortBy === "giftVoucherAmount") {
      list.sort((a, b) => Number(b.giftVoucherAmount || 0) - Number(a.giftVoucherAmount || 0));
    } else if (sortBy === "pointsRedeemed") {
      list.sort((a, b) => Number(b.pointsRedeemed || 0) - Number(a.pointsRedeemed || 0));
    } else {
      list.sort((a, b) => (b.billDate || "").localeCompare(a.billDate || ""));
    }
    return list;
  }, [filteredBills, sortBy]);

  // Pagination slice for All-Bills view
  const paginatedBills = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedBills.slice(start, start + pageSize);
  }, [sortedBills, currentPage]);

  const totalPages = Math.ceil(sortedBills.length / pageSize) || 1;

  // -------------------------------------------------------------
  // Password Lock Screen (Password: 'shyam')
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-8 rounded-3xl border border-white/80 dark:border-slate-800 shadow-2xl max-w-md w-full relative">
          {onBack && (
            <button
              onClick={onBack}
              className="absolute top-6 left-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 transition-colors cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft size={20} />
            </button>
          )}

          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-100 to-rose-100 dark:from-pink-950/80 dark:to-rose-950/80 rounded-2xl flex items-center justify-center shadow-inner border border-pink-200 dark:border-pink-800">
              <ShieldAlert className="w-8 h-8 text-pink-600 dark:text-pink-400" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            Restricted Audit Access
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8">
            Please enter the password to view <strong>Loyalty & Customer Audit</strong>.
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  const val = e.target.value;
                  setPassword(val);
                  if (val.trim().toLowerCase() === "shyam") {
                    setIsAuthenticated(true);
                    toast.success("Loyalty Audit Unlocked");
                  }
                }}
                placeholder="Enter password..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-slate-800/60 focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white shadow-sm"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white rounded-xl font-semibold shadow-lg shadow-pink-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              Unlock Loyalty Audit
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 pb-20">
      {/* Top Header Card */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                title="Back to Home"
              >
                ←
              </button>
            )}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/25">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                  Loyalty & Customer Audit
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300 border border-pink-200 dark:border-pink-800">
                  Fraud Detector
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Detect repeat customer numbers, employee loyalty point abuse, and multi-store billing anomalies.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-all cursor-pointer shadow-sm"
              title="Refresh latest data from cloud"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin text-pink-500" : ""} />
              <span>{isRefreshing ? "Refreshing..." : "Cloud Sync"}</span>
            </button>

            <button
              onClick={handleExportExcel}
              disabled={bills.length === 0}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-pink-600 hover:bg-pink-700 text-white rounded-xl transition-all cursor-pointer shadow-md shadow-pink-600/20 disabled:opacity-50"
            >
              <Download size={14} />
              <span>Export Audit Report</span>
            </button>

            <button
              onClick={() => setResetModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-all border border-red-200 dark:border-red-900/50 cursor-pointer"
              title="Reset Loyalty Database"
            >
              <Trash2 size={13} />
              <span>Reset DB</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-all border border-gray-200 dark:border-slate-700 cursor-pointer"
              title="Lock Loyalty Audit"
            >
              <Lock size={13} />
              <span>Lock</span>
            </button>
          </div>
        </div>

        {/* Real-time DB Volume Info */}
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Cloud Database Active: <strong>{bills.length.toLocaleString()}</strong> bills recorded
              {metadata?.minDate && metadata?.maxDate && (
                <span className="ml-1 text-gray-400">
                  ({formatDateDisplay(metadata.minDate)} to {formatDateDisplay(metadata.maxDate)})
                </span>
              )}
            </span>
          </div>
          <div className="text-gray-400">
            Auto-updates every time you upload your Daily Collection Sheet
          </div>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Total Bills */}
        <div className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-gray-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1.5">
            <span className="text-xs font-semibold">Total Bills</span>
            <FileSpreadsheet size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {metrics.totalBillsCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Audited transactions</div>
        </div>

        {/* Card 2: Unique Customers */}
        <div className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-gray-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1.5">
            <span className="text-xs font-semibold">Unique Customers</span>
            <UserCheck size={16} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {metrics.totalUniqueMobiles.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">Distinct mobile numbers</div>
        </div>

        {/* Card 3: High-Risk Repeated Numbers */}
        <div className="bg-red-50/80 dark:bg-red-950/20 p-4 rounded-2xl border border-red-200 dark:border-red-900/40 shadow-sm">
          <div className="flex items-center justify-between text-red-700 dark:text-red-400 mb-1.5">
            <span className="text-xs font-bold">🚨 High Suspicion</span>
            <AlertTriangle size={16} className="text-red-600" />
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400">
            {metrics.highRiskCount.toLocaleString()}
          </div>
          <div className="text-[11px] text-red-500 mt-1 font-medium">Numbers with 5+ bills / dummy</div>
        </div>

        {/* Card 4: Suspicious Revenue */}
        <div className="bg-white/80 dark:bg-slate-900/80 p-4 rounded-2xl border border-gray-200/80 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 mb-1.5">
            <span className="text-xs font-semibold">Suspicious Billed Value</span>
            <Building size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatCurrency(metrics.highRiskAmount)}
          </div>
          <div className="text-[11px] text-gray-400 mt-1">Punched on 5+ bill numbers</div>
        </div>

        {/* Card 5: Points Redeemed */}
        <div className="bg-pink-50/70 dark:bg-pink-950/20 p-4 rounded-2xl border border-pink-200 dark:border-pink-900/40 shadow-sm">
          <div className="flex items-center justify-between text-pink-700 dark:text-pink-400 mb-1.5">
            <span className="text-xs font-bold">Points Redeemed</span>
            <Gift size={16} className="text-pink-600" />
          </div>
          <div className="text-2xl font-black text-pink-600 dark:text-pink-400">
            {Math.round(metrics.totalPoints).toLocaleString()} pts
          </div>
          <div className="text-[11px] text-pink-500 mt-1 font-medium">Loyalty points claimed</div>
        </div>

        {/* Card 6: Gift Vouchers */}
        <div className="bg-purple-50/70 dark:bg-purple-950/20 p-4 rounded-2xl border border-purple-200 dark:border-purple-900/40 shadow-sm">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-400 mb-1.5">
            <span className="text-xs font-bold">Gift Vouchers</span>
            <Ticket size={16} className="text-purple-600" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
            {formatCurrency(metrics.totalGiftVoucherAmount)}
          </div>
          <div className="text-[11px] text-purple-500 mt-1 font-medium">{metrics.giftVoucherUsersCount} customers used GV</div>
        </div>
      </div>

      {/* View Switcher Tabs & Filters */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-gray-200/80 dark:border-slate-800 p-4 shadow-sm space-y-4">
        {/* Sub-tabs */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => { setViewTab("leaderboard"); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewTab === "leaderboard"
                  ? "bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              Repeat Customers Leaderboard ({customerLeaderboard.length})
            </button>
            <button
              onClick={() => { setViewTab("all-bills"); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewTab === "all-bills"
                  ? "bg-white dark:bg-slate-900 text-pink-600 dark:text-pink-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              All Audited Bills ({filteredBills.length})
            </button>
          </div>

          {/* Quick Sort Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 mr-1">Sort:</span>
            <button
              onClick={() => { setSortBy("totalAmount"); setLeaderboardPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                sortBy === "totalAmount"
                  ? "bg-pink-600 text-white shadow-md shadow-pink-600/25 ring-2 ring-pink-400"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
              }`}
            >
              <span>💰 Highest Amount</span>
            </button>
            <button
              onClick={() => { setSortBy("giftVoucherAmount"); setLeaderboardPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                sortBy === "giftVoucherAmount"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-2 ring-purple-400"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
              }`}
            >
              <span>🎟️ Gift Voucher</span>
            </button>
            <button
              onClick={() => { setSortBy("billCount"); setLeaderboardPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                sortBy === "billCount"
                  ? "bg-pink-600 text-white shadow-md shadow-pink-600/25 ring-2 ring-pink-400"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
              }`}
            >
              <span>🧾 Most Bills</span>
            </button>
            <button
              onClick={() => { setSortBy("pointsRedeemed"); setLeaderboardPage(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                sortBy === "pointsRedeemed"
                  ? "bg-pink-600 text-white shadow-md shadow-pink-600/25 ring-2 ring-pink-400"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
              }`}
            >
              <span>🎁 Points</span>
            </button>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Showing {viewTab === "leaderboard" ? `${customerLeaderboard.length} customers` : `${filteredBills.length} bills`}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {/* Search Input */}
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
            <input
              type="text"
              placeholder="Search Mobile, Customer, Bill No, Salesman..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setLeaderboardPage(1);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-900 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setLeaderboardPage(1);
                  setCurrentPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* State Filter */}
          <div>
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setLeaderboardPage(1);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-2 text-xs bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-900 dark:text-white font-medium"
            >
              <option value="ALL">All States (MH & MP)</option>
              <option value="MH">Maharashtra (WMH)</option>
              <option value="MP">Madhya Pradesh (WMP)</option>
            </select>
          </div>

          {/* Store Filter */}
          <div>
            <select
              value={selectedStore}
              onChange={(e) => {
                setSelectedStore(e.target.value);
                setLeaderboardPage(1);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-2 text-xs bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-900 dark:text-white font-medium truncate"
            >
              <option value="ALL">All Stores ({storeOptions.length})</option>
              {storeOptions.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          {/* Salesman Filter */}
          <div>
            <select
              value={selectedSalesman}
              onChange={(e) => {
                setSelectedSalesman(e.target.value);
                setLeaderboardPage(1);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-2 text-xs bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-900 dark:text-white font-medium truncate"
            >
              <option value="ALL">All Salesmen ({salesmanOptions.length})</option>
              {salesmanOptions.map((sm) => (
                <option key={sm} value={sm}>
                  {sm}
                </option>
              ))}
            </select>
          </div>

          {/* Risk & Amount Filter (for Leaderboard) */}
          <div>
            <select
              value={riskFilter}
              onChange={(e) => {
                const val = e.target.value;
                setRiskFilter(val);
                if (val === "HIGH_AMOUNT" || val === "HIGH_AMOUNT_20K") {
                  setSortBy("totalAmount");
                } else if (val === "GIFT_VOUCHER") {
                  setSortBy("giftVoucherAmount");
                }
                setLeaderboardPage(1);
              }}
              className="w-full px-2.5 py-2 text-xs bg-gray-50 dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 text-gray-900 dark:text-white font-semibold"
            >
              <option value="REPEAT">⚡ Repeat & Suspicious (2+ Bills / Points)</option>
              <option value="GIFT_VOUCHER">🎟️ Gift Voucher Used (GV &gt; 0)</option>
              <option value="HIGH_AMOUNT">💰 Highest Spend (₹50,000+ Total)</option>
              <option value="HIGH_AMOUNT_20K">💵 High Spend (₹20,000+ Total)</option>
              <option value="HIGH">🚨 High Risk (5+ Bills / Dummy)</option>
              <option value="WATCHLIST">⚠️ Watchlist (3-4 Bills)</option>
              <option value="REDEEMED">🎁 Points Redeemed Only</option>
              <option value="ALL">All Customers (7,500+ Total)</option>
            </select>
          </div>

          {/* Dedicated Sort Order Dropdown */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setLeaderboardPage(1);
              }}
              className="w-full px-2.5 py-2 text-xs bg-pink-50 dark:bg-pink-950/40 border border-pink-300 dark:border-pink-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 text-pink-700 dark:text-pink-300 font-bold"
            >
              <option value="totalAmount">💰 Sort: Highest Amount (₹)</option>
              <option value="giftVoucherAmount">🎟️ Sort: Most Gift Voucher (₹)</option>
              <option value="billCount">🧾 Sort: Most Bills Count</option>
              <option value="pointsRedeemed">🎁 Sort: Points Redeemed</option>
              <option value="recent">📅 Sort: Most Recent Date</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl p-12 text-center border border-gray-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin text-pink-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Loading loyalty audit data from Cloud...
          </p>
        </div>
      ) : bills.length === 0 ? (
        <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl p-12 text-center border border-gray-200 dark:border-slate-800 space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-pink-100 dark:bg-pink-950/40 text-pink-600 flex items-center justify-center mx-auto">
            <ShieldAlert size={32} />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            No Loyalty Data Uploaded Yet
          </h3>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Upload your daily collection Excel file in <strong>Daily Sales Validator</strong>.
            The system will automatically extract customer mobile numbers, salesmen, and points redeemed, and populate this audit dashboard!
          </p>
        </div>
      ) : viewTab === "leaderboard" ? (
        /* ========================================================================= */
        /* VIEW 1: REPEAT CUSTOMER FRAUD LEADERBOARD                                 */
        /* ========================================================================= */
        <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-gray-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/90 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 uppercase text-[11px] font-bold border-b border-gray-200/80 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3.5">Customer Mobile & Name</th>
                  <th className="px-4 py-3.5">Risk Level</th>
                  <th 
                    className={`px-4 py-3.5 text-center cursor-pointer transition-colors ${
                      sortBy === "billCount" ? "text-pink-600 dark:text-pink-400 bg-pink-100/80 dark:bg-pink-950/40 font-black" : "hover:text-pink-600"
                    }`} 
                    onClick={() => { setSortBy("billCount"); setLeaderboardPage(1); }}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Total Bills</span>
                      <ArrowUpDown size={12} className={sortBy === "billCount" ? "text-pink-600" : ""} />
                    </div>
                  </th>
                  <th 
                    className={`px-4 py-3.5 text-right cursor-pointer transition-colors ${
                      sortBy === "totalAmount" ? "text-pink-600 dark:text-pink-400 bg-pink-100/80 dark:bg-pink-950/40 font-black" : "hover:text-pink-600"
                    }`} 
                    onClick={() => { setSortBy("totalAmount"); setLeaderboardPage(1); }}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Purchase (₹)</span>
                      <ArrowUpDown size={12} className={sortBy === "totalAmount" ? "text-pink-600" : ""} />
                    </div>
                  </th>
                  <th 
                    className={`px-4 py-3.5 text-right cursor-pointer transition-colors ${
                      sortBy === "pointsRedeemed" ? "text-pink-600 dark:text-pink-400 bg-pink-100/80 dark:bg-pink-950/40 font-black" : "hover:text-pink-600"
                    }`} 
                    onClick={() => { setSortBy("pointsRedeemed"); setLeaderboardPage(1); }}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Points Redeemed</span>
                      <ArrowUpDown size={12} className={sortBy === "pointsRedeemed" ? "text-pink-600" : ""} />
                    </div>
                  </th>
                  <th 
                    className={`px-4 py-3.5 text-right cursor-pointer transition-colors ${
                      sortBy === "giftVoucherAmount" ? "text-purple-600 dark:text-purple-400 bg-purple-100/80 dark:bg-purple-950/40 font-black" : "hover:text-purple-600"
                    }`} 
                    onClick={() => { setSortBy("giftVoucherAmount"); setLeaderboardPage(1); }}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Gift Voucher (₹)</span>
                      <ArrowUpDown size={12} className={sortBy === "giftVoucherAmount" ? "text-purple-600" : ""} />
                    </div>
                  </th>
                  <th className="px-4 py-3.5">Stores Visited</th>
                  <th className="px-4 py-3.5">Salesmen Involved</th>
                  <th className="px-4 py-3.5 text-center w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {paginatedLeaderboard.map((cust) => {
                  const isHigh = cust.riskLevel === "HIGH";
                  const isWatch = cust.riskLevel === "WATCHLIST";

                  return (
                    <tr
                      key={cust.key}
                      className={`transition-colors hover:bg-gray-50/80 dark:hover:bg-slate-800/40 cursor-pointer ${
                        isHigh ? "bg-red-50/40 dark:bg-red-950/10" : ""
                      }`}
                      onClick={() => setSelectedCustomer(cust)}
                    >
                      {/* Customer Mobile & Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          <div className={`p-2 rounded-xl mt-0.5 ${
                            isHigh ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300" : "bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-gray-300"
                          }`}>
                            <Phone size={14} />
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                              <span>{cust.customerMobile}</span>
                              {cust.isDummy && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 border border-purple-200">
                                  Dummy No.
                                </span>
                              )}
                              {cust.isMultiStore && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-200">
                                  {cust.storesList.length} Stores
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                              {cust.customerName}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Risk Level */}
                      <td className="px-4 py-3">
                        {isHigh ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 border border-red-200 dark:border-red-800">
                            <AlertTriangle size={12} />
                            <span>🚨 High Suspicion ({cust.billCount} bills)</span>
                          </span>
                        ) : isWatch ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border border-amber-200">
                            <span>⚠️ Watchlist ({cust.billCount} bills)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                            <CheckCircle2 size={12} />
                            <span>Normal ({cust.billCount} bills)</span>
                          </span>
                        )}
                      </td>

                      {/* Bill Count */}
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                          isHigh ? "bg-red-600 text-white" : isWatch ? "bg-amber-500 text-white" : "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-gray-200"
                        }`}>
                          {cust.billCount}
                        </span>
                      </td>

                      {/* Total Amount */}
                      <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                        {formatCurrency(cust.totalAmount)}
                      </td>

                      {/* Points Redeemed */}
                      <td className="px-4 py-3 text-right">
                        {cust.pointsRedeemed > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200">
                            <Gift size={11} />
                            {Math.round(cust.pointsRedeemed).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-medium">0</span>
                        )}
                      </td>

                      {/* Gift Voucher */}
                      <td className="px-4 py-3 text-right">
                        {cust.giftVoucherAmount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200">
                            <Ticket size={11} />
                            {formatCurrency(cust.giftVoucherAmount)}
                          </span>
                        ) : (
                          <span className="text-gray-400 font-medium">-</span>
                        )}
                      </td>

                      {/* Stores */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {cust.storesList.slice(0, 2).map((st) => (
                            <span
                              key={st}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 truncate max-w-[140px]"
                              title={st}
                            >
                              {st}
                            </span>
                          ))}
                          {cust.storesList.length > 2 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300">
                              +{cust.storesList.length - 2} more
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Salesmen */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {cust.salesmenList.slice(0, 2).map((sm) => (
                            <span
                              key={sm}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 truncate max-w-[120px]"
                              title={sm}
                            >
                              {sm}
                            </span>
                          ))}
                          {cust.salesmenList.length > 2 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                              +{cust.salesmenList.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomer(cust);
                          }}
                          className="p-1.5 text-gray-400 hover:text-pink-600 dark:hover:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/30 rounded-lg transition-colors cursor-pointer"
                          title="View all bills for this customer"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {customerLeaderboard.length === 0 && (
                  <tr>
                    <td colSpan="9" className="px-4 py-12 text-center text-gray-400">
                      No matching records found. Try adjusting your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar for Leaderboard */}
          {totalLeaderboardPages > 1 && (
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
              <div>
                Showing {(leaderboardPage - 1) * pageSize + 1} to {Math.min(leaderboardPage * pageSize, customerLeaderboard.length)} of {customerLeaderboard.length.toLocaleString()} customers (Page {leaderboardPage} of {totalLeaderboardPages})
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setLeaderboardPage((p) => Math.max(1, p - 1))}
                  disabled={leaderboardPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer font-medium"
                >
                  Previous
                </button>
                <span className="px-2 text-gray-700 dark:text-gray-300 font-bold">
                  {leaderboardPage} / {totalLeaderboardPages}
                </span>
                <button
                  onClick={() => setLeaderboardPage((p) => Math.min(totalLeaderboardPages, p + 1))}
                  disabled={leaderboardPage === totalLeaderboardPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer font-medium"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* VIEW 2: ALL AUDITED BILLS TIMELINE                                        */
        /* ========================================================================= */
        <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-gray-200/80 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/90 dark:bg-slate-800/80 text-gray-500 dark:text-gray-400 uppercase text-[11px] font-bold border-b border-gray-200/80 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3.5">Bill No.</th>
                  <th className="px-4 py-3.5">Date & Time</th>
                  <th className="px-4 py-3.5">Store</th>
                  <th className="px-4 py-3.5">Salesman</th>
                  <th className="px-4 py-3.5">Customer Mobile & Name</th>
                  <th className="px-4 py-3.5 text-right">Amount (₹)</th>
                  <th className="px-4 py-3.5 text-right">Points Redeemed</th>
                  <th className="px-4 py-3.5 text-right">Gift Voucher (₹)</th>
                  <th className="px-4 py-3.5 text-center">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {paginatedBills.map((b, idx) => (
                  <tr key={`${b.billNo}_${idx}`} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                      {b.billNo}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      <div>{formatDateDisplay(b.billDate) || b.billDate}</div>
                      {b.billTime && <div className="text-[10px] text-gray-400">{b.billTime}</div>}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 truncate max-w-xs">
                      {b.store}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      <div>{b.salesman || "N/A"}</div>
                      {b.userName && <div className="text-[10px] text-gray-400">User: {b.userName}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {b.customerMobile || "N/A"}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400">
                        {b.customerName || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                      {formatCurrency(b.billAmount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.pointsRedeemed > 0 ? (
                        <span className="font-bold text-pink-600 dark:text-pink-400">
                          {Math.round(b.pointsRedeemed)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {Number(b.giftVoucherAmount || 0) > 0 ? (
                        <span className="font-bold text-purple-600 dark:text-purple-400">
                          {formatCurrency(b.giftVoucherAmount)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-300">
                      {b.itemsCount || 1}
                    </td>
                  </tr>
                ))}

                {paginatedBills.length === 0 && (
                  <tr>
                    <td colSpan="9" className="px-4 py-12 text-center text-gray-400">
                      No bills match current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500">
              <div>
                Page {currentPage} of {totalPages} ({filteredBills.length} total bills)
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* CUSTOMER DRILL-DOWN MODAL (All Bills for a specific Customer Number)      */}
      {/* ========================================================================= */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full border border-gray-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex justify-between items-start bg-gradient-to-r from-pink-50/50 to-transparent dark:from-pink-950/20">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-2xl ${
                  selectedCustomer.riskLevel === "HIGH" ? "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400" : "bg-pink-100 text-pink-600 dark:bg-pink-950 dark:text-pink-400"
                }`}>
                  <Phone size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedCustomer.customerMobile}
                    </h3>
                    {selectedCustomer.isDummy && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                        Dummy Number
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      selectedCustomer.riskLevel === "HIGH" ? "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                    }`}>
                      {selectedCustomer.riskLevel === "HIGH" ? "🚨 High Suspicion" : "Normal Customer"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium">
                    Name: <strong>{selectedCustomer.customerName}</strong> • {selectedCustomer.billCount} Bills Recorded
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Summary Stats for Customer */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-4 bg-gray-50/60 dark:bg-slate-800/40 border-b border-gray-100 dark:border-slate-800 text-center text-xs">
              <div>
                <span className="text-gray-400">Total Spend</span>
                <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                  {formatCurrency(selectedCustomer.totalAmount)}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Gift Voucher</span>
                <div className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                  {selectedCustomer.giftVoucherAmount > 0 ? formatCurrency(selectedCustomer.giftVoucherAmount) : "₹0"}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Points Redeemed</span>
                <div className="text-sm font-bold text-pink-600 dark:text-pink-400 mt-0.5">
                  {Math.round(selectedCustomer.pointsRedeemed).toLocaleString()} pts
                </div>
              </div>
              <div>
                <span className="text-gray-400">Stores Involved</span>
                <div className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                  {selectedCustomer.storesList.length} store(s)
                </div>
              </div>
              <div>
                <span className="text-gray-400">Salesmen Involved</span>
                <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  {selectedCustomer.salesmenList.length} staff
                </div>
              </div>
            </div>

            {/* Suspicion Flag Banner */}
            {selectedCustomer.riskLevel === "HIGH" && (
              <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-3 text-xs text-red-800 dark:text-red-300">
                <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Audit Warning:</strong> This mobile number has been billed <strong>{selectedCustomer.billCount} times</strong>.
                  {selectedCustomer.salesmenList.length === 1 && (
                    <span> Punched entirely by Salesman <strong>{selectedCustomer.salesmenList[0]}</strong>.</span>
                  )}
                  {selectedCustomer.isMultiStore && (
                    <span> Spread across <strong>{selectedCustomer.storesList.length} different stores</strong> ({selectedCustomer.storesList.join(", ")}).</span>
                  )}
                  {selectedCustomer.pointsRedeemed > 0 && (
                    <span> <strong>{Math.round(selectedCustomer.pointsRedeemed)} loyalty points</strong> were redeemed on these bills.</span>
                  )}
                  {selectedCustomer.giftVoucherAmount > 0 && (
                    <span> <strong>{formatCurrency(selectedCustomer.giftVoucherAmount)} in Gift Vouchers</strong> were redeemed on these bills.</span>
                  )}
                  <div className="mt-1 text-[11px] text-red-700 dark:text-red-400 font-medium">
                    Recommended Action: Verify physical bill copies and confirm customer identity with store manager.
                  </div>
                </div>
              </div>
            )}

            {/* Bills Table */}
            <div className="p-6 overflow-y-auto flex-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                All Individual Bills ({selectedCustomer.bills.length})
              </h4>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-slate-800/80 text-gray-500 uppercase text-[10px] font-bold">
                    <tr>
                      <th className="px-3 py-2.5">Bill No.</th>
                      <th className="px-3 py-2.5">Date & Time</th>
                      <th className="px-3 py-2.5">Store</th>
                      <th className="px-3 py-2.5">Salesman</th>
                      <th className="px-3 py-2.5">Cashier</th>
                      <th className="px-3 py-2.5 text-right">Amount (₹)</th>
                      <th className="px-3 py-2.5 text-right">Points</th>
                      <th className="px-3 py-2.5 text-right">Gift Voucher (₹)</th>
                      <th className="px-3 py-2.5 text-center">Items</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {selectedCustomer.bills.map((b, i) => (
                      <tr key={`${b.billNo}_${i}`} className="hover:bg-gray-50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 font-bold text-gray-900 dark:text-white">
                          {b.billNo}
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                          {formatDateDisplay(b.billDate) || b.billDate} {b.billTime && <span className="text-[10px] text-gray-400">({b.billTime})</span>}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                          {b.store}
                        </td>
                        <td className="px-3 py-2 text-blue-600 dark:text-blue-400 font-medium">
                          {b.salesman || "N/A"}
                        </td>
                        <td className="px-3 py-2 text-gray-500">
                          {b.userName || "N/A"}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-white">
                          {formatCurrency(b.billAmount)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {b.pointsRedeemed > 0 ? (
                            <span className="font-bold text-pink-600 dark:text-pink-400">
                              {Math.round(b.pointsRedeemed)}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {Number(b.giftVoucherAmount || 0) > 0 ? (
                            <span className="font-bold text-purple-600 dark:text-purple-400">
                              {formatCurrency(b.giftVoucherAmount)}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">
                          {b.itemsCount || 1}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/20 flex justify-end">
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-5 py-2 text-xs font-semibold bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RESET DATABASE CONFIRMATION MODAL (Protected by 'shyam')                 */}
      {/* ========================================================================= */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-gray-200 dark:border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-950/60">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                Reset Loyalty Database
              </h3>
            </div>

            <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">
              Are you sure you want to delete ALL <strong>{bills.length.toLocaleString()} loyalty records</strong> from the cloud?
              This action cannot be undone. Enter the administrator password to confirm.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleResetDatabase();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Password:
                </label>
                <input
                  type="password"
                  placeholder="Enter 'shyam' to confirm"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setResetModalOpen(false);
                    setResetPassword("");
                  }}
                  className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting || !resetPassword}
                  className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isResetting ? "Wiping Database..." : "Wipe Database"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

