import { Injectable } from '@nestjs/common';

@Injectable()
export class MomoSimService {
  getHello(): string {
    return 'Hello World!';
  }
}
