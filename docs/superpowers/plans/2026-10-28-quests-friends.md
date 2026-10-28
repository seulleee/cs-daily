# 데일리 퀘스트 · 친구 · 프렌즈 퀘스트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데일리 퀘스트(하루 3개, 개당 10 XP), 닉네임 검색 친구, 주간 1:1 프렌즈 퀘스트(합산 레슨 15개, 둘 다 50 XP)를 PR 3개로 출시한다.

**Architecture:** 새 컨텍스트 `quests`(퀘스트 뽑기·진행·지급, 짝 짓기)와 `social`(친구·차단·검색)을 기존 DDD 4계층으로 추가한다. 진행은 원장(`lesson_sessions`·`xp_events`)에서 계산하고, 지급 기록(`QuestReward`)만 저장한다. 레슨 완료 핸들러가 진행도 기록 직후 `EvaluateQuestsCommand`를 호출하고, 결과를 응답의 `questRewards`로 돌려준다.

**Tech Stack:** NestJS + @nestjs/cqrs, Prisma(Postgres), zod(`@cs-daily/contracts`), vitest, tsx e2e, Next.js 15 + React Query, Tailwind(Platinum 토큰).

**Spec:** `docs/superpowers/specs/2026-10-28-quests-friends-design.md` — 실행자는 이 계획과 spec을 함께 읽는다.

## Global Constraints

- 모든 커밋·문서·UI 문구는 한국어. 커밋 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`와 `Claude-Session: https://claude.ai/code/session_01G9zmAWddL43kkWxrFeMSEm` 두 줄.
- 커밋 전 통과: `pnpm content:validate`, `pnpm --filter @cs-daily/api test`, `pnpm lint`, `pnpm typecheck`, 바꾼 앱의 `build`. 새 워크트리는 먼저 `pnpm install --frozen-lockfile`, `pnpm --filter @cs-daily/contracts build`, apps/api에서 `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 PRISMA_SCHEMA_ENGINE_BINARY=/bin/true PRISMA_QUERY_ENGINE_LIBRARY=/bin/true npx prisma generate --no-engine`.
- 마이그레이션 SQL은 손으로 쓰지 않는다. `chore/migration-<이름>` 브랜치에 schema.prisma를 푸시하면 `prisma-migration.yml`이 SQL을 생성해 같은 브랜치에 커밋한다. 그 커밋을 기능 브랜치로 가져온다.
- 레이어 규칙(`apps/api/eslint.config.mjs`): domain은 Nest·Prisma import 금지. 다른 컨텍스트는 그 컨텍스트의 `domain/ports`, `domain/events`, `application/commands|queries`만 import한다. 포트는 **쓰는 쪽 컨텍스트의 `domain/ports`에 정의**하고 제공하는 쪽 infrastructure가 구현한다(`learning/domain/ports`의 `USER_PREFS_PORT`와 같은 방식).
- 정답 키(`answerKey`)는 어떤 새 쿼리도 select하지 않는다.
- 데일리 퀘스트 날짜는 `User.timezone` 기준 로컬 날짜(`localDateOf`). 프렌즈 퀘스트 주는 **Asia/Seoul 고정**, 월요일 00:00 ~ 다음 월요일 00:00.
- 값: 데일리 퀘스트 3개·개당 10 XP. `lessons` 목표 = `dailyGoal + 1`, `xp` 목표 = 30, `perfect` 1, `review` 1, `accurate`(정답률 ≥ 0.9) 2. 프렌즈 목표 15, 보상 50 XP(두 사람 모두). 친구 100명, 보낸 대기 요청 20개. 검색은 2글자 이상, 최대 10명, 분당 30회. 짝 대상은 최근 14일 안에 레슨을 완료한 사용자.
- UI 문구(그대로): 퀘스트 제목 `레슨 {N}개 완료하기` · `XP {N} 모으기` · `100점 레슨 1개` · `복습 1회 하기` · `정답률 90% 이상 레슨 2개` · `친구와 레슨 15개`. 창 제목 `오늘의 퀘스트` · `친구 퀘스트`. 짝 없음 `친구를 추가하면 다음 퀘스트가 시작돼요`. 결과 줄 `퀘스트 완료 +{xp} XP`. 설정 스위치 `닉네임으로 나를 찾을 수 있음`. 탭 이름 `친구`.
- 화면은 CLAUDE.md "화면 규칙(Platinum)"을 따른다. 색은 CSS 변수만, 새 모션 금지(기존 check 스탬프만), 아이콘은 `components/icons.tsx` 인라인 SVG, 디스플레이 글꼴 크기는 `bit`/`bit-2`/`bit-3`만.

## Review Focus

1. **복습 퀘스트가 하루 중에 사라지는 경우.** 아침에 복습 퀘스트를 뽑은 사용자가 복습을 다 하면 due가 0이 된다. 그래도 그날 퀘스트 3개는 바뀌지 않아야 한다. 자격은 "오늘 끝까지 due 수 > 0 **또는** 오늘 완료한 복습 세션 > 0"으로 판단한다(Task 1.2 테스트).
2. **타임존 경계의 레슨.** 사용자 로컬 23:59에 끝낸 레슨은 그날 퀘스트에, 00:01에 끝낸 레슨은 다음 날 퀘스트에 들어가야 한다. 프렌즈 퀘스트는 서울 일요일 23:59와 월요일 00:00 경계를 지켜야 한다(Task 1.1, 3.1 테스트).
3. **두 사람이 동시에 목표를 채울 때.** 프렌즈 퀘스트 보상이 사람당 정확히 한 번만 지급되어야 하고, 충돌 때문에 레슨 완료가 실패하면 안 된다(Task 3.3 e2e).
4. **차단이 정보를 흘리는 경우.** 차단당한 사람이 검색·요청 응답 차이로 차단 사실을 알 수 없어야 한다. 검색에서 빠지고, 요청은 202로 똑같이 응답한다(Task 2.2 테스트).
5. **퀘스트 평가가 실패할 때.** DB 오류가 나도 레슨 완료 응답은 성공(`questRewards: []`)이어야 하고, 다음 완료에서 빠진 보상이 지급되어야 한다(Task 1.3 테스트).

---

# PR 1 — 데일리 퀘스트 (`feat/daily-quests`)

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `apps/api/prisma/schema.prisma` | `QuestReward` 모델 추가 |
| `packages/contracts/src/quests.ts` (신규) · `index.ts` · `sessions.ts` | `QuestKey`, `DailyQuest`, `MeQuestsResponse`, `QuestRewardItem`; `CompleteSessionResponse.questRewards` 선택 필드 |
| `apps/api/src/modules/quests/domain/daily-quests.ts` | 순수 함수: 뽑기·목표·제목·완료 판정 |
| `apps/api/src/modules/quests/domain/ports.ts` | `XP_LEDGER_PORT`, `QUEST_ACTIVITY_PORT`, `QUEST_REWARD_REPO` 인터페이스 |
| `apps/api/src/modules/quests/infrastructure/prisma-quest-activity.ts` | 로컬 날짜 범위의 세션·XP 집계 SQL |
| `apps/api/src/modules/quests/infrastructure/prisma-quest-reward.repository.ts` | `QuestReward` INSERT(중복이면 false) |
| `apps/api/src/modules/quests/application/evaluate-quests.handler.ts` | `EvaluateQuestsCommand` |
| `apps/api/src/modules/quests/application/get-my-quests.handler.ts` | `GetMyQuestsQuery` |
| `apps/api/src/modules/quests/presentation/quests.controller.ts` | `GET /me/quests` |
| `apps/api/src/modules/quests/quests.module.ts` · `src/app.module.ts` | 모듈 등록 |
| `apps/api/src/modules/progression/infrastructure/xp-ledger.adapter.ts` · `progression.module.ts` | `XP_LEDGER_PORT` 구현·제공 |
| `apps/api/src/modules/learning/application/commands/complete-session.handler.ts` | 진행도 기록 뒤 `EvaluateQuestsCommand` 호출 |
| `apps/web/src/components/quests-panel.tsx` (신규) · `app/(main)/learn/page.tsx` · `components/stats-panel.tsx` · `components/lesson-player.tsx` | 퀘스트 창, 결과 화면 줄 |
| `apps/api/test/daily-quests.spec.ts` · `apps/api/test-e2e/quests.e2e.ts` · `apps/api/package.json`(`test:e2e`에 추가) | 테스트 |

### Task 1.1: 스키마·계약·도메인 순수 함수

**Files:**
- Modify: `apps/api/prisma/schema.prisma`, `packages/contracts/src/index.ts`, `packages/contracts/src/sessions.ts`
- Create: `packages/contracts/src/quests.ts`, `apps/api/src/modules/quests/domain/daily-quests.ts`
- Test: `apps/api/test/daily-quests.spec.ts`

**Interfaces:**
- Produces (contracts):
  - `QuestKey = z.enum(['lessons','xp','perfect','review','accurate'])`
  - `DailyQuest = { key: QuestKey; title: string; progress: number; goal: number; done: boolean; xp: number }`
  - `QuestRewardItem = { key: QuestKey | 'friend'; title: string; xp: number }`
  - `MeQuestsResponse = { date: string; daily: DailyQuest[]; friend: FriendQuestView | null }`. `FriendQuestView`는 PR 3에서 채우고, PR 1에서는 `z.null()` 자리만 둔다: `friend: z.null()`.
  - `CompleteSessionResponse.questRewards: z.array(QuestRewardItem).optional()`
- Produces (domain, `quests/domain/daily-quests.ts`):
  - `DAILY_QUEST_XP = 10`, `DAILY_QUEST_COUNT = 3`
  - `pickDailyQuests(userId: string, localDate: string, opts: { reviewEligible: boolean }): QuestKey[]` — 결정적, 중복 없음, 길이 3
  - `goalOf(key: QuestKey, dailyGoal: number): number`
  - `titleOf(key: QuestKey, goal: number): string`
  - `interface DayActivity { lessons: number; perfect: number; accurate: number; reviews: number; xpExcludingQuest: number }`
  - `progressOf(key: QuestKey, a: DayActivity): number`
- Produces (Prisma): 모델 `QuestReward { userId, questKey VarChar(20), period Date, xp Int, createdAt }`, `@@id([userId, questKey, period])`, `@@map("quest_rewards")`, snake_case `@map`, `User` 관계 `onDelete: Cascade`(User에 `questRewards QuestReward[]` 추가).

- [ ] **Step 1: 실패하는 테스트 작성** — `apps/api/test/daily-quests.spec.ts`:
  - `같은 사용자·날짜면 같은 3개`: `pickDailyQuests('u1','2026-10-28',{reviewEligible:true})`를 두 번 호출하면 같은 배열이고, 길이는 3, `new Set(...).size === 3`.
  - `날짜가 바뀌면 조합이 달라질 수 있다`: 2026-10-01~2026-10-31 31일 동안 'u1'의 결과 문자열 집합 크기가 2 이상.
  - `reviewEligible=false면 review 없음`: 31일 모두 `review`를 포함하지 않는다.
  - `goalOf`: `goalOf('lessons', 1) === 2`, `goalOf('lessons', 3) === 4`, `goalOf('xp', 1) === 30`, `goalOf('perfect',1) === 1`, `goalOf('review',1) === 1`, `goalOf('accurate',1) === 2`.
  - `titleOf`: `titleOf('lessons',2) === '레슨 2개 완료하기'`, `titleOf('xp',30) === 'XP 30 모으기'`, `titleOf('accurate',2) === '정답률 90% 이상 레슨 2개'`.
  - `progressOf`: `xp` 키는 `xpExcludingQuest`만 쓰고, 나머지 키는 각 필드에 대응한다.
- [ ] **Step 2: 실패 확인** — `pnpm --filter @cs-daily/api exec vitest run test/daily-quests.spec.ts` → 모듈 없음으로 FAIL.
- [ ] **Step 3: 구현** — 시드는 `fnv1a32(`${userId}:${localDate}`)`, `mulberry32(seed)`로 후보 배열(`reviewEligible`가 false면 `review` 제외, 순서 `['lessons','xp','perfect','review','accurate']`)을 Fisher-Yates로 섞어 앞 3개를 쓴다. 두 해시 함수는 같은 파일의 비공개 함수로 둔다. 계약 파일과 Prisma 모델을 위 Interfaces대로 추가하고, `prisma generate --no-engine`으로 타입을 생성한다.
- [ ] **Step 4: 통과 확인** — 같은 vitest 명령 PASS, `pnpm --filter @cs-daily/contracts build`, `pnpm typecheck` 통과.
- [ ] **Step 5: 커밋** — `feat(quests): 데일리 퀘스트 도메인·계약·QuestReward 스키마`.

### Task 1.2: 집계·지급 인프라와 평가·조회 핸들러

**Files:**
- Create: `quests/domain/ports.ts`, `quests/infrastructure/prisma-quest-activity.ts`, `quests/infrastructure/prisma-quest-reward.repository.ts`, `quests/application/evaluate-quests.handler.ts`, `quests/application/get-my-quests.handler.ts`, `quests/application/commands.ts`, `progression/infrastructure/xp-ledger.adapter.ts`, `quests/quests.module.ts`
- Modify: `progression/progression.module.ts`, `src/app.module.ts`
- Test: `apps/api/test/daily-quests.spec.ts`(핸들러 단위 — 포트를 가짜로 주입)

**Interfaces:**
- Consumes: Task 1.1의 도메인 함수·계약 타입. `USER_PREFS_PORT`(learning/domain/ports, `prefsOf(userId) → { timeZone, ... }`). `dailyGoal`은 `QUEST_ACTIVITY_PORT.dailyGoalOf`로 읽는다. `CountDueReviewsQuery(userId, cutoff: Date)`(review/application/queries).
- Produces (`quests/domain/ports.ts`):
  - `XP_LEDGER_PORT`: `interface XpLedgerPort { credit(input: { userId: string; amount: number; reason: 'quest'; at: Date }): Promise<void> }` — progression 어댑터가 `xp_events` INSERT, `user_stats.total_xp` 증가, 사용자 로컬 날짜 `daily_activity.xp` upsert 증가를 `UnitOfWork` 현재 트랜잭션에서 한다(`lessonsCompleted`는 건드리지 않는다).
  - `QUEST_ACTIVITY_PORT`: `interface QuestActivityPort { dayActivity(userId: string, from: Date, to: Date): Promise<DayActivity>; dailyGoalOf(userId: string): Promise<number> }` — `[from, to)`에 `finished_at`이 든 세션만 센다. `placement` 제외, `lesson`만 lessons·perfect·accurate, `review`만 reviews. 문제 수는 `cardinality(question_ids)`.
  - `QUEST_REWARD_REPO`: `interface QuestRewardRepository { tryInsert(r: { userId: string; questKey: string; period: string; xp: number }): Promise<boolean>; grantedKeys(userId: string, period: string): Promise<string[]> }` — 중복(P2002)이면 `false`.
  - `class EvaluateQuestsCommand { constructor(readonly userId: string, readonly at: Date) }` → 결과 `QuestRewardItem[]`
  - `class GetMyQuestsQuery { constructor(readonly userId: string, readonly at: Date) }` → `MeQuestsResponse`
- 규칙: 로컬 날짜 범위 = `[zonedMidnightToUtc(date, tz), zonedMidnightToUtc(addDaysToLocalDate(date, 1), tz))`. `reviewEligible = (CountDueReviewsQuery(userId, 그날 끝) > 0) || dayActivity.reviews > 0`. 평가는 `uow.run` 안에서 퀘스트마다 `tryInsert` → true면 `credit` 순서로 처리한다.

- [ ] **Step 1: 실패하는 테스트 작성** — 가짜 포트로 핸들러를 직접 생성:
  - `목표 도달 퀘스트만 지급`: `dayActivity` lessons=2(dailyGoal=1), 나머지 0, 뽑힌 키에 `lessons`가 있도록 고른 사용자·날짜에서 `EvaluateQuestsHandler.execute` → `[{ key:'lessons', title:'레슨 2개 완료하기', xp:10 }]`, `credit`가 `amount: 10`으로 1회 호출.
  - `이미 지급된 퀘스트는 다시 주지 않음`: `tryInsert`가 false를 돌려주면 결과 `[]`, `credit` 0회.
  - `복습을 다 끝낸 날에도 review 유지`(Review Focus 1): due=0, reviews=1이면 `pickDailyQuests`에 `reviewEligible: true`가 전달된다(due=0, reviews=0일 때와 결과가 다른 날짜 하나로 단언).
  - `GetMyQuests`: 3개 항목의 `progress`가 `goal`을 넘지 않게 `Math.min`된 값이고, `done`은 `progress >= goal`, `friend`는 `null`.
- [ ] **Step 2: 실패 확인** — vitest FAIL.
- [ ] **Step 3: 구현** — 위 파일들을 만들고 `QuestsModule`이 핸들러·컨트롤러·`QUEST_ACTIVITY_PORT`·`QUEST_REWARD_REPO`를 제공한다. `ProgressionModule`은 `XpLedgerAdapter`를 `{ provide: XP_LEDGER_PORT, useExisting }`로 제공·export하고, `QuestsModule`이 `ProgressionModule`을 import한다(identity의 `USER_PREFS_PORT` 패턴).
- [ ] **Step 4: 통과 확인** — vitest PASS, `pnpm lint`(boundaries 위반 0), `pnpm typecheck`.
- [ ] **Step 5: 커밋** — `feat(quests): 퀘스트 평가·조회 핸들러와 XP 원장 포트`.

### Task 1.3: API 연결 — `GET /me/quests`와 세션 완료

**Files:**
- Create: `quests/presentation/quests.controller.ts`, `apps/api/test-e2e/quests.e2e.ts`
- Modify: `learning/application/commands/complete-session.handler.ts`, `apps/api/package.json`
- Test: `apps/api/test-e2e/quests.e2e.ts`, `apps/api/test/daily-quests.spec.ts`

**Interfaces:**
- Consumes: `EvaluateQuestsCommand`, `GetMyQuestsQuery`.
- Produces: `GET /me/quests`(JwtAuthGuard, `@CurrentUser()`) → `MeQuestsResponse`. `POST /sessions/:id/complete` 응답에 `questRewards`.
- 규칙: `CompleteSessionHandler`는 `RecordSessionCompletionCommand` 뒤에 `EvaluateQuestsCommand`를 `try/catch`로 실행한다. 실패하면 `Logger.warn`을 남기고 `questRewards: []`로 응답한다. 컨트롤러 경로는 `@Controller('me')` + `@Get('quests')`이고, 기존 `MeController`와 경로가 겹치지 않는지 확인한다.

- [ ] **Step 1: 실패하는 테스트 작성**
  - 단위: `평가가 던져도 완료는 성공`(Review Focus 5) — `CommandBus.execute`가 `EvaluateQuestsCommand`에서 throw하도록 가짜를 주입하면 `CompleteSessionHandler.execute` 결과의 `questRewards`가 `[]`.
  - e2e(`demand.e2e.ts`의 `asUser`·prisma 시드 방식):
    - 사용자 생성 → 레슨 세션 시작·전 문제 정답 제출·완료 → `GET /me/quests`에서 `daily.length === 3`, `lessons`의 `progress === 1`.
    - 같은 날 두 번째 레슨 완료 → 응답 `questRewards`에 `lessons`가 정확히 1개, `xp_events`에 `reason='quest'` 행 1개.
    - 세 번째 완료 → `questRewards`에 `lessons` 없음(중복 지급 없음).
    - 사용자 timezone을 `America/Los_Angeles`로 바꾸고 `finished_at`이 그 로컬 전날 23:59인 세션을 시드하면, 오늘 `lessons` 진행에 세지 않는다(Review Focus 2).
- [ ] **Step 2: 실패 확인** — 단위 vitest FAIL. e2e는 CI에서만 돈다. 로컬 DB가 없으면 `pnpm --filter @cs-daily/api build`와 typecheck로 대신한다.
- [ ] **Step 3: 구현** — 컨트롤러와 핸들러를 연결하고, `package.json`의 `test:e2e` 끝에 `&& tsx test-e2e/quests.e2e.ts`를 추가한다.
- [ ] **Step 4: 통과 확인** — `pnpm --filter @cs-daily/api test`, `pnpm --filter @cs-daily/api build`, lint, typecheck.
- [ ] **Step 5: 커밋** — `feat(quests): GET /me/quests와 세션 완료 시 퀘스트 지급`.

### Task 1.4: 웹 — 퀘스트 창과 결과 화면

**Files:**
- Create: `apps/web/src/components/quests-panel.tsx`
- Modify: `apps/web/src/app/(main)/learn/page.tsx`, `apps/web/src/components/stats-panel.tsx`, `apps/web/src/components/lesson-player.tsx`

**Interfaces:**
- Consumes: `MeQuestsResponse`, `QuestRewardItem`(contracts), `api()`(lib/api.ts), `Window`(components/window.tsx), `.meter` 클래스, `CheckIcon`.
- Produces: `export function QuestsPanel({ data, compact }: { data: MeQuestsResponse; compact?: boolean })` — 창 제목 `오늘의 퀘스트`, 항목마다 제목·`progress/goal`·`.meter` 막대·완료 시 `CheckIcon`. React Query 키 `['me','quests']`.
- 규칙: PC(`lg:`)는 `StatsPanel` 아래, 모바일은 `/learn` 경로 위에 `compact` 접힘 창(기본 접힘, 제목 줄에 `완료 수/3`). 세션 완료 후 `['me','quests']`를 invalidate한다. 결과 화면은 `questRewards`마다 `퀘스트 완료 +{xp} XP` 줄을 기존 결과 항목 형식으로 추가한다.

- [ ] **Step 1: 구현** — 위 컴포넌트·배치·invalidate를 넣는다.
- [ ] **Step 2: 검증** — `pnpm --filter @cs-daily/web build`, lint, typecheck 통과. Playwright(목 API — `/tmp/claude-0/-home-user-cs-daily/53e7cf87-a783-5da8-84c2-7c0c58fafbec/scratchpad/preview/mock.js` 방식 재사용)로 모바일 390×844·PC 1280×800·다크 테마에서 `/learn` 퀘스트 창(진행 0/1/완료 섞임)과 결과 화면 `퀘스트 완료 +10 XP`를 스크린샷으로 확인한다. 스크린샷은 scratchpad에 둔다.
- [ ] **Step 3: 커밋** — `feat(web): 오늘의 퀘스트 창과 결과 화면 보상 표시`.

### Task 1.5: 마이그레이션·PR·배포

- [ ] **Step 1:** `chore/migration-quest-rewards` 브랜치를 main에서 따서 schema.prisma 변경만 커밋·푸시한다. `prisma-migration` 워크플로가 성공하고 마이그레이션 커밋을 남기는지 `gh api repos/seulleee/cs-daily/actions/runs?branch=chore/migration-quest-rewards`로 확인한다.
- [ ] **Step 2:** 생성된 `apps/api/prisma/migrations/*_quest_rewards/migration.sql`을 기능 브랜치로 가져온다(`git checkout origin/chore/migration-quest-rewards -- apps/api/prisma/migrations`). SQL에 `CREATE TABLE "quest_rewards"`만 있는지 읽어서 확인한다.
- [ ] **Step 3:** CLAUDE.md "아키텍처 규칙"에 quests 컨텍스트(진행은 원장 계산, `QuestReward` 멱등, `XP_LEDGER_PORT`, 완료 응답 `questRewards`)를, "화면 규칙"에 퀘스트 창 배치를 한 줄씩 추가한다. spec 상태 줄을 "PR 1 머지"로 고친다.
- [ ] **Step 4:** PR 생성(`gh api repos/seulleee/cs-daily/pulls`) → CI `check` 초록 → squash merge → `deploy-api` 성공과 Vercel Production 배포 성공을 확인한다.

---

# PR 2 — 친구 (`feat/friends`)

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `schema.prisma` | `User.discoverable`, `Friendship`(+enum), `UserBlock` |
| `packages/contracts/src/social.ts` (신규) · `me.ts` · `errors.ts` | 친구 계약, `UpdateMeRequest.discoverable`, `MeResponse.discoverable`, `ErrorCode.FRIEND_LIMIT` |
| `apps/api/src/modules/social/domain/friendship-rules.ts` | 순수 규칙: 쌍 정규화, 한도 판정, 요청 처리 결과 |
| `social/domain/events/index.ts` | `FriendshipAccepted`, `FriendshipEnded` |
| `social/infrastructure/prisma-social.repository.ts` | 친구·요청·차단·검색 쿼리 |
| `social/application/*.handler.ts` | 요청·수락·거절·취소·끊기·차단·해제·검색·목록 |
| `social/presentation/friends.controller.ts` · `blocks.controller.ts` | API |
| `social/social.module.ts` · `app.module.ts` | 등록 |
| `identity/presentation/me.controller.ts` | `discoverable` 읽기·쓰기 |
| `apps/web/src/app/(main)/friends/page.tsx` (신규) · `components/app-shell.tsx` · `components/icons.tsx` · `app/(main)/settings/page.tsx` | 친구 탭·페이지·배지·설정 스위치 |
| `apps/api/test/friendship-rules.spec.ts` · `test-e2e/friends.e2e.ts` | 테스트 |

### Task 2.1: 스키마·계약·도메인 규칙

**Interfaces:**
- Produces (Prisma): spec 5절 `Friendship`·`UserBlock`·`User.discoverable`(기본 true). snake_case `@map`, 테이블 `friendships`·`user_blocks`, FK는 `User`에 `onDelete: Cascade`.
- Produces (contracts `social.ts`):
  - `FriendUser = { userId: string; nickname: string; avatarUrl: string | null; streak: number }`
  - `FriendSummary = FriendUser & { weekLessons: number }`
  - `FriendRequestView = { id: string; user: FriendUser; createdAt: string }`
  - `FriendsResponse = { friends: FriendSummary[]; incoming: FriendRequestView[]; outgoing: FriendRequestView[] }`
  - `SearchUser = FriendUser & { relation: 'none' | 'friend' | 'outgoing' | 'incoming' }`, `FriendSearchResponse = { users: SearchUser[] }`
  - `SendFriendRequest = { userId: string(uuid) }`, `BlockRequest = { userId: string(uuid) }`
  - `ErrorCode`에 `FRIEND_LIMIT` 추가
- Produces (domain `friendship-rules.ts`):
  - `FRIEND_LIMIT = 100`, `PENDING_OUT_LIMIT = 20`, `SEARCH_MIN = 2`, `SEARCH_MAX = 10`
  - `pairKey(a: string, b: string): { low: string; high: string }`
  - `decideSend(ctx: { blockedEitherWay: boolean; existing: null | { status: 'pending' | 'accepted'; requesterId: string }; me: string; myFriends: number; myPendingOut: number; theirFriends: number }): 'silent' | 'already' | 'accept-reverse' | 'create' | 'limit'`
  - `escapeLike(q: string): string` — `\`, `%`, `_` 이스케이프

- [ ] **Step 1: 실패하는 테스트** (`friendship-rules.spec.ts`):
  - `pairKey('b','a')`는 `{low:'a',high:'b'}`.
  - `decideSend`: 차단 관계면 `'silent'`, 상대가 보낸 대기 요청이 있으면 `'accept-reverse'`, 내가 보낸 대기 요청이나 친구 관계가 있으면 `'already'`, `myPendingOut === 20`이면 `'limit'`, `myFriends === 100`이면 `'limit'`, 그 밖에는 `'create'`. 우선순위는 이 순서다.
  - `escapeLike('a%_\\')`는 `'a\\%\\_\\\\'`.
- [ ] **Step 2: 실패 확인** — vitest FAIL.
- [ ] **Step 3: 구현** — 위 Interfaces대로 작성하고 Prisma 타입을 생성한다.
- [ ] **Step 4: 통과 확인** — vitest PASS, contracts build, typecheck.
- [ ] **Step 5: 커밋** — `feat(social): 친구 스키마·계약·도메인 규칙`.

### Task 2.2: 친구 API

**Interfaces:**
- Consumes: Task 2.1 전부. `@Throttle`(@nestjs/throttler, `auth.controller.ts`에서 쓰는 방식).
- Produces: spec 5절 API 표의 친구·차단 엔드포인트.
  - `POST /friends/requests`는 `decideSend` 결과가 무엇이든 202 `{ status: 'sent' }`로 응답한다. 예외: `'limit'`은 409 `FRIEND_LIMIT`, `'accept-reverse'`는 수락 처리 후 202.
  - 수락·거절·취소는 권한 없거나 없는 id면 404.
  - 수락 시 두 사람 중 누구든 친구 100명이면 409 `FRIEND_LIMIT`.
  - 검색: `GET /friends/search?q=`, `@Throttle({ default: { limit: 30, ttl: 60_000 } })`, 2글자 미만은 400. `nickname ILIKE escapeLike(q) || '%'`, 자신·차단(양방향)·`discoverable=false`는 제외, 닉네임 오름차순 10개, `relation` 포함.
  - 차단: `POST /blocks`는 해당 쌍의 `Friendship`을 삭제하고 `UserBlock`을 upsert하며, 친구였으면 `FriendshipEnded`를 발행한다. `DELETE /blocks/:userId`는 차단 행만 삭제한다.
  - 친구 끊기: `DELETE /friends/:userId` → `FriendshipEnded` 발행.
  - 수락 → `FriendshipAccepted({ userA, userB, at })` 발행.
  - `GET /friends`의 `weekLessons`: 서울 주 시작부터 지금까지 `kind=lesson` 완료 세션 수(친구마다 집계 SQL 1회로 묶는다).
  - `PATCH /me { discoverable }` 반영, `GET /me`에 `discoverable` 포함.
- [ ] **Step 1: 실패하는 테스트** — `test-e2e/friends.e2e.ts`:
  - A가 B 검색 → B가 `relation:'none'`으로 나온다.
  - A→B 요청 → B의 `incoming` 1건 → B 수락 → 양쪽 `friends`에 서로 있음, 검색 `relation:'friend'`.
  - 맞요청: C→A 요청 대기 중 A→C 요청 → 바로 친구.
  - 차단(Review Focus 4): B가 A 차단 → A·B 친구 관계 없음, A의 검색에 B 없음, B의 검색에 A 없음, A→B 요청 응답이 202이고 B의 `incoming` 0건.
  - `discoverable=false`인 D는 검색에 없다.
  - 1글자 검색은 400.
  - 남의 요청 수락은 404.
  - A가 대기 요청 20개를 보낸 뒤 21번째 요청은 409 `FRIEND_LIMIT`.
- [ ] **Step 2: 실패 확인** — build·typecheck로 엔드포인트 부재를 확인한다(e2e는 CI).
- [ ] **Step 3: 구현** — 핸들러·컨트롤러·모듈을 만들고 `test:e2e`에 `friends.e2e.ts`를 추가한다.
- [ ] **Step 4: 통과 확인** — api test, build, lint, typecheck.
- [ ] **Step 5: 커밋** — `feat(social): 친구 요청·수락·차단·검색 API`.

### Task 2.3: 웹 — 친구 탭·페이지·설정

**Interfaces:**
- Consumes: `FriendsResponse`, `FriendSearchResponse`, `api()`.
- Produces: `/friends` 페이지(검색 입력 `.input`, 300ms 디바운스, 2글자부터 요청), 받은 요청(수락·거절 `.btn-outline`), 보낸 요청(취소), 친구 목록(닉네임·`{n}일째`·`이번 주 {n}개`), 항목 메뉴(친구 끊기·차단 — 확인 대화상자 `window.confirm` 대신 `Window` 안 확인 버튼). `icons.tsx`에 `UsersIcon` 추가, `app-shell.tsx` NAV를 학습·복습·친구·프로필·설정 순으로 바꾸고, `['friends']` 쿼리의 `incoming.length > 0`이면 아이콘 타일 옆에 숫자 배지를 단다. 설정 페이지에 "개인정보" 창과 `닉네임으로 나를 찾을 수 있음` 스위치(기존 저장 버튼·토스트 방식)를 넣는다.
- [ ] **Step 1: 구현**
- [ ] **Step 2: 검증** — web build·lint·typecheck. Playwright(목 API)로 모바일·PC·다크에서 탭 바 5칸(아이콘 타일 반전), 배지, 검색 결과, 요청 목록, 설정 스위치를 스크린샷으로 확인한다.
- [ ] **Step 3: 커밋** — `feat(web): 친구 탭·페이지와 검색 허용 설정`.

### Task 2.4: 마이그레이션·PR·배포
Task 1.5와 같은 절차로 진행한다. 브랜치는 `chore/migration-friends`이고, SQL에는 `friendships`·`user_blocks`·`users.discoverable`·enum만 있어야 한다. CLAUDE.md에 social 컨텍스트와 친구 화면 규칙을 추가한다.

---

# PR 3 — 프렌즈 퀘스트 (`feat/friend-quests`)

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `schema.prisma` | `FriendQuest`, `FriendQuestMember` |
| `contracts/quests.ts` | `FriendQuestView`, `MeQuestsResponse.friend` 교체 |
| `quests/domain/friend-quests.ts` | `weekStartSeoul`, `weekRangeUtc`, `pairFriends`, 상수 |
| `quests/domain/ports.ts` | `FRIENDS_PORT` 추가 |
| `social/infrastructure/friends.adapter.ts` · `social.module.ts` | `FRIENDS_PORT` 구현 |
| `quests/infrastructure/prisma-friend-quest.repository.ts` | 이번 주 퀘스트 조회·생성·종료, 멤버 레슨 수 집계 |
| `quests/application/pair-friend-quests.handler.ts` · `on-friendship-events.handler.ts` · `evaluate-quests.handler.ts`(확장) · `get-my-quests.handler.ts`(확장) | 배치·이벤트·지급·조회 |
| `jobs/jobs.controller.ts` | `friend-pairs` 슬롯 |
| `web/components/quests-panel.tsx` | 친구 퀘스트 창 |
| `test/friend-quests.spec.ts` · `test-e2e/friend-quests.e2e.ts` | 테스트 |

### Task 3.1: 주 경계·짝 짓기 순수 함수

**Interfaces:**
- Produces (`quests/domain/friend-quests.ts`):
  - `FRIEND_QUEST_GOAL = 15`, `FRIEND_QUEST_XP = 50`, `ACTIVE_DAYS = 14`
  - `weekStartSeoul(now: Date): string` — 서울 로컬 날짜의 그 주 월요일(YYYY-MM-DD)
  - `weekRangeUtc(weekStart: string): { from: Date; to: Date }` — `zonedMidnightToUtc(weekStart,'Asia/Seoul')` ~ `+7일`
  - `pairFriends(users: { id: string; friendIds: string[] }[], lastWeek: Map<string, string>): [string, string][]`
- 짝 짓기 알고리즘(테스트가 정하지 않는 부분):
  ```
  후보 친구 = users에 있는 친구만(활동 조건은 호출자가 이미 거름)
  미배정 집합 U. 반복:
    U 중 "U 안의 후보 친구 수"가 가장 적은(0 초과) 사용자 x를 고른다. 동률이면 id 오름차순.
    x의 U 안 후보 중 lastWeek.get(x) !== y인 y를 우선하고, 그중 후보 수가 가장 적은 y(동률 id순).
    그런 y가 없으면 lastWeek 짝이라도 고른다. [min(x,y), max(x,y)]를 결과에 넣고 U에서 뺀다.
  후보 친구가 0인 사용자만 남으면 끝.
  ```
- [ ] **Step 1: 실패하는 테스트** (`friend-quests.spec.ts`):
  - `weekStartSeoul(new Date('2026-11-01T14:59:00Z')) === '2026-10-26'`(서울 일요일 23:59), `weekStartSeoul(new Date('2026-11-01T15:00:00Z')) === '2026-11-02'`(서울 월요일 00:00) — Review Focus 2.
  - `weekRangeUtc('2026-11-02')`는 `from = 2026-11-01T15:00:00Z`, `to = 2026-11-08T15:00:00Z`.
  - 셋이 서로 친구 a-b-c, `lastWeek` a↔b → 결과에 [a,b]가 없다.
  - 둘만 서로 친구이고 지난주에도 짝이었으면 다시 [a,b].
  - 홀수(셋이 완전 연결) → 짝 1개, 한 명 남음.
  - 사슬 a-b, b-c, c-d → [a,b],[c,d](친구 적은 사람 우선 덕분에 둘 다 짝).
  - 같은 입력은 같은 결과.
- [ ] **Step 2~4:** 실패 확인 → 구현 → vitest PASS.
- [ ] **Step 5: 커밋** — `feat(quests): 프렌즈 퀘스트 주 경계·짝 짓기`.

### Task 3.2: 스키마·저장소·배치·친구 이벤트

**Interfaces:**
- Consumes: `pairFriends`, `weekStartSeoul`, social 이벤트 `FriendshipAccepted({userA,userB,at})`·`FriendshipEnded({userA,userB,at})`.
- Produces:
  - Prisma: spec 5절 `FriendQuest`·`FriendQuestMember`(테이블 `friend_quests`·`friend_quest_members`, `@@unique([weekStart, userId])`).
  - `FRIENDS_PORT`: `interface FriendsPort { friendIdsOf(userIds: string[]): Promise<Map<string, string[]>>; areFriends(a: string, b: string): Promise<boolean> }`
  - `class PairFriendQuestsCommand { constructor(readonly now: Date) }` → `{ weekStart: string; pairs: number }`. 대상은 `[now-14일, now)`에 `kind=lesson` 세션을 완료했고 이번 주 멤버가 아닌 사용자. 지난주 짝은 `weekStart-7일`의 멤버로 구한다. 짝마다 `FriendQuest`와 `FriendQuestMember` 2행을 만들고, `(weekStart,userId)` 유니크 충돌은 건너뛴다.
  - 이벤트 핸들러: `FriendshipAccepted` → 두 사람 모두 이번 주 멤버가 아니면 즉시 짝을 만든다. `FriendshipEnded` → 두 사람이 같은 이번 주 퀘스트에 있으면 `endedAt = at`.
  - `jobs.controller.ts`: 서울 로컬 요일이 월요일인 첫 tick에서 `runOnce('friend-pairs', weekStartSeoul(now), …)`. 월요일 어느 시각이든 첫 tick에 한 번 돌아, 00시 tick을 놓쳐도 그날 안에 짝이 생긴다.
- [ ] **Step 1: 실패하는 테스트**
  - e2e(`test-e2e/friend-quests.e2e.ts` 앞부분 — tick은 실제 시각에 묶여 있어 월요일 배치는 e2e로 돌리지 않는다. 테스트 전용 엔드포인트도 만들지 않는다):
    - A-B 요청·수락 → `GET /me/quests`에서 A의 `friend.partner.nickname`이 B 닉네임.
    - A가 B를 끊으면 A의 `friend === null`(종료된 퀘스트는 내려주지 않는다).
  - 단위(`friend-quests.spec.ts`, 가짜 저장소·포트 주입):
    - `PairFriendQuestsHandler`를 같은 `now`로 두 번 실행하면 짝 생성 호출이 첫 실행분뿐이다(두 번째는 모두 이미 멤버).
    - 최근 14일 활동이 없는 친구는 짝 대상에서 빠진다.
- [ ] **Step 2~4:** 실패 확인 → 구현(마이그레이션은 Task 3.4) → api test·build·lint·typecheck.
- [ ] **Step 5: 커밋** — `feat(quests): 프렌즈 퀘스트 저장소·월요일 배치·친구 이벤트`.

### Task 3.3: 지급·조회·웹 창

**Interfaces:**
- Produces:
  - contracts `FriendQuestView = { partner: { nickname: string; avatarUrl: string | null }; mine: number; theirs: number; goal: number; done: boolean; endsAt: string }`, `MeQuestsResponse.friend: FriendQuestView.nullable()`.
  - `EvaluateQuestsHandler` 확장: 이번 주 `endedAt=null` 퀘스트가 있고 두 사람 기여 합(`weekRangeUtc` 범위의 `kind=lesson` 완료 세션 수)이 `≥ 15`면, 멤버마다 `tryInsert({ questKey:'friend', period: weekStart, xp: 50 })` → true면 `credit(50)`. 결과에는 호출한 사용자 몫만 `{ key:'friend', title:'친구와 레슨 15개', xp:50 }`로 넣는다.
  - `QuestsPanel`: `friend`가 있으면 `친구 퀘스트` 창(짝 닉네임, `mine+theirs`/15 막대, `나 {mine} · {닉네임} {theirs}`, `{n}일 남음`), 없으면 `친구를 추가하면 다음 퀘스트가 시작돼요`와 `/friends` 링크.
- [ ] **Step 1: 실패하는 테스트** — `friend-quests.e2e.ts`(뒷부분):
  - A-B 짝, A 레슨 7개·B 레슨 7개 시드(세션 직접 INSERT, `finished_at` 이번 주) → A가 레슨 1개 완료 → 응답 `questRewards`에 `friend` 1개, A·B 각각 `quest_rewards(questKey='friend')` 1행, `xp_events(reason='quest', amount=50)` 각 1행.
  - B가 이어서 레슨 1개 완료 → B 응답에 `friend` 없음, 행 수 그대로(Review Focus 3의 순차 경로).
  - 동시성(Review Focus 3): 다른 짝 C-D를 14개 상태로 만들고 C·D의 완료 요청을 `Promise.all`로 동시에 보낸다 → 둘 다 200, `quest_rewards(friend)`는 C·D 각 1행.
- [ ] **Step 2~4:** 실패 확인 → 구현 → api test·web build·lint·typecheck. Playwright(목 API)로 친구 퀘스트 창(진행 중·완료·짝 없음)을 모바일·PC·다크에서 스크린샷으로 확인한다.
- [ ] **Step 5: 커밋** — `feat(quests): 프렌즈 퀘스트 지급과 친구 퀘스트 창`.

### Task 3.4: 마이그레이션·PR·배포
Task 1.5와 같은 절차로 진행한다. 브랜치는 `chore/migration-friend-quests`이고, SQL에는 `friend_quests`·`friend_quest_members`만 있어야 한다. CLAUDE.md에 배치 슬롯(`friend-pairs`, 서울 월요일 첫 tick)과 프렌즈 퀘스트 규칙을 추가하고, spec 상태를 "구현 완료"로 고친다. 배포 뒤 Cloud Scheduler 설정은 바꾸지 않는다(기존 매시 tick 사용).
