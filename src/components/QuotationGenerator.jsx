import React, { useState, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { motion, AnimatePresence } from "framer-motion";
import { Printer, Pencil, X, Plus, Trash2 } from "lucide-react";
import mrpData from "../../public/mrp_data.json";

export default function QuotationGenerator() {
  const [formData, setFormData] = useState({
    clientName: "",
    clientAddress: "",
    subject: "",
    items: [
      { id: Date.now(), productCode: "", productName: "", basePrice: "", quantity: "", gstPercent: 18 }
    ],
  });

  const [config, setConfig] = useState({
    companyName: "STOVE KRAFT LIMITED",
    buildingNo: "NO.81/1, MEDAMARANAHALLI VILLAGE, HAROHALLI",
    roadStreet: "KANAKAPURA TALUK,",
    cityTown: "RAMANAGARA DIST",
    districtState: "District: Ramanagara, State: Karnataka, Pin code: - 562112",
    companyGst: "29AADCS9958B1ZY",
    beneficiary: "Stove Kraft Limited",
    bankName: "ICICI Bank Limited",
    branch: "Bangalore M G Road Branch",
    branchAddress: "Shobha Pearl, Commissariat Road, off MG Road, Ground Floor, Bangalore - 560 025",
    accountNo: "000251000253",
    ifscCode: "ICIC0000002",
  });

  const [showModal, setShowModal] = useState(false);

  const handleConfigChange = (e) => {
    setConfig({ ...config, [e.target.name]: e.target.value });
  };

  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Quotation_${formData.clientName || "Draft"}`,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleItemChange = (id, e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const newItems = prev.items.map(item => {
        if (item.id === id) {
          const updated = {
            ...item,
            [name]: name === "basePrice" || name === "quantity" || name === "gstPercent" 
              ? (value === "" ? "" : Number(value)) 
              : value,
          };
          if (name === "productCode" && mrpData[value]) {
            updated.productName = mrpData[value].name;
          }
          return updated;
        }
        return item;
      });
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { id: Date.now(), productCode: "", productName: "", basePrice: "", quantity: "", gstPercent: 18 }]
    }));
  };

  const removeItem = (id) => {
    if (formData.items.length === 1) return;
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const calculateItemTotals = (item) => {
    const basePriceNum = Number(item.basePrice) || 0;
    const quantityNum = Number(item.quantity) || 0;
    const gstPercentNum = Number(item.gstPercent) || 0;
    const amount = basePriceNum * quantityNum;
    const gstAmount = (amount * gstPercentNum) / 100;
    const total = amount + gstAmount;
    return { amount, gstAmount, total };
  };

  const grandTotals = formData.items.reduce((acc, item) => {
    const { amount, gstAmount, total } = calculateItemTotals(item);
    return {
      amount: acc.amount + amount,
      gstAmount: acc.gstAmount + gstAmount,
      total: acc.total + total
    };
  }, { amount: 0, gstAmount: 0, total: 0 });

  const formatDate = (date) => {
    const day = date.getDate();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    const getOrdinalNum = (n) => n + (n > 0 ? ["th", "st", "nd", "rd"][(n > 3 && n < 21) || n % 10 > 3 ? 0 : n % 10] : "");
    return `${getOrdinalNum(day)}- ${month} -${year}`;
  };

  const toTitleCase = (str) => {
    if (!str) return "";
    return str.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
    );
  };

  // Determine Subject Line dynamically if not provided
  let displaySubject = toTitleCase(formData.subject);
  if (!displaySubject) {
    if (formData.items.length === 1 && formData.items[0].productName) {
      displaySubject = `Performa Invoice For ${toTitleCase(formData.items[0].productName)} (${formData.items[0].quantity} Qty)`;
    } else if (formData.items.length > 1) {
      displaySubject = "Performa Invoice For Assorted Items";
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start mt-6 w-full pb-10">
      
      {/* LEFT SIDE: Form */}
      <div className="w-full lg:w-1/3 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-normal text-[#202124] mb-2">Quotation Details</h1>
          <p className="text-[#5f6368] text-sm">
            Fill in the details below. The preview on the right will update in real-time.
          </p>
        </div>

        <div className="bg-white border border-[#dadce0] rounded-xl shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#5f6368] mb-1 uppercase tracking-wider">Client Name</label>
            <input type="text" name="clientName" value={formData.clientName} onChange={handleChange} className="google-input w-full p-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5f6368] mb-1 uppercase tracking-wider">Client Address</label>
            <textarea name="clientAddress" value={formData.clientAddress} onChange={handleChange} rows={3} className="google-input w-full p-2 text-sm resize-y" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5f6368] mb-1 uppercase tracking-wider">Subject Line (Optional)</label>
            <input type="text" name="subject" value={formData.subject} onChange={handleChange} placeholder="Leave blank to auto-generate" className="google-input w-full p-2 text-sm" />
          </div>
          
          <div className="pt-2 border-t border-[#dadce0]">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Items</h2>
            <div className="space-y-4">
              {formData.items.map((item, index) => (
                <div key={item.id} className="relative bg-gray-50 border border-gray-200 p-3 rounded-lg">
                  {formData.items.length > 1 && (
                    <button onClick={() => removeItem(item.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  )}
                  <p className="text-xs font-medium text-gray-500 mb-2">Item {index + 1}</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-medium text-[#5f6368] mb-1 uppercase">Item Name</label>
                      <input type="text" name="productName" value={item.productName} onChange={(e) => handleItemChange(item.id, e)} className="google-input w-full p-2 text-xs" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-medium text-[#5f6368] mb-1 uppercase">Item Code</label>
                        <input type="text" name="productCode" value={item.productCode} onChange={(e) => handleItemChange(item.id, e)} className="google-input w-full p-2 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-[#5f6368] mb-1 uppercase">Quantity</label>
                        <input type="number" name="quantity" value={item.quantity} onChange={(e) => handleItemChange(item.id, e)} className="google-input w-full p-2 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-[#5f6368] mb-1 uppercase">Base Price (₹)</label>
                        <input type="number" name="basePrice" value={item.basePrice} onChange={(e) => handleItemChange(item.id, e)} className="google-input w-full p-2 text-xs" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-[#5f6368] mb-1 uppercase">GST (%)</label>
                        <input type="number" name="gstPercent" value={item.gstPercent} onChange={(e) => handleItemChange(item.id, e)} className="google-input w-full p-2 text-xs" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <button onClick={addItem} className="mt-3 flex items-center justify-center gap-1 w-full text-sm font-medium text-[#1a73e8] hover:text-[#1557b0] py-2 bg-blue-50/50 hover:bg-blue-50 rounded transition-colors">
              <Plus size={16} /> Add Another Item
            </button>
          </div>
          
          <div className="pt-4 border-t border-[#dadce0]">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handlePrint}
              className="w-full flex justify-center items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-2.5 rounded font-medium transition-colors shadow-sm cursor-pointer"
            >
              <Printer size={18} />
              Print / Save as PDF
            </motion.button>
            <p className="text-xs text-center text-[#5f6368] mt-2">
              Select "Save as PDF" in the print dialog for perfect margins.
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Live A4 Preview */}
      <div className="w-full lg:w-2/3 flex justify-center overflow-x-auto bg-[#f1f3f4] p-4 rounded-xl border border-[#dadce0]">
        
        {/* A4 Page Container */}
        <div 
          ref={printRef}
          className="bg-white shadow-md relative"
          style={{
            width: "210mm",
            minHeight: "297mm",
            padding: "12mm 15mm", // Reduced margins to fit 1 page
            fontFamily: "'Times New Roman', Times, serif",
            fontSize: "10.5pt",
            color: "#000000",
            lineHeight: "1.3",
            boxSizing: "border-box"
          }}
        >
          {/* Company Logo */}
          <div className="absolute top-[8mm] right-[15mm] flex justify-end">
            <img src="/logo.jpeg" alt="Company Logo" className="h-[50px] object-contain" />
          </div>

          <div style={{ marginTop: "12mm" }}>
            <p className="mb-4">Date: {formatDate(new Date())}</p>

            <p className="font-bold underline mb-0.5">To,</p>
            <p className="font-bold underline mb-0.5">{toTitleCase(formData.clientName)}</p>
            <p className="mb-4 w-[70%]">{toTitleCase(formData.clientAddress)}</p>

            {displaySubject && (
              <p className="font-bold underline mb-4">
                Subject: &nbsp; {displaySubject}
              </p>
            )}

            <p className="font-bold underline mb-2">Dear Sir/Madam</p>

            <p className="mb-2">
              Further to the receipt of your requirement, details of the products along with price is given below. &ndash;
            </p>

            {/* Exact Table Replication */}
            <table className="w-full border-collapse mb-5 border border-black text-center text-[10pt]">
              <thead>
                <tr>
                  <th className="border border-black p-1 bg-gray-100 font-bold w-[12%]">Item Code</th>
                  <th className="border border-black p-1 bg-gray-100 font-bold w-[28%]">Item Name</th>
                  <th className="border border-black p-1 bg-gray-100 font-bold">Basic Price (₹)</th>
                  <th className="border border-black p-1 bg-gray-100 font-bold">Quantity</th>
                  <th className="border border-black p-1 bg-gray-100 font-bold">Amount (₹)</th>
                  <th className="border border-black p-1 bg-gray-100 font-bold">GST (₹)</th>
                  <th className="border border-black p-1 bg-gray-100 font-bold">Total with GST (₹)</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, idx) => {
                  const { amount, gstAmount, total } = calculateItemTotals(item);
                  return (
                    <tr key={item.id}>
                      <td className="border border-black p-1 font-bold">{item.productCode}</td>
                      <td className="border border-black p-1 font-bold text-sm leading-tight">{item.productName.toUpperCase()}</td>
                      <td className="border border-black p-1">{item.basePrice !== "" ? Number(item.basePrice).toLocaleString("en-IN") : ""}</td>
                      <td className="border border-black p-1">{item.quantity !== "" ? item.quantity : ""}</td>
                      <td className="border border-black p-1">{amount > 0 ? amount.toLocaleString("en-IN") : ""}</td>
                      <td className="border border-black p-1">{gstAmount > 0 ? gstAmount.toLocaleString("en-IN") : ""}</td>
                      <td className="border border-black p-1">{total > 0 ? total.toLocaleString("en-IN") : ""}</td>
                    </tr>
                  )
                })}
                {/* Grand Total Row (Only show if multiple items) */}
                {formData.items.length > 1 && (
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={4} className="border border-black p-1 text-right pr-4">Grand Total:</td>
                    <td className="border border-black p-1">{grandTotals.amount > 0 ? grandTotals.amount.toLocaleString("en-IN") : ""}</td>
                    <td className="border border-black p-1">{grandTotals.gstAmount > 0 ? grandTotals.gstAmount.toLocaleString("en-IN") : ""}</td>
                    <td className="border border-black p-1">{grandTotals.total > 0 ? grandTotals.total.toLocaleString("en-IN") : ""}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <p className="mb-1 font-bold">Terms & Conditions: -</p>
            <ol className="list-decimal pl-10 mb-4 space-y-0.5">
              <li>Above prices are inclusive of GST.</li>
              <li><span className="underline">Payment Terms</span> &ndash; 100% advance payment along with Purchase Order.<br/>Products will be supplied post receipt of Payment.</li>
              <li>The above stated prices are non &ndash; negotiable &amp; non &ndash; commissionable.</li>
            </ol>

            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-[#1a237e]">Company Address</p>
              <button onClick={() => setShowModal(true)} className="text-gray-400 hover:text-blue-600 print:hidden" title="Edit Details">
                <Pencil size={14} />
              </button>
            </div>
            <div className="text-[#1a237e] mb-4 space-y-0.5">
              <p>{config.companyName}</p>
              <p><span className="font-bold">Building No./Flat No.:</span> {config.buildingNo}</p>
              <p>HOBLI, <span className="font-bold">Road/Street:</span> {config.roadStreet}</p>
              <p><span className="font-bold">City/Town/Village:</span> {config.cityTown}</p>
              <p>{config.districtState}</p>
              <p className="font-bold">GST: {config.companyGst}</p>
            </div>

            <div className="flex items-center gap-2 mb-1">
              <p className="font-bold text-[#1a237e] underline text-[12pt]">Bank Details</p>
              <button onClick={() => setShowModal(true)} className="text-gray-400 hover:text-blue-600 print:hidden" title="Edit Details">
                <Pencil size={14} />
              </button>
            </div>
            <table className="mb-6 text-[10.5pt] border-collapse w-[70%]">
              <tbody>
                <tr>
                  <td className="border border-black p-1 pl-2 w-1/3">Beneficiary</td>
                  <td className="border border-black p-1 pl-2">{config.beneficiary}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 pl-2">Bank</td>
                  <td className="border border-black p-1 pl-2">{config.bankName}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 pl-2">Branch</td>
                  <td className="border border-black p-1 pl-2">{config.branch}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 pl-2 align-top">Branch Address</td>
                  <td className="border border-black p-1 pl-2">{config.branchAddress}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 pl-2">Account No</td>
                  <td className="border border-black p-1 pl-2">{config.accountNo}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 pl-2">IFSC Code</td>
                  <td className="border border-black p-1 pl-2">{config.ifscCode}</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-6">
              <p className="mb-4">Yours Truly,</p>
              <p>Stove Kraft Team</p>
            </div>

          </div>
        </div>
      </div>

      {/* Edit Config Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col"
            >
              <div className="flex justify-between items-center p-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-lg font-bold text-gray-800">Edit Details</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-800">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-4 space-y-6">
                <div>
                  <h3 className="font-medium text-[#1a73e8] mb-3 border-b pb-1">Bank Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Beneficiary</label>
                      <input type="text" name="beneficiary" value={config.beneficiary} onChange={handleConfigChange} className="google-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Bank Name</label>
                      <input type="text" name="bankName" value={config.bankName} onChange={handleConfigChange} className="google-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Account No</label>
                      <input type="text" name="accountNo" value={config.accountNo} onChange={handleConfigChange} className="google-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">IFSC Code</label>
                      <input type="text" name="ifscCode" value={config.ifscCode} onChange={handleConfigChange} className="google-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Branch</label>
                      <input type="text" name="branch" value={config.branch} onChange={handleConfigChange} className="google-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Branch Address</label>
                      <input type="text" name="branchAddress" value={config.branchAddress} onChange={handleConfigChange} className="google-input w-full p-2 text-sm" />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-[#1a73e8] mb-3 border-b pb-1">Company Address</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Company Name</label>
                      <input type="text" name="companyName" value={config.companyName} onChange={handleConfigChange} className="google-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">GST Number</label>
                      <input type="text" name="companyGst" value={config.companyGst} onChange={handleConfigChange} className="google-input w-full p-2 text-sm" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Building No./Flat No.</label>
                      <input type="text" name="buildingNo" value={config.buildingNo} onChange={handleConfigChange} className="google-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Road/Street</label>
                      <input type="text" name="roadStreet" value={config.roadStreet} onChange={handleConfigChange} className="google-input w-full p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">City/Town/Village</label>
                      <input type="text" name="cityTown" value={config.cityTown} onChange={handleConfigChange} className="google-input w-full p-2 text-sm" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">District, State, Pin</label>
                      <input type="text" name="districtState" value={config.districtState} onChange={handleConfigChange} className="google-input w-full p-2 text-sm" />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                <button onClick={() => setShowModal(false)} className="bg-[#1a73e8] hover:bg-[#1557b0] text-white px-5 py-2 rounded shadow transition-colors text-sm font-medium">
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
          }
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
