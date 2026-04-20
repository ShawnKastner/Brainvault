import {
  BadRequestException,
  Controller,
  Get,
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
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AssetsService, UploadedImageFile } from './assets.service';
import { ImageUploadResponseDto } from './dto/image-upload-response.dto';

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
}
