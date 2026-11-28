import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Unlock,
  KeyRound,
  FileSpreadsheet,
  FileText,
  Sliders,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  Upload,
  RefreshCw,
  Eye,
  EyeOff,
  Copy,
  Save,
  HelpCircle,
  Plus,
  Store,
  Building2
} from "lucide-react";
import toast from "react-hot-toast";
import {
  MASTER_STORES_INFO,
  getDynamicStoresInfo,
  TARGET_PASSWORD_KEY,
  DEFAULT_TARGET_PASSWORD,
  parseTargetText,
  parseTargetExcelFile,
  calculateGrandTotalTarget,
  calculateMPCommitment,
  saveLocalStoreTargets
} from "../targetManager";
import { saveKnownStores } from "../helpers";
import { saveTargetsToCloud } from "../firebaseConfig";

export default function TargetUpdateModal({
  isOpen,
  onClose,
  currentTargetsMap,
  onTargetsUpdated
}) {
  // Steps: 'auth' -> 'input' -> 'preview'
  const [step, setStep] = useState("auth");

  // Authentication State
  const [passwordInput, setPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  // Input Tabs: 'text' | 'sheet' | 'manual'
  const [inputTab, setInputTab] = useState("text");
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Dynamic Stores & Custom Store Adding
  const [customStoreCounter, setCustomStoreCounter] = useState(0);
  const [showAddStoreForm, setShowAddStoreForm] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const [newStoreTarget, setNewStoreTarget] = useState("");

  const allStores = useMemo(() => {
    return getDynamicStoresInfo(currentTargetsMap);
  }, [currentTargetsMap, customStoreCounter]);

  const mpStores = useMemo(() => allStores.filter(s => s.state === "MP"), [allStores]);
  const mhStores = useMemo(() => allStores.filter(s => s.state === "MH"), [allStores]);
  const otherStores = useMemo(() => allStores.filter(s => s.state !== "MP" && s.state !== "MH"), [allStores]);

  // Manual Quick Edit State (all dynamic stores)
  const [manualTargets, setManualTargets] = useState({});

  // Preview & Confirmation Data
  const [parsedPreview, setParsedPreview] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Always require authentication when modal opens
  useEffect(() => {
    if (isOpen) {
      try {
        sessionStorage.removeItem("target_admin_unlocked");
      } catch (e) {}
      setStep("auth");
      setPasswordInput("");
      setPasswordError("");

      // Initialize manual targets for all dynamic stores
      const initialManual = {};
      allStores.forEach(s => {
        initialManual[s.code] = currentTargetsMap[s.code] ?? currentTargetsMap[s.name] ?? s.defaultTarget;
      });
      setManualTargets(initialManual);
    }
  }, [isOpen, currentTargetsMap, allStores]);

  if (!isOpen) return null;

  // Handle Passcode Unlock
  const handleUnlock = (e) => {
    if (e) e.preventDefault();
    const storedPass = localStorage.getItem(TARGET_PASSWORD_KEY);
    const activePass = (!storedPass || storedPass === "1234") ? DEFAULT_TARGET_PASSWORD : storedPass;
    if (passwordInput.trim().toLowerCase() === activePass.trim().toLowerCase()) {
      setPasswordError("");
      setStep("input");
      toast.success("Security verified!");
    } else {
      setPasswordError("Incorrect passcode.");
    }
  };

  // Handle Add Custom Store directly in modal
  const handleAddCustomStore = (e) => {
    if (e) e.preventDefault();
    const cleanName = newStoreName.trim().toUpperCase();
    if (!cleanName) {
      toast.error("Please enter a store code or name (e.g. WMH013 - NASHIK).");
      return;
    }

    const codeMatch = cleanName.match(/^(WM[HM]\d{1,3})/i);
    const code = codeMatch ? codeMatch[1].toUpperCase() : cleanName.split(/[\s-]/)[0].toUpperCase();
    const targetAmt = Number(newStoreTarget) || 500000;

    // Save to known master stores
    try {
      saveKnownStores([cleanName]);
    } catch (err) {}

    // Add to current manual targets state
    setManualTargets(prev => ({
      ...prev,
      [code]: targetAmt,
      [cleanName]: targetAmt
    }));

    setCustomStoreCounter(c => c + 1);
    setNewStoreName("");
    setNewStoreTarget("");
    setShowAddStoreForm(false);
    toast.success(`Store ${code} added to targets!`);
  };

  // Populate sample MP text format
  const handleLoadMPSample = () => {
    const sample = mpStores
      .map(s => `${s.code}  ${currentTargetsMap[s.code] ?? s.defaultTarget}`)
      .join("\n");
    setTextInput(sample);
  };

  // Populate sample all stores format
  const handleLoadAllSample = () => {
    const sample = allStores
      .map(s => `${s.code}  ${currentTargetsMap[s.code] ?? s.defaultTarget}`)
      .join("\n");
    setTextInput(sample);
  };

  // Generate Preview from Text
  const handlePreviewFromText = () => {
    if (!textInput.trim()) {
      toast.error("Please enter or paste store targets first.");
      return;
    }
    const result = parseTargetText(textInput, currentTargetsMap);
    if (!result.updates || result.updates.length === 0) {
      toast.error("No valid store targets found in the entered text. Check format (e.g. WMP001 300000).");
      return;
    }
    setParsedPreview(result);
    setStep("preview");
  };

  // Handle File Upload & Processing
  const handleFileDrop = async (file) => {
    if (!file) return;
    setIsProcessingFile(true);
    setSelectedFile(file);
    try {
      const result = await parseTargetExcelFile(file, currentTargetsMap);
      if (!result.updates || result.updates.length === 0) {
        toast.error("Could not find store targets in this spreadsheet. Check column headers.");
        setIsProcessingFile(false);
        return;
      }
      setParsedPreview(result);
      setStep("preview");
    } catch (err) {
      toast.error(err.message || "Failed to parse Excel file.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Generate Preview from Manual Edit
  const handlePreviewFromManual = () => {
    const updates = [];
    const previewMap = { ...currentTargetsMap };

    allStores.forEach(store => {
      const newTarget = Number(manualTargets[store.code]) || 0;
      const oldTarget = currentTargetsMap[store.code] ?? currentTargetsMap[store.name] ?? store.defaultTarget;
      previewMap[store.code] = newTarget;
      previewMap[store.name] = newTarget;

      if (newTarget !== oldTarget) {
        updates.push({
          code: store.code,
          name: store.name,
          state: store.state,
          oldTarget,
          newTarget,
          diff: newTarget - oldTarget,
        });
      }
    });

    if (updates.length === 0) {
      toast("No values were changed.", { icon: "ℹ️" });
      return;
    }

    setParsedPreview({ updates, unmatched: [], previewMap });
    setStep("preview");
  };

  // Save Confirmed Targets (Sync to Cloud + LocalStorage + React State)
  const handleConfirmAndSave = async () => {
    if (!parsedPreview) return;
    setIsSaving(true);
    try {
      const updatedMap = { ...parsedPreview.previewMap };
      const newGrandTotal = calculateGrandTotalTarget(updatedMap);
      const newMPCommitment = calculateMPCommitment(updatedMap);

      const payload = {
        storeTargets: updatedMap,
        monthlyTarget: newGrandTotal,
        monthlyCommitment: newGrandTotal,
        mpCommitment: newMPCommitment,
        updatedAt: new Date().toISOString()
      };

      // 1. Save to Local Storage immediately
      saveLocalStoreTargets(updatedMap);

      // 2. Sync to Backend Database & trigger SSE for all other devices
      try {
        await saveTargetsToCloud(payload);
        toast.success("Target saved & synced to all devices in real-time!");
      } catch (cloudErr) {
        console.warn("Cloud sync warning (saved locally):", cloudErr.message);
        toast.success("Target saved locally! (Cloud offline/fallback)");
      }

      // 3. Notify parent app
      if (onTargetsUpdated) {
        onTargetsUpdated(updatedMap, newGrandTotal, newMPCommitment);
      }

      onClose();
    } catch (err) {
      toast.error("Failed to save targets: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate totals for Preview
  const currentTotal = calculateGrandTotalTarget(currentTargetsMap);
  const previewTotal = parsedPreview ? calculateGrandTotalTarget(parsedPreview.previewMap) : currentTotal;
  const netDiff = previewTotal - currentTotal;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-white">
                Monthly Target Manager
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update store targets with real-time multi-device cloud sync
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: Passcode Protection */}
          {step === "auth" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md mx-auto py-6"
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200/50 dark:border-amber-800/50">
                  <Lock className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                  Admin Passcode Required
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enter your security code to adjust store targets.
                </p>
              </div>

              <form onSubmit={handleUnlock} className="space-y-4">
                <div>
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
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-2"
                >
                  <Unlock className="w-4 h-4" /> Unlock Target Settings
                </button>
              </form>
            </motion.div>
          )}

          {/* STEP 2: Input Options (Parse Text / Sheet Upload / Manual) */}
          {step === "input" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* Tabs Navigation */}
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  onClick={() => setInputTab("text")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                    inputTab === "text"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <FileText className="w-4 h-4" /> Parse Text
                </button>
                <button
                  onClick={() => setInputTab("sheet")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                    inputTab === "sheet"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" /> Upload Sheet
                </button>
                <button
                  onClick={() => setInputTab("manual")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all ${
                    inputTab === "manual"
                      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  }`}
                >
                  <Sliders className="w-4 h-4" /> Quick Edit ({allStores.length} Stores)
                </button>
              </div>

              {/* TAB 1: PARSE TEXT */}
              {inputTab === "text" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Paste WhatsApp / Excel Store Targets
                    </label>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        type="button"
                        onClick={handleLoadMPSample}
                        className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        Load MP Format
                      </button>
                      <span className="text-slate-300 dark:text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={handleLoadAllSample}
                        className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        Load All Stores
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder={`Example format (Store Code & Target):\nWMP001 350000\nWMP002 400000\nWMH001 500000\n\nSupports tab-separated from Excel or spaces from WhatsApp!`}
                      rows={8}
                      className="w-full p-3 font-mono text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none resize-none leading-relaxed"
                    />
                  </div>

                  <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/40 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2">
                    <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Enter store codes (e.g. <code>WMP001</code>, <code>WMH003</code>) or store cities with amounts.
                      Only the stores you provide will be modified; other stores retain their current values.
                    </span>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handlePreviewFromText}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center gap-2"
                    >
                      <span>Preview Target Changes</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: SHEET UPLOAD */}
              {inputTab === "sheet" && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileDrop(e.dataTransfer.files[0]);
                      }
                    }}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-8 text-center bg-slate-50/50 dark:bg-slate-800/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-3"
                    onClick={() => document.getElementById("target-file-input")?.click()}
                  >
                    <input
                      id="target-file-input"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileDrop(e.target.files[0]);
                        }
                      }}
                    />
                    <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                      <Upload className="w-8 h-8" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">
                        {isProcessingFile ? "Reading Spreadsheet..." : "Click or Drag & Drop Target Excel/CSV"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Accepts any file with Store Code / Branch and Target amount columns
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-600 dark:text-slate-300">
                    <strong>Auto-Detection:</strong> Columns like "Store Code", "Store Name", "Branch", "Target", "Monthly Target" are recognized automatically.
                  </div>
                </div>
              )}

              {/* TAB 3: MANUAL QUICK EDIT */}
              {inputTab === "manual" && (
                <div className="space-y-3">
                  {/* Top Bar with Add Store Button */}
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Store Target List ({allStores.length} Stores)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddStoreForm(!showAddStoreForm)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
                    >
                      <Plus className="w-3.5 h-3.5" /> {showAddStoreForm ? "Cancel Add" : "Add New Store"}
                    </button>
                  </div>

                  {/* Add New Store Form */}
                  {showAddStoreForm && (
                    <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2">
                      <div className="text-xs font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" /> Add Store to Target Manager
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newStoreName}
                          onChange={(e) => setNewStoreName(e.target.value)}
                          placeholder="e.g. WMH013 - NASHIK"
                          className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-medium text-slate-800 dark:text-slate-200"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={newStoreTarget}
                            onChange={(e) => setNewStoreTarget(e.target.value)}
                            placeholder="Target ₹ (e.g. 500000)"
                            className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-800 dark:text-slate-200"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomStore}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium shrink-0"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="max-h-80 overflow-y-auto pr-1 space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50/40 dark:bg-slate-850/40">
                    {/* MP Stores */}
                    {mpStores.length > 0 && (
                      <>
                        <div className="text-[11px] font-semibold tracking-wider text-purple-600 dark:text-purple-400 px-2 pt-1 uppercase">
                          Madhya Pradesh Stores ({mpStores.length})
                        </div>
                        {mpStores.map(store => (
                          <div
                            key={store.code}
                            className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{store.code}</span>
                              <span className="text-slate-400 ml-1.5 truncate hidden sm:inline">{store.name.split("-").slice(1).join("-") || store.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">₹</span>
                              <input
                                type="number"
                                value={manualTargets[store.code] || ""}
                                onChange={(e) => setManualTargets({ ...manualTargets, [store.code]: Number(e.target.value) })}
                                className="w-28 px-2 py-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-right font-mono font-medium text-slate-800 dark:text-slate-100"
                              />
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* MH Stores */}
                    {mhStores.length > 0 && (
                      <>
                        <div className="text-[11px] font-semibold tracking-wider text-blue-600 dark:text-blue-400 px-2 pt-3 uppercase">
                          Maharashtra Stores ({mhStores.length})
                        </div>
                        {mhStores.map(store => (
                          <div
                            key={store.code}
                            className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{store.code}</span>
                              <span className="text-slate-400 ml-1.5 truncate hidden sm:inline">{store.name.split("-").slice(1).join("-") || store.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">₹</span>
                              <input
                                type="number"
                                value={manualTargets[store.code] || ""}
                                onChange={(e) => setManualTargets({ ...manualTargets, [store.code]: Number(e.target.value) })}
                                className="w-28 px-2 py-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-right font-mono font-medium text-slate-800 dark:text-slate-100"
                              />
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* Other Stores */}
                    {otherStores.length > 0 && (
                      <>
                        <div className="text-[11px] font-semibold tracking-wider text-emerald-600 dark:text-emerald-400 px-2 pt-3 uppercase">
                          Other Stores ({otherStores.length})
                        </div>
                        {otherStores.map(store => (
                          <div
                            key={store.code}
                            className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{store.code}</span>
                              <span className="text-slate-400 ml-1.5 truncate hidden sm:inline">{store.name.split("-").slice(1).join("-") || store.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-slate-400">₹</span>
                              <input
                                type="number"
                                value={manualTargets[store.code] || ""}
                                onChange={(e) => setManualTargets({ ...manualTargets, [store.code]: Number(e.target.value) })}
                                className="w-28 px-2 py-1 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-right font-mono font-medium text-slate-800 dark:text-slate-100"
                              />
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handlePreviewFromManual}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center gap-2"
                    >
                      <span>Preview Target Changes</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* STEP 3: PREVIEW & CONFIRMATION SCREEN */}
          {step === "preview" && parsedPreview && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Stores Modified</div>
                  <div className="text-xl font-bold text-slate-800 dark:text-white mt-0.5">
                    {parsedPreview.updates.length} Stores
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">New Grand Target</div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                    ₹ {previewTotal.toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Net Difference</div>
                  <div className={`text-xl font-bold mt-0.5 ${netDiff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {netDiff >= 0 ? `+ ₹ ${netDiff.toLocaleString("en-IN")}` : `- ₹ ${Math.abs(netDiff).toLocaleString("en-IN")}`}
                  </div>
                </div>
              </div>

              {/* Stores Breakdown Table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 flex justify-between items-center">
                  <span>Store-wise Updates Confirmation</span>
                  <span className="text-[11px] text-slate-500 font-normal">Review before confirming</span>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-850 sticky top-0 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2 px-3 font-medium">Store</th>
                        <th className="py-2 px-3 font-medium text-right">Old Target</th>
                        <th className="py-2 px-3 font-medium text-right">New Target</th>
                        <th className="py-2 px-3 font-medium text-right">Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedPreview.updates.map((item) => (
                        <tr key={item.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                          <td className="py-2 px-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{item.code}</span>
                            <span className="text-slate-400 ml-1.5 truncate hidden sm:inline">{item.name.split("-").slice(1).join("-")}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-500 dark:text-slate-400">
                            ₹ {item.oldTarget.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-blue-600 dark:text-blue-400">
                            ₹ {item.newTarget.toLocaleString("en-IN")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium">
                            {item.diff === 0 ? (
                              <span className="text-slate-400">Same</span>
                            ) : item.diff > 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400">+{item.diff.toLocaleString("en-IN")}</span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400">-{Math.abs(item.diff).toLocaleString("en-IN")}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Unmatched Warnings if any */}
              {parsedPreview.unmatched && parsedPreview.unmatched.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
                  <div className="flex items-center gap-1.5 font-semibold mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Unrecognized Lines ({parsedPreview.unmatched.length})</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 max-h-20 overflow-y-auto font-mono text-[11px] text-amber-700 dark:text-amber-400">
                    {parsedPreview.unmatched.map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep("input")}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Edit
                </button>

                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleConfirmAndSave}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving to Cloud...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Yes, Confirm & Update Target</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
