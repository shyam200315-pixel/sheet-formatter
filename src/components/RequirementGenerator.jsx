import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Download, AlertCircle, FileText, Table2, UploadCloud } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SimpleFileDropZone from "./SimpleFileDropZone";
import * as XLSX from "xlsx";
import { normalizeStoreName } from "../helpers";

export default function RequirementGenerator() {
  const [inputText, setInputText] = useState("");
  const [masterDict, setMasterDict] = useState({});
  const [mrpDict, setMrpDict] = useState({});
  const [sapMapping, setSapMapping] = useState({});
  const [parsedData, setParsedData] = useState([]);
  const [error, setError] = useState("");
  const [storeCode, setStoreCode] = useState("");
  const [storeName, setStoreName] = useState("");

  // Load master.json, mrp_data.json, and sap_mapping.json on mount
  useEffect(() => {
    Promise.all([
      fetch("/master.json").then((res) => res.json()).catch(() => ({})),
      fetch("/mrp_data.json").then((res) => res.json()).catch(() => ({})),
      fetch("/sap_mapping.json").then((res) => res.json()).catch(() => ({}))
    ]).then(([masterData, mrpData, sapData]) => {
      setMasterDict(masterData || {});
      setMrpDict(mrpData || {});
      setSapMapping(sapData || {});
    });
  }, []);

  const handleStoreCodeChange = (val) => {
    setStoreCode(val);
    if (!storeName && val && val.trim().length >= 6) {
      const canonical = normalizeStoreName(val.trim());
      const parts = canonical.split(" - ");
      if (parts.length > 1) {
        setStoreName(parts[parts.length - 1]);
      }
    }
  };

  const resolveItem = (rawCode) => {
    if (!rawCode) return { code: rawCode, name: "UNKNOWN ITEM", category: "UNKNOWN CATEGORY" };
    const clean = rawCode.toString().trim().toUpperCase();

    // 1. Direct match in mrpDict (mrpDict has official rich product descriptions & categories)
    if (mrpDict[clean] && mrpDict[clean].name && !mrpDict[clean].name.startsWith("Item from PDF:")) {
      const item = mrpDict[clean];
      return {
        code: clean,
        name: item.name,
        category: item.category || item.sub_category || masterDict[clean]?.group || "GENERAL"
      };
    }

    // 2. Direct match in masterDict
    if (masterDict[clean] && masterDict[clean].name && !masterDict[clean].name.startsWith("Item from PDF:")) {
      const item = masterDict[clean];
      const cat = (item.group && item.group !== "UNKNOWN CATEGORY" && item.group !== "From Catalogue")
        ? item.group
        : (item.category && item.category !== "From Catalogue" ? item.category : (mrpDict[clean]?.category || "GENERAL"));
      return {
        code: clean,
        name: item.name,
        category: cat
      };
    }

    // 3. Exact match in sap_mapping (e.g. 5-digit SAP code -> 8-digit HANA code)
    if (sapMapping[clean]) {
      const hanaCode = sapMapping[clean];
      const target = mrpDict[hanaCode] || masterDict[hanaCode];
      if (target && target.name && !target.name.startsWith("Item from PDF:")) {
        return {
          code: hanaCode,
          name: target.name,
          category: target.category || target.group || mrpDict[hanaCode]?.category || "GENERAL"
        };
      }
    }

    // 4. Reverse lookup in mrpDict by sap_code (e.g. item.sap_code === clean)
    for (const [hCode, item] of Object.entries(mrpDict)) {
      if (item.sap_code && item.sap_code.trim().toUpperCase() === clean) {
        return {
          code: hCode,
          name: item.name,
          category: item.category || item.sub_category || "GENERAL"
        };
      }
    }

    // 5. Reverse lookup in mrpDict by ean_code (13-digit barcode)
    for (const [hCode, item] of Object.entries(mrpDict)) {
      if (item.ean_code && item.ean_code.trim() === clean) {
        return {
          code: hCode,
          name: item.name,
          category: item.category || item.sub_category || "GENERAL"
        };
      }
    }

    // 6. Suffix / partial match like in MRPChecker
    for (const [hCode, item] of Object.entries(mrpDict)) {
      if (hCode.endsWith(clean) || (item.sap_code && item.sap_code.endsWith(clean))) {
        return {
          code: hCode,
          name: item.name,
          category: item.category || item.sub_category || "GENERAL"
        };
      }
    }

    // 7. Fallback if any record exists
    const fallback = mrpDict[clean] || masterDict[clean];
    if (fallback) {
      return {
        code: clean,
        name: fallback.name || "UNKNOWN ITEM",
        category: fallback.category || fallback.group || "UNKNOWN CATEGORY"
      };
    }

    return {
      code: clean,
      name: "UNKNOWN ITEM",
      category: "UNKNOWN CATEGORY"
    };
  };

  const handleFileUpload = (file) => {
    setError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        let extractedText = "";
        
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(worksheet);
          extractedText += csv + "\n";
        });
        
        // Clean up commas and multiple spaces
        const cleanText = extractedText.replace(/,/g, " ").replace(/\n+/g, "\n");
        setInputText(cleanText);
      } catch (err) {
        setError("Failed to parse the uploaded Excel file.");
      }
    };
    reader.onerror = () => setError("Error reading file.");
    reader.readAsArrayBuffer(file);
  };

  const handleParse = () => {
    setError("");
    if (!inputText.trim()) {
      setError("Please paste some text to parse.");
      return;
    }

    const lines = inputText.split(/\r?\n/);
    const results = [];
    let detectedStore = storeCode;
    let detectedName = storeName;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip header lines
      if (/^\s*(store\s*code|item\s*code|item\s*description|category|req\s*qty|date|state)\b/i.test(line)) {
        continue;
      }

      // Auto-detect store code if not already set (e.g., WMH006, WMP003)
      if (!detectedStore) {
        const storeMatch = /\b(W[Mm][HhPp]\d{3})\b/i.exec(line);
        if (storeMatch) {
          detectedStore = storeMatch[1].toUpperCase();
          setStoreCode(detectedStore);
          if (!detectedName) {
            const canonical = normalizeStoreName(detectedStore);
            const parts = canonical.split(" - ");
            if (parts.length > 1) {
              detectedName = parts[parts.length - 1];
              setStoreName(detectedName);
            }
          }
        }
      }

      const codeMatch = /\b(\d{5,8}|890\d{10})\b/.exec(line);
      
      if (codeMatch) {
        const rawCode = codeMatch[1];
        let qty = "1"; // Default quantity
        
        // 1. Check for explicit 'Qty X' on the same line
        const qtyMatch = /(?:qty|quantity)\s*[:=]?\s*(\d+)/i.exec(line);
        if (qtyMatch) {
          qty = qtyMatch[1];
        } 
        // 2. Check for explicit 'Qty X' on the next line (if next line doesn't have its own item code)
        else if (i + 1 < lines.length && /(?:qty|quantity)\s*[:=]?\s*(\d+)/i.test(lines[i + 1]) && !/\b(\d{5,8}|890\d{10})\b/.test(lines[i + 1])) {
          qty = /(?:qty|quantity)\s*[:=]?\s*(\d+)/i.exec(lines[i + 1])[1];
        } 
        // 3. Fallback: Find the last realistic number (1-4 digits) AFTER the item code on the same line
        else {
          const textAfterCode = line.substring(codeMatch.index + rawCode.length);
          const numbers = [];
          const numRegex = /\b\d{1,4}\b/g;
          let numMatch;
          
          while ((numMatch = numRegex.exec(textAfterCode)) !== null) {
            numbers.push(numMatch[0]);
          }
          
          if (numbers.length > 0) {
            qty = numbers[numbers.length - 1]; // Take the last number
          }
        }
        
        const itemInfo = resolveItem(rawCode);
        results.push({
          code: itemInfo.code || rawCode,
          name: itemInfo.name,
          category: itemInfo.category,
          qty: qty
        });
      }
    }

    if (results.length === 0) {
      setError("No valid item codes found in the text.");
      return;
    }

    setParsedData(results);
  };

  const getAutoState = (code) => {
    if (!code) return '';
    const canonical = normalizeStoreName(code);
    if (canonical.startsWith('WMH')) return 'MH';
    if (canonical.startsWith('WMP')) return 'MP';
    const lowerCode = code.toLowerCase();
    if (lowerCode.includes('wmh') || lowerCode.includes('mh')) return 'MH';
    if (lowerCode.includes('wmp') || lowerCode.includes('mp')) return 'MP';
    return '';
  };

  const handleDownload = async () => {
    if (parsedData.length === 0) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Order_Requirement");

      const headers = ["Date", "State", "STORE CODE", "Store Name", "ITEM CODE", "ITEM DESCRIPTION", "Category", "Req Qty"];
      
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1A73E8" },
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 30;
      
      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      parsedData.forEach((item) => {
        const currentDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        const currentState = getAutoState(storeCode);
        const rowData = [currentDate, currentState, storeCode, storeName, item.code, item.name, item.category, item.qty];
        const dataRow = worksheet.addRow(rowData);
        dataRow.alignment = { vertical: "middle", horizontal: "center" };
        dataRow.height = 20;
        
        dataRow.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      worksheet.columns.forEach((column, i) => {
        let maxLength = headers[i].length;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(maxLength + 4, 40);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const dateStr = new Date().toISOString().split('T')[0];
      const fileNamePrefix = storeName ? `${storeName.toUpperCase()} STOCK DATED ` : 'Generated_Order_Requirement_';
      saveAs(blob, `${fileNamePrefix}${dateStr}.xlsx`);
      toast.success("Excel file generated successfully!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Excel file.");
      setError("Failed to generate Excel file.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="google-card p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileText className="text-[#1a73e8]" />
          Input Requirement Data
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-[#5f6368] dark:text-gray-300 mb-2">
              Store Code
            </label>
            <input
              type="text"
              value={storeCode}
              onChange={(e) => handleStoreCodeChange(e.target.value)}
              placeholder="e.g., WMH001"
              className="w-full p-3 border border-[#dadce0] rounded-md focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] outline-none bg-white/60 dark:bg-slate-800/60"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5f6368] dark:text-gray-300 mb-2">
              Store Name
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Enter Store Name"
              className="w-full p-3 border border-[#dadce0] rounded-md focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] outline-none bg-white/60 dark:bg-slate-800/60"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-sm font-medium text-[#5f6368] dark:text-gray-300 mb-2 flex items-center gap-2">
              <UploadCloud size={16} />
              Option 1: Upload Excel File
            </label>
            <SimpleFileDropZone
              onFileSelect={handleFileUpload}
              label="Drop requirement Excel sheet here"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5f6368] dark:text-gray-300 mb-2 flex items-center gap-2">
              <FileText size={16} />
              Option 2: Paste Raw Text
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your text here (e.g., 19001345 sleek gas stove 3 burner=QTY 3) or upload an Excel file..."
              className="w-full h-[120px] p-4 border border-[#dadce0] rounded-md focus:border-[#1a73e8] focus:ring-1 focus:ring-[#1a73e8] outline-none resize-y font-mono text-sm"
            />
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 p-4 bg-[#fce8e6] text-[#c5221f] rounded-md flex items-center gap-2"
            >
              <AlertCircle size={20} />
              <p>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleParse}
            className="btn-primary px-8 py-3 text-base flex items-center gap-2"
          >
            Parse Text
          </button>
        </div>
      </div>

      {parsedData.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="google-card overflow-hidden"
        >
          <div className="p-6 border-b border-[#dadce0] flex justify-between items-center bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Table2 className="text-[#1a73e8]" />
              Parsed Data Preview
            </h2>
            <button
              onClick={handleDownload}
              className="btn-primary px-8 py-2.5 flex items-center gap-2 shadow-md"
            >
              <Download size={20} />
              Download Excel
            </button>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="google-table">
              <thead className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] sticky top-0 shadow-sm z-10">
                <tr>
                  <th>ITEM CODE</th>
                  <th>ITEM DESCRIPTION</th>
                  <th>Category</th>
                  <th>Req Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dadce0]">
                {parsedData.map((row, i) => (
                  <tr key={i} className="hover:bg-white/60 dark:bg-slate-800/60 backdrop-blur-[28px] backdrop-saturate-[120%] border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.04)] transition-colors">
                    <td>{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.category}</td>
                    <td>{row.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
