import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { access, mkdir, rename, unlink, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { basename, resolve } from 'path';
import { In, Repository } from 'typeorm';
import { FilePreviewResponseDto } from '../dto/file-preview-response.dto';
import { Asset } from '../entities/asset.entity';
import {
  OFFICE_CONTENT_TYPES,
  PDF_CONTENT_TYPE,
  type PreviewErrorCode,
} from './preview.constants';
import { PreviewQueueService } from './preview-queue.service';

export interface PreviewInput {
  filePath: string;
  filename: string;
}

export interface StoredPreview {
  filePath: string;
  size: number;
}

@Injectable()
export class AssetPreviewService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AssetPreviewService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Asset)
    private readonly assetsRepo: Repository<Asset>,
    private readonly queue: PreviewQueueService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<boolean>('app.previewWorkerEnabled', false)) {
      await this.recoverInterruptedJobs();
    }
  }

  toResponse(asset: Asset): FilePreviewResponseDto {
    const ready = asset.previewStatus === 'ready';
    return {
      status: asset.previewStatus,
      url: ready ? `/api/assets/files/${asset.id}/preview` : null,
      errorCode: asset.previewErrorCode,
    };
  }

  async scheduleAfterUpload(asset: Asset): Promise<void> {
    if (!OFFICE_CONTENT_TYPES.has(asset.contentType)) return;
    try {
      await this.queue.enqueue(asset.id);
    } catch (error) {
      this.logger.error(`Could not enqueue preview for asset ${asset.id}`, error);
    }
  }

  async requestPreview(id: string): Promise<FilePreviewResponseDto> {
    const asset = await this.findFileAsset(id);
    if (asset.contentType === PDF_CONTENT_TYPE) {
      return this.toResponse(asset);
    }
    if (!OFFICE_CONTENT_TYPES.has(asset.contentType)) {
      throw new ConflictException('Für diese Datei ist keine Vorschau verfügbar.');
    }

    if (asset.previewStatus === 'failed') {
      asset.previewStatus = 'pending';
      asset.previewErrorCode = null;
      asset.previewUpdatedAt = new Date();
      await this.assetsRepo.save(asset);
    }
    if (asset.previewStatus !== 'ready' && asset.previewStatus !== 'processing') {
      await this.queue.enqueue(asset.id);
    }
    return this.toResponse(asset);
  }

  async getPreviewStatus(id: string): Promise<FilePreviewResponseDto> {
    return this.toResponse(await this.findFileAsset(id));
  }

  async openPreview(id: string): Promise<StoredPreview> {
    const asset = await this.findFileAsset(id);
    if (asset.previewStatus !== 'ready') {
      throw new ConflictException('Die Vorschau ist noch nicht verfügbar.');
    }

    const filePath =
      asset.contentType === PDF_CONTENT_TYPE
        ? this.resolveOriginalPath(asset)
        : this.previewPath(asset.id);
    try {
      await access(filePath, constants.R_OK);
    } catch {
      throw new NotFoundException('Vorschau nicht gefunden.');
    }

    return {
      filePath,
      size: asset.contentType === PDF_CONTENT_TYPE ? asset.size : (asset.previewSize ?? 0),
    };
  }

  async beginConversion(id: string): Promise<PreviewInput | null> {
    const asset = await this.findFileAsset(id);
    if (!OFFICE_CONTENT_TYPES.has(asset.contentType) || asset.previewStatus === 'ready') {
      return null;
    }

    asset.previewStatus = 'processing';
    asset.previewErrorCode = null;
    asset.previewUpdatedAt = new Date();
    await this.assetsRepo.save(asset);

    return {
      filePath: this.resolveOriginalPath(asset),
      filename: asset.filename,
    };
  }

  async completeConversion(id: string, output: Buffer): Promise<void> {
    const directory = await this.ensurePreviewDir();
    const targetPath = this.previewPath(id);
    const temporaryPath = resolve(directory, `${id}.${process.pid}.${Date.now()}.tmp`);
    await writeFile(temporaryPath, output, { flag: 'wx' });

    try {
      await this.assetsRepo.manager.transaction(async (manager) => {
        const asset = await manager.findOne(Asset, {
          where: { id, type: In(['file', 'pdf']) },
          lock: { mode: 'pessimistic_write' },
        });
        if (!asset) {
          await unlinkIfPresent(temporaryPath);
          return;
        }

        await rename(temporaryPath, targetPath);
        asset.previewStatus = 'ready';
        asset.previewSize = output.length;
        asset.previewErrorCode = null;
        asset.previewGeneratorVersion = this.config.get<string>('app.previewGeneratorVersion', '1');
        asset.previewUpdatedAt = new Date();
        await manager.save(asset);
      });
    } catch (error) {
      await unlinkIfPresent(temporaryPath);
      throw error;
    }
  }

  async markPending(id: string): Promise<void> {
    await this.assetsRepo.update(
      { id },
      { previewStatus: 'pending', previewUpdatedAt: new Date() },
    );
  }

  async markFailed(id: string, code: PreviewErrorCode): Promise<void> {
    await this.assetsRepo.update(
      { id },
      {
        previewStatus: 'failed',
        previewErrorCode: code,
        previewUpdatedAt: new Date(),
      },
    );
  }

  async removePreview(id: string): Promise<void> {
    await this.queue.remove(id);
    await unlinkIfPresent(this.previewPath(id));
    const directory = this.previewDir();
    const prefix = `${id}.`;
    try {
      const { readdir } = await import('fs/promises');
      const files = await readdir(directory);
      await Promise.all(
        files
          .filter((file) => file.startsWith(prefix) && file.endsWith('.tmp'))
          .map((file) => unlinkIfPresent(resolve(directory, file))),
      );
    } catch {
      // The preview directory may not exist yet.
    }
  }

  private async recoverInterruptedJobs(): Promise<void> {
    const assets = await this.assetsRepo.find({
      where: { previewStatus: In(['pending', 'processing']) },
    });
    for (const asset of assets) {
      if (asset.previewStatus === 'processing') {
        await this.markPending(asset.id);
      }
      await this.queue.enqueue(asset.id);
    }
  }

  private async findFileAsset(id: string): Promise<Asset> {
    const asset = await this.assetsRepo.findOne({
      where: { id, type: In(['file', 'pdf']) },
    });
    if (!asset) throw new NotFoundException('Datei nicht gefunden.');
    return asset;
  }

  private resolveOriginalPath(asset: Asset): string {
    const directory = resolve(
      this.config.get<string>('app.uploadDir', 'uploads'),
      asset.type === 'pdf' ? 'pdfs' : 'files',
    );
    const filePath = resolve(directory, asset.filename);
    if (!filePath.startsWith(`${directory}/`) || basename(filePath) !== asset.filename) {
      throw new NotFoundException('Datei nicht gefunden.');
    }
    return filePath;
  }

  private async ensurePreviewDir(): Promise<string> {
    const directory = this.previewDir();
    await mkdir(directory, { recursive: true });
    return directory;
  }

  private previewDir(): string {
    return resolve(this.config.get<string>('app.uploadDir', 'uploads'), 'previews');
  }

  private previewPath(id: string): string {
    return resolve(this.previewDir(), `${id}.pdf`);
  }
}

async function unlinkIfPresent(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (
      typeof error !== 'object' ||
      error === null ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error;
    }
  }
}
