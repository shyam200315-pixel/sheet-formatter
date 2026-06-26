import * as XLSX from "xlsx";

/**
 * Parses a string in DD/MM/YYYY or DD-MM-YYYY format into a Date object.
 * @param {string} dateStr 
 * @returns {Date|null}
 */
export function parseBillDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const match = dateStr.match(/^(\d{2})[/\-](\d{2})[/\-](\d{4})$/);
  if (!match) return null;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
}

/**
 * Finds the 0-indexed row number containing the column headers.
 * Looks for the first row containing both "BRANCH NAME" and "BILL DATE".
 * @param {object} worksheet 
 * @returns {number}
 */
export function findHeaderRowIndex(worksheet) {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
  for (let r = range.s.r; r <= range.e.r; r++) {
    let foundBranchName = false;
    let foundBillDate = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = worksheet[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v) {
        const val = String(cell.v).trim().toUpperCase();
        if (val === "BRANCH NAME") foundBranchName = true;
        if (val === "BILL DATE") foundBillDate = true;
      }
    }
    if (foundBranchName && foundBillDate) {
      return r;
    }
  }
  return 0;
}

/**
 * Extracts today's date from the worksheet header (e.g. "From DD/MM/YYYY to DD/MM/YYYY").
 * @param {object} worksheet 
 * @returns {string}
 */
export function extractTodayStrFromHeader(worksheet) {
  for (const key in worksheet) {
    if (key[0] === "!") continue;
    const cell = worksheet[key];
    if (cell && cell.v && typeof cell.v === "string") {
      const match = cell.v.match(/to\s+(\d{2}[/\-]\d{2}[/\-]\d{4})/i);
      if (match) {
        return match[1].replace(/-/g, "/");
      }
    }
  }
  return "";
}

/**
 * Derives the target date from either the worksheet header, the latest date in the data, or the current system date.
 * @param {object} worksheet 
 * @param {array} jsonData 
 * @returns {{ today: Date, todayStr: string }}
 */
export function getTargetDate(worksheet, jsonData) {
  let todayStr = extractTodayStrFromHeader(worksheet);
  let today;

  if (todayStr) {
    const [dayPart, monthPart, yearPart] = todayStr.split("/");
    today = new Date(Number(yearPart), Number(monthPart) - 1, Number(dayPart));
  } else {
    // Fallback: Find the latest date in the sheet data
    const dates = [];
    for (const row of jsonData) {
      const d = row["BILL DATE"];
      const parsed = parseBillDate(d);
      if (parsed) {
        dates.push({ str: d, date: parsed });
      }
    }
    if (dates.length > 0) {
      dates.sort((a, b) => b.date - a.date);
      todayStr = dates[0].str;
      today = dates[0].date;
    } else {
      // Ultimate fallback: system date
      today = new Date();
      const day = String(today.getDate()).padStart(2, "0");
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const year = today.getFullYear();
      todayStr = `${day}/${month}/${year}`;
    }
  }

  return { today, todayStr };
}
