import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative, resolve } from "node:path";

const LEGACY_TARGETS = ["api", "lib", "server.js", "script.js", "vercel.json"];
const SECRET_PATTERN = /\b(MONGODB_URI|JWT_SECRET|STORAGE_DRIVER|CLIENT_ORIGIN|JWT_EXPIRES_IN|BCRYPT_SALT_ROUNDS|PORT)\b/u;

function normalizeIgnoreEntry(entry) {
  return entry.trim().replace(/^\/+|\/+$/gu, "");
}

function readVercelIgnoredTargets(rootDir) {
  const ignorePath = resolve(rootDir, ".vercelignore");
  if (!existsSync(ignorePath)) {
    return new Set();
  }

  return new Set(
    readFileSync(ignorePath, "utf8")
      .split(/\r?\n/u)
      .map((entry) => entry.trim())
      .filter((entry) => entry && !entry.startsWith("#"))
      .map(normalizeIgnoreEntry),
  );
}

function isVercelIgnored(target, ignoredTargets) {
  return ignoredTargets.has(normalizeIgnoreEntry(target));
}

function walkFiles(targetPath) {
  const stats = statSync(targetPath);
  if (stats.isFile()) {
    return [targetPath];
  }

  if (!stats.isDirectory()) {
    return [];
  }

  return readdirSync(targetPath).flatMap((entry) => walkFiles(join(targetPath, entry)));
}

function findMatches(filePath) {
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/u);
  return lines
    .map((line, index) => ({ lineNumber: index + 1, text: line }))
    .filter((entry) => SECRET_PATTERN.test(entry.text));
}

const rootDir = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const strictMode = process.argv.includes("--strict");
const findings = [];
const ignoredTargets = readVercelIgnoredTargets(rootDir);

for (const target of LEGACY_TARGETS) {
  if (isVercelIgnored(target, ignoredTargets)) {
    continue;
  }

  const absolutePath = resolve(rootDir, target);
  if (!existsSync(absolutePath)) {
    continue;
  }

  for (const filePath of walkFiles(absolutePath)) {
    const matches = findMatches(filePath);
    if (matches.length > 0) {
      findings.push({
        filePath: relative(rootDir, filePath),
        matches,
      });
    }
  }
}

if (findings.length === 0) {
  console.log("No legacy runtime files reference deployment env keys.");
  process.exit(0);
}

console.log("Legacy runtime audit found env-key references in the following files:");
findings.forEach((finding) => {
  console.log(`- ${finding.filePath}`);
  finding.matches.forEach((match) => {
    console.log(`  L${match.lineNumber}: ${match.text.trim()}`);
  });
});
console.log("");
console.log("Review these paths before deployment and ensure the active runtime is apps/server only.");

if (strictMode) {
  process.exit(1);
}
