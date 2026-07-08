const xlsx = require('xlsx');

const f1 = 'C:\\Users\\priya\\Downloads\\barshi.xlsx';
const f2 = 'C:\\Users\\priya\\Downloads\\9afe08cb1b664f27b46f248efa3f82c5.xlsx';

function findRow(file) {
    try {
        const wb = xlsx.readFile(file);
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);
        console.log('\n--- Data in ' + file + ' for 19004214 ---');
        const result = data.filter(row => {
            return Object.values(row).some(val => String(val).includes('19004214'));
        });
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error('Error reading ' + file + ':', e);
    }
}

findRow(f1);
findRow(f2);
