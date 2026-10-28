# 데일리 퀘스트 · 친구 · 프렌즈 퀘스트 설계 (2026-10-28)

상태: 설계 승인 대기. 섹션 1~3은 대화에서 사용자 승인을 받았다(2026-10-27~28).

## 1. 목표와 범위

듀오링고처럼 **매일 돌아올 이유**(데일리 퀘스트)와 **같이 하는 사람**(친구·프렌즈 퀘스트)을 더해 리텐션을 올린다. 효과는 기존 `/internal/stats`의 D1/D7/D30 코호트로 본다.

사용자가 정한 것:
- 친구는 **닉네임 검색 + 요청/수락**으로 맺는다.
- 보상은 **XP 보너스만** 준다(새 화폐·상점·결제 없음).
- 프렌즈 퀘스트는 **주간 1:1 공동 목표**다.

범위 밖: 리더보드·리그, 푸시·이메일 알림, 친구 간 메시지, 화폐·상자, 유료 기능.

## 2. 데일리 퀘스트

### 규칙
- 하루 **3개**를 아래 풀에서 뽑는다. `hash(userId, localDate)`로 결정적으로 골라 같은 날에는 언제 열어도 같은 3개가 나온다. 같은 종류는 하루에 한 번만 나온다.
- 날짜는 스트릭과 같이 `User.timezone` 기준 로컬 날짜다.
- 보상은 퀘스트마다 **10 XP**다.

| 키 | 제목 예 | 진행 계산(그날 로컬 날짜 범위) |
| --- | --- | --- |
| `lessons` | 레슨 N개 완료하기 | 완료된 `kind=lesson` 세션 수. N = `dailyGoal + 1` |
| `xp` | XP N 모으기 | 그날 `XpEvent.amount` 합계에서 `reason='quest'`를 뺀 값. N = 30 |
| `perfect` | 100점 레슨 1개 | `kind=lesson`이고 `correctCount = questionIds 길이`인 완료 세션 수 |
| `review` | 복습 1회 하기 | 완료된 `kind=review` 세션 수 |
| `accurate` | 정답률 90% 이상 레슨 2개 | `kind=lesson`이고 `correctCount / questionIds 길이 ≥ 0.9`인 완료 세션 수 |

- 건너뛰기 테스트(`kind=placement`)는 어떤 퀘스트에도 세지 않는다.
- 재도전(`/sessions/:id/retry`)은 세션 점수를 바꾸지 않으므로 진행에 영향이 없다.
- 오늘 복습할 문제가 0개면 `review`를 뽑지 않는다. 뽑기 시점의 due 수로 판단하고, 그날은 고정한다.

### 진행과 지급
- 진행은 저장하지 않는다. 요청 때마다 원장(`lesson_sessions`, `xp_events`)에서 계산한다. 모든 값은 원장에서 다시 계산할 수 있어야 한다는 기존 원칙을 따른다.
- 지급은 레슨 완료 처리(`complete-session.handler.ts`)에서 진행도 기록(`RecordSessionCompletionCommand`) 바로 뒤에 `EvaluateQuestsCommand`를 실행해 한다. 목표에 처음 닿은 퀘스트마다 같은 트랜잭션에서 두 가지를 쓴다.
  - `QuestReward(userId, questKey, period=로컬 날짜)` INSERT. 유니크 충돌이면 이미 지급된 것으로 보고 건너뛴다.
  - `XpEvent(reason='quest', amount=10)`, 그리고 `UserStats.totalXp`·`DailyActivity.xp` 증가.
- 퀘스트 XP는 스트릭(데일리 목표 = 레슨 수 기준)에 영향을 주지 않는다.
- 세션 완료 응답에 선택 필드 `questRewards: { key, title, xp }[]`를 더한다. 옛 클라이언트는 무시한다.

## 3. 친구

### 규칙
- **검색:** 닉네임 앞부분 일치, 2글자 이상, 최대 10명. 결과에는 요청에 쓸 user id와 닉네임·아바타·현재 스트릭만 담고, 이메일·학습 기록은 내지 않는다. 사용자당 분당 30회로 제한한다.
- **공개 설정:** `User.discoverable`(기본 true). false면 검색에 나오지 않는다. 기존 친구 관계는 유지된다.
- **흐름:** 요청 → 수락/거절. 보낸 사람은 취소할 수 있다. 친구가 된 뒤에는 친구 끊기를 할 수 있다.
  - 이미 상대가 나에게 보낸 대기 요청이 있는데 내가 요청하면 바로 수락으로 처리한다.
- **차단:** 차단하면 친구 관계·대기 요청을 지우고, 양쪽 검색에서 서로를 숨기고, 요청을 막는다. 차단당한 쪽에는 알리지 않는다. 그 사람에게 보낸 요청은 "보낼 수 없음"이 아니라 일반 성공처럼 처리해 차단 사실을 드러내지 않는다.
- **한도:** 대기 중인 보낸 요청 20개, 친구 100명.
- **친구에게 보이는 정보:** 닉네임, 아바타, 현재 스트릭, 이번 주 완료 레슨 수.
- **알림:** 푸시·이메일은 없다. 받은 요청 수를 탭 바의 친구 아이콘 배지로 보여 준다.

## 4. 프렌즈 퀘스트

- **주 단위:** 월요일 00:00 ~ 일요일 24:00, **모든 사용자 Asia/Seoul 고정**. 두 사람이 같은 기간을 공유해야 해서 개인 타임존을 쓰지 않는다.
- **짝 짓기:** 매주 월요일 배치가 친구끼리 1:1로 짝을 짓는다.
  - 최근 14일 안에 레슨을 완료한 사람만 대상이다.
  - 지난주와 같은 짝은 피한다. 다른 후보가 없을 때만 허용한다.
  - 친구 수가 적은 사람부터 그리디로 짝을 지어 남는 사람을 줄인다. 홀수면 한 명이 남는다.
  - 주 중간에 친구가 된 두 사람이 그 주에 모두 짝이 없으면 수락 시점에 바로 짝이 된다. 마감까지 남은 기간과 상관없이 목표는 같다.
- **목표:** 둘이 합쳐 그 주에 완료한 `kind=lesson` 세션 **15개**.
- **보상:** 목표에 닿는 순간 **두 사람 모두 50 XP**. 누구의 레슨이 목표를 채웠든 그 완료 처리에서 두 사람 몫을 함께 지급한다. 기간 키는 주 시작일인 `QuestReward(questKey='friend', period=주 시작일)`이고, 같은 유니크로 중복을 막는다.
- **짝이 사라질 때:** 주 중간에 친구를 끊거나 차단하면 `FriendQuest.endedAt`을 찍고 그 주 퀘스트를 끝낸다. 이미 받은 보상은 그대로 둔다. 두 사람은 다음 주에 새로 짝을 짓는다.
- **짝이 없을 때:** 창에 "친구를 추가하면 다음 퀘스트가 시작돼요"를 보여 준다.

## 5. 구조

### 컨텍스트
- **`social` (신설):** 친구 요청·관계, 차단, 검색. 다른 컨텍스트에는 포트 `FRIENDS_PORT`로만 노출한다.
  - `areFriends(a, b)`
  - `listFriendIds(userId)`
  - `onFriendshipEnded` 이벤트: 친구 끊기·차단 시 발행.
- **`quests` (신설):** 데일리 퀘스트 뽑기·진행·지급, 프렌즈 퀘스트 짝 짓기·진행·지급.
  - `domain` 순수 함수: `pickDailyQuests(userId, date, ctx)`, `weekStartSeoul(now)`, `pairFriends(candidates, lastWeekPairs)`, `progressOf(...)`.
  - 진행 계산은 `infrastructure`의 집계 SQL로 `lesson_sessions`·`xp_events`를 읽는다. jobs 통계와 같은 방식이고, 정답 키는 읽지 않는다.
  - XP 지급은 progression이 가진 XP 원장 쓰기를 포트(`XP_LEDGER_PORT`)로 받아 쓴다. quests가 `xp_events`를 직접 INSERT하지 않는다.
- 경계 규칙은 기존 `eslint-plugin-boundaries` 설정에 두 컨텍스트를 추가해 강제한다.

### 배치
`/internal/jobs/tick`에 **일요일 15:00 UTC(= 월요일 00:00 서울)** 슬롯 `friend-pairs`를 추가한다. 실행 기록은 `job_runs(job, slot=주 시작일)`에 남겨 한 번만 돌게 한다(기존 `runOnce` 방식).

### API (모두 로그인 필요)
| 메서드·경로 | 설명 |
| --- | --- |
| `GET /me/quests` | 오늘의 퀘스트 3개(키, 제목, 진행, 목표, 완료, XP), 이번 주 친구 퀘스트(짝 닉네임·아바타, 내 기여, 상대 기여, 목표, 완료, 마감 시각). 짝이 없으면 `friend: null` |
| `GET /friends` | 친구 목록(닉네임·아바타·스트릭·이번 주 레슨 수), 받은 요청, 보낸 요청 |
| `GET /friends/search?q=` | 2글자 이상, 최대 10명, 분당 30회. 나·차단 관계·`discoverable=false` 제외 |
| `POST /friends/requests` `{ userId }` | 요청 보내기. 역방향 대기 요청이 있으면 수락 처리 |
| `POST /friends/requests/:id/accept` | 수락(받은 사람만) |
| `POST /friends/requests/:id/decline` | 거절(받은 사람만) |
| `DELETE /friends/requests/:id` | 보낸 요청 취소(보낸 사람만) |
| `DELETE /friends/:userId` | 친구 끊기 |
| `POST /blocks` `{ userId }` · `DELETE /blocks/:userId` | 차단·해제 |
| `PATCH /me` `{ discoverable }` | 검색 허용 스위치(기존 엔드포인트에 필드 추가) |

요청·응답 스키마는 `packages/contracts`에 zod로 둔다(`quests.ts`, `social.ts`).

### DB (Prisma)
```prisma
model User {
  // …기존 필드
  discoverable Boolean @default(true)
}

enum FriendshipStatus { pending accepted }

model Friendship {
  id          String           @id @default(uuid()) @db.Uuid
  requesterId String           @db.Uuid
  addresseeId String           @db.Uuid
  /// 두 사용자 쌍당 한 행: (min(id), max(id))
  userLowId   String           @db.Uuid
  userHighId  String           @db.Uuid
  status      FriendshipStatus @default(pending)
  createdAt   DateTime         @default(now()) @db.Timestamptz
  acceptedAt  DateTime?        @db.Timestamptz
  @@unique([userLowId, userHighId])
  @@index([addresseeId, status])
  @@index([requesterId, status])
}

model UserBlock {
  blockerId String   @db.Uuid
  blockedId String   @db.Uuid
  createdAt DateTime @default(now()) @db.Timestamptz
  @@id([blockerId, blockedId])
}

model QuestReward {
  userId    String   @db.Uuid
  questKey  String   @db.VarChar(20)   // lessons·xp·perfect·review·accurate·friend
  period    DateTime @db.Date           // 데일리=로컬 날짜, friend=주 시작일
  xp        Int
  createdAt DateTime @default(now()) @db.Timestamptz
  @@id([userId, questKey, period])
}

model FriendQuest {
  id        String    @id @default(uuid()) @db.Uuid
  weekStart DateTime  @db.Date
  goal      Int       @default(15) @db.SmallInt
  createdAt DateTime  @default(now()) @db.Timestamptz
  endedAt   DateTime? @db.Timestamptz
  members   FriendQuestMember[]
}

model FriendQuestMember {
  questId   String   @db.Uuid
  userId    String   @db.Uuid
  weekStart DateTime @db.Date
  @@id([questId, userId])
  /// 한 주에 짝은 한 명
  @@unique([weekStart, userId])
}
```
- 실제 파일에서는 `@map`·`@@map` snake_case와 `User` FK(`onDelete: Cascade`)를 기존 모델과 같은 형식으로 붙인다.
- 마이그레이션은 CLAUDE.md 규칙대로 `chore/migration-*` 브랜치에 schema.prisma를 푸시해 `prisma-migration.yml`이 생성하게 한다.

### 화면 (Platinum 규칙 그대로)
- **탭 바:** "친구" 탭을 추가해 학습·복습·친구·프로필·설정 5칸이 된다. 아이콘은 `components/icons.tsx`에 인라인 SVG로 추가하고, 받은 요청 수 배지를 단다.
- **`/learn`:** "오늘의 퀘스트" 창(진행 막대 3개, `.meter` 디더 채움, 완료 시 check)과 "친구 퀘스트" 창(짝 닉네임, 합산 15칸 막대, 각자 기여 수, 남은 날). PC는 보조 패널, 모바일은 경로 위 접힌 창이다.
- **`/friends`:** 검색 입력, 받은 요청(수락·거절), 보낸 요청(취소), 친구 목록(스트릭·이번 주 레슨 수), 항목 메뉴(친구 끊기·차단).
- **설정 "개인정보" 창:** "닉네임으로 나를 찾을 수 있음" 스위치.
- **결과 화면:** `questRewards`가 있으면 "퀘스트 완료 +10 XP" 줄을 추가한다. 모션은 기존 check 스탬프만 쓰고 새 모션은 넣지 않는다.

## 6. 오류 처리
- 검색어 2글자 미만 → 400. 한도 초과(요청 20·친구 100) → 409 `FRIEND_LIMIT`. 분당 제한 초과 → 429.
- 남의 요청을 수락·거절·취소하려 하면 404(존재를 드러내지 않는다).
- 차단 관계에서 온 요청은 저장하지 않고 성공 응답을 돌려준다(3절).
- 퀘스트 평가가 실패해도 세션 완료는 성공해야 한다. `EvaluateQuestsCommand`는 레슨 완료 트랜잭션 밖에서 돈다. 실패하면 로그만 남기고 `questRewards: []`로 응답하며, 다음 레슨 완료 때 다시 평가해 누락 없이 지급한다.
- 동시 완료(두 짝이 같은 순간에 목표를 채움)는 `QuestReward` PK가 막는다. 충돌은 이미 지급된 것으로 처리한다.

## 7. 테스트
- **단위 테스트(vitest, `apps/api/test/*.spec.ts`):**
  - `pickDailyQuests`: 같은 사용자·날짜면 같은 결과, 날짜가 바뀌면 다른 조합, 중복 종류 없음, due 0이면 `review` 제외.
  - 진행 계산: `xp` 퀘스트에서 `reason='quest'` 제외, `placement` 제외.
  - `weekStartSeoul`: 일요일 23:59 서울과 월요일 00:00 서울 경계, UTC 일요일 15:00 전후.
  - `pairFriends`: 지난주 짝 회피, 홀수 인원, 친구 적은 사람 우선.
  - 친구 규칙: 역방향 요청 자동 수락, 한도, 차단 시 정리.
- **e2e(`apps/api/test-e2e`, CI Postgres):**
  - 요청 → 수락 → 목록. 차단 → 관계 삭제·검색 제외.
  - 레슨 완료로 데일리 퀘스트 지급 1회. 같은 세션을 다시 평가해도 추가 지급 없음.
  - 프렌즈 퀘스트 목표 도달 시 두 사람 모두 지급.
  - `friend-pairs` 슬롯 멱등.
- **화면:** Playwright(목 API) 모바일·PC 스크린샷으로 퀘스트 창·친구 페이지·결과 화면을 확인한다.

## 8. 구현 순서 (PR 3개)
1. **데일리 퀘스트:** quests 컨텍스트, `QuestReward`, `GET /me/quests`, 세션 완료 연결, `/learn` 퀘스트 창, 결과 화면.
2. **친구:** social 컨텍스트, `Friendship`·`UserBlock`·`discoverable`, 친구 API, 친구 탭·페이지, 설정 스위치.
3. **프렌즈 퀘스트:** `FriendQuest`·`FriendQuestMember`, 배치 슬롯, 수락 시 즉시 짝, 친구 퀘스트 창.

PR마다 CLAUDE.md 작업 흐름(검증 → CI → squash merge → 배포 확인)을 따른다. 구현은 Sonnet 서브에이전트(워크트리 격리)가, 검토·머지·배포 확인은 상위 모델이 맡는다. 각 PR이 끝나면 CLAUDE.md의 아키텍처·화면 규칙에 해당 내용을 추가한다.
