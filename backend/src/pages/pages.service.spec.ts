import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Space } from '../spaces/entities/space.entity';
import { Page } from './entities/page.entity';
import { PagesService } from './pages.service';

interface PageRepositoryMock {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
}

interface SpaceRepositoryMock {
  existsBy: jest.Mock;
}

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');
const pageId = '50b0b4a7-5115-42c4-bd08-1698e8e5f7a8';
const spaceId = '6f27ef68-7719-48da-9f58-8ca0605f5b22';

function createPage(overrides: Partial<Page> = {}): Page {
  return {
    id: pageId,
    title: 'NestJS Architektur',
    description: null,
    content: null,
    contentFormat: 'markdown',
    tags: [],
    spaceId,
    space: {} as Space,
    sortOrder: 0,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

describe(PagesService.name, () => {
  let pagesRepo: PageRepositoryMock;
  let spacesRepo: SpaceRepositoryMock;
  let service: PagesService;

  beforeEach(() => {
    pagesRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((page) => page as Page),
      save: jest.fn(async (page) => createPage(page)),
      remove: jest.fn(),
    };
    spacesRepo = {
      existsBy: jest.fn(),
    };
    service = new PagesService(
      pagesRepo as unknown as Repository<Page>,
      spacesRepo as unknown as Repository<Space>,
    );
  });

  it('filters pages by space and maps response DTOs', async () => {
    pagesRepo.find.mockResolvedValue([createPage()]);

    await expect(service.findAll(spaceId)).resolves.toEqual([
      {
        id: pageId,
        title: 'NestJS Architektur',
        description: null,
        content: null,
        contentFormat: 'markdown',
        tags: [],
        spaceId,
        sortOrder: 0,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    ]);
    expect(pagesRepo.find).toHaveBeenCalledWith({
      where: { spaceId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  });

  it('verifies the target space before creating a page', async () => {
    spacesRepo.existsBy.mockResolvedValue(true);

    const result = await service.create({
      title: ' Notes ',
      description: ' ',
      content: ' Body ',
      tags: [' nestjs ', 'nestjs', ''],
      contentFormat: 'markdown',
      spaceId,
    });

    expect(spacesRepo.existsBy).toHaveBeenCalledWith({ id: spaceId });
    expect(pagesRepo.create).toHaveBeenCalledWith({
      title: 'Notes',
      description: null,
      content: 'Body',
      contentFormat: 'markdown',
      tags: ['nestjs'],
      spaceId,
      sortOrder: 0,
    });
    expect(result.title).toBe('Notes');
  });

  it('throws when creating a page for a missing space', async () => {
    spacesRepo.existsBy.mockResolvedValue(false);

    await expect(service.create({ title: 'Missing', spaceId })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
