# syntax=docker/dockerfile:1
# ibcs-react docs site — Next.js (output: standalone) + fumadocs, built from
# the REPO ROOT context: docker build -f deploy/Dockerfile .
#
# Stage 1 builds the library first (docs/ consumes it as a file:.. dependency
# resolving to /repo/dist), then the docs app. Stage 2 runs the traced
# standalone server as the non-root `node` user on :8080 (probe: /healthz).

FROM node:22-alpine AS build
WORKDIR /repo
ENV NEXT_TELEMETRY_DISABLED=1

# Library: install + build dist/ (what the docs app imports).
COPY package.json package-lock.json tsconfig.json tsdown.config.ts ./
COPY scripts/ scripts/
RUN npm ci --ignore-scripts
COPY src/ src/
RUN npm run build

# Docs app: install (links ibcs-react -> /repo), then build.
COPY docs/package.json docs/package-lock.json docs/
RUN cd docs && npm ci --ignore-scripts
COPY docs/ docs/
RUN cd docs && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=8080

# Standalone output is traced from the repo root (because of the file:..
# dependency), so the server entry lands at docs/server.js inside the bundle.
COPY --from=build /repo/docs/.next/standalone ./
COPY --from=build /repo/docs/.next/static ./docs/.next/static
COPY --from=build /repo/docs/public ./docs/public

USER node
EXPOSE 8080
CMD ["node", "docs/server.js"]
