/**
 * 시드 비교용 순수 함수 — DB에 접근하지 않는다 (apps/api/test/seed-diff.spec.ts에서 단위 테스트).
 * 운영 DB는 왕복 지연이 커서, 시드는 기존 행을 한 번에 읽어 이 함수들로 비교하고 바뀐 것만 쓴다.
 */

/** 객체 키 순서와 undefined 값 키에 영향받지 않는 JSON 직렬화 (jsonb는 키 순서를 보존하지 않는다) */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : canonicalize(v)));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[key];
      if (v !== undefined) out[key] = canonicalize(v);
    }
    return out;
  }
  return value;
}

// ── 문제 ────────────────────────────────────────────────

/** 문제의 내용 — 바뀌면 version을 올린다 (Answer.questionVersion이 "어느 판을 풀었는지" 기록한다) */
export interface QuestionContent {
  type: string;
  content: unknown;
  answerKey: unknown;
  explanation: string;
  difficulty: number;
  tags: string[];
  refs: string[];
}

/** 문제의 배치·상태 — 바뀌어도 내용이 같으면 version은 그대로 */
export interface QuestionPlacement {
  lessonId: number;
  sortOrder: number;
  status: string;
}

export type QuestionData = QuestionContent & QuestionPlacement;

export type QuestionChange = 'create' | 'content' | 'placement' | 'same';

export function questionContentEqual(a: QuestionContent, b: QuestionContent): boolean {
  return (
    a.type === b.type &&
    a.explanation === b.explanation &&
    a.difficulty === b.difficulty &&
    canonicalJson(a.tags) === canonicalJson(b.tags) &&
    canonicalJson(a.refs) === canonicalJson(b.refs) &&
    canonicalJson(a.content) === canonicalJson(b.content) &&
    canonicalJson(a.answerKey) === canonicalJson(b.answerKey)
  );
}

export function questionPlacementEqual(a: QuestionPlacement, b: QuestionPlacement): boolean {
  return a.lessonId === b.lessonId && a.sortOrder === b.sortOrder && a.status === b.status;
}

/** create: 새 문제 · content: 내용이 바뀜(version+1) · placement: 위치·상태만 바뀜 · same: 쓸 것 없음 */
export function classifyQuestion(existing: QuestionData | undefined, desired: QuestionData): QuestionChange {
  if (!existing) return 'create';
  if (!questionContentEqual(existing, desired)) return 'content';
  if (!questionPlacementEqual(existing, desired)) return 'placement';
  return 'same';
}

// ── 커리큘럼 (트랙·유닛·레슨) ──────────────────────────────

export interface LessonShape {
  slug: string;
  name: string;
  objective: string | null;
  keyPoints: string[];
  sortOrder: number;
}

export interface UnitShape {
  slug: string;
  name: string;
  sortOrder: number;
  lessons: LessonShape[];
}

export interface TrackShape {
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  units: UnitShape[];
}

/**
 * DB에서 읽은 트랙(퇴역 음수 행 포함)이 콘텐츠가 원하는 구조와 완전히 같은가.
 * 양수 순서의 유닛·레슨만 비교한다 — 음수(퇴역) 행은 `hasRetiredRows`가 따로 본다.
 * 순서(배열 위치가 아니라 sortOrder)·slug·이름·objective·keyPoints·트랙 필드가 모두 같아야 true.
 */
export function trackStructureEqual(existing: TrackShape, desired: TrackShape): boolean {
  if (
    existing.name !== desired.name ||
    existing.description !== desired.description ||
    existing.sortOrder !== desired.sortOrder ||
    existing.isActive !== desired.isActive
  ) {
    return false;
  }
  return canonicalJson(positiveStructure(existing.units)) === canonicalJson(positiveStructure(desired.units));
}

function positiveStructure(units: UnitShape[]) {
  return units
    .filter((u) => u.sortOrder > 0)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((u) => ({
      slug: u.slug,
      name: u.name,
      sortOrder: u.sortOrder,
      lessons: u.lessons
        .filter((l) => l.sortOrder > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((l) => ({ slug: l.slug, name: l.name, objective: l.objective ?? null, keyPoints: l.keyPoints, sortOrder: l.sortOrder })),
    }));
}

/** 음수(퇴역) 순서의 유닛·레슨이나, 음수 유닛에 속한 레슨이 남아 있는가 — 있으면 시드의 퇴역 정리를 돌려야 한다 */
export function hasRetiredRows(units: UnitShape[]): boolean {
  return units.some((u) => u.sortOrder <= 0 || u.lessons.some((l) => l.sortOrder <= 0));
}

/** 콘텐츠(curriculum.json의 한 트랙)가 원하는 구조 */
export function desiredTrackShape(
  t: {
    name: string;
    description: string;
    phase: string;
    units: { slug: string; name: string; lessons: { slug: string; name: string; objective: string; keyPoints: string[] }[] }[];
  },
  trackIndex: number,
): TrackShape {
  return {
    name: t.name,
    description: t.description,
    sortOrder: trackIndex + 1,
    isActive: t.phase === 'mvp',
    units: t.units.map((u, ui) => ({
      slug: u.slug,
      name: u.name,
      sortOrder: ui + 1,
      lessons: u.lessons.map((l, li) => ({ slug: l.slug, name: l.name, objective: l.objective, keyPoints: l.keyPoints, sortOrder: li + 1 })),
    })),
  };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
