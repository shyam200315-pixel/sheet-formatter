const { Client } = require('pg');

const STORE_KEYS = ["STORE NAME", "BRANCH NAME", "FROM BRANCH NAME", "TO STORE", "BRANCH", "STORE"];
const QTY_KEYS = ["SOLD QTY", "QTY", "QUANTITY", "NET QTY", "TOTAL QTY", "SOLD QUANTITY"];
const AMOUNT_KEYS = ["NET AMOUNT", "SALES AMOUNT", "AMOUNT", "TOTAL", "NET SALE AMOUNT", "GROSS AMOUNT", "TOTAL AMOUNT", "NET SALES"];
const BILL_KEYS = [
  "NEW VOUCHER NO.", "NEW VOUCHER NO", "NEW VOUCHER_NO", "NEW VOUCHERNO",
  "NEW BILL NO.", "NEW BILL NO", "NEW INVOICE NO.", "NEW INVOICE NO",
  "VOUCHER NO.", "VOUCHER NO", "VOUCHER_NO", "VOUCHERNO", "VOUCHER",
  "BILL NO.", "BILL NO", "BILL_NO", "BILLNO", "BILL",
  "INVOICE NO.", "INVOICE NO", "INVOICE_NO", "INVOICE NUMBER", "BILL NUMBER", "VOUCHER NUMBER"
];
const DATE_KEYS = ["BILL DATE", "DATE", "BILLDATE", "INVOICE DATE", "TRANSACTION DATE"];

function getRowVal(row, candidateKeys) {
  if (!row || typeof row !== "object") return undefined;
  
  // 1. exact match
  for (const cand of candidateKeys) {
    if (row[cand] !== undefined && row[cand] !== null && row[cand] !== "") return row[cand];
  }
  
  const rKeys = Object.keys(row);
  
  // 2. case insensitive
  for (const cand of candidateKeys) {
    const target = cand.trim().toUpperCase();
    const found = rKeys.find(rk => rk.trim().toUpperCase() === target);
    if (found && row[found] !== undefined) return row[found];
  }
  
  // 3. strip spaces
  const cleanTargets = candidateKeys.map(c => c.replace(/[\s._\-]+/g, "").toUpperCase());
  for (const rk of rKeys) {
    const cleanRk = rk.replace(/[\s._\-]+/g, "").toUpperCase();
    if (cleanTargets.includes(cleanRk) && row[rk] !== undefined) return row[rk];
  }
  
  return undefined;
}

async function run() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'sheet_formatter',
    password: 'shyam@123',
    port: 5432,
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL");

    // TRUNCATE sales_record
    await client.query('TRUNCATE sales_record');
    console.log("Truncated sales_record");

    // Fetch old data
    const res = await client.query('SELECT * FROM sync_data');
    console.log(`Found ${res.rows.length} rows in sync_data`);

    for (const oldRow of res.rows) {
      const syncGroup = oldRow.id; // e.g. "historicalData"
      let parsedData = [];
      try {
         parsedData = typeof oldRow.data === 'string' ? JSON.parse(oldRow.data) : oldRow.data;
      } catch (e) {
         console.error("Failed to parse data for", syncGroup);
         continue;
      }

      console.log(`Processing syncGroup: ${syncGroup}, Items: ${parsedData.length}`);

      if (parsedData.length === 0) continue;

      // Map to new schema
      for (let i = 0; i < parsedData.length; i++) {
        const row = parsedData[i];
        let rawDate = getRowVal(row, DATE_KEYS);
        let formattedDate = null;
        if (rawDate !== null && rawDate !== undefined && rawDate !== "") {
          if (typeof rawDate === 'number') {
            const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
            if (!isNaN(d.getTime())) formattedDate = d.toISOString().split('T')[0];
          } else {
            const dateStr = String(rawDate).trim();
            const matchDmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+.*)?$/);
            if (matchDmy) {
              formattedDate = `${matchDmy[3]}-${matchDmy[2].padStart(2,'0')}-${matchDmy[1].padStart(2,'0')}`;
            } else {
              const matchYmd = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+.*)?$/);
              if (matchYmd) {
                formattedDate = `${matchYmd[1]}-${matchYmd[2].padStart(2,'0')}-${matchYmd[3].padStart(2,'0')}`;
              } else {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                  formattedDate = d.toISOString().split('T')[0];
                }
              }
            }
          }
        }

        const store = String(getRowVal(row, STORE_KEYS) || "");
        const qty = parseInt(getRowVal(row, QTY_KEYS)) || 0;
        const amount = parseFloat(getRowVal(row, AMOUNT_KEYS)) || 0;
        const bill = String(getRowVal(row, BILL_KEYS) || "");
        const fileName = row._fileName || "Manual Upload";
        const fileId = row._fileId || "legacy_default";

        // Insert into new table
        await client.query(`
          INSERT INTO sales_record ("syncGroup", "store", "date", "qty", "amount", "bill", "fileName", "fileId")
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [syncGroup, store, formattedDate, qty, amount, bill, fileName, fileId]);

        if (i % 1000 === 0) console.log(`Inserted ${i} records...`);
      }
      console.log(`Finished migrating ${syncGroup}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
