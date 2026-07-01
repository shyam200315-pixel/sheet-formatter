import React, { useState, useRef } from "react";
// Removed useReactToPrint
import { motion, AnimatePresence } from "framer-motion";
import { Printer, Pencil, X, Plus, Trash2, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import mrpData from "../../public/mrp_data.json";

export default function QuotationGenerator() {
  const [formData, setFormData] = useState({
    clientName: "",
    clientAddress: "",
    clientGst: "",
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

  const handleDownloadPDF = async () => {
    const toastId = toast.loading("Generating PDF...");
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const marginX = 15;
      let startY = 15;

      let logoData = null;
      try {
        const res = await fetch("/logo.jpeg");
        if (res.ok) {
          const blob = await res.blob();
          logoData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        }
      } catch (e) {
        console.error("Logo fetch failed", e);
      }

      if (logoData) {
        doc.addImage(logoData, 'JPEG', 210 - marginX - 45, 8, 45, 15);
      }

      doc.setFont("times", "normal");
      doc.setFontSize(10.5);

      startY += 15;
      doc.text(`Date: ${formatDate(new Date())}`, marginX, startY);
      startY += 12;

      doc.setFont("times", "bold");
      doc.text("To,", marginX, startY);
      doc.setLineWidth(0.3);
      doc.line(marginX, startY + 1, marginX + doc.getTextWidth("To,"), startY + 1);
      startY += 6;

      const titleCaseName = toTitleCase(formData.clientName);
      doc.text(titleCaseName, marginX, startY);
      doc.line(marginX, startY + 1, marginX + doc.getTextWidth(titleCaseName), startY + 1);
      startY += 6;

      doc.setFont("times", "normal");
      const splitAddress = doc.splitTextToSize(toTitleCase(formData.clientAddress), 140);
      doc.text(splitAddress, marginX, startY);
      startY += (splitAddress.length * 5) + 2;

      if (formData.clientGst) {
        doc.setFont("times", "bold");
        doc.text(`GST No.: ${formData.clientGst}`, marginX, startY);
        startY += 7;
      } else {
        startY += 2;
      }

      if (displaySubject) {
        doc.setFont("times", "bold");
        const subjText = `Subject:   ${displaySubject}`;
        doc.text(subjText, marginX, startY);
        doc.line(marginX + doc.getTextWidth("Subject:   "), startY + 1, marginX + doc.getTextWidth(subjText), startY + 1);
        startY += 8;
      }

      doc.setFont("times", "bold");
      doc.text("Dear Sir/Madam", marginX, startY);
      doc.line(marginX, startY + 1, marginX + doc.getTextWidth("Dear Sir/Madam"), startY + 1);
      startY += 6;

      doc.setFont("times", "normal");
      doc.text("Further to the receipt of your requirement, details of the products along with price is given below. –", marginX, startY);
      startY += 5;

      const tableColumn = [
        "Item Code",
        "Item Name",
        "Basic Price\n(Rs.)",
        "Quantity",
        "Amount\n(Rs.)",
        "GST\n(Rs.)",
        "Total with\nGST (Rs.)"
      ];
      
      const tableRows = formData.items.map(item => {
        const { amount, gstAmount, total } = calculateItemTotals(item);
        return [
          item.productCode,
          item.productName.toUpperCase(),
          item.basePrice !== "" ? Number(item.basePrice).toLocaleString("en-IN") : "",
          item.quantity !== "" ? String(item.quantity) : "",
          amount > 0 ? amount.toLocaleString("en-IN") : "",
          gstAmount > 0 ? gstAmount.toLocaleString("en-IN") : "",
          total > 0 ? total.toLocaleString("en-IN") : ""
        ];
      });

      if (formData.items.length > 1) {
        tableRows.push([
          { content: "Grand Total:", colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: grandTotals.amount > 0 ? grandTotals.amount.toLocaleString("en-IN") : "", styles: { fontStyle: 'bold' } },
          { content: grandTotals.gstAmount > 0 ? grandTotals.gstAmount.toLocaleString("en-IN") : "", styles: { fontStyle: 'bold' } },
          { content: grandTotals.total > 0 ? grandTotals.total.toLocaleString("en-IN") : "", styles: { fontStyle: 'bold' } }
        ]);
      }

      autoTable(doc, {
        startY: startY,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        styles: { font: 'times', fontSize: 10, textColor: 0, lineColor: 0, lineWidth: 0.3, cellPadding: 1.5 },
        headStyles: { fillColor: [243, 244, 246], textColor: 0, fontStyle: 'bold', halign: 'center', valign: 'middle' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 22 },
          1: { halign: 'left', cellWidth: 'auto' },
          2: { halign: 'center', cellWidth: 20 },
          3: { halign: 'center', cellWidth: 16 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 18 },
          6: { halign: 'center', cellWidth: 22 },
        },
        bodyStyles: { halign: 'center', valign: 'middle' },
        didParseCell: function (data) {
           if (data.section === 'body' && data.column.index === 1 && (!data.cell.colSpan || data.cell.colSpan === 1)) {
              data.cell.styles.fontStyle = 'bold';
           }
           if (data.section === 'body' && data.column.index === 0 && (!data.cell.colSpan || data.cell.colSpan === 1)) {
              data.cell.styles.fontStyle = 'bold';
           }
        }
      });

      startY = doc.lastAutoTable.finalY + 8;

      doc.setFont("times", "bold");
      doc.text("Terms & Conditions: -", marginX, startY);
      startY += 6;
      
      const listIndent = marginX + 8;
      doc.setFont("times", "normal");
      doc.text("1. Above prices are inclusive of GST.", listIndent, startY);
      startY += 5;
      
      doc.text("2. Payment Terms", listIndent, startY);
      doc.line(listIndent + doc.getTextWidth("2. "), startY + 1, listIndent + doc.getTextWidth("2. Payment Terms"), startY + 1);
      doc.text(" – 100% advance payment along with Purchase Order.", listIndent + doc.getTextWidth("2. Payment Terms"), startY);
      startY += 5;
      doc.text("   Products will be supplied post receipt of Payment.", listIndent, startY);
      startY += 5;
      
      doc.text("3. The above stated prices are non – negotiable & non – commissionable.", listIndent, startY);
      startY += 10;

      if (startY > 230) {
        doc.addPage();
        startY = 20;
      }

      // Blue section
      const blueColor = [26, 35, 126];
      doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
      
      doc.setFont("times", "bold");
      doc.text("Company Address", marginX, startY);
      startY += 5;
      
      doc.setFont("times", "normal");
      doc.text(config.companyName, marginX, startY);
      startY += 5;
      
      doc.setFont("times", "bold");
      const bnoLabel = "Building No./Flat No.: ";
      doc.text(bnoLabel, marginX, startY);
      const bnoLabelWidth = doc.getTextWidth(bnoLabel);
      doc.setFont("times", "normal");
      doc.text(config.buildingNo, marginX + bnoLabelWidth, startY);
      startY += 5;
      
      doc.setFont("times", "normal");
      const hobliLabel = "HOBLI, ";
      doc.text(hobliLabel, marginX, startY);
      const hobliWidth = doc.getTextWidth(hobliLabel);
      
      doc.setFont("times", "bold");
      const rsLabel = "Road/Street: ";
      doc.text(rsLabel, marginX + hobliWidth, startY);
      const rsWidth = doc.getTextWidth(rsLabel);
      
      doc.setFont("times", "normal");
      doc.text(config.roadStreet, marginX + hobliWidth + rsWidth, startY);
      startY += 5;
      
      doc.setFont("times", "bold");
      const cityLabel = "City/Town/Village: ";
      doc.text(cityLabel, marginX, startY);
      const cityWidth = doc.getTextWidth(cityLabel);
      
      doc.setFont("times", "normal");
      doc.text(config.cityTown, marginX + cityWidth, startY);
      startY += 5;
      
      doc.setFont("times", "normal");
      doc.text(config.districtState, marginX, startY);
      startY += 5;
      
      doc.setFont("times", "bold");
      doc.text(`GST: ${config.companyGst}`, marginX, startY);
      startY += 10;

      doc.setFont("times", "bold");
      doc.text("Bank Details", marginX, startY);
      doc.setDrawColor(blueColor[0], blueColor[1], blueColor[2]);
      doc.line(marginX, startY + 1, marginX + doc.getTextWidth("Bank Details"), startY + 1);
      startY += 3;

      doc.setTextColor(0, 0, 0); // reset to black for table
      const bankData = [
        ["Beneficiary", config.beneficiary],
        ["Bank", config.bankName],
        ["Branch", config.branch],
        ["Branch Address", config.branchAddress],
        ["Account No", config.accountNo],
        ["IFSC Code", config.ifscCode]
      ];

      autoTable(doc, {
        startY: startY,
        body: bankData,
        theme: 'grid',
        styles: { font: 'times', fontSize: 10.5, textColor: 0, lineColor: 0, lineWidth: 0.3, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 'auto' }
        },
        margin: { left: marginX, right: 60 }
      });

      startY = doc.lastAutoTable.finalY + 12;

      if (startY > 270) {
        doc.addPage();
        startY = 20;
      }

      doc.setFont("times", "normal");
      doc.text("Yours Truly,", marginX, startY);
      startY += 8;
      doc.text("Stove Kraft Team", marginX, startY);

      doc.save(`Quotation_${formData.clientName || "Draft"}.pdf`);
      
      toast.success("PDF downloaded successfully!", { id: toastId });
    } catch (error) {
      console.error("Failed to generate PDF", error);
      toast.error(`Error: ${error.message || "Unknown error"}`, { id: toastId, duration: 10000 });
    }
  };

  const handleDownloadWord = async () => {
    const toastId = toast.loading("Generating Word document...");
    try {
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, ImageRun } = await import("docx");
      const { saveAs } = await import("file-saver");
      
      let logoImageRun = null;
      try {
        const response = await fetch("/logo.jpeg");
        if (response.ok) {
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          logoImageRun = new ImageRun({
            data: arrayBuffer,
            transformation: {
              width: 150, // Approximation to match 50px height
              height: 50,
            },
          });
        }
      } catch (err) {
        console.error("Failed to load logo image for Word doc", err);
        toast.error("Failed to load company logo. Document will be generated without it.");
      }

      const createCell = (text, isHeader = false, colSpan = 1, alignment = AlignmentType.LEFT) => {
        return new TableCell({
          columnSpan: colSpan,
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          children: [new Paragraph({ children: [new TextRun({ text: text || "", bold: isHeader })], alignment })]
        });
      };

      const tableBorders = {
        top: { style: BorderStyle.SINGLE, size: 1 },
        bottom: { style: BorderStyle.SINGLE, size: 1 },
        left: { style: BorderStyle.SINGLE, size: 1 },
        right: { style: BorderStyle.SINGLE, size: 1 },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
        insideVertical: { style: BorderStyle.SINGLE, size: 1 },
      };

      const tableRows = [
        new TableRow({
          children: [
            createCell("Item Code", true, 1, AlignmentType.CENTER),
            createCell("Item Name", true, 1, AlignmentType.CENTER),
            createCell("Basic Price (₹)", true, 1, AlignmentType.CENTER),
            createCell("Quantity", true, 1, AlignmentType.CENTER),
            createCell("Amount (₹)", true, 1, AlignmentType.CENTER),
            createCell("GST (₹)", true, 1, AlignmentType.CENTER),
            createCell("Total with GST (₹)", true, 1, AlignmentType.CENTER),
          ]
        }),
        ...formData.items.map(item => {
          const { amount, gstAmount, total } = calculateItemTotals(item);
          return new TableRow({
            children: [
              createCell(item.productCode, false, 1, AlignmentType.CENTER),
              createCell(item.productName ? item.productName.toUpperCase() : "", true, 1, AlignmentType.LEFT),
              createCell(item.basePrice !== "" ? Number(item.basePrice).toLocaleString("en-IN") : "", false, 1, AlignmentType.CENTER),
              createCell(item.quantity !== "" ? String(item.quantity) : "", false, 1, AlignmentType.CENTER),
              createCell(amount > 0 ? amount.toLocaleString("en-IN") : "", false, 1, AlignmentType.CENTER),
              createCell(gstAmount > 0 ? gstAmount.toLocaleString("en-IN") : "", false, 1, AlignmentType.CENTER),
              createCell(total > 0 ? total.toLocaleString("en-IN") : "", false, 1, AlignmentType.CENTER),
            ]
          })
        })
      ];

      if (formData.items.length > 1) {
         tableRows.push(new TableRow({
           children: [
              createCell("Grand Total:", true, 4, AlignmentType.RIGHT),
              createCell(grandTotals.amount > 0 ? grandTotals.amount.toLocaleString("en-IN") : "", true, 1, AlignmentType.CENTER),
              createCell(grandTotals.gstAmount > 0 ? grandTotals.gstAmount.toLocaleString("en-IN") : "", true, 1, AlignmentType.CENTER),
              createCell(grandTotals.total > 0 ? grandTotals.total.toLocaleString("en-IN") : "", true, 1, AlignmentType.CENTER),
           ]
         }));
      }

      const docChildren = [];
      if (logoImageRun) {
        docChildren.push(
          new Paragraph({
            children: [logoImageRun],
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 }
          })
        );
      }

      docChildren.push(
        new Paragraph({ text: `Date: ${formatDate(new Date())}`, spacing: { after: 200 } }),
        
        new Paragraph({ children: [new TextRun({ text: "To,", bold: true, underline: {} })] }),
        new Paragraph({ children: [new TextRun({ text: toTitleCase(formData.clientName), bold: true, underline: {} })] }),
        new Paragraph({ text: toTitleCase(formData.clientAddress), spacing: { after: formData.clientGst ? 0 : 400 } })
      );

      if (formData.clientGst) {
        docChildren.push(
          new Paragraph({ children: [new TextRun({ text: `GST No.: ${formData.clientGst}`, bold: true })], spacing: { after: 400 } })
        );
      }

      if (displaySubject) {
        docChildren.push(
          new Paragraph({ children: [new TextRun({ text: `Subject:  ${displaySubject}`, bold: true, underline: {} })], spacing: { after: 400 } })
        );
      }

      docChildren.push(
        new Paragraph({ children: [new TextRun({ text: "Dear Sir/Madam", bold: true, underline: {} })], spacing: { after: 200 } }),
        new Paragraph({ text: "Further to the receipt of your requirement, details of the products along with price is given below. –", spacing: { after: 200 } }),
        
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: tableBorders,
          rows: tableRows
        }),

        new Paragraph({ children: [new TextRun({ text: "Terms & Conditions: -", bold: true })], spacing: { before: 200 } }),
        new Paragraph({ text: "1. Above prices are inclusive of GST." }),
        new Paragraph({ children: [new TextRun({ text: "2. Payment Terms", underline: {} }), new TextRun({ text: " – 100% advance payment along with Purchase Order. Products will be supplied post receipt of Payment." })] }),
        new Paragraph({ text: "3. The above stated prices are non – negotiable & non – commissionable.", spacing: { after: 400 } }),

        new Paragraph({ children: [new TextRun({ text: "Company Address", bold: true })] }),
        new Paragraph({ text: config.companyName }),
        new Paragraph({ children: [new TextRun({ text: "Building No./Flat No.: ", bold: true }), new TextRun({ text: config.buildingNo })] }),
        new Paragraph({ children: [new TextRun({ text: "Road/Street: ", bold: true }), new TextRun({ text: config.roadStreet })] }),
        new Paragraph({ children: [new TextRun({ text: "City/Town/Village: ", bold: true }), new TextRun({ text: config.cityTown })] }),
        new Paragraph({ text: config.districtState }),
        new Paragraph({ children: [new TextRun({ text: `GST: ${config.companyGst}`, bold: true })], spacing: { after: 400 } }),

        new Paragraph({ children: [new TextRun({ text: "Bank Details", bold: true, underline: {} })] }),
        new Table({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: [
                new TableRow({ children: [createCell("Beneficiary"), createCell(config.beneficiary)] }),
                new TableRow({ children: [createCell("Bank"), createCell(config.bankName)] }),
                new TableRow({ children: [createCell("Branch"), createCell(config.branch)] }),
                new TableRow({ children: [createCell("Branch Address"), createCell(config.branchAddress)] }),
                new TableRow({ children: [createCell("Account No"), createCell(config.accountNo)] }),
                new TableRow({ children: [createCell("IFSC Code"), createCell(config.ifscCode)] }),
            ]
        }),

        new Paragraph({ text: "Yours Truly,", spacing: { before: 400 } }),
        new Paragraph({ text: "Stove Kraft Team" })
      );

      const doc = new Document({
        sections: [{
          properties: {},
          children: docChildren
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Quotation_${formData.clientName || "Draft"}.docx`);
      toast.success("Word document downloaded successfully!", { id: toastId });
    } catch (error) {
      console.error("Failed to generate word document", error);
      toast.error("Failed to generate Word document. Please try again.", { id: toastId });
    }
  };

  const isValidGst = (gst) => {
    if (!gst) return true;
    const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return regex.test(gst);
  };

  const handleGstChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      clientGst: e.target.value.toUpperCase(),
    }));
  };

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
            <label className="block text-xs font-medium text-[#5f6368] mb-1 uppercase tracking-wider">Client GST (Optional)</label>
            <input 
              type="text" 
              name="clientGst" 
              value={formData.clientGst} 
              onChange={handleGstChange} 
              maxLength={15}
              placeholder="e.g. 27AAPFU0939F1ZV" 
              className={`google-input w-full p-2 text-sm ${formData.clientGst && !isValidGst(formData.clientGst) ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-200 outline-none" : ""}`} 
            />
            {formData.clientGst && !isValidGst(formData.clientGst) && (
              <p className="text-red-500 text-[10px] mt-1 font-medium">Invalid GST format. (e.g. 27AAPFU0939F1ZV)</p>
            )}
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
          
          <div className="pt-4 border-t border-[#dadce0] flex flex-col gap-3">
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDownloadPDF}
                className="flex-1 flex justify-center items-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-2.5 rounded font-medium transition-colors shadow-sm cursor-pointer"
              >
                <Printer size={18} />
                PDF
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDownloadWord}
                className="flex-1 flex justify-center items-center gap-2 bg-[#0f9d58] hover:bg-[#0b8043] text-white px-4 py-2.5 rounded font-medium transition-colors shadow-sm cursor-pointer"
              >
                <FileText size={18} />
                Word
              </motion.button>
            </div>
            <p className="text-xs text-center text-[#5f6368]">
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
            <p className={formData.clientGst ? "mb-1 w-[70%]" : "mb-4 w-[70%]"}>{toTitleCase(formData.clientAddress)}</p>
            
            {formData.clientGst && (
              <p className="mb-4 text-sm font-bold">GST No.: {formData.clientGst}</p>
            )}

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
