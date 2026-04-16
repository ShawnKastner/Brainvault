import { BadRequestException, NotFoundException } from '@nestjs/common';
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
const rootId = '6f27ef68-7719-48da-9f58-8ca0605f5b22';
const childId = '19857af6-3429-4d22-aaf3-af4794df5051';
const grandchildId = 'fa54a4ff-1a54-4d7f-a7eb-fb762cd44f6e';

function createSpace(overrides: Partial<Space> = {}): Space {
  return {
    id: rootId,
    name: 'Development',
    description: null,
    color: '#378ADD',
    sortOrder: 0,
    parentId: null,
    parent: null,
    children: [],
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

  it('maps spaces to recursive response DTOs', async () => {
    repository.find.mockResolvedValue([
      createSpace({ id: rootId, name: 'Development', parentId: null }),
      createSpace({ id: childId, name: 'Backend', parentId: rootId }),
    ]);

    await expect(service.findAll()).resolves.toEqual([
      {
        id: rootId,
        name: 'Development',
        description: null,
        color: '#378ADD',
        sortOrder: 0,
        parentId: null,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        pages: [],
        children: [
          {
            id: childId,
            name: 'Backend',
            description: null,
            color: '#378ADD',
            sortOrder: 0,
            parentId: rootId,
            createdAt: createdAt.toISOString(),
            updatedAt: updatedAt.toISOString(),
            pages: [],
            children: [],
          },
        ],
      },
    ]);
  });

  it('normalizes create payloads', async () => {
    const savedSpace = createSpace({
      name: 'Notes',
      color: '#111111',
      parentId: null,
    });
    repository.find
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([savedSpace]);
    repository.save.mockResolvedValue(savedSpace);

    const result = await service.create({ name: ' Notes ', description: ' ', color: '#111111' });

    expect(repository.create).toHaveBeenCalledWith({
      name: 'Notes',
      description: null,
      color: '#111111',
      sortOrder: 0,
      parentId: null,
      pages: [],
      children: [],
    });
    expect(result.name).toBe('Notes');
  });

  it('creates child spaces under an existing parent', async () => {
    const savedSpace = createSpace({
      id: childId,
      name: 'Backend',
      parentId: rootId,
    });
    repository.find
      .mockResolvedValueOnce([createSpace({ id: rootId })])
      .mockResolvedValueOnce([createSpace({ id: rootId }), savedSpace]);
    repository.save.mockResolvedValue(savedSpace);

    const result = await service.create({ name: 'Backend', parentId: rootId });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Backend',
        parentId: rootId,
      }),
    );
    expect(result.parentId).toBe(rootId);
  });

  it('moves spaces while blocking hierarchy cycles', async () => {
    repository.findOne.mockResolvedValue(createSpace({ id: rootId, parentId: null }));
    repository.find.mockResolvedValue([
      createSpace({ id: rootId, parentId: null }),
      createSpace({ id: childId, parentId: rootId }),
      createSpace({ id: grandchildId, parentId: childId }),
    ]);

    await expect(service.update(rootId, { parentId: grandchildId })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('throws when a space is missing', async () => {
    repository.find.mockResolvedValue([]);

    await expect(service.findOne(rootId)).rejects.toBeInstanceOf(NotFoundException);
  });
});
