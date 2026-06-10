import { ApiProperty } from '@nestjs/swagger';
import { FilePreviewResponseDto } from './file-preview-response.dto';

export class FileAssetResponseDto {
  @ApiProperty({ example: '6d0fcb7a-5d8f-4d1f-a6d6-7a3117d23f09' })
  id: string;

  @ApiProperty({ example: '/api/assets/files/6d0fcb7a-5d8f-4d1f-a6d6-7a3117d23f09' })
  url: string;

  @ApiProperty({ example: '2f3a6d4c-1200-4a0f-93db-60f6c0642bb7.docx' })
  filename: string;

  @ApiProperty({ example: 'projektplan.docx' })
  originalName: string;

  @ApiProperty({ example: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  contentType: string;

  @ApiProperty({ example: 482130 })
  size: number;

  @ApiProperty({ example: '2026-04-21T09:15:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-21T09:15:00.000Z' })
  updatedAt: string;

  @ApiProperty({ type: FilePreviewResponseDto })
  preview: FilePreviewResponseDto;
}
