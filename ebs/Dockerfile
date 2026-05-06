# syntax=docker/dockerfile:1
FROM node:20-alpine

# Build context is the ebs/ directory itself (fly.toml lives here, so
# `cd ebs && fly deploy` makes ebs/ the context). Paths below are relative
# to that context.
WORKDIR /app

# Install ffmpeg for video/audio compression and trimming
RUN apk add --no-cache ffmpeg

# Install prod deps first for better layer caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy EBS source
COPY . ./

# Create data dir (volume may mount here in Fly)
ENV DATA_DIR=/data
RUN mkdir -p /data
EXPOSE 8080
CMD ["node", "server.js"]
