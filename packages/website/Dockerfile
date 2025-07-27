FROM node:24-alpine AS base
ARG VITE_REDIRECT_URL
ARG VITE_TEMPORAL_ADDRESS
ENV VITE_REDIRECT_URL=$VITE_REDIRECT_URL
ENV VITE_TEMPORAL_ADDRESS=$VITE_TEMPORAL_ADDRESS
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack use pnpm
RUN apk add --no-cache openssl

COPY ../../package.json /app/package.json
COPY ../../pnpm-lock.yaml /app/pnpm-lock.yaml
COPY ../../pnpm-workspace.yaml /app/pnpm-workspace.yaml
COPY ../../packages/core /app/packages/core
COPY ../../packages/database /app/packages/database
COPY ../../packages/website /app/packages/website
WORKDIR /app

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM base
RUN apk add --no-cache curl
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/website/build /app/packages/website/build
COPY --from=build /app/packages/database/src/generated/prisma/*.node /app/packages/database/src/generated/prisma
EXPOSE 3000
CMD ["pnpm", "-F", "@decelerator/website", "start"]