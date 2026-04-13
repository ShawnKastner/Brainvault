export interface Page {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  tags: string[];
  spaceId: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePageDto {
  title: string;
  description?: string;
  content?: string;
  tags?: string[];
  spaceId: string;
  sortOrder?: number;
}

export type UpdatePageDto = Partial<CreatePageDto>;
