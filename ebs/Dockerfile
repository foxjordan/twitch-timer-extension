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

# Ensure the New Relic agent finds the CommonJS config file
ENV NEW_RELIC_CONFIG_FILENAME=newrelic.cjs

# Create data dir (volume may mount here in Fly)
ENV DATA_DIR=/data
RUN mkdir -p /data
ENV NEW_RELIC_NO_CONFIG_FILE=true
ENV NEW_RELIC_DISTRIBUTED_TRACING_ENABLED=true
ENV NEW_RELIC_LOG=stdout
ENV NEW_RELIC_LICENSE_KEY=${NEW_RELIC_KEY}
ENV NEW_RELIC_APP_NAME=${NEW_RELIC_APP_NAME}




EXPOSE 8080
CMD ["node", "-r", "dotenv/config", "-r", "newrelic", "server.js"]
