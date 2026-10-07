import { describe, expect, it } from 'vitest';
import { UnitSkipTest } from '../src/modules/learning/domain/services/unit-skip-test';

describe('UnitSkipTest', () => {
  it('레슨마다 뒤쪽 문제부터 번갈아 최대 8개를 뽑는다', () => {
    const lessons = [
      ['a1', 'a2', 'a3', 'a4'],
      ['b1', 'b2', 'b3', 'b4'],
      ['c1', 'c2', 'c3', 'c4'],
    ];
    expect(UnitSkipTest.pickQuestions(lessons)).toEqual(['a4', 'b4', 'c4', 'a3', 'b3', 'c3', 'a2', 'b2']);
  });

  it('문제가 모자라면 있는 만큼만 뽑는다', () => {
    expect(UnitSkipTest.pickQuestions([['a1'], [], ['c1', 'c2']])).toEqual(['a1', 'c2', 'c1']);
  });

  it('정답률 80% 이상이면 통과', () => {
    expect(UnitSkipTest.passed(7, 8)).toBe(true); // 87.5%
    expect(UnitSkipTest.passed(8, 10)).toBe(true); // 80%
    expect(UnitSkipTest.passed(6, 8)).toBe(false); // 75%
    expect(UnitSkipTest.passed(0, 0)).toBe(false);
  });
});
