/**
 * 배치 테스트 연속 흐름 상태 (탭별, sessionStorage).
 * 온보딩 "조금 알아요" / "잘 알아요"에서 시작한 유닛 건너뛰기 테스트를 이어 주기 위해
 * 결과 화면이 "다음 유닛 테스트"를 보여 줄지 판단하는 데 쓴다.
 * sessionId는 지금 진행 중인(혹은 방금 끝난) 테스트 세션이다. 결과 화면은 자기 세션과 같을 때만 체인으로 취급한다.
 */
export type PlacementChain = {
  /**
   * chain = "조금 알아요"(앞 유닛부터 연달아 테스트), pick = "잘 알아요"(고른 유닛 하나만 테스트).
   * pick은 실패해도 아무것도 완료 처리되지 않아 트랙 처음부터 시작하므로 결과 문구가 다르다
   */
  mode: 'chain' | 'pick';
  /** 트랙 slug — 끝나면 /learn?track= 으로 돌아간다 */
  track: string;
  /** 테스트할 유닛 순서 */
  units: { id: number; name: string }[];
  /** 지금 테스트 중인 유닛의 units 인덱스 (0부터) */
  index: number;
  sessionId: string;
};

const KEY = 'cs-daily:placement-chain';

function isPlacementChain(v: unknown): v is PlacementChain {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as Partial<PlacementChain>;
  return (
    (c.mode === 'chain' || c.mode === 'pick') &&
    typeof c.track === 'string' &&
    typeof c.sessionId === 'string' &&
    Array.isArray(c.units) &&
    c.units.every((u) => typeof u?.id === 'number' && typeof u?.name === 'string') &&
    Number.isInteger(c.index) &&
    c.index! >= 0 &&
    c.index! < c.units.length
  );
}

export function writePlacementChain(c: PlacementChain) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // 저장 불가 환경이면 체인 없이 기존 결과 화면으로 동작
  }
}

/** window가 없거나 값이 없거나 깨졌으면 null */
export function readPlacementChain(): PlacementChain | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPlacementChain(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPlacementChain() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 저장 불가 환경이면 지울 것도 없다
  }
}

/**
 * 테스트 결과 다음에 할 일. 통과했고 다음 유닛이 남았으면 next(index = 다음 유닛의 인덱스), 아니면 done.
 * 실패하면 거기서 멈춘다 (더 어려운 유닛은 테스트하지 않는다).
 */
export function nextPlacementStep(
  chain: PlacementChain,
  passed: boolean,
): { kind: 'next'; unit: { id: number; name: string }; index: number } | { kind: 'done' } {
  if (!passed) return { kind: 'done' };
  const index = chain.index + 1;
  const unit = chain.units[index];
  return unit ? { kind: 'next', unit, index } : { kind: 'done' };
}
