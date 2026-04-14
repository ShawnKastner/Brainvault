import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Space } from './entities/space.entity';
import { SpacesService } from './spaces.service';

interface SpaceRepositoryMock {
  find: jest.Mock;
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  remove: jest.Mock;
}

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const updatedAt = new Date('2026-01-02T00:00:00.000Z');

function createSpace(overrides: Partial<Space> = {}): Space {
  return {
    id: '6f27ef68-7719-48da-9f58-8ca0605f5b22',
    name: 'Development',
    description: null,
    color: '#378ADD',
    sortOrder: 0,
    createdAt,
    updatedAt,
    pages: [],
    ...overrides,
  };
}

describe(SpacesService.name, () => {
  let repository: SpaceRepositoryMock;
  let service: SpacesService;

  beforeEach(() => {
    repository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((space) => space as Space),
      save: jest.fn(async (space) => createSpace(space)),
      remove: jest.fn(),
    };
    service = new SpacesService(repository as unknown as Repository<Space>);
  });

  it('maps spaces to response DTOs with nested pages', async () => {
    repository.find.mockResolvedValue([createSpace()]);

    await expect(service.findAll()).resolves.toEqual([
      {
        id: '6f27ef68-7719-48da-9f58-8ca0605f5b22',
        name: 'Development',
        description: null,
        color: '#378ADD',
        sortOrder: 0,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        pages: [],
      },
    ]);
  });

  it('normalizes create payloads', async () => {
    const result = await service.create({ name: ' Notes ', description: ' ', color: '#111111' });

    expect(repository.create).toHaveBeenCalledWith({
      name: 'Notes',
      description: null,
      color: '#111111',
      sortOrder: 0,
      pages: [],
    });
    expect(result.name).toBe('Notes');
  });

  it('throws when a space is missing', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
