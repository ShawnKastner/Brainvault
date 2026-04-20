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
import { Asset } from './entities/asset.entity';

export interface UploadedImageFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
}

export interface StoredImage {
  stream: Readable;
  contentType: string;
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

@Injectable()
export class AssetsService {
  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Asset)
    private readonly assetsRepo: Repository<Asset>,
  ) {}

  async saveImage(file: UploadedImageFile): Promise<ImageUploadResponseDto> {
    const extension = IMAGE_TYPES.get(file.mimetype);
    if (!extension) {
      throw new BadRequestException('Nur PNG, JPEG, WebP und GIF Bilder sind erlaubt.');
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Die Bilddatei ist leer oder konnte nicht gelesen werden.');
    }

    const filename = `${randomUUID()}${extension}`;
    const imagesDir = await this.ensureImagesDir();
    await writeFile(join(imagesDir, filename), file.buffer);
    const asset = await this.assetsRepo.save(
      this.assetsRepo.create({
        type: 'image',
        filename,
        originalName: file.originalname,
        contentType: file.mimetype,
        size: file.size,
      }),
    );

    return {
      id: asset.id,
      url: `/api/assets/images/${filename}`,
      filename,
      originalName: file.originalname,
      contentType: file.mimetype,
      size: file.size,
    };
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

  private imagesDir(): string {
    return resolve(this.config.get<string>('app.uploadDir', 'uploads'), 'images');
  }
}

export function isStoredImageFilename(filename: string): boolean {
  return STORED_IMAGE_PATTERN.test(filename);
}

function isFileMissingError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
