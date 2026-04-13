import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Space } from './space.entity';
import { CreateSpaceDto, UpdateSpaceDto } from './space.dto';

@Injectable()
export class SpacesService {
  constructor(
    @InjectRepository(Space)
    private readonly spacesRepo: Repository<Space>,
  ) {}

  findAll(): Promise<Space[]> {
    return this.spacesRepo.find({
      relations: ['pages'],
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Space> {
    const space = await this.spacesRepo.findOne({
      where: { id },
      relations: ['pages'],
    });
    if (!space) throw new NotFoundException(`Space ${id} nicht gefunden`);
    return space;
  }

  async create(dto: CreateSpaceDto): Promise<Space> {
    const space = this.spacesRepo.create(dto);
    return this.spacesRepo.save(space);
  }

  async update(id: string, dto: UpdateSpaceDto): Promise<Space> {
    const space = await this.findOne(id);
    Object.assign(space, dto);
    return this.spacesRepo.save(space);
  }

  async remove(id: string): Promise<void> {
    const space = await this.findOne(id);
    await this.spacesRepo.remove(space);
  }
}
