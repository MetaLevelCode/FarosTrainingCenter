// ============================================================
// FAROS — Logger estructurado (JSON) para route handlers
// Google Cloud Logging (App Hosting) parsea JSON de stdout
// automáticamente y expone severity + campos como filtros.
// ============================================================

type Severity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR'

interface LogFields {
  scope: string
  event: string
  uid?: string
  ip?: string
  [key: string]: unknown
}

function emit(severity: Severity, fields: LogFields) {
  const line = JSON.stringify({ severity, time: new Date().toISOString(), ...fields })
  if (severity === 'ERROR') console.error(line)
  else if (severity === 'WARNING') console.warn(line)
  else console.log(line)
}

export const log = {
  info:  (fields: LogFields) => emit('INFO', fields),
  warn:  (fields: LogFields) => emit('WARNING', fields),
  error: (fields: LogFields & { err?: unknown }) => {
    const err = fields.err as any
    emit('ERROR', {
      ...fields,
      err: undefined,
      message: err?.message ?? (typeof err === 'string' ? err : undefined),
      stack: err?.stack,
      code: err?.code,
    })
  },
}
