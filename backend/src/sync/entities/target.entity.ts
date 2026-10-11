import { Entity, Column, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('target_settings')
export class TargetSetting {
  @PrimaryColumn({ type: 'varchar' })
  key: string;

  @Column({ type: 'text' })
  value: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
