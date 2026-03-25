import 'dotenv/config'

const DEFAULT_PORT = 4173
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
const DEFAULT_RAG_API_URL =
  'https://hr-ax-pro-rag-management.eastus2.inference.ml.azure.com/score'

export class ConfigError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message)
    this.name = 'ConfigError'
  }
}

/** @param {string} name */
function readTrimmed(name) {
  const v = process.env[name]
  if (v == null) return ''
  return String(v).trim()
}

/**
 * @param {string} raw
 * @param {number} fallback
 */
function parsePort(raw, fallback) {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isInteger(n) || n < 1 || n > 65535) {
    throw new ConfigError(`PORT must be an integer from 1 to 65535 (got "${raw}")`)
  }
  return n
}

/**
 * @param {string} url
 * @param {string} varName
 */
function assertHttpsUrl(url, varName) {
  if (!url) return
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      throw new ConfigError(`${varName} must be an http(s) URL`)
    }
  } catch (e) {
    if (e instanceof ConfigError) throw e
    throw new ConfigError(`${varName} must be a valid URL (got "${url}")`)
  }
}

/**
 * When false (default), OPENAI_API_KEY, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY are required.
 * Set BACKEND_RELAX_ENV=true only for local proxy/static-only runs without the ontology backend.
 */
function isRelaxedEnv() {
  const v = readTrimmed('BACKEND_RELAX_ENV').toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

/**
 * Validate ontology-related secrets (strict mode).
 * @param {{ openaiApiKey: string, supabaseUrl: string, supabaseServiceRoleKey: string }} keys
 */
function assertOntologySecretsPresent(keys) {
  const missing = []
  if (!keys.openaiApiKey) missing.push('OPENAI_API_KEY')
  if (!keys.supabaseUrl) missing.push('SUPABASE_URL')
  if (!keys.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (missing.length === 0) return

  const hint =
    '\nUse server-side variable names only (never VITE_* or other client-exposed prefixes for secrets).\n' +
    'For local runs that only need proxies + static hosting, set BACKEND_RELAX_ENV=true (see README).'

  throw new ConfigError(
    `Missing required environment variable(s): ${missing.join(', ')}.${hint}`
  )
}

/** @type {Readonly<ServerConfig> | null} */
let _cache = null

/**
 * @typedef {object} ServerConfig
 * @property {number} port
 * @property {string} openaiApiKey
 * @property {string} openaiModel
 * @property {string} supabaseUrl
 * @property {string} supabaseServiceRoleKey
 * @property {string} ragApiUrl
 * @property {string} ragApiKey
 * @property {boolean} backendRelaxedEnv
 */

/**
 * Load and validate configuration once. Call from server.js before listen().
 * @returns {Readonly<ServerConfig>}
 */
export function loadServerConfig() {
  if (_cache) return _cache

  const relaxed = isRelaxedEnv()
  const port = parsePort(readTrimmed('PORT'), DEFAULT_PORT)

  const openaiApiKey = readTrimmed('OPENAI_API_KEY')
  const openaiModel = readTrimmed('OPENAI_MODEL') || DEFAULT_OPENAI_MODEL
  const supabaseUrl = readTrimmed('SUPABASE_URL')
  const supabaseServiceRoleKey = readTrimmed('SUPABASE_SERVICE_ROLE_KEY')

  if (!relaxed) {
    assertOntologySecretsPresent({ openaiApiKey, supabaseUrl, supabaseServiceRoleKey })
  }

  if (supabaseUrl) {
    assertHttpsUrl(supabaseUrl, 'SUPABASE_URL')
  }

  const ragApiUrl = readTrimmed('VITE_RAG_API_URL') || DEFAULT_RAG_API_URL
  const ragApiKey = readTrimmed('VITE_RAG_API_KEY')

  assertHttpsUrl(ragApiUrl, 'VITE_RAG_API_URL')

  _cache = Object.freeze({
    port,
    openaiApiKey,
    openaiModel,
    supabaseUrl,
    supabaseServiceRoleKey,
    ragApiUrl,
    ragApiKey,
    backendRelaxedEnv: relaxed
  })

  return _cache
}

/**
 * @returns {Readonly<ServerConfig>}
 */
export function getServerConfig() {
  if (!_cache) {
    throw new ConfigError(
      'Configuration not loaded: call loadServerConfig() from server.js before using getServerConfig().'
    )
  }
  return _cache
}
