import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Head,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import type { Request, Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  AssetsService,
  UploadedImageFile,
  UploadedPdfFile,
  UploadedStorageFile,
} from './assets.service';
import { FileAssetResponseDto } from './dto/file-asset-response.dto';
import { ImageUploadResponseDto } from './dto/image-upload-response.dto';
import { PdfAssetResponseDto } from './dto/pdf-asset-response.dto';
import { FilePreviewResponseDto } from './dto/file-preview-response.dto';
import { AssetPreviewService } from './preview/asset-preview.service';

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    @Optional()
    private readonly previews?: AssetPreviewService,
  ) {}

  @Post('images')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: ImageUploadResponseDto })
  @ApiBadRequestResponse({ description: 'Ungültige oder fehlende Bilddatei.' })
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(@UploadedFile() file?: UploadedImageFile): Promise<ImageUploadResponseDto> {
    if (!file) {
      throw new BadRequestException('Es wurde keine Bilddatei hochgeladen.');
    }

    return this.assetsService.saveImage(file);
  }

  @Get('images/:filename')
  @ApiOkResponse({ description: 'Bilddatei.' })
  @ApiBadRequestResponse({ description: 'Ungültiger Bildname.' })
  @ApiNotFoundResponse({ description: 'Bild nicht gefunden.' })
  async getImage(@Param('filename') filename: string): Promise<StreamableFile> {
    const image = await this.assetsService.openImage(filename);
    return new StreamableFile(image.stream, { type: image.contentType });
  }

  @Get('files')
  @ApiOkResponse({ type: FileAssetResponseDto, isArray: true })
  listFiles(): Promise<FileAssetResponseDto[]> {
    return this.assetsService.listFiles();
  }

  @Post('files')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiCreatedResponse({ type: FileAssetResponseDto })
  @ApiBadRequestResponse({ description: 'Ungültige oder fehlende Datei.' })
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file?: UploadedStorageFile): Promise<FileAssetResponseDto> {
    if (!file) {
      throw new BadRequestException('Es wurde keine Datei hochgeladen.');
    }

    return this.assetsService.saveFile(file);
  }

  @Head('files/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Datei ist vorhanden.' })
  @ApiBadRequestResponse({ description: 'Ungültige Datei-ID.' })
  @ApiNotFoundResponse({ description: 'Datei nicht gefunden.' })
  async checkFile(@Param('id') id: string): Promise<void> {
    await this.assetsService.ensureFileReadable(id);
  }

  @Get('files/:id')
  @ApiOkResponse({ description: 'Gespeicherte Datei.' })
  @ApiBadRequestResponse({ description: 'Ungültige Datei-ID.' })
  @ApiNotFoundResponse({ description: 'Datei nicht gefunden.' })
  async getFile(
    @Param('id') id: string,
    @Req() request?: Request,
    @Res() response?: Response,
  ): Promise<void | StreamableFile> {
    const file = await this.assetsService.openFile(id);
    if (!request || !response) {
      return new StreamableFile(file.stream, {
        type: file.contentType,
        disposition: `${
          file.contentType === 'application/pdf' ? 'inline' : 'attachment'
        }; filename="${file.filename}"`,
        length: file.size,
      });
    }
    streamFile(
      request,
      response,
      file.filePath,
      file.size,
      file.contentType,
      file.contentType === 'application/pdf' ? 'inline' : 'attachment',
      file.originalName,
    );
  }

  @Post('files/:id/preview')
  @ApiOkResponse({ type: FilePreviewResponseDto })
  @ApiNotFoundResponse({ description: 'Datei nicht gefunden.' })
  requestPreview(@Param('id') id: string): Promise<FilePreviewResponseDto> {
    return this.previewService().requestPreview(id);
  }

  @Get('files/:id/preview/status')
  @ApiOkResponse({ type: FilePreviewResponseDto })
  @ApiNotFoundResponse({ description: 'Datei nicht gefunden.' })
  getPreviewStatus(@Param('id') id: string): Promise<FilePreviewResponseDto> {
    return this.previewService().getPreviewStatus(id);
  }

  @Get('files/:id/preview')
  @ApiOkResponse({ description: 'PDF-Vorschau.' })
  @ApiNotFoundResponse({ description: 'Datei oder Vorschau nicht gefunden.' })
  async getPreview(
    @Param('id') id: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const preview = await this.previewService().openPreview(id);
    streamFile(
      request,
      response,
      preview.filePath,
      preview.size,
      'application/pdf',
      'inline',
      `${id}.pdf`,
    );
  }

  @Delete('files/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Datei gelöscht.' })
  @ApiBadRequestResponse({ description: 'Ungültige Datei-ID.' })
  @ApiNotFoundResponse({ description: 'Datei nicht gefunden.' })
  async deleteFile(@Param('id') id: string): Promise<void> {
    await this.assetsService.deleteFile(id);
  }

  @Get('pdfs')
  @ApiOkResponse({ type: PdfAssetResponseDto, isArray: true })
  listPdfs(): Promise<PdfAssetResponseDto[]> {
    return this.assetsService.listPdfs();
  }

  @Post('pdfs')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: PdfAssetResponseDto })
  @ApiBadRequestResponse({ description: 'Ungültige oder fehlende PDF-Datei.' })
  @UseInterceptors(FileInterceptor('file'))
  uploadPdf(@UploadedFile() file?: UploadedPdfFile): Promise<PdfAssetResponseDto> {
    if (!file) {
      throw new BadRequestException('Es wurde keine PDF-Datei hochgeladen.');
    }

    return this.assetsService.savePdf(file);
  }

  @Head('pdfs/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'PDF-Datei ist vorhanden.' })
  @ApiBadRequestResponse({ description: 'Ungültige PDF-ID.' })
  @ApiNotFoundResponse({ description: 'PDF nicht gefunden.' })
  async checkPdf(@Param('id') id: string): Promise<void> {
    await this.assetsService.ensurePdfReadable(id);
  }

  @Get('pdfs/:id')
  @ApiOkResponse({ description: 'PDF-Datei.' })
  @ApiBadRequestResponse({ description: 'Ungültige PDF-ID.' })
  @ApiNotFoundResponse({ description: 'PDF nicht gefunden.' })
  async getPdf(@Param('id') id: string): Promise<StreamableFile> {
    const pdf = await this.assetsService.openPdf(id);
    return new StreamableFile(pdf.stream, {
      type: pdf.contentType,
      disposition: `inline; filename="${pdf.filename}"`,
      length: pdf.size,
    });
  }

  @Delete('pdfs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'PDF gelöscht.' })
  @ApiBadRequestResponse({ description: 'Ungültige PDF-ID.' })
  @ApiNotFoundResponse({ description: 'PDF nicht gefunden.' })
  async deletePdf(@Param('id') id: string): Promise<void> {
    await this.assetsService.deletePdf(id);
  }

  private previewService(): AssetPreviewService {
    if (!this.previews) {
      throw new Error('AssetPreviewService is not configured');
    }
    return this.previews;
  }
}

function streamFile(
  request: Request,
  response: Response,
  filePath: string,
  size: number,
  contentType: string,
  disposition: 'inline' | 'attachment',
  filename: string,
): void {
  const range = parseRange(request.headers.range, size);
  const encodedFilename = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  response.set({
    'Accept-Ranges': 'bytes',
    'Content-Type': contentType,
    'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedFilename}`,
    'X-Content-Type-Options': 'nosniff',
  });

  if (range === 'invalid') {
    response.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
    response.set('Content-Range', `bytes */${size}`);
    response.end();
    return;
  }

  if (range !== null) {
    response.status(HttpStatus.PARTIAL_CONTENT);
    response.set({
      'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
      'Content-Length': String(range.end - range.start + 1),
    });
    createReadStream(filePath, range).pipe(response);
    return;
  }

  response.set('Content-Length', String(size));
  createReadStream(filePath).pipe(response);
}

export function parseRange(
  header: string | undefined,
  size: number,
): { start: number; end: number } | 'invalid' | null {
  if (!header) return null;
  if (size <= 0 || !/^bytes=\d*-\d*$/.test(header)) return 'invalid';
  const [startValue, endValue] = header.slice(6).split('-', 2);
  if (!startValue && !endValue) return 'invalid';

  if (!startValue) {
    const suffixLength = Number(endValue);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return 'invalid';
    return {
      start: Math.max(size - suffixLength, 0),
      end: size - 1,
    };
  }

  const start = Number(startValue);
  const end = endValue ? Number(endValue) : size - 1;
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return 'invalid';
  }
  return { start, end: Math.min(end, size - 1) };
}
