# feelfreedoc — Next.js app + Python document worker in one image.
FROM node:22-bookworm-slim AS base
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip \
      libreoffice-writer libreoffice-calc libreoffice-impress \
      tesseract-ocr tesseract-ocr-eng tesseract-ocr-fra tesseract-ocr-spa tesseract-ocr-deu tesseract-ocr-por tesseract-ocr-ita \
      chromium fonts-dejavu fonts-liberation fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*
COPY worker/requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /tmp/requirements.txt

FROM base AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# NEXT_PUBLIC_* values are baked into the build; hosts like Railway pass service variables in as build args.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_MAX_UPLOAD_MB=50
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_MAX_UPLOAD_MB=$NEXT_PUBLIC_MAX_UPLOAD_MB
RUN npm run build && npm prune --omit=dev

FROM base AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 CHROME_PATH=/usr/bin/chromium
RUN useradd --create-home --uid 1001 app && mkdir -p /app/.data && chown app /app/.data
COPY --from=build --chown=app /app /app
USER app
EXPOSE 3000
CMD ["npm", "start", "--", "-H", "0.0.0.0"]
