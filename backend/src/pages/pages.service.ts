import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page } from './page.entity';
import { CreatePageDto, UpdatePageDto } from './page.dto';

@Injectable()
export class PagesService {
  constructor(
    @InjectRepository(Page)
    private readonly pagesRepo: Repository<Page>,
  ) {}

  findAll(spaceId?: string): Promise<Page[]> {
    return this.pagesRepo.find({
      where: spaceId ? { spaceId } : undefined,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Page> {
    const page = await this.pagesRepo.findOne({ where: { id } });
    if (!page) throw new NotFoundException(`Page ${id} nicht gefunden`);
    return page;
  }

  async create(dto: CreatePageDto): Promise<Page> {
    const page = this.pagesRepo.create({
      ...dto,
      contentFormat: dto.contentFormat ?? 'html',
      tags: dto.tags ?? [],
    });
    return this.pagesRepo.save(page);
  }

  async update(id: string, dto: UpdatePageDto): Promise<Page> {
    const page = await this.findOne(id);
    Object.assign(page, dto);
    return this.pagesRepo.save(page);
  }

  async remove(id: string): Promise<void> {
    const page = await this.findOne(id);
    await this.pagesRepo.remove(page);
  }
}
