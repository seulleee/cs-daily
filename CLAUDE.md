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
| 콘텐츠 | 4트랙 39유닛 **359레슨**(유닛당 7~10) 중 **14유닛 115레슨 1,150문제** 작성됨(자료구조 앞 3, 데이터베이스 앞 4, 운영체제 앞 4, 네트워크 앞 3). 레슨당 10문제, 레슨마다 핵심 정리(keyPoints) 2~4줄. 2026-10-13 순서 재배치: 자료구조 배열→스택·큐→복잡도→정렬→이진 탐색→…, 데이터베이스 테이블과 키→SQL→서브쿼리→정규화(`u11`)→인덱스…, 운영체제 프로세스→커널·인터럽트·시스템 콜(`u08`)→스케줄링→…→I/O 모델(`u06`, 맨 뒤). slug 번호 ≠ 순서 |
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
- 레슨을 다른 유닛으로 옮길 때 옛 slug 자리를 새 레슨으로 재사용하면 퇴역 행이 생기지 않는다(DB 1유닛 l06~l09가 그 예). 옮긴 레슨은 문제 id를 유지해 복습 기록을 보존한다.
- 비밀값(OAuth 시크릿, DB 비밀번호 등)은 절대 보거나 적지 않는다. 필요하면 사용자가 Cloud Shell에서 `read -rsp`로 직접 입력하게 하고, 입력 후 `gcloud run services update ... --update-labels=secrets-rev=...`로 새 리비전을 띄운다.

## 아키텍처 규칙 (API)

- DDD 모듈러 모놀리스. 컨텍스트: identity, curriculum, learning(핵심), progression, review, notification, jobs. 각 컨텍스트는 `domain / application / infrastructure / presentation` 4계층이며 `eslint-plugin-boundaries`가 의존 방향을 강제한다. 경계를 넘을 땐 포트 토큰(`QUESTION_GRADING_PORT`, `CURRICULUM_QUERY_PORT`, `REVIEW_QUEUE_PORT`, `USER_PREFS_PORT`)으로만 주입한다.
- **정답 키(`answerKey`)는 `CurriculumAdapter.forGrading()` 한 곳에서만 읽는다.** 다른 어떤 쿼리도 select하지 않는다.
- 세션 종류 `kind`: `lesson`(레슨) · `review`(복습, XP ×1.5) · `placement`(유닛 건너뛰기 테스트, XP 0). `findOpen`은 kind를 구분해서 서로 이어지지 않게 한다.
- 레슨 흐름: 시작 카드 → 본 문제 → **틀린 문제 다시 풀기**(`POST /sessions/:id/retry`, 채점만 하고 답안·XP·SM-2에 영향 없음, 최대 2회) → 완료. 재도전 허용 여부는 애그리거트 `canRetry/retry`가 판단한다.
- 유닛 건너뛰기: `POST /units/:unitId/skip-test` → 8문제, 80% 이상이면 트랙 처음부터 그 유닛까지 완료 처리(`UserLessonProgress.completedAt`만 찍고 점수 0). 정책은 `learning/domain/services/unit-skip-test.ts`.
- 결과 화면 `newReviewCount`("내일 복습 예정")는 사용자 로컬 **내일의 마지막 순간**까지 due인 수다(`learning/domain/services/review-preview.ts`). SM-2가 방금 푼 문제를 답한 시각+24시간으로 예약하므로 "내일 00:00"까지로 끊으면 0이 된다. 복습 예약은 `AnswerGraded` 비동기 처리라 완료 시점에 저장 전일 수 있어, 이번 세션 오답 수를 하한으로 둔다.
- 콘텐츠에서 빠진 문제는 시드가 삭제하지 않고 `status=retired`로 내린다(답안·복습 기록 FK 보존). `lesson.questionCount`는 콘텐츠 파일의 문제 수를 따른다.
- 도메인 규칙은 단위 테스트가 있어야 한다(`apps/api/test/*.spec.ts`, vitest). HTTP 흐름은 `apps/api/test-e2e/`가 CI에서 빌드된 서버 + CI Postgres로 돈다.

## 화면 규칙 (웹)

- **디자인 "Platinum"(2026-10-14, #37)** — 90년대 데스크톱 GUI의 문법을 빌린 거의 흑백 룩. Apple 고유 요소(사과 로고·Chicago 글꼴·Finder 창 모양)는 쓰지 않는다. 기억 요소: 줄무늬 타이틀바 **창**(`components/window.tsx`), **반전(inverse video)** 선택, **디더** 패턴, 현재 노드의 **개미 행렬** 점선. 모든 면은 바탕과 같은 색(평면) + 1px ink 테두리 + 블러 없는 `2px 2px 0` 그림자. 입력 필드만 `--color-field`(흰색).
  - 토큰: 라이트 ground/surface `#DCDCDC`, line `#8A8A8A`, ink `#000`, ink-2 `#555`, wrong `#BD0F29`; 다크 ground/surface `#262626`, line `#7A7A7A`, ink `#F2F2F2`, ink-2 `#B5B5B5`, wrong `#FF7474`. brand/correct는 ink와 같다(색이 아니라 반전·테두리·아이콘으로 표현). 유채색은 오답 빨강 하나.
  - 글꼴: 디스플레이(제목·숫자·버튼·라벨·창 제목) **Neo둥근모**(jsdelivr `neodgm/neodgm-webfont`, 폴백 Galmuri11 → Plex Mono) — **16px 정수배(`bit`16 / `bit-2`32 / `bit-3`48)로만**. 본문·문제·해설은 IBM Plex Sans KR. `next/font/google`은 이 환경에서 빌드가 막혀 쓰지 않고 `<link>`로 로드한다.
  - 정보 위계: 현재 레슨만 반전(검정 패드 + 개미 행렬), 완료는 디더 + 판 위 check, 잠김은 윤곽만. 현재 유닛 헤더만 ink. 스트릭은 홈 상단 36px 상태 바의 **반전 배지**(`3일째`) + 12px 주간 칸(달성 채움·프리즈 디더·오늘 미달성 개미 행렬·미래 윤곽). 탭 바·사이드바 선택은 **아이콘 타일(28px)만 반전**.
  - 모션(전부 `steps()`, ≤200ms, `prefers-reduced-motion`에서 제거): 주 버튼 클릭 깜빡임 1회(`lib/use-flash.ts`), 누르는 동안 반전, 정답 check 스탬프, 오답 행 흔들림, 정·오답 창 **줌 사각형** 열림, 결과 링 10단계 채움, 스트릭 불꽃 2프레임(`FlameLive`, 스트릭 ≥1일 때만). 그 외 모션 금지.
  - 아이콘은 `components/icons.tsx` 인라인 SVG(이모지 금지). 글자 대비 4.5:1 이상(토큰 바꾸면 전 조합 재계산).
- 전역 컴포넌트 클래스(`.card .btn-3d .btn-outline .option .input .chip .pad .meter`)는 `@layer components` 안에 둔다. 밖에 두면 Tailwind 유틸리티보다 우선해 `bg-*` 같은 조합이 무시된다(실제로 유닛 헤더가 사라졌던 버그). `ring` 같은 Tailwind 유틸리티 이름과 겹치는 클래스명을 만들지 않는다(결과 링은 `score-ring`).
- 테마는 `<html data-theme>`로 제어한다(`lib/theme.ts`, 시스템/라이트/다크, 기기별 localStorage, 첫 페인트 전 인라인 스크립트). 색은 CSS 변수만 쓰고 하드코딩하지 않는다.
- 레슨 플레이어 문제 영역은 헤더와 하단 버튼 사이에서 **세로 가운데 정렬**, 폭 600px.
- 마지막으로 본 트랙 탭은 기기에 저장한다(`lib/last-track.ts`). `/learn`으로 돌아올 때 URL → 저장값 → 첫 트랙 순.
- `/api/*`·`/auth/*`는 Next.js 리라이트로 API에 전달한다. OAuth 콜백은 **웹 오리진**(`OAUTH_CALLBACK_BASE_URL` = `WEB_BASE_URL`)으로 받아야 쿠키가 웹 도메인에 붙는다.

## 콘텐츠 규칙 (요약 — 상세는 docs/content-guide.md)

사용자가 명시적으로 정한 원칙이라 바꾸려면 먼저 물어본다.

- **비전공자 눈높이, 그러나 전문 용어 사용.** 일상 비유(접시·줄 서기·택배·우편·주방·엑셀 등)는 어디에도 쓰지 않는다. 쉬움은 "정의·기본 동작을 짧게 묻는 것"으로 만든다.
- **듀오링고식 반복 드릴**: 레슨당 핵심 개념 1~2개(= curriculum.json의 keyPoints), 10문제를 소개(001~002)→구분(003~004)→빈칸(005~006)→적용(007~009)→되짚기(010) 순서로. 같은 개념이 3번 이상 다른 형태로 나오고, **keyPoints에 없는 개념을 정답으로 요구하지 않는다**(학습자는 시작 카드의 핵심 정리만 보고 들어온다).
- 문제 50자·보기 15자 이내, 해설 1~2문장, 난이도 1~2만, 유형은 single 6 · ox 2(O 1·X 1) · fill 2. `multi`·코드 블록은 쓰지 않는다.
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
- [ ] 미작성 유닛 keyPoints 손질(2026-10-13 재배치 뒤 어긋난 것): os `u04` l07 "페이지 폴트 … 트랩" → "예외(폴트)"로(새 2유닛의 트랩 정의와 충돌), os `u07` l08 파이프의 "블로킹"은 I/O 모델 유닛보다 먼저 나오니 풀어서 쓰기, dsa `u09` l08 "비교 정렬의 하한"에서 결정 트리·힙 정렬 언급 제거(트리·힙 유닛보다 앞)
- [ ] Resend API 키 등록(이메일 리마인더)
- [ ] 나머지 25유닛 244레슨 문제 작성 (curriculum.json의 keyPoints + docs/content-guide.md v4 기준, 유닛 단위로 서브에이전트 병렬)
- [ ] README의 운영·배포 절은 오래됐다(GitHub Secrets 기준) → CLAUDE.md 운영 현황과 맞추기
- [ ] 머지된 원격 브랜치 정리(이 환경에서 삭제 불가 — 레포 설정 "Automatically delete head branches" 권장)
- [ ] 무료 체험 종료(2027-01-05) 전 결제 계정 전환 알림
