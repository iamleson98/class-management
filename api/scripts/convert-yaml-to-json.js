#!/usr/bin/env node
/**
 * Converts the concatenated OpenAPI YAML spec to JSON.
 * Handles duplicate keys by letting the last one win (expected for
 * concatenated source files where some paths may overlap).
 */

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const ROOT = path.resolve(__dirname, '..');
const V4_YAML = path.join(ROOT, 'v4/html/static/mattermost-openapi-v4.yaml');
const V4_JSON = path.join(ROOT, 'v4/html/static/mattermost-openapi-v4.json');

// Parse with duplicate keys allowed (last wins)
const yamlContent = fs.readFileSync(V4_YAML, 'utf8');

const doc = new YAML.Document({}).toJSON();
const parsed = YAML.parse(yamlContent, {
  // Use json schema to avoid strict type errors, but we need uniqueKeys:false
  // The 'yaml' library v2 supports uniqueKeys option
  uniqueKeys: false,
});

fs.writeFileSync(V4_JSON, JSON.stringify(parsed, null, 2));

const stats = fs.statSync(V4_JSON);
console.log(`JSON written to ${path.relative(ROOT, V4_JSON)} (${(stats.size / 1024).toFixed(1)} KB)`);
