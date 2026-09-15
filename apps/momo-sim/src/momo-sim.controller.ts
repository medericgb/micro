import { Controller, Get } from '@nestjs/common';
import { MomoSimService } from './momo-sim.service';

@Controller()
export class MomoSimController {
  constructor(private readonly momoSimService: MomoSimService) {}

  @Get()
  getHello(): string {
    return this.momoSimService.getHello();
  }
}
