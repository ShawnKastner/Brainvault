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
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SpacesService } from './spaces.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { SpaceWithPagesResponseDto } from './dto/space-response.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';

@ApiTags('spaces')
@Controller('spaces')
export class SpacesController {
  constructor(private readonly spacesService: SpacesService) {}

  @Get()
  @ApiOperation({ summary: 'Alle Spaces mit Pages laden' })
  @ApiOkResponse({ type: [SpaceWithPagesResponseDto] })
  findAll(): Promise<SpaceWithPagesResponseDto[]> {
    return this.spacesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Einen Space laden' })
  @ApiOkResponse({ type: SpaceWithPagesResponseDto })
  findOne(@Param('id', new ParseUUIDPipe()) id: string): Promise<SpaceWithPagesResponseDto> {
    return this.spacesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Space erstellen' })
  @ApiCreatedResponse({ type: SpaceWithPagesResponseDto })
  create(@Body() dto: CreateSpaceDto): Promise<SpaceWithPagesResponseDto> {
    return this.spacesService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Space aktualisieren' })
  @ApiOkResponse({ type: SpaceWithPagesResponseDto })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSpaceDto,
  ): Promise<SpaceWithPagesResponseDto> {
    return this.spacesService.update(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Space aktualisieren' })
  @ApiOkResponse({ type: SpaceWithPagesResponseDto })
  patch(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSpaceDto,
  ): Promise<SpaceWithPagesResponseDto> {
    return this.spacesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Space löschen' })
  @ApiNoContentResponse()
  remove(@Param('id', new ParseUUIDPipe()) id: string): Promise<void> {
    return this.spacesService.remove(id);
  }
}
