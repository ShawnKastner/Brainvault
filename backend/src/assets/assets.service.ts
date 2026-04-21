import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream } from 'fs';
import { access, mkdir, unlink, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { basename, extname, join, resolve } from 'path';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';
import { Repository } from 'typeorm';
import { ImageUploadResponseDto } from './dto/image-upload-response.dto';
import { PdfAssetResponseDto } from './dto/pdf-asset-response.dto';
import { Asset } from './entities/asset.entity';

export interface UploadedImageFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
}

export type UploadedPdfFile = UploadedImageFile;

export interface StoredImage {
  stream: Readable;
  contentType: string;
}

export interface StoredPdf {
  stream: Readable;
  contentType: string;
  filename: string;
  originalName: string;
  size: number;
}

const IMAGE_TYPES = new Map<string, string>([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const IMAGE_EXTENSIONS = new Map<string, string>([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
]);

const STORED_IMAGE_PATTERN = /^[a-f0-9-]{36}\.(?:png|jpe?g|webp|gif)$/i;
const STORED_PDF_PATTERN = /^[a-f0-9-]{36}\.pdf$/i;
const PDF_CONTENT_TYPE = 'application/pdf';
const PDF_SIGNATURE = Buffer.from('%PDF-');
const UTF8_MOJIBAKE_MARKERS = /[ÃÂâÐÑÌ]/;

@Injectable()
export class AssetsService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Asset)
    private readonly assetsRepo: Repository<Asset>,
  ) {}

  async saveImage(file: UploadedImageFile): Promise<ImageUploadResponseDto> {
    if (file.size > this.maxImageUploadBytes()) {
      throw new BadRequestException('Die Bilddatei ist zu gross.');
    }

    const extension = IMAGE_TYPES.get(file.mimetype);
    if (!extension) {
      throw new BadRequestException('Nur PNG, JPEG, WebP und GIF Bilder sind erlaubt.');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Die Bilddatei ist leer oder konnte nicht gelesen werden.');
    }

    const filename = `${randomUUID()}${extension}`;
    const originalName = normalizeAssetOriginalName(file.originalname);
    const imagesDir = await this.ensureImagesDir();
    await writeFile(join(imagesDir, filename), file.buffer);
    const asset = await this.assetsRepo.save(
      this.assetsRepo.create({
        type: 'image',
        filename,
        originalName,
        contentType: file.mimetype,
        size: file.size,
      }),
    );

    return {
      id: asset.id,
      url: `/api/assets/images/${filename}`,
      filename,
      originalName,
      contentType: file.mimetype,
      size: file.size,
    };
  }

  async listPdfs(): Promise<PdfAssetResponseDto[]> {
    const assets = await this.assetsRepo.find({
      where: { type: 'pdf' },
      order: { createdAt: 'DESC' },
    });

    return assets.map(toPdfResponse);
  }

  async savePdf(file: UploadedPdfFile): Promise<PdfAssetResponseDto> {
    if (file.mimetype !== PDF_CONTENT_TYPE) {
      throw new BadRequestException('Nur PDF-Dateien sind erlaubt.');
    }

    if (file.size > this.maxPdfUploadBytes()) {
      throw new BadRequestException('Die PDF-Datei ist zu gross.');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Die PDF-Datei ist leer oder konnte nicht gelesen werden.');
    }

    if (!file.buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
      throw new BadRequestException('Die Datei ist keine gültige PDF-Datei.');
    }

    const filename = `${randomUUID()}.pdf`;
    const originalName = normalizeAssetOriginalName(file.originalname);
    const pdfsDir = await this.ensurePdfsDir();
    await writeFile(join(pdfsDir, filename), file.buffer);
    const asset = await this.assetsRepo.save(
      this.assetsRepo.create({
        type: 'pdf',
        filename,
        originalName,
        contentType: PDF_CONTENT_TYPE,
        size: file.size,
      }),
    );

    return toPdfResponse(asset);
  }

  async openPdf(id: string): Promise<StoredPdf> {
    const { asset, pdfPath } = await this.findReadablePdf(id);

    return {
      stream: createReadStream(pdfPath),
      contentType: asset.contentType,
      filename: asset.filename,
      originalName: normalizeAssetOriginalName(asset.originalName),
      size: asset.size,
    };
  }

  async ensurePdfReadable(id: string): Promise<void> {
    await this.findReadablePdf(id);
  }

  async deletePdf(id: string): Promise<void> {
    if (!isUuid(id)) {
      throw new BadRequestException('Ungültige PDF-ID.');
    }

    const asset = await this.assetsRepo.findOne({ where: { id, type: 'pdf' } });
    if (!asset) {
      throw new NotFoundException('PDF nicht gefunden.');
    }

    if (!isStoredPdfFilename(asset.filename)) {
      throw new BadRequestException('Ungültiger PDF-Name.');
    }

    const pdfPath = this.resolvePdfPath(asset.filename);

    try {
      await unlink(pdfPath);
    } catch (error) {
      if (!isFileMissingError(error)) throw error;
    }

    await this.assetsRepo.delete({ id, type: 'pdf' });
  }

  async openImage(filename: string): Promise<StoredImage> {
    if (!isStoredImageFilename(filename)) {
      throw new BadRequestException('Ungültiger Bildname.');
    }

    const asset = await this.assetsRepo.findOne({ where: { filename, type: 'image' } });
    if (!asset) {
      throw new NotFoundException('Bild nicht gefunden.');
    }

    const imagesDir = this.imagesDir();
    const imagePath = resolve(imagesDir, filename);
    if (!imagePath.startsWith(`${imagesDir}/`) || basename(imagePath) !== filename) {
      throw new BadRequestException('Ungültiger Bildname.');
    }

    try {
      await access(imagePath, constants.R_OK);
    } catch {
      throw new NotFoundException('Bild nicht gefunden.');
    }

    if (!IMAGE_EXTENSIONS.has(extname(filename).toLowerCase())) {
      throw new BadRequestException('Ungültiger Bildtyp.');
    }

    return {
      stream: createReadStream(imagePath),
      contentType: asset.contentType,
    };
  }

  async deleteImage(filename: string): Promise<void> {
    if (!isStoredImageFilename(filename)) {
      throw new BadRequestException('Ungültiger Bildname.');
    }

    const asset = await this.assetsRepo.findOne({ where: { filename, type: 'image' } });
    if (!asset) return;

    const imagesDir = this.imagesDir();
    const imagePath = resolve(imagesDir, filename);
    if (!imagePath.startsWith(`${imagesDir}/`) || basename(imagePath) !== filename) {
      throw new BadRequestException('Ungültiger Bildname.');
    }

    try {
      await unlink(imagePath);
    } catch (error) {
      if (!isFileMissingError(error)) throw error;
    }

    await this.assetsRepo.delete({ filename, type: 'image' });
  }

  private async ensureImagesDir(): Promise<string> {
    const imagesDir = this.imagesDir();
    await mkdir(imagesDir, { recursive: true });
    return imagesDir;
  }

  private async ensurePdfsDir(): Promise<string> {
    const pdfsDir = this.pdfsDir();
    await mkdir(pdfsDir, { recursive: true });
    return pdfsDir;
  }

  private imagesDir(): string {
    return resolve(this.config.get<string>('app.uploadDir', 'uploads'), 'images');
  }

  private pdfsDir(): string {
    return resolve(this.config.get<string>('app.uploadDir', 'uploads'), 'pdfs');
  }

  private resolvePdfPath(filename: string): string {
    const pdfsDir = this.pdfsDir();
    const pdfPath = resolve(pdfsDir, filename);
    if (!pdfPath.startsWith(`${pdfsDir}/`) || basename(pdfPath) !== filename) {
      throw new BadRequestException('Ungültiger PDF-Name.');
    }
    return pdfPath;
  }

  private async findReadablePdf(id: string): Promise<{ asset: Asset; pdfPath: string }> {
    if (!isUuid(id)) {
      throw new BadRequestException('Ungültige PDF-ID.');
    }

    const asset = await this.assetsRepo.findOne({ where: { id, type: 'pdf' } });
    if (!asset) {
      throw new NotFoundException('PDF nicht gefunden.');
    }

    if (!isStoredPdfFilename(asset.filename)) {
      throw new BadRequestException('Ungültiger PDF-Name.');
    }

    const pdfPath = this.resolvePdfPath(asset.filename);

    try {
      await access(pdfPath, constants.R_OK);
    } catch {
      throw new NotFoundException('PDF nicht gefunden.');
    }

    return { asset, pdfPath };
  }

  private maxImageUploadBytes(): number {
    return this.config.get<number>('app.maxImageUploadBytes', 5 * 1024 * 1024);
  }

  private maxPdfUploadBytes(): number {
    return this.config.get<number>('app.maxPdfUploadBytes', 25 * 1024 * 1024);
  }
}

export function isStoredImageFilename(filename: string): boolean {
  return STORED_IMAGE_PATTERN.test(filename);
}

export function isStoredPdfFilename(filename: string): boolean {
  return STORED_PDF_PATTERN.test(filename);
}

export function normalizeAssetOriginalName(originalName: string): string {
  const normalized = originalName.normalize('NFC');
  if (!UTF8_MOJIBAKE_MARKERS.test(normalized)) {
    return normalized;
  }

  const decoded = Buffer.from(normalized, 'latin1').toString('utf8');
  if (!decoded || decoded.includes('\uFFFD')) {
    return normalized;
  }

  return decoded.normalize('NFC');
}

function isFileMissingError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function isUuid(value: string): boolean {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(
    value,
  );
}

function toPdfResponse(asset: Asset): PdfAssetResponseDto {
  return {
    id: asset.id,
    url: `/api/assets/pdfs/${asset.id}`,
    filename: asset.filename,
    originalName: normalizeAssetOriginalName(asset.originalName),
    contentType: asset.contentType,
    size: asset.size,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
}
