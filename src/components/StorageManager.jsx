import React, { useState, useEffect } from "react";
import {
  HardDrive,
  Database,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Calendar,
  FileSpreadsheet,
  Layers,
  ShieldAlert,
  Server,
  Cloud,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getCloudStorageStats,
  deleteFileFromCloud,
  deleteDateFromCloud,
  deleteDeadStockFileFromCloud,
  deleteDeadStockDateFromCloud,
  clearHistoricalData,
  clearDeadStockFromCloud,
  formatDateDisplay,
  parseBillDate
} from "../helpers";

export default function StorageManager({ onBack }) {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedFeature, setExpandedFeature] = useState("historical-sales");

  // Delete Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    actionType: "", // 'delete-file' | 'delete-date' | 'clear-table'
    targetId: "",
    targetName: "",
    featureId: "", // 'historical-sales' | 'dead-stock-bestsellers'
    isProcessing: false
  });

  // Date picker cleanup state
  const [histDeleteDate, setHistDeleteDate] = useState("");
  const [dsDeleteDate, setDsDeleteDate] = useState("");

  const fetchStats = async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const data = await getCloudStorageStats();
      setStats(data);
      if (isManual) toast.success("Live Storage Stats refreshed!");
    } catch (err) {
      console.error("Storage fetch error:", err);
      toast.error(`Could not fetch storage stats: ${err.message}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleOpenDeleteModal = (config) => {
    setConfirmModal({
      isOpen: true,
      ...config,
      isProcessing: false
    });
  };

  const handleCloseModal = () => {
    if (confirmModal.isProcessing) return;
    setConfirmModal({
      isOpen: false,
      title: "",
      message: "",
      actionType: "",
      targetId: "",
      targetName: "",
      featureId: "",
      isProcessing: false
    });
  };

  const handleExecuteDeletion = async () => {
    setConfirmModal(prev => ({ ...prev, isProcessing: true }));
    const { actionType, targetId, featureId } = confirmModal;

    try {
      if (actionType === "delete-file") {
        if (featureId === "historical-sales") {
          await deleteFileFromCloud(targetId);
          toast.success("Historical Sales file deleted successfully!");
        } else if (featureId === "dead-stock-bestsellers") {
          await deleteDeadStockFileFromCloud(targetId);
          toast.success("Dead Stock file deleted successfully!");
        }
      } else if (actionType === "delete-date") {
        if (featureId === "historical-sales") {
          await deleteDateFromCloud(targetId);
          toast.success(`Historical Sales for ${targetId} deleted!`);
          setHistDeleteDate("");
        } else if (featureId === "dead-stock-bestsellers") {
          await deleteDeadStockDateFromCloud(targetId);
          toast.success(`Dead Stock sales for ${targetId} deleted!`);
          setDsDeleteDate("");
        }
      } else if (actionType === "clear-table") {
        if (featureId === "historical-sales") {
          await clearHistoricalData();
          toast.success("Historical Sales database cleared!");
        } else if (featureId === "dead-stock-bestsellers") {
          await clearDeadStockFromCloud();
          toast.success("Dead Stock database cleared!");
        }
      }

      handleCloseModal();
      await fetchStats(true);
    } catch (err) {
      toast.error(`Delete failed: ${err.message}`);
      setConfirmModal(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const formatRawDate = (raw) => {
    if (!raw) return "N/A";
    const d = parseBillDate(raw);
    if (!d || isNaN(d.getTime())) return String(raw);
    return formatDateDisplay(d);
  };

  if (isLoading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-16">
        <div className="w-14 h-14 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <h3 className="text-xl font-medium text-gray-800 dark:text-gray-100">
          Scanning Cloud Database Storage...
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center max-w-md">
          Querying Neon PostgreSQL catalog and calculating table sizes and indexes.
        </p>
      </div>
    );
  }

  const quotaMb = stats?.quotaBytes ? (stats.quotaBytes / (1024 * 1024)).toFixed(0) : "512";
  const usedMb = stats?.usedBytes ? (stats.usedBytes / (1024 * 1024)).toFixed(1) : "0.0";
  const freeMb = stats?.freeBytes ? (stats.freeBytes / (1024 * 1024)).toFixed(1) : "512.0";
  const usedPercent = stats?.usedPercent || 0;

  const histFeature = stats?.features?.find(f => f.id === "historical-sales");
  const dsFeature = stats?.features?.find(f => f.id === "dead-stock-bestsellers");
  const targetFeature = stats?.features?.find(f => f.id === "store-targets");

  // Percentage of each category relative to total 512 MB quota
  const histPercentOfQuota = stats?.quotaBytes && histFeature ? ((histFeature.bytes / stats.quotaBytes) * 100) : 0;
  const dsPercentOfQuota = stats?.quotaBytes && dsFeature ? ((dsFeature.bytes / stats.quotaBytes) * 100) : 0;
  const sysPercentOfQuota = stats?.quotaBytes && stats.systemOverhead ? ((stats.systemOverhead.bytes / stats.quotaBytes) * 100) : 0;

  return (
    <div className="w-full max-w-7xl mx-auto pb-24 px-4 sm:px-6">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-gray-300 transition-colors cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft size={24} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white flex items-center gap-2.5">
                <Database className="text-indigo-600 dark:text-indigo-400" size={28} />
                Cloud Storage Manager
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <Cloud size={12} />
                Neon Postgres
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Live database storage telemetry, table size metrics, and space cleanup center.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchStats(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin text-indigo-600" : "text-gray-500"} />
            <span>{isRefreshing ? "Updating Stats..." : "Refresh Live Stats"}</span>
          </button>
        </div>
      </div>

      {/* Google Storage Manager Visual Multi-Color Bar Card */}
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-3xl border border-gray-200 dark:border-slate-800 p-6 md:p-8 shadow-sm mb-8">
        
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Account Cloud Storage
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white">
                {usedMb} MB
              </span>
              <span className="text-lg text-gray-500 dark:text-gray-400 font-medium">
                used of {quotaMb} MB ({usedPercent}% used)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-4 py-2 rounded-2xl">
            <Sparkles className="text-emerald-600 dark:text-emerald-400" size={20} />
            <div>
              <div className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                Remaining Storage
              </div>
              <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                {freeMb} MB Available ({((100 - usedPercent)).toFixed(1)}%)
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Color Segmented Storage Bar */}
        <div className="w-full h-5 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden flex shadow-inner mb-6 p-0.5 border border-gray-200 dark:border-slate-700">
          {/* Blue: Historical Sales */}
          <div
            style={{ width: `${Math.max(histPercentOfQuota, 0.8)}%` }}
            className="bg-blue-500 h-full rounded-l-full transition-all duration-500 hover:opacity-90"
            title={`Historical Sales: ${histFeature?.pretty || "5.1 MB"}`}
          />
          {/* Purple: Dead Stock & Best Sellers */}
          <div
            style={{ width: `${Math.max(dsPercentOfQuota, 0.8)}%` }}
            className="bg-purple-500 h-full transition-all duration-500 hover:opacity-90"
            title={`Dead Stock & Best Sellers: ${dsFeature?.pretty || "5.1 MB"}`}
          />
          {/* Slate: System Overhead & Indexes */}
          <div
            style={{ width: `${Math.max(sysPercentOfQuota, 0.8)}%` }}
            className="bg-slate-500 h-full rounded-r-full transition-all duration-500 hover:opacity-90"
            title={`System Indexes & Metadata: ${stats?.systemOverhead?.pretty || "7.8 MB"}`}
          />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium pt-2 border-t border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0 shadow-sm" />
            <div>
              <div className="text-gray-900 dark:text-white font-semibold">Historical Sales</div>
              <div className="text-gray-500 dark:text-gray-400">{histFeature?.pretty || "5.1 MB"} ({histFeature?.percent || 0}%)</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0 shadow-sm" />
            <div>
              <div className="text-gray-900 dark:text-white font-semibold">Dead Stock & Best Sellers</div>
              <div className="text-gray-500 dark:text-gray-400">{dsFeature?.pretty || "5.1 MB"} ({dsFeature?.percent || 0}%)</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-slate-500 shrink-0 shadow-sm" />
            <div>
              <div className="text-gray-900 dark:text-white font-semibold">System & Indexes</div>
              <div className="text-gray-500 dark:text-gray-400">{stats?.systemOverhead?.pretty || "7.4 MB"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-200 dark:bg-slate-700 shrink-0 shadow-sm" />
            <div>
              <div className="text-gray-900 dark:text-white font-semibold">Available Free Space</div>
              <div className="text-gray-500 dark:text-gray-400">{freeMb} MB ({(100 - usedPercent).toFixed(1)}%)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Sections */}
      <div className="space-y-6">

        {/* Feature 1: Historical Sales Database */}
        <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all">
          <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/20">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl mt-1">
                <FileSpreadsheet size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Historical Sales Database
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                    {histFeature?.pretty || "5.1 MB"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                  {histFeature?.description}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mt-2 font-medium">
                  <span>📊 {histFeature?.rowCount?.toLocaleString() || 0} Total Records</span>
                  <span>•</span>
                  <span>📁 {histFeature?.files?.length || 0} Uploaded Files</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center">
              <button
                onClick={() => setExpandedFeature(expandedFeature === "historical-sales" ? "" : "historical-sales")}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
              >
                <span>{expandedFeature === "historical-sales" ? "Hide Files" : "Manage Files"}</span>
                {expandedFeature === "historical-sales" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              <button
                onClick={() => handleOpenDeleteModal({
                  title: "Clear Historical Sales Database",
                  message: "Are you sure you want to delete ALL historical sales records from the cloud? This will delete all 19,000+ sales rows and cannot be undone.",
                  actionType: "clear-table",
                  featureId: "historical-sales"
                })}
                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                title="Wipe Historical Sales Table"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Expandable File List & Cleanup for Historical Sales */}
          {expandedFeature === "historical-sales" && (
            <div className="p-6 border-t border-gray-100 dark:border-slate-800 space-y-6">
              
              {/* Cleanup by Date Control */}
              <div className="bg-gray-50 dark:bg-slate-800/40 p-4 rounded-xl border border-gray-200 dark:border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    Clean Space by Specific Date:
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    Remove all bill records for a specific date (e.g. 2026-10-31)
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="date"
                    value={histDeleteDate}
                    onChange={(e) => setHistDeleteDate(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-xs rounded-lg px-2.5 py-1.5 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={() => {
                      if (!histDeleteDate) return toast.error("Please pick a date to delete");
                      handleOpenDeleteModal({
                        title: `Delete Historical Sales for ${histDeleteDate}`,
                        message: `Are you sure you want to delete all historical sales records for date ${histDeleteDate}?`,
                        actionType: "delete-date",
                        targetId: histDeleteDate,
                        featureId: "historical-sales"
                      });
                    }}
                    disabled={!histDeleteDate}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-800 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Delete Date
                  </button>
                </div>
              </div>

              {/* Uploaded Files Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                  Uploaded Files in Historical Database ({histFeature?.files?.length || 0})
                </h4>

                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[11px] text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">File Name</th>
                        <th className="px-4 py-3 font-semibold text-right">Records</th>
                        <th className="px-4 py-3 font-semibold">Date Coverage</th>
                        <th className="px-4 py-3 font-semibold">Uploaded On</th>
                        <th className="px-4 py-3 font-semibold text-center w-20">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-white/50 dark:bg-slate-900/50">
                      {histFeature?.files?.map((file) => (
                        <tr key={file.fileId} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <FileSpreadsheet size={15} className="text-blue-500 shrink-0" />
                              <span className="truncate max-w-xs" title={file.fileName}>{file.fileName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-700 dark:text-gray-300">
                            {file.count.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                            {file.minDate && file.maxDate ? (
                              <span>{formatRawDate(file.minDate)} → {formatRawDate(file.maxDate)}</span>
                            ) : "Single Date"}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                            {file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : "Historical"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleOpenDeleteModal({
                                title: `Delete "${file.fileName}"`,
                                message: `Are you sure you want to delete file "${file.fileName}"? This will remove ${file.count.toLocaleString()} records from the Historical Sales database and free up storage.`,
                                actionType: "delete-file",
                                targetId: file.fileId,
                                targetName: file.fileName,
                                featureId: "historical-sales"
                              })}
                              className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                              title="Delete this file"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!histFeature?.files || histFeature.files.length === 0) && (
                        <tr>
                          <td colSpan="5" className="px-4 py-6 text-center text-gray-400">
                            No files found in Historical Database.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feature 2: Dead Stock & Best Sellers Database */}
        <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all">
          <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-purple-50/50 to-transparent dark:from-purple-950/20">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-xl mt-1">
                <Layers size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    Dead Stock & Best Sellers Database
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                    {dsFeature?.pretty || "5.1 MB"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                  {dsFeature?.description}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400 mt-2 font-medium">
                  <span>📦 {dsFeature?.rowCount?.toLocaleString() || 0} Total Records</span>
                  <span>•</span>
                  <span>📁 {dsFeature?.files?.length || 0} Uploaded Files</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-center">
              <button
                onClick={() => setExpandedFeature(expandedFeature === "dead-stock-bestsellers" ? "" : "dead-stock-bestsellers")}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 transition-colors cursor-pointer"
              >
                <span>{expandedFeature === "dead-stock-bestsellers" ? "Hide Files" : "Manage Files"}</span>
                {expandedFeature === "dead-stock-bestsellers" ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              <button
                onClick={() => handleOpenDeleteModal({
                  title: "Clear Dead Stock Database",
                  message: "Are you sure you want to delete ALL item-wise records from the Dead Stock & Best Sellers database? This will remove all 17,000+ items.",
                  actionType: "clear-table",
                  featureId: "dead-stock-bestsellers"
                })}
                className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer"
                title="Wipe Dead Stock Table"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Expandable File List & Cleanup for Dead Stock */}
          {expandedFeature === "dead-stock-bestsellers" && (
            <div className="p-6 border-t border-gray-100 dark:border-slate-800 space-y-6">
              
              {/* Cleanup by Date Control */}
              <div className="bg-gray-50 dark:bg-slate-800/40 p-4 rounded-xl border border-gray-200 dark:border-slate-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    Clean Space by Specific Date:
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    Remove all item sales for a specific date (e.g. 2026-11-03)
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="date"
                    value={dsDeleteDate}
                    onChange={(e) => setDsDeleteDate(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 text-xs rounded-lg px-2.5 py-1.5 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={() => {
                      if (!dsDeleteDate) return toast.error("Please pick a date to delete");
                      handleOpenDeleteModal({
                        title: `Delete Dead Stock Items for ${dsDeleteDate}`,
                        message: `Are you sure you want to delete all item sales for date ${dsDeleteDate}?`,
                        actionType: "delete-date",
                        targetId: dsDeleteDate,
                        featureId: "dead-stock-bestsellers"
                      });
                    }}
                    disabled={!dsDeleteDate}
                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-800 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Delete Date
                  </button>
                </div>
              </div>

              {/* Uploaded Files Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                  Uploaded Files in Dead Stock Database ({dsFeature?.files?.length || 0})
                </h4>

                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700">
                  <table className="w-full text-xs text-left">
                    <thead className="text-[11px] text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-700">
                      <tr>
                        <th className="px-4 py-3 font-semibold">File Name</th>
                        <th className="px-4 py-3 font-semibold text-right">Items</th>
                        <th className="px-4 py-3 font-semibold">Date Coverage</th>
                        <th className="px-4 py-3 font-semibold">Uploaded On</th>
                        <th className="px-4 py-3 font-semibold text-center w-20">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800 bg-white/50 dark:bg-slate-900/50">
                      {dsFeature?.files?.map((file) => (
                        <tr key={file.fileId} className="hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            <div className="flex items-center gap-2">
                              <Layers size={15} className="text-purple-500 shrink-0" />
                              <span className="truncate max-w-xs" title={file.fileName}>{file.fileName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-gray-700 dark:text-gray-300">
                            {file.count.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                            {file.minDate && file.maxDate ? (
                              <span>{formatRawDate(file.minDate)} → {formatRawDate(file.maxDate)}</span>
                            ) : "Single Date"}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                            {file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString() : "N/A"}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleOpenDeleteModal({
                                title: `Delete "${file.fileName}"`,
                                message: `Are you sure you want to delete file "${file.fileName}"? This will remove ${file.count.toLocaleString()} items from the Dead Stock & Best Sellers database.`,
                                actionType: "delete-file",
                                targetId: file.fileId,
                                targetName: file.fileName,
                                featureId: "dead-stock-bestsellers"
                              })}
                              className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                              title="Delete this file"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!dsFeature?.files || dsFeature.files.length === 0) && (
                        <tr>
                          <td colSpan="5" className="px-4 py-6 text-center text-gray-400">
                            No files found in Dead Stock Database.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Feature 3: Store Commitments & Targets */}
        <div className="bg-white/80 dark:bg-slate-900/80 rounded-2xl border border-gray-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-xl mt-1">
              <HardDrive size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Store Commitments & Targets
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
                  {targetFeature?.pretty || "32 KB"}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
                {targetFeature?.description}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 rounded-full border border-emerald-200 dark:border-emerald-800 self-end sm:self-center">
            Active Settings Synced
          </span>
        </div>

        {/* Feature 4: Postgres System & Schema Overhead */}
        <div className="bg-gray-50/70 dark:bg-slate-800/40 rounded-2xl border border-gray-200 dark:border-slate-700/60 p-5 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-3">
            <Server size={18} className="text-slate-400 shrink-0" />
            <div>
              <span className="font-semibold text-gray-700 dark:text-gray-300">PostgreSQL Schema & Query Indexes: </span>
              <span>{stats?.systemOverhead?.pretty || "7.4 MB"} • {stats?.systemOverhead?.description}</span>
            </div>
          </div>
          <span className="font-semibold text-gray-600 dark:text-gray-400 shrink-0 ml-2">
            Auto-Optimized
          </span>
        </div>
      </div>

      {/* Safety Confirmation Dialog Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-slate-800 relative">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-3 rounded-2xl bg-red-100 dark:bg-red-950/60">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {confirmModal.title}
              </h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={handleCloseModal}
                disabled={confirmModal.isProcessing}
                className="px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteDeletion}
                disabled={confirmModal.isProcessing}
                className="px-5 py-2.5 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {confirmModal.isProcessing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
