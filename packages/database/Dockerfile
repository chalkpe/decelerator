FROM node:24-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack use pnpm
RUN apk add --no-cache openssl curl

COPY ../../package.json /app/package.json
COPY ../../pnpm-lock.yaml /app/pnpm-lock.yaml
COPY ../../pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY ../../packages/database /app/packages/database
WORKDIR /app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build
CMD ["pnpm", "-F", "@decelerator/database", "start"]