import { Injectable, Inject, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SalesRecord } from './entities/sync.entity.js';
import { TargetSetting } from './entities/target.entity.js';
import { DeadStockRecord } from './entities/deadstock.entity.js';
import { LoyaltyAuditRecord } from './entities/loyalty.entity.js';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Subject } from 'rxjs';

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

const DS_STORE_KEYS = ["BRANCH NAME", "FROM BRANCH NAME", "STORE NAME", "BRANCH", "STORE", "LOCATION", "OUTLET"];
const DS_ITEM_KEYS = ["ITEM CODE", "BARCODE", "POS ITEM CODE", "HANA CODE", "ITEM NO", "PRODUCT CODE", "SKU", "ARTICLE CODE", "ITEM", "CODE"];
const DS_DESC_KEYS = ["ITEM DESCRIPTION", "DESCRIPTION", "MODEL NAME", "ITEM NAME", "PRODUCT NAME"];
const DS_CAT_KEYS = ["CATEGORY", "MAIN PRODUCT", "GROUP NAME", "GROUP"];
const DS_QTY_KEYS = ["NET QTY", "TOTAL QTY", "QTY", "SOLD QTY", "QUANTITY", "BILLED QTY", "NO OF QTY"];
const DS_AMOUNT_KEYS = ["NET SALE AMOUNT", "GROSS SALE AMOUNT", "AMOUNT", "NET AMOUNT", "SALES AMOUNT", "TOTAL AMOUNT"];
const DS_DATE_KEYS = ["BILL DATE", "DATE", "BILLDATE", "BILL_DATE", "VOUCHER DATE", "INVOICE DATE", "DOC DATE", "TRANSACTION DATE", "TRANS DATE", "POSTING DATE"];

@Injectable()
export class SyncService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(SalesRecord)
    private syncRepository: Repository<SalesRecord>,
    @InjectRepository(TargetSetting)
    private targetRepository: Repository<TargetSetting>,
    @InjectRepository(DeadStockRecord)
    private deadStockRepository: Repository<DeadStockRecord>,
    @InjectRepository(LoyaltyAuditRecord)
    private loyaltyRepository: Repository<LoyaltyAuditRecord>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

  public updates$ = new Subject<any>();

  async onApplicationBootstrap() {
    await this.runStartupMigration();
  }

  private async runStartupMigration() {
    try {
      const currentCount = await this.syncRepository.count();
      if (currentCount > 0) {
        console.log(`[Startup Migration] Database already populated (${currentCount} sales records). Skipping auto-migration.`);
        return;
      }

      const oldDbUrl = process.env.OLD_DATABASE_URL;
      if (!oldDbUrl) {
        console.log('[Startup Migration] New DB is empty, but no OLD_DATABASE_URL defined. Skipping auto-migration.');
        return;
      }

      console.log(`[Startup Migration] Empty database detected. Connecting to OLD_DATABASE_URL to migrate data...`);
      const { Client } = await import('pg');
      const oldClient = new Client({
        connectionString: oldDbUrl,
        ssl: { rejectUnauthorized: false },
      });

      await oldClient.connect();
      console.log('[Startup Migration] Connected to OLD_DATABASE_URL.');

      const salesRes = await oldClient.query('SELECT * FROM sales_record ORDER BY "createdAt" ASC');
      console.log(`[Startup Migration] Found ${salesRes.rows.length} rows in old database.`);

      if (salesRes.rows.length > 0) {
        const BATCH_SIZE = 1000;
        let inserted = 0;
        for (let i = 0; i < salesRes.rows.length; i += BATCH_SIZE) {
          const batch = salesRes.rows.slice(i, i + BATCH_SIZE);
          await this.syncRepository
            .createQueryBuilder()
            .insert()
            .into(SalesRecord)
            .values(batch)
            .orIgnore()
            .execute();
          inserted += batch.length;
          console.log(`[Startup Migration] Migrated ${inserted} / ${salesRes.rows.length} records...`);
        }
        console.log(`[Startup Migration] Successfully migrated ${inserted} sales records!`);
      }

      try {
        const targetRes = await oldClient.query('SELECT * FROM target_setting');
        if (targetRes.rows.length > 0) {
          for (const row of targetRes.rows) {
            await this.targetRepository.save(row);
          }
          console.log(`[Startup Migration] Migrated ${targetRes.rows.length} target settings!`);
        }
      } catch {
        // Table might not exist in old db
      }

      try {
        const dsRes = await oldClient.query('SELECT * FROM dead_stock_record');
        if (dsRes.rows.length > 0) {
          const BATCH_SIZE = 1000;
          for (let i = 0; i < dsRes.rows.length; i += BATCH_SIZE) {
            const batch = dsRes.rows.slice(i, i + BATCH_SIZE);
            await this.deadStockRepository
              .createQueryBuilder()
              .insert()
              .into(DeadStockRecord)
              .values(batch)
              .orIgnore()
              .execute();
          }
          console.log(`[Startup Migration] Migrated ${dsRes.rows.length} dead stock records!`);
        }
      } catch {
        // Table might not exist in old db
      }

      await oldClient.end();
      console.log('[Startup Migration] Migration finished cleanly.');
    } catch (err: any) {
      console.error('[Startup Migration Error]', err.message);
    }
  }

  private findColumnKey(sampleRow: any, candidateKeys: string[]) {
    if (!sampleRow || typeof sampleRow !== "object") return null;
    
    // 1. exact match
    for (const cand of candidateKeys) {
      if (sampleRow[cand] !== undefined && sampleRow[cand] !== null && sampleRow[cand] !== "") return cand;
    }
    
    const rKeys = Object.keys(sampleRow);
    
    // 2. case insensitive
    for (const cand of candidateKeys) {
      const target = cand.trim().toUpperCase();
      const found = rKeys.find(rk => rk.trim().toUpperCase() === target);
      if (found && sampleRow[found] !== undefined) return found;
    }
    
    // 3. strip spaces
    const cleanTargets = candidateKeys.map(c => c.replace(/[\s._\-]+/g, "").toUpperCase());
    for (const rk of rKeys) {
      const cleanRk = rk.replace(/[\s._\-]+/g, "").toUpperCase();
      if (cleanTargets.includes(cleanRk) && sampleRow[rk] !== undefined) return rk;
    }
    
    return null;
  }

  async saveData(id: string, data: any[], isAppend: boolean = false) {
    if (!isAppend) {
      await this.syncRepository.delete({ syncGroup: id });
    }

    if (!data || data.length === 0) return { success: true, updatedAt: new Date() };

    const schemaMap: Record<string, any> = {};

    const records = data.map(row => {
      const fileId = row._fileId || "legacy_default";
      if (!schemaMap[fileId]) {
        schemaMap[fileId] = {
           storeKey: this.findColumnKey(row, STORE_KEYS),
           qtyKey: this.findColumnKey(row, QTY_KEYS),
           amountKey: this.findColumnKey(row, AMOUNT_KEYS),
           dateKey: this.findColumnKey(row, DATE_KEYS),
           billKey: this.findColumnKey(row, BILL_KEYS)
        };
      }
      const { storeKey, qtyKey, amountKey, dateKey, billKey } = schemaMap[fileId];

      let rawDate = dateKey ? row[dateKey] : null;
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

      return this.syncRepository.create({
        syncGroup: id,
        store: storeKey ? String(row[storeKey] || "") : "",
        date: formattedDate,
        qty: qtyKey ? parseInt(row[qtyKey]) || 0 : 0,
        amount: amountKey ? parseFloat(row[amountKey]) || 0 : 0,
        bill: billKey ? String(row[billKey] || "") : "",
        fileName: row._fileName || "Manual Upload",
        fileId: fileId,
      });
    });

    // Bulk insert in chunks of 2000
    for (let i = 0; i < records.length; i += 2000) {
      await this.syncRepository.createQueryBuilder().insert().into(SalesRecord).values(records.slice(i, i + 2000)).execute();
    }

    await this.cacheManager.del(`sync_${id}`);
    this.updates$.next({ type: 'update' });
    return { success: true, updatedAt: new Date() };
  }

  async getData(id: string) {
    const records = await this.syncRepository.createQueryBuilder('sr')
      .where('sr.syncGroup = :id', { id })
      .select(['sr.store as store', 'sr.date as date', 'sr.qty as qty', 'sr.amount as amount', 'sr.bill as bill', 'sr.fileName as fileName', 'sr.fileId as fileId', 'sr.createdAt as createdAt'])
      .getRawMany();
    
    // Map it back to the exact format expected by frontend
    const data = records.map(r => ({
      "STORE NAME": r.store,
      "BILL DATE": r.date,
      "SOLD QTY": r.qty,
      "NET AMOUNT": r.amount,
      "BILL NO": r.bill,
      "_fileName": r.fileName || r.filename,
      "_fileId": r.fileId || r.fileid,
      "_uploadedAt": r.createdAt || r.createdat
    }));

    const result = {
      data,
      updatedAt: records.length > 0 ? records[records.length-1].createdAt : new Date()
    };

    return result;
  }

  async getMetadata(id: string) {
    const count = await this.syncRepository.count({ where: { syncGroup: id } });
    return { totalRows: count, updatedAt: count > 0 ? new Date() : null };
  }

  async clearData(id: string) {
    await this.syncRepository.delete({ syncGroup: id });
    await this.cacheManager.del(`sync_${id}`);
    this.updates$.next({ type: 'update' });
    return { success: true };
  }

  async deleteFile(id: string, fileId: string) {
    try {
      let result;
      if (fileId === 'legacy_default') {
        result = await this.syncRepository.createQueryBuilder()
          .delete()
          .from(SalesRecord)
          .where('syncGroup = :id', { id })
          .andWhere("(fileId IS NULL OR fileId = '' OR fileId = :legacy)", { legacy: 'legacy_default' })
          .execute();
      } else if (fileId.startsWith('file_name_')) {
        const actualFileName = fileId.replace('file_name_', '');
        result = await this.syncRepository.createQueryBuilder()
          .delete()
          .from(SalesRecord)
          .where('syncGroup = :id', { id })
          .andWhere('fileName = :fileName', { fileName: actualFileName })
          .execute();
      } else {
        result = await this.syncRepository.createQueryBuilder()
          .delete()
          .from(SalesRecord)
          .where('syncGroup = :id', { id })
          .andWhere('fileId = :fileId', { fileId })
          .execute();
      }
      console.log(`[DELETE FILE] syncGroup=${id}, fileId=${fileId}, affected=${result.affected}`);
      await this.cacheManager.del(`sync_${id}`);
      this.updates$.next({ type: 'update' });
      return { success: true, deletedCount: result.affected || 0 };
    } catch (err: any) {
      console.error("[DELETE FILE ERROR]", err);
      return { success: false, deletedCount: 0, error: err.message, stack: err.stack };
    }
  }

  async deleteByDate(id: string, date: string) {
    const result = await this.syncRepository.createQueryBuilder()
      .delete()
      .from(SalesRecord)
      .where('syncGroup = :id', { id })
      .andWhere('date = :date', { date })
      .execute();
    console.log(`[DELETE DATE] syncGroup=${id}, date=${date}, affected=${result.affected}`);
    await this.cacheManager.del(`sync_${id}`);
    this.updates$.next({ type: 'update' });
    return { success: true, deletedCount: result.affected || 0 };
  }

  async getTargets() {
    try {
      const record = await this.targetRepository.findOneBy({ key: 'monthly_targets' });
      if (!record || !record.value) {
        return null;
      }
      return JSON.parse(record.value);
    } catch (err: any) {
      console.error("[GET TARGETS ERROR]", err);
      return null;
    }
  }

  async saveTargets(targetsData: any) {
    try {
      const payloadString = JSON.stringify(targetsData);
      const saved = await this.targetRepository.save({
        key: 'monthly_targets',
        value: payloadString,
      });

      console.log(`[SAVE TARGETS] Targets updated at ${saved.updatedAt}`);
      // Broadcast target update to all connected clients via SSE
      this.updates$.next({ type: 'target_update', data: targetsData });
      return { success: true, data: targetsData, updatedAt: saved.updatedAt };
    } catch (err: any) {
      console.error("[SAVE TARGETS ERROR]", err);
      throw err;
    }
  }

  // =========================================================================
  // TABLE 2: DEAD STOCK SALES RECORD DEDICATED SYNC
  // =========================================================================

  async saveDeadStockData(data: any[], isAppend: boolean = false) {
    if (!isAppend) {
      await this.deadStockRepository.clear();
    }

    if (!data || data.length === 0) {
      await this.cacheManager.del('deadstock_data');
      this.updates$.next({ type: 'deadstock_update' });
      return { success: true, count: 0, updatedAt: new Date() };
    }

    const schemaMap: Record<string, any> = {};

    const records = data.map(row => {
      const fileId = row._fileId || "legacy_default";
      if (!schemaMap[fileId]) {
        schemaMap[fileId] = {
          storeKey: this.findColumnKey(row, DS_STORE_KEYS),
          itemKey: this.findColumnKey(row, DS_ITEM_KEYS),
          descKey: this.findColumnKey(row, DS_DESC_KEYS),
          catKey: this.findColumnKey(row, DS_CAT_KEYS),
          qtyKey: this.findColumnKey(row, DS_QTY_KEYS),
          amountKey: this.findColumnKey(row, DS_AMOUNT_KEYS),
          dateKey: this.findColumnKey(row, DS_DATE_KEYS)
        };
      }
      const { storeKey, itemKey, descKey, catKey, qtyKey, amountKey, dateKey } = schemaMap[fileId];

      let rawDate = dateKey ? row[dateKey] : null;
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
              if (!isNaN(d.getTime())) formattedDate = d.toISOString().split('T')[0];
            }
          }
        }
      }

      let itemCode = itemKey ? String(row[itemKey] || "").trim() : "";
      if (itemCode.endsWith(".0")) itemCode = itemCode.slice(0, -2);

      let rowAmount = 0;
      if (amountKey && !isNaN(Number(row[amountKey])) && Number(row[amountKey]) !== 0) {
        rowAmount = Number(row[amountKey]);
      } else {
        const altKey = this.findColumnKey(row, ["AMOUNT BEFORE TAX", "GROSS SALE AMOUNT", "SELLING RATE", "GROSS SALE", "TOTAL AMOUNT"]);
        if (altKey && !isNaN(Number(row[altKey]))) {
          rowAmount = Number(row[altKey]);
        }
      }

      return this.deadStockRepository.create({
        store: storeKey ? String(row[storeKey] || "").trim() : "",
        itemCode: itemCode,
        itemDesc: descKey ? String(row[descKey] || "").trim() : "",
        category: catKey ? String(row[catKey] || "").trim() : "",
        qty: qtyKey && !isNaN(Number(row[qtyKey])) ? Math.round(Number(row[qtyKey])) : 0,
        amount: rowAmount,
        date: formattedDate,
        fileName: row._fileName || "Uploaded File",
        fileId: fileId,
      });
    });

    // Chunked insert in batches of 2000 for maximum performance
    for (let i = 0; i < records.length; i += 2000) {
      await this.deadStockRepository.createQueryBuilder().insert().into(DeadStockRecord).values(records.slice(i, i + 2000)).execute();
    }

    await this.cacheManager.del('deadstock_data');
    this.updates$.next({ type: 'deadstock_update' });
    return { success: true, count: records.length, updatedAt: new Date() };
  }

  async getDeadStockData() {
    const records = await this.deadStockRepository.createQueryBuilder('ds')
      .orderBy('ds.date', 'ASC')
      .addOrderBy('ds.createdAt', 'ASC')
      .getMany();

    if (!records || records.length === 0) return [];

    const mapped = records.map(r => ({
      "BRANCH NAME": r.store,
      "ITEM CODE": r.itemCode,
      "ITEM DESCRIPTION": r.itemDesc,
      "CATEGORY": r.category,
      "NET QTY": r.qty,
      "NET SALE AMOUNT": r.amount ? Number(r.amount) : 0,
      "BILL DATE": r.date,
      "_fileName": r.fileName,
      "_fileId": r.fileId,
      "_uploadedAt": r.createdAt
    }));

    return mapped;
  }

  async getDeadStockMetadata() {
    const count = await this.deadStockRepository.count();
    const files = await this.deadStockRepository.createQueryBuilder('ds')
      .select('ds.fileId', 'fileId')
      .addSelect('ds.fileName', 'fileName')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ds.fileId')
      .addGroupBy('ds.fileName')
      .getRawMany();

    const latest = await this.deadStockRepository.createQueryBuilder('ds')
      .orderBy('ds.createdAt', 'DESC')
      .getOne();

    const dateRange = await this.deadStockRepository.createQueryBuilder('ds')
      .select('MIN(ds.date)', 'minDate')
      .addSelect('MAX(ds.date)', 'maxDate')
      .where('ds.date IS NOT NULL')
      .getRawOne();

    return {
      totalRows: count,
      totalRecords: count,
      minDate: dateRange?.minDate || null,
      maxDate: dateRange?.maxDate || null,
      files: files.map(f => ({ fileId: f.fileId, fileName: f.fileName, count: Number(f.count) })),
      updatedAt: latest ? latest.createdAt : null,
    };
  }

  async clearDeadStockData() {
    await this.deadStockRepository.clear();
    await this.cacheManager.del('deadstock_data');
    this.updates$.next({ type: 'deadstock_update' });
    return { success: true };
  }

  async deleteDeadStockFile(fileId: string) {
    const result = await this.deadStockRepository.createQueryBuilder()
      .delete()
      .from(DeadStockRecord)
      .where('fileId = :fileId', { fileId })
      .execute();
    await this.cacheManager.del('deadstock_data');
    this.updates$.next({ type: 'deadstock_update' });
    return { success: true, deletedCount: result.affected || 0 };
  }

  async deleteDeadStockByDate(date: string) {
    const result = await this.deadStockRepository.createQueryBuilder()
      .delete()
      .from(DeadStockRecord)
      .where('date = :date', { date })
      .execute();
    console.log(`[DELETE DEADSTOCK DATE] date=${date}, affected=${result.affected}`);
    await this.cacheManager.del('deadstock_data');
    this.updates$.next({ type: 'deadstock_update' });
    return { success: true, deletedCount: result.affected || 0 };
  }

  // =========================================================================
  // TABLE 3: LOYALTY & CUSTOMER AUDIT DEDICATED SYNC
  // =========================================================================

  async saveLoyaltyData(data: any[], isAppend: boolean = false) {
    if (!isAppend) {
      await this.loyaltyRepository.clear();
    }

    if (!data || data.length === 0) {
      this.updates$.next({ type: 'loyalty_update' });
      return { success: true, count: 0, updatedAt: new Date() };
    }

    const records = data.map(row => {
      const fileId = row._fileId || "loyalty_default";
      
      let formattedDate: string | null = null;
      const rawDate = row.billDate || row.date || row["BILL DATE"] || row["DATE"];
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
              if (!isNaN(d.getTime())) formattedDate = d.toISOString().split('T')[0];
            }
          }
        }
      }

      // Clean mobile number (keep digits only)
      let mobile = String(row.customerMobile || row["RETAIL CUSTOMER MOBILE NO."] || row["CUSTOMER MOBILE"] || row.mobile || "").trim();
      mobile = mobile.replace(/\D/g, '');
      if (mobile.length > 10 && mobile.startsWith('91')) {
        mobile = mobile.slice(-10);
      }

      const custName = String(row.customerName || row["RETAIL CUSTOMER FIRST NAME"] || row["CUSTOMER NAME"] || row.name || "").trim();
      const store = String(row.store || row["BRANCH NAME"] || row.branch || "").trim();
      const salesman = String(row.salesman || row["SALESMAN"] || row.salesPerson || "").trim();
      const userName = String(row.userName || row["USER NAME"] || "").trim();
      const billNo = String(row.billNo || row["BILL NO."] || row["NEW VOUCHER NO."] || row.bill || "").trim();
      const billTime = String(row.billTime || row["BILL TIME"] || "").trim();
      const billAmount = Number(row.billAmount || row["NET SALE AMOUNT"] || row.amount || 0) || 0;
      const pointsRedeemed = Number(row.pointsRedeemed || row["POINTS REDEEMED"] || 0) || 0;
      const itemsCount = Number(row.itemsCount || row.items || 1) || 1;

      return this.loyaltyRepository.create({
        billNo,
        billDate: formattedDate,
        billTime,
        store,
        salesman,
        userName,
        customerMobile: mobile || null,
        customerName: custName || null,
        billAmount,
        pointsRedeemed,
        itemsCount,
        fileName: row._fileName || "Daily Sales File",
        fileId: fileId,
      });
    });

    // Chunked insert in batches of 2000
    for (let i = 0; i < records.length; i += 2000) {
      await this.loyaltyRepository.createQueryBuilder().insert().into(LoyaltyAuditRecord).values(records.slice(i, i + 2000)).execute();
    }

    this.updates$.next({ type: 'loyalty_update' });
    return { success: true, count: records.length, updatedAt: new Date() };
  }

  async getLoyaltyData() {
    const records = await this.loyaltyRepository.createQueryBuilder('la')
      .orderBy('la.billDate', 'DESC')
      .addOrderBy('la.createdAt', 'DESC')
      .getMany();

    return records || [];
  }

  async getLoyaltyMetadata() {
    const count = await this.loyaltyRepository.count();
    const files = await this.loyaltyRepository.createQueryBuilder('la')
      .select('la.fileId', 'fileId')
      .addSelect('la.fileName', 'fileName')
      .addSelect('COUNT(*)', 'count')
      .groupBy('la.fileId')
      .addGroupBy('la.fileName')
      .getRawMany();

    const dateRange = await this.loyaltyRepository.createQueryBuilder('la')
      .select('MIN(la.billDate)', 'minDate')
      .addSelect('MAX(la.billDate)', 'maxDate')
      .where('la.billDate IS NOT NULL')
      .getRawOne();

    const uniqueMobiles = await this.loyaltyRepository.createQueryBuilder('la')
      .select('COUNT(DISTINCT la.customerMobile)', 'count')
      .where("la.customerMobile IS NOT NULL AND la.customerMobile != ''")
      .getRawOne();

    const latest = await this.loyaltyRepository.createQueryBuilder('la')
      .orderBy('la.createdAt', 'DESC')
      .getOne();

    return {
      totalRows: count,
      totalBills: count,
      uniqueMobiles: Number(uniqueMobiles?.count || 0),
      minDate: dateRange?.minDate || null,
      maxDate: dateRange?.maxDate || null,
      files: files.map(f => ({ fileId: f.fileId, fileName: f.fileName, count: Number(f.count) })),
      updatedAt: latest ? latest.createdAt : null,
    };
  }

  async clearLoyaltyData() {
    await this.loyaltyRepository.clear();
    this.updates$.next({ type: 'loyalty_update' });
    return { success: true };
  }

  async deleteLoyaltyByDate(date: string) {
    const result = await this.loyaltyRepository.createQueryBuilder()
      .delete()
      .from(LoyaltyAuditRecord)
      .where('billDate = :date', { date })
      .execute();
    this.updates$.next({ type: 'loyalty_update' });
    return { success: true, deletedCount: result.affected || 0 };
  }

  async deleteLoyaltyFile(fileId: string) {
    const result = await this.loyaltyRepository.createQueryBuilder()
      .delete()
      .from(LoyaltyAuditRecord)
      .where('fileId = :fileId', { fileId })
      .execute();
    this.updates$.next({ type: 'loyalty_update' });
    return { success: true, deletedCount: result.affected || 0 };
  }

  async getStorageStats() {
    let totalBytes = 0;
    let totalPretty = '0 MB';
    const tableMap: Record<string, { bytes: number; pretty: string; rowCount: number }> = {};

    try {
      const dbSizeRes = await this.syncRepository.query(
        'SELECT pg_database_size(current_database()) as bytes, pg_size_pretty(pg_database_size(current_database())) as pretty'
      );
      if (dbSizeRes && dbSizeRes[0]) {
        totalBytes = Number(dbSizeRes[0].bytes || 0);
        totalPretty = String(dbSizeRes[0].pretty || '0 MB');
      }

      const tableSizeRes = await this.syncRepository.query(`
        SELECT 
          relname as table_name,
          n_live_tup as row_count,
          pg_total_relation_size(relid) as bytes,
          pg_size_pretty(pg_total_relation_size(relid)) as pretty_size
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC;
      `);

      if (Array.isArray(tableSizeRes)) {
        for (const t of tableSizeRes) {
          tableMap[t.table_name] = {
            bytes: Number(t.bytes || 0),
            pretty: String(t.pretty_size || '0 KB'),
            rowCount: Number(t.row_count || 0)
          };
        }
      }
    } catch (e: any) {
      console.warn('Storage size query error:', e?.message);
    }

    const quotaBytes = 512 * 1024 * 1024; // 512 MB Free Tier limit
    const freeBytes = Math.max(0, quotaBytes - totalBytes);
    const freePretty = `${(freeBytes / (1024 * 1024)).toFixed(1)} MB`;
    const usedPercent = Number(((totalBytes / quotaBytes) * 100).toFixed(2));

    // Get files for Historical Sales
    const salesCount = await this.syncRepository.count({ where: { syncGroup: 'historicalData' } });
    const salesFilesRaw = await this.syncRepository.createQueryBuilder('sr')
      .where('sr.syncGroup = :id', { id: 'historicalData' })
      .select('sr.fileId', 'fileId')
      .addSelect('sr.fileName', 'fileName')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MIN(sr.date)', 'minDate')
      .addSelect('MAX(sr.date)', 'maxDate')
      .addSelect('MAX(sr.createdAt)', 'uploadedAt')
      .groupBy('sr.fileId')
      .addGroupBy('sr.fileName')
      .orderBy('MAX(sr.createdAt)', 'DESC')
      .getRawMany();

    // Get files for Dead Stock
    const deadStockCount = await this.deadStockRepository.count();
    const deadStockFilesRaw = await this.deadStockRepository.createQueryBuilder('ds')
      .select('ds.fileId', 'fileId')
      .addSelect('ds.fileName', 'fileName')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MIN(ds.date)', 'minDate')
      .addSelect('MAX(ds.date)', 'maxDate')
      .addSelect('MAX(ds.createdAt)', 'uploadedAt')
      .groupBy('ds.fileId')
      .addGroupBy('ds.fileName')
      .orderBy('MAX(ds.createdAt)', 'DESC')
      .getRawMany();

    // Targets count
    const targetCount = await this.targetRepository.count();

    // Loyalty Audit count
    const loyaltyCount = await this.loyaltyRepository.count();
    const loyaltyFilesRaw = await this.loyaltyRepository.createQueryBuilder('la')
      .select('la.fileId', 'fileId')
      .addSelect('la.fileName', 'fileName')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MIN(la.billDate)', 'minDate')
      .addSelect('MAX(la.billDate)', 'maxDate')
      .addSelect('MAX(la.createdAt)', 'uploadedAt')
      .groupBy('la.fileId')
      .addGroupBy('la.fileName')
      .orderBy('MAX(la.createdAt)', 'DESC')
      .getRawMany();

    const histBytes = tableMap['sales_record']?.bytes || (salesCount * 250);
    const dsBytes = tableMap['dead_stock_record']?.bytes || (deadStockCount * 300);
    const targetBytes = tableMap['target_settings']?.bytes || (targetCount * 1024);
    const loyaltyBytes = tableMap['loyalty_audit_record']?.bytes || (loyaltyCount * 280);
    const systemBytes = Math.max(0, totalBytes - (histBytes + dsBytes + targetBytes + loyaltyBytes));

    return {
      success: true,
      provider: 'Neon PostgreSQL Serverless',
      quotaBytes,
      quotaPretty: '512 MB',
      usedBytes: totalBytes,
      usedPretty: totalPretty,
      freeBytes,
      freePretty,
      usedPercent,
      systemOverhead: {
        bytes: systemBytes,
        pretty: `${(systemBytes / (1024 * 1024)).toFixed(1)} MB`,
        description: 'PostgreSQL Catalog, Indexes & System Schema Overhead'
      },
      features: [
        {
          id: 'historical-sales',
          title: 'Historical Sales Database',
          description: 'Bill-wise sales records for Dashboard analytics and Daily Sales Validator',
          table: 'sales_record',
          bytes: histBytes,
          pretty: tableMap['sales_record']?.pretty || `${(histBytes / (1024 * 1024)).toFixed(1)} MB`,
          rowCount: salesCount,
          percent: totalBytes > 0 ? Number(((histBytes / totalBytes) * 100).toFixed(1)) : 0,
          color: '#3b82f6', // Blue
          files: salesFilesRaw.map(f => ({
            fileId: f.fileId,
            fileName: f.fileName || 'Uploaded Sales File',
            count: Number(f.count || 0),
            minDate: f.minDate,
            maxDate: f.maxDate,
            uploadedAt: f.uploadedAt
          }))
        },
        {
          id: 'dead-stock-bestsellers',
          title: 'Dead Stock & Best Sellers Database',
          description: 'Item-wise sales data for Best Sellers ranking & Dead Stock Analyzer audits',
          table: 'dead_stock_record',
          bytes: dsBytes,
          pretty: tableMap['dead_stock_record']?.pretty || `${(dsBytes / (1024 * 1024)).toFixed(1)} MB`,
          rowCount: deadStockCount,
          percent: totalBytes > 0 ? Number(((dsBytes / totalBytes) * 100).toFixed(1)) : 0,
          color: '#a855f7', // Purple
          files: deadStockFilesRaw.map(f => ({
            fileId: f.fileId,
            fileName: f.fileName || 'Uploaded Item File',
            count: Number(f.count || 0),
            minDate: f.minDate,
            maxDate: f.maxDate,
            uploadedAt: f.uploadedAt
          }))
        },
        {
          id: 'loyalty-audit',
          title: 'Loyalty & Customer Audit Database',
          description: 'Bill-level customer and salesman records to detect suspicious repeat billing',
          table: 'loyalty_audit_record',
          bytes: loyaltyBytes,
          pretty: tableMap['loyalty_audit_record']?.pretty || `${(loyaltyBytes / (1024 * 1024)).toFixed(1)} MB`,
          rowCount: loyaltyCount,
          percent: totalBytes > 0 ? Number(((loyaltyBytes / totalBytes) * 100).toFixed(1)) : 0,
          color: '#ec4899', // Pink
          files: loyaltyFilesRaw.map(f => ({
            fileId: f.fileId,
            fileName: f.fileName || 'Daily Sales File',
            count: Number(f.count || 0),
            minDate: f.minDate,
            maxDate: f.maxDate,
            uploadedAt: f.uploadedAt
          }))
        },
        {
          id: 'store-targets',
          title: 'Store Commitments & Targets',
          description: 'Monthly store targets and commitments for MTD achievement tracking',
          table: 'target_settings',
          bytes: targetBytes,
          pretty: tableMap['target_settings']?.pretty || `${(targetBytes / 1024).toFixed(0)} KB`,
          rowCount: targetCount,
          percent: totalBytes > 0 ? Number(((targetBytes / totalBytes) * 100).toFixed(1)) : 0,
          color: '#f59e0b' // Amber
        }
      ]
    };
  }
}
