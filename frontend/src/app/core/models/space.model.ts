import type { Page } from './page.model';

export interface Space {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SpaceWithPages extends Space {
  pages: Page[];
}

export interface CreateSpaceDto {
  name: string;
  description?: string;
  color?: string;
  sortOrder?: number;
}

export type UpdateSpaceDto = Partial<CreateSpaceDto>;
