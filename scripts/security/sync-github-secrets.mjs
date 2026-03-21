import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DEFAULT_SECRET_KEYS = ["JWT_SECRET", "MONGODB_URI"];

function parseArgs(argv) {
  const options = {
    envFile: "apps/server/.env",
    repo: "",
    environment: "",
    dryRun: false,
    keys: [...DEFAULT_SECRET_KEYS],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env-file") {
      options.envFile = argv[index + 1] ?? options.envFile;
      index += 1;
    } else if (arg === "--repo") {
      options.repo = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--environment") {
      options.environment = argv[index + 1] ?? "";
      index += 1;
    } else if (arg === "--keys") {
      const raw = argv[index + 1] ?? "";
      options.keys = raw.split(",").map((entry) => entry.trim()).filter(Boolean);
      index += 1;
    } else if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.keys.length === 0) {
    throw new Error("At least one key must be provided.");
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/security/sync-github-secrets.mjs [options]

Options:
  --env-file <path>      Source env file. Default: apps/server/.env
  --repo <owner/name>    GitHub repository. Default: current gh repo
  --environment <name>   Optional GitHub environment to create/update before syncing
  --keys <csv>           Comma-separated keys. Default: JWT_SECRET,MONGODB_URI
  --dry-run              Print the plan without writing secrets
  --help                 Show this message
`);
}

function parseEnvFile(content) {
  const result = {};

  content.split(/\r?\n/u).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  });

  return result;
}

function runGh(args, input) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    input,
    stdio: input === undefined ? ["ignore", "pipe", "pipe"] : ["pipe", "pipe", "pipe"],
  }).trim();
}

function resolveRepo(repoArg) {
  if (repoArg) {
    return repoArg;
  }

  return runGh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
}

function ensureEnvironment(repo, environment) {
  if (!environment) {
    return;
  }

  runGh(["api", "--method", "PUT", `repos/${repo}/environments/${environment}`]);
}

function syncSecret(repo, environment, key, value) {
  const args = ["secret", "set", key, "--repo", repo];
  if (environment) {
    args.push("--env", environment);
  }
  runGh(args, value);
}

try {
  const options = parseArgs(process.argv.slice(2));
  const envPath = resolve(options.envFile);
  if (!existsSync(envPath)) {
    throw new Error(`Env file not found: ${envPath}`);
  }

  const envValues = parseEnvFile(readFileSync(envPath, "utf8"));
  const missingKeys = options.keys.filter((key) => !envValues[key]);
  if (missingKeys.length > 0) {
    throw new Error(`Missing required keys in ${envPath}: ${missingKeys.join(", ")}`);
  }

  const repo = resolveRepo(options.repo);
  const scopeLabel = options.environment ? `environment:${options.environment}` : "repository";

  if (options.dryRun) {
    console.log(`Dry run for ${repo} (${scopeLabel})`);
    console.log(`Source env file: ${envPath}`);
    console.log(`Keys: ${options.keys.join(", ")}`);
    process.exit(0);
  }

  ensureEnvironment(repo, options.environment);
  options.keys.forEach((key) => {
    syncSecret(repo, options.environment, key, envValues[key]);
  });

  console.log(`Synced ${options.keys.length} secret(s) to ${repo} (${scopeLabel}).`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown GitHub secret sync error";
  console.error(`Failed to sync GitHub secrets: ${message}`);
  process.exit(1);
}
