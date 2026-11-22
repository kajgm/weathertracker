# Build stage runs on the build host's native arch: the output is static
# HTML/JS/CSS, so it is identical for every target platform and multi-arch
# builds don't need to run npm under QEMU.
FROM --platform=$BUILDPLATFORM node:26.13.1-alpine3.24 AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# Production stage: unprivileged nginx (uid 101, listens on 8080) so the pod
# can run as non-root with a read-only root filesystem.
FROM nginxinc/nginx-unprivileged:1.30.6-alpine AS production-stage
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build-stage /app/dist /usr/share/nginx/html
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
