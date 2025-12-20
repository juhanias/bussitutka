# syntax=docker/dockerfile:1

FROM oven/bun:latest

WORKDIR /app

# copy repo first so workspace installs can resolve reliably
COPY . .

RUN bun install --frozen-lockfile
RUN cd apps/web && bun run build

EXPOSE 3000

# run a non-watch server command (no dev mode in containers)
CMD ["bun", "run", "start:server"]
