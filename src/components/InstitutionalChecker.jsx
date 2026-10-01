import React, { useState, useMemo, useEffect } from "react";
import { 
  Lock, 
  Search, 
  ShieldCheck, 
  Layers, 
  Check, 
  Copy, 
  Zap, 
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  FileSpreadsheet,
  Plus,
  Trash2,
  Download,
  X,
  FileText,
  UploadCloud,
  Sparkles,
  RefreshCw,
  FileUp
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import institutionalData from "../institutionalOffers.json";

export default function InstitutionalChecker({ onBack }) {
  // Password Protection State
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem("institutional_unlocked") === "true";
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Master Data & Search State
  const [offersData] = useState(institutionalData || []);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [copiedField, setCopiedField] = useState(null);

  // Bulk Excel Order Modal State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [inputText, setInputText] = useState("");
  const [customFileName, setCustomFileName] = useState("");

  // Default Password (stored in localStorage or fallback 'bulk')
  const masterPassword = localStorage.getItem("institutional_password") || "bulk";

  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem('inst_recent_searches');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // Auto-select item when searching if exact match found
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSelectedItem(null);
      return;
    }
    const cleanTerm = searchTerm.trim().toUpperCase();
    const exactMatch = offersData.find(item => item.code.toUpperCase() === cleanTerm);
    if (exactMatch) {
      setSelectedItem(exactMatch);
    }
  }, [searchTerm, offersData]);

  // Track recent searches when selectedItem changes
  useEffect(() => {
    if (selectedItem && selectedItem.code) {
      const code = selectedItem.code;
      const description = selectedItem.description || "";
      const label = description ? `${code} (${description.length > 20 ? description.slice(0, 20) + '...' : description})` : code;

      setRecentSearches(prev => {
        if (prev.length > 0 && prev[0].code === code) return prev;
        const filtered = prev.filter(r => r.code !== code);
        const updated = [{ code, label }, ...filtered].slice(0, 4);
        try {
          localStorage.setItem('inst_recent_searches', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }
  }, [selectedItem]);

  // Handle Unlock
  const handleUnlock = (e) => {
    e?.preventDefault();
    if (passwordInput === masterPassword) {
      setIsUnlocked(true);
      sessionStorage.setItem("institutional_unlocked", "true");
      setPasswordError("");
      toast.success("Access Granted to Institutional Pricing");
    } else {
      setPasswordError("Incorrect passcode!");
      toast.error("Incorrect Passcode");
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    sessionStorage.removeItem("institutional_unlocked");
    setPasswordInput("");
    toast.success("Locked Institutional Offers");
  };

  // Filtered Search Results
  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.trim().toLowerCase();
    return offersData.filter(item => 
      item.code.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
    ).slice(0, 30);
  }, [searchTerm, offersData]);

  // Determine active slab and price for chosen quantity
  const getActiveSlabInfo = (item, qty) => {
    if (!item) return null;
    const numQty = Math.max(1, parseInt(qty, 10) || 1);

    let activeSlabIndex = 1;
    let label = "<= 100 Units";
    let landingPrice = Math.ceil(item.slab1 || item.mrcInclGst || 0);

    if (numQty > 500 && item.slab4 > 0) {
      activeSlabIndex = 4;
      landingPrice = Math.ceil(item.slab4);
      label = "> 500 Units";
    } else if (numQty > 300 && item.slab3 > 0) {
      activeSlabIndex = 3;
      landingPrice = Math.ceil(item.slab3);
      label = "301 - 500 Units";
    } else if (numQty > 100 && item.slab2 > 0) {
      activeSlabIndex = 2;
      landingPrice = Math.ceil(item.slab2);
      label = "101 - 300 Units";
    }

    const mrp = Math.ceil(item.mrp || 0);
    const discountAmount = mrp > landingPrice ? mrp - landingPrice : 0;
    const discountPct = mrp > 0 ? (((mrp - landingPrice) / mrp) * 100).toFixed(1) : "0.0";
    const baseCostBeforeTax = Math.ceil(landingPrice / (1 + (item.tax || 0.18)));
    const totalTaxPerUnit = Math.ceil(landingPrice - baseCostBeforeTax);
    const totalAmount = landingPrice * numQty;
    const totalMrpVal = mrp * numQty;
    const totalSavings = (mrp - landingPrice) * numQty;

    return {
      activeSlabIndex,
      landingPrice,
      label,
      discountPct,
      discountAmount,
      baseCostBeforeTax,
      totalTaxPerUnit,
      totalAmount,
      totalMrpVal,
      totalSavings
    };
  };

  const copyToClipboard = (text, fieldName) => {
    navigator.clipboard.writeText(String(text));
    setCopiedField(fieldName);
    toast.success(`Copied ${fieldName}`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Add single item code + qty to text area
  const handleAddSingleToText = (item, qty) => {
    if (!item) return;
    const validQty = Math.max(1, parseInt(qty, 10) || 1);
    const newLine = `${item.code} ${validQty}`;
    setInputText(prev => prev.trim() ? `${prev.trim()}\n${newLine}` : newLine);
    toast.success(`Added ${item.code} (Qty: ${validQty}) to Bulk Text!`);
    setShowBulkModal(true);
  };

  // File Upload Handler for Excel / CSV / Text
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        let extracted = "";

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          json.forEach(row => {
            if (Array.isArray(row) && row.length > 0) {
              const codeCell = row.find(c => c && String(c).trim().match(/^[A-Za-z0-9_-]{6,12}$/));
              const qtyCell = row.find(c => typeof c === 'number' && c > 0 && c <= 100000);
              if (codeCell) {
                extracted += `${String(codeCell).trim()} ${qtyCell || 1}\n`;
              }
            }
          });
        });

        if (extracted.trim()) {
          setInputText(extracted.trim());
          toast.success("Uploaded & extracted HANA codes");
        } else {
          toast.error("Could not find HANA codes in file.");
        }
      } catch (err) {
        toast.error("Failed to read file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Count valid lines live
  const parsedStats = useMemo(() => {
    if (!inputText.trim()) return { count: 0, items: [] };

    const lines = inputText.split(/\r?\n/);
    const items = [];
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const match = trimmed.match(/([A-Za-z0-9_-]+)[\s,=:\t]+(\d+)/);
      let code = "";
      let qty = 1;
      if (match) {
        code = match[1].trim().toUpperCase();
        qty = parseInt(match[2], 10) || 1;
      } else {
        const cleanCode = trimmed.replace(/[^A-Za-z0-9_-]/g, "");
        if (cleanCode) {
          code = cleanCode.toUpperCase();
          qty = 1;
        }
      }

      if (code) {
        const matchedItem = offersData.find(o => o.code.toUpperCase() === code);
        if (matchedItem) {
          items.push({ code, qty, matchedItem });
        }
      }
    });

    return { count: items.length, items };
  }, [inputText, offersData]);

  // Download Excel File (.xlsx) with smart filename and exact Order_Requirement structure
  const handleGenerateExcel = async () => {
    if (!inputText.trim()) {
      toast.error("Please enter or paste HANA codes and quantities first!");
      return;
    }

    const lines = inputText.split(/\r?\n/);
    const parsedItems = [];
    const currentDate = new Date();
    const day = String(currentDate.getDate()).padStart(2, '0');
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const year = currentDate.getFullYear();
    const dateStr = `${day}-${month}-${year}`;

    let invalidCount = 0;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const match = trimmed.match(/([A-Za-z0-9_-]+)[\s,=:\t]+(\d+)/);
      let code = "";
      let qty = 1;

      if (match) {
        code = match[1].trim().toUpperCase();
        qty = parseInt(match[2], 10) || 1;
      } else {
        const cleanCode = trimmed.replace(/[^A-Za-z0-9_-]/g, "");
        if (cleanCode) {
          code = cleanCode.toUpperCase();
          qty = 1;
        }
      }

      if (code) {
        const matchedItem = offersData.find(o => o.code.toUpperCase() === code);
        if (matchedItem) {
          const mrp = Math.ceil(matchedItem.mrp || 0);
          let landingPrice = Math.ceil(matchedItem.slab1 || matchedItem.mrcInclGst || 0);

          if (qty > 500 && matchedItem.slab4 > 0) {
            landingPrice = Math.ceil(matchedItem.slab4);
          } else if (qty > 300 && matchedItem.slab3 > 0) {
            landingPrice = Math.ceil(matchedItem.slab3);
          } else if (qty > 100 && matchedItem.slab2 > 0) {
            landingPrice = Math.ceil(matchedItem.slab2);
          }

          const discPct = mrp > 0 ? Math.round(((mrp - landingPrice) / mrp) * 100) : 0;

          parsedItems.push({
            date: dateStr,
            code: matchedItem.code,
            description: matchedItem.description,
            category: matchedItem.category || "GENERAL",
            qty,
            mrp,
            landingPrice,
            discPct
          });
        } else {
          invalidCount++;
        }
      }
    });

    if (parsedItems.length === 0) {
      toast.error("No valid HANA codes found in the entered text!");
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Order_Requirement");

      // Enable Gridlines
      worksheet.views = [{ showGridLines: true }];

      // Set explicit Column widths matching sample file
      worksheet.columns = [
        { width: 14 }, // Date
        { width: 16 }, // ITEM CODE
        { width: 44 }, // ITEM DESCRIPTION
        { width: 22 }, // Category
        { width: 12 }, // Req Qty
        { width: 12 }, // MRP
        { width: 14 }, // Landing 
        { width: 10 }, // Dis%
      ];

      // Header Row (Exact Header Names)
      const headerValues = [
        "Date",
        "ITEM CODE",
        "ITEM DESCRIPTION",
        "Category",
        "Req Qty",
        "MRP",
        "Landing ",
        "Dis%"
      ];

      const headerRow = worksheet.addRow(headerValues);
      headerRow.height = 30;

      headerRow.eachCell((cell) => {
        cell.font = { name: "Calibri", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1A73E8" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD3D3D3" } },
          bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
          left: { style: "thin", color: { argb: "FFD3D3D3" } },
          right: { style: "thin", color: { argb: "FFD3D3D3" } },
        };
      });

      // Data Rows
      parsedItems.forEach(item => {
        const dataRow = worksheet.addRow([
          item.date,
          item.code,
          item.description,
          item.category,
          item.qty,
          item.mrp,
          item.landingPrice,
          item.discPct
        ]);

        dataRow.height = 20;
        dataRow.eachCell((cell) => {
          cell.font = { name: "Calibri", size: 11 };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin", color: { argb: "FFD3D3D3" } },
            bottom: { style: "thin", color: { argb: "FFD3D3D3" } },
            left: { style: "thin", color: { argb: "FFD3D3D3" } },
            right: { style: "thin", color: { argb: "FFD3D3D3" } },
          };
        });
      });

      // Smart Dynamic Filename
      let exportFileName = "";
      if (customFileName.trim()) {
        const cleanCustom = customFileName.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
        exportFileName = cleanCustom.endsWith(".xlsx") ? cleanCustom : `${cleanCustom}.xlsx`;
      } else {
        exportFileName = `Institutional_Bulk_Rates_${dateStr}.xlsx`;
      }

      // Export File
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, exportFileName);

      if (invalidCount > 0) {
        toast.success(`Saved "${exportFileName}" with ${parsedItems.length} items (${invalidCount} code(s) skipped)`);
      } else {
        toast.success(`Saved "${exportFileName}" (${parsedItems.length} items)`);
      }
    } catch (err) {
      console.error("Excel generation error:", err);
      toast.error("Failed to generate Excel file.");
    }
  };

  // PASSWORD LOCK SCREEN
  if (!isUnlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />

          <div className="text-center space-y-4 mb-8">
            <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Institutional Offers</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter passcode to access institutional & bulk slab rates.
              </p>
            </div>
          </div>

          <form onSubmit={handleUnlock} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                Security Passcode
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter Passcode..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs text-rose-500 mt-2 text-center flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {passwordError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" /> Unlock Portal
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const activeSlabInfo = selectedItem ? getActiveSlabInfo(selectedItem, quantity) : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 p-4 md:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Institutional Pricing & Slab Checker
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lookup HANA code for MRP, tax %, and rounded-up quantity slab landing rates ({offersData.length} records).
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Bulk Excel Order Sheet Option Button */}
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" /> Bulk Rates Excel Generator
          </button>

          {/* Lock Button */}
          <button
            onClick={handleLock}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-xs rounded-xl transition-all flex items-center gap-1.5"
          >
            <Lock className="w-4 h-4" /> Lock Portal
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Search & Item List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Enter HANA Code / Item Code or Name
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g. 19003278 or PIGEON EVA..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                autoFocus
              />
              {searchTerm && (
                <button 
                  onClick={() => { setSearchTerm(""); setSelectedItem(null); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-200 dark:bg-slate-700 rounded-full w-5 h-5 flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Recent Searches buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1 min-h-[28px]">
              <span className="text-[11px] font-medium text-slate-400">Recent Searches:</span>
              {recentSearches.length > 0 ? (
                recentSearches.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSearchTerm(chip.code);
                      const matched = offersData.find(o => o.code.toUpperCase() === chip.code.toUpperCase());
                      if (matched) {
                        setSelectedItem(matched);
                      }
                    }}
                    className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 hover:text-blue-600 text-slate-600 dark:text-slate-300 text-xs font-mono font-medium rounded-lg border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                  >
                    {chip.label}
                  </button>
                ))
              ) : (
                <span className="text-[11px] text-slate-400 italic">None</span>
              )}
            </div>
          </div>

          {/* Search Results List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm max-h-[520px] overflow-y-auto space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-slate-400 px-1 border-b border-slate-100 dark:border-slate-800 pb-2">
              <span>Matching Items ({searchResults.length})</span>
              <span>Click to view details</span>
            </div>

            {!searchTerm.trim() ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Search className="w-8 h-8 mx-auto opacity-30 text-blue-500" />
                <p className="text-xs font-normal">Type a HANA code (e.g. 19003278) or product name above to view rates.</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <AlertCircle className="w-8 h-8 mx-auto opacity-30 text-rose-500" />
                <p className="text-xs font-medium text-rose-500">No matching HANA code found for "{searchTerm}".</p>
              </div>
            ) : (
              searchResults.map(item => {
                const isSelected = selectedItem?.code === item.code;
                const roundedSlab1 = Math.ceil(item.slab1 || item.mrcInclGst);
                return (
                  <div
                    key={item.code}
                    onClick={() => setSelectedItem(item)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? "bg-blue-50/60 dark:bg-blue-950/40 border-blue-400 ring-1 ring-blue-400/50" 
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="font-mono font-medium text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                          {item.code}
                        </span>
                        <h4 className="text-xs font-medium text-slate-900 dark:text-white line-clamp-1 mt-1">
                          {item.description}
                        </h4>
                        <span className="text-[11px] font-normal text-slate-400 block">
                          {item.category}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white">
                          MRP: ₹{Math.ceil(item.mrp || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          Base Slab: ₹{roundedSlab1.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Detailed MRP, Tax & Slab Calculator */}
        <div className="lg:col-span-7 space-y-4">
          {selectedItem ? (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6 relative overflow-hidden"
            >
              {/* Product Header Card */}
              <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm relative overflow-hidden space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-3 py-1 bg-blue-600 text-white font-mono font-medium text-xs rounded-lg shadow-xs">
                    HANA CODE: {selectedItem.code}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAddSingleToText(selectedItem, quantity)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-400" /> Add Code & Qty
                    </button>
                    <span className="px-3 py-1 bg-slate-800 text-slate-300 text-xs font-normal rounded-lg border border-slate-700">
                      {selectedItem.category}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-white leading-tight">
                  {selectedItem.description}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800">
                  <div>
                    <span className="text-[10px] font-medium uppercase text-slate-400 block">MRP</span>
                    <span className="text-base font-bold text-blue-400">₹{Math.ceil(selectedItem.mrp || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium uppercase text-slate-400 block">GST Tax Rate</span>
                    <span className="text-base font-bold text-emerald-400">{Math.round((selectedItem.tax || 0.18) * 100)}% GST</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium uppercase text-slate-400 block">Base Cost (Excl GST)</span>
                    <span className="text-base font-bold text-slate-200">₹{Math.ceil(selectedItem.baseAmount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium uppercase text-slate-400 block">MRC Rate (Incl GST)</span>
                    <span className="text-base font-bold text-cyan-400">₹{Math.ceil(selectedItem.mrcInclGst || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Quantity Input Selector */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Select Order Quantity
                  </label>
                  <p className="text-xs text-slate-400 font-normal">
                    Enter quantity to highlight slab rate (prices rounded up).
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input 
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setQuantity("");
                      } else {
                        const parsed = parseInt(val, 10);
                        setQuantity(isNaN(parsed) ? "" : parsed);
                      }
                    }}
                    onBlur={() => {
                      if (quantity === "" || parseInt(quantity, 10) < 1) {
                        setQuantity(1);
                      }
                    }}
                    placeholder="1"
                    className="w-28 px-3 py-2 bg-white dark:bg-slate-900 border border-blue-500 rounded-xl text-center text-base font-mono font-semibold text-slate-900 dark:text-white shadow-xs focus:outline-none"
                  />
                  <div className="flex gap-1">
                    {[50, 150, 350, 600].map(q => (
                      <button
                        key={q}
                        onClick={() => setQuantity(q)}
                        className={`px-2.5 py-1 text-xs font-mono font-medium rounded-lg border transition-all ${
                          quantity === q 
                            ? "bg-blue-600 text-white border-blue-600 shadow-xs" 
                            : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-400"
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Slab-wise Landing Price Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-blue-500" /> Quantity Slab-Wise Landing Prices (Incl. GST)
                  </h4>
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    Active: {activeSlabInfo?.label}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Slab 1 */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    activeSlabInfo?.activeSlabIndex === 1 
                      ? "bg-blue-50/60 dark:bg-blue-950/30 border-blue-500 ring-1 ring-blue-500/30 shadow-xs" 
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Slab 1 (1 - 100 Units)</span>
                      {activeSlabInfo?.activeSlabIndex === 1 && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-medium rounded shadow-xs">ACTIVE</span>
                      )}
                    </div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      ₹{Math.ceil(selectedItem.slab1 || selectedItem.mrcInclGst || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400">
                      Margin: {selectedItem.mrp && selectedItem.slab1 ? Math.round(((selectedItem.mrp - Math.ceil(selectedItem.slab1))/selectedItem.mrp)*100) : 0}% Off MRP
                    </div>
                  </div>

                  {/* Slab 2 */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    activeSlabInfo?.activeSlabIndex === 2 
                      ? "bg-blue-50/60 dark:bg-blue-950/30 border-blue-500 ring-1 ring-blue-500/30 shadow-xs" 
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Slab 2 (101 - 300 Units)</span>
                      {activeSlabInfo?.activeSlabIndex === 2 && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-medium rounded shadow-xs">ACTIVE</span>
                      )}
                    </div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      ₹{Math.ceil(selectedItem.slab2 || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400">
                      Margin: {selectedItem.mrp && selectedItem.slab2 ? Math.round(((selectedItem.mrp - Math.ceil(selectedItem.slab2))/selectedItem.mrp)*100) : 0}% Off MRP
                    </div>
                  </div>

                  {/* Slab 3 */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    activeSlabInfo?.activeSlabIndex === 3 
                      ? "bg-blue-50/60 dark:bg-blue-950/30 border-blue-500 ring-1 ring-blue-500/30 shadow-xs" 
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Slab 3 (301 - 500 Units)</span>
                      {activeSlabInfo?.activeSlabIndex === 3 && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-medium rounded shadow-xs">ACTIVE</span>
                      )}
                    </div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      ₹{Math.ceil(selectedItem.slab3 || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400">
                      Margin: {selectedItem.mrp && selectedItem.slab3 ? Math.round(((selectedItem.mrp - Math.ceil(selectedItem.slab3))/selectedItem.mrp)*100) : 0}% Off MRP
                    </div>
                  </div>

                  {/* Slab 4 */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    activeSlabInfo?.activeSlabIndex === 4 
                      ? "bg-blue-50/60 dark:bg-blue-950/30 border-blue-500 ring-1 ring-blue-500/30 shadow-xs" 
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Slab 4 (&gt; 500 Units)</span>
                      {activeSlabInfo?.activeSlabIndex === 4 && (
                        <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-medium rounded shadow-xs">ACTIVE</span>
                      )}
                    </div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      ₹{Math.ceil(selectedItem.slab4 || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-normal text-slate-400">
                      Margin: {selectedItem.mrp && selectedItem.slab4 ? Math.round(((selectedItem.mrp - Math.ceil(selectedItem.slab4))/selectedItem.mrp)*100) : 0}% Off MRP
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Calculation Summary Card */}
              {activeSlabInfo && (
                <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-blue-400" /> Selected Qty Quote Summary ({quantity || 1} Units)
                    </span>
                    <button
                      onClick={() => copyToClipboard(
                        `Item: ${selectedItem.description}\nHANA Code: ${selectedItem.code}\nQty: ${quantity || 1}\nMRP: ₹${Math.ceil(selectedItem.mrp || 0).toLocaleString('en-IN')}\nSlab Landing Rate: ₹${activeSlabInfo.landingPrice}`,
                        "Quote Summary"
                      )}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg transition-all flex items-center gap-1"
                    >
                      {copiedField === "Quote Summary" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy Quote
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
                      <span className="text-[10px] font-normal text-slate-400 block">Unit MRP</span>
                      <span className="text-lg font-bold text-amber-400">₹{Math.ceil(selectedItem.mrp || 0).toLocaleString('en-IN')}</span>
                    </div>

                    <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
                      <span className="text-[10px] font-normal text-slate-400 block">Unit Landing Rate</span>
                      <span className="text-lg font-bold text-blue-400">₹{activeSlabInfo.landingPrice.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
                      <span className="text-[10px] font-normal text-slate-400 block">Unit Tax (GST)</span>
                      <span className="text-lg font-bold text-cyan-400">₹{activeSlabInfo.totalTaxPerUnit.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
                      <span className="text-[10px] font-normal text-slate-400 block">Discount % off MRP</span>
                      <span className="text-lg font-bold text-emerald-400">{activeSlabInfo.discountPct}% OFF</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3 shadow-sm min-h-[400px] flex flex-col items-center justify-center">
              <Building2 className="w-12 h-12 text-blue-500/30" />
              <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
                Institutional HANA Code Lookup
              </h3>
              <p className="text-xs max-w-sm font-normal">
                Enter any HANA code (like <strong>19003278</strong>) on the left panel to load rates & slab details.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ELEGANT LIGHT THEMED BULK RATES EXCEL GENERATOR MODAL */}
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl flex flex-col shadow-xl overflow-hidden"
            >
              {/* Clean Light Modal Header */}
              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-900/40">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      Bulk Rates Excel Generator
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                      Enter HANA Code and Quantity — generates exact <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300 font-mono text-[11px]">Order_Requirement</code> sheet format.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowBulkModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-full transition-all"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Clean Modal Body: Text Area + File Upload Option + Smart File Name */}
              <div className="p-6 space-y-4 flex-1 bg-white dark:bg-slate-900">
                {/* Input Controls Header */}
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-500" /> Enter / Paste HANA Codes & Quantities
                    </label>
                    <p className="text-xs text-slate-400 font-normal mt-0.5">
                      Type code and quantity (one item per line, e.g. <code className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1 py-0.5 rounded font-mono text-[11px]">19004365 200</code>)
                    </p>
                  </div>

                  {/* Clean File Upload Button */}
                  <label className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-xl shadow-xs cursor-pointer transition-all flex items-center gap-1.5 shrink-0">
                    <FileUp className="w-3.5 h-3.5 text-blue-500" /> Upload File (.xlsx/.txt)
                    <input 
                      type="file" 
                      accept=".xlsx, .xls, .csv, .txt" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>

                {/* Clean Text Area */}
                <div className="relative">
                  <textarea
                    rows="8"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`19004365 200\n19003619 200\n19001663 200`}
                    className="w-full p-4 bg-slate-50/60 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 font-mono text-xs font-normal leading-relaxed focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-all"
                  />
                  {inputText && (
                    <button
                      onClick={() => setInputText("")}
                      className="absolute right-3.5 top-3.5 text-xs font-medium text-slate-400 hover:text-rose-500 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg transition-all"
                    >
                      Clear Text
                    </button>
                  )}
                </div>

                {/* Smart File Name Input & Product Counter */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center pt-1">
                  <div className="sm:col-span-7 flex items-center gap-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-medium shrink-0">
                      Save As Filename:
                    </label>
                    <input 
                      type="text"
                      value={customFileName}
                      onChange={(e) => setCustomFileName(e.target.value)}
                      placeholder={`Institutional_Bulk_Rates_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}`}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="sm:col-span-5 p-2 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-lg flex items-center justify-between text-xs text-blue-900 dark:text-blue-200">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                      Detected: <strong className="font-semibold">{parsedStats.count} Items</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Clean Light Footer */}
              <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 font-medium text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all"
                >
                  Close
                </button>

                <button
                  onClick={handleGenerateExcel}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" /> Download Excel File (.xlsx)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
