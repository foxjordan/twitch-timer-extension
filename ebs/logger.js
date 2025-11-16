import { randomUUID } from "crypto";

const baseMeta = {
  service: process.env.FLY_APP_NAME || "ebs",
  env: process.env.NODE_ENV || "development",
};

function emit(level, message, meta = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...baseMeta,
    ...meta,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info(message, meta) {
    emit("info", message, meta);
  },
  warn(message, meta) {
    emit("warn", message, meta);
  },
  error(message, meta) {
    emit("error", message, meta);
  },
  debug(message, meta) {
    if (process.env.LOG_LEVEL === "debug") emit("debug", message, meta);
  },
};

export function requestLogger() {
  return function requestLoggerMiddleware(req, res, next) {
    const start = process.hrtime.bigint();
    const reqId = req.headers["x-request-id"] || randomUUID();
    req.requestId = reqId;
    res.setHeader("x-request-id", reqId);

    res.on("finish", () => {
      const durationNs = Number(process.hrtime.bigint() - start);
      const durationMs = Math.round(durationNs / 1e6);
      logger.info("http_request_completed", {
        requestId: reqId,
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs,
        userAgent: req.get?.("user-agent"),
      });
    });

    next();
  };
}

export function logErrorWithRequest(err, req, scope = "unhandled_error") {
  logger.error(scope, {
    requestId: req?.requestId,
    message: err?.message,
    stack: err?.stack,
  });
}
