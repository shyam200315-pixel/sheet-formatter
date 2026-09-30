import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FileSpreadsheet, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  ArrowLeft, 
  Search, 
  Building2, 
  BarChart3, 
  TrendingUp, 
  CalendarCheck,
  RefreshCw,
  FileCheck,
  ShieldCheck,
  Sparkles,
  Calculator,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toast } from "react-hot-toast";
import { 
  processWooqerFiles, 
  exportQ3SummaryReportExcel, 
  exportMasterStoreTrackerExcel,
  get3ColorScaleHex
} from "../utils/wooqerProcessor";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from "recharts";

export default function WooqerReports({ onBack }) {
  const [loading, setLoading] = useState(false);
  const [processedData, setProcessedData] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [exportingSummary, setExportingSummary] = useState(false);
  const [exportingTracker, setExportingTracker] = useState(false);
  const [showLogicDetails, setShowLogicDetails] = useState(true);

  const EXPECTED_TYPES = [
    { key: "opening", label: "Opening Audit" },
    { key: "closing", label: "Closing Audit" },
    { key: "monday", label: "Monday Checklist" },
    { key: "tuesday", label: "Tuesday Checklist" },
    { key: "wednesday", label: "Wednesday Checklist" },
    { key: "thursday", label: "Thursday Checklist" },
    { key: "friday", label: "Friday Checklist" },
  ];

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setLoading(true);
    const toastId = toast.loading("Processing Wooqer audit files...");

    try {
      const res = await processWooqerFiles(files);
      setProcessedData(res);
      toast.success(
        `Calculated target: ${res.targetMetrics.expectedForms} Forms & ${res.targetMetrics.fixedTargetMaxScore} Points across ${res.totalStores} stores!`,
        { id: toastId }
      );
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Failed to process Wooqer Excel files.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleExportSummary = async () => {
    if (!processedData || !processedData.summaryRows) return;
    setExportingSummary(true);
    try {
      await exportQ3SummaryReportExcel(processedData.summaryRows, processedData.targetMetrics);
      toast.success("Downloaded Full_Q3_Store_Audit_Report.xlsx!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Q3 Summary Report.");
    } finally {
      setExportingSummary(false);
    }
  };

  const handleExportTracker = async () => {
    if (!processedData || !processedData.storeTrackers) return;
    setExportingTracker(true);
    try {
      await exportMasterStoreTrackerExcel(processedData.storeTrackers);
      toast.success("Downloaded Master_Store_Tracker_With_Dates.xlsx!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Master Store Tracker.");
    } finally {
      setExportingTracker(false);
    }
  };

  // Filtered store rows for UI table
  const filteredSummaryRows = (processedData?.summaryRows || []).filter((item) =>
    item.store.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Overall KPI Calculations
  const totalStores = processedData?.totalStores || 0;
  const totalFormsFilledAll = (processedData?.summaryRows || []).reduce(
    (acc, curr) => acc + curr.totalFormsFilled,
    0
  );

  const expectedFormsVal = processedData?.targetMetrics?.expectedForms || 250;
  const maxScoreVal = processedData?.targetMetrics?.fixedTargetMaxScore || 897;

  const totalExpFormsSum = totalStores * expectedFormsVal;
  const overallSubPct = totalExpFormsSum > 0 ? totalFormsFilledAll / totalExpFormsSum : 0;

  const totalScoreSum = (processedData?.summaryRows || []).reduce(
    (acc, curr) => acc + curr.totalScoreObtained,
    0
  );
  const totalMaxScoreSum = totalStores * maxScoreVal;
  const overallFulPct = totalMaxScoreSum > 0 ? totalScoreSum / totalMaxScoreSum : 0;

  // Chart data
  const chartData = (processedData?.summaryRows || []).map((row) => ({
    store: row.store,
    submissionRate: +(row.formsSubmissionPct * 100).toFixed(1),
    fulfillmentRate: +(row.pointsFulfillmentPct * 100).toFixed(1),
    totalForms: row.totalFormsFilled,
  }));

  const tm = processedData?.targetMetrics;

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Top Header Card */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card bg-gradient-to-r from-blue-900/90 via-indigo-900/90 to-slate-900/90 backdrop-blur-xl text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/20 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="bg-blue-500/30 text-blue-200 border border-blue-400/40 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} className="text-amber-300" /> Wooqer 3-Color Scale Audit Intelligence
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white flex items-center gap-3">
              <FileSpreadsheet className="w-9 h-9 text-blue-400" /> Wooqer Reports
            </h1>
            <p className="text-slate-300 text-sm sm:text-base mt-1.5 max-w-2xl">
              Consolidated Q3 Audit Data Processing. Generates 3-Color Scale Conditional Formatting reports matching exact store target templates.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-center">
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-sm font-medium transition-all flex items-center gap-2 cursor-pointer shadow-sm backdrop-blur-md"
              >
                <ArrowLeft size={16} /> Back to Dashboard
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Upload Zone & Detected Files Status */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-md"
      >
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="w-full md:w-1/2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Upload Raw Excel Files
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Select or drag all 7 daily audit Excel files at once (Opening, Closing, Monday, Tuesday, Wednesday, Thursday, Friday).
            </p>

            <label className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-blue-400/60 dark:border-blue-500/40 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-100/60 dark:hover:bg-blue-900/30 transition-all cursor-pointer group">
              <input
                type="file"
                multiple
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
                disabled={loading}
              />
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-3 text-blue-600 dark:text-blue-300 group-hover:scale-110 transition-transform">
                <FileCheck size={24} />
              </div>
              <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">
                {loading ? "Processing files..." : "Click to select 7 raw Excel files"}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Supports multiple selection (`.xlsx`)
              </span>
            </label>
          </div>

          {/* Categories Detected Badges */}
          <div className="w-full md:w-1/2 bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-200/80 dark:border-slate-700/80">
            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>File Types Detected</span>
              {processedData && (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
                  <CheckCircle2 size={13} /> Active Dataset Loaded
                </span>
              )}
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 text-xs">
              {EXPECTED_TYPES.map((type) => {
                const detectedName = processedData?.fileCategories?.[type.key];
                return (
                  <div
                    key={type.key}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                      detectedName
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                        : "bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {detectedName ? (
                      <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle size={14} className="text-gray-400 shrink-0" />
                    )}
                    <div className="truncate">
                      <span className="font-semibold block">{type.label}</span>
                      <span className="text-[10px] opacity-75 truncate block">
                        {detectedName || "Not loaded"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Action Export Buttons */}
        {processedData && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <ShieldCheck size={16} className="text-blue-500" />
              Dynamic Range: <strong>01-Jul-2026 to 30-Sep-2026 ({tm?.totalCalendarDays} Days)</strong>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleExportSummary}
                disabled={exportingSummary}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {exportingSummary ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Export Summary Report (`Full_Q3_Store_Audit_Report.xlsx`)
              </button>

              <button
                onClick={handleExportTracker}
                disabled={exportingTracker}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {exportingTracker ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                Export Master Store Tracker (`Master_Store_Tracker_With_Dates.xlsx`)
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Dynamic Target Calculation Breakdown Card */}
      {processedData && tm && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 border border-indigo-500/30 shadow-lg"
        >
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setShowLogicDetails(!showLogicDetails)}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                <Calculator size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  Calendar Days & Target Points Mathematical Breakdown
                </h3>
                <p className="text-xs text-indigo-200/80">
                  Target computed dynamically from 92 Calendar Days (July 1 - Sept 30, 2026)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 text-xs font-bold px-3 py-1 rounded-full">
                Target: {tm.expectedForms} Forms | {tm.fixedTargetMaxScore} Points
              </span>
              {showLogicDetails ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>

          <AnimatePresence>
            {showLogicDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-6 pt-4 border-t border-indigo-800/60 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs"
              >
                {/* Opening & Closing */}
                <div className="bg-indigo-900/40 p-3.5 rounded-xl border border-indigo-700/40 space-y-1.5">
                  <span className="font-semibold text-indigo-300 block flex items-center gap-1.5">
                    <Calendar size={14} /> Opening & Closing Audit
                  </span>
                  <div className="flex justify-between text-slate-300">
                    <span>Opening ({tm.totalCalendarDays} days × 1 pt):</span>
                    <strong className="text-white">{tm.openingPoints} pts</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Closing ({tm.totalCalendarDays} days × 0 pts):</span>
                    <strong className="text-slate-400">{tm.closingPoints} pts</strong>
                  </div>
                  <div className="pt-1 border-t border-indigo-700/30 text-indigo-200 font-medium">
                    Total Daily Forms: {tm.openingExpected + tm.closingExpected} Forms
                  </div>
                </div>

                {/* Weekday Checklists Part 1 */}
                <div className="bg-indigo-900/40 p-3.5 rounded-xl border border-indigo-700/40 space-y-1.5">
                  <span className="font-semibold text-indigo-300 block flex items-center gap-1.5">
                    <Layers size={14} /> Mon - Wed Checklists
                  </span>
                  <div className="flex justify-between text-slate-300">
                    <span>Monday ({tm.mondays} Mon × 13 pts):</span>
                    <strong className="text-amber-300">{tm.mondayPoints} pts</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Tuesday ({tm.tuesdays} Tue × 12 pts):</span>
                    <strong className="text-amber-300">{tm.tuesdayPoints} pts</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Wednesday ({tm.wednesdays} Wed × 12 pts):</span>
                    <strong className="text-amber-300">{tm.wednesdayPoints} pts</strong>
                  </div>
                </div>

                {/* Weekday Checklists Part 2 */}
                <div className="bg-indigo-900/40 p-3.5 rounded-xl border border-indigo-700/40 space-y-1.5">
                  <span className="font-semibold text-indigo-300 block flex items-center gap-1.5">
                    <Layers size={14} /> Thu - Fri Checklists
                  </span>
                  <div className="flex justify-between text-slate-300">
                    <span>Thursday ({tm.thursdays} Thu × 12 pts):</span>
                    <strong className="text-amber-300">{tm.thursdayPoints} pts</strong>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Friday ({tm.fridays} Fri × 12 pts):</span>
                    <strong className="text-amber-300">{tm.fridayPoints} pts</strong>
                  </div>
                  <div className="pt-1 border-t border-indigo-700/30 text-indigo-200 font-medium">
                    Total Weekday Forms: {tm.weekdayChecklistsExpected} Checklists
                  </div>
                </div>

                {/* Grand Total Calculation */}
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-3.5 rounded-xl border border-blue-400/50 space-y-1.5 text-white shadow-md">
                  <span className="font-bold uppercase tracking-wider text-[11px] block opacity-90">
                    Grand Target Summary
                  </span>
                  <div className="text-lg font-extrabold flex items-baseline justify-between">
                    <span>Expected Forms:</span>
                    <span className="text-amber-300">{tm.expectedForms}</span>
                  </div>
                  <div className="text-lg font-extrabold flex items-baseline justify-between">
                    <span>Max Target Score:</span>
                    <span className="text-amber-300">{tm.fixedTargetMaxScore} pts</span>
                  </div>
                  <p className="text-[10px] opacity-80 pt-1">
                    Equal locked baseline for fair store ranking!
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {processedData && (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Building2 size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Stores Tracked</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{totalStores}</h3>
                <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">Active in Q3</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 }}
              className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <CalendarCheck size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Forms Submitted</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">{totalFormsFilledAll.toLocaleString()}</h3>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">Opening, Closing & Mon-Fri</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Avg Form Submission %</p>
                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {(overallSubPct * 100).toFixed(1)}%
                </h3>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">Target: {tm?.expectedForms} forms/store</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              className="glass-card bg-white dark:bg-slate-900/90 rounded-2xl p-5 border border-gray-200 dark:border-slate-800 shadow-sm flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                <BarChart3 size={24} />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Avg Points Fulfillment %</p>
                <h3 className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                  {(overallFulPct * 100).toFixed(1)}%
                </h3>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">Target: {tm?.fixedTargetMaxScore} pts/store</span>
              </div>
            </motion.div>
          </div>

          {/* Recharts Store Performance Chart */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card bg-white dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-md"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart3 className="text-blue-600 dark:text-blue-400" size={20} /> Store-wise Performance Comparison (%)
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="store" tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip
                    formatter={(val) => [`${val}%`, "Rate"]}
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.9)",
                      borderColor: "#334155",
                      borderRadius: "12px",
                      color: "#fff",
                    }}
                  />
                  <Legend />
                  <Bar dataKey="submissionRate" name="Forms Submission %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="fulfillmentRate" name="Points Fulfillment %" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Detailed Q3 Fixed Target Summary Table matching exact reference photo */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card bg-white dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 dark:border-slate-800 shadow-md"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Q3 Fixed Target Store Summary Table (3-Color Scale Formatting)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Exact match to reference report formatting with 3-Color Scale (Green-Yellow-Red) cell fills.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Filter store code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
                />
              </div>
            </div>

            {/* Responsive Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
              <table className="w-full text-xs text-left text-gray-800 dark:text-gray-200">
                <thead className="bg-[#1F497D] text-white uppercase text-[11px] font-semibold tracking-wider text-center">
                  <tr>
                    <th className="py-3 px-3 text-left">Store</th>
                    <th className="py-3 px-2">Opening</th>
                    <th className="py-3 px-2">Closing</th>
                    <th className="py-3 px-2">Mon</th>
                    <th className="py-3 px-2">Tue</th>
                    <th className="py-3 px-2">Wed</th>
                    <th className="py-3 px-2">Thu</th>
                    <th className="py-3 px-2">Fri</th>
                    <th className="py-3 px-2 bg-blue-800">Total Forms Filled</th>
                    <th className="py-3 px-2">Expected Forms (Q3)</th>
                    <th className="py-3 px-2 bg-blue-800">Forms Submission %</th>
                    <th className="py-3 px-2">Total Score Obtained</th>
                    <th className="py-3 px-2">Fixed Target Max Score</th>
                    <th className="py-3 px-2 bg-indigo-900">Points Fulfillment %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                  {filteredSummaryRows.map((row) => {
                    const subPct = (row.formsSubmissionPct * 100).toFixed(1);
                    const fulPct = (row.pointsFulfillmentPct * 100).toFixed(1);

                    const subColorHex = get3ColorScaleHex(row.formsSubmissionPct);
                    const fulColorHex = get3ColorScaleHex(row.pointsFulfillmentPct);

                    return (
                      <tr
                        key={row.store}
                        className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors text-center font-medium"
                      >
                        <td className="py-2.5 px-3 font-bold text-gray-900 dark:text-white text-left border-r border-gray-200 dark:border-slate-800">
                          {row.store}
                        </td>
                        <td className="py-2.5 px-2">{row.opening}</td>
                        <td className="py-2.5 px-2">{row.closing}</td>
                        <td className="py-2.5 px-2">{row.monday}</td>
                        <td className="py-2.5 px-2">{row.tuesday}</td>
                        <td className="py-2.5 px-2">{row.wednesday}</td>
                        <td className="py-2.5 px-2">{row.thursday}</td>
                        <td className="py-2.5 px-2">{row.friday}</td>
                        <td className="py-2.5 px-2 font-semibold text-blue-900 dark:text-blue-200 bg-blue-50/40 dark:bg-blue-950/30">
                          {row.totalFormsFilled}
                        </td>
                        <td className="py-2.5 px-2 text-gray-500 dark:text-gray-400">{row.expectedForms}</td>
                        
                        {/* Forms Submission % with 3-Color Scale Fill matching photo */}
                        <td
                          className="py-2.5 px-2 font-bold text-gray-900 border-x border-gray-300 shadow-inner"
                          style={{ backgroundColor: subColorHex }}
                        >
                          {subPct}%
                        </td>

                        <td className="py-2.5 px-2 font-semibold text-indigo-900 dark:text-indigo-200">
                          {row.totalScoreObtained.toFixed(1)}
                        </td>
                        <td className="py-2.5 px-2 text-gray-500 dark:text-gray-400">{row.fixedTargetMaxScore.toFixed(1)}</td>
                        
                        {/* Points Fulfillment % with 3-Color Scale Fill matching photo */}
                        <td
                          className="py-2.5 px-2 font-bold text-gray-900 border-l border-gray-300 shadow-inner"
                          style={{ backgroundColor: fulColorHex }}
                        >
                          {fulPct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Total Row matching exact reference photo */}
                <tfoot className="bg-[#DCE6F1] dark:bg-slate-800 text-gray-900 dark:text-white font-bold text-center border-t-2 border-slate-900">
                  <tr>
                    <td className="py-3 px-3 text-left">Total</td>
                    <td className="py-3 px-2">
                      {filteredSummaryRows.reduce((a, b) => a + b.opening, 0)}
                    </td>
                    <td className="py-3 px-2">
                      {filteredSummaryRows.reduce((a, b) => a + b.closing, 0)}
                    </td>
                    <td className="py-3 px-2">
                      {filteredSummaryRows.reduce((a, b) => a + b.monday, 0)}
                    </td>
                    <td className="py-3 px-2">
                      {filteredSummaryRows.reduce((a, b) => a + b.tuesday, 0)}
                    </td>
                    <td className="py-3 px-2">
                      {filteredSummaryRows.reduce((a, b) => a + b.wednesday, 0)}
                    </td>
                    <td className="py-3 px-2">
                      {filteredSummaryRows.reduce((a, b) => a + b.thursday, 0)}
                    </td>
                    <td className="py-3 px-2">
                      {filteredSummaryRows.reduce((a, b) => a + b.friday, 0)}
                    </td>
                    <td className="py-3 px-2 text-blue-950">
                      {totalFormsFilledAll.toLocaleString()}
                    </td>
                    <td className="py-3 px-2">
                      {totalExpFormsSum.toLocaleString()}
                    </td>
                    <td
                      className="py-3 px-2 text-gray-900 border-x border-gray-300"
                      style={{ backgroundColor: get3ColorScaleHex(overallSubPct) }}
                    >
                      {(overallSubPct * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-2 text-indigo-950">
                      {totalScoreSum.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>
                    <td className="py-3 px-2">
                      {totalMaxScoreSum.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </td>
                    <td
                      className="py-3 px-2 text-gray-900 border-l border-gray-300"
                      style={{ backgroundColor: get3ColorScaleHex(overallFulPct) }}
                    >
                      {(overallFulPct * 100).toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
