import { describe, expect, it } from 'vitest';
import { CurriculumFile, SessionResponse } from '@cs-daily/contracts';

const para = (n: number) => '가'.repeat(n);

function curriculumWith(lesson: Record<string, unknown>) {
  return {
    tracks: [
      {
        slug: 'net',
        name: '네트워크',
        description: '설명',
        phase: 'mvp',
        units: [{ slug: 'u01-a', name: '유닛', lessons: [{ slug: 'l01', name: '레슨', objective: '목표', keyPoints: [], ...lesson }] }],
      },
    ],
  };
}

describe('curriculum lesson intro 규칙', () => {
  it('intro가 없어도 통과한다', () => {
    expect(CurriculumFile.safeParse(curriculumWith({})).success).toBe(true);
  });
  it('1~3문단, 문단당 40~220자, 합계 450자 이하만 통과한다', () => {
    expect(CurriculumFile.safeParse(curriculumWith({ intro: [para(40)] })).success).toBe(true);
    expect(CurriculumFile.safeParse(curriculumWith({ intro: [para(220), para(220)] })).success).toBe(true);
    expect(CurriculumFile.safeParse(curriculumWith({ intro: [para(150), para(150), para(150)] })).success).toBe(true);
  });
  it('빈 배열·4문단 이상은 거부한다', () => {
    expect(CurriculumFile.safeParse(curriculumWith({ intro: [] })).success).toBe(false);
    expect(CurriculumFile.safeParse(curriculumWith({ intro: [para(50), para(50), para(50), para(50)] })).success).toBe(false);
  });
  it('문단이 40자 미만이거나 220자 초과면 거부한다', () => {
    expect(CurriculumFile.safeParse(curriculumWith({ intro: [para(39)] })).success).toBe(false);
    expect(CurriculumFile.safeParse(curriculumWith({ intro: [para(221)] })).success).toBe(false);
  });
  it('합계가 450자를 넘으면 거부한다', () => {
    expect(CurriculumFile.safeParse(curriculumWith({ intro: [para(220), para(220), para(11)] })).success).toBe(false);
  });
});

describe('SessionResponse lessonIntro', () => {
  const base = {
    id: '00000000-0000-4000-8000-000000000000',
    kind: 'lesson',
    lessonId: 1,
    lessonName: '레슨',
    lessonObjective: null,
    lessonKeyPoints: [],
    questions: [],
    answered: [],
    finished: false,
  };
  it('lessonIntro는 선택 필드다(옛 API 응답도 통과)', () => {
    expect(SessionResponse.safeParse(base).success).toBe(true);
    expect(SessionResponse.safeParse({ ...base, lessonIntro: ['문단'] }).success).toBe(true);
  });
});
