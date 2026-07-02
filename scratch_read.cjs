const XLSX = require("xlsx");
const fs = require("fs");

try {
  const workbook = XLSX.readFile("C:\\Users\\priya\\Downloads\\827e83fdc2c245e185d87fa58b2abf46.xlsx");
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
  console.log("Headers:");
  if (jsonData.length > 0) {
    console.log(Object.keys(jsonData[0]));
    console.log("First 3 rows:");
    console.log(jsonData.slice(0, 3));
  } else {
    console.log("No data found");
  }
} catch (err) {
  console.error("Error reading file:", err);
}
