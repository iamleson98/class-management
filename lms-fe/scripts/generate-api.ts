#!/usr/bin/env bun
/**
 * generate-api.ts — Generates a typed SDK for the LMS backend.
 *
 * Pipeline:
 *   1. Fetch the OpenAPI JSON spec (from the running backend, or a local file).
 *   2. Run `openapi-typescript` to emit typed `paths` / `components` into
 *      src/lib/schemas/openapi-types.ts.
 *
 * The SDK client itself (src/lib/sdk.ts) is hand-written once and uses
 * `openapi-fetch` bound to those generated types. It is NOT regenerated on
 * every run — only the types are. This keeps the snake_case↔camelCase
 * transform, auth handling, and response unwrapping under our control.
 *
 * Usage:
 *   bun run scripts/generate-api.ts            # fetch from localhost:8065
 *   bun run scripts/generate-api.ts --file     # read local openapi.json
 *   OPENAPI_SPEC=path bun run scripts/generate-api.ts   # explicit file
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8065";
const SPEC_URL = `${API_URL}/api/v4/lms/openapi.json`;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = join(ROOT, "src/lib/schemas");
const TYPES_FILE = join(OUT_DIR, "openapi-types.ts");

/** Fetch the OpenAPI spec as a JSON string. */
async function fetchSpec(): Promise<string> {
  const explicit = process.env.OPENAPI_SPEC;
  if (explicit && existsSync(explicit)) {
    console.log(`📂 Reading spec from OPENAPI_SPEC: ${explicit}`);
    return readFileSync(explicit, "utf-8");
  }
  if (process.argv.includes("--file")) {
    const fallback = join(ROOT, "../server/channels/api4/swagger/openapi.json");
    if (existsSync(fallback)) {
      console.log(`📂 Reading spec from local file: ${fallback}`);
      return readFileSync(fallback, "utf-8");
    }
    console.error("❌ --file given but local spec not found at", fallback);
    process.exit(1);
  }

  console.log(`🌐 Fetching spec from ${SPEC_URL}`);
  const res = await fetch(SPEC_URL, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    console.error(`❌ Failed to fetch spec: ${res.status} ${res.statusText}`);
    console.error("   Make sure the backend is running on", API_URL);
    console.error("   Or pass --file / OPENAPI_SPEC=path to read a local copy.");
    process.exit(1);
  }
  return res.text();
}

/**
 * Sanitize a parsed OpenAPI document so openapi-typescript can process it.
 * - Drop media-type objects that are null or whose `schema` is null. The
 *   upstream mattermost spec has a couple of these and they crash the
 *   generator. This only affects type generation, not the served spec.
 */
function sanitizeSpec(doc: any): any {
  if (doc && doc.paths) {
    for (const methods of Object.values<any>(doc.paths)) {
      if (!methods || typeof methods !== "object") continue;
      for (const op of Object.values<any>(methods)) {
        if (!op || typeof op !== "object" || !op.responses) continue;
        for (const resp of Object.values<any>(op.responses)) {
          if (!resp || typeof resp !== "object" || !resp.content) continue;
          for (const [mt, body] of Object.entries<any>(resp.content)) {
            if (body === null || (body && body.schema === null)) {
              delete resp.content[mt];
              if (Object.keys(resp.content).length === 0) delete resp.content;
            }
          }
        }
      }
    }
  }
  return doc;
}

/** Generate typed `paths`/`components` from the spec via openapi-typescript. */
function generateTypes(specJson: string) {
  const tmpFile = join(ROOT, ".openapi-spec.json");
  writeFileSync(tmpFile, specJson);

  try {
    console.log("🔧 Generating TypeScript types...");
    execSync(
      `bunx openapi-typescript "${tmpFile}" --output "${TYPES_FILE}" --export-type`,
      { cwd: ROOT, stdio: "pipe" },
    );
    console.log(`✅ Types → ${relative(ROOT, TYPES_FILE)}`);
  } catch (err: any) {
    console.error("❌ openapi-typescript failed. Is it installed?");
    console.error("   Run: bun add -d openapi-typescript");
    console.error(err.stdout?.toString() || err.message);
    process.exit(1);
  } finally {
    try { unlinkSync(tmpFile) } catch { /* ignore */ }
  }
}

async function main() {
  const specJson = await fetchSpec();

  // Validate JSON, then strip empty media-type schemas that crash the generator.
  let parsed: any;
  try {
    parsed = JSON.parse(specJson);
  } catch {
    console.error("❌ Spec is not valid JSON");
    process.exit(1);
  }
  sanitizeSpec(parsed);

  mkdirSync(OUT_DIR, { recursive: true });
  generateTypes(JSON.stringify(parsed));

  console.log("\n🎉 API types generated!");
  console.log("   The SDK client (src/lib/sdk.ts) uses these types via openapi-fetch.");
}

main().catch((err) => {
  console.error("❌ Generation failed:", err);
  process.exit(1);
});
