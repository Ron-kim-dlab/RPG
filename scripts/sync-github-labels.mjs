import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function runGh(args, input) {
  return execFileSync("gh", args, { encoding: "utf8", input }).trim();
}

function parseRepoSlug(remoteUrl) {
  const normalized = remoteUrl.trim().replace(/\.git$/, "");
  const sshMatch = normalized.match(/github\.com:(.+\/.+)$/);
  if (sshMatch) return sshMatch[1];
  const httpsMatch = normalized.match(/github\.com\/(.+\/.+)$/);
  if (httpsMatch) return httpsMatch[1];
  throw new Error(`Unable to parse GitHub slug from remote URL: ${remoteUrl}`);
}

const remoteUrl = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" });
const repo = parseRepoSlug(remoteUrl);
const desiredLabels = JSON.parse(
  readFileSync(resolve(process.cwd(), ".github/labels.json"), "utf8"),
);

const currentLabels = JSON.parse(runGh(["api", `repos/${repo}/labels`, "--paginate"]));
const currentMap = new Map(currentLabels.map((label) => [label.name, label]));
const desiredNames = new Set(desiredLabels.map((label) => label.name));

for (const label of desiredLabels) {
  const existing = currentMap.get(label.name);
  const payload = JSON.stringify(label);

  if (existing) {
    runGh([
      "api",
      "--method",
      "PATCH",
      `repos/${repo}/labels/${encodeURIComponent(label.name)}`,
      "--input",
      "-",
    ], payload);
  } else {
    runGh([
      "api",
      "--method",
      "POST",
      `repos/${repo}/labels`,
      "--input",
      "-",
    ], payload);
  }
}

for (const label of currentLabels) {
  if (!desiredNames.has(label.name)) {
    runGh([
      "api",
      "--method",
      "DELETE",
      `repos/${repo}/labels/${encodeURIComponent(label.name)}`,
    ]);
  }
}

console.log(`Synced ${desiredLabels.length} labels for ${repo}.`);
