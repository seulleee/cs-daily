# NestJS API — Cloud Run용 멀티스테이지 이미지 (최종 ~180MB)
# 빌드 컨텍스트는 레포 루트: docker build -f apps/api/Dockerfile .
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
# Prisma 엔진이 openssl을 요구
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile --filter @cs-daily/api... --config.confirmModulesPurge=false

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @cs-daily/contracts build \
 && pnpm --filter @cs-daily/api prisma:generate \
 && pnpm --filter @cs-daily/api build \
 && pnpm --filter @cs-daily/api... deploy --prod /out

FROM node:22-slim AS runtime
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build /out ./
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
USER node
EXPOSE 8080
# Cloud Run은 $PORT로 리슨해야 함. 마이그레이션은 CI에서 따로 실행
CMD ["node", "dist/main.js"]
