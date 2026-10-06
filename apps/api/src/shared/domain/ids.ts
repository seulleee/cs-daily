import { randomUUID } from 'node:crypto';

/** 타입이 다른 id를 서로 섞어 쓰지 못하게 하는 브랜드 타입 값 객체 */
abstract class BrandedId<B extends string> {
  // 브랜드 필드는 런타임 비용 없이 타입만 구분
  declare private readonly __brand: B;
  protected constructor(readonly value: string) {
    if (!value) throw new Error(`${new.target.name}: empty id`);
  }
  equals(other: BrandedId<B>): boolean {
    return other instanceof this.constructor && other.value === this.value;
  }
  toString(): string {
    return this.value;
  }
}

export class UserId extends BrandedId<'UserId'> {
  static of(v: string) {
    return new UserId(v);
  }
}
export class SessionId extends BrandedId<'SessionId'> {
  static of(v: string) {
    return new SessionId(v);
  }
  static new() {
    return new SessionId(randomUUID());
  }
}
export class QuestionId extends BrandedId<'QuestionId'> {
  static of(v: string) {
    return new QuestionId(v);
  }
}
export class LessonId {
  private constructor(readonly value: number) {
    if (!Number.isInteger(value) || value <= 0) throw new Error('LessonId: invalid');
  }
  static of(v: number) {
    return new LessonId(v);
  }
  equals(o: LessonId) {
    return o.value === this.value;
  }
}
