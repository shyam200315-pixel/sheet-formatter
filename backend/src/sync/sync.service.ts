import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SalesRecord } from './entities/sync.entity.js';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

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

@Injectable()
export class SyncService {
  constructor(
    @InjectRepository(SalesRecord)
    private syncRepository: Repository<SalesRecord>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache
  ) {}

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
    return { success: true, deletedCount: result.affected || 0 };
  }
}
