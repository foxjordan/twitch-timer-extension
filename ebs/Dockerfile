# syntax=docker/dockerfile:1
FROM node:20-alpine

# Build context is the ebs/ folder (via fly.toml or --dockerfile path)
WORKDIR /app

# Install ffmpeg for video/audio compression and trimming
RUN apk add --no-cache ffmpeg

# Install prod deps first for better layer caching
COPY package*.json ./
# Install deps (no dev dependencies)
RUN npm install --omit=dev

# Copy source
COPY . ./

# Create data dir (volume may mount here in Fly)
ENV DATA_DIR=/data
RUN mkdir -p /data
EXPOSE 8080
CMD ["node", "server.js"]
