import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { PageResponseDto } from './dto/page-response.dto';
import { UpdatePageDto } from './dto/update-page.dto';

@ApiTags('pages')
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  @ApiOperation({ summary: 'Pages laden (optional nach spaceId filtern)' })
  @ApiQuery({ name: 'spaceId', required: false })
  @ApiOkResponse({ type: [PageResponseDto] })
  findAll(@Query('spaceId', new ParseUUIDPipe({ optional: true })) spaceId?: string): Promise<PageResponseDto[]> {
    return this.pagesService.findAll(spaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Eine Page laden' })
  @ApiOkResponse({ type: PageResponseDto })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<PageResponseDto> {
    return this.pagesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Page erstellen' })
  @ApiCreatedResponse({ type: PageResponseDto })
  create(@Body() dto: CreatePageDto): Promise<PageResponseDto> {
    return this.pagesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Page aktualisieren' })
  @ApiOkResponse({ type: PageResponseDto })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePageDto,
  ): Promise<PageResponseDto> {
    return this.pagesService.update(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Page aktualisieren' })
  @ApiOkResponse({ type: PageResponseDto })
  patch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePageDto,
  ): Promise<PageResponseDto> {
    return this.pagesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Page löschen' })
  @ApiNoContentResponse()
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.pagesService.remove(id);
  }
}
