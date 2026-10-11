import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';

@Entity('dead_stock_record')
export class DeadStockRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  store: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  itemCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  itemDesc: string | null;

  @Column({ type: 'varchar', nullable: true })
  category: string | null;

  @Column({ type: 'int', nullable: true })
  qty: number | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  amount: number | null;

  @Column({ type: 'date', nullable: true })
  @Index()
  date: string | null;

  @Column({ type: 'varchar', nullable: true })
  fileName: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  fileId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
