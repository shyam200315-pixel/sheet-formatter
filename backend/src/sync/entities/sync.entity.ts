import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';

@Entity('sales_record')
export class SalesRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  store: string | null;

  @Column({ type: 'date', nullable: true })
  @Index()
  date: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  amount: number | null;

  @Column({ type: 'int', nullable: true })
  qty: number | null;

  @Column({ type: 'varchar', nullable: true })
  bill: string | null;

  @Column({ type: 'varchar', nullable: true })
  fileName: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  fileId: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  syncGroup: string; // e.g. "historicalData"

  @CreateDateColumn()
  createdAt: Date;
}
