import { Module } from '@nestjs/common';
import { MomoSimController } from './momo-sim.controller';
import { MomoSimService } from './momo-sim.service';

@Module({
  imports: [],
  controllers: [MomoSimController],
  providers: [MomoSimService],
})
export class MomoSimModule {}
