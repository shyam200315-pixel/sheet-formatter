import React, { useState, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { motion } from "framer-motion";
import { Printer } from "lucide-react";
import mrpData from "../../public/mrp_data.json";

export default function QuotationGenerator() {
  const [formData, setFormData] = useState({
    clientName: "",
    clientAddress: "",
    productCode: "",
    productName: "",
    basePrice: "",
    quantity: "",
    gstPercent: 18,
  });

  const printRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Quotation_${formData.clientName || "Draft"}`,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: name === "basePrice" || name === "quantity" || name === "gstPercent" 
          ? (value === "" ? "" : Number(value)) 
          : value,
      };

      // Auto-fill from dictionary if Item Code changes
      if (name === "productCode" && mrpData[value]) {
        updated.productName = mrpData[value].name;
      }

      return updated;
    });
  };

  const basePriceNum = Number(formData.basePrice) || 0;
  const quantityNum = Number(formData.quantity) || 0;
  const gstPercentNum = Number(formData.gstPercent) || 0;

  const amount = basePriceNum * quantityNum;
  const gstAmount = (amount * gstPercentNum) / 100;
  const total = amount + gstAmount;

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
            <input
              type="text"
              name="clientName"
              value={formData.clientName}
              onChange={handleChange}
              className="google-input w-full p-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5f6368] mb-1 uppercase tracking-wider">Client Address</label>
            <textarea
              name="clientAddress"
              value={formData.clientAddress}
              onChange={handleChange}
              rows={3}
              className="google-input w-full p-2 text-sm resize-y"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5f6368] mb-1 uppercase tracking-wider">Item Name</label>
            <input
              type="text"
              name="productName"
              value={formData.productName}
              onChange={handleChange}
              className="google-input w-full p-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#5f6368] mb-1 uppercase tracking-wider">Item Code</label>
              <input
                type="text"
                name="productCode"
                value={formData.productCode}
                onChange={handleChange}
                className="google-input w-full p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5f6368] mb-1 uppercase tracking-wider">Quantity</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                className="google-input w-full p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5f6368] mb-1 uppercase tracking-wider">Base Price (₹)</label>
              <input
                type="number"
                name="basePrice"
                value={formData.basePrice}
                onChange={handleChange}
                className="google-input w-full p-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#5f6368] mb-1 uppercase tracking-wider">GST (%)</label>
              <input
                type="number"
                name="gstPercent"
                value={formData.gstPercent}
                onChange={handleChange}
                className="google-input w-full p-2 text-sm"
              />
            </div>
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

            <p className="font-bold underline mb-4">
              Subject: &nbsp; Performa Invoice For {toTitleCase(formData.productName)} ({formData.quantity} Qty)
            </p>

            <p className="font-bold underline mb-2">Dear Sir/Madam</p>

            <p className="mb-2">
              Further to the receipt of your requirement, details of the products along with price is given below. &ndash;
            </p>

            {/* Exact Table Replication */}
            <table className="w-full border-collapse mb-5 border border-black text-center text-[10pt]">
              <thead>
                <tr>
                  <th className="border border-black p-2 bg-gray-100 font-bold w-[12%]">Item Code</th>
                  <th className="border border-black p-2 bg-gray-100 font-bold w-[28%]">Item Name</th>
                  <th className="border border-black p-2 bg-gray-100 font-bold">Basic Price (₹)</th>
                  <th className="border border-black p-2 bg-gray-100 font-bold">Quantity</th>
                  <th className="border border-black p-2 bg-gray-100 font-bold">Amount (₹)</th>
                  <th className="border border-black p-2 bg-gray-100 font-bold">GST @{formData.gstPercent}% (₹)</th>
                  <th className="border border-black p-2 bg-gray-100 font-bold">Total with GST (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-2 font-bold">{formData.productCode}</td>
                  <td className="border border-black p-2 font-bold">{formData.productName.toUpperCase()}</td>
                  <td className="border border-black p-2">{formData.basePrice !== "" ? Number(formData.basePrice).toLocaleString("en-IN") : ""}</td>
                  <td className="border border-black p-2">{formData.quantity !== "" ? formData.quantity : ""}</td>
                  <td className="border border-black p-2">{amount > 0 ? amount.toLocaleString("en-IN") : ""}</td>
                  <td className="border border-black p-2">{gstAmount > 0 ? gstAmount.toLocaleString("en-IN") : ""}</td>
                  <td className="border border-black p-2">{total > 0 ? total.toLocaleString("en-IN") : ""}</td>
                </tr>
              </tbody>
            </table>

            <p className="mb-1 font-bold">Terms & Conditions: -</p>
            <ol className="list-decimal pl-10 mb-4 space-y-0.5">
              <li>Above prices are inclusive of GST.</li>
              <li><span className="underline">Payment Terms</span> &ndash; 100% advance payment along with Purchase Order.<br/>Products will be supplied post receipt of Payment.</li>
              <li>The above stated prices are non &ndash; negotiable &amp; non &ndash; commissionable.</li>
            </ol>

            <p className="font-bold text-[#1a237e] mb-1">Company Address</p>
            <div className="text-[#1a237e] mb-4 space-y-0.5">
              <p>STOVE KRAFT LIMITED</p>
              <p><span className="font-bold">Building No./Flat No.:</span> NO.81/1, MEDAMARANAHALLI VILLAGE, HAROHALLI</p>
              <p>HOBLI, <span className="font-bold">Road/Street:</span> KANAKAPURA TALUK,</p>
              <p><span className="font-bold">City/Town/Village:</span> RAMANAGARA DIST</p>
              <p>District: Ramanagara, State: Karnataka, Pin code: - 562112</p>
              <p className="font-bold">GST: 29AADCS9958B1ZY</p>
            </div>

            <p className="font-bold text-[#1a237e] underline mb-1 text-[12pt]">Bank Details</p>
            <table className="mb-6 text-[10.5pt] border-collapse w-[70%]">
              <tbody>
                <tr>
                  <td className="border border-black p-1 pl-2 w-1/3">Beneficiary</td>
                  <td className="border border-black p-1 pl-2">Stove Kraft Limited</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 pl-2">Bank</td>
                  <td className="border border-black p-1 pl-2">ICICI Bank Limited</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 pl-2">Branch</td>
                  <td className="border border-black p-1 pl-2">Bangalore M G Road Branch</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 pl-2 align-top">Branch Address</td>
                  <td className="border border-black p-1 pl-2">Shobha Pearl, Commissariat Road, off MG Road, Ground Floor, Bangalore - 560 025</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 pl-2">Account No</td>
                  <td className="border border-black p-1 pl-2">000251000253</td>
                </tr>
                <tr>
                  <td className="border border-black p-1 pl-2">IFSC Code</td>
                  <td className="border border-black p-1 pl-2">ICIC0000002</td>
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
