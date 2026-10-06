# CS 데일리

하루 5분, 듀오링고 방식으로 매일 푸는 컴퓨터 사이언스. PC·모바일 반응형 웹.

| 영역 | 스택 | 호스팅 (전부 무료 구간) |
| --- | --- | --- |
| 웹 | Next.js 15 (App Router) · Tailwind v4 · TanStack Query | Vercel Hobby |
| API | NestJS 10 · `@nestjs/cqrs` · DDD 모듈러 모놀리스 · Prisma | Google Cloud Run (서울, 최소 인스턴스 0) |
| DB | PostgreSQL 16 | Supabase Free (서울) |
| 배치 | `POST /internal/jobs/tick` 매시 | Cloud Scheduler 잡 1개 |
| 이메일 | Resend | Free 3,000통/월 |

기획서(아키텍처·DB·API·로드맵)는 Claude Docs 문서 "CS 데일리 — 매일 푸는 컴퓨터 사이언스 서비스 기획서"를 참조.

## 레포 구조

```
apps/
  api/        NestJS — src/modules/{identity,curriculum,learning,progression,review,notification,jobs}
              각 컨텍스트: domain / application / infrastructure / presentation (eslint-plugin-boundaries로 강제)
  web/        Next.js — src/app (화면), src/components (레슨 플레이어·경로·셸), src/lib/api.ts (fetch 래퍼)
packages/
  contracts/  API 요청·응답 zod 스키마, 에러 코드, XP 상수 — 웹·API가 같은 타입을 쓴다
  content/    curriculum.json (4트랙 37유닛 111레슨) + questions/<track>/<unit>/<lesson>.json + 검증 스크립트
```

## 로컬 실행

```bash
corepack enable && pnpm install
cp .env.example .env          # OAuth 클라이언트 ID/시크릿 채우기 (로그인에 필요)
docker compose up -d          # Postgres 16
pnpm --filter @cs-daily/contracts build
pnpm --filter @cs-daily/api prisma:generate
pnpm --filter @cs-daily/api prisma:migrate:dev --name init   # 최초 1회: 마이그레이션 생성+적용
pnpm db:seed                  # 커리큘럼·문제 적재 (status=published)
pnpm dev                      # web :3000, api :4000 (Swagger: http://localhost:4000/docs)
```

OAuth 콜백 URL: GitHub·Google 콘솔에 `http://localhost:4000/auth/github/callback`, `/auth/google/callback` 등록.

검증 명령:

```bash
pnpm content:validate                 # 문제 JSON 스키마·커리큘럼 정합성·id 유일성
pnpm --filter @cs-daily/api test      # 도메인 단위 테스트 (채점·SM-2·스트릭·애그리거트)
pnpm lint && pnpm typecheck && pnpm build
```

## 핵심 흐름 (코드 위치)

| 흐름 | 진입점 |
| --- | --- |
| 레슨 출제 (경로상 다음 레슨 + 복습 꼬리 3문제) | `learning/application/commands/start-lesson-session.handler.ts` |
| 채점 (정답 키는 `QuestionGradingPort`로만 접근) | `learning/domain/lesson-session.aggregate.ts` → `domain/services/grader.ts` |
| 완료 → XP·스트릭·데일리 목표 | `learning/.../complete-session.handler.ts` → `progression/.../record-session-completion.handler.ts` |
| 복습 스케줄 (SM-2) | `review/application/events/schedule-review-on-answer-graded.handler.ts` (AnswerGraded 구독) |
| 스트릭 프리즈·리마인더 배치 | `jobs/jobs.controller.ts` → Progression·Notification 커맨드 |
| OAuth → JWT 쿠키 | `identity/presentation/auth.controller.ts` |

## 배포 (무료 구간)

1. **Supabase**: 서울 리전 프로젝트 생성 → Connection string(Transaction pooler, 6543)을 `DATABASE_URL`(끝에 `?pgbouncer=true`), Session pooler(5432)를 `DIRECT_URL`로.
2. **GCP**: Artifact Registry 저장소 `cs-daily` 생성, Secret Manager에 `.env.example`의 비밀값 등록, Workload Identity Federation으로 GitHub Actions 서비스 계정 연결 → GitHub Secrets `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`, `PROD_DATABASE_URL`, `PROD_DIRECT_URL`, `API_BASE_URL`, `WEB_BASE_URL`, `MAIL_FROM`.
3. `main` 푸시 → `.github/workflows/ci.yml`이 검사 후 Cloud Run 배포.
4. **Cloud Scheduler**: 매시 정각 `POST {API_BASE_URL}/internal/jobs/tick`, 헤더 `Authorization: Bearer {JOBS_SECRET}`.
5. **Vercel**: `apps/web`을 Root Directory로 연결, 환경 변수 `API_INTERNAL_URL`·`NEXT_PUBLIC_API_URL`=Cloud Run URL. Vercel 도메인을 `WEB_BASE_URL`로, OAuth 콜백은 Cloud Run URL로 재등록.
6. **백업**: `.github/workflows/backup.yml`이 매일 `pg_dump` artifact(90일)를 남긴다. Supabase Free엔 자동 백업이 없다.

## 다음 단계

- [ ] 마이그레이션 초기 파일 생성 (`prisma migrate dev --name init`) 후 커밋
- [ ] 나머지 레슨 문제 작성 (현재 DB 1유닛 24문제 / 전체 111레슨)
- [ ] Playwright E2E (로그인 → 레슨 1개 → 결과)
- [ ] 2단계: 리그(Upstash Redis), 업적, 웹 푸시, 순서 배열·매칭 유형
