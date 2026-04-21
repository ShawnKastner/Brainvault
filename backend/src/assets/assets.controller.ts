import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Head,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
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
import { AssetsService, UploadedImageFile, UploadedPdfFile } from './assets.service';
import { ImageUploadResponseDto } from './dto/image-upload-response.dto';
import { PdfAssetResponseDto } from './dto/pdf-asset-response.dto';

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

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
}
