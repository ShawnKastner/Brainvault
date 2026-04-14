import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Space } from '../spaces/entities/space.entity';
import { Page } from './entities/page.entity';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Page, Space])],
  providers: [PagesService],
  controllers: [PagesController],
  exports: [PagesService],
})
export class PagesModule {}
