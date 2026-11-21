import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Lock, 
  Unlock, 
  Printer, 
  Download, 
  Plus, 
  Trash2, 
  RotateCcw, 
  ArrowLeft, 
  FileText, 
  Building2, 
  User, 
  ShoppingBag, 
  CreditCard,
  CheckCircle2,
  HelpCircle,
  Eye
} from "lucide-react";
import toast from "react-hot-toast";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Helper: Convert number to uppercase Indian words
function numberToWords(num) {
  if (num === null || num === undefined || isNaN(num)) return "";
  const n = Math.round(Number(num));
  if (n === 0) return "ZERO ONLY";
  const a = [
    "", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
    "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN",
    "SEVENTEEN", "EIGHTEEN", "NINETEEN"
  ];
  const b = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

  function inWords(val) {
    if (val < 20) return a[val];
    if (val < 100) return b[Math.floor(val / 10)] + (val % 10 !== 0 ? " " + a[val % 10] : "");
    if (val < 1000) return a[Math.floor(val / 100)] + " HUNDRED" + (val % 100 !== 0 ? " " + inWords(val % 100) : "");
    if (val < 100000) return inWords(Math.floor(val / 1000)) + " THOUSAND" + (val % 1000 !== 0 ? " " + inWords(val % 1000) : "");
    if (val < 10000000) return inWords(Math.floor(val / 100000)) + " LAKH" + (val % 100000 !== 0 ? " " + inWords(val % 100000) : "");
    return inWords(Math.floor(val / 10000000)) + " CRORE" + (val % 10000000 !== 0 ? " " + inWords(val % 10000000) : "");
  }

  return (inWords(n).trim() + " only");
}

const DEFAULT_SAMPLE_STATE = {
  invoiceType: "TAX INVOICE", // or "PROFORMA INVOICE"
  companyName: "Stove Kraft Limited",
  storeCodeName: "Wmp003 - Ind - Mr 09 Road",
  storeAddress: "Shop No: 03 Gr FloorGold Mark Arcade, Plot No:4Scheme\nNo 53, Nr Barfani Dham,Indore- 452007",
  storeStateGst: "State:Madhya Pradesh GST:23AADCS9958B1ZA",
  storeTel: "",
  storeEmail: "wmp003@pigeonstores.com",
  storeCin: "",
  
  invoiceNo: "2627/314/RI-483",
  date: "21/11/2026",
  time: "09:05:47 PM",
  salesmanName: "DEEPENDER-003",
  cashierName: "Mmp003",
  
  customerName: "Vidhi ji",
  customerMobile: "8989504613",
  customerGst: "",
  
  tenderMode: "Credit Card/Wallet", // or Cash, UPI
  barcodeText: "375751",
  
  items: [
    {
      id: "item-1",
      name: "Pg - Ind Cooktop - Radiant Infra",
      hsn: "85166000",
      gstPercent: 18,
      qty: 1,
      rate: 5455,
      discount: 1636,
      amount: 3819
    },
    {
      id: "item-2",
      name: "Pigeon Edge Carbon Knife Set 7Pcs",
      hsn: "82119200",
      gstPercent: 18,
      qty: 1,
      rate: 1995,
      discount: 997,
      amount: 998
    }
  ]
};

export default function SecretBillGenerator({ onBack }) {
  // Authentication State with password 'bill'
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("secret_bill_session_unlocked") === "true";
  });
  const [passwordInput, setPasswordInput] = useState("");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Bill Form Data
  const [billData, setBillData] = useState(() => {
    const saved = localStorage.getItem("secret_bill_saved_data");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return DEFAULT_SAMPLE_STATE;
  });

  const billRef = useRef(null);

  // Auto-save form state locally
  useEffect(() => {
    localStorage.setItem("secret_bill_saved_data", JSON.stringify(billData));
  }, [billData]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput.trim().toLowerCase() === "bill") {
      setIsAuthenticated(true);
      sessionStorage.setItem("secret_bill_session_unlocked", "true");
      toast.success("Access Granted");
    } else {
      toast.error("Incorrect Password");
      setPasswordInput("");
    }
  };

  const handleLock = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("secret_bill_session_unlocked");
    toast.success("Locked");
  };

  const handleResetToSample = () => {
    if (window.confirm("Reset all fields to sample invoice?")) {
      setBillData(DEFAULT_SAMPLE_STATE);
      toast.success("Reset to sample invoice");
    }
  };

  // Item Management
  const handleItemChange = (index, field, value) => {
    setBillData(prev => {
      const newItems = [...prev.items];
      const current = { ...newItems[index], [field]: value };

      const qty = Number(current.qty) || 0;
      const rate = Number(current.rate) || 0;
      const gross = qty * rate;
      const discount = Number(current.discount) || 0;

      // Automatically recalculate amount if rate, qty or discount changes
      if (field === "rate" || field === "qty" || field === "discount") {
        current.amount = Math.max(0, gross - discount);
      } else if (field === "amount") {
        // If amount changed directly, adjust discount
        current.discount = Math.max(0, gross - Number(value || 0));
      }

      newItems[index] = current;
      return { ...prev, items: newItems };
    });
  };

  const handleAddItem = () => {
    setBillData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: `item-${Date.now()}`,
          name: "New Pigeon Item",
          hsn: "85166000",
          gstPercent: 18,
          qty: 1,
          rate: 1000,
          discount: 200,
          amount: 800
        }
      ]
    }));
  };

  const handleRemoveItem = (index) => {
    if (billData.items.length <= 1) {
      toast.error("At least one item is required");
      return;
    }
    setBillData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  // Calculations
  const calculated = useMemo(() => {
    let totalQty = 0;
    let totalGross = 0;
    let totalDiscount = 0;
    let totalNet = 0;

    billData.items.forEach(item => {
      const q = Number(item.qty) || 0;
      const r = Number(item.rate) || 0;
      const d = Number(item.discount) || 0;
      const amt = Number(item.amount) || Math.max(0, (q * r) - d);

      totalQty += q;
      totalGross += (q * r);
      totalDiscount += d;
      totalNet += amt;
    });

    // Tax classification breakdown (group by GST %)
    const taxGroups = {};
    billData.items.forEach(item => {
      const rateKey = Number(item.gstPercent) || 18;
      const amt = Number(item.amount) || 0;
      if (!taxGroups[rateKey]) {
        taxGroups[rateKey] = { gstRate: rateKey, totalAmount: 0 };
      }
      taxGroups[rateKey].totalAmount += amt;
    });

    const taxRows = Object.values(taxGroups).map(g => {
      const rate = g.gstRate;
      const invoiceAmt = g.totalAmount;
      // Reverse calculate Taxable Value: Taxable = Gross / (1 + GST)
      const taxableValue = invoiceAmt / (1 + (rate / 100));
      const totalTax = invoiceAmt - taxableValue;
      const cgst = totalTax / 2;
      const sgst = totalTax / 2;

      return {
        gstRate: `${rate}%`,
        taxableValue: taxableValue.toFixed(2),
        cgst: cgst.toFixed(2),
        sgst: sgst.toFixed(2),
        igst: "0.00",
        totalInvoiceAmount: invoiceAmt.toFixed(2)
      };
    });

    const totalTaxable = taxRows.reduce((sum, r) => sum + Number(r.taxableValue), 0);
    const totalCgst = taxRows.reduce((sum, r) => sum + Number(r.cgst), 0);
    const totalSgst = taxRows.reduce((sum, r) => sum + Number(r.sgst), 0);

    return {
      totalQty,
      totalGross,
      totalDiscount,
      totalNet,
      taxRows,
      taxTotals: {
        taxableValue: totalTaxable.toFixed(2),
        cgst: totalCgst.toFixed(2),
        sgst: totalSgst.toFixed(2),
        igst: "0.00",
        totalInvoiceAmount: totalNet.toFixed(2)
      },
      amountInWords: numberToWords(totalNet)
    };
  }, [billData.items]);

  // PDF Export
  const handleDownloadPdf = async () => {
    const element = billRef.current;
    if (!element) return;

    setIsGeneratingPdf(true);
    const toastId = toast.loading("Generating High-Resolution PDF...");

    try {
      const canvas = await html2canvas(element, {
        scale: 2.8,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 794 // 210mm at 96dpi approx
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      // Render centered with clean 125mm thermal width on A4
      const printWidth = 125;
      const printHeight = (canvas.height * printWidth) / canvas.width;
      const xPos = (pageWidth - printWidth) / 2;
      const yPos = 8;

      pdf.addImage(imgData, "PNG", xPos, yPos, printWidth, printHeight);

      const cleanInvoiceNo = (billData.invoiceNo || "Invoice").replace(/[\/\\?%*:|"<>]/g, "_");
      pdf.save(`${cleanInvoiceNo}.pdf`);

      toast.success("PDF Downloaded successfully!", { id: toastId });
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("Failed to generate PDF", { id: toastId });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Direct Browser Print
  const handlePrint = () => {
    window.print();
  };

  // ----------------------------------------------------
  // Password Lock Screen (Password: 'bill')
  // ----------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-gray-200 dark:border-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-5 text-slate-700 dark:text-slate-300 shadow-inner">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            SECRET
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
            Enter authorized password to access this feature
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Enter password..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 text-center text-sm font-medium tracking-widest rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
            />
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl text-sm font-semibold transition-all shadow-md cursor-pointer"
            >
              Unlock Access
            </button>
          </form>

          {onBack && (
            <button
              onClick={onBack}
              className="mt-4 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
            >
              ← Back to Dashboard
            </button>
          )}
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // Main Studio UI: Left controls, Right live preview
  // ----------------------------------------------------
  return (
    <div className="w-full pb-20 animate-in fade-in duration-300">
      {/* Print-specific style */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-bill, #printable-bill * {
            visibility: visible !important;
          }
          #printable-bill {
            position: absolute !important;
            left: 50% !important;
            top: 0 !important;
            transform: translateX(-50%) !important;
            width: 125mm !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300 transition-all cursor-pointer"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                SECRET
              </h1>
              <span className="px-2 py-0.5 text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 rounded-md">
                Bill Studio
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleResetToSample}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-sm"
            title="Reset to Sample"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-sm"
          >
            <Printer size={15} />
            <span>Print</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50"
          >
            <Download size={15} />
            <span>{isGeneratingPdf ? "Generating..." : "Download PDF"}</span>
          </button>

          <button
            onClick={handleLock}
            className="flex items-center gap-1 px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer"
            title="Lock"
          >
            <Lock size={14} />
            <span>Lock</span>
          </button>
        </div>
      </div>

      {/* Main Split Layout: Editor (Left) & Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ======================================================== */}
        {/* LEFT COLUMN: EDIT CONTROLS */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Card 1: Bill Meta & Store */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={14} className="text-blue-500" />
                Invoice Details
              </span>
              <select
                value={billData.invoiceType}
                onChange={(e) => setBillData(prev => ({ ...prev, invoiceType: e.target.value }))}
                className="text-xs font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-900 focus:outline-none"
              >
                <option value="TAX INVOICE">TAX INVOICE</option>
                <option value="PROFORMA INVOICE">PROFORMA INVOICE</option>
                <option value="RETAIL ESTIMATE">RETAIL ESTIMATE</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-gray-500 mb-1 font-medium">Invoice No.</label>
                <input
                  type="text"
                  value={billData.invoiceNo}
                  onChange={(e) => setBillData(prev => ({ ...prev, invoiceNo: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white font-medium"
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1 font-medium">Date</label>
                <input
                  type="text"
                  value={billData.date}
                  onChange={(e) => setBillData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white font-medium"
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1 font-medium">Time</label>
                <input
                  type="text"
                  value={billData.time}
                  onChange={(e) => setBillData(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1 font-medium">Salesman Name</label>
                <input
                  type="text"
                  value={billData.salesmanName}
                  onChange={(e) => setBillData(prev => ({ ...prev, salesmanName: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1 font-medium">Cashier Name</label>
                <input
                  type="text"
                  value={billData.cashierName}
                  onChange={(e) => setBillData(prev => ({ ...prev, cashierName: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1 font-medium">Tender Mode</label>
                <select
                  value={billData.tenderMode}
                  onChange={(e) => setBillData(prev => ({ ...prev, tenderMode: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white font-medium"
                >
                  <option value="Credit Card/Wallet">Credit Card/Wallet</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI / QR">UPI / QR</option>
                  <option value="Debit Card">Debit Card</option>
                </select>
              </div>
            </div>

            {/* Store details collapsible toggle */}
            <details className="text-xs pt-1 border-t border-gray-100 dark:border-slate-800">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-semibold py-1">
                ⚙ Store Information & Address
              </summary>
              <div className="space-y-2 pt-2">
                <div>
                  <label className="block text-gray-500 mb-1">Store Code & Name</label>
                  <input
                    type="text"
                    value={billData.storeCodeName}
                    onChange={(e) => setBillData(prev => ({ ...prev, storeCodeName: e.target.value }))}
                    className="w-full px-2 py-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-500 mb-1">Address</label>
                  <textarea
                    rows={2}
                    value={billData.storeAddress}
                    onChange={(e) => setBillData(prev => ({ ...prev, storeAddress: e.target.value }))}
                    className="w-full px-2 py-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-gray-900 dark:text-white font-sans text-xs"
                  />
                </div>
                <div>
                  <label className="block text-gray-500 mb-1">State & GST</label>
                  <input
                    type="text"
                    value={billData.storeStateGst}
                    onChange={(e) => setBillData(prev => ({ ...prev, storeStateGst: e.target.value }))}
                    className="w-full px-2 py-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-500 mb-1">Store Email</label>
                  <input
                    type="text"
                    value={billData.storeEmail}
                    onChange={(e) => setBillData(prev => ({ ...prev, storeEmail: e.target.value }))}
                    className="w-full px-2 py-1 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </details>
          </div>

          {/* Card 2: Customer Details */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200 dark:border-slate-800 shadow-sm space-y-3">
            <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-gray-100 dark:border-slate-800">
              <User size={14} className="text-emerald-500" />
              Customer Details
            </span>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-gray-500 mb-1 font-medium">Customer Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Vidhi ji"
                  value={billData.customerName}
                  onChange={(e) => setBillData(prev => ({ ...prev, customerName: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white font-medium"
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1 font-medium">Mobile Number *</label>
                <input
                  type="text"
                  placeholder="e.g. 8989504613"
                  value={billData.customerMobile}
                  onChange={(e) => setBillData(prev => ({ ...prev, customerMobile: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white font-medium"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-gray-500 mb-1 font-medium">GST No. (Optional)</label>
                <input
                  type="text"
                  placeholder="Customer GSTIN if any"
                  value={billData.customerGst}
                  onChange={(e) => setBillData(prev => ({ ...prev, customerGst: e.target.value }))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-gray-900 dark:text-white uppercase font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card 3: Items List */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-gray-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-slate-800">
              <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <ShoppingBag size={14} className="text-purple-500" />
                Items ({billData.items.length})
              </span>
              <button
                onClick={handleAddItem}
                className="flex items-center gap-1 px-2.5 py-1 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 rounded-lg text-xs font-bold transition-all cursor-pointer border border-purple-200 dark:border-purple-800"
              >
                <Plus size={13} />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {billData.items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-xl border border-gray-200 dark:border-slate-700/80 space-y-2 text-xs relative group"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-gray-700 dark:text-gray-300">
                      #{idx + 1}
                    </span>
                    <button
                      onClick={() => handleRemoveItem(idx)}
                      className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      title="Remove Item"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-500 mb-0.5">Product Name</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                      className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-gray-900 dark:text-white font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">HSN Code</label>
                      <input
                        type="text"
                        value={item.hsn}
                        onChange={(e) => handleItemChange(idx, "hsn", e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-gray-500 mb-0.5">GST %</label>
                      <input
                        type="number"
                        value={item.gstPercent}
                        onChange={(e) => handleItemChange(idx, "gstPercent", e.target.value)}
                        className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-gray-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => handleItemChange(idx, "qty", e.target.value)}
                        className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-gray-900 dark:text-white text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-0.5">Rate (MRP)</label>
                      <input
                        type="number"
                        value={item.rate}
                        onChange={(e) => handleItemChange(idx, "rate", e.target.value)}
                        className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded text-gray-900 dark:text-white text-right font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-rose-500 mb-0.5">Discount</label>
                      <input
                        type="number"
                        value={item.discount}
                        onChange={(e) => handleItemChange(idx, "discount", e.target.value)}
                        className="w-full px-1.5 py-1 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded text-rose-600 dark:text-rose-400 text-right font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-emerald-600 mb-0.5">Final Net</label>
                      <input
                        type="number"
                        value={item.amount}
                        onChange={(e) => handleItemChange(idx, "amount", e.target.value)}
                        className="w-full px-1.5 py-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded text-emerald-700 dark:text-emerald-300 text-right font-bold"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Summary Footer */}
            <div className="pt-2 border-t border-gray-100 dark:border-slate-800 flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
              <span>Total Net Invoice Amount:</span>
              <span className="text-base font-bold text-blue-600 dark:text-blue-400">
                ₹{calculated.totalNet.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: LIVE BILL PREVIEW (Exact Clone of 123456.pdf) */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="mb-2 text-xs font-medium text-gray-400 flex items-center gap-1.5">
            <Eye size={13} />
            <span>Live Invoice Preview (Exact 1:1 format of 123456.pdf)</span>
          </div>

          {/* Printable / Capturable Invoice Container */}
          <div className="w-full flex justify-center overflow-x-auto p-2">
            <div
              id="printable-bill"
              ref={billRef}
              className="bg-white text-black p-5 rounded-none shadow-2xl border border-gray-300 w-[125mm] max-w-full font-sans text-[11px] leading-tight select-text"
              style={{
                fontFamily: "Arial, Helvetica, sans-serif",
                color: "#000000",
                boxSizing: "border-box"
              }}
            >
              {/* Header Logo & Store info */}
              <div className="text-center mb-2">
                <div className="flex justify-center mb-1">
                  <img
                    src="/pigeon.png"
                    alt="Pigeon Logo"
                    className="h-8 object-contain"
                  />
                </div>
                <div className="font-bold text-xs uppercase tracking-tight">
                  {billData.companyName}
                </div>
                <div className="font-semibold text-[10.5px]">
                  {billData.storeCodeName}
                </div>
                <div className="text-[9.5px] leading-tight whitespace-pre-line text-gray-900 mt-0.5">
                  {billData.storeAddress}
                </div>
                <div className="text-[9.5px] font-medium mt-0.5">
                  {billData.storeStateGst}
                </div>
                {billData.storeTel && (
                  <div className="text-[9.5px]">Tel No: {billData.storeTel}</div>
                )}
                {billData.storeEmail && (
                  <div className="text-[9.5px]">Email id: {billData.storeEmail}</div>
                )}
                {billData.storeCin && (
                  <div className="text-[9.5px]">CIN No.: {billData.storeCin}</div>
                )}
              </div>

              {/* TAX INVOICE Header Box */}
              <div className="border border-black mb-1">
                <div className="border-b border-black text-center font-bold text-xs py-0.5 bg-gray-50 tracking-wider">
                  {billData.invoiceType}
                </div>
                <div className="grid grid-cols-2 text-[10px] p-1 gap-x-2 leading-relaxed">
                  <div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Invoice No.:</span>
                      <span>{billData.invoiceNo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Date :</span>
                      <span>{billData.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Time :</span>
                      <span>{billData.time}</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Salesman Name:</span>
                      <span className="uppercase">{billData.salesmanName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold">Cashier Name :</span>
                      <span>{billData.cashierName}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Details Box */}
              <div className="border border-black mb-1 text-[10px]">
                <div className="border-b border-black font-bold px-1 py-0.5 bg-gray-50">
                  Customer Details
                </div>
                <div className="p-1 flex justify-between">
                  <span className="font-bold">{billData.customerName || "Customer"}</span>
                  <span className="font-semibold">{billData.customerMobile || "N/A"}</span>
                </div>
                {billData.customerGst && (
                  <div className="px-1 pb-1 text-[9.5px] font-medium">
                    GST No. : {billData.customerGst}
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="border border-black mb-1">
                <table className="w-full text-[9.5px] border-collapse">
                  <thead>
                    <tr className="border-b border-black font-bold text-center bg-gray-50">
                      <th className="border-r border-black p-1 text-left w-[42%]">
                        Item HSN-GST Rate
                      </th>
                      <th className="border-r border-black p-1 w-[10%]">
                        Qty No.
                      </th>
                      <th className="border-r border-black p-1 w-[12%] text-right">
                        Rate
                      </th>
                      <th className="border-r border-black p-1 w-[12%] text-right">
                        Gross
                      </th>
                      <th className="border-r border-black p-1 w-[12%] text-right">
                        DISC
                      </th>
                      <th className="p-1 w-[12%] text-right">
                        Amount Incl GST
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {billData.items.map((item, idx) => {
                      const q = Number(item.qty) || 0;
                      const r = Number(item.rate) || 0;
                      const gross = q * r;
                      const d = Number(item.discount) || 0;
                      const net = Number(item.amount) || (gross - d);

                      return (
                        <tr key={item.id || idx} className="border-b border-gray-300 align-top">
                          <td className="border-r border-black p-1 leading-tight text-left">
                            <div className="font-medium">{item.name}</div>
                            <div className="text-[8.5px] text-gray-700">
                              {item.hsn}/{item.gstPercent}%
                            </div>
                          </td>
                          <td className="border-r border-black p-1 text-center font-medium">
                            {q}
                          </td>
                          <td className="border-r border-black p-1 text-right font-medium">
                            {r}
                          </td>
                          <td className="border-r border-black p-1 text-right font-medium">
                            {gross}
                          </td>
                          <td className="border-r border-black p-1 text-right font-medium">
                            {d > 0 ? `-${d}` : "0"}
                          </td>
                          <td className="p-1 text-right font-bold">
                            {net}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Total Row */}
                    <tr className="border-t border-black font-bold bg-gray-50">
                      <td className="border-r border-black p-1 text-left uppercase">
                        Total
                      </td>
                      <td className="border-r border-black p-1 text-center">
                        {calculated.totalQty}
                      </td>
                      <td className="border-r border-black p-1 text-right">
                        {/* Empty rate total */}
                      </td>
                      <td className="border-r border-black p-1 text-right">
                        {calculated.totalGross}
                      </td>
                      <td className="border-r border-black p-1 text-right">
                        {calculated.totalDiscount > 0 ? `-${calculated.totalDiscount}` : "0"}
                      </td>
                      <td className="p-1 text-right">
                        {calculated.totalNet}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tax Classification Table */}
              <div className="border border-black mb-1">
                <div className="border-b border-black text-center font-bold text-[10px] py-0.5 bg-gray-50">
                  Tax Classification
                </div>
                <table className="w-full text-[9px] border-collapse text-center">
                  <thead>
                    <tr className="border-b border-black font-semibold">
                      <th className="border-r border-black p-0.5">GST Rate</th>
                      <th className="border-r border-black p-0.5">Taxable Value</th>
                      <th className="border-r border-black p-0.5">CGST</th>
                      <th className="border-r border-black p-0.5">SGST</th>
                      <th className="border-r border-black p-0.5">IGST</th>
                      <th className="p-0.5">Total Invoice Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculated.taxRows.map((r, i) => (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="border-r border-black p-0.5">{r.gstRate}</td>
                        <td className="border-r border-black p-0.5">{r.taxableValue}</td>
                        <td className="border-r border-black p-0.5">{r.cgst}</td>
                        <td className="border-r border-black p-0.5">{r.sgst}</td>
                        <td className="border-r border-black p-0.5">{r.igst}</td>
                        <td className="p-0.5">{r.totalInvoiceAmount}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-black font-bold bg-gray-50">
                      <td className="border-r border-black p-0.5">Total</td>
                      <td className="border-r border-black p-0.5">{calculated.taxTotals.taxableValue}</td>
                      <td className="border-r border-black p-0.5">{calculated.taxTotals.cgst}</td>
                      <td className="border-r border-black p-0.5">{calculated.taxTotals.sgst}</td>
                      <td className="border-r border-black p-0.5">{calculated.taxTotals.igst}</td>
                      <td className="p-0.5">{calculated.taxTotals.totalInvoiceAmount}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Net Invoice Amt Banner */}
              <div className="border border-black p-1 flex justify-between items-center font-bold text-xs mb-1 bg-gray-50">
                <span>Net Invoice Amt :</span>
                <span>{calculated.totalNet}</span>
              </div>

              {/* Tender Mode */}
              <div className="border border-black mb-1 text-[9.5px]">
                <div className="border-b border-black text-center font-bold py-0.5 bg-gray-50">
                  Tender Mode
                </div>
                <div className="p-1 flex justify-between font-medium">
                  <span>{billData.tenderMode} Amount :</span>
                  <span>{calculated.totalNet.toFixed(2)}</span>
                </div>
              </div>

              {/* Bill Amount in words */}
              <div className="border border-black p-1 text-[9px] mb-2 leading-tight uppercase font-medium">
                Bill Amount in words : {calculated.amountInWords}
              </div>

              {/* Savings Announcement */}
              <div className="text-center font-bold text-[10.5px] my-2">
                You Have Saved Total Rs.{calculated.totalDiscount} On This Bill.
              </div>

              {/* Terms & Conditions */}
              <div className="border-t border-gray-300 pt-2 text-[8px] leading-normal text-gray-900">
                <div className="font-bold underline mb-0.5">
                  Terms & Conditions(Check Back)
                </div>
                <ol className="list-decimal pl-3 space-y-0.5">
                  <li>At the time of return the original invoice of the purchase should be produced.</li>
                  <li>Merchandise can be returned within 10 (ten) days from the date of purchase.</li>
                  <li>No cash refund will be given on return of products.</li>
                  <li>Replacement or repair of a defective product is completely subject to product policy</li>
                  <li>Supply to an unregistertered customer, IRN/E-INVOICE is not applicable under the CGST Rules</li>
                </ol>

                <div className="mt-2 text-[8px]">
                  <div>For any query, please get in touch with our Customer Care Team</div>
                  <div>Customer Care Number – +91 63649 14202</div>
                  <div>WhatsApp Number – +91 63649 14202</div>
                  <div>E-mail id – customercare@stovekraft.com</div>
                </div>

                {/* Simulated Barcode */}
                <div className="text-center my-2">
                  <div className="inline-flex flex-col items-center">
                    <div className="h-6 w-28 flex items-stretch justify-center gap-[1.5px] overflow-hidden bg-white">
                      {[1,3,1,2,4,1,2,3,1,2,1,4,2,1,3,2,1,4,1,3,2,1,2,3,1,4,2].map((w, i) => (
                        <div
                          key={i}
                          className="bg-black"
                          style={{ width: `${w}px` }}
                        />
                      ))}
                    </div>
                    <div className="text-[9px] font-mono tracking-widest mt-0.5">
                      {billData.barcodeText || "375751"}
                    </div>
                  </div>
                </div>

                <div className="text-center italic text-[8px] text-gray-600">
                  This is a computer generated invoice, required no signature.
                </div>

                <div className="text-center font-bold text-[9.5px] mt-2 space-y-0.5">
                  <div>Thank You For Visit</div>
                  <div>Visit Again !!</div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
