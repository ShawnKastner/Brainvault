import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSpaceDto } from './dto/create-space.dto';
import { SpaceWithPagesResponseDto } from './dto/space-response.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { Space } from './entities/space.entity';
import { toSpaceSubtreeResponse, toSpaceTreeResponse } from './mappers/space.mapper';

@Injectable()
export class SpacesService {
  constructor(
    @InjectRepository(Space)
    private readonly spacesRepo: Repository<Space>,
  ) {}

  async findAll(): Promise<SpaceWithPagesResponseDto[]> {
    return toSpaceTreeResponse(await this.loadSpacesWithPages());
  }

  async findOne(id: string): Promise<SpaceWithPagesResponseDto> {
    const response = toSpaceSubtreeResponse(await this.loadSpacesWithPages(), id);
    if (!response) throw new NotFoundException(`Space ${id} nicht gefunden`);
    return response;
  }

  async findEntity(id: string, includePages = false): Promise<Space> {
    const space = await this.spacesRepo.findOne({
      where: { id },
      relations: includePages ? { pages: true } : undefined,
    });
    if (!space) throw new NotFoundException(`Space ${id} nicht gefunden`);
    return space;
  }

  async create(dto: CreateSpaceDto): Promise<SpaceWithPagesResponseDto> {
    const spaces = await this.loadSpaces();
    const parentId = this.resolveCreateParentId(dto.parentId, spaces);

    const space = this.spacesRepo.create({
      name: dto.name.trim(),
      description: normalizeNullableText(dto.description),
      color: dto.color ?? '#378ADD',
      sortOrder: dto.sortOrder ?? getNextSiblingSortOrder(spaces, parentId),
      parentId,
      pages: [],
      children: [],
    });

    const saved = await this.spacesRepo.save(space);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdateSpaceDto): Promise<SpaceWithPagesResponseDto> {
    const space = await this.findEntity(id, true);
    const spaces = dto.parentId !== undefined ? await this.loadSpaces() : [];

    if (dto.name !== undefined) space.name = dto.name.trim();
    if (dto.description !== undefined) space.description = normalizeNullableText(dto.description);
    if (dto.color !== undefined) space.color = dto.color;
    if (dto.parentId !== undefined) {
      const parentId = this.resolveUpdateParentId(id, dto.parentId, spaces);
      if (parentId !== space.parentId && dto.sortOrder === undefined) {
        space.sortOrder = getNextSiblingSortOrder(spaces, parentId, id);
      }
      space.parentId = parentId;
    }
    if (dto.sortOrder !== undefined) space.sortOrder = dto.sortOrder;

    const saved = await this.spacesRepo.save(space);
    return this.findOne(saved.id);
  }

  async remove(id: string): Promise<void> {
    const space = await this.findEntity(id);
    await this.spacesRepo.remove(space);
  }

  private async loadSpacesWithPages(): Promise<Space[]> {
    return this.spacesRepo.find({
      relations: { pages: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  private async loadSpaces(): Promise<Space[]> {
    return this.spacesRepo.find({
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  private resolveCreateParentId(parentId: string | null | undefined, spaces: Space[]): string | null {
    if (parentId === undefined || parentId === null) return null;
    if (!spaces.some((space) => space.id === parentId)) {
      throw new NotFoundException(`Parent-Space ${parentId} nicht gefunden`);
    }
    return parentId;
  }

  private resolveUpdateParentId(
    spaceId: string,
    parentId: string | null,
    spaces: Space[],
  ): string | null {
    if (parentId === null) return null;
    if (parentId === spaceId) {
      throw new BadRequestException('Ein Space kann nicht sein eigener Parent sein');
    }

    const parent = spaces.find((space) => space.id === parentId);
    if (!parent) throw new NotFoundException(`Parent-Space ${parentId} nicht gefunden`);

    let current: Space | undefined = parent;
    while (current) {
      if (current.id === spaceId) {
        throw new BadRequestException('Ein Space kann nicht unter einen eigenen Unterspace verschoben werden');
      }
      current = current.parentId ? spaces.find((space) => space.id === current?.parentId) : undefined;
    }

    return parentId;
  }
}

function normalizeNullableText(value?: string): string | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getNextSiblingSortOrder(
  spaces: Space[],
  parentId: string | null,
  excludedSpaceId?: string,
): number {
  const siblings = spaces.filter(
    (space) => (space.parentId ?? null) === parentId && space.id !== excludedSpaceId,
  );
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((space) => space.sortOrder ?? 0)) + 1;
}
