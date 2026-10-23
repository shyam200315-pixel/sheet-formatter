const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// 1. Read target (Neon) connection from backend/.env
const envPath = path.join(__dirname, '.env');
let newDbUrl = process.env.DATABASE_URL;

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const match = line.match(/^DATABASE_URL=(.+)$/);
    if (match) {
      newDbUrl = match[1].trim();
      break;
    }
  }
}

if (!newDbUrl) {
  console.error("ERROR: DATABASE_URL not found in environment or backend/.env");
  process.exit(1);
}

// 2. Old DB Config (Accepts OLD_DATABASE_URL or defaults to local PostgreSQL)
const oldDbConfig = process.env.OLD_DATABASE_URL 
  ? { connectionString: process.env.OLD_DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
      user: process.env.OLD_DB_USER || 'postgres',
      host: process.env.OLD_DB_HOST || 'localhost',
      database: process.env.OLD_DB_NAME || 'sheet_formatter',
      password: process.env.OLD_DB_PASSWORD || 'shyam@123',
      port: parseInt(process.env.OLD_DB_PORT || '5432', 10),
    };

async function migrate() {
  console.log("=== Starting Data Migration to Neon ===");
  const oldClient = new Client(oldDbConfig);
  const newClient = new Client({
    connectionString: newDbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("Connecting to source (old) database...");
    await oldClient.connect();
    console.log("✓ Connected to old database.");

    console.log("Connecting to target (Neon) database...");
    await newClient.connect();
    console.log("✓ Connected to Neon database.");

    // Check count in target
    const currentTargetCountRes = await newClient.query("SELECT COUNT(*) FROM sales_record");
    const currentTargetCount = parseInt(currentTargetCountRes.rows[0].count, 10);
    console.log(`Current rows in Neon sales_record: ${currentTargetCount}`);

    // Fetch from source
    console.log("Fetching sales_record rows from old database...");
    const salesRes = await oldClient.query("SELECT * FROM sales_record ORDER BY \"createdAt\" ASC");
    console.log(`Found ${salesRes.rows.length} rows in old sales_record.`);

    if (salesRes.rows.length > 0) {
      const BATCH_SIZE = 1000;
      let inserted = 0;

      for (let i = 0; i < salesRes.rows.length; i += BATCH_SIZE) {
        const batch = salesRes.rows.slice(i, i + BATCH_SIZE);
        
        // Build parameterized bulk insert query
        const values = [];
        const valuePlaceholders = [];
        let pIndex = 1;

        for (const row of batch) {
          valuePlaceholders.push(
            `($${pIndex}, $${pIndex + 1}, $${pIndex + 2}, $${pIndex + 3}, $${pIndex + 4}, $${pIndex + 5}, $${pIndex + 6}, $${pIndex + 7}, $${pIndex + 8}, $${pIndex + 9})`
          );
          values.push(
            row.id,
            row.store,
            row.date,
            row.amount,
            row.qty,
            row.bill,
            row.fileName,
            row.fileId,
            row.syncGroup,
            row.createdAt
          );
          pIndex += 10;
        }

        const insertQuery = `
          INSERT INTO sales_record (id, store, date, amount, qty, bill, "fileName", "fileId", "syncGroup", "createdAt")
          VALUES ${valuePlaceholders.join(', ')}
          ON CONFLICT (id) DO NOTHING
        `;

        await newClient.query(insertQuery, values);
        inserted += batch.length;
        console.log(`Migrated ${inserted} / ${salesRes.rows.length} sales_records...`);
      }
      console.log(`✓ Finished sales_record migration!`);
    }

    // Also migrate targets if any
    try {
      const targetsRes = await oldClient.query("SELECT * FROM target_setting");
      console.log(`Found ${targetsRes.rows.length} target settings in old database.`);
      for (const row of targetsRes.rows) {
        await newClient.query(
          `INSERT INTO target_setting (key, value, "updatedAt") VALUES ($1, $2, $3)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "updatedAt" = EXCLUDED."updatedAt"`,
          [row.key, row.value, row.updatedAt]
        );
      }
      if (targetsRes.rows.length > 0) console.log("✓ Migrated target_setting!");
    } catch (e) {
      console.log("Note on target_setting:", e.message);
    }

    // Also migrate deadstock if any
    try {
      const dsRes = await oldClient.query("SELECT * FROM dead_stock_record");
      console.log(`Found ${dsRes.rows.length} dead stock records in old database.`);
      if (dsRes.rows.length > 0) {
        // Similar batch insert if any exist
      }
    } catch (e) {
      console.log("Note on dead_stock_record:", e.message);
    }

    // Verify final count
    const finalCountRes = await newClient.query("SELECT COUNT(*) FROM sales_record");
    console.log(`\n🎉 Migration Complete! Total rows in Neon sales_record: ${finalCountRes.rows[0].count}`);

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await oldClient.end().catch(() => {});
    await newClient.end().catch(() => {});
  }
}

migrate();
