# CLAUDE.md — CS 데일리 작업 규칙

하루 5분, 듀오링고 방식으로 매일 푸는 컴퓨터 사이언스 학습 웹. 레포 소유자 `seulleee`. 모든 대화·커밋·문서는 **한국어**.
개요·레포 구조·로컬 실행은 [README.md](README.md), 문제 작성 규칙은 [docs/content-guide.md](docs/content-guide.md)를 따른다.

## 운영 현황 (2026-10-08 기준)

| 항목 | 값 |
| --- | --- |
| 웹 | https://cs-daily-iota.vercel.app (Vercel Hobby, Root Directory `apps/web`, main 푸시마다 자동 배포) |
| API | https://cs-daily-api-541298537642.asia-northeast3.run.app (Cloud Run, 프로젝트 `cs-daily-510823`, 최소 인스턴스 0) |
| DB | Supabase Free 서울 (`gcaeltkvfvalzmrljoqw`), 운영 스키마는 `apps/api/prisma/migrations` 그대로 |
| 비밀값 | 전부 GCP Secret Manager. GitHub Secrets는 쓰지 않는다 (`infra/gcp-setup.sh` 참고) |
| 로그인 | GitHub·Google OAuth. Google 앱은 **프로덕션 게시됨**(2026-10-08, 비민감 범위라 인증 심사 불필요). 브랜딩에 홈·`/privacy`·`/terms` 링크 등록 |
| 배치 | Cloud Scheduler `cs-daily-tick`: 매시 07분(Asia/Seoul) `POST /internal/jobs/tick` → 스트릭 프리즈·리마인더 |
| 백업 | `backup.yml` 매일 03:17 KST pg_dump(PG17 클라이언트) → Actions artifact 90일 보관. 2026-10-08 수동 실행 성공(약 0.5MB) |
| 예산 | GCP 월 ₩10,000 알림, 무료 체험 2027-01-05 종료 |
| 콘텐츠 | 9트랙 104유닛 **905레슨 9,050문제 전부 작성**(2026-10-27). 자료구조 112·데이터베이스 103·운영체제 69·네트워크 75·정보처리기사 130·코딩 테스트 108·AI·ML 103·AWS 99·보안 106레슨. 레슨당 10문제, 핵심 정리(keyPoints) 2~4줄, **모든 레슨에 도입 설명(intro)**. 2026-10-13 순서 재배치: 자료구조 배열→스택·큐→복잡도→정렬→이진 탐색→…, 데이터베이스 테이블과 키→SQL→서브쿼리→정규화(`u11`)→인덱스…, 운영체제 프로세스→커널·인터럽트·시스템 콜(`u08`)→스케줄링→…→I/O 모델(`u06`, 맨 뒤). slug 번호 ≠ 순서 |
| 정보처리기사 | `eip` 트랙(2026-10-14 공개). 필기 5과목 15유닛 130레슨 1,300문제(코드 빈칸 82). 유닛마다 마지막 레슨은 4지선다 "모의 문제". 2020 개편 5과목 구조 기준 — 현행 출제기준 문서로 대조 필요. 기출은 개념 빈도 참고용으로만 쓰고 문장은 옮기지 않는다 |
| 코딩 테스트 | `ct` 트랙(2026-10-19 공개). 13유닛 108레슨 1,080문제(코드 253, Python·Java·JavaScript·C++ variants 모두 실행 검증). 사용자가 언어를 고르고 그 언어로 채점. 외부 문제(백준 등) 번호·지문은 넣지 않는다 |
| AI·ML | `ai` 트랙(2026-10-23 공개). 12유닛 103레슨 1,030문제(코드 빈칸 44, python 단일 — NumPy·scikit-learn은 실행 검증, PyTorch는 이 환경에 설치 불가라 이름·순서만 묻는다). 1~7유닛 ML 이론, 8~12유닛 임베딩·LLM·RAG·평가 운영. 벤더 모델명·가격·컨텍스트 길이는 쓰지 않는다 |
| AWS | `aws` 트랙(2026-10-26 공개). 12유닛 99레슨 990문제(코드 빈칸 68: AWS CLI bash 37·정책 JSON 27·Terraform HCL 4). CLI 명령·옵션은 AWS CLI `--generate-cli-skeleton`으로 오프라인 확인, JSON은 validate가 정답을 채워 파싱 검사, Terraform은 설치 불가라 문서 대조·이름/순서만 묻는다. 유닛마다 마지막은 "현장" 진단 레슨. 한도·가격 숫자는 쓰지 않는다 |
| 보안 | `sec` 트랙(2026-10-27 공개). 13유닛 106레슨 1,060문제(코드 빈칸 84: python 35·http 26·javascript 14·json 4·sql 3·html 2, variants 없음 — `http`·`html`은 sec 전용). 방어 관점: 공격은 원리·징후·막는 법까지, 페이로드·익스플로잇 절차는 쓰지 않는다. 유닛마다 마지막은 "현장" 진단 레슨, 13유닛은 OWASP Top 10:2025 범주 점검. 클라우드 보안 세부는 AWS 트랙과 연결만 |
| 수요 검증 | 결제 없음, 내부 사용 지표(`/internal/stats`, [docs/ops-stats.md](docs/ops-stats.md))로 먼저 확인(2026-10-23) |
| 온보딩 | 트랙 선택 → 하루 목표 → **시작 지점**(처음 / 조금 알아요=앞 3유닛 배치 테스트 체인 / 잘 알아요=유닛 골라 테스트 1회). 체인 상태는 `apps/web/src/lib/placement-chain.ts`(sessionStorage), API는 기존 `POST /units/:id/skip-test` 재사용 |

## 작업 흐름

1. `main`에서 브랜치를 따고 작업한다. 브랜치 접두사: `feat/`, `fix/`, `content/`, `ci/`, `docs/`.
2. 커밋 전에 반드시 통과: `pnpm content:validate`, `pnpm --filter @cs-daily/api test`, `pnpm lint`, `pnpm typecheck`, 바꾼 앱의 `build`.
3. PR을 만들고 CI(`check` job)가 초록이 된 뒤 **squash merge**한다. 사용자가 머지도 맡겼으므로 직접 머지하되, CI 결과가 나오기 전에는 머지하지 않는다.
4. `main` 푸시 → `deploy-api`가 이미지 빌드·마이그레이션·시드·Cloud Run 배포, Vercel이 웹 배포. 배포 성공을 확인한 뒤 완료라고 말한다.
5. 콘텐츠·화면 변경은 가능하면 Playwright(목 API)로 흐름을 돌려 보고, 스크린샷으로 확인한 뒤 올린다.

이 작업 환경의 제약:

- 프록시 때문에 GitHub GraphQL·`gh pr`·`gh secret`·브랜치 삭제·Actions 로그 다운로드가 막혀 있다. REST(`gh api repos/...`)로 PR 생성·머지·check-runs 조회를 하고, CI 실패 원인은 워크플로가 `::error` 주석으로 남긴 것을 `check-runs/{id}/annotations`로 읽는다.
- `run.app` 도메인은 이 환경에서 직접 호출할 수 없다. 운영 확인은 Chrome(사용자 로그인 세션) 또는 Vercel 경유 `/api/*`로 한다.
- Prisma 엔진 다운로드가 막혀 있다. 로컬 타입 생성은 `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 PRISMA_SCHEMA_ENGINE_BINARY=/bin/true PRISMA_QUERY_ENGINE_LIBRARY=/bin/true npx prisma generate --no-engine`, **마이그레이션 파일은 `chore/migration-*` 브랜치에 schema.prisma를 푸시해 `prisma-migration.yml`이 생성**하게 한다.
- pnpm 10은 postinstall을 돌리지 않으므로 `prisma generate`를 항상 명시적으로 실행한다.
- 새 워크트리에서는 `pnpm typecheck` 전에 `pnpm --filter @cs-daily/contracts build`가 필요하다(dist가 없으면 api가 `@cs-daily/contracts`를 못 찾는다). 백그라운드 dev 서버는 `pkill -f` 패턴이 자기 셸과 겹치면 셸이 죽으니 PID로 종료한다.
- 시드는 유닛·레슨 순서 변경을 견딘다(`(track_id, sort_order)`·`(unit_id, sort_order)` 유니크 때문에 기존 행을 음수로 비켜 둔 뒤 재부여, 트랙별 트랜잭션). **sortOrder 음수 = 콘텐츠에서 빠진 퇴역 행**: 문제·세션·진도 참조가 없으면 시드가 삭제하고, 있으면 음수로 남긴다. 경로·잠금·nextLessonId·유닛/레슨 카운트는 양수만 본다(`get-path.handler.ts`, `question-grading.adapter.ts`, `me.controller.ts`). CI는 첫 트랙 유닛을 회전시키고 레슨 하나를 뺀 콘텐츠로 재시드한 뒤 단언하는 스모크 단계를 돈다(`apps/api/test-e2e/rotate-units.mjs`, `assert-retired.mjs`, `SEED_CONTENT_ROOT`).
- 시드는 기존 행을 한 번에 읽어 비교하고 바뀐 것만 쓴다(변경 없는 트랙은 건너뜀, 문제 version은 내용이 바뀔 때만 +1). 운영 DB 왕복 지연 때문에 행 단위 순차 쿼리를 늘리지 않는다.
- 레슨을 다른 유닛으로 옮길 때 옛 slug 자리를 새 레슨으로 재사용하면 퇴역 행이 생기지 않는다(DB 1유닛 l06~l09가 그 예). 옮긴 레슨은 문제 id를 유지해 복습 기록을 보존한다.
- 비밀값(OAuth 시크릿, DB 비밀번호 등)은 절대 보거나 적지 않는다. 필요하면 사용자가 Cloud Shell에서 `read -rsp`로 직접 입력하게 하고, 입력 후 `gcloud run services update ... --update-labels=secrets-rev=...`로 새 리비전을 띄운다.

## 아키텍처 규칙 (API)

- DDD 모듈러 모놀리스. 컨텍스트: identity, curriculum, learning(핵심), progression, review, quests, social, notification, jobs. 각 컨텍스트는 `domain / application / infrastructure / presentation` 4계층이며 `eslint-plugin-boundaries`가 의존 방향을 강제한다. 경계를 넘을 땐 포트 토큰(`QUESTION_GRADING_PORT`, `CURRICULUM_QUERY_PORT`, `REVIEW_QUEUE_PORT`, `USER_PREFS_PORT`, `XP_LEDGER_PORT`, `QUEST_ACTIVITY_PORT`, `QUEST_REWARD_REPO`, `DAILY_PICK_REPO`)으로만 주입한다.
- **정답 키(`answerKey`)는 `CurriculumAdapter.forGrading()` 한 곳에서만 읽는다.** 다른 어떤 쿼리도 select하지 않는다.
- **코드 문제 언어 variants(`ct` 트랙)**: 코드가 있는 문제는 `content.variants[lang]`(코드·보기)와 `answer_key.variants[lang]`(정답·선택 해설)으로 python·java·javascript·cpp 4개를 모두 갖는다(validate 강제). 사용자 언어는 `User.codeLanguage`(기본 python, `/me`·`PATCH /me`). 세션 응답은 사용자 언어 variant만 `content.code`(+options)와 `lang`으로 펼치고 다른 언어·정답은 내려가지 않는다(`learning/domain/services/code-variants.ts`). 답안 제출·재도전은 받은 `lang`을 함께 보내고, 서버는 그 언어 variant가 있는지 검증해(없으면 422 `CODE_LANGUAGE_UNAVAILABLE`) 그 정답·해설로 채점하며 `lang`을 답안 기록에 남긴다 — 세션 도중 설정을 바꿔도 받은 문제는 받은 언어로 채점되고 이어 풀기에서도 답한 언어를 보여 준다.
- 레슨 `intro`(도입 설명, 선택 `string[]` 1~3문단·문단 40~220자·합계 450자 이하)는 `curriculum.json` → `lessons.intro`(`String[] @default([])`) → `LessonOutline.intro` → 세션 응답 `lessonIntro`(선택 필드, 옛 API 호환)로 `lessonKeyPoints`와 같은 경로를 탄다. seed-diff의 트랙 구조 비교에 포함돼 바뀐 트랙만 갱신된다. 작성 규칙은 content-guide "도입 설명".
- **수요 검증(결제 없음)**: 운영자 지표 `GET /internal/stats`(jobs 컨텍스트, `JOBS_SECRET` Bearer — tick과 같은 `assertInternalAuth`)는 가입·활성·주간 코호트 D1/D7/D30·트랙별·스트릭을 **집계 SQL만**으로 돌려주고 이메일·닉네임·user id는 내지 않는다(날짜 계산 순수 함수 `jobs/domain/usage-stats.ts`). 결제·가격 부과·유료 잠금은 넣지 않는다.
- 세션 종류 `kind`: `lesson`(레슨) · `review`(복습, XP ×1.5) · `placement`(유닛 건너뛰기 테스트, XP 0). `findOpen`은 kind를 구분해서 서로 이어지지 않게 한다.
- 레슨 흐름: 시작 카드 → 본 문제 → **틀린 문제 다시 풀기**(`POST /sessions/:id/retry`, 채점만 하고 답안·XP·SM-2에 영향 없음, 최대 2회) → 완료. 재도전 허용 여부는 애그리거트 `canRetry/retry`가 판단한다.
- 유닛 건너뛰기: `POST /units/:unitId/skip-test` → 8문제, 80% 이상이면 트랙 처음부터 그 유닛까지 완료 처리(`UserLessonProgress.completedAt`만 찍고 점수 0). 정책은 `learning/domain/services/unit-skip-test.ts`.
- 결과 화면 `newReviewCount`("내일 복습 예정")는 사용자 로컬 **내일의 마지막 순간**까지 due인 수다(`learning/domain/services/review-preview.ts`). SM-2가 방금 푼 문제를 답한 시각+24시간으로 예약하므로 "내일 00:00"까지로 끊으면 0이 된다. 복습 예약은 `AnswerGraded` 비동기 처리라 완료 시점에 저장 전일 수 있어, 이번 세션 오답 수를 하한으로 둔다.
- 콘텐츠에서 빠진 문제는 시드가 삭제하지 않고 `status=retired`로 내린다(답안·복습 기록 FK 보존). `lesson.questionCount`는 콘텐츠 파일의 문제 수를 따른다.
- 도메인 규칙은 단위 테스트가 있어야 한다(`apps/api/test/*.spec.ts`, vitest). HTTP 흐름은 `apps/api/test-e2e/`가 CI에서 빌드된 서버 + CI Postgres로 돈다.
- **데일리 퀘스트**(`quests` 컨텍스트, 규칙은 `docs/superpowers/specs/2026-10-28-quests-friends-design.md`): 하루 3개를 사용자 로컬 날짜에서 userId+날짜 해시로 고정해 뽑는다(`domain/daily-quests.ts`). 그날 뽑은 3개는 `daily_quest_picks`(user_id, period)에 처음 볼 때 저장해 고정한다(`DAILY_PICK_REPO`, `createMany skipDuplicates` 후 재조회). 진행은 원장(`lesson_sessions`·`xp_events`) 집계로 그때그때 계산하고 저장하지 않는다(`QUEST_ACTIVITY_PORT`). 지급은 `quest_rewards` PK(user_id, quest_key, period)로 멱등(`ON CONFLICT DO NOTHING`, `QUEST_REWARD_REPO`)이고, 새로 지급된 경우에만 `XP_LEDGER_PORT`(progression `XpLedgerAdapter`)로 `xp_events`(reason='quest')·`total_xp`·`daily_activity.xp`를 기록한다 — lessonsCompleted·스트릭엔 영향 없음. 퀘스트 XP는 "XP 모으기" 진행에서 제외한다. 복습 퀘스트 자격 = 오늘 끝까지 due>0 또는 오늘 복습 완료>0. `CompleteSessionHandler`가 `RecordSessionCompletionCommand` 뒤에 `EvaluateQuestsCommand`를 호출해 세션 완료 응답에 `questRewards`(선택 필드)를 싣고, 평가가 실패해도 완료는 성공(`questRewards: []`). 조회는 `GET /me/quests`.
- **친구**(`social` 컨텍스트, 규칙은 `docs/superpowers/specs/2026-10-28-quests-friends-design.md`): 닉네임 앞부분 검색(2글자+, 10명, 사용자당 분당 30회 — `userSearch` 스로틀러는 `UserThrottlerGuard`만 적용하고 전역 `IpThrottlerGuard`는 제외). 응답은 userId·닉네임·아바타·스트릭(+relation/weekLessons)만 내리고 weekLessons는 서울 주 기준이다. 요청은 limit(보낸 대기 20·친구 100, 409 `FRIEND_LIMIT`) 외엔 항상 202 — 차단·없는 사용자·중복도 202로 저장하지 않아 차단 사실을 드러내지 않는다(`domain/friendship-rules.ts` `decideSend`: limit→silent→accept-reverse→already→create). 맞요청은 즉시 수락하고, 수락·거절·취소는 당사자만 할 수 있다(아니면 404). 차단은 관계·요청을 지우고 양방향 검색에서 뺀다. `FriendshipAccepted`/`FriendshipEnded`는 커밋 뒤 발행하며 PR 3 프렌즈 퀘스트가 구독한다. 알려진 한계: 전역 IP 리밋(기본 120/분)은 trust proxy가 없어 Vercel 공유 IP 뒤에서 사용자 전체에 걸릴 수 있다(후속 과제).
- 로그인: 액세스 15분·리프레시 14일(회전·슬라이딩). 웹 `api()`는 refresh를 single-flight로 묶고, 서버는 폐기 30초 이내 토큰 재사용을 동시 요청으로 보고 허용한다(`identity/domain/services/refresh-grace.ts`).

## 화면 규칙 (웹)

- **디자인 "Platinum"(2026-10-14, #37)** — 90년대 데스크톱 GUI의 문법을 빌린 거의 흑백 룩. Apple 고유 요소(사과 로고·Chicago 글꼴·Finder 창 모양)는 쓰지 않는다. 기억 요소: 줄무늬 타이틀바 **창**(`components/window.tsx`), **반전(inverse video)** 선택, **디더** 패턴, 현재 노드의 **개미 행렬** 점선. 모든 면은 바탕과 같은 색(평면) + 1px ink 테두리 + 블러 없는 `2px 2px 0` 그림자. 입력 필드만 `--color-field`(흰색).
  - 토큰: 라이트 ground/surface `#EBEBEB`, line `#868686`(바탕 대비 3:1), ink `#000`, ink-2 `#555`, wrong `#BD0F29`; 다크 ground/surface `#262626`, line `#7A7A7A`, ink `#F2F2F2`, ink-2 `#B5B5B5`, wrong `#FF7474`. brand/correct는 ink와 같다(색이 아니라 반전·테두리·아이콘으로 표현). 유채색은 오답 빨강(오류 토스트 바탕 포함)과, 오늘 레슨을 끝냈을 때 채워지는 스트릭 불꽃(`--color-flame-outer #E0301E` 빨강 · `--color-flame-inner #FF9F1C` 주황, 라이트·다크 공통, 1px ink 외곽선으로 바탕과 분리)뿐이다.
  - 글꼴: 디스플레이(제목·숫자·버튼·라벨·창 제목) **Neo둥근모**(jsdelivr `neodgm/neodgm-webfont`, 폴백 Galmuri11 → Plex Mono) — **16px 정수배(`bit`16 / `bit-2`32 / `bit-3`48)로만**. 본문·문제·해설은 IBM Plex Sans KR. `next/font/google`은 이 환경에서 빌드가 막혀 쓰지 않고 `<link>`로 로드한다.
  - 정보 위계: 현재 레슨만 반전(검정 패드 + 개미 행렬), 완료는 디더 + 판 위 check, 잠김은 윤곽만. 현재 유닛 헤더만 ink. 스트릭은 홈 상단 36px 상태 바의 **반전 배지**(`3일째`)와 XP만(주간 칸은 요일 표기가 없어 뜻이 전달되지 않아 뺐다. 주간 7칸은 요일 글자가 있는 PC 보조 패널과 프로필에만). 유닛의 "이 유닛 건너뛰기"는 헤더가 아니라 유닛 레슨 목록 맨 아래의 `.btn-outline` 버튼(완료된 유닛엔 없음). 탭 바·사이드바 선택은 **아이콘 타일(28px)만 반전**.
  - 모션(전부 `steps()`, ≤200ms, `prefers-reduced-motion`에서 제거): 주 버튼 클릭 깜빡임 1회(`lib/use-flash.ts`), 누르는 동안 반전, 정답 check 스탬프, 정·오답 창 **줌 사각형** 열림(결과 창 영역에만), 결과 링 10단계 채움, 스트릭 불꽃 2프레임(`FlameLive`, 오늘 레슨을 1개 이상 끝내 주황·빨강으로 채워졌을 때만. 아직이면 정지한 윤곽선, reduced-motion은 채움 정지). 오답은 움직이지 않는다(wrong 테두리·X만). 토스트 위→아래 슬라이드(steps(4) 160ms, 퇴장 120ms)가 있다. 그 외 모션 금지.
  - 토스트(`components/toast.tsx`)는 성공이 반전(brand-fill 바탕 + on-brand 글자), 오류가 wrong 바탕(+ on-wrong 글자)이고 그림자는 line 색이다. 글자는 Neo둥근모 `bit`.
  - 아이콘은 `components/icons.tsx` 인라인 SVG(이모지 금지). 글자 대비 4.5:1 이상(토큰 바꾸면 전 조합 재계산).
- 코드 블록은 가로 스크롤 없이 긴 줄을 접는다(hanging indent, 줄 번호는 첫 줄만).
- 전역 컴포넌트 클래스(`.card .btn-3d .btn-outline .option .input .chip .pad .meter`)는 `@layer components` 안에 둔다. 밖에 두면 Tailwind 유틸리티보다 우선해 `bg-*` 같은 조합이 무시된다(실제로 유닛 헤더가 사라졌던 버그). `ring` 같은 Tailwind 유틸리티 이름과 겹치는 클래스명을 만들지 않는다(결과 링은 `score-ring`).
- 테마는 `<html data-theme>`로 제어한다(`lib/theme.ts`, 시스템/라이트/다크, 기기별 localStorage, 첫 페인트 전 인라인 스크립트). 색은 CSS 변수만 쓰고 하드코딩하지 않는다.
- 레슨 시작 카드는 레슨 이름·목표 아래 **도입 설명(intro) 문단**(Plex Sans KR 16px, 줄간격 1.75, ink, 왼쪽 정렬, 모션 없음), 그 아래 핵심 정리 카드 순이다. 폭 600px, 시작 버튼은 하단 고정이고 본문만 스크롤한다(하단 여백 `pb-40`으로 작은 화면에서 버튼에 가리지 않는다).
- 레슨 플레이어 문제 영역은 헤더 아래 위쪽 고정, 폭 600px. 결과 창은 하단 도크 안에서 위로 자라며 문제 영역을 움직이지 않는다(영역 끝에 결과 창 높이만큼 빈 자리를 더하고, 창은 최대 `min(50dvh, 360px)`에 본문만 스크롤). 확인/계속 버튼은 같은 자리·같은 폭(버튼은 창 밖). 빈칸 입력 중엔 도크가 키보드 위에 붙고(visualViewport inset, Android는 `interactive-widget=resizes-content`), 키보드 리턴(`enterKeyHint=done`)으로 바로 확인한다.
- 코딩 테스트 언어 선택(`components/code-language-picker.tsx`)은 설정 "학습" 창(하루 목표 카드와 같은 2×2 라디오 타일, 기존 저장 버튼·토스트)과 온보딩(`ct` 트랙을 고른 때만 하루 목표 다음 단계)에서 쓴다. `lang`이 있는 코드 문제는 코드 블록 위에 `bit` 16px ink-2 언어 라벨(`CODING_LANGUAGE_LABEL`)을 달고, 제출·재도전에 받은 `lang`을 그대로 보낸다.
- 오늘의 퀘스트 창(`components/quests-panel.tsx`): PC는 보조 패널 `StatsPanel` 아래에 펼쳐 두고, 모바일은 `/learn` 다음 레슨 카드 위에 접힌 창(제목에 완료 수 `n/3`)으로 둔다. 진행 막대는 `.meter`, 완료는 `CheckIcon`. 결과 화면엔 `퀘스트 완료 +{xp} XP` 줄을 보여 준다.
- 마지막으로 본 트랙 탭은 기기에 저장한다(`lib/last-track.ts`). `/learn`으로 돌아올 때 URL → 저장값 → 첫 트랙 순.
- 탭 바·사이드바는 학습·복습·친구·프로필·설정 5칸이고 친구 아이콘에 받은 요청 수 배지가 붙는다(`['friends']` 쿼리). `/friends`는 친구 찾기(300ms 디바운스, 2글자부터)·받은 요청·보낸 요청·내 친구 창으로 이루어지며 친구 끊기·차단은 창 안 인라인 확인이다. 설정 "개인정보" 창에 `닉네임으로 나를 찾을 수 있음` 스위치(`MeResponse.user.discoverable`)가 있다.
- `/api/*`·`/auth/*`는 Next.js 리라이트로 API에 전달한다. OAuth 콜백은 **웹 오리진**(`OAUTH_CALLBACK_BASE_URL` = `WEB_BASE_URL`)으로 받아야 쿠키가 웹 도메인에 붙는다.

## 콘텐츠 규칙 (요약 — 상세는 docs/content-guide.md)

사용자가 명시적으로 정한 원칙이라 바꾸려면 먼저 물어본다.

- **비전공자 눈높이, 그러나 전문 용어 사용.** 일상 비유(접시·줄 서기·택배·우편·주방·엑셀 등)는 어디에도 쓰지 않는다. 쉬움은 "정의·기본 동작을 짧게 묻는 것"으로 만든다.
- **듀오링고식 반복 드릴**: 레슨당 핵심 개념 1~2개(= curriculum.json의 keyPoints), 10문제를 소개(001~002)→구분(003~004)→빈칸(005~006)→적용(007~009)→되짚기(010) 순서로. 같은 개념이 3번 이상 다른 형태로 나오고, **keyPoints에 없는 개념을 정답으로 요구하지 않는다**(학습자는 시작 카드의 핵심 정리만 보고 들어온다).
- 문제 50자·보기 15자 이내, 해설 1~2문장, 난이도 1~2만, 유형은 single 6 · ox 2(O 1·X 1) · fill 2. `multi`·코드 블록은 쓰지 않는다(예외: `eip`·`ct`·`ai`·`aws`·`sec` 트랙은 코드 빈칸 문제 허용 — `ct`는 언어별 variants 4개 필수, `ai`는 python 단일, `aws`는 bash·json·hcl, `sec`는 python·javascript·sql·http·html·json 단일, content-guide 참고).
- 주관식 대표 정답(`accepted[0]`)은 한글·영문·숫자·공백만(`FILL_PLAIN_ANSWER`, validate가 강제). Θ·²·^ 같은 기호가 필요한 답은 객관식으로.
- 문제 id는 `{track}-{qslug}-{NNN}`(qslug는 레슨마다 정한 전 트랙 유일값). 같은 레슨을 고칠 때는 **id를 유지**한다(진도·복습 기록 보존). 레슨 구조 자체를 바꿀 때(2026-10-08 유닛당 7~10레슨 개편처럼)만 새 id를 쓰고, 빠진 옛 문제는 시드가 retired로 내린다. 레슨 slug(l01…)는 자리를 이어받아 진도가 보존된다.
- 저장 후 `pnpm content:validate` 통과 필수. 대량 재작성은 트랙별 서브에이전트로 병렬 처리하고, 끝나면 길이·유형·OX 균형을 스크립트로 전수 점검한다.
- **유닛 순서는 구체(자료구조 조작·동작) → 추상(분석·표기).** 앞 유닛의 정답·보기에 뒤 유닛 개념(O 표기, 상각 등)을 쓰지 않는다. 유닛 slug는 진도 보존 때문에 바꾸지 않으므로 slug 번호 ≠ 실제 순서(curriculum.json 배열 순서가 기준).

## 사용자 선호

- **모델 사용 규칙**: 기획·설계·검토·설계 승인 요청은 상위 모델(Fable)이 직접 한다. **코드 구현은 Sonnet 서브에이전트**(`model: sonnet`, 워크트리 격리, 브랜치→PR까지)에 맡기고, 문제·커리큘럼 같은 콘텐츠 생성은 가이드를 주고 Opus/Sonnet 서브에이전트에 유닛·트랙 단위로 병렬 위임한다. 머지·배포 확인·보고는 상위 모델이 한다.
- 질문은 꼭 필요할 때 한 번에 하나. 합리적 가정을 밝히고 먼저 진행한다.
- 로그인·결제·약관 동의·OAuth 승인은 사용자가 직접 한다. 그 외 설정은 맡긴다.
- 구현 계획처럼 큰 작업은 상위 모델, 단순 반복 작업은 서브에이전트로 나눠 돌린다.
- 보고는 결과 중심으로 짧게. 무엇을 바꿨고 무엇을 확인했는지, 확인하지 못한 것은 솔직히 적는다.

## 남은 일

- [ ] 디자인 후속: 실기기(iOS 안전 영역, DPR 2~3에서 비트맵 선명도, 11px 배지 가독성, 150ms 깜빡임 체감) 확인, Safari·Firefox의 `@property` 결과 링 확인, 필요하면 Neo둥근모 woff2(44KB, OFL) `public/fonts` 자체 호스팅
- [ ] 계정 탈퇴: 로그인 화면이 "설정에서 탈퇴"라고 안내하지만 삭제 기능·API가 없다 → `DELETE /me` + 설정 화면 버튼 추가, 또는 안내 문구 수정
- [ ] Resend API 키 등록(이메일 리마인더)
- [ ] README의 운영·배포 절은 오래됐다(GitHub Secrets 기준) → CLAUDE.md 운영 현황과 맞추기
- [ ] 머지된 원격 브랜치 정리(이 환경에서 삭제 불가 — 레포 설정 "Automatically delete head branches" 권장)
- [ ] 무료 체험 종료(2027-01-05) 전 결제 계정 전환 알림
- [ ] 전역 레이트 리밋이 IP 키라 Vercel 리라이트 뒤에서 사용자 전체 한도처럼 동작할 수 있다 → trust proxy 설정 또는 사용자 키 추적 검토
