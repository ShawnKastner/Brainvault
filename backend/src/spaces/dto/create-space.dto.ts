import { IsHexColor, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSpaceDto {
  @ApiProperty({ example: 'Development' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Alle Dev-Notizen' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '#378ADD' })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ example: '6f27ef68-7719-48da-9f58-8ca0605f5b22', nullable: true })
  @IsOptional()
  @IsUUID()
  parentId?: string | null;
}
