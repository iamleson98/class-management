const fs = require("fs");
const path = require("path");

const lmsApiDir = path.resolve(__dirname, "..", "..", "server", "channels", "api4", "lms_api");
const manifestPath = path.resolve(__dirname, "..", "v4", "source", "lms_api_manifest.json");
const outputFile = path.resolve(__dirname, "..", "v4", "source", "lms_api.yaml");

const methodOrder = ["get", "post", "put", "patch", "delete"];

// --- Parse Go route registrations ---
function parseRoutes(content) {
  const routes = [];
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/a\.routes\.Method\(http\.Method([A-Za-z]+)\s*,\s*"([^"]+)"/);
    if (!match) continue;
    routes.push({ routePath: match[2], method: match[1].toLowerCase() });
  }
  return routes;
}

function toOpenAPIPath(routePath) {
  return "/api/v4/lms" + routePath.replace(/\{([^}:]+):[^}]+\}/g, "{$1}");
}

function toOperationId(method, routePath) {
  const clean = routePath
    .replace(/\{([^}:]+):[^}]+\}/g, "$1")
    .split("/")
    .filter(Boolean)
    .map((part) =>
      part
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
        .join("")
    )
    .join("");
  return `Lms${method.charAt(0).toUpperCase()}${method.slice(1)}${clean}`;
}

function getPathParams(routePath) {
  const params = [];
  const regex = /\{([^}:]+):[^}]+\}/g;
  let match;
  while ((match = regex.exec(routePath))) {
    params.push(match[1]);
  }
  return params;
}

// --- YAML schema serializer ---
function schemaToYaml(obj, indent) {
  if (obj.$ref) {
    return `${" ".repeat(indent)}$ref: "${obj.$ref}"`;
  }
  if (obj.type === "array") {
    let lines = `${" ".repeat(indent)}type: array`;
    if (obj.items) {
      lines += `\n${" ".repeat(indent)}items:`;
      lines += `\n${schemaToYaml(obj.items, indent + 2)}`;
    }
    return lines;
  }
  if (obj.type === "object") {
    let lines = `${" ".repeat(indent)}type: object`;
    if (obj.properties) {
      lines += `\n${" ".repeat(indent)}properties:`;
      for (const [key, val] of Object.entries(obj.properties)) {
        lines += `\n${" ".repeat(indent + 2)}${key}:`;
        lines += `\n${schemaToYaml(val, indent + 4)}`;
      }
    }
    return lines;
  }
  // Primitive
  let lines = `${" ".repeat(indent)}type: ${obj.type}`;
  if (obj.format) lines += `\n${" ".repeat(indent)}format: ${obj.format}`;
  if (obj.default !== undefined) lines += `\n${" ".repeat(indent)}default: ${obj.default}`;
  if (obj.description) lines += `\n${" ".repeat(indent)}description: ${obj.description}`;
  return lines;
}

function buildSchemaRef(obj) {
  if (obj.$ref) return { $ref: obj.$ref };
  if (obj.type === "array") {
    return { type: "array", items: obj.items ? buildSchemaRef(obj.items) : {} };
  }
  return obj;
}

// --- Build response schema ---
function buildResponseSchema(meta) {
  if (meta.responseType) {
    if (meta.responseItemsSchema) {
      return {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { $ref: `#/components/schemas/${meta.responseItemsSchema}` },
          },
          total_count: { type: "integer", format: "int64" },
        },
      };
    }
    return { $ref: `#/components/schemas/${meta.responseType}` };
  }
  if (meta.responseSchema) {
    if (meta.responseIsArray) {
      const schema = {
        type: "array",
        items: { $ref: `#/components/schemas/${meta.responseSchema}` },
      };
      if (meta.responseWrapper) {
        return {
          type: "object",
          properties: { data: schema, error: { type: "string" } },
        };
      }
      return schema;
    }
    const schema = { $ref: `#/components/schemas/${meta.responseSchema}` };
    if (meta.responseWrapper) {
      return {
        type: "object",
        properties: { data: schema, error: { type: "string" } },
      };
    }
    return schema;
  }
  if (meta.responseWrapper) {
    return { $ref: `#/components/schemas/${meta.responseWrapper}` };
  }
  return null;
}

// --- Build a single operation ---
function buildOperation(openapiPath, method, meta, routePath) {
  const L = []; // output lines

  L.push(`${method}:`);
  L.push("      tags:");
  L.push("        - lms");

  const summary = meta?.summary || `LMS ${method.toUpperCase()} ${openapiPath}`;
  L.push(`      summary: ${summary}`);

  // Description block
  const descParts = [];
  if (meta?.description) descParts.push(meta.description);
  if (meta?.permission) descParts.push(`##### Permissions\n\`${meta.permission}\``);

  if (descParts.length > 0) {
    L.push("      description: |");
    for (const part of descParts) {
      for (const line of part.split("\n")) {
        L.push(`        ${line}`);
      }
    }
  }

  L.push(`      operationId: ${toOperationId(method, routePath)}`);

  // Parameters
  const pathParams = getPathParams(routePath);
  const queryParams = meta?.queryParams || [];
  const allParams = [];

  for (const p of pathParams) {
    allParams.push({
      name: p,
      in: "path",
      required: true,
      schema: { type: "string" },
    });
  }
  for (const p of queryParams) {
    const param = {
      name: p.name,
      in: "query",
      description: p.description || "",
      schema: { type: p.type || "string" },
    };
    if (p.default !== undefined) param.schema.default = p.default;
    if (p.required) param.required = true;
    allParams.push(param);
  }

  if (allParams.length > 0) {
    L.push("      parameters:");
    for (const p of allParams) {
      L.push(`        - in: ${p.in}`);
      L.push(`          name: ${p.name}`);
      if (p.required) L.push("          required: true");
      if (p.description) L.push(`          description: ${p.description}`);
      L.push("          schema:");
      L.push(`            type: ${p.schema.type}`);
      if (p.schema.default !== undefined) {
        L.push(`            default: ${p.schema.default}`);
      }
    }
  }

  // Request body
  if (meta?.requestBody) {
    const schema = buildSchemaRef(meta.requestBody);
    L.push("      requestBody:");
    L.push("        required: true");
    L.push("        content:");
    L.push("          application/json:");
    L.push("            schema:");
    L.push(schemaToYaml(schema, 14));
  }

  // Responses
  const statusCode = meta?.statusCode || (method === "post" ? "201" : "200");
  const responseSchema = buildResponseSchema(meta || {});
  L.push("      responses:");
  L.push(`        "${statusCode}":`);
  L.push("          description: Success.");
  if (responseSchema) {
    L.push("          content:");
    L.push("            application/json:");
    L.push("              schema:");
    L.push(schemaToYaml(responseSchema, 16));
  }

  // Error responses for authenticated endpoints
  if (!meta?.public) {
    L.push('        "400":');
    L.push('          $ref: "#/components/responses/BadRequest"');
    L.push('        "401":');
    L.push('          $ref: "#/components/responses/Unauthorized"');
    L.push('        "403":');
    L.push('          $ref: "#/components/responses/Forbidden"');
    if (method === "get" || openapiPath.includes("{id}")) {
      L.push('        "404":');
      L.push('          $ref: "#/components/responses/NotFound"');
    }
  }

  return L.join("\n");
}

// --- Main ---
function main() {
  const files = fs.readdirSync(lmsApiDir).filter((n) => n.endsWith(".go"));
  const allRoutes = [];
  for (const fileName of files) {
    const content = fs.readFileSync(path.join(lmsApiDir, fileName), "utf8");
    allRoutes.push(...parseRoutes(content));
  }

  const routeMap = new Map();
  for (const route of allRoutes) {
    const openapiPath = toOpenAPIPath(route.routePath);
    if (!routeMap.has(openapiPath)) routeMap.set(openapiPath, new Map());
    routeMap.get(openapiPath).set(route.method, route.routePath);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  const yamlLines = [
    "# This file is auto-generated by scripts/generate-lms-openapi.js.",
    "# It reads route registrations from Go code and metadata from lms_api_manifest.json.",
    "# To update: edit the manifest and/or Go code, then re-run the generator.",
  ];

  const sortedPaths = Array.from(routeMap.keys()).sort();

  for (const openapiPath of sortedPaths) {
    const methodMap = routeMap.get(openapiPath);
    const relativePath = openapiPath.replace("/api/v4/lms", "");
    const manifestEntry = manifest[relativePath] || {};

    yamlLines.push(`  ${openapiPath}:`);

    const sortedMethods = Array.from(methodMap.keys()).sort(
      (a, b) => methodOrder.indexOf(a) - methodOrder.indexOf(b)
    );

    for (const method of sortedMethods) {
      const routePath = methodMap.get(method);
      const meta = manifestEntry[method] || {};
      yamlLines.push("    " + buildOperation(openapiPath, method, meta, routePath));
    }
  }

  fs.writeFileSync(outputFile, yamlLines.join("\n") + "\n", "utf8");

  console.log(`Generated ${outputFile}`);
  console.log(`Paths: ${sortedPaths.length}, operations: ${allRoutes.length}`);

  let missing = 0;
  for (const openapiPath of sortedPaths) {
    const relativePath = openapiPath.replace("/api/v4/lms", "");
    if (!manifest[relativePath]) {
      console.warn(`  WARN: No manifest entry for ${relativePath}`);
      missing++;
    }
  }
  if (missing > 0) {
    console.warn(`  ${missing} routes missing from manifest (will use skeleton only)`);
  }
}

main();
