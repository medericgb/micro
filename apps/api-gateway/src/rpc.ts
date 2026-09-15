import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { rpcTimeoutMs } from '@app/common';

/** Every outbound call gets an explicit timeout so a dead service surfaces as 504. */
export function call<TResult>(
  client: ClientProxy,
  pattern: string,
  payload: unknown,
): Promise<TResult> {
  return firstValueFrom(
    client.send<TResult>(pattern, payload).pipe(timeout(rpcTimeoutMs())),
  );
}
