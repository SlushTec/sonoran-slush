FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/storefront/package.json apps/storefront/package.json
RUN npm ci
FROM dependencies AS build
COPY apps/storefront apps/storefront
COPY packages/contracts packages/contracts
COPY scripts/build-storefront.mjs scripts/next-cleanup-retry.cjs ./scripts/
ARG NEXT_PUBLIC_COMMERCE_API_URL=
ARG NEXT_PUBLIC_CUSTOMER_LOGIN_URL=
ENV NEXT_PUBLIC_COMMERCE_API_URL=$NEXT_PUBLIC_COMMERCE_API_URL NEXT_PUBLIC_CUSTOMER_LOGIN_URL=$NEXT_PUBLIC_CUSTOMER_LOGIN_URL
ENV NEXT_TELEMETRY_DISABLED=1 SONORAN_STAGE=scaffold
RUN npm run build
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 SONORAN_STAGE=scaffold PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app
COPY --from=build --chown=app:app /app/apps/storefront/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/storefront/.next/static ./apps/storefront/.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/storefront/server.js"]
