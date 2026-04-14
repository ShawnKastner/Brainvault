import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Space } from '../../spaces/entities/space.entity';

export const PAGE_CONTENT_FORMATS = ['html', 'markdown'] as const;
export type PageContentFormat = (typeof PAGE_CONTENT_FORMATS)[number];

@Entity('pages')
export class Page {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ length: 20, default: 'html' })
  contentFormat: PageContentFormat;

  @Column('text', { array: true, default: '{}' })
  tags: string[];

  @Column()
  spaceId: string;

  @ManyToOne(() => Space, (space) => space.pages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'spaceId' })
  space: Space;

  @Column({ default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
