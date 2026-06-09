import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createReadStream } from 'fs';
import { access, mkdir, unlink, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { basename, extname, join, resolve } from 'path';
import { randomUUID } from 'crypto';
import type { Readable } from 'stream';
import { In, Repository } from 'typeorm';
import { FileAssetResponseDto } from './dto/file-asset-response.dto';
import { ImageUploadResponseDto } from './dto/image-upload-response.dto';
import { PdfAssetResponseDto } from './dto/pdf-asset-response.dto';
import { Asset } from './entities/asset.entity';

export interface UploadedImageFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
}

export type UploadedStorageFile = UploadedImageFile;
export type UploadedPdfFile = UploadedImageFile;

export interface StoredImage {
  stream: Readable;
  contentType: string;
}

export interface StoredFile {
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
const STORED_FILE_PATTERN = /^[a-f0-9-]{36}\.(?:pdf|docx?|xlsx?|pptx?)$/i;
const PDF_CONTENT_TYPE = 'application/pdf';
const PDF_SIGNATURE = Buffer.from('%PDF-');
const ZIP_SIGNATURES = [
  Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  Buffer.from([0x50, 0x4b, 0x05, 0x06]),
  Buffer.from([0x50, 0x4b, 0x07, 0x08]),
];
const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const FILE_TYPES = new Map<string, { extension: string; contentTypes: string[]; signature: 'pdf' | 'zip' | 'ole' }>([
  ['.pdf', { extension: '.pdf', contentTypes: [PDF_CONTENT_TYPE], signature: 'pdf' }],
  ['.doc', { extension: '.doc', contentTypes: ['application/msword'], signature: 'ole' }],
  ['.docx', { extension: '.docx', contentTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], signature: 'zip' }],
  ['.xls', { extension: '.xls', contentTypes: ['application/vnd.ms-excel'], signature: 'ole' }],
  ['.xlsx', { extension: '.xlsx', contentTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'], signature: 'zip' }],
  ['.ppt', { extension: '.ppt', contentTypes: ['application/vnd.ms-powerpoint'], signature: 'ole' }],
  ['.pptx', { extension: '.pptx', contentTypes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'], signature: 'zip' }],
]);
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

  async listFiles(): Promise<FileAssetResponseDto[]> {
    const assets = await this.assetsRepo.find({
      where: { type: In(['file', 'pdf']) },
      order: { createdAt: 'DESC' },
    });

    return assets.map(toFileResponse);
  }

  async saveFile(file: UploadedStorageFile): Promise<FileAssetResponseDto> {
    const extension = extname(file.originalname).toLowerCase();
    const fileType = FILE_TYPES.get(extension);
    if (!fileType || ![...fileType.contentTypes, 'application/octet-stream', ''].includes(file.mimetype)) {
      throw new BadRequestException('Nur PDF-, Word-, Excel- und PowerPoint-Dateien sind erlaubt.');
    }

    if (file.size > this.maxPdfUploadBytes()) {
      throw new BadRequestException('Die Datei ist zu gross.');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Die Datei ist leer oder konnte nicht gelesen werden.');
    }

    if (!hasExpectedSignature(file.buffer, fileType.signature)) {
      throw new BadRequestException('Der Dateiinhalt entspricht nicht dem angegebenen Dateiformat.');
    }

    const filename = `${randomUUID()}${fileType.extension}`;
    const originalName = normalizeAssetOriginalName(file.originalname);
    const filesDir = await this.ensureFilesDir();
    await writeFile(join(filesDir, filename), file.buffer);
    const asset = await this.assetsRepo.save(
      this.assetsRepo.create({
        type: 'file',
        filename,
        originalName,
        contentType: fileType.contentTypes[0],
        size: file.size,
      }),
    );

    return toFileResponse(asset);
  }

  async openFile(id: string): Promise<StoredFile> {
    const { asset, filePath } = await this.findReadableFile(id);

    return {
      stream: createReadStream(filePath),
      contentType: asset.contentType,
      filename: asset.filename,
      originalName: normalizeAssetOriginalName(asset.originalName),
      size: asset.size,
    };
  }

  async ensureFileReadable(id: string): Promise<void> {
    await this.findReadableFile(id);
  }

  async deleteFile(id: string): Promise<void> {
    if (!isUuid(id)) {
      throw new BadRequestException('Ungültige Datei-ID.');
    }

    const asset = await this.assetsRepo.findOne({ where: { id, type: In(['file', 'pdf']) } });
    if (!asset) {
      throw new NotFoundException('Datei nicht gefunden.');
    }

    if (!isStoredFileFilename(asset.filename)) {
      throw new BadRequestException('Ungültiger Dateiname.');
    }

    const filePath = this.resolveFilePath(asset);
    try {
      await unlink(filePath);
    } catch (error) {
      if (!isFileMissingError(error)) throw error;
    }

    await this.assetsRepo.delete({ id });
  }

  // Compatibility methods for existing clients using the PDF-only API.
  async listPdfs(): Promise<PdfAssetResponseDto[]> {
    return (await this.listFiles())
      .filter((file) => file.contentType === PDF_CONTENT_TYPE)
      .map((file) => ({ ...file, url: `/api/assets/pdfs/${file.id}` }));
  }

  async savePdf(file: UploadedPdfFile): Promise<PdfAssetResponseDto> {
    if (file.mimetype !== PDF_CONTENT_TYPE || extname(file.originalname).toLowerCase() !== '.pdf') {
      throw new BadRequestException('Nur PDF-Dateien sind erlaubt.');
    }
    const response = await this.saveFile(file);
    return { ...response, url: `/api/assets/pdfs/${response.id}` };
  }

  async openPdf(id: string): Promise<StoredFile> {
    return this.openFile(id);
  }

  async ensurePdfReadable(id: string): Promise<void> {
    await this.ensureFileReadable(id);
  }

  async deletePdf(id: string): Promise<void> {
    await this.deleteFile(id);
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

  private async ensureFilesDir(): Promise<string> {
    const filesDir = this.filesDir();
    await mkdir(filesDir, { recursive: true });
    return filesDir;
  }

  private imagesDir(): string {
    return resolve(this.config.get<string>('app.uploadDir', 'uploads'), 'images');
  }

  private filesDir(): string {
    return resolve(this.config.get<string>('app.uploadDir', 'uploads'), 'files');
  }

  private pdfsDir(): string {
    return resolve(this.config.get<string>('app.uploadDir', 'uploads'), 'pdfs');
  }

  private resolveFilePath(asset: Asset): string {
    const directory = asset.type === 'pdf' ? this.pdfsDir() : this.filesDir();
    const filePath = resolve(directory, asset.filename);
    if (!filePath.startsWith(`${directory}/`) || basename(filePath) !== asset.filename) {
      throw new BadRequestException('Ungültiger Dateiname.');
    }
    return filePath;
  }

  private async findReadableFile(id: string): Promise<{ asset: Asset; filePath: string }> {
    if (!isUuid(id)) {
      throw new BadRequestException('Ungültige Datei-ID.');
    }

    const asset = await this.assetsRepo.findOne({ where: { id, type: In(['file', 'pdf']) } });
    if (!asset) {
      throw new NotFoundException('Datei nicht gefunden.');
    }

    if (!isStoredFileFilename(asset.filename)) {
      throw new BadRequestException('Ungültiger Dateiname.');
    }

    const filePath = this.resolveFilePath(asset);
    try {
      await access(filePath, constants.R_OK);
    } catch {
      throw new NotFoundException('Datei nicht gefunden.');
    }

    return { asset, filePath };
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

export function isStoredFileFilename(filename: string): boolean {
  return STORED_FILE_PATTERN.test(filename);
}

export function isStoredPdfFilename(filename: string): boolean {
  return isStoredFileFilename(filename) && extname(filename).toLowerCase() === '.pdf';
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

function hasExpectedSignature(buffer: Buffer, signature: 'pdf' | 'zip' | 'ole'): boolean {
  if (signature === 'pdf') return buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE);
  if (signature === 'ole') return buffer.subarray(0, OLE_SIGNATURE.length).equals(OLE_SIGNATURE);
  return ZIP_SIGNATURES.some((zipSignature) =>
    buffer.subarray(0, zipSignature.length).equals(zipSignature),
  );
}

function toFileResponse(asset: Asset): FileAssetResponseDto {
  return {
    id: asset.id,
    url: `/api/assets/files/${asset.id}`,
    filename: asset.filename,
    originalName: normalizeAssetOriginalName(asset.originalName),
    contentType: asset.contentType,
    size: asset.size,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
  };
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
