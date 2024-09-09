FROM oven/bun:1 AS base
WORKDIR /home/bun/imgs

FROM base AS install
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base
COPY --from=install /temp/prod/node_modules node_modules
COPY . .


USER bun
EXPOSE 5001/tcp
ENTRYPOINT [ "bun", "run", "main.ts" ]