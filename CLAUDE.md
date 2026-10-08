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
| 로그인 | GitHub·Google OAuth. Google 앱은 **테스트 중** 상태라 등록된 테스트 사용자만 로그인 가능 |
| 예산 | GCP 월 ₩10,000 알림, 무료 체험 2027-01-05 종료 |
| 콘텐츠 | 4트랙 37유닛 111레슨 중 **36레슨(앞 3유닛×4트랙) 360문제** 작성됨, 레슨당 10문제 |

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
- 비밀값(OAuth 시크릿, DB 비밀번호 등)은 절대 보거나 적지 않는다. 필요하면 사용자가 Cloud Shell에서 `read -rsp`로 직접 입력하게 하고, 입력 후 `gcloud run services update ... --update-labels=secrets-rev=...`로 새 리비전을 띄운다.

## 아키텍처 규칙 (API)

- DDD 모듈러 모놀리스. 컨텍스트: identity, curriculum, learning(핵심), progression, review, notification, jobs. 각 컨텍스트는 `domain / application / infrastructure / presentation` 4계층이며 `eslint-plugin-boundaries`가 의존 방향을 강제한다. 경계를 넘을 땐 포트 토큰(`QUESTION_GRADING_PORT`, `CURRICULUM_QUERY_PORT`, `REVIEW_QUEUE_PORT`, `USER_PREFS_PORT`)으로만 주입한다.
- **정답 키(`answerKey`)는 `CurriculumAdapter.forGrading()` 한 곳에서만 읽는다.** 다른 어떤 쿼리도 select하지 않는다.
- 세션 종류 `kind`: `lesson`(레슨) · `review`(복습, XP ×1.5) · `placement`(유닛 건너뛰기 테스트, XP 0). `findOpen`은 kind를 구분해서 서로 이어지지 않게 한다.
- 레슨 흐름: 시작 카드 → 본 문제 → **틀린 문제 다시 풀기**(`POST /sessions/:id/retry`, 채점만 하고 답안·XP·SM-2에 영향 없음, 최대 2회) → 완료. 재도전 허용 여부는 애그리거트 `canRetry/retry`가 판단한다.
- 유닛 건너뛰기: `POST /units/:unitId/skip-test` → 8문제, 80% 이상이면 트랙 처음부터 그 유닛까지 완료 처리(`UserLessonProgress.completedAt`만 찍고 점수 0). 정책은 `learning/domain/services/unit-skip-test.ts`.
- 콘텐츠에서 빠진 문제는 시드가 삭제하지 않고 `status=retired`로 내린다(답안·복습 기록 FK 보존). `lesson.questionCount`는 콘텐츠 파일의 문제 수를 따른다.
- 도메인 규칙은 단위 테스트가 있어야 한다(`apps/api/test/*.spec.ts`, vitest). HTTP 흐름은 `apps/api/test-e2e/`가 CI에서 빌드된 서버 + CI Postgres로 돈다.

## 화면 규칙 (웹)

- 전역 컴포넌트 클래스(`.card .btn-3d .option .input`)는 `@layer components` 안에 둔다. 밖에 두면 Tailwind 유틸리티보다 우선해 `bg-*` 같은 조합이 무시된다(실제로 유닛 헤더가 사라졌던 버그).
- 테마는 `<html data-theme>`로 제어한다(`lib/theme.ts`, 시스템/라이트/다크, 기기별 localStorage, 첫 페인트 전 인라인 스크립트). 색은 CSS 변수만 쓰고 하드코딩하지 않는다.
- 레슨 플레이어 문제 영역은 헤더와 하단 버튼 사이에서 **세로 가운데 정렬**, 폭 600px.
- 마지막으로 본 트랙 탭은 기기에 저장한다(`lib/last-track.ts`). `/learn`으로 돌아올 때 URL → 저장값 → 첫 트랙 순.
- `/api/*`·`/auth/*`는 Next.js 리라이트로 API에 전달한다. OAuth 콜백은 **웹 오리진**(`OAUTH_CALLBACK_BASE_URL` = `WEB_BASE_URL`)으로 받아야 쿠키가 웹 도메인에 붙는다.

## 콘텐츠 규칙 (요약 — 상세는 docs/content-guide.md)

사용자가 명시적으로 정한 원칙이라 바꾸려면 먼저 물어본다.

- **비전공자 눈높이, 그러나 전문 용어 사용.** 일상 비유(접시·줄 서기·택배·우편·주방·엑셀 등)는 어디에도 쓰지 않는다. 쉬움은 "정의·기본 동작을 짧게 묻는 것"으로 만든다.
- **듀오링고식 반복 드릴**: 레슨당 핵심 개념 2~3개, 10문제를 소개(001~002)→구분(003~005)→빈칸(006~007)→적용(008~009)→되짚기(010) 순서로. 같은 개념이 3번 이상 다른 형태로 나온다.
- 문제 50자·보기 15자 이내, 해설 1~2문장, 난이도 1~2만, 유형은 single 6 · ox 2(O 1·X 1) · fill 2. `multi`·코드 블록은 쓰지 않는다.
- 주관식 대표 정답(`accepted[0]`)은 한글·영문·숫자·공백만(`FILL_PLAIN_ANSWER`, validate가 강제). Θ·²·^ 같은 기호가 필요한 답은 객관식으로.
- 문제 id는 `{track}-{slug}-{NNN}`, **기존 id는 유지**(진도·복습 기록 보존). 레슨을 다시 쓸 때도 id를 바꾸지 않는다.
- 저장 후 `pnpm content:validate` 통과 필수. 대량 재작성은 트랙별 서브에이전트로 병렬 처리하고, 끝나면 길이·유형·OX 균형을 스크립트로 전수 점검한다.

## 사용자 선호

- 질문은 꼭 필요할 때 한 번에 하나. 합리적 가정을 밝히고 먼저 진행한다.
- 로그인·결제·약관 동의·OAuth 승인은 사용자가 직접 한다. 그 외 설정은 맡긴다.
- 구현 계획처럼 큰 작업은 상위 모델, 단순 반복 작업은 서브에이전트로 나눠 돌린다.
- 보고는 결과 중심으로 짧게. 무엇을 바꿨고 무엇을 확인했는지, 확인하지 못한 것은 솔직히 적는다.

## 남은 일

- [ ] Cloud Scheduler: 매시 `POST {API}/internal/jobs/tick`, `Authorization: Bearer {JOBS_SECRET}` (서비스 계정 `cs-daily-scheduler`) — 스트릭 프리즈·리마인더 배치가 아직 안 돈다
- [ ] `backup.yml`이 아직 `secrets.PROD_DIRECT_URL`을 참조한다 → WIF + Secret Manager로 전환
- [ ] 레슨 결과 화면의 "내일 복습 예정 N문제"가 지금 당장 due인 것만 세어 0으로 나온다
- [ ] Google OAuth 앱 게시(테스트 사용자 외 로그인 허용), Resend API 키 등록(이메일 리마인더)
- [ ] 나머지 75레슨 문제 작성 (docs/content-guide.md 기준)
- [ ] 핵심 개념 2~3개로 줄이며 뺀 커리큘럼 목표(교착 상태 회피·탐지, 우선순위 부스트, 코드·데이터 영역 등)를 뒤 유닛으로 재배치
- [ ] 머지된 원격 브랜치 정리(이 환경에서 삭제 불가 — 레포 설정 "Automatically delete head branches" 권장)
- [ ] 무료 체험 종료(2027-01-05) 전 결제 계정 전환 알림
