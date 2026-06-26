import React, { useState, useEffect } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { Download, AlertCircle, FileText, Table2, UploadCloud } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SimpleFileDropZone from "./SimpleFileDropZone";
import * as XLSX from "xlsx";

export default function RequirementGenerator() {
  const [inputText, setInputText] = useState("");
  const [masterDict, setMasterDict] = useState({});
  const [parsedData, setParsedData] = useState([]);
  const [error, setError] = useState("");

  // Load master.json on mount
  useEffect(() => {
    fetch("/master.json")
      .then((res) => res.json())
      .then((data) => setMasterDict(data))
      .catch((err) => console.error("Failed to load master dictionary:", err));
  }, []);

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
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const codeMatch = /\b(\d{5,8})\b/.exec(line);
      
      if (codeMatch) {
        const code = codeMatch[1];
        let qty = "1"; // Default quantity
        
        // 1. Check for explicit 'Qty X' on the same line
        const qtyMatch = /qty\s*=?\s*(\d+)/i.exec(line);
        if (qtyMatch) {
          qty = qtyMatch[1];
        } 
        // 2. Check for explicit 'Qty X' on the next line (if next line doesn't have its own item code)
        else if (i + 1 < lines.length && /qty\s*=?\s*(\d+)/i.test(lines[i + 1]) && !/\b\d{5,8}\b/.test(lines[i + 1])) {
          qty = /qty\s*=?\s*(\d+)/i.exec(lines[i + 1])[1];
        } 
        // 3. Fallback: Find the last realistic number (1-4 digits) AFTER the item code on the same line
        else {
          // By only looking AFTER the code, we completely ignore any serial numbers that appear before it
          const textAfterCode = line.substring(codeMatch.index + code.length);
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
        
        const masterInfo = masterDict[code] || { name: "UNKNOWN ITEM", group: "UNKNOWN CATEGORY" };
        results.push({
          code: code,
          name: masterInfo.name,
          category: masterInfo.group,
          qty: qty
        });
      }
    }

    if (results.length === 0) {
      setError("No valid item codes (5 to 8 digits) found in the text.");
      return;
    }

    setParsedData(results);
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
        const rowData = ["", "", "", "", item.code, item.name, item.category, item.qty];
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
      saveAs(blob, "Generated_Order_Requirement.xlsx");
    } catch (err) {
      console.error(err);
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div>
            <label className="block text-sm font-medium text-[#5f6368] mb-2 flex items-center gap-2">
              <UploadCloud size={16} />
              Option 1: Upload Excel File
            </label>
            <SimpleFileDropZone
              onFileSelect={handleFileUpload}
              label="Drop requirement Excel sheet here"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#5f6368] mb-2 flex items-center gap-2">
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
          <div className="p-6 border-b border-[#dadce0] flex justify-between items-center bg-[#f8f9fa]">
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
              <thead className="bg-[#f1f3f4] sticky top-0 shadow-sm z-10">
                <tr>
                  <th>ITEM CODE</th>
                  <th>ITEM DESCRIPTION</th>
                  <th>Category</th>
                  <th>Req Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#dadce0]">
                {parsedData.map((row, i) => (
                  <tr key={i} className="hover:bg-[#f1f3f4] transition-colors">
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
