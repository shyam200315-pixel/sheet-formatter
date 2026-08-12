const xlsx = require('xlsx');
const path = 'C:\\Users\\priya\\Downloads\\360b29e7e15145efa6f4c1afdfb7fd63.xlsx';

const workbook = xlsx.readFile(path);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

console.log("Headers:");
console.log(data[0]);

const rows = xlsx.utils.sheet_to_json(worksheet);
console.log("\nFirst 2 rows of data:");
console.log(rows.slice(0, 2));
