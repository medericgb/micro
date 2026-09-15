import { NestFactory } from '@nestjs/core';
import { MomoSimModule } from './momo-sim.module';

async function bootstrap() {
  const app = await NestFactory.create(MomoSimModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
