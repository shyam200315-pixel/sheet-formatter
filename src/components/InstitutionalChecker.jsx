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
  Building2
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
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

  // Default Password (stored in localStorage or fallback 'bulk')
  const masterPassword = localStorage.getItem("institutional_password") || "bulk";

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

  // Determine active slab and price for chosen quantity (rounded up)
  const getActiveSlabInfo = (item, qty) => {
    if (!item) return null;
    const numQty = parseInt(qty, 10) || 1;

    let activeSlabIndex = 1;
    let landingPrice = Math.ceil(item.slab1 || item.mrcInclGst);
    let label = "<= 100 Units";

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
    const discountPct = mrp > 0 ? ((discountAmount / mrp) * 100).toFixed(1) : 0;

    const baseCostBeforeTax = Math.ceil(landingPrice / (1 + (item.tax || 0.18)));
    const totalTaxPerUnit = Math.ceil(landingPrice - baseCostBeforeTax);

    const totalAmount = Math.ceil(landingPrice * numQty);
    const totalMrpVal = Math.ceil(mrp * numQty);
    const totalSavings = Math.ceil(totalMrpVal - totalAmount);

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

  // PASSWORD LOCK SCREEN
  if (!isUnlocked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
        >
          {/* Ambient Glow */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl" />

          <div className="text-center space-y-4 mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-amber-400 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white">Institutional Offers</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter passcode to access institutional & bulk slab pricing rates.
              </p>
            </div>
          </div>

          <form onSubmit={handleUnlock} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">
                Security Passcode
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter Passcode..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-center text-lg font-mono font-bold tracking-widest focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-xs font-bold text-rose-500 mt-2 text-center flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {passwordError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" /> Unlock Institutional Portal
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
            <div className="p-2 bg-gradient-to-tr from-amber-500 to-amber-400 text-white rounded-xl shadow-md">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                Institutional Pricing & Slab Checker
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lookup HANA code for MRP, tax %, and rounded-up quantity slab landing rates ({offersData.length} records).
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Lock Button */}
          <button
            onClick={handleLock}
            className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
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
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Enter HANA Code / Item Code or Name
            </label>
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500" />
              <input 
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g. 19003278 or PIGEON EVA..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono font-bold text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition-all"
                autoFocus
              />
              {searchTerm && (
                <button 
                  onClick={() => { setSearchTerm(""); setSelectedItem(null); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-200 dark:bg-slate-700 rounded-full w-5 h-5 flex items-center justify-center"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Demo Code buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-slate-400">Sample Codes:</span>
              {["19003278", "16000004", "16000019", "16000204"].map(code => (
                <button
                  key={code}
                  onClick={() => setSearchTerm(code)}
                  className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 text-xs font-mono font-bold rounded-lg border border-amber-200 dark:border-amber-800 transition-all"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          {/* Search Results List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm max-h-[520px] overflow-y-auto space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1 border-b border-slate-100 dark:border-slate-800 pb-2">
              <span>Matching Items ({searchResults.length})</span>
              <span>Click to view details</span>
            </div>

            {!searchTerm.trim() ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <Search className="w-10 h-10 mx-auto opacity-30 text-amber-500" />
                <p className="text-xs font-medium">Type a HANA code (e.g. 19003278) or product name above to view pricing & slabs.</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <AlertCircle className="w-10 h-10 mx-auto opacity-30 text-rose-500" />
                <p className="text-xs font-bold text-rose-500">No matching HANA code found for "{searchTerm}".</p>
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
                        ? "bg-amber-500/10 border-amber-500/60 ring-1 ring-amber-500/50" 
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-500"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="font-mono font-bold text-xs text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                          {item.code}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 mt-1">
                          {item.description}
                        </h4>
                        <span className="text-[11px] font-semibold text-slate-400 block">
                          {item.category}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-slate-900 dark:text-white">
                          MRP: ₹{Math.ceil(item.mrp || 0).toLocaleString('en-IN')}
                        </div>
                        <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
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
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 relative overflow-hidden"
            >
              {/* Product Header Card */}
              <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="px-3 py-1 bg-amber-500 text-slate-950 font-mono font-black text-xs rounded-lg shadow-sm">
                    HANA CODE: {selectedItem.code}
                  </span>
                  <span className="px-3 py-1 bg-slate-700/80 text-slate-200 text-xs font-bold rounded-lg border border-slate-600">
                    {selectedItem.category}
                  </span>
                </div>

                <h3 className="text-lg md:text-xl font-black text-white leading-tight">
                  {selectedItem.description}
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-700/80">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">MRP</span>
                    <span className="text-base font-black text-amber-400">₹{Math.ceil(selectedItem.mrp || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">GST Tax Rate</span>
                    <span className="text-base font-black text-emerald-400">{Math.round((selectedItem.tax || 0.18) * 100)}% GST</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Base Cost (Excl GST)</span>
                    <span className="text-base font-black text-slate-200">₹{Math.ceil(selectedItem.baseAmount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">MRC Rate (Incl GST)</span>
                    <span className="text-base font-black text-cyan-400">₹{Math.ceil(selectedItem.mrcInclGst || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Quantity Input Selector */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <label className="block text-xs font-black uppercase text-slate-500 dark:text-slate-400">
                    Select Order Quantity
                  </label>
                  <p className="text-xs text-slate-400">
                    Enter quantity to highlight slab rate (prices rounded up to next digit).
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <input 
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-32 px-4 py-2.5 bg-white dark:bg-slate-900 border-2 border-amber-500 rounded-xl text-center text-lg font-mono font-black text-slate-900 dark:text-white shadow-sm focus:outline-none"
                  />
                  <div className="flex gap-1">
                    {[50, 150, 350, 600].map(q => (
                      <button
                        key={q}
                        onClick={() => setQuantity(q)}
                        className={`px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg border transition-all ${
                          quantity === q 
                            ? "bg-amber-500 text-slate-950 border-amber-500 shadow-sm" 
                            : "bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-amber-500"
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
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-amber-500" /> Quantity Slab-Wise Landing Prices (Incl. GST)
                  </h4>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    Active: {activeSlabInfo?.label}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Slab 1 */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    activeSlabInfo?.activeSlabIndex === 1 
                      ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/50 shadow-md" 
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Slab 1 (1 - 100 Units)</span>
                      {activeSlabInfo?.activeSlabIndex === 1 && (
                        <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black uppercase rounded shadow-sm">ACTIVE</span>
                      )}
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      ₹{Math.ceil(selectedItem.slab1 || selectedItem.mrcInclGst || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-400">
                      Margin: {selectedItem.mrp && selectedItem.slab1 ? Math.round(((selectedItem.mrp - Math.ceil(selectedItem.slab1))/selectedItem.mrp)*100) : 0}% Off MRP
                    </div>
                  </div>

                  {/* Slab 2 */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    activeSlabInfo?.activeSlabIndex === 2 
                      ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/50 shadow-md" 
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Slab 2 (101 - 300 Units)</span>
                      {activeSlabInfo?.activeSlabIndex === 2 && (
                        <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black uppercase rounded shadow-sm">ACTIVE</span>
                      )}
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      ₹{Math.ceil(selectedItem.slab2 || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-400">
                      Margin: {selectedItem.mrp && selectedItem.slab2 ? Math.round(((selectedItem.mrp - Math.ceil(selectedItem.slab2))/selectedItem.mrp)*100) : 0}% Off MRP
                    </div>
                  </div>

                  {/* Slab 3 */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    activeSlabInfo?.activeSlabIndex === 3 
                      ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/50 shadow-md" 
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Slab 3 (301 - 500 Units)</span>
                      {activeSlabInfo?.activeSlabIndex === 3 && (
                        <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black uppercase rounded shadow-sm">ACTIVE</span>
                      )}
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      ₹{Math.ceil(selectedItem.slab3 || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-400">
                      Margin: {selectedItem.mrp && selectedItem.slab3 ? Math.round(((selectedItem.mrp - Math.ceil(selectedItem.slab3))/selectedItem.mrp)*100) : 0}% Off MRP
                    </div>
                  </div>

                  {/* Slab 4 */}
                  <div className={`p-4 rounded-2xl border transition-all ${
                    activeSlabInfo?.activeSlabIndex === 4 
                      ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/50 shadow-md" 
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800"
                  }`}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Slab 4 (&gt; 500 Units)</span>
                      {activeSlabInfo?.activeSlabIndex === 4 && (
                        <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black uppercase rounded shadow-sm">ACTIVE</span>
                      )}
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white">
                      ₹{Math.ceil(selectedItem.slab4 || 0).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] font-semibold text-slate-400">
                      Margin: {selectedItem.mrp && selectedItem.slab4 ? Math.round(((selectedItem.mrp - Math.ceil(selectedItem.slab4))/selectedItem.mrp)*100) : 0}% Off MRP
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Calculation Summary Card */}
              {activeSlabInfo && (
                <div className="bg-gradient-to-tr from-emerald-950/80 to-slate-900 border border-emerald-500/40 text-white rounded-2xl p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-emerald-800/60 pb-3">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Zap className="w-4 h-4" /> Selected Qty Quote Summary ({quantity} Units)
                    </span>
                    <button
                      onClick={() => copyToClipboard(
                        `Item: ${selectedItem.description}\nHANA Code: ${selectedItem.code}\nQty: ${quantity}\nSlab Landing Rate: ₹${activeSlabInfo.landingPrice}\nTotal Amount: ₹${activeSlabInfo.totalAmount.toLocaleString('en-IN')}`,
                        "Quote Summary"
                      )}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-all flex items-center gap-1"
                    >
                      {copiedField === "Quote Summary" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy Quote
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
                      <span className="text-[10px] font-bold text-slate-400 block">Unit Landing Rate</span>
                      <span className="text-lg font-black text-amber-400">₹{activeSlabInfo.landingPrice.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
                      <span className="text-[10px] font-bold text-slate-400 block">Unit Tax (GST)</span>
                      <span className="text-lg font-black text-cyan-400">₹{activeSlabInfo.totalTaxPerUnit.toLocaleString('en-IN')}</span>
                    </div>

                    <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/60">
                      <span className="text-[10px] font-bold text-slate-400 block">Discount % off MRP</span>
                      <span className="text-lg font-black text-emerald-400">{activeSlabInfo.discountPct}% OFF</span>
                    </div>

                    <div className="bg-emerald-600/30 rounded-xl p-3 border border-emerald-500/40">
                      <span className="text-[10px] font-bold text-emerald-300 block">Total Order Payable</span>
                      <span className="text-lg font-black text-white">₹{activeSlabInfo.totalAmount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3 shadow-sm min-h-[400px] flex flex-col items-center justify-center">
              <Building2 className="w-12 h-12 text-amber-500/40" />
              <h3 className="text-base font-black text-slate-700 dark:text-slate-300">
                Institutional HANA Code Lookup
              </h3>
              <p className="text-xs max-w-sm">
                Enter any HANA code (like <strong>19003278</strong>) on the left panel to instantly load product specifications, MRP, GST rate, and quantity slab prices.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
