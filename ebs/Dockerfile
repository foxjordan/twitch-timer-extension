# syntax=docker/dockerfile:1
FROM node:20-alpine

# Build context is the ebs/ folder (via fly.toml or --dockerfile path)
WORKDIR /app

# Install prod deps first for better layer caching
COPY package*.json ./
# Install deps; if lock present and in sync, npm ci will be used locally, but in Docker we use npm install for flexibility
RUN npm install --omit=dev

# Copy source
COPY . ./

# Create data dir (volume may mount here in Fly)
ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 8080
CMD ["node", "-r", "dotenv/config", "-r", "newrelic", "server.js"]
