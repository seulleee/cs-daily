# NestJS API — Cloud Run 이미지
# 빌드 컨텍스트는 레포 루트: docker build -f apps/api/Dockerfile .
# pnpm deploy는 Prisma 생성 클라이언트(node_modules/.prisma)를 빠뜨리므로, 빌드한 워크스페이스를 그대로 복사한다.
FROM node:22-slim AS build
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @cs-daily/api...
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter @cs-daily/contracts build \
 && pnpm --filter @cs-daily/api prisma:generate \
 && pnpm --filter @cs-daily/api build

FROM node:22-slim AS runtime
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=8080
COPY --from=build --chown=node:node /repo /repo
WORKDIR /repo/apps/api
USER node
EXPOSE 8080
# 마이그레이션·시드는 CI에서 실행. 컨테이너는 서버만 띄운다
CMD ["node", "dist/main.js"]
