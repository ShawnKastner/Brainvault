import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { PagesService } from './pages.service';
import { CreatePageDto, UpdatePageDto } from './page.dto';
import { Page } from './page.entity';

@ApiTags('pages')
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  @ApiOperation({ summary: 'Pages laden (optional nach spaceId filtern)' })
  @ApiQuery({ name: 'spaceId', required: false })
  findAll(@Query('spaceId') spaceId?: string): Promise<Page[]> {
    return this.pagesService.findAll(spaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Eine Page laden' })
  findOne(@Param('id') id: string): Promise<Page> {
    return this.pagesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Page erstellen' })
  create(@Body() dto: CreatePageDto): Promise<Page> {
    return this.pagesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Page aktualisieren' })
  update(@Param('id') id: string, @Body() dto: UpdatePageDto): Promise<Page> {
    return this.pagesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Page loeschen' })
  remove(@Param('id') id: string): Promise<void> {
    return this.pagesService.remove(id);
  }
}
