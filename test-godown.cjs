const xlsx = require('xlsx');

const f2 = 'C:\\Users\\priya\\Downloads\\9afe08cb1b664f27b46f248efa3f82c5.xlsx';
const stockWb = xlsx.readFile(f2);
const stockSheet = stockWb.Sheets[stockWb.SheetNames[0]];

const stockData = xlsx.utils.sheet_to_json(stockSheet, { defval: '', range: 2 });
const b2 = stockData.filter(row => {
    return String(row['BARCODE']).includes('19004214') && String(row['BRANCH NAME']).includes('WMH006');
});
console.log('--- closing stock for 19004214 AND WMH006 ---');
console.log(b2);
