import { PageResponseDto } from '../dto/page-response.dto';
import { Page } from '../entities/page.entity';

export function toPageResponse(page: Page): PageResponseDto {
  return {
    id: page.id,
    title: page.title,
    description: page.description ?? null,
    content: page.content ?? null,
    contentFormat: page.contentFormat ?? 'html',
    tags: page.tags ?? [],
    spaceId: page.spaceId,
    sortOrder: page.sortOrder ?? 0,
    createdAt: page.createdAt.toISOString(),
    updatedAt: page.updatedAt.toISOString(),
  };
}

export function sortPages(pages: Page[]): Page[] {
  return [...pages].sort((left, right) => {
    const sortOrder = left.sortOrder - right.sortOrder;
    return sortOrder === 0 ? left.createdAt.getTime() - right.createdAt.getTime() : sortOrder;
  });
}
