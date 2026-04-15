import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { SettingScopeType, SettingTheme } from '../settings.constants';

@Entity('app_settings')
@Index(['scopeType', 'scopeId'], { unique: true })
export class AppSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 32 })
  scopeType: SettingScopeType;

  @Column({ length: 100 })
  scopeId: string;

  @Column({ length: 20, default: 'classic' })
  theme: SettingTheme;

  @Column({ default: false })
  compactNavigation: boolean;

  @Column({ default: true })
  showReadingStats: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
