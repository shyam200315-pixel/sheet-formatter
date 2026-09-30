import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import fileSaver from "file-saver";

const saveAs = fileSaver.saveAs || fileSaver;

// Format JS Date to "DD-MMM-YYYY" (e.g. 01-Jul-2026)
export function formatDateDDMMM(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return "";
  const day = String(dateObj.getUTCDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[dateObj.getUTCMonth()];
  const year = dateObj.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

// Smooth 3-Color Scale helper matching Excel Conditional Formatting
// 0.0 (0%) -> Soft Red (#F8696B)
// 0.7 (70%) -> Soft Yellow (#FFEB84)
// 1.0 (100%) -> Soft Green (#63BE7B)
export function get3ColorScaleARGB(pct) {
  const val = Math.min(Math.max(pct, 0), 1);

  let r, g, b;
  if (val < 0.7) {
    const t = val / 0.7; // 0 to 1
    r = Math.round(248 + (255 - 248) * t);
    g = Math.round(105 + (235 - 105) * t);
    b = Math.round(107 + (132 - 107) * t);
  } else {
    const t = (val - 0.7) / 0.3; // 0 to 1
    r = Math.round(255 + (99 - 255) * t);
    g = Math.round(235 + (190 - 235) * t);
    b = Math.round(132 + (123 - 132) * t);
  }

  const toHex = (n) => n.toString(16).padStart(2, "0").toUpperCase();
  return `FF${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function get3ColorScaleHex(pct) {
  return `#${get3ColorScaleARGB(pct).slice(2)}`;
}

// Parse various Excel date formats
export function parseExcelDate(val) {
  if (val === null || val === undefined || val === "") return null;

  if (typeof val === "number") {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    }
  }

  if (val instanceof Date) return val;

  const str = String(val).trim();
  if (!str) return null;

  const partsSlash = str.split(/[/.-]/);
  if (partsSlash.length === 3) {
    let day, month, year;
    if (partsSlash[0].length === 4) {
      year = parseInt(partsSlash[0], 10);
      month = parseInt(partsSlash[1], 10) - 1;
      day = parseInt(partsSlash[2], 10);
    } else {
      day = parseInt(partsSlash[0], 10);
      month = parseInt(partsSlash[1], 10) - 1;
      year = parseInt(partsSlash[2], 10);
    }
    const d = new Date(Date.UTC(year, month, day));
    if (!isNaN(d.getTime())) return d;
  }

  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// File category detector
export function detectFileType(fileName, headers, rows) {
  const nameUpper = (fileName || "").toUpperCase();

  if (nameUpper.includes("OPENING")) return "opening";
  if (nameUpper.includes("CLOSING")) return "closing";
  if (nameUpper.includes("MONDAY")) return "monday";
  if (nameUpper.includes("TUESDAY")) return "tuesday";
  if (nameUpper.includes("WEDNESDAY")) return "wednesday";
  if (nameUpper.includes("THURSDAY")) return "thursday";
  if (nameUpper.includes("FRIDAY")) return "friday";

  const headerStr = JSON.stringify(headers || []).toUpperCase();
  if (headerStr.includes("OPENING")) return "opening";
  if (headerStr.includes("CLOSING")) return "closing";

  return "unknown";
}

// Calculate Dynamic Target Metrics based on Calendar Days
export function calculateDynamicTargets(startDate, endDate) {
  let totalCalendarDays = 0;
  let mondays = 0;
  let tuesdays = 0;
  let wednesdays = 0;
  let thursdays = 0;
  let fridays = 0;
  let saturdays = 0;
  let sundays = 0;

  const curr = new Date(startDate.getTime());
  while (curr <= endDate) {
    totalCalendarDays++;
    const dayOfWeek = curr.getUTCDay();
    if (dayOfWeek === 1) mondays++;
    else if (dayOfWeek === 2) tuesdays++;
    else if (dayOfWeek === 3) wednesdays++;
    else if (dayOfWeek === 4) thursdays++;
    else if (dayOfWeek === 5) fridays++;
    else if (dayOfWeek === 6) saturdays++;
    else if (dayOfWeek === 0) sundays++;

    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  const openingExpected = totalCalendarDays;
  const closingExpected = totalCalendarDays;
  const weekdayChecklistsExpected = mondays + tuesdays + wednesdays + thursdays + fridays;

  const expectedForms = openingExpected + closingExpected + weekdayChecklistsExpected;

  const openingPoints = openingExpected * 1;
  const closingPoints = closingExpected * 0;
  const mondayPoints = mondays * 13;
  const tuesdayPoints = tuesdays * 12;
  const wednesdayPoints = wednesdays * 12;
  const thursdayPoints = thursdays * 12;
  const fridayPoints = fridays * 12;

  const fixedTargetMaxScore =
    openingPoints + closingPoints + mondayPoints + tuesdayPoints + wednesdayPoints + thursdayPoints + fridayPoints;

  return {
    totalCalendarDays,
    mondays,
    tuesdays,
    wednesdays,
    thursdays,
    fridays,
    saturdays,
    sundays,
    weekdayChecklistsExpected,
    openingExpected,
    closingExpected,
    expectedForms,
    openingPoints,
    closingPoints,
    mondayPoints,
    tuesdayPoints,
    wednesdayPoints,
    thursdayPoints,
    fridayPoints,
    fixedTargetMaxScore,
  };
}

// Process 7 raw files
export async function processWooqerFiles(files, customRange = null) {
  const fileCategories = {
    opening: null,
    closing: null,
    monday: null,
    tuesday: null,
    wednesday: null,
    thursday: null,
    friday: null,
  };

  const readPromises = files.map((file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
          const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

          const category = detectFileType(file.name, headers, rows);
          resolve({ file, category, rows, name: file.name });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  });

  const parsedFiles = await Promise.all(readPromises);

  const dataByType = {
    opening: [],
    closing: [],
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
  };

  parsedFiles.forEach((item) => {
    if (item.category && dataByType[item.category] !== undefined) {
      dataByType[item.category] = item.rows;
      fileCategories[item.category] = item.name;
    }
  });

  let rangeStart = customRange?.startDate
    ? new Date(customRange.startDate)
    : new Date(Date.UTC(2026, 6, 1));
  let rangeEnd = customRange?.endDate
    ? new Date(customRange.endDate)
    : new Date(Date.UTC(2026, 8, 30));

  const targetMetrics = calculateDynamicTargets(rangeStart, rangeEnd);

  const cleanRecord = (row) => {
    const rawStore = row["Store"] || row["STORE"] || row["Store ID"] || row["STORE ID"] || "";
    const store = String(rawStore).trim();
    if (!store) return null;

    const rawDate = row["Date (dd/mm/yyyy)"] || row["Submission Date (dd/mm/yyyy)"] || row["Date"] || "";
    const dateObj = parseExcelDate(rawDate);
    if (!dateObj) return null;

    if (dateObj < rangeStart || dateObj > rangeEnd) return null;

    const rawScore = row["Total Score Obtained"] || row["Total Score"] || row["Score"] || 0;
    const score = typeof rawScore === "number" ? rawScore : parseFloat(rawScore) || 0;

    return {
      store,
      dateObj,
      dateKey: formatDateDDMMM(dateObj),
      isoDate: dateObj.toISOString().split("T")[0],
      score,
    };
  };

  const storeMap = {};
  const allStoresSet = new Set();

  const indexCategoryData = (typeKey, rows) => {
    rows.forEach((row) => {
      const rec = cleanRecord(row);
      if (!rec) return;

      const { store, dateKey, score } = rec;
      allStoresSet.add(store);

      if (!storeMap[store]) {
        storeMap[store] = {
          store,
          openingCount: 0,
          closingCount: 0,
          mondayCount: 0,
          tuesdayCount: 0,
          wednesdayCount: 0,
          thursdayCount: 0,
          fridayCount: 0,
          totalScore: 0,
          dailySubmissions: {},
        };
      }

      const storeData = storeMap[store];

      if (typeKey === "opening") storeData.openingCount++;
      else if (typeKey === "closing") storeData.closingCount++;
      else if (typeKey === "monday") storeData.mondayCount++;
      else if (typeKey === "tuesday") storeData.tuesdayCount++;
      else if (typeKey === "wednesday") storeData.wednesdayCount++;
      else if (typeKey === "thursday") storeData.thursdayCount++;
      else if (typeKey === "friday") storeData.fridayCount++;

      storeData.totalScore += score;

      if (!storeData.dailySubmissions[dateKey]) {
        storeData.dailySubmissions[dateKey] = {
          opening: null,
          closing: null,
          dailyChecklist: null,
        };
      }

      const daySub = storeData.dailySubmissions[dateKey];
      if (typeKey === "opening") {
        daySub.opening = { score };
      } else if (typeKey === "closing") {
        daySub.closing = { score };
      } else {
        daySub.dailyChecklist = { score, dayType: typeKey };
      }
    });
  };

  Object.keys(dataByType).forEach((typeKey) => {
    indexCategoryData(typeKey, dataByType[typeKey]);
  });

  const sortedStores = Array.from(allStoresSet).sort();

  const summaryRows = sortedStores.map((storeCode) => {
    const st = storeMap[storeCode] || {
      store: storeCode,
      openingCount: 0,
      closingCount: 0,
      mondayCount: 0,
      tuesdayCount: 0,
      wednesdayCount: 0,
      thursdayCount: 0,
      fridayCount: 0,
      totalScore: 0,
    };

    const totalFormsFilled =
      st.openingCount +
      st.closingCount +
      st.mondayCount +
      st.tuesdayCount +
      st.wednesdayCount +
      st.thursdayCount +
      st.fridayCount;

    const expectedForms = targetMetrics.expectedForms;
    const formsSubmissionPct = expectedForms > 0 ? totalFormsFilled / expectedForms : 0;
    const fixedTargetMaxScore = targetMetrics.fixedTargetMaxScore;
    const pointsFulfillmentPct = fixedTargetMaxScore > 0 ? st.totalScore / fixedTargetMaxScore : 0;

    return {
      store: storeCode,
      opening: st.openingCount,
      closing: st.closingCount,
      monday: st.mondayCount,
      tuesday: st.tuesdayCount,
      wednesday: st.wednesdayCount,
      thursday: st.thursdayCount,
      friday: st.fridayCount,
      totalFormsFilled,
      expectedForms,
      formsSubmissionPct,
      totalScoreObtained: st.totalScore,
      fixedTargetMaxScore,
      pointsFulfillmentPct,
    };
  });

  const dateList = [];
  const curr = new Date(rangeStart.getTime());
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  while (curr <= rangeEnd) {
    const dObj = new Date(curr.getTime());
    const dateStr = formatDateDDMMM(dObj);
    const dayName = dayNames[dObj.getUTCDay()];
    const isWeekend = dObj.getUTCDay() === 0 || dObj.getUTCDay() === 6;

    dateList.push({
      dateObj: dObj,
      dateStr,
      dayName,
      isWeekend,
    });

    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  const storeTrackers = {};
  sortedStores.forEach((storeCode) => {
    const st = storeMap[storeCode];

    const rows = dateList.map((dayItem) => {
      const sub = (st && st.dailySubmissions && st.dailySubmissions[dayItem.dateStr]) || {};

      let openingStatus = "Missed";
      if (sub.opening) {
        openingStatus = `Filled (${sub.opening.score} pts)`;
      }

      let closingStatus = "Missed";
      if (sub.closing) {
        closingStatus = `Filled (${sub.closing.score} pts)`;
      }

      let dailyChecklistStatus = "Missed";
      if (dayItem.isWeekend) {
        dailyChecklistStatus = "N/A (Weekend)";
      } else if (sub.dailyChecklist) {
        dailyChecklistStatus = `Filled (${sub.dailyChecklist.score} pts)`;
      }

      return {
        date: dayItem.dateStr,
        day: dayItem.dayName,
        opening: openingStatus,
        closing: closingStatus,
        dailyChecklist: dailyChecklistStatus,
        isWeekend: dayItem.isWeekend,
      };
    });

    storeTrackers[storeCode] = rows;
  });

  return {
    fileCategories,
    stores: sortedStores,
    summaryRows,
    storeTrackers,
    totalStores: sortedStores.length,
    dateList,
    targetMetrics,
    rangeStart,
    rangeEnd,
  };
}

// Export 1: Full_Q3_Store_Audit_Report.xlsx with 3-Color Scale Conditional Formatting
export async function exportQ3SummaryReportExcel(summaryRows, targetMetrics) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Q3 Fixed Target Report");

  const expectedFormsVal = targetMetrics?.expectedForms || 250;
  const maxScoreVal = targetMetrics?.fixedTargetMaxScore || 897;

  const headers = [
    "Store",
    "Opening",
    "Closing",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Total Forms Filled",
    "Expected Forms (Q3)",
    "Forms Submission %",
    "Total Score Obtained",
    "Fixed Target Max Score",
    "Points Fulfillment %",
  ];

  ws.addRow(headers);

  // Header Row Styling (#1F497D background, white bold font)
  const headerRow = ws.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F497D" },
    };
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFD9D9D9" } },
      left: { style: "thin", color: { argb: "FFD9D9D9" } },
      bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
      right: { style: "thin", color: { argb: "FFD9D9D9" } },
    };
  });

  // Data Rows with Conditional 3-Color Scale Fills
  summaryRows.forEach((item, index) => {
    const rowIndex = index + 2;
    const row = ws.addRow([
      item.store,
      item.opening,
      item.closing,
      item.monday,
      item.tuesday,
      item.wednesday,
      item.thursday,
      item.friday,
      { formula: `SUM(B${rowIndex}:H${rowIndex})` },
      expectedFormsVal,
      { formula: `I${rowIndex}/J${rowIndex}` },
      item.totalScoreObtained,
      maxScoreVal,
      { formula: `L${rowIndex}/M${rowIndex}` },
    ]);

    row.height = 20;

    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Calibri", size: 11 };
      cell.alignment = { horizontal: colNumber === 1 ? "left" : "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9D9D9" } },
        left: { style: "thin", color: { argb: "FFD9D9D9" } },
        bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
        right: { style: "thin", color: { argb: "FFD9D9D9" } },
      };

      // Number formatting
      if (colNumber >= 2 && colNumber <= 10) {
        cell.numFmt = "#,##0";
      } else if (colNumber === 11) {
        // Col K: Forms Submission % - Apply 3-Color Scale Fill!
        cell.numFmt = "0.0%";
        const colorARGB = get3ColorScaleARGB(item.formsSubmissionPct);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: colorARGB },
        };
      } else if (colNumber === 12 || colNumber === 13) {
        cell.numFmt = "#,##0.0";
      } else if (colNumber === 14) {
        // Col N: Points Fulfillment % - Apply 3-Color Scale Fill!
        cell.numFmt = "0.0%";
        const colorARGB = get3ColorScaleARGB(item.pointsFulfillmentPct);
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: colorARGB },
        };
      }
    });
  });

  // Total Row at Bottom
  const lastDataRowIndex = summaryRows.length + 1;

  // Calculate Overall Averages for Total Row percentage fills
  const totalFilledSum = summaryRows.reduce((acc, curr) => acc + curr.totalFormsFilled, 0);
  const totalExpSum = summaryRows.length * expectedFormsVal;
  const overallSubPct = totalExpSum > 0 ? totalFilledSum / totalExpSum : 0;

  const totalScoreSum = summaryRows.reduce((acc, curr) => acc + curr.totalScoreObtained, 0);
  const totalMaxScoreSum = summaryRows.length * maxScoreVal;
  const overallFulPct = totalMaxScoreSum > 0 ? totalScoreSum / totalMaxScoreSum : 0;

  const totalRow = ws.addRow([
    "Total",
    { formula: `SUM(B2:B${lastDataRowIndex})` },
    { formula: `SUM(C2:C${lastDataRowIndex})` },
    { formula: `SUM(D2:D${lastDataRowIndex})` },
    { formula: `SUM(E2:E${lastDataRowIndex})` },
    { formula: `SUM(F2:F${lastDataRowIndex})` },
    { formula: `SUM(G2:G${lastDataRowIndex})` },
    { formula: `SUM(H2:H${lastDataRowIndex})` },
    { formula: `SUM(I2:I${lastDataRowIndex})` },
    { formula: `SUM(J2:J${lastDataRowIndex})` },
    { formula: `SUM(I2:I${lastDataRowIndex})/SUM(J2:J${lastDataRowIndex})` },
    { formula: `SUM(L2:L${lastDataRowIndex})` },
    { formula: `SUM(M2:M${lastDataRowIndex})` },
    { formula: `SUM(L2:L${lastDataRowIndex})/SUM(M2:M${lastDataRowIndex})` },
  ]);

  totalRow.height = 24;

  totalRow.eachCell((cell, colNumber) => {
    cell.font = { name: "Calibri", size: 11, bold: true };
    cell.alignment = { horizontal: colNumber === 1 ? "left" : "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FF000000" } },
      left: { style: "thin", color: { argb: "FFD9D9D9" } },
      bottom: { style: "double", color: { argb: "FF000000" } },
      right: { style: "thin", color: { argb: "FFD9D9D9" } },
    };

    if (colNumber >= 2 && colNumber <= 10) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCE6F1" }, // Light Blue Fill
      };
      cell.numFmt = "#,##0";
    } else if (colNumber === 11) {
      cell.numFmt = "0.0%";
      const colorARGB = get3ColorScaleARGB(overallSubPct);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: colorARGB },
      };
    } else if (colNumber === 12 || colNumber === 13) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCE6F1" },
      };
      cell.numFmt = "#,##0.0";
    } else if (colNumber === 14) {
      cell.numFmt = "0.0%";
      const colorARGB = get3ColorScaleARGB(overallFulPct);
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: colorARGB },
      };
    } else {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFDCE6F1" },
      };
    }
  });

  // Native Excel 3-Color Scale Rules on Range K2:K{lastDataRowIndex} and N2:N{lastDataRowIndex}
  try {
    ws.addConditionalFormatting({
      ref: `K2:K${lastDataRowIndex}`,
      rules: [
        {
          type: "colorScale",
          cfvo: [
            { type: "num", value: 0 },
            { type: "num", value: 0.7 },
            { type: "num", value: 1.0 },
          ],
          color: [
            { argb: "FFF8696B" }, // Red
            { argb: "FFFFEB84" }, // Yellow
            { argb: "FF63BE7B" }, // Green
          ],
        },
      ],
    });

    ws.addConditionalFormatting({
      ref: `N2:N${lastDataRowIndex}`,
      rules: [
        {
          type: "colorScale",
          cfvo: [
            { type: "num", value: 0 },
            { type: "num", value: 0.7 },
            { type: "num", value: 1.0 },
          ],
          color: [
            { argb: "FFF8696B" }, // Red
            { argb: "FFFFEB84" }, // Yellow
            { argb: "FF63BE7B" }, // Green
          ],
        },
      ],
    });
  } catch (err) {
    console.warn("Native conditional formatting warning:", err);
  }

  // Auto-fit Column Widths
  ws.columns.forEach((column) => {
    let maxLength = 14;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const valStr = cell.value ? String(cell.value) : "";
      if (valStr.length > maxLength) {
        maxLength = valStr.length;
      }
    });
    column.width = maxLength + 4;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, "Full_Q3_Store_Audit_Report.xlsx");
}

// Export 2: Master_Store_Tracker_With_Dates.xlsx
export async function exportMasterStoreTrackerExcel(storeTrackers) {
  const wb = new ExcelJS.Workbook();

  const storeCodes = Object.keys(storeTrackers).sort();

  storeCodes.forEach((storeCode) => {
    const ws = wb.addWorksheet(storeCode);

    const headers = ["Date", "Day", "Opening", "Closing", "Daily Checklist"];
    ws.addRow(headers);

    const headerRow = ws.getRow(1);
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF366092" },
      };
      cell.font = {
        name: "Calibri",
        size: 11,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin", color: { argb: "FFD9D9D9" } },
        left: { style: "thin", color: { argb: "FFD9D9D9" } },
        bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
        right: { style: "thin", color: { argb: "FFD9D9D9" } },
      };
    });

    const rowsData = storeTrackers[storeCode] || [];

    rowsData.forEach((rowItem) => {
      const row = ws.addRow([
        rowItem.date,
        rowItem.day,
        rowItem.opening,
        rowItem.closing,
        rowItem.dailyChecklist,
      ]);

      row.height = 20;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: "Calibri", size: 11 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFD9D9D9" } },
          left: { style: "thin", color: { argb: "FFD9D9D9" } },
          bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
          right: { style: "thin", color: { argb: "FFD9D9D9" } },
        };

        if (colNumber >= 3) {
          const val = String(cell.value || "");
          if (val.startsWith("Filled")) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFC6EFCE" },
            };
            cell.font = { name: "Calibri", size: 11, color: { argb: "FF006100" } };
          } else if (val === "Missed") {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFC7CE" },
            };
            cell.font = { name: "Calibri", size: 11, color: { argb: "FF9C0006" } };
          } else if (val.includes("Weekend") || val.includes("N/A")) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF2F2F2" },
            };
            cell.font = { name: "Calibri", size: 11, color: { argb: "FF7F7F7F" } };
          }
        }
      });
    });

    ws.columns = [
      { width: 14 },
      { width: 14 },
      { width: 18 },
      { width: 18 },
      { width: 22 },
    ];
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  saveAs(blob, "Master_Store_Tracker_With_Dates.xlsx");
}
