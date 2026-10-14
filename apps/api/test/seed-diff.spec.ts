import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  chunk,
  classifyQuestion,
  desiredTrackShape,
  hasRetiredRows,
  trackStructureEqual,
  type QuestionData,
  type TrackShape,
} from '../prisma/seed-diff';

const Q: QuestionData = {
  type: 'single',
  content: { stem: '문제', options: ['가', '나', '다'] },
  answerKey: { index: 1 },
  explanation: '해설',
  difficulty: 1,
  tags: ['a', 'b'],
  refs: [],
  lessonId: 7,
  sortOrder: 3,
  status: 'published',
};

describe('canonicalJson', () => {
  it('객체 키 순서가 달라도 같고, 중첩 객체도 정렬한다', () => {
    expect(canonicalJson({ a: 1, b: { x: 1, y: [1, { p: 1, q: 2 }] } })).toBe(canonicalJson({ b: { y: [1, { q: 2, p: 1 }], x: 1 }, a: 1 }));
  });
  it('배열 순서는 의미가 있다', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
  it('undefined 값 키는 없는 것과 같다', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });
});

describe('classifyQuestion', () => {
  it('기존 문제가 없으면 create', () => {
    expect(classifyQuestion(undefined, Q)).toBe('create');
  });
  it('모두 같으면 same — JSON 필드 키 순서가 달라도', () => {
    const reordered: QuestionData = { ...Q, content: { options: ['가', '나', '다'], stem: '문제' }, answerKey: { index: 1 } };
    expect(classifyQuestion(reordered, Q)).toBe('same');
  });
  it('내용 필드가 하나라도 다르면 content', () => {
    expect(classifyQuestion({ ...Q, explanation: '다른 해설' }, Q)).toBe('content');
    expect(classifyQuestion({ ...Q, type: 'ox' }, Q)).toBe('content');
    expect(classifyQuestion({ ...Q, difficulty: 2 }, Q)).toBe('content');
    expect(classifyQuestion({ ...Q, tags: ['b', 'a'] }, Q)).toBe('content');
    expect(classifyQuestion({ ...Q, refs: ['r'] }, Q)).toBe('content');
    expect(classifyQuestion({ ...Q, answerKey: { index: 2 } }, Q)).toBe('content');
    expect(classifyQuestion({ ...Q, content: { stem: '문제', options: ['가', '나'] } }, Q)).toBe('content');
  });
  it('위치·상태만 다르면 placement(version을 올리지 않는다)', () => {
    expect(classifyQuestion({ ...Q, lessonId: 8 }, Q)).toBe('placement');
    expect(classifyQuestion({ ...Q, sortOrder: 4 }, Q)).toBe('placement');
    expect(classifyQuestion({ ...Q, status: 'retired' }, Q)).toBe('placement');
  });
  it('내용과 위치가 함께 바뀌면 content', () => {
    expect(classifyQuestion({ ...Q, explanation: 'x', sortOrder: 9 }, Q)).toBe('content');
  });
});

const content = {
  name: '자료구조',
  description: '설명',
  phase: 'mvp',
  units: [
    {
      slug: 'u01-a',
      name: '유닛1',
      lessons: [
        { slug: 'l01', name: '레슨1', objective: '목표', keyPoints: ['k1', 'k2'] },
        { slug: 'l02', name: '레슨2', objective: '목표2', keyPoints: [] },
      ],
    },
    { slug: 'u02-b', name: '유닛2', lessons: [{ slug: 'l01', name: '레슨3', objective: '목표3', keyPoints: ['k3'] }] },
  ],
};

/** DB에서 읽은 모양을 흉내 낸다 — 행 순서는 뒤섞여 있어도 된다 */
function dbShape(): TrackShape {
  return {
    name: '자료구조',
    description: '설명',
    sortOrder: 2,
    isActive: true,
    units: [
      { slug: 'u02-b', name: '유닛2', sortOrder: 2, lessons: [{ slug: 'l01', name: '레슨3', objective: '목표3', keyPoints: ['k3'], sortOrder: 1 }] },
      {
        slug: 'u01-a',
        name: '유닛1',
        sortOrder: 1,
        lessons: [
          { slug: 'l02', name: '레슨2', objective: '목표2', keyPoints: [], sortOrder: 2 },
          { slug: 'l01', name: '레슨1', objective: '목표', keyPoints: ['k1', 'k2'], sortOrder: 1 },
        ],
      },
    ],
  };
}

describe('trackStructureEqual', () => {
  const desired = desiredTrackShape(content, 1);

  it('구조가 같으면 true (읽어 온 행 순서와 무관)', () => {
    expect(trackStructureEqual(dbShape(), desired)).toBe(true);
  });
  it('트랙 필드가 다르면 false', () => {
    expect(trackStructureEqual({ ...dbShape(), name: '다른 이름' }, desired)).toBe(false);
    expect(trackStructureEqual({ ...dbShape(), description: null }, desired)).toBe(false);
    expect(trackStructureEqual({ ...dbShape(), sortOrder: 1 }, desired)).toBe(false);
    expect(trackStructureEqual({ ...dbShape(), isActive: false }, desired)).toBe(false);
  });
  it('유닛 순서가 바뀌면 false', () => {
    const s = dbShape();
    s.units[0]!.sortOrder = 1;
    s.units[1]!.sortOrder = 2;
    expect(trackStructureEqual(s, desired)).toBe(false);
  });
  it('이름·objective·keyPoints·레슨 순서가 다르면 false', () => {
    const rename = dbShape();
    rename.units[0]!.name = '바뀐 유닛';
    expect(trackStructureEqual(rename, desired)).toBe(false);
    const obj = dbShape();
    obj.units[0]!.lessons[0]!.objective = null;
    expect(trackStructureEqual(obj, desired)).toBe(false);
    const kp = dbShape();
    kp.units[0]!.lessons[0]!.keyPoints = ['k3', 'k4'];
    expect(trackStructureEqual(kp, desired)).toBe(false);
    const order = dbShape();
    order.units[1]!.lessons[0]!.sortOrder = 1;
    order.units[1]!.lessons[1]!.sortOrder = 2;
    expect(trackStructureEqual(order, desired)).toBe(false);
  });
  it('유닛·레슨이 추가되거나 빠지면 false', () => {
    const missing = dbShape();
    missing.units.pop();
    expect(trackStructureEqual(missing, desired)).toBe(false);
    const extra = dbShape();
    extra.units[0]!.lessons.push({ slug: 'l09', name: '추가', objective: null, keyPoints: [], sortOrder: 3 });
    expect(trackStructureEqual(extra, desired)).toBe(false);
  });
  it('음수(퇴역) 행은 비교에서 빠지고 hasRetiredRows가 따로 알린다', () => {
    const s = dbShape();
    s.units[1]!.lessons.push({ slug: 'l07', name: '퇴역', objective: null, keyPoints: [], sortOrder: -3 });
    expect(trackStructureEqual(s, desired)).toBe(true);
    expect(hasRetiredRows(s.units)).toBe(true);
    expect(hasRetiredRows(dbShape().units)).toBe(false);
    const unitRetired = dbShape();
    unitRetired.units.push({ slug: 'u09-x', name: '퇴역 유닛', sortOrder: -1, lessons: [] });
    expect(hasRetiredRows(unitRetired.units)).toBe(true);
    expect(trackStructureEqual(unitRetired, desired)).toBe(true);
  });
});

describe('chunk', () => {
  it('크기로 나눈다', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
