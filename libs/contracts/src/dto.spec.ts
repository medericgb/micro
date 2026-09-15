import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RegisterDto } from './auth';
import { DepositDto, TransferDto } from './wallet';

function errorsFor<T extends object>(
  cls: new () => T,
  payload: object,
): string[] {
  const instance = plainToInstance(cls, payload);
  return validateSync(instance).map((e) => e.property);
}

describe('contract DTOs', () => {
  it('accepts a valid registration', () => {
    expect(
      errorsFor(RegisterDto, {
        email: 'ada@example.com',
        password: 'correct-horse',
        fullName: 'Ada Lovelace',
      }),
    ).toEqual([]);
  });

  it('rejects a bad email and a short password', () => {
    const errors = errorsFor(RegisterDto, {
      email: 'not-an-email',
      password: 'short',
      fullName: 'Ada Lovelace',
    });
    expect(errors).toContain('email');
    expect(errors).toContain('password');
  });

  it('accepts a well-formed deposit', () => {
    expect(
      errorsFor(DepositDto, {
        walletId: '11111111-1111-4111-8111-111111111111',
        userId: '22222222-2222-4222-8222-222222222222',
        amount: '1500.50',
        msisdn: '237600000001',
        idempotencyKey: 'dep-1',
      }),
    ).toEqual([]);
  });

  it('rejects an amount with three decimal places', () => {
    const errors = errorsFor(DepositDto, {
      walletId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      amount: '1500.505',
      msisdn: '237600000001',
      idempotencyKey: 'dep-1',
    });
    expect(errors).toContain('amount');
  });

  it('rejects a transfer with no recipient email', () => {
    const errors = errorsFor(TransferDto, {
      fromUserId: '22222222-2222-4222-8222-222222222222',
      toEmail: 'nope',
      amount: '10.00',
      idempotencyKey: 'tr-1',
    });
    expect(errors).toContain('toEmail');
  });
});
