/*
 * New Relic agent configuration (CommonJS).
 * See: https://docs.newrelic.com/docs/apm/agents/nodejs-agent/configuration/nodejs-agent-configuration/
 */
'use strict'

exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || 'twitch-timer-ebs'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || '',
  distributed_tracing: { enabled: true },
  allow_all_headers: true,
  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info'
  },
  application_logging: {
    forwarding: { enabled: true },
    metrics: { enabled: true },
    local_decorating: { enabled: true }
  },
  attributes: {
    include: [
      'request.headers.*',
      'response.headers.*',
      'request.parameters.*',
      'message.*'
    ]
  },
  transaction_tracer: {
    enabled: true,
    record_sql: 'obfuscated'
  },
  browser_monitoring: { enabled: false },
  rules: { ignore: [/^\/healthz$/] }
}

