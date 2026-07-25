# syntax=docker/dockerfile:1
FROM node:20-alpine

# Build context is the repo root (fly.toml lives there).
# Paths below are relative to that context.
WORKDIR /app

# Install ffmpeg for video/audio compression and trimming
RUN apk add --no-cache ffmpeg

# Install prod deps first for better layer caching
COPY ebs/package*.json ./
RUN npm install --omit=dev

# Copy EBS source
COPY ebs/ ./

# Create data dir (volume may mount here in Fly)
ENV DATA_DIR=/data
# Without this, Express runs in development mode and leaks stack
# traces/file paths to real visitors on any unhandled error.
ENV NODE_ENV=production
RUN mkdir -p /data
EXPOSE 8080
CMD ["node", "--import", "./instrument.js", "server.js"]
