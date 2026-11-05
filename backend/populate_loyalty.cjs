const XLSX = require('xlsx');
const http = require('http');

async function run() {
  const filePath = 'C:/Users/priya/Downloads/10d05055d4954843883f186aa81f4fdc.xlsx';
  console.log('Reading Excel file:', filePath);
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(ws, { header: 1 });

  const headers = matrix[1];
  const branchCol = headers.indexOf('BRANCH NAME');
  const userCol = headers.indexOf('USER NAME');
  const salesmanCol = headers.indexOf('SALESMAN');
  const dateCol = headers.indexOf('BILL DATE');
  const timeCol = headers.indexOf('BILL TIME');
  const newVoucherCol = headers.indexOf('NEW VOUCHER NO.');
  const billCol = headers.indexOf('BILL NO.');
  const amountCol = headers.indexOf('NET SALE AMOUNT');
  const pointsCol = headers.indexOf('POINTS REDEEMED');
  const pointsCol2 = headers.indexOf('POINT REEDEEMED/DISCOUNT COUPON RS');
  const nameCol = headers.indexOf('RETAIL CUSTOMER FIRST NAME');
  const mobileCol = headers.indexOf('RETAIL CUSTOMER MOBILE NO.');

  console.log('Columns resolved. Total rows in matrix:', matrix.length);

  const billsMap = new Map();
  const fileId = 'historical_init_01apr_to_05nov_2026';
  const fileName = 'Master Collection (01 Apr to 05 Nov 2026)';

  for (let i = 2; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || !row[branchCol]) continue;

    const newVoucherNo = String(row[newVoucherCol] || '').trim();
    const rawBillNo = String(row[billCol] || '').trim();
    const billNo = newVoucherNo || rawBillNo || `BILL_${i}`;

    const store = String(row[branchCol] || '').trim();
    const salesman = String(row[salesmanCol] || '').trim();
    const userName = String(row[userCol] || '').trim();
    const rawDate = row[dateCol];
    const billTime = String(row[timeCol] || '').trim();

    // Format date as YYYY-MM-DD
    let formattedDate = null;
    if (rawDate) {
      const matchDmy = String(rawDate).trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (matchDmy) {
        formattedDate = `${matchDmy[3]}-${matchDmy[2].padStart(2, '0')}-${matchDmy[1].padStart(2, '0')}`;
      }
    }

    // Clean mobile number (10 digits)
    let rawMobile = String(row[mobileCol] || '').trim().replace(/\D/g, '');
    if (rawMobile.length > 10 && rawMobile.startsWith('91')) {
      rawMobile = rawMobile.slice(-10);
    }

    const customerName = String(row[nameCol] || '').trim();
    const netAmount = Number(row[amountCol]) || 0;
    const rawPoints = Number(row[pointsCol]) || Number(row[pointsCol2]) || 0;
    const pointsRedeemed = Math.abs(rawPoints);

    const billKey = `${store}___${billNo}`;

    if (!billsMap.has(billKey)) {
      billsMap.set(billKey, {
        billNo,
        billDate: formattedDate,
        billTime,
        store,
        salesman,
        userName,
        customerMobile: rawMobile || null,
        customerName: customerName || null,
        billAmount: netAmount,
        pointsRedeemed: pointsRedeemed,
        itemsCount: 1,
        _fileId: fileId,
        _fileName: fileName
      });
    } else {
      const existing = billsMap.get(billKey);
      existing.billAmount = Math.round((existing.billAmount + netAmount) * 100) / 100;
      existing.pointsRedeemed = Math.round((existing.pointsRedeemed + pointsRedeemed) * 100) / 100;
      existing.itemsCount += 1;
      if (!existing.customerMobile && rawMobile) existing.customerMobile = rawMobile;
      if (!existing.customerName && customerName) existing.customerName = customerName;
      if (!existing.salesman && salesman) existing.salesman = salesman;
      if (!existing.userName && userName) existing.userName = userName;
      if (!existing.billTime && billTime) existing.billTime = billTime;
    }
  }

  const bills = Array.from(billsMap.values());
  console.log(`Aggregation complete: ${matrix.length - 2} item rows aggregated into ${bills.length} unique bills!`);

  // Upload in chunks of 2,500 bills
  const chunkSize = 2500;
  const totalChunks = Math.ceil(bills.length / chunkSize);

  for (let c = 0; c < totalChunks; c++) {
    const chunk = bills.slice(c * chunkSize, (c + 1) * chunkSize);
    const isAppend = c > 0; // First chunk clears table, subsequent chunks append

    console.log(`Uploading chunk ${c + 1}/${totalChunks} (${chunk.length} bills)... isAppend: ${isAppend}`);
    await postChunkWithRetry(chunk, isAppend);
    console.log(`Chunk ${c + 1}/${totalChunks} successfully saved to Neon PostgreSQL!`);
  }

  console.log('SUCCESS: All 7 months of loyalty data successfully saved to database!');
}

async function postChunkWithRetry(data, isAppend, retries = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await postChunk(data, isAppend);
    } catch (err) {
      console.warn(`Attempt ${attempt}/${retries} failed: ${err.message}. Retrying in 3 seconds...`);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

function postChunk(data, isAppend) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ data, isAppend });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/sync/loyalty/upload',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body || '{}'));
        } else {
          reject(new Error(`Server error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

run().catch((err) => {
  console.error('Fatal script error:', err);
  process.exit(1);
});
