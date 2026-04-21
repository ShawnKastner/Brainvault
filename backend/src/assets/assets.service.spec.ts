import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { Repository } from 'typeorm';
import {
  AssetsService,
  isStoredImageFilename,
  isStoredPdfFilename,
  normalizeAssetOriginalName,
} from './assets.service';
import { Asset } from './entities/asset.entity';

interface AssetRepositoryMock {
  create: jest.Mock<Asset, [Partial<Asset>]>;
  save: jest.Mock<Promise<Asset>, [Asset]>;
  find: jest.Mock<Promise<Asset[]>, [unknown]>;
  findOne: jest.Mock<Promise<Asset | null>, [unknown]>;
  delete: jest.Mock<Promise<unknown>, [unknown]>;
}

const createdAt = new Date('2026-04-21T09:15:00.000Z');
const updatedAt = new Date('2026-04-21T09:16:00.000Z');
const pdfId = '11111111-1111-4111-8111-111111111111';
const unicodePdfName = 'info-pr\u00fcfungsvorbereitung.pdf';

function createAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: 'asset-1',
    type: 'image',
    filename: 'asset.png',
    originalName: 'asset.png',
    contentType: 'image/png',
    size: 4,
    createdAt,
    updatedAt,
    ...overrides,
  };
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
        createdAt,
        updatedAt,
      })),
      find: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    service = new AssetsService(
      {
        get: jest.fn((key: string, fallback: string | number) =>
          key === 'app.uploadDir' ? uploadDir : fallback,
        ),
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

  it('normalizes UTF-8 mojibake in uploaded asset names', () => {
    const mojibakeName = Buffer.from(unicodePdfName.normalize('NFD'), 'utf8').toString('latin1');

    expect(normalizeAssetOriginalName(mojibakeName)).toBe(unicodePdfName);
  });

  it('rejects images above the configured limit', async () => {
    service = new AssetsService(
      {
        get: jest.fn((key: string, fallback: string | number) => {
          if (key === 'app.uploadDir') return uploadDir;
          if (key === 'app.maxImageUploadBytes') return 2;
          return fallback;
        }),
      } as unknown as ConfigService,
      assetsRepo as unknown as Repository<Asset>,
    );

    await expect(
      service.saveImage({
        originalname: 'diagram.png',
        mimetype: 'image/png',
        size: 4,
        buffer: Buffer.from([1, 2, 3, 4]),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
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
    assetsRepo.findOne.mockResolvedValue(createAsset({
      filename,
      type: 'image',
      contentType: 'image/jpeg',
    }));
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
    assetsRepo.findOne.mockResolvedValue(createAsset({
      filename,
      type: 'image',
      contentType: 'image/png',
    }));

    await expect(service.openImage(filename)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('stores PDF files under a generated filename', async () => {
    const mojibakeName = Buffer.from(unicodePdfName.normalize('NFD'), 'utf8').toString('latin1');
    const response = await service.savePdf({
      originalname: mojibakeName,
      mimetype: 'application/pdf',
      size: 12,
      buffer: Buffer.from('%PDF-1.7\nbody'),
    });

    expect(response.url).toBe(`/api/assets/pdfs/${response.id}`);
    expect(response.filename).toMatch(/\.pdf$/);
    expect(isStoredPdfFilename(response.filename)).toBe(true);
    expect(response.createdAt).toBe(createdAt.toISOString());
    expect(assetsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'pdf',
        originalName: unicodePdfName,
        contentType: 'application/pdf',
        size: 12,
      }),
    );
    await expect(readFile(join(uploadDir, 'pdfs', response.filename))).resolves.toEqual(
      Buffer.from('%PDF-1.7\nbody'),
    );
    expect(response.originalName).toBe(unicodePdfName);
  });

  it('rejects invalid PDF uploads', async () => {
    await expect(
      service.savePdf({
        originalname: 'notes.txt',
        mimetype: 'text/plain',
        size: 5,
        buffer: Buffer.from('hello'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.savePdf({
        originalname: 'empty.pdf',
        mimetype: 'application/pdf',
        size: 0,
        buffer: Buffer.alloc(0),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.savePdf({
        originalname: 'fake.pdf',
        mimetype: 'application/pdf',
        size: 5,
        buffer: Buffer.from('hello'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects PDFs above the configured limit', async () => {
    service = new AssetsService(
      {
        get: jest.fn((key: string, fallback: string | number) => {
          if (key === 'app.uploadDir') return uploadDir;
          if (key === 'app.maxPdfUploadBytes') return 5;
          return fallback;
        }),
      } as unknown as ConfigService,
      assetsRepo as unknown as Repository<Asset>,
    );

    await expect(
      service.savePdf({
        originalname: 'large.pdf',
        mimetype: 'application/pdf',
        size: 12,
        buffer: Buffer.from('%PDF-1.7\nbody'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists only PDF assets newest first', async () => {
    const mojibakeName = Buffer.from(unicodePdfName.normalize('NFD'), 'utf8').toString('latin1');
    assetsRepo.find.mockResolvedValue([
      createAsset({
        id: pdfId,
        type: 'pdf',
        filename: '11111111-1111-4111-8111-111111111111.pdf',
        originalName: mojibakeName,
        contentType: 'application/pdf',
        size: 12,
      }),
    ]);

    await expect(service.listPdfs()).resolves.toEqual([
      {
        id: pdfId,
        url: `/api/assets/pdfs/${pdfId}`,
        filename: '11111111-1111-4111-8111-111111111111.pdf',
        originalName: unicodePdfName,
        contentType: 'application/pdf',
        size: 12,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    ]);
    expect(assetsRepo.find).toHaveBeenCalledWith({
      where: { type: 'pdf' },
      order: { createdAt: 'DESC' },
    });
  });

  it('opens stored PDFs with their content type and size', async () => {
    const filename = '11111111-1111-4111-8111-111111111111.pdf';
    assetsRepo.findOne.mockResolvedValue(createAsset({
      id: pdfId,
      filename,
      type: 'pdf',
      originalName: 'briefing.pdf',
      contentType: 'application/pdf',
      size: 12,
    }));
    await mkdir(join(uploadDir, 'pdfs'), { recursive: true });
    await writeFile(join(uploadDir, 'pdfs', filename), Buffer.from('%PDF-1.7\nbody'));

    const pdf = await service.openPdf(pdfId);

    expect(pdf.contentType).toBe('application/pdf');
    expect(pdf.filename).toBe(filename);
    expect(pdf.originalName).toBe('briefing.pdf');
    expect(pdf.size).toBe(12);
    expect(pdf.stream).toBeDefined();
    expect(assetsRepo.findOne).toHaveBeenCalledWith({ where: { id: pdfId, type: 'pdf' } });
  });

  it('rejects invalid and missing PDFs', async () => {
    await expect(service.openPdf('not-a-uuid')).rejects.toBeInstanceOf(BadRequestException);

    assetsRepo.findOne.mockResolvedValue(null);
    await expect(service.openPdf(pdfId)).rejects.toBeInstanceOf(NotFoundException);

    assetsRepo.findOne.mockResolvedValue(createAsset({
      id: pdfId,
      filename: '11111111-1111-4111-8111-111111111111.pdf',
      type: 'pdf',
      contentType: 'application/pdf',
    }));
    await expect(service.openPdf(pdfId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes PDF files and metadata', async () => {
    const filename = '11111111-1111-4111-8111-111111111111.pdf';
    assetsRepo.findOne.mockResolvedValue(createAsset({
      id: pdfId,
      filename,
      type: 'pdf',
      contentType: 'application/pdf',
    }));
    await mkdir(join(uploadDir, 'pdfs'), { recursive: true });
    await writeFile(join(uploadDir, 'pdfs', filename), Buffer.from('%PDF-1.7\nbody'));

    await service.deletePdf(pdfId);

    await expect(readFile(join(uploadDir, 'pdfs', filename))).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(assetsRepo.delete).toHaveBeenCalledWith({ id: pdfId, type: 'pdf' });
  });
});
