import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateSpaceDto } from './dto/create-space.dto';
import { SpaceWithPagesResponseDto } from './dto/space-response.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { Space } from './entities/space.entity';
import { toSpaceWithPagesResponse } from './mappers/space.mapper';

@Injectable()
export class SpacesService {
  constructor(
    @InjectRepository(Space)
    private readonly spacesRepo: Repository<Space>,
  ) {}

  async findAll(): Promise<SpaceWithPagesResponseDto[]> {
    const spaces = await this.spacesRepo.find({
      relations: { pages: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return spaces.map(toSpaceWithPagesResponse);
  }

  async findOne(id: string): Promise<SpaceWithPagesResponseDto> {
    const space = await this.findEntity(id, true);
    return toSpaceWithPagesResponse(space);
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
    const space = this.spacesRepo.create({
      name: dto.name.trim(),
      description: normalizeNullableText(dto.description),
      color: dto.color ?? '#378ADD',
      sortOrder: dto.sortOrder ?? 0,
      pages: [],
    });

    const saved = await this.spacesRepo.save(space);
    return toSpaceWithPagesResponse({ ...saved, pages: [] });
  }

  async update(id: string, dto: UpdateSpaceDto): Promise<SpaceWithPagesResponseDto> {
    const space = await this.findEntity(id, true);

    if (dto.name !== undefined) space.name = dto.name.trim();
    if (dto.description !== undefined) space.description = normalizeNullableText(dto.description);
    if (dto.color !== undefined) space.color = dto.color;
    if (dto.sortOrder !== undefined) space.sortOrder = dto.sortOrder;

    const saved = await this.spacesRepo.save(space);
    return toSpaceWithPagesResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const space = await this.findEntity(id);
    await this.spacesRepo.remove(space);
  }
}

function normalizeNullableText(value?: string): string | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
