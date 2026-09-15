import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MomoController } from './momo.controller';
import { MomoService } from './momo.service';
import { PrismaService } from './prisma.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [MomoController],
  providers: [MomoService, PrismaService],
})
export class MomoSimModule {}
