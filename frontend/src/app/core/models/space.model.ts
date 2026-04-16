import type { PageResponse } from './page.model';

export interface SpaceResponse {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpaceWithPagesResponse extends SpaceResponse {
  pages: PageResponse[];
  children: SpaceWithPagesResponse[];
}

export interface CreateSpaceRequest {
  name: string;
  description?: string;
  color?: string;
  sortOrder?: number;
  parentId?: string | null;
}

export type UpdateSpaceRequest = Partial<CreateSpaceRequest>;

export type Space = SpaceResponse;
export type SpaceWithPages = SpaceWithPagesResponse;
