FROM node:24-alpine AS base
ARG VITE_REDIRECT_URL
ARG VITE_TEMPORAL_ADDRESS
ENV VITE_REDIRECT_URL=$VITE_REDIRECT_URL
ENV VITE_TEMPORAL_ADDRESS=$VITE_TEMPORAL_ADDRESS
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack use pnpm
RUN apk add --no-cache openssl curl

COPY ../../package.json /app/package.json
COPY ../../pnpm-lock.yaml /app/pnpm-lock.yaml
COPY ../../pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY ../../packages/core /app/packages/core
COPY ../../packages/database /app/packages/database
COPY ../../packages/website /app/packages/website
WORKDIR /app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build
EXPOSE 3000
CMD ["pnpm", "-F", "@decelerator/website", "start"]