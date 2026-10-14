import { describe, expect, it } from 'vitest';
import { QuestionFile } from '@cs-daily/contracts';
import { LessonId, QuestionId, UserId } from '../src/shared/domain/ids';
import { LessonSession } from '../src/modules/learning/domain/lesson-session.aggregate';
import { Grader } from '../src/modules/learning/domain/services/grader';
import {
  CodeLanguageUnavailable,
  isVariantQuestion,
  languageOfRecordedAnswer,
  publicContentFor,
  resolveGradingKey,
  withLanguage,
} from '../src/modules/learning/domain/services/code-variants';
import { classifyQuestion, type QuestionData } from '../prisma/seed-diff';

const grader = new Grader();

// fill: 리스트 끝에 원소 추가 — python append / java add / javascript push / cpp push_back
const fillContent = {
  prompt: '리스트 끝에 3을 추가하는 메서드는?',
  variants: {
    python: { code: { language: 'python', source: 'a = [1, 2]\na.___(3)' } },
    java: { code: { language: 'java', source: 'List<Integer> a = new ArrayList<>();\na.___(3);' } },
    javascript: { code: { language: 'javascript', source: 'const a = [1, 2];\na.___(3);' } },
    cpp: { code: { language: 'cpp', source: 'vector<int> a = {1, 2};\na.___(3);' } },
  },
};
const fillKey = {
  variants: {
    python: { accepted: ['append'] },
    java: { accepted: ['add'] },
    javascript: { accepted: ['push'] },
    cpp: { accepted: ['push_back', 'pushback'] },
  },
};

// single: 코드마다 보기 개수·정답 위치가 다르다. python만 해설이 따로 있다
const singleContent = {
  prompt: '출력되는 값은?',
  options: ['3', '3.5', '4'],
  variants: {
    python: { code: { language: 'python', source: 'print(7 // 2)' }, options: ['3', '3.5'] },
    java: { code: { language: 'java', source: 'System.out.println(7 / 2);' } },
    javascript: { code: { language: 'javascript', source: 'console.log(7 / 2);' } },
    cpp: { code: { language: 'cpp', source: 'cout << 7 / 2;' } },
  },
};
const singleKey = {
  variants: {
    python: { index: 0, explanation: '파이썬의 // 는 몫(정수 나눗셈)을 구하므로 7 // 2 는 3이 된다.' },
    java: { index: 0 },
    javascript: { index: 1 },
    cpp: { index: 0 },
  },
};

const file = (over: Record<string, unknown>) => ({
  id: 'ct-listadd-005',
  type: 'fill',
  difficulty: 1,
  tags: ['list'],
  content: fillContent,
  answer_key: fillKey,
  explanation: '리스트 끝에 원소를 넣는 메서드는 언어마다 이름이 다르다.',
  refs: [],
  ...over,
});

describe('QuestionFile — 언어별 variants', () => {
  it('fill·single 모두 통과', () => {
    expect(QuestionFile.safeParse(file({})).success).toBe(true);
    expect(QuestionFile.safeParse(file({ id: 'ct-divide-007', type: 'single', content: singleContent, answer_key: singleKey })).success).toBe(true);
  });

  it('content와 answer_key의 언어 집합이 다르면 실패', () => {
    const { cpp: _cpp, ...rest } = fillKey.variants;
    expect(QuestionFile.safeParse(file({ answer_key: { variants: rest } })).success).toBe(false);
  });

  it('variants의 code.language가 키와 다르면 실패', () => {
    const bad = { ...fillContent, variants: { ...fillContent.variants, java: { code: { language: 'python', source: 'a.___(3)' } } } };
    expect(QuestionFile.safeParse(file({ content: bad })).success).toBe(false);
  });

  it('base content.code와 variants를 함께 쓰면 실패', () => {
    const bad = { ...fillContent, code: { language: 'python', source: 'a.___(3)' } };
    expect(QuestionFile.safeParse(file({ content: bad })).success).toBe(false);
  });

  it('fill: 언어 하나라도 빈칸이 없으면 실패, 대표 정답에 기호가 있으면 실패', () => {
    const noBlank = { ...fillContent, prompt: '메서드는?', variants: { ...fillContent.variants, java: { code: { language: 'java', source: 'a.add(3);' } } } };
    expect(QuestionFile.safeParse(file({ content: noBlank })).success).toBe(false);
    const symbol = { variants: { ...fillKey.variants, cpp: { accepted: ['push_back()'] } } };
    expect(QuestionFile.safeParse(file({ answer_key: symbol })).success).toBe(false);
  });

  it('single: 정답 index가 그 언어의 보기 수를 넘으면 실패', () => {
    const bad = { variants: { ...singleKey.variants, python: { index: 2 } } };
    expect(QuestionFile.safeParse(file({ id: 'ct-divide-007', type: 'single', content: singleContent, answer_key: bad })).success).toBe(false);
  });

  it('multi는 variants 불가', () => {
    expect(QuestionFile.safeParse(file({ id: 'ct-divide-007', type: 'multi', content: singleContent, answer_key: singleKey })).success).toBe(false);
  });
});

describe('publicContentFor — 사용자 언어 variant만 내려보낸다', () => {
  it('선택한 언어의 코드를 content.code로 펼치고 variants는 없앤다', () => {
    const { content, lang } = publicContentFor(fillContent, 'java');
    expect(lang).toBe('java');
    expect(content).toEqual({ prompt: fillContent.prompt, code: fillContent.variants.java.code });
  });

  it('다른 언어의 코드와 정답은 응답에 없다', () => {
    const { content } = publicContentFor(fillContent, 'python');
    const text = JSON.stringify(content);
    expect(text).toContain('a.___(3)');
    expect(text).not.toMatch(/ArrayList|const a|vector|push_back|variants|accepted/);
  });

  it('single: variant 보기가 있으면 그것을, 없으면 공통 보기를 쓴다', () => {
    expect(publicContentFor(singleContent, 'python').content).toMatchObject({ options: ['3', '3.5'] });
    expect(publicContentFor(singleContent, 'cpp').content).toMatchObject({ options: ['3', '3.5', '4'] });
  });

  it('variants 없는 문제는 그대로', () => {
    const plain = { prompt: '스택은?', options: ['LIFO', 'FIFO'] };
    expect(publicContentFor(plain, 'java')).toEqual({ content: plain, lang: null });
    expect(isVariantQuestion(plain)).toBe(false);
    expect(isVariantQuestion(fillContent)).toBe(true);
  });

  it('콘텐츠에 선호 언어 variant가 없으면 python → 있는 첫 언어로 대체하고 실제 언어를 알려 준다', () => {
    const { java: _java, ...variants } = fillContent.variants;
    expect(publicContentFor({ ...fillContent, variants }, 'java').lang).toBe('python');
    const { python: _py, ...noPy } = variants;
    expect(publicContentFor({ ...fillContent, variants: noPy }, 'java').lang).toBe('javascript');
  });
});

describe('언어별 채점', () => {
  const grade = (type: 'fill' | 'single', key: unknown, answer: unknown, lang?: Parameters<typeof resolveGradingKey>[2]) => {
    const r = resolveGradingKey(key, 'base 해설입니다 base 해설입니다', lang);
    return grader.grade(type, r.answerKey, answer);
  };

  it('fill: 언어마다 정답이 다르다', () => {
    expect(grade('fill', fillKey, { text: 'append' }, 'python')).toBe(true);
    expect(grade('fill', fillKey, { text: 'push' }, 'python')).toBe(false);
    expect(grade('fill', fillKey, { text: 'add' }, 'java')).toBe(true);
    expect(grade('fill', fillKey, { text: 'append' }, 'java')).toBe(false);
    expect(grade('fill', fillKey, { text: 'push' }, 'javascript')).toBe(true);
    expect(grade('fill', fillKey, { text: 'PUSH_BACK' }, 'cpp')).toBe(true);
    expect(grade('fill', fillKey, { text: 'push' }, 'cpp')).toBe(false);
  });

  it('single: 언어마다 정답 index가 다르다', () => {
    expect(grade('single', singleKey, { index: 1 }, 'javascript')).toBe(true);
    expect(grade('single', singleKey, { index: 1 }, 'java')).toBe(false);
    expect(grade('single', singleKey, { index: 0 }, 'cpp')).toBe(true);
  });

  it('variant 해설이 있으면 그것을, 없으면 공통 해설을 쓴다', () => {
    expect(resolveGradingKey(singleKey, '공통 해설', 'python').explanation).toContain('파이썬');
    expect(resolveGradingKey(singleKey, '공통 해설', 'java').explanation).toBe('공통 해설');
  });

  it('돌려주는 정답 키에는 다른 언어 정답이 없다', () => {
    const r = resolveGradingKey(fillKey, 'e', 'java');
    expect(r.answerKey).toEqual({ accepted: ['add'] });
    expect(JSON.stringify(r)).not.toMatch(/append|push/);
  });

  it('variants 없는 문제는 lang을 무시하고 일반 채점', () => {
    expect(grade('single', { index: 2 }, { index: 2 }, 'java')).toBe(true);
    expect(grade('single', { index: 2 }, { index: 2 })).toBe(true);
    expect(resolveGradingKey({ index: 2 }, 'e', 'java').lang).toBeNull();
  });

  it('variants 문제에 lang이 없거나 그 언어 variant가 없으면 거부', () => {
    expect(() => resolveGradingKey(fillKey, 'e', undefined)).toThrow(CodeLanguageUnavailable);
    const { cpp: _cpp, ...partial } = fillKey.variants;
    expect(() => resolveGradingKey({ variants: partial }, 'e', 'cpp')).toThrow(CodeLanguageUnavailable);
  });
});

describe('세션: 받은 언어로 채점하고 기록한다', () => {
  const user = UserId.of('11111111-1111-1111-1111-111111111111');
  const qid = QuestionId.of('00000000-0000-0000-0000-000000000001');

  it('설정이 바뀌어도 제출된 lang의 variant로 채점되고 답안에 언어가 남는다', () => {
    const s = LessonSession.start({ userId: user, kind: 'lesson', lessonId: LessonId.of(1), questionIds: [qid] });
    const { answerKey, explanation, lang } = resolveGradingKey(fillKey, 'e', 'python');
    const a = s.submitAnswer({ id: qid, type: 'fill', version: 1, answerKey, explanation }, withLanguage({ text: 'append' }, lang), 500, grader);
    expect(a.isCorrect).toBe(true);
    expect(languageOfRecordedAnswer(a.raw)).toBe('python');
  });

  it('언어 기록이 없는 답안은 null', () => {
    expect(languageOfRecordedAnswer({ index: 1 })).toBeNull();
    expect(languageOfRecordedAnswer({ text: 'x', lang: 'cobol' })).toBeNull();
  });
});

describe('seed-diff — variants 필드 변경도 내용 변경으로 본다', () => {
  const base: QuestionData = {
    type: 'fill',
    content: fillContent,
    answerKey: fillKey,
    explanation: 'e'.repeat(30),
    difficulty: 1,
    tags: [],
    refs: [],
    lessonId: 1,
    sortOrder: 1,
    status: 'published',
  };
  it('같으면 same(키 순서가 달라도), variant 정답이 바뀌면 content', () => {
    const reordered = { ...base, answerKey: { variants: { cpp: fillKey.variants.cpp, python: fillKey.variants.python, javascript: fillKey.variants.javascript, java: fillKey.variants.java } } };
    expect(classifyQuestion(base, reordered)).toBe('same');
    const changedKey = { ...base, answerKey: { variants: { ...fillKey.variants, java: { accepted: ['push'] } } } };
    expect(classifyQuestion(base, changedKey)).toBe('content');
    const changedCode = { ...base, content: { ...fillContent, variants: { ...fillContent.variants, cpp: { code: { language: 'cpp', source: 'v.___(3);' } } } } };
    expect(classifyQuestion(base, changedCode)).toBe('content');
  });
});
