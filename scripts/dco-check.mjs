#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const SIGNED_OFF_BY = /^Signed-off-by:\s+.+\s+<[^<>@\s]+@[^<>\s]+>$/im;

function main() {
  const options = parseArgs(process.argv.slice(2));
  const range = options.range ?? process.env.DCO_RANGE ?? defaultRange();
  const includeMerges = options.includeMerges === true || process.env.DCO_INCLUDE_MERGES === "1";
  const revisions = listCommits(range, includeMerges);

  if (revisions.length === 0) {
    console.log(`DCO check: no commits in range ${range}`);
    return;
  }

  const missing = [];
  for (const revision of revisions) {
    const body = git(["log", "-1", "--format=%B", revision]);
    if (!SIGNED_OFF_BY.test(body)) {
      const subject = git(["log", "-1", "--format=%s", revision]).trim();
      missing.push({ revision, subject });
    }
  }

  if (missing.length > 0) {
    console.error(`DCO check failed for range ${range}`);
    console.error("Every non-merge commit must include:");
    console.error("Signed-off-by: Full Name <email@example.com>");
    console.error("");
    for (const commit of missing) {
      console.error(`- ${commit.revision.slice(0, 12)} ${commit.subject}`);
    }
    console.error("");
    console.error("Fix the latest commit with:");
    console.error("git commit --amend -s --no-edit");
    console.error("");
    console.error("Fix multiple local commits with:");
    console.error("git rebase -i <base>");
    console.error("git commit --amend -s --no-edit");
    console.error("git rebase --continue");
    process.exit(1);
  }

  console.log(`DCO check passed for ${revisions.length} commit(s) in range ${range}`);
}

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--range") {
      options.range = requireValue(args, ++i, "--range");
    } else if (arg.startsWith("--range=")) {
      options.range = arg.slice("--range=".length);
    } else if (arg === "--include-merges") {
      options.includeMerges = true;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function requireValue(args, index, flag) {
  const value = args[index];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function defaultRange() {
  const upstream = maybeGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
  if (upstream !== null) {
    return `${upstream.trim()}..HEAD`;
  }

  const originHead = maybeGit(["rev-parse", "--verify", "origin/HEAD"]);
  if (originHead !== null) {
    return "origin/HEAD..HEAD";
  }

  return "HEAD~1..HEAD";
}

function listCommits(range, includeMerges) {
  const args = ["rev-list", "--reverse"];
  if (!includeMerges) {
    args.push("--no-merges");
  }
  args.push(range);
  const output = git(args).trim();
  return output.length === 0 ? [] : output.split(/\r?\n/);
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function maybeGit(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function printHelp() {
  console.log(`Usage: npm run dco:check -- [--range <git-range>] [--include-merges]

Examples:
  npm run dco:check -- --range origin/master..HEAD
  DCO_RANGE=origin/main..HEAD npm run dco:check
`);
}

main();

