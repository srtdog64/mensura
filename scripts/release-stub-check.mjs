#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(".");
const SOURCE_DIRS = ["src"];
const IGNORED_DIRS = new Set(["experimental"]);

const BLOCKERS = [
  {
    pattern: /\bstub\b/i,
    reason: "public implementation still describes itself as a stub"
  },
  {
    pattern: /\bplaceholder\b/i,
    reason: "public implementation still describes itself as a placeholder"
  },
  {
    pattern: /not implemented yet/i,
    reason: "public implementation admits missing behavior"
  },
  {
    pattern: /delegates? the intersect decision/i,
    reason: "public collision API delegates instead of implementing its own algorithm"
  }
];

function main() {
  const findings = [];
  for (const dir of SOURCE_DIRS) {
    const absolute = resolve(ROOT, dir);
    if (existsSync(absolute)) {
      scanDirectory(absolute, findings);
    }
  }

  if (findings.length > 0) {
    console.error("Release stub check failed.");
    console.error("Public source still contains release-blocking stub markers:");
    for (const finding of findings) {
      console.error(
        `- ${finding.path}:${finding.line}: ${finding.reason} (${finding.match})`
      );
    }
    console.error("");
    console.error("Either implement the code path, remove it from the public package, or move it under src/experimental.");
    process.exit(1);
  }

  console.log("Release stub check passed: no public stub markers found.");
}

function scanDirectory(dir, findings) {
  for (const entry of readdirSync(dir)) {
    const absolute = join(dir, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      if (!IGNORED_DIRS.has(entry)) {
        scanDirectory(absolute, findings);
      }
      continue;
    }

    if (entry.endsWith(".ts")) {
      scanFile(absolute, findings);
    }
  }
}

function scanFile(file, findings) {
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const blocker of BLOCKERS) {
      const match = lines[i].match(blocker.pattern);
      if (match) {
        findings.push({
          path: relative(ROOT, file).replaceAll("\\", "/"),
          line: i + 1,
          reason: blocker.reason,
          match: match[0]
        });
      }
    }
  }
}

main();
