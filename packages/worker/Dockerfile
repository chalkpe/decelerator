FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack use pnpm
RUN apt-get update -y && apt-get install -y openssl

COPY ../../package.json /app/package.json
COPY ../../pnpm-lock.yaml /app/pnpm-lock.yaml
COPY ../../pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY ../../packages/core /app/packages/core
COPY ../../packages/database /app/packages/database
COPY ../../packages/worker /app/packages/worker
WORKDIR /app

FROM base
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build
CMD ["pnpm", "-F", "@decelerator/worker", "start"]