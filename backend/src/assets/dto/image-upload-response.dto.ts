import { ApiProperty } from '@nestjs/swagger';

export class ImageUploadResponseDto {
  @ApiProperty({ example: '6d0fcb7a-5d8f-4d1f-a6d6-7a3117d23f09' })
  id: string;

  @ApiProperty({ example: '/api/assets/images/2f3a6d4c-1200-4a0f-93db-60f6c0642bb7.png' })
  url: string;

  @ApiProperty({ example: '2f3a6d4c-1200-4a0f-93db-60f6c0642bb7.png' })
  filename: string;

  @ApiProperty({ example: 'diagram.png' })
  originalName: string;

  @ApiProperty({ example: 'image/png' })
  contentType: string;

  @ApiProperty({ example: 48213 })
  size: number;
}
