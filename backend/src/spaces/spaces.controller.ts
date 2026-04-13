import {
  Controller, Get, Post, Put, Delete,
  Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SpacesService } from './spaces.service';
import { CreateSpaceDto, UpdateSpaceDto } from './space.dto';
import { Space } from './space.entity';

@ApiTags('spaces')
@Controller('spaces')
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Spaces mit Pages laden' })
  findAll(): Promise<Space[]> {
    return this.spacesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einen Space laden' })
  findOne(@Param('id') id: string): Promise<Space> {
    return this.spacesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Space erstellen' })
  create(@Body() dto: CreateSpaceDto): Promise<Space> {
    return this.spacesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Space aktualisieren' })
  update(@Param('id') id: string, @Body() dto: UpdateSpaceDto): Promise<Space> {
    return this.spacesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Space loeschen' })
  remove(@Param('id') id: string): Promise<void> {
    return this.spacesService.remove(id);
  }
}
