import { Entity, Column, PrimaryGeneratedColumn, Index, CreateDateColumn } from 'typeorm';

@Entity('loyalty_audit_record')
export class LoyaltyAuditRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  billNo: string | null;

  @Column({ type: 'date', nullable: true })
  @Index()
  billDate: string | null;

  @Column({ type: 'varchar', nullable: true })
  billTime: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  store: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  salesman: string | null;

  @Column({ type: 'varchar', nullable: true })
  userName: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  customerMobile: string | null;

  @Column({ type: 'varchar', nullable: true })
  customerName: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  billAmount: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  pointsRedeemed: number;

  @Column({ type: 'int', default: 1 })
  itemsCount: number;

  @Column({ type: 'varchar', nullable: true })
  fileName: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Index()
  fileId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
