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
    parentId: space.parentId ?? null,
    createdAt: space.createdAt.toISOString(),
    updatedAt: space.updatedAt.toISOString(),
    pages: sortPages(space.pages ?? []).map(toPageResponse),
    children: sortSpaces(space.children ?? []).map(toSpaceWithPagesResponse),
  };
}

export function toSpaceTreeResponse(spaces: Space[]): SpaceWithPagesResponseDto[] {
  const childrenByParentId = groupSpacesByParentId(spaces);
  return buildSpaceResponses(childrenByParentId, null, new Set<string>());
}

export function toSpaceSubtreeResponse(
  spaces: Space[],
  id: string,
): SpaceWithPagesResponseDto | null {
  const root = spaces.find((space) => space.id === id);
  if (!root) return null;

  const childrenByParentId = groupSpacesByParentId(spaces);
  return buildSpaceResponse(root, childrenByParentId, new Set<string>());
}

export function sortSpaces(spaces: Space[]): Space[] {
  return [...spaces].sort((left, right) => {
    const order = (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
    if (order !== 0) return order;
    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

function groupSpacesByParentId(spaces: Space[]): Map<string | null, Space[]> {
  const childrenByParentId = new Map<string | null, Space[]>();

  for (const space of spaces) {
    const parentId = space.parentId ?? null;
    childrenByParentId.set(parentId, [...(childrenByParentId.get(parentId) ?? []), space]);
  }

  return childrenByParentId;
}

function buildSpaceResponses(
  childrenByParentId: Map<string | null, Space[]>,
  parentId: string | null,
  visited: Set<string>,
): SpaceWithPagesResponseDto[] {
  return sortSpaces(childrenByParentId.get(parentId) ?? []).map((space) =>
    buildSpaceResponse(space, childrenByParentId, visited),
  );
}

function buildSpaceResponse(
  space: Space,
  childrenByParentId: Map<string | null, Space[]>,
  visited: Set<string>,
): SpaceWithPagesResponseDto {
  if (visited.has(space.id)) {
    return {
      id: space.id,
      name: space.name,
      description: space.description ?? null,
      color: space.color,
      sortOrder: space.sortOrder ?? 0,
      parentId: space.parentId ?? null,
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt.toISOString(),
      pages: sortPages(space.pages ?? []).map(toPageResponse),
      children: [],
    };
  }

  const nextVisited = new Set(visited);
  nextVisited.add(space.id);

  return {
    id: space.id,
    name: space.name,
    description: space.description ?? null,
    color: space.color,
    sortOrder: space.sortOrder ?? 0,
    parentId: space.parentId ?? null,
    createdAt: space.createdAt.toISOString(),
    updatedAt: space.updatedAt.toISOString(),
    pages: sortPages(space.pages ?? []).map(toPageResponse),
    children: buildSpaceResponses(childrenByParentId, space.id, nextVisited),
  };
}
