# Nuxt 4.5.x requires Node 22.19+ (Node 20 can install dependencies but fails
# while building Nitro), so keep build and runtime on the supported LTS line.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NITRO_HOST=0.0.0.0 NITRO_PORT=3000
COPY --from=build /app/.output ./.output
# Nitro traces the libsql JavaScript package but excludes its platform-specific
# optional binding. Copy the binding selected by npm ci on Alpine explicitly.
COPY --from=build /app/node_modules/@libsql/linux-x64-musl ./.output/server/node_modules/@libsql/linux-x64-musl
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
