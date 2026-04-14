import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PAGE_CONTENT_FORMATS, PageContentFormat } from '../entities/page.entity';

export class CreatePageDto {
  @ApiProperty({ example: 'NestJS Architektur' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ enum: PAGE_CONTENT_FORMATS, example: 'markdown', default: 'html' })
  @IsOptional()
  @IsIn(PAGE_CONTENT_FORMATS)
  contentFormat?: PageContentFormat;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty()
  @IsUUID()
  spaceId: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
