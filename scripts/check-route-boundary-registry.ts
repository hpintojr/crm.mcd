import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROUTE_ROOT = "src/app";
const REGISTRY_PATH = "config/route-boundary-registry.json";
const APPROVED_CLASSIFICATIONS = new Set(["APPROVED_EXCEPTION", "FROZEN_EXISTING"]);

type Primitive =
  | "REQUEST_JSON"
  | "REQUEST_TEXT"
  | "DIRECT_NEXT_JSON"
  | "DIRECT_NEXT_RESPONSE"
  | "RAW_ERROR_MESSAGE";

type Finding = {
  path: string;
  primitive: Primitive;
  count: number;
};

type RegistryFinding = Finding & {
  classification: "APPROVED_EXCEPTION" | "FROZEN_EXISTING";
  rationale: string;
};

type Registry = {
  version: string;
  reviewedAt: string;
  findings: RegistryFinding[];
};

const primitivePatterns: Array<{ primitive: Primitive; pattern: RegExp }> = [
  { primitive: "REQUEST_JSON", pattern: /\b(?:request|req)\.json\s*\(/g },
  { primitive: "REQUEST_TEXT", pattern: /\b(?:request|req)\.text\s*\(/g },
  { primitive: "DIRECT_NEXT_JSON", pattern: /\bNextResponse\.json\s*\(/g },
  { primitive: "DIRECT_NEXT_RESPONSE", pattern: /\bnew\s+NextResponse\s*\(/g },
  {
    primitive: "RAW_ERROR_MESSAGE",
    pattern: /(?:\(error\s+as\s+Error\)|\berror)\.message\b/g,
  },
];

function walkRoutes(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) files.push(...walkRoutes(absolute));
    else if (entry === "route.ts") files.push(absolute);
  }
  return files;
}

function normalizedPath(path: string) {
  return relative(".", path).split(sep).join("/");
}

function scanRoute(path: string): Finding[] {
  const content = readFileSync(path, "utf8");
  const findings: Finding[] = [];
  for (const { primitive, pattern } of primitivePatterns) {
    const count = [...content.matchAll(new RegExp(pattern.source, pattern.flags))].length;
    if (count > 0) findings.push({ path: normalizedPath(path), primitive, count });
  }
  return findings;
}

function findingKey(finding: Finding) {
  return `${finding.path}::${finding.primitive}::${finding.count}`;
}

function sortFindings<T extends Finding>(findings: T[]) {
  return [...findings].sort((left, right) => findingKey(left).localeCompare(findingKey(right)));
}

function validateRegistry(registry: Registry) {
  if (!registry.version.trim()) throw new Error("Route boundary registry version is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(registry.reviewedAt)) {
    throw new Error("Route boundary registry reviewedAt must use YYYY-MM-DD.");
  }

  const keys = new Set<string>();
  for (const finding of registry.findings) {
    const key = findingKey(finding);
    if (keys.has(key)) throw new Error(`Duplicate route boundary registry finding: ${key}.`);
    keys.add(key);
    if (!APPROVED_CLASSIFICATIONS.has(finding.classification)) {
      throw new Error(`Invalid classification for ${key}: ${finding.classification}.`);
    }
    if (!finding.rationale.trim()) throw new Error(`Missing rationale for ${key}.`);
    if (!Number.isSafeInteger(finding.count) || finding.count < 1) {
      throw new Error(`Invalid count for ${key}.`);
    }
  }
}

function main() {
  const actual = sortFindings(walkRoutes(ROUTE_ROOT).flatMap(scanRoute));
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) as Registry;
  validateRegistry(registry);
  const expected = sortFindings(registry.findings);

  const actualKeys = new Set(actual.map(findingKey));
  const expectedKeys = new Set(expected.map(findingKey));
  const added = actual.filter((finding) => !expectedKeys.has(findingKey(finding)));
  const removed = expected.filter((finding) => !actualKeys.has(findingKey(finding)));

  if (added.length > 0 || removed.length > 0) {
    console.error("ROUTE_BOUNDARY_FINDINGS_START");
    console.error(JSON.stringify(actual, null, 2));
    console.error("ROUTE_BOUNDARY_FINDINGS_END");
    console.error("Route boundary registry drift detected.");
    console.error(JSON.stringify({ added, removed }, null, 2));
    process.exit(1);
  }

  console.log("Route boundary registry guard passed.");
  console.log(`Reviewed route boundary findings: ${actual.length}.`);
}

main();
