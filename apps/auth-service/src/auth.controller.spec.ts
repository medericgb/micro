import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from './prisma.service';

const USER_ID = '22222222-2222-4222-8222-222222222222';

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'test-secret' })],
      controllers: [AuthController],
      providers: [AuthService, { provide: PrismaService, useValue: {} }],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  it('reports health', () => {
    expect(controller.health()).toEqual({
      service: 'auth-service',
      status: 'ok',
    });
  });

  it('returns a typed stub for register and never echoes the password', async () => {
    const result = await controller.register({
      email: 'ada@example.com',
      password: 'correct-horse',
      fullName: 'Ada Lovelace',
    });
    expect(result).toMatchObject({
      email: 'ada@example.com',
      fullName: 'Ada Lovelace',
    });
    expect(JSON.stringify(result)).not.toContain('correct-horse');
  });

  it('returns a token for login', async () => {
    const result = await controller.login({
      email: 'ada@example.com',
      password: 'correct-horse',
    });
    expect(typeof result.accessToken).toBe('string');
    expect(result.expiresIn).toBeGreaterThan(0);
  });

  it('returns claims for validateToken', async () => {
    expect(await controller.validateToken({ token: 'stub' })).toMatchObject({
      userId: expect.any(String),
      email: expect.any(String),
    });
  });

  it('returns a typed stub for getUser', async () => {
    expect((await controller.getUser({ userId: USER_ID })).id).toBe(USER_ID);
  });

  it('returns a typed stub for findByEmail', async () => {
    expect(
      (await controller.findByEmail({ email: 'ada@example.com' })).email,
    ).toBe('ada@example.com');
  });
});
