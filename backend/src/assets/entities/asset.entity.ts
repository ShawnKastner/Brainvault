import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
