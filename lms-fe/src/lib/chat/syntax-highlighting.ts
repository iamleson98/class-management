/**
 * Code syntax highlighting — ports the vendored webapp's
 * utils/syntax_highlighting.tsx verbatim. Uses highlight.js core (no languages
 * bundled) with per-language lazy registration via dynamic import(), exactly as
 * the old chat app does. Includes the full 64-language HighlightedLanguages
 * constant (name/extensions/aliases) from utils/constants.tsx.
 */

import hlJS from 'highlight.js/lib/core'

// ─── HighlightedLanguages constant (from utils/constants.tsx: 64 languages) ──

interface LanguageObject {
  [key: string]: { name: string; extensions: string[]; aliases?: string[] }
}

export const HighlightedLanguages: LanguageObject = {
  '1c': { name: '1C:Enterprise', extensions: ['bsl', 'os'], aliases: ['bsl'] },
  actionscript: { name: 'ActionScript', extensions: ['as'], aliases: ['as', 'as3'] },
  applescript: { name: 'AppleScript', extensions: ['applescript', 'osascript', 'scpt'], aliases: ['osascript'] },
  bash: { name: 'Bash', extensions: ['sh'], aliases: ['sh', 'zsh'] },
  clojure: { name: 'Clojure', extensions: ['clj', 'boot', 'cl2', 'cljc', 'cljs', 'cljs.hl', 'cljscm', 'cljx', 'hic'], aliases: ['clj'] },
  coffeescript: { name: 'CoffeeScript', extensions: ['coffee', '_coffee', 'cake', 'cjsx', 'cson', 'iced'], aliases: ['coffee', 'coffee-script'] },
  cpp: { name: 'C/C++', extensions: ['cpp', 'c', 'cc', 'h', 'c++', 'h++', 'hpp'], aliases: ['c++', 'c'] },
  csharp: { name: 'C#', extensions: ['cs', 'csharp'], aliases: ['c#', 'cs', 'csharp'] },
  css: { name: 'CSS', extensions: ['css'] },
  d: { name: 'D', extensions: ['d', 'di'], aliases: ['dlang'] },
  dart: { name: 'Dart', extensions: ['dart'] },
  delphi: { name: 'Delphi', extensions: ['delphi', 'dpr', 'dfm', 'pas', 'pascal', 'freepascal', 'lazarus', 'lpr', 'lfm'], aliases: ['pas', 'pascal'] },
  diff: { name: 'Diff', extensions: ['diff', 'patch'], aliases: ['patch', 'udiff'] },
  django: { name: 'Django', extensions: ['django', 'jinja'], aliases: ['jinja'] },
  dockerfile: { name: 'Dockerfile', extensions: ['dockerfile', 'docker'], aliases: ['docker'] },
  elixir: { name: 'Elixir', extensions: ['ex', 'exs'], aliases: ['ex', 'exs'] },
  erlang: { name: 'Erlang', extensions: ['erl'], aliases: ['erl'] },
  fortran: { name: 'Fortran', extensions: ['f90', 'f95'], aliases: ['f90', 'f95'] },
  fsharp: { name: 'F#', extensions: ['fsharp', 'fs'], aliases: ['fs'] },
  gcode: { name: 'G-Code', extensions: ['gcode', 'nc'] },
  go: { name: 'Go', extensions: ['go'], aliases: ['golang'] },
  groovy: { name: 'Groovy', extensions: ['groovy'] },
  handlebars: { name: 'Handlebars', extensions: ['handlebars', 'hbs', 'html.hbs', 'html.handlebars'], aliases: ['hbs', 'mustache'] },
  haskell: { name: 'Haskell', extensions: ['hs'], aliases: ['hs'] },
  haxe: { name: 'Haxe', extensions: ['hx'], aliases: ['hx'] },
  java: { name: 'Java', extensions: ['java', 'jsp'] },
  javascript: { name: 'JavaScript', extensions: ['js', 'jsx'], aliases: ['js'] },
  json: { name: 'JSON', extensions: ['json'] },
  julia: { name: 'Julia', extensions: ['jl'], aliases: ['jl'] },
  kotlin: { name: 'Kotlin', extensions: ['kt', 'ktm', 'kts'], aliases: ['kt'] },
  latex: { name: 'LaTeX', extensions: ['tex'], aliases: ['tex'] },
  less: { name: 'Less', extensions: ['less'] },
  lisp: { name: 'Lisp', extensions: ['lisp'] },
  lua: { name: 'Lua', extensions: ['lua'] },
  makefile: { name: 'Makefile', extensions: ['mk', 'mak'], aliases: ['make', 'mf', 'gnumake', 'bsdmake', 'mk'] },
  markdown: { name: 'Markdown', extensions: ['md', 'mkdown', 'mkd'], aliases: ['md', 'mkd'] },
  matlab: { name: 'Matlab', extensions: ['matlab', 'm'], aliases: ['m'] },
  objectivec: { name: 'Objective C', extensions: ['mm', 'objc', 'obj-c'], aliases: ['objective_c', 'objc'] },
  ocaml: { name: 'OCaml', extensions: ['ml'], aliases: ['ml'] },
  perl: { name: 'Perl', extensions: ['perl', 'pl'], aliases: ['pl'] },
  pgsql: { name: 'PostgreSQL', extensions: ['pgsql', 'postgres', 'postgresql'], aliases: ['postgres', 'postgresql'] },
  php: { name: 'PHP', extensions: ['php', 'php3', 'php4', 'php5', 'php6'], aliases: ['php3', 'php4', 'php5', 'php6'] },
  powershell: { name: 'PowerShell', extensions: ['ps', 'ps1'], aliases: ['posh'] },
  puppet: { name: 'Puppet', extensions: ['pp'], aliases: ['pp'] },
  python: { name: 'Python', extensions: ['py', 'gyp'], aliases: ['py'] },
  r: { name: 'R', extensions: ['r'], aliases: ['r', 's'] },
  ruby: { name: 'Ruby', extensions: ['ruby', 'rb', 'gemspec', 'podspec', 'thor', 'irb'], aliases: ['rb'] },
  rust: { name: 'Rust', extensions: ['rs'], aliases: ['rs'] },
  scala: { name: 'Scala', extensions: ['scala'] },
  scheme: { name: 'Scheme', extensions: ['scm', 'sld'], aliases: ['scm'] },
  scss: { name: 'SCSS', extensions: ['scss'] },
  smalltalk: { name: 'Smalltalk', extensions: ['st'], aliases: ['st', 'squeak'] },
  sql: { name: 'SQL', extensions: ['sql'] },
  stylus: { name: 'Stylus', extensions: ['styl'], aliases: ['styl'] },
  swift: { name: 'Swift', extensions: ['swift'] },
  text: { name: 'Text', extensions: ['txt', 'log'], aliases: ['txt'] },
  typescript: { name: 'TypeScript', extensions: ['ts', 'tsx'], aliases: ['ts', 'tsx'] },
  vbnet: { name: 'VB.Net', extensions: ['vbnet', 'vb', 'bas'], aliases: ['vb', 'visualbasic'] },
  vbscript: { name: 'VBScript', extensions: ['vbs'], aliases: ['vbs'] },
  verilog: { name: 'Verilog', extensions: ['v', 'veo', 'sv', 'svh'] },
  vhdl: { name: 'VHDL', extensions: ['vhd', 'vhdl'], aliases: ['vhd'] },
  vtt: { name: 'WebVTT', extensions: ['vtt'], aliases: ['vtt', 'webvtt'] },
  xml: { name: 'HTML, XML', extensions: ['xml', 'html', 'xhtml', 'rss', 'atom', 'xsl', 'plist'] },
  yaml: { name: 'YAML', extensions: ['yaml'], aliases: ['yml'] },
}

// ─── Helpers (verbatim from syntax_highlighting.tsx) ────────────────

/** Resolve a user-provided language tag to a canonical key (case-insensitive). */
function getLanguageFromNameOrAlias(name: string): string | undefined {
  const langName = name.toLowerCase()
  if (HighlightedLanguages[langName]) return langName
  return Object.keys(HighlightedLanguages).find((key) => {
    const aliases = HighlightedLanguages[key].aliases
    return aliases && aliases.find((a) => a === langName)
  })
}

/** Whether a language tag is recognized (and thus highlightable). */
export function canHighlight(language: string): boolean {
  return Boolean(getLanguageFromNameOrAlias(language))
}

/** The human-readable name for a language tag (e.g. "ts" → "TypeScript"). */
export function getLanguageName(language: string): string {
  if (canHighlight(language)) {
    const name = getLanguageFromNameOrAlias(language)
    if (!name) return ''
    return HighlightedLanguages[name].name
  }
  return ''
}

/** Infer a language key from a file extension. */
export function getLanguageFromFileExtension(extension: string): string | null {
  for (const key in HighlightedLanguages) {
    if (HighlightedLanguages[key].extensions.find((x) => x === extension)) {
      return key
    }
  }
  return null
}

// ─── Lazy language registration (verbatim language import map) ──────

const languageImports: Record<string, () => Promise<{ default: unknown }>> = {
  '1c': () => import('highlight.js/lib/languages/1c'),
  actionscript: () => import('highlight.js/lib/languages/actionscript'),
  applescript: () => import('highlight.js/lib/languages/applescript'),
  bash: () => import('highlight.js/lib/languages/bash'),
  clojure: () => import('highlight.js/lib/languages/clojure'),
  coffeescript: () => import('highlight.js/lib/languages/coffeescript'),
  cpp: () => import('highlight.js/lib/languages/cpp'),
  csharp: () => import('highlight.js/lib/languages/csharp'),
  css: () => import('highlight.js/lib/languages/css'),
  d: () => import('highlight.js/lib/languages/d'),
  dart: () => import('highlight.js/lib/languages/dart'),
  delphi: () => import('highlight.js/lib/languages/delphi'),
  diff: () => import('highlight.js/lib/languages/diff'),
  django: () => import('highlight.js/lib/languages/django'),
  dockerfile: () => import('highlight.js/lib/languages/dockerfile'),
  elixir: () => import('highlight.js/lib/languages/elixir'),
  erlang: () => import('highlight.js/lib/languages/erlang'),
  fortran: () => import('highlight.js/lib/languages/fortran'),
  fsharp: () => import('highlight.js/lib/languages/fsharp'),
  gcode: () => import('highlight.js/lib/languages/gcode'),
  go: () => import('highlight.js/lib/languages/go'),
  groovy: () => import('highlight.js/lib/languages/groovy'),
  handlebars: () => import('highlight.js/lib/languages/handlebars'),
  haskell: () => import('highlight.js/lib/languages/haskell'),
  haxe: () => import('highlight.js/lib/languages/haxe'),
  java: () => import('highlight.js/lib/languages/java'),
  javascript: () => import('highlight.js/lib/languages/javascript'),
  json: () => import('highlight.js/lib/languages/json'),
  julia: () => import('highlight.js/lib/languages/julia'),
  kotlin: () => import('highlight.js/lib/languages/kotlin'),
  latex: () => import('highlight.js/lib/languages/latex'),
  less: () => import('highlight.js/lib/languages/less'),
  lisp: () => import('highlight.js/lib/languages/lisp'),
  lua: () => import('highlight.js/lib/languages/lua'),
  makefile: () => import('highlight.js/lib/languages/makefile'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  matlab: () => import('highlight.js/lib/languages/matlab'),
  objectivec: () => import('highlight.js/lib/languages/objectivec'),
  ocaml: () => import('highlight.js/lib/languages/ocaml'),
  perl: () => import('highlight.js/lib/languages/perl'),
  pgsql: () => import('highlight.js/lib/languages/pgsql'),
  php: () => import('highlight.js/lib/languages/php'),
  plaintext: () => import('highlight.js/lib/languages/plaintext'),
  powershell: () => import('highlight.js/lib/languages/powershell'),
  puppet: () => import('highlight.js/lib/languages/puppet'),
  python: () => import('highlight.js/lib/languages/python'),
  r: () => import('highlight.js/lib/languages/r'),
  ruby: () => import('highlight.js/lib/languages/ruby'),
  rust: () => import('highlight.js/lib/languages/rust'),
  scala: () => import('highlight.js/lib/languages/scala'),
  scheme: () => import('highlight.js/lib/languages/scheme'),
  scss: () => import('highlight.js/lib/languages/scss'),
  smalltalk: () => import('highlight.js/lib/languages/smalltalk'),
  sql: () => import('highlight.js/lib/languages/sql'),
  stylus: () => import('highlight.js/lib/languages/stylus'),
  swift: () => import('highlight.js/lib/languages/swift'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  vbnet: () => import('highlight.js/lib/languages/vbnet'),
  vbscript: () => import('highlight.js/lib/languages/vbscript'),
  verilog: () => import('highlight.js/lib/languages/verilog'),
  vhdl: () => import('highlight.js/lib/languages/vhdl'),
  vtt: () => import('highlight.js/lib/languages/plaintext'),
  xml: () => import('highlight.js/lib/languages/xml'),
  yaml: () => import('highlight.js/lib/languages/yaml'),
}

const registered = new Set<string>()

/** Lazily register a language into the highlight.js core (first use only). */
async function registerLanguage(languageName: string): Promise<void> {
  if (registered.has(languageName)) return
  const loader = languageImports[languageName]
  if (!loader) return
  const language = (await loader()).default as (hl: typeof hlJS) => unknown
  hlJS.registerLanguage(languageName, language as never)
  registered.add(languageName)
}

/** HTML-escape code that can't be highlighted (fallback). */
function sanitizeHtml(code: string): string {
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Highlight a code string. Returns highlighted HTML (for dangerouslySetInnerHTML)
 * or escaped plain text if the language is unknown. Mirrors highlight() exactly.
 */
export async function highlight(lang: string, code: string): Promise<string> {
  const language = getLanguageFromNameOrAlias(lang)
  if (language) {
    try {
      await registerLanguage(language)
      return hlJS.highlight(code, { language }).value
    } catch {
      // fall through to sanitized text
    }
  }
  return sanitizeHtml(code)
}

/** Produce a line-number gutter string (1-based, newline-joined). */
export function renderLineNumbers(code: string): string {
  const numberOfLines = code.split(/\r\n|\n|\r/g).length
  const lineNumbers: string[] = []
  for (let i = 0; i < numberOfLines; i++) {
    lineNumbers.push((i + 1).toString())
  }
  return lineNumbers.join('\n')
}
