import type { PageResponse } from './page.model';

export interface SpaceResponse {
  id: string;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SpaceWithPagesResponse extends SpaceResponse {
  pages: PageResponse[];
}

export interface CreateSpaceRequest {
  name: string;
  description?: string;
  color?: string;
  sortOrder?: number;
}

export type UpdateSpaceRequest = Partial<CreateSpaceRequest>;

export type Space = SpaceResponse;
export type SpaceWithPages = SpaceWithPagesResponse;
