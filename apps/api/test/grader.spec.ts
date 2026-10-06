import { describe, expect, it } from 'vitest';
import { Grader, normalizeText } from '../src/modules/learning/domain/services/grader';

const g = new Grader();

describe('Grader', () => {
  it('single: 인덱스 일치', () => {
    expect(g.grade('single', { index: 1 }, { index: 1 })).toBe(true);
    expect(g.grade('single', { index: 1 }, { index: 0 })).toBe(false);
  });

  it('ox: boolean 일치', () => {
    expect(g.grade('ox', { value: true }, { value: true })).toBe(true);
    expect(g.grade('ox', { value: false }, { value: true })).toBe(false);
  });

  it('multi: 순서 무관 집합 일치, 부분 선택은 오답', () => {
    expect(g.grade('multi', { indices: [0, 2] }, { indices: [2, 0] })).toBe(true);
    expect(g.grade('multi', { indices: [0, 2] }, { indices: [0] })).toBe(false);
    expect(g.grade('multi', { indices: [0, 2] }, { indices: [0, 2, 3] })).toBe(false);
  });

  it('fill: 정규화 후 동의어 중 하나와 일치', () => {
    const key = { accepted: ['후보', '후보키', 'candidate key'] };
    expect(g.grade('fill', key, { text: ' 후보키 ' })).toBe(true);
    expect(g.grade('fill', key, { text: 'Candidate  Key' })).toBe(true);
    expect(g.grade('fill', key, { text: '슈퍼키' })).toBe(false);
    expect(g.grade('fill', key, { text: '   ' })).toBe(false);
  });

  it('형식이 틀린 답안은 예외 대신 오답', () => {
    expect(g.grade('single', { index: 1 }, { text: 'x' })).toBe(false);
    expect(g.grade('ox', { value: true }, null)).toBe(false);
  });

  it('정답 키 형식이 틀리면 예외 (콘텐츠 버그는 조용히 넘기지 않음)', () => {
    expect(() => g.grade('single', { indices: [1] }, { index: 1 })).toThrow();
  });

  it('normalizeText: 유니코드 정규화·공백·구두점', () => {
    expect(normalizeText('  B+Tree, ')).toBe('b+tree');
    expect(normalizeText('ＡＢＣ')).toBe('abc');
  });
});
