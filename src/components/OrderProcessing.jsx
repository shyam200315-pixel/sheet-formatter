import React, { useState } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Download, AlertCircle, FileSpreadsheet, RefreshCcw, Table2 } from "lucide-react";
import SimpleFileDropZone from "./SimpleFileDropZone";
import { motion, AnimatePresence } from "framer-motion";

export default function OrderProcessing() {
  const [orderReqFile, setOrderReqFile] = useState(null);
  const [closingStocksFile, setClosingStocksFile] = useState(null);
  const [error, setError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewHeaders, setPreviewHeaders] = useState([]);
  const [filter, setFilter] = useState("all");

  const filteredData = previewData
    ? previewData.filter((row) => filter === "all" || row["Billing Status"] === filter)
    : [];

  const findHeaderIndex = (worksheet, requiredHeadersArrays) => {
    const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
    for (let r = range.s.r; r <= range.e.r; r++) {
      let foundCount = 0;
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v) {
          const val = String(cell.v).trim().toUpperCase();
          // Check if this cell matches any of the required headers (some might be an array of aliases)
          for (const req of requiredHeadersArrays) {
            if (Array.isArray(req)) {
              if (req.includes(val)) {
                foundCount++;
                break;
              }
            } else {
              if (req === val) {
                foundCount++;
                break;
              }
            }
          }
        }
      }
      if (foundCount >= requiredHeadersArrays.length) {
        return r;
      }
    }
    return 0;
  };

  const processSheets = async () => {
    if (!orderReqFile || !closingStocksFile) {
      setError("Please upload both sheets to proceed.");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const readExcelFile = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target.result);
              const workbook = XLSX.read(data, { type: "array" });
              resolve(workbook);
            } catch (err) {
              reject(err);
            }
          };
          reader.onerror = () => reject(new Error("File reading failed"));
          reader.readAsArrayBuffer(file);
        });
      };

      const [orderWb, stockWb] = await Promise.all([
        readExcelFile(orderReqFile),
        readExcelFile(closingStocksFile),
      ]);

      const orderSheetName = orderWb.SheetNames[0];
      const stockSheetName = stockWb.SheetNames[0];

      const orderSheet = orderWb.Sheets[orderSheetName];
      const stockSheet = stockWb.Sheets[stockSheetName];

      const orderHeaderRow = findHeaderIndex(orderSheet, [["ITEM CODE", "BARCODE"]]);
      const stockHeaderRow = findHeaderIndex(stockSheet, [["ITEM CODE", "BARCODE"], ["QUANTITY REQ", "CLOSING STOCK", "REQ QTY"]]);

      const orderData = XLSX.utils.sheet_to_json(orderSheet, { defval: "", range: orderHeaderRow });
      const stockData = XLSX.utils.sheet_to_json(stockSheet, { defval: "", range: stockHeaderRow });

      if (orderData.length === 0) throw new Error("Order Requirement sheet is empty.");
      if (stockData.length === 0) throw new Error("Closing Stocks sheet is empty.");

      const getValIgnoreCase = (row, keysToFind) => {
        if (!Array.isArray(keysToFind)) keysToFind = [keysToFind];
        const upperKeys = keysToFind.map(k => k.toUpperCase());
        for (const key in row) {
          if (upperKeys.includes(key.trim().toUpperCase())) {
            return row[key];
          }
        }
        return undefined;
      };

      // Build mapping from Closing Stocks (case-insensitive for item code keys)
      const stockMap = new Map();
      for (const row of stockData) {
        const itemCodeRaw = getValIgnoreCase(row, ["ITEM CODE", "BARCODE"]);
        const qtyRaw = getValIgnoreCase(row, ["QUANTITY REQ", "CLOSING STOCK", "REQ QTY"]);
        if (itemCodeRaw) {
          const itemCode = String(itemCodeRaw).trim().toUpperCase();
          // parse qty to number, default 0
          const qty = Number(qtyRaw) || 0;
          stockMap.set(itemCode, qty);
        }
      }

      // Process Order Requirement
      const processedOrderData = orderData.map((row) => {
        const itemCodeRaw = getValIgnoreCase(row, ["ITEM CODE", "BARCODE"]);
        let status = "processed"; // default if not found or <= 2

        if (itemCodeRaw) {
          const itemCode = String(itemCodeRaw).trim().toUpperCase();
          const stockQty = stockMap.get(itemCode);
          if (stockQty !== undefined && stockQty > 2) {
            status = "not processed";
          }
        }

        return {
          ...row,
          "Billing Status": status,
        };
      });

      if (processedOrderData.length > 0) {
        setPreviewHeaders(Object.keys(processedOrderData[0]));
        setPreviewData(processedOrderData);
      } else {
        setError("No data found after processing.");
      }

    } catch (err) {
      console.error(err);
      setError(err.message || "An error occurred while processing the sheets.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!filteredData || filteredData.length === 0) return;

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Order_Requirement");

      // Add headers
      const headerRow = worksheet.addRow(previewHeaders);
      headerRow.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } }; // White text
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1A73E8" }, // Google Blue
      };
      headerRow.alignment = { vertical: "middle", horizontal: "center" };
      headerRow.height = 30; // Row height
      
      // Add borders to header
      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Add data
      filteredData.forEach((row) => {
        const rowData = previewHeaders.map((header) => row[header] ?? "");
        const dataRow = worksheet.addRow(rowData);
        dataRow.alignment = { vertical: "middle", horizontal: "center" };
        dataRow.height = 20;
        
        // Add borders to data row
        dataRow.eachCell((cell) => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      // Auto-fit columns
      worksheet.columns.forEach((column) => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, (cell) => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(maxLength + 4, 40); // Add padding, cap at 40
      });

      // Save
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `Processed_Order_Requirement_${filter.replace(" ", "_")}.xlsx`);
    } catch (err) {
      console.error(err);
      setError("Failed to generate Excel file.");
    }
  };

  const handleReset = () => {
    setOrderReqFile(null);
    setClosingStocksFile(null);
    setPreviewData(null);
    setPreviewHeaders([]);
    setError("");
  };

  return (
    <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
      <div className="text-center mb-10 mt-6">
        <h1 className="text-3xl font-normal text-[#202124] mb-3">Order Processing</h1>
        <p className="text-[#5f6368] max-w-xl mx-auto">
          Upload your Order Requirement and Closing Stocks sheets. The system will match items by code and update the billing status based on stock availability.
        </p>
      </div>

      {error && (
        <div className="w-full max-w-4xl mb-6 p-4 rounded-lg bg-[#fce8e6] text-[#c5221f] flex items-center gap-3">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {!previewData ? (
        <div className="w-full max-w-4xl flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64">
              <SimpleFileDropZone
                title="Order Requirement Sheet"
                description="Upload the main order requirement excel file"
                file={orderReqFile}
                onFileSelect={setOrderReqFile}
                validationSuccess={!!orderReqFile}
              />
            </div>
            <div className="h-64">
              <SimpleFileDropZone
                title="Closing Stocks Sheet"
                description="Upload the closing stocks excel file"
                file={closingStocksFile}
                onFileSelect={setClosingStocksFile}
                validationSuccess={!!closingStocksFile}
              />
            </div>
          </div>

          <div className="flex justify-center mt-4">
            <button
              onClick={processSheets}
              disabled={!orderReqFile || !closingStocksFile || isProcessing}
              className={`btn-primary px-8 py-3 text-base flex items-center gap-2
                ${(!orderReqFile || !closingStocksFile || isProcessing) ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </span>
              ) : (
                <>
                  <FileSpreadsheet size={20} />
                  Process Sheets
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-6xl flex flex-col gap-6">
          <div className="bg-white border border-[#dadce0] rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-[#dadce0] flex items-center justify-between bg-[#f8f9fa] flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Table2 className="text-[#1a73e8]" size={24} />
                <h2 className="text-lg font-medium text-[#202124]">Data Preview</h2>
              </div>
              <div className="flex bg-white rounded-lg border border-[#dadce0] p-1">
                <button
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1 text-sm font-medium rounded-md ${filter === "all" ? "bg-[#e8f0fe] text-[#1a73e8]" : "text-[#5f6368] hover:bg-[#f1f3f4]"}`}
                >
                  All ({previewData.length})
                </button>
                <button
                  onClick={() => setFilter("processed")}
                  className={`px-3 py-1 text-sm font-medium rounded-md ${filter === "processed" ? "bg-[#e6f4ea] text-[#137333]" : "text-[#5f6368] hover:bg-[#f1f3f4]"}`}
                >
                  Processed ({previewData.filter(r => r["Billing Status"] === "processed").length})
                </button>
                <button
                  onClick={() => setFilter("not processed")}
                  className={`px-3 py-1 text-sm font-medium rounded-md ${filter === "not processed" ? "bg-[#fce8e6] text-[#c5221f]" : "text-[#5f6368] hover:bg-[#f1f3f4]"}`}
                >
                  Not Processed ({previewData.filter(r => r["Billing Status"] === "not processed").length})
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-sm text-left whitespace-nowrap">
                <thead className="text-xs text-[#5f6368] uppercase bg-[#f8f9fa] sticky top-0 z-10 shadow-sm">
                  <tr>
                    {previewHeaders.map((h, i) => (
                      <th key={i} className="px-6 py-4 font-medium border-b border-[#dadce0]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dadce0]">
                  {filteredData
                    .slice(0, 50)
                    .map((row, i) => (
                    <tr key={i} className="hover:bg-[#f1f3f4] transition-colors">
                      {previewHeaders.map((h, j) => (
                        <td key={j} className="px-6 py-3 text-[#202124]">
                          {h === "Billing Status" ? (
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              row[h] === "processed" 
                                ? "bg-[#e6f4ea] text-[#137333]" 
                                : "bg-[#fce8e6] text-[#c5221f]"
                            }`}>
                              {row[h]}
                            </span>
                          ) : (
                            String(row[h] || "")
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredData.length > 50 && (
              <div className="px-6 py-3 text-center text-sm text-[#5f6368] border-t border-[#dadce0] bg-[#f8f9fa]">
                Showing first 50 rows. Download to see all data.
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 mt-2">
            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-lg border border-[#dadce0] text-[#5f6368] font-medium hover:bg-[#f8f9fa] transition-colors flex items-center gap-2"
            >
              <RefreshCcw size={18} />
              Start Over
            </button>
            <button
              onClick={handleDownload}
              className="btn-primary px-8 py-2.5 flex items-center gap-2 shadow-md"
            >
              <Download size={20} />
              Download Excel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
