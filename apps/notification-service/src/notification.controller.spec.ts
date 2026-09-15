import { Test } from '@nestjs/testing';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PrismaService } from './prisma.service';

const USER_ID = '22222222-2222-4222-8222-222222222222';

describe('NotificationController', () => {
  let controller: NotificationController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        NotificationService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    controller = moduleRef.get(NotificationController);
  });

  it('reports health', () => {
    expect(controller.health()).toEqual({
      service: 'notification-service',
      status: 'ok',
    });
  });

  it('returns a typed stub for send', async () => {
    const result = await controller.send({
      userId: USER_ID,
      type: 'DEPOSIT_COMPLETED',
      title: 'Deposit received',
      body: 'Your deposit completed.',
    });
    expect(result).toMatchObject({
      userId: USER_ID,
      type: 'DEPOSIT_COMPLETED',
      readAt: null,
    });
  });

  it('returns an empty page for list', async () => {
    expect(await controller.list({ userId: USER_ID })).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('returns a typed stub for markRead', async () => {
    const result = await controller.markRead({
      userId: USER_ID,
      notificationId: '33333333-3333-4333-8333-333333333333',
    });
    expect(result.readAt).not.toBeNull();
  });
});
