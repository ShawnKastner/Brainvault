import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { AssetsService } from '../assets/assets.service';
import { Space } from '../spaces/entities/space.entity';
import { CreatePageDto } from './dto/create-page.dto';
import { PageResponseDto } from './dto/page-response.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { Page } from './entities/page.entity';
import { toPageResponse } from './mappers/page.mapper';

@Injectable()
export class PagesService {
  constructor(
    @InjectRepository(Page)
    private readonly pagesRepo: Repository<Page>,
    @InjectRepository(Space)
    private readonly spacesRepo: Repository<Space>,
    private readonly assetsService: AssetsService,
  ) {}

  async findAll(spaceId?: string): Promise<PageResponseDto[]> {
    const pages = await this.pagesRepo.find({
      where: spaceId ? { spaceId } : undefined,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return pages.map(toPageResponse);
  }

  async findOne(id: string): Promise<PageResponseDto> {
    const page = await this.findEntity(id);
    return toPageResponse(page);
  }

  async findEntity(id: string): Promise<Page> {
    const page = await this.pagesRepo.findOne({ where: { id } });
    if (!page) throw new NotFoundException(`Page ${id} nicht gefunden`);
    return page;
  }

  async create(dto: CreatePageDto): Promise<PageResponseDto> {
    await this.assertSpaceExists(dto.spaceId);

    const page = this.pagesRepo.create({
      title: dto.title.trim(),
      description: normalizeNullableText(dto.description),
      content: normalizeNullableText(dto.content),
      contentFormat: dto.contentFormat ?? 'html',
      tags: normalizeTags(dto.tags),
      spaceId: dto.spaceId,
      sortOrder: dto.sortOrder ?? 0,
    });

    return toPageResponse(await this.pagesRepo.save(page));
  }

  async update(id: string, dto: UpdatePageDto): Promise<PageResponseDto> {
    const page = await this.findEntity(id);
    const previousContent = page.content;

    if (dto.spaceId !== undefined) {
      await this.assertSpaceExists(dto.spaceId);
      page.spaceId = dto.spaceId;
    }
    if (dto.title !== undefined) page.title = dto.title.trim();
    if (dto.description !== undefined) page.description = normalizeNullableText(dto.description);
    if (dto.content !== undefined) page.content = normalizeNullableText(dto.content);
    if (dto.contentFormat !== undefined) page.contentFormat = dto.contentFormat;
    if (dto.tags !== undefined) page.tags = normalizeTags(dto.tags);
    if (dto.sortOrder !== undefined) page.sortOrder = dto.sortOrder;

    const savedPage = await this.pagesRepo.save(page);
    await this.deleteImagesRemovedFromContent(previousContent, savedPage.content);

    return toPageResponse(savedPage);
  }

  async remove(id: string): Promise<void> {
    const page = await this.findEntity(id);
    const previousContent = page.content;
    await this.pagesRepo.remove(page);
    await this.deleteUnreferencedImages(extractStoredImageFilenames(previousContent));
  }

  private async assertSpaceExists(spaceId: string): Promise<void> {
    const exists = await this.spacesRepo.existsBy({ id: spaceId });
    if (!exists) throw new NotFoundException(`Space ${spaceId} nicht gefunden`);
  }

  private async deleteImagesRemovedFromContent(
    previousContent: string | null,
    nextContent: string | null,
  ): Promise<void> {
    const nextImages = new Set(extractStoredImageFilenames(nextContent));
    const removedImages = extractStoredImageFilenames(previousContent).filter(
      (filename) => !nextImages.has(filename),
    );

    await this.deleteUnreferencedImages(removedImages);
  }

  private async deleteUnreferencedImages(filenames: string[]): Promise<void> {
    for (const filename of new Set(filenames)) {
      const stillReferenced = await this.pagesRepo.exists({
        where: {
          content: Like(`%/api/assets/images/${filename}%`),
        },
      });

      if (!stillReferenced) {
        await this.assetsService.deleteImage(filename);
      }
    }
  }
}

function normalizeNullableText(value?: string): string | null {
  if (value === undefined) return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeTags(tags?: string[]): string[] {
  if (!tags) return [];
  return [...new Set(tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0))];
}

const STORED_IMAGE_URL_PATTERN =
  /\/api\/assets\/images\/([a-f0-9-]{36}\.(?:png|jpe?g|webp|gif))/gi;

export function extractStoredImageFilenames(content: string | null | undefined): string[] {
  if (!content) return [];

  const filenames = new Set<string>();
  for (const match of content.matchAll(STORED_IMAGE_URL_PATTERN)) {
    filenames.add(match[1].toLowerCase());
  }

  return [...filenames];
}
