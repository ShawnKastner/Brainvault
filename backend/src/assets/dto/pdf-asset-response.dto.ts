import { ApiProperty } from '@nestjs/swagger';

export class PdfAssetResponseDto {
  @ApiProperty({ example: '6d0fcb7a-5d8f-4d1f-a6d6-7a3117d23f09' })
  id: string;

  @ApiProperty({ example: '/api/assets/pdfs/6d0fcb7a-5d8f-4d1f-a6d6-7a3117d23f09' })
  url: string;

  @ApiProperty({ example: '2f3a6d4c-1200-4a0f-93db-60f6c0642bb7.pdf' })
  filename: string;

  @ApiProperty({ example: 'briefing.pdf' })
  originalName: string;

  @ApiProperty({ example: 'application/pdf' })
  contentType: string;

  @ApiProperty({ example: 482130 })
  size: number;

  @ApiProperty({ example: '2026-04-21T09:15:00.000Z' })
  createdAt: string;

  @ApiProperty({ example: '2026-04-21T09:15:00.000Z' })
  updatedAt: string;
}
