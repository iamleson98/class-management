/**
 * i18n-sync.ts
 *
 * Scans the frontend codebase (excluding src/chat) for `t('key')` translation
 * calls, extracts the keys, and appends any keys missing from `en.ts` / `vi.ts`
 * with an empty value ('') so they are easy to spot and fill in.
 *
 * Usage:
 *   bun run scripts/i18n-sync.ts            # write missing keys into locale files
 *   bun run scripts/i18n-sync.ts --dry-run  # only report, do not write
 *   bun run scripts/i18n-sync.ts --src <dir> # override source root (defaults to ./src)
 */

import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'

const ROOT = resolve(dirname(new URL(import.meta.url).pathname))
const FE_ROOT = resolve(ROOT, '..')
const SRC_ROOT = resolve(FE_ROOT, 'src')
const LOCALES_DIR = resolve(SRC_ROOT, 'lib', 'i18n', 'locales')
const EN_FILE = join(LOCALES_DIR, 'en.ts')
const VI_FILE = join(LOCALES_DIR, 'vi.ts')

const EXCLUDE_DIRS = new Set(['chat', 'node_modules', '.next', 'dist', '.git'])
const INCLUDE_EXT = new Set(['.ts', '.tsx'])

// ── Args ────────────────────────────────────────────────
const argv = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')

// ── File walking ────────────────────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of entries) {
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (EXCLUDE_DIRS.has(name)) continue
      walk(full, out)
    } else if (st.isFile() && INCLUDE_EXT.has(name.slice(name.lastIndexOf('.')))) {
      out.push(full)
    }
  }
  return out
}

// ── Extract t('...') keys from a source file ────────────
// Matches a standalone identifier `t` (word boundary, so `submit(` / `get(` are
// excluded) immediately followed by `(` and a single/double/backtick string
// literal. Only static literal keys are captured; dynamic/computed keys are
// skipped (and would need manual handling).
const T_CALL_RE = /\bt\(\s*(['"`])([^'"`]+)\1/g

function extractKeysFromFile(file: string): string[] {
  const src = readFileSync(file, 'utf8')
  const keys: string[] = []
  let m: RegExpExecArray | null
  T_CALL_RE.lastIndex = 0
  while ((m = T_CALL_RE.exec(src)) !== null) {
    const key = m[2].trim()
    if (key) keys.push(key)
  }
  return keys
}

// ── Extract existing keys from a locale file ────────────
// Matches object-literal entries like `  'some.key': ...,` at the start of a
// line. Supports single/double/backtick quoted keys.
const LOCALE_KEY_RE = /^\s*(['"`])([^'"`]+)\1\s*:/gm

function extractLocaleKeys(file: string): Set<string> {
  if (!existsSync(file)) return new Set()
  const src = readFileSync(file, 'utf8')
  const keys = new Set<string>()
  let m: RegExpExecArray | null
  LOCALE_KEY_RE.lastIndex = 0
  while ((m = LOCALE_KEY_RE.exec(src)) !== null) {
    keys.add(m[2].trim())
  }
  return keys
}

// ── Append missing keys to a locale file ────────────────
function appendMissingKeys(
  file: string,
  existing: Set<string>,
  missing: string[]
): void {
  if (missing.length === 0) return
  const src = readFileSync(file, 'utf8')

  // Insert just before the closing `} as const` (or final `}` fallback).
  const closeIdx = src.lastIndexOf('} as const')
  const anchor = closeIdx >= 0 ? '} as const' : '}'
  const insertAt = src.lastIndexOf(anchor)
  if (insertAt < 0) {
    console.warn(`⚠️  Could not find closing brace in ${relative(FE_ROOT, file)} — skipping.`)
    return
  }

  const lines = missing.map((k) => `  ${JSON.stringify(k)}: '',`)
  const block =
    '\n  // ── Missing translations (auto-detected, fill in) ──\n' +
    lines.join('\n') +
    '\n'

  const next = src.slice(0, insertAt) + block + src.slice(insertAt)

  if (DRY_RUN) return
  writeFileSync(file, next)
}

// ── Main ────────────────────────────────────────────────
function main() {
  if (!existsSync(SRC_ROOT)) {
    console.error(`✖ Source root not found: ${SRC_ROOT}`)
    process.exit(1)
  }

  const files = walk(SRC_ROOT)
  const found = new Map<string, string[]>() // key -> source files (for reporting)

  for (const f of files) {
    for (const key of extractKeysFromFile(f)) {
      const rel = relative(FE_ROOT, f)
      const list = found.get(key)
      if (list) {
        if (!list.includes(rel)) list.push(rel)
      } else {
        found.set(key, [rel])
      }
    }
  }

  const allKeys = [...found.keys()].sort()
  const enExisting = extractLocaleKeys(EN_FILE)
  const viExisting = extractLocaleKeys(VI_FILE)

  const missingInEn = allKeys.filter((k) => !enExisting.has(k))
  const missingInVi = allKeys.filter((k) => !viExisting.has(k))

  console.log('─'.repeat(60))
  console.log('i18n sync')
  console.log('─'.repeat(60))
  console.log(`Scanned files        : ${files.length}`)
  console.log(`Unique t() keys found: ${allKeys.length}`)
  console.log(`Keys in en.ts        : ${enExisting.size}`)
  console.log(`Keys in vi.ts        : ${viExisting.size}`)
  console.log(`Missing in en.ts     : ${missingInEn.length}`)
  console.log(`Missing in vi.ts     : ${missingInVi.length}`)
  if (DRY_RUN) console.log(`Mode                 : DRY RUN (no files written)`)
  console.log('─'.repeat(60))

  if (missingInEn.length) {
    console.log('\nMissing in en.ts:')
    missingInEn.forEach((k) => console.log(`  • ${k}`))
  }
  if (missingInVi.length) {
    console.log('\nMissing in vi.ts:')
    missingInVi.forEach((k) => console.log(`  • ${k}`))
  }

  appendMissingKeys(EN_FILE, enExisting, missingInEn)
  appendMissingKeys(VI_FILE, viExisting, missingInVi)

  if (!DRY_RUN && (missingInEn.length || missingInVi.length)) {
    console.log('\n✔ Updated:')
    if (missingInEn.length) console.log(`  ${relative(FE_ROOT, EN_FILE)} (+${missingInEn.length})`)
    if (missingInVi.length) console.log(`  ${relative(FE_ROOT, VI_FILE)} (+${missingInVi.length})`)
  } else if (!missingInEn.length && !missingInVi.length) {
    console.log('\n✓ Nothing missing — locale files are in sync.')
  }

  // Keys present in locale files but never referenced in code (informational).
  const referenced = new Set(allKeys)
  const unusedEn = [...enExisting].filter((k) => !referenced.has(k))
  const unusedVi = [...viExisting].filter((k) => !referenced.has(k))
  if (unusedEn.length || unusedVi.length) {
    console.log('\n─'.repeat(59))
    console.log('ℹ Possibly unused keys (in locale files but no t() call found):')
    const unused = new Set([...unusedEn, ...unusedVi])
    console.log(`  ${unused.size} unique key(s). Pass --show-unused to list them.`)
    if (argv.includes('--show-unused')) {
      ;[...unused].sort().forEach((k) => console.log(`  • ${k}`))
    }
  }

  console.log('')
}

main()
