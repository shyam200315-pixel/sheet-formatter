import React, { useState, useMemo, useEffect } from 'react';
import { 
  Trophy, 
  Tag, 
  Store, 
  Package, 
  TrendingUp, 
  Filter, 
  ArrowLeft, 
  LayoutList, 
  ChevronDown, 
  ChevronUp, 
  ChevronRight,
  RefreshCw,
  Cloud,
  Database,
  Calendar,
  AlertCircle,
  UploadCloud,
  CheckCircle2,
  Lock,
  Unlock
} from 'lucide-react';
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import FileDropZone from "./FileDropZone";
import { 
  normalizeStoreName, 
  loadDeadStockSalesData, 
  syncDeadStockFromCloud, 
  appendDeadStockSalesData,
  subscribeToDeadStockUpdates, 
  getDeadStockCloudMetadata,
  parseBillDate,
  formatDateDisplay
} from "../helpers";

export default function BestSellers({ onBack }) {
  // Password Protection ('shyam')
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return sessionStorage.getItem("bs_auth") === "true";
    } catch (_) {
      return false;
    }
  });
  const [password, setPassword] = useState("");

  const [jsonData, setJsonData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudMetadata, setCloudMetadata] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [validationSuccess, setValidationSuccess] = useState(false);

  // Filters & Views
  const [viewMode, setViewMode] = useState("category"); // 'category' | 'store'
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStore, setSelectedStore] = useState("All");
  const [selectedStateFilter, setSelectedStateFilter] = useState("All States");
  const [expandedCategories, setExpandedCategories] = useState({});

  // Helper to extract values by candidate keys (case-insensitive / alias match)
  const getRowVal = (row, candidates) => {
    if (!row || typeof row !== "object") return "";
    for (const c of candidates) {
      if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== "") {
        return row[c];
      }
    }
    const keys = Object.keys(row);
    for (const c of candidates) {
      const target = c.replace(/[\s._\-]+/g, "").toUpperCase();
      const found = keys.find(k => k.replace(/[\s._\-]+/g, "").toUpperCase() === target);
      if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== "") {
        return row[found];
      }
    }
    return "";
  };

  const getStateFromBranch = (branch) => {
    if (!branch) return "";
    const canonical = normalizeStoreName(branch);
    if (canonical.startsWith("WMH")) return "MH";
    if (canonical.startsWith("WMP")) return "MP";
    const storeCode = branch.split('-')[0].trim();
    if (storeCode.length >= 3) {
      const st = storeCode.substring(1, 3).toUpperCase();
      if (st === "MP" || st === "MH") return st;
    }
    if (branch.toUpperCase().includes(" MP")) return "MP";
    if (branch.toUpperCase().includes(" MH")) return "MH";
    return "Other";
  };

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    if (password.trim().toLowerCase() === "shyam") {
      setIsAuthenticated(true);
      try {
        sessionStorage.setItem("bs_auth", "true");
      } catch (_) {}
      toast.success("Access Granted");
    } else {
      toast.error("Incorrect Password");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassword("");
    try {
      sessionStorage.removeItem("bs_auth");
    } catch (_) {}
    toast("Logged out of Best Sellers", { icon: "🔒" });
  };

  // 1. Initial Load: Local-First (0ms IndexedDB) + Cloud Verification (Only after Authentication)
  useEffect(() => {
    if (!isAuthenticated) return;
    let isMounted = true;

    const initData = async () => {
      setIsLoading(true);
      try {
        // Fast local read from same database as Dead Stock Analyzer
        const localRows = await loadDeadStockSalesData();
        let loadedCount = 0;

        if (localRows && localRows.length > 0 && isMounted) {
          setJsonData(localRows);
          loadedCount = localRows.length;
          setIsLoading(false);
        }

        // Check Cloud metadata & background sync if needed
        try {
          const meta = await getDeadStockCloudMetadata();
          if (isMounted && meta) {
            setCloudMetadata(meta);
          }
          const cloudCount = meta?.totalRecords || meta?.totalRows || 0;
          if (cloudCount > 0 && (!localRows || loadedCount !== cloudCount)) {
            const cloudRows = await syncDeadStockFromCloud();
            if (cloudRows && cloudRows.length > 0 && isMounted) {
              setJsonData(cloudRows);
            }
          }
        } catch (metaErr) {
          console.warn("BestSellers cloud metadata check:", metaErr);
        }
      } catch (err) {
        console.error("BestSellers load error:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initData();

    // 2. Real-time Multi-Device Sync: Listen to SSE updates
    const unsubscribe = subscribeToDeadStockUpdates(async () => {
      try {
        const freshRows = await syncDeadStockFromCloud();
        if (freshRows && freshRows.length > 0 && isMounted) {
          setJsonData(freshRows);
          toast.success(`⚡ Best Sellers synced ${freshRows.length.toLocaleString()} records from Cloud!`, { id: "bs-cloud-sync" });
        }
      } catch (syncErr) {
        console.warn("BestSellers real-time sync warning:", syncErr);
      }
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [isAuthenticated]);

  // Force manual refresh from cloud
  const handleForceRefresh = async () => {
    setIsSyncing(true);
    try {
      const freshRows = await syncDeadStockFromCloud();
      if (freshRows && freshRows.length > 0) {
        setJsonData(freshRows);
        toast.success(`Synced ${freshRows.length.toLocaleString()} records from Cloud DB!`);
      } else {
        toast("No records found in Cloud DB", { icon: "ℹ️" });
      }
    } catch (err) {
      toast.error(`Sync error: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Optional: Upload & append directly to the shared Cloud/IndexedDB database
  const handleFileSelect = (file) => {
    setUploadError("");
    setValidationSuccess(false);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        
        if (workbook.SheetNames.length === 0) {
          throw new Error("The Excel file doesn't contain any sheets.");
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
        let headerRowIndex = 0;
        for (let r = range.s.r; r <= range.e.r; r++) {
          let foundCategory = false;
          let foundBranchName = false;
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
            if (cell && cell.v) {
              const val = String(cell.v).trim().toUpperCase();
              if (val === "BRANCH NAME" || val === "STORE NAME") foundBranchName = true;
              if (val === "CATEGORY" || val === "MAIN PRODUCT") foundCategory = true;
            }
          }
          if (foundBranchName && foundCategory) {
            headerRowIndex = r;
            break;
          }
        }

        const parsedData = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
          range: headerRowIndex,
        });

        if (parsedData.length === 0) {
          throw new Error(`The sheet "${sheetName}" does not contain any rows after headers.`);
        }

        setValidationSuccess(true);
        toast.loading("Saving to Cloud & IndexedDB...", { id: "saving-db" });

        // Persist to unified Dead Stock / Best Sellers database
        await appendDeadStockSalesData(parsedData, file.name);
        const freshDb = await loadDeadStockSalesData();
        setJsonData(freshDb || parsedData);
        
        toast.dismiss("saving-db");
        toast.success(`Saved ${parsedData.length.toLocaleString()} rows to Cloud Database!`);
        setShowUploadModal(false);
      } catch (err) {
        toast.dismiss("saving-db");
        setUploadError(err.message || "Failed to process the spreadsheet.");
      }
    };

    reader.onerror = () => {
      setUploadError("Error reading the Excel file.");
    };

    reader.readAsArrayBuffer(file);
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleStoreSelect = (e) => {
    setSelectedStore(e.target.value);
    setExpandedCategories({});
  };

  // Compute Best Sellers analytics from the shared database
  const insights = useMemo(() => {
    if (!jsonData || !Array.isArray(jsonData) || jsonData.length === 0) return null;

    const categories = new Set();
    const stores = new Set();
    const overallItems = {};
    const overallCategories = {};
    const storeCategorySales = {}; // store -> { category -> qty }
    const storeCategoryItemSales = {}; // store -> { category -> { item -> qty } }

    let minDate = null;
    let maxDate = null;

    jsonData.forEach(row => {
      if (!row || typeof row !== "object") return;

      const rawStore = String(getRowVal(row, ["BRANCH NAME", "FROM BRANCH NAME", "STORE NAME", "BRANCH", "STORE", "LOCATION"])).trim();
      const store = normalizeStoreName(rawStore) || rawStore;
      const item = String(getRowVal(row, ["ITEM DESCRIPTION", "DESCRIPTION", "MODEL NAME", "ITEM NAME", "PRODUCT NAME", "ITEM CODE"])).trim();
      const category = String(getRowVal(row, ["CATEGORY", "MAIN PRODUCT", "GROUP NAME", "GROUP"])).trim();
      const qtyRaw = getRowVal(row, ["NET QTY", "TOTAL QTY", "QTY", "SOLD QTY", "QUANTITY", "BILLED QTY", "NO OF QTY"]);
      const qty = Number(qtyRaw) || 0;

      // Extract date for period info if available
      const rawDate = getRowVal(row, ["BILL DATE", "DATE", "BILLDATE", "BILL_DATE", "INVOICE DATE", "TRANSACTION DATE"]);
      if (rawDate) {
        const d = parseBillDate(rawDate);
        if (d && !isNaN(d.getTime())) {
          if (!minDate || d < minDate) minDate = d;
          if (!maxDate || d > maxDate) maxDate = d;
        }
      }

      if (!store || qty <= 0) return;
      
      const state = getStateFromBranch(store);
      if (selectedStateFilter !== "All States" && state !== selectedStateFilter) return;

      // Ignore EXCHANGE category as per standard rule
      if (category && category.toUpperCase() === 'EXCHANGE') return;

      stores.add(store);

      if (category) {
        categories.add(category);
        overallCategories[category] = (overallCategories[category] || 0) + qty;
        
        if (!storeCategorySales[store]) {
          storeCategorySales[store] = {};
          storeCategoryItemSales[store] = {};
        }
        storeCategorySales[store][category] = (storeCategorySales[store][category] || 0) + qty;

        if (item) {
          if (!storeCategoryItemSales[store][category]) {
            storeCategoryItemSales[store][category] = {};
          }
          storeCategoryItemSales[store][category][item] = (storeCategoryItemSales[store][category][item] || 0) + qty;
        }
      }

      if (item) {
        overallItems[item] = (overallItems[item] || 0) + qty;
      }
    });

    const getTop = (map) => {
      let topName = 'N/A';
      let topQty = 0;
      for (const [name, qty] of Object.entries(map)) {
        if (qty > topQty) {
          topQty = qty;
          topName = name;
        }
      }
      return { name: topName, qty: topQty };
    };

    const overallTopItem = getTop(overallItems);
    const overallTopCategory = getTop(overallCategories);

    // Breakdown for selected Category
    const storeBreakdown = [];
    if (selectedCategory !== "All") {
      for (const [storeName, categoriesMap] of Object.entries(storeCategorySales)) {
        const qty = categoriesMap[selectedCategory] || 0;
        if (qty > 0) {
          storeBreakdown.push({ store: storeName, qty });
        }
      }
      storeBreakdown.sort((a, b) => b.qty - a.qty);
    }

    // Breakdown for selected Store
    const categoryBreakdown = [];
    if (selectedStore !== "All" && storeCategorySales[selectedStore]) {
      for (const [cat, qty] of Object.entries(storeCategorySales[selectedStore])) {
        if (qty > 0) {
          categoryBreakdown.push({ category: cat, qty });
        }
      }
      categoryBreakdown.sort((a, b) => b.qty - a.qty);
    }

    let dateRangeText = null;
    if (minDate && maxDate) {
      dateRangeText = `${formatDateDisplay(minDate)} to ${formatDateDisplay(maxDate)}`;
    }

    return {
      categories: Array.from(categories).sort(),
      stores: Array.from(stores).sort(),
      overallTopItem,
      overallTopCategory,
      storeBreakdown,
      categoryBreakdown,
      storeCategoryItemSales,
      dateRangeText,
      totalRows: jsonData.length
    };
  }, [jsonData, selectedCategory, selectedStore, selectedStateFilter]);

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
              className="absolute top-6 left-6 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-500 transition-colors"
              title="Go Back"
            >
              <ArrowLeft size={20} />
            </button>
          )}

          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-950/80 dark:to-purple-950/80 rounded-2xl flex items-center justify-center shadow-inner border border-indigo-200 dark:border-indigo-800">
              <Lock className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            Restricted Access
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8">
            Please enter the password to access <strong>Best Sellers Analytics</strong>.
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
                    try {
                      sessionStorage.setItem("bs_auth", "true");
                    } catch (_) {}
                    toast.success("Access Granted");
                  }
                }}
                placeholder="Enter password..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-slate-800/60 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-gray-900 dark:text-white shadow-sm"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              Unlock Best Sellers
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Loading State
  if (isLoading && !jsonData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-12">
        <div className="w-14 h-14 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <h3 className="text-xl font-medium text-gray-800 dark:text-gray-100">
          Connecting to Cloud Sales Database...
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          Fetching item-wise historic sales data synchronized with Dead Stock Analyzer.
        </p>
      </div>
    );
  }

  // Empty State: Only when Cloud Database has 0 records
  if (!jsonData || jsonData.length === 0) {
    return (
      <div className="flex flex-col items-center mt-6 px-4">
        <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 mb-4 border border-amber-200 dark:border-amber-800">
          <Database size={32} />
        </div>
        <h1 className="text-3xl font-normal text-[#202124] dark:text-white mb-2 text-center">
          No Sales Database Found in Cloud
        </h1>
        <p className="text-[#5f6368] dark:text-gray-300 mb-8 text-center max-w-lg">
          Best Sellers reads directly from your centralized <strong>Dead Stock & Historic Sales Database</strong>. Upload an item-wise collection or sales report once, and it will be permanently available here.
        </p>

        <div className="w-full max-w-2xl">
          <FileDropZone 
            onFileSelect={handleFileSelect} 
            error={uploadError} 
            validationSuccess={validationSuccess} 
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={handleForceRefresh}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded-xl text-sm font-medium transition-colors"
          >
            <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
            Check Cloud Again
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-16">
      {/* Top Header & Cloud Status */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-[rgba(60,64,67,0.08)] text-[#5f6368] dark:text-gray-300 transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#202124] dark:text-white">
                Product & Store Analytics
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <Cloud size={12} />
                Cloud DB Synced
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#5f6368] dark:text-gray-400 mt-1">
              <span>{insights.totalRows.toLocaleString()} Sales Records</span>
              <span>•</span>
              <span>{insights.stores.length} Active Stores</span>
              {insights.dateRangeText && (
                <>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={12} />
                    {insights.dateRangeText}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Actions & Filters */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleForceRefresh}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/70 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg shadow-sm transition-all cursor-pointer"
            title="Refresh database from Cloud"
          >
            <RefreshCw size={14} className={isSyncing ? "animate-spin text-indigo-600" : "text-gray-500"} />
            <span>{isSyncing ? "Syncing..." : "Sync Cloud"}</span>
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-medium rounded-lg border border-indigo-200 dark:border-indigo-800 transition-all shadow-sm cursor-pointer"
            title="Upload new or updated Item Wise sales file to Database"
          >
            <UploadCloud size={14} />
            <span>Upload New Sheet</span>
          </button>

          <div className="w-full sm:w-44">
            <select
              value={selectedStateFilter}
              onChange={(e) => {
                setSelectedStateFilter(e.target.value);
                setSelectedStore("All");
              }}
              className="w-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white text-xs rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 cursor-pointer"
            >
              <option value="All States">All States</option>
              <option value="MP">Madhya Pradesh (MP)</option>
              <option value="MH">Maharashtra (MH)</option>
            </select>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Lock Best Sellers (Logout)"
          >
            <Lock size={15} />
          </button>
        </div>
      </div>

      {/* Top Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="google-card p-6 bg-gradient-to-br from-blue-50 to-white dark:from-slate-800 dark:to-slate-900 border border-blue-100 dark:border-blue-900/50 relative overflow-hidden rounded-2xl shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Trophy size={80} className="text-blue-600" />
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-3 rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300">
              <Package size={24} />
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">Best Seller</h2>
              <p className="text-base font-medium text-gray-800 dark:text-gray-200">Overall Best Selling Item</p>
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 truncate" title={insights.overallTopItem.name}>
              {insights.overallTopItem.name}
            </div>
            <div className="text-sm font-semibold text-blue-700 bg-blue-100/70 dark:bg-blue-900/40 dark:text-blue-300 inline-block px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800">
              {insights.overallTopItem.qty.toLocaleString()} Units Sold
            </div>
          </div>
        </div>

        <div className="google-card p-6 bg-gradient-to-br from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 border border-purple-100 dark:border-purple-900/50 relative overflow-hidden rounded-2xl shadow-sm">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Tag size={80} className="text-purple-600" />
          </div>
          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="p-3 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300">
              <TrendingUp size={24} />
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">Category Leader</h2>
              <p className="text-base font-medium text-gray-800 dark:text-gray-200">Overall Best Category</p>
            </div>
          </div>
          <div className="relative z-10">
            <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2 truncate" title={insights.overallTopCategory.name}>
              {insights.overallTopCategory.name}
            </div>
            <div className="text-sm font-semibold text-purple-700 bg-purple-100/70 dark:bg-purple-900/40 dark:text-purple-300 inline-block px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800">
              {insights.overallTopCategory.qty.toLocaleString()} Units Sold
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Section */}
      <div className="google-card overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm">
        
        {/* Toggle Headers */}
        <div className="flex border-b border-gray-200 dark:border-slate-700">
          <button
            onClick={() => setViewMode("category")}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3.5 sm:py-4 px-2 sm:px-6 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              viewMode === "category" 
                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-b-2 border-indigo-600" 
                : "bg-white/60 dark:bg-slate-800/60 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <Filter size={16} />
            <span className="hidden sm:inline">Category-Wise Store Breakdown</span>
            <span className="sm:hidden">By Category</span>
          </button>
          <button
            onClick={() => setViewMode("store")}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-3.5 sm:py-4 px-2 sm:px-6 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
              viewMode === "store" 
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-b-2 border-emerald-600" 
                : "bg-white/60 dark:bg-slate-800/60 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <Store size={16} />
            <span className="hidden sm:inline">Store-Wise Category Breakdown</span>
            <span className="sm:hidden">By Store</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          {viewMode === "category" && (
            <div>
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                  <h2 className="text-xl font-medium text-gray-800 dark:text-gray-200">Analyze a Category</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">See exactly how many units each store sold of a specific category.</p>
                </div>
                <div className="w-full md:w-72 shrink-0">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Select Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setExpandedCategories({});
                    }}
                    className="w-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 shadow-sm cursor-pointer"
                  >
                    <option value="All">-- Select a Category --</option>
                    {insights.categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedCategory !== 'All' ? (
                <div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 mb-6 flex justify-between items-center">
                    <span className="font-semibold text-indigo-900 dark:text-indigo-300">Total {selectedCategory} Sold:</span>
                    <span className="text-xl font-bold text-indigo-700 dark:text-indigo-400">
                      {insights.storeBreakdown.reduce((sum, item) => sum + item.qty, 0).toLocaleString()} Units
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                        <tr>
                          <th className="px-6 py-4 font-medium">Rank</th>
                          <th className="px-6 py-4 font-medium">Store Name</th>
                          <th className="px-6 py-4 font-medium text-right">Units Sold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.storeBreakdown.map((item, index) => {
                          const isExpanded = expandedCategories[item.store];
                          const itemsMap = insights.storeCategoryItemSales[item.store]?.[selectedCategory] || {};
                          
                          return (
                            <React.Fragment key={item.store}>
                              <tr 
                                onClick={() => toggleCategory(item.store)}
                                className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border-b hover:bg-gray-50 dark:bg-slate-800/50 transition-colors cursor-pointer group"
                              >
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-medium ${
                                    index < 3 ? 'bg-indigo-100 text-indigo-700 dark:text-indigo-400 font-bold' : 'bg-gray-100 text-gray-600 dark:text-gray-300'
                                  }`}>
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                  <div className="flex items-center gap-2">
                                    <Store size={16} className="text-gray-400 dark:text-gray-400 group-hover:text-indigo-500 transition-colors" />
                                    {item.store}
                                    {isExpanded ? (
                                      <ChevronUp size={16} className="text-gray-400 dark:text-gray-400" />
                                    ) : (
                                      <ChevronDown size={16} className="text-gray-400 dark:text-gray-400" />
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right font-semibold text-gray-700 dark:text-gray-300">
                                  {item.qty.toLocaleString()}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan="3" className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                                    <div className="pl-6 sm:pl-14 pr-2 sm:pr-6">
                                      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase mb-3 tracking-wider flex items-center gap-1">
                                        <ChevronRight size={14} /> 
                                        Specific Items Sold
                                      </h4>
                                      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                        <ul className="divide-y divide-gray-100 dark:divide-slate-700">
                                          {Object.entries(itemsMap)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([itemName, itemQty]) => (
                                              <li key={itemName} className="flex justify-between items-center py-2 px-4 hover:bg-gray-50 dark:bg-slate-800/50 transition-colors">
                                                <span className="text-sm text-gray-700 dark:text-gray-300">{itemName}</span>
                                                <span className="font-semibold text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded border border-indigo-100 dark:border-indigo-900/50">
                                                  {itemQty}
                                                </span>
                                              </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                        {insights.storeBreakdown.length === 0 && (
                          <tr>
                            <td colSpan="3" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                              No sales found for this category.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 border-dashed">
                  <div className="icon-filter inline-block">
                    <Filter size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 font-medium">Select a category from the dropdown</p>
                  <p className="text-gray-400 dark:text-gray-400 text-sm mt-1">to view a detailed breakdown of sales across all stores.</p>
                </div>
              )}
            </div>
          )}

          {viewMode === "store" && (
            <div>
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                  <h2 className="text-xl font-medium text-gray-800 dark:text-gray-200">Analyze a Store</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">See all categories sold by a specific store. Click on a category to see specific items.</p>
                </div>
                <div className="w-full md:w-80 shrink-0">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Select Store</label>
                  <select
                    value={selectedStore}
                    onChange={handleStoreSelect}
                    className="w-full bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-gray-300 dark:border-slate-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-2.5 shadow-sm cursor-pointer"
                  >
                    <option value="All">-- Select a Store --</option>
                    {insights.stores.map(store => (
                      <option key={store} value={store}>{store}</option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedStore !== 'All' ? (
                <div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-4 mb-6 flex justify-between items-center">
                    <span className="font-semibold text-emerald-900 dark:text-emerald-300">Total Units Sold by {selectedStore}:</span>
                    <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                      {insights.categoryBreakdown.reduce((sum, item) => sum + item.qty, 0).toLocaleString()} Units
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                        <tr>
                          <th className="px-6 py-4 font-medium">Rank</th>
                          <th className="px-6 py-4 font-medium">Category Name</th>
                          <th className="px-6 py-4 font-medium text-right">Units Sold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.categoryBreakdown.map((item, index) => {
                          const isExpanded = expandedCategories[item.category];
                          const itemsMap = insights.storeCategoryItemSales[selectedStore]?.[item.category] || {};
                          
                          return (
                            <React.Fragment key={item.category}>
                              <tr 
                                onClick={() => toggleCategory(item.category)}
                                className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border-b hover:bg-gray-50 dark:bg-slate-800/50 transition-colors cursor-pointer group"
                              >
                                <td className="px-6 py-4">
                                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-medium ${
                                    index < 3 ? 'bg-emerald-100 text-emerald-700 dark:text-emerald-400 font-bold' : 'bg-gray-100 text-gray-600 dark:text-gray-300'
                                  }`}>
                                    {index + 1}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                                  <div className="flex items-center gap-2">
                                    <LayoutList size={16} className="text-gray-400 dark:text-gray-400 group-hover:text-emerald-500 transition-colors" />
                                    {item.category}
                                    {isExpanded ? (
                                      <ChevronUp size={16} className="text-gray-400 dark:text-gray-400" />
                                    ) : (
                                      <ChevronDown size={16} className="text-gray-400 dark:text-gray-400" />
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right font-semibold text-gray-700 dark:text-gray-300">
                                  {item.qty.toLocaleString()}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan="3" className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-100 dark:border-slate-700">
                                    <div className="pl-6 sm:pl-14 pr-2 sm:pr-6">
                                      <h4 className="text-xs font-bold text-gray-400 dark:text-gray-400 uppercase mb-3 tracking-wider flex items-center gap-1">
                                        <ChevronRight size={14} /> 
                                        Specific Items Sold
                                      </h4>
                                      <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                        <ul className="divide-y divide-gray-100 dark:divide-slate-700">
                                          {Object.entries(itemsMap)
                                            .sort((a, b) => b[1] - a[1])
                                            .map(([itemName, itemQty]) => (
                                              <li key={itemName} className="flex justify-between items-center py-2 px-4 hover:bg-gray-50 dark:bg-slate-800/50 transition-colors">
                                                <span className="text-sm text-gray-700 dark:text-gray-300">{itemName}</span>
                                                <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/50">
                                                  {itemQty}
                                                </span>
                                              </li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                        {insights.categoryBreakdown.length === 0 && (
                          <tr>
                            <td colSpan="3" className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                              No sales found for this store.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-gray-200 dark:border-slate-700 border-dashed">
                  <div className="icon-store inline-block">
                    <Store size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 font-medium">Select a store from the dropdown</p>
                  <p className="text-gray-400 dark:text-gray-400 text-sm mt-1">to view a detailed breakdown of all categories sold by them.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal (Optional: for uploading a fresh file to Cloud DB) */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-700 relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600">
                  <UploadCloud size={20} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Upload to Cloud Sales DB</h3>
              </div>
              <button
                onClick={() => { setShowUploadModal(false); setUploadError(""); }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              Any file uploaded here will automatically update both <strong>Best Sellers</strong> and <strong>Dead Stock Analyzer</strong> in Cloud & Local IndexedDB.
            </p>

            <FileDropZone 
              onFileSelect={handleFileSelect} 
              error={uploadError} 
              validationSuccess={validationSuccess} 
            />

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => { setShowUploadModal(false); setUploadError(""); }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
