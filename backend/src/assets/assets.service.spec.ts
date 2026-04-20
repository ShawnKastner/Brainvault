import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { Repository } from 'typeorm';
import { AssetsService, isStoredImageFilename } from './assets.service';
import { Asset } from './entities/asset.entity';

interface AssetRepositoryMock {
  create: jest.Mock<Asset, [Partial<Asset>]>;
  save: jest.Mock<Promise<Asset>, [Asset]>;
  findOne: jest.Mock<Promise<Asset | null>, [unknown]>;
}

describe(AssetsService.name, () => {
  let uploadDir: string;
  let service: AssetsService;
  let assetsRepo: AssetRepositoryMock;

  beforeEach(async () => {
    uploadDir = await mkdtemp(join(tmpdir(), 'brainvault-assets-'));
    assetsRepo = {
      create: jest.fn((asset: Partial<Asset>) => asset as Asset),
      save: jest.fn(async (asset: Asset) => ({
        ...asset,
        id: 'asset-1',
      })),
      findOne: jest.fn(),
    };
    service = new AssetsService(
      {
        get: jest.fn((key: string, fallback: string) => (key === 'app.uploadDir' ? uploadDir : fallback)),
      } as unknown as ConfigService,
      assetsRepo as unknown as Repository<Asset>,
    );
  });

  afterEach(async () => {
    await rm(uploadDir, { recursive: true, force: true });
  });

  it('stores allowed images under a generated filename', async () => {
    const response = await service.saveImage({
      originalname: 'diagram.png',
      mimetype: 'image/png',
      size: 4,
      buffer: Buffer.from([1, 2, 3, 4]),
    });

    expect(response.url).toBe(`/api/assets/images/${response.filename}`);
    expect(response.id).toBe('asset-1');
    expect(response.filename).toMatch(/\.png$/);
    expect(isStoredImageFilename(response.filename)).toBe(true);
    expect(assetsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'image',
        originalName: 'diagram.png',
        contentType: 'image/png',
        size: 4,
      }),
    );
    await expect(readFile(join(uploadDir, 'images', response.filename))).resolves.toEqual(
      Buffer.from([1, 2, 3, 4]),
    );
  });

  it('rejects unsupported image types', async () => {
    await expect(
      service.saveImage({
        originalname: 'vector.svg',
        mimetype: 'image/svg+xml',
        size: 10,
        buffer: Buffer.from('<svg></svg>'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('opens stored images with their content type', async () => {
    const filename = '11111111-1111-4111-8111-111111111111.jpg';
    assetsRepo.findOne.mockResolvedValue({
      filename,
      type: 'image',
      contentType: 'image/jpeg',
    } as Asset);
    await mkdir(join(uploadDir, 'images'), { recursive: true });
    await writeFile(join(uploadDir, 'images', filename), Buffer.from('image'));

    const image = await service.openImage(filename);

    expect(image.contentType).toBe('image/jpeg');
    expect(image.stream).toBeDefined();
    expect(assetsRepo.findOne).toHaveBeenCalledWith({ where: { filename, type: 'image' } });
  });

  it('rejects path traversal and missing files', async () => {
    await expect(service.openImage('../secret.png')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.openImage('11111111-1111-4111-8111-111111111111.png')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects missing image files even when metadata exists', async () => {
    const filename = '11111111-1111-4111-8111-111111111111.png';
    assetsRepo.findOne.mockResolvedValue({
      filename,
      type: 'image',
      contentType: 'image/png',
    } as Asset);

    await expect(service.openImage(filename)).rejects.toBeInstanceOf(NotFoundException);
  });
});
