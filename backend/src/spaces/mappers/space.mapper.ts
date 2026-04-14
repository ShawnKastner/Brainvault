import { toPageResponse, sortPages } from '../../pages/mappers/page.mapper';
import { SpaceWithPagesResponseDto } from '../dto/space-response.dto';
import { Space } from '../entities/space.entity';

export function toSpaceWithPagesResponse(space: Space): SpaceWithPagesResponseDto {
  return {
    id: space.id,
    name: space.name,
    description: space.description ?? null,
    color: space.color,
    sortOrder: space.sortOrder ?? 0,
    createdAt: space.createdAt.toISOString(),
    updatedAt: space.updatedAt.toISOString(),
    pages: sortPages(space.pages ?? []).map(toPageResponse),
  };
}
