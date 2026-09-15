import { Test, TestingModule } from '@nestjs/testing';
import { MomoSimController } from './momo-sim.controller';
import { MomoSimService } from './momo-sim.service';

describe('MomoSimController', () => {
  let momoSimController: MomoSimController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [MomoSimController],
      providers: [MomoSimService],
    }).compile();

    momoSimController = app.get<MomoSimController>(MomoSimController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(momoSimController.getHello()).toBe('Hello World!');
    });
  });
});
