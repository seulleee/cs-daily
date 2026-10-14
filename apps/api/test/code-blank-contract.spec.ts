import { describe, expect, it } from 'vitest';
import { QuestionFile } from '@cs-daily/contracts';

const base = {
  id: 'eip-code-blank-001',
  difficulty: 2,
  tags: [],
  explanation: '상속은 extends 키워드로 표현하며 자식 클래스가 부모를 이어받는다.',
  refs: [],
};

describe('코드 빈칸 문제 스키마', () => {
  it('fill: code에만 빈칸이 있어도 통과', () => {
    const r = QuestionFile.safeParse({
      ...base,
      type: 'fill',
      content: { prompt: '빈칸에 들어갈 키워드는?', code: { language: 'java', source: 'class B ___ A {}' } },
      answer_key: { accepted: ['extends'] },
    });
    expect(r.success).toBe(true);
  });

  it('fill: prompt에만 빈칸이 있어도 통과', () => {
    const r = QuestionFile.safeParse({
      ...base,
      type: 'fill',
      content: { prompt: '상속은 ___ 로 표현한다.' },
      answer_key: { accepted: ['extends'] },
    });
    expect(r.success).toBe(true);
  });

  it('fill: prompt와 code 모두 빈칸이 없으면 실패', () => {
    const r = QuestionFile.safeParse({
      ...base,
      type: 'fill',
      content: { prompt: '키워드는?', code: { language: 'java', source: 'class B extends A {}' } },
      answer_key: { accepted: ['extends'] },
    });
    expect(r.success).toBe(false);
  });

  it('code.language는 허용 목록만', () => {
    const r = QuestionFile.safeParse({
      ...base,
      type: 'single',
      content: { prompt: '출력값은?', code: { language: 'ruby', source: 'puts 1' }, options: ['1', '2'] },
      answer_key: { index: 0 },
    });
    expect(r.success).toBe(false);
  });

  it('single: code 안 빈칸 + 보기', () => {
    const r = QuestionFile.safeParse({
      ...base,
      type: 'single',
      content: { prompt: '빈칸에 들어갈 것은?', code: { language: 'c', source: 'for (int i = 0; i < 3; ___)' }, options: ['i++', 'i--'] },
      answer_key: { index: 0 },
    });
    expect(r.success).toBe(true);
  });
});
