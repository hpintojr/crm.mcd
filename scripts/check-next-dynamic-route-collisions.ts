import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

const appRoot = join(process.cwd(), "src", "app");
const dynamicSegment = /^\[\[?\.\.\.[^\]]+\]\]$|^\[[^\]]+\]$/;

function findSiblingDynamicSegmentCollisions(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true });
  const childDirectories = entries.filter((entry) => entry.isDirectory());
  const dynamicDirectories = childDirectories
    .filter((entry) => dynamicSegment.test(entry.name))
    .map((entry) => entry.name)
    .sort();

  const collisions = dynamicDirectories.length > 1
    ? [`${relative(appRoot, directory) || "."}: ${dynamicDirectories.join(", ")}`]
    : [];

  for (const entry of childDirectories) {
    collisions.push(...findSiblingDynamicSegmentCollisions(join(directory, entry.name)));
  }

  return collisions;
}

const collisions = findSiblingDynamicSegmentCollisions(appRoot);

if (collisions.length > 0) {
  throw new Error(
    `Next.js route collision risk: a route parent may contain only one dynamic segment directory.\n${collisions.join("\n")}`
  );
}

console.log("Next.js dynamic route collision check passed.");
