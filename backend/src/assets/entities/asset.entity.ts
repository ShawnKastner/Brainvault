import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type AssetPreviewStatus = 'not_required' | 'pending' | 'processing' | 'ready' | 'failed';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 32, default: 'image' })
  type: string;

  @Column({ length: 120, unique: true })
  filename: string;

  @Column({ length: 255 })
  originalName: string;

  @Column({ length: 80 })
  contentType: string;

  @Column()
  size: number;

  @Column({ length: 24, default: 'not_required' })
  previewStatus: AssetPreviewStatus;

  @Column({ type: 'integer', nullable: true })
  previewSize: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  previewErrorCode: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  previewGeneratorVersion: string | null;

  @Column({ type: 'timestamp', nullable: true })
  previewUpdatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
