import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, AlertTriangle, CheckCircle, Search, Download, Filter } from 'lucide-react';
import FileDropZone from './FileDropZone';
import { findHeaderRowIndex, parseBillDate } from '../helpers';
import toast from 'react-hot-toast';

export default function InwardTracker() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("ALL");

  const requiredHeaders = ["BRANCH NAME", "BILL NO.", "BILL DATE", "GOODS IN TRANSIT", "PUR QTY"];

  const handleFileSelect = (file) => {
    setError("");
    setValidationSuccess(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dataArr = new Uint8Array(e.target.result);
        const workbook = XLSX.read(dataArr, { type: "array" });
        
        if (workbook.SheetNames.length === 0) {
          throw new Error("The Excel file doesn't contain any sheets.");
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const headerRowIndex = findHeaderRowIndex(worksheet);

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
          range: headerRowIndex,
        });

        if (jsonData.length === 0) {
          throw new Error(`The sheet "${sheetName}" does not contain any rows after headers.`);
        }

        const sampleRow = jsonData[0];
        const missingHeaders = requiredHeaders.filter(h => !(h in sampleRow));

        if (missingHeaders.length > 0) {
          throw new Error(
            `Unable to locate required columns: ${missingHeaders.join(", ")}. `
          );
        }

        const today = new Date();
        const invoicesMap = {};

        for (const row of jsonData) {
          const inTransit = String(row["GOODS IN TRANSIT"]).trim().toLowerCase();
          
          if (inTransit === "true") {
            const billNo = String(row["BILL NO."] || "N/A").trim();
            const qty = Number(row["PUR QTY"]) || 0;
            
            if (!invoicesMap[billNo]) {
              const billDateStr = row["BILL DATE"];
              const parsedDate = parseBillDate(billDateStr);
              
              let daysOld = 0;
              if (parsedDate) {
                const diffTime = Math.abs(today - parsedDate);
                daysOld = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              }

              invoicesMap[billNo] = {
                branch: row["BRANCH NAME"] || "N/A",
                supplier: row["SUPPLIER NAME"] || "N/A",
                billNo: billNo,
                billDate: billDateStr || "N/A",
                daysOld: daysOld,
                parsedDate: parsedDate,
                totalQty: 0
              };
            }
            
            invoicesMap[billNo].totalQty += qty;
          }
        }

        const pendingInvoices = Object.values(invoicesMap);
        pendingInvoices.sort((a, b) => b.daysOld - a.daysOld);

        setValidationSuccess(true);
        setTimeout(() => {
          setData(pendingInvoices);
        }, 1500);

      } catch (err) {
        setError(err.message || "Failed to process the spreadsheet.");
      }
    };

    reader.onerror = () => {
      setError("Error reading the Excel file.");
    };

    reader.readAsArrayBuffer(file);
  };

  const handleReset = () => {
    setData(null);
    setValidationSuccess(false);
    setError("");
    setSearchQuery("");
    setSelectedBranch("ALL");
  };

  const storeStats = useMemo(() => {
    if (!data) return [];
    const stats = {};
    data.forEach(inv => {
      stats[inv.branch] = (stats[inv.branch] || 0) + 1;
    });
    return Object.entries(stats)
      .map(([branch, count]) => ({ branch, count }))
      .sort((a, b) => b.count - a.count);
  }, [data]);

  const filteredData = useMemo(() => {
    if (!data) return [];
    return data.filter(inv => {
      const matchSearch = inv.branch.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          inv.billNo.toLowerCase().includes(searchQuery.toLowerCase());
      const matchBranch = selectedBranch === "ALL" || inv.branch === selectedBranch;
      return matchSearch && matchBranch;
    });
  }, [data, searchQuery, selectedBranch]);

  const exportToExcel = () => {
    if (filteredData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const exportData = filteredData.map((inv, index) => ({
      "SNO.": index + 1,
      "BRANCH NAME": inv.branch,
      "SUPPLIER NAME": inv.supplier,
      "BILL NO.": inv.billNo,
      "BILL DATE": inv.billDate,
      "TOTAL QTY": inv.totalQty,
      "DAYS OLD": inv.daysOld,
      "STATUS": inv.daysOld <= 8 ? "Safe Zone" : (inv.daysOld > 30 ? "Critical Alert" : "Red Alert"),
      "REMARKS": "" // Blank space for user to type in
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pending Inwards");

    // Adjust column widths for better formatting
    const wscols = [
      {wch: 6},  // SNO
      {wch: 35}, // BRANCH
      {wch: 45}, // SUPPLIER
      {wch: 15}, // BILL NO
      {wch: 15}, // BILL DATE
      {wch: 12}, // TOTAL QTY
      {wch: 10}, // DAYS OLD
      {wch: 15}, // STATUS
      {wch: 30}, // REMARKS
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, "Pending_Inwards_Report.xlsx");
    toast.success("Excel report downloaded successfully!");
  };

  return (
    <div className="w-full">
      <AnimatePresence mode="wait">
        {!data ? (
          <motion.div
            key="upload-view"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex flex-col items-center mt-6"
          >
            <div className="p-4 rounded-full bg-[#e8f0fe] text-[#1a73e8] mb-6 shadow-sm">
              <Truck size={48} strokeWidth={1.5} />
            </div>
            <h1 className="text-3xl font-normal text-[#202124] mb-2 text-center">
              Upload Stock Transfer Report
            </h1>
            <p className="text-[#5f6368] mb-10 text-center max-w-lg">
              Track pending inwardings and see how many days old each invoice is.
            </p>

            <div className="w-full max-w-2xl">
              <FileDropZone 
                onFileSelect={handleFileSelect} 
                error={error} 
                validationSuccess={validationSuccess} 
                requiredHeaders={requiredHeaders}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard-view"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="w-full pb-16"
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-normal tracking-tight text-[#202124] flex items-center gap-3">
                  Pending Inwardings
                </h1>
                <p className="text-sm text-[#5f6368] mt-1">
                  Showing {filteredData.length} invoices that are currently in transit.
                </p>
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 btn-primary px-4 py-2 text-sm shadow-sm"
                >
                  <Download size={18} />
                  Export Excel
                </button>
                <button
                  onClick={handleReset}
                  className="px-4 py-2 rounded-full border border-[#dadce0] text-[#5f6368] font-medium hover:bg-[#f8f9fa] transition-colors text-sm"
                >
                  Upload New
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-white rounded-xl shadow-sm border border-[#dadce0]">
              <div className="relative flex-1 md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search branch or bill no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] sm:text-sm transition-colors shadow-sm"
                />
              </div>

              <div className="relative flex-1 md:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-4 w-4 text-gray-400" />
                </div>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] sm:text-sm appearance-none shadow-sm text-gray-700"
                >
                  <option value="ALL">All Stores</option>
                  {storeStats.map((store, idx) => (
                    <option key={idx} value={store.branch}>
                      {store.branch} ({store.count} pending)
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-[#dadce0] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f8f9fa] border-b border-[#dadce0]">
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider">Branch</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider">Bill No.</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider">Bill Date</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider text-right">Qty</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider text-right">Age (Days)</th>
                      <th className="py-3 px-4 text-xs font-semibold text-[#5f6368] uppercase tracking-wider text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f1f3f4]">
                    {filteredData.length > 0 ? (
                      filteredData.map((inv, idx) => (
                        <tr key={idx} className="hover:bg-[#f8f9fa] transition-colors">
                          <td className="py-3 px-4 text-sm font-medium text-[#202124]">{inv.branch}</td>
                          <td className="py-3 px-4 text-sm text-[#5f6368] font-mono">{inv.billNo}</td>
                          <td className="py-3 px-4 text-sm text-[#5f6368]">{inv.billDate}</td>
                          <td className="py-3 px-4 text-sm text-[#202124] font-medium text-right">{inv.totalQty}</td>
                          <td className="py-3 px-4 text-sm font-bold text-right">
                            <span className={inv.daysOld > 8 ? "text-[#d93025]" : "text-[#137333]"}>
                              {inv.daysOld}
                            </span>
                          </td>
                          <td className="py-3 px-4 flex justify-center">
                            {inv.daysOld <= 8 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-[#e6f4ea] text-[#137333]">
                                <CheckCircle size={14} /> Safe Zone
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                inv.daysOld > 30 ? 'bg-[#fce8e6] text-[#c5221f] border border-[#f4c7c3]' : 'bg-[#fef7e0] text-[#b06000]'
                              }`}>
                                <AlertTriangle size={14} /> 
                                {inv.daysOld > 30 ? 'Critical Alert' : 'Red Alert'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-[#5f6368] text-sm">
                          No pending inwardings found matching your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
