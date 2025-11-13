# syntax=docker/dockerfile:1
FROM node:20-alpine

# Build context is the ebs/ folder (via fly.toml or --dockerfile path)
WORKDIR /app

# Install prod deps first for better layer caching
COPY package.json package-lock.json ./
# Prefer reproducible installs; fall back to npm install if lock is out of sync
RUN npm ci --omit=dev || npm install --omit=dev

# Copy source
COPY . ./

# Create data dir (volume may mount here in Fly)
ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 8080
CMD ["node", "-r", "newrelic", "server.js"]
