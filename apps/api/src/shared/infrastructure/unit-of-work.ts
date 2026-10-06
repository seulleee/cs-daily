import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

export type Tx = Prisma.TransactionClient;

/**
 * 트랜잭션 경계 = 애그리거트 하나.
 * 커맨드 핸들러가 uow.run(fn)으로 감싸면, 그 안에서 리포지토리가 uow.client로 같은 트랜잭션 클라이언트를 얻는다.
 * 트랜잭션 밖에서는 일반 PrismaClient를 돌려주므로 쿼리 핸들러는 그냥 uow.client를 써도 된다.
 */
@Injectable()
export class UnitOfWork {
  private readonly als = new AsyncLocalStorage<Tx>();

  constructor(private readonly prisma: PrismaService) {}

  get client(): Tx {
    return this.als.getStore() ?? this.prisma;
  }

  run<T>(fn: () => Promise<T>, opts?: { isolationLevel?: Prisma.TransactionIsolationLevel }): Promise<T> {
    const existing = this.als.getStore();
    if (existing) return fn(); // 중첩 호출은 바깥 트랜잭션에 합류
    return this.prisma.$transaction((tx) => this.als.run(tx, fn), {
      maxWait: 5_000,
      timeout: 15_000,
      ...(opts?.isolationLevel ? { isolationLevel: opts.isolationLevel } : {}),
    });
  }
}
