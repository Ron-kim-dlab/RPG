import { execFileSync } from "node:child_process";

function runGh(args, input) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    input,
  }).trim();
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

const desiredRuleset = {
  name: "main-protection",
  target: "branch",
  enforcement: "active",
  conditions: {
    ref_name: {
      include: ["refs/heads/main"],
      exclude: [],
    },
  },
  bypass_actors: [],
  rules: [
    { type: "non_fast_forward" },
    { type: "deletion" },
    { type: "required_linear_history" },
    {
      type: "pull_request",
      parameters: {
        required_approving_review_count: 0,
        dismiss_stale_reviews_on_push: false,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: true,
      },
    },
    {
      type: "required_status_checks",
      parameters: {
        strict_required_status_checks_policy: true,
        required_status_checks: [
          {
            context: "quality",
          },
        ],
      },
    },
  ],
};

const existingRulesets = JSON.parse(runGh(["api", `repos/${repo}/rulesets`]));
const existing = existingRulesets.find((ruleset) => ruleset.name === desiredRuleset.name);

if (existing) {
  runGh([
    "api",
    "--method",
    "PUT",
    `repos/${repo}/rulesets/${existing.id}`,
    "--input",
    "-",
  ], JSON.stringify(desiredRuleset));
  console.log(`Updated ruleset ${desiredRuleset.name} on ${repo}.`);
} else {
  runGh([
    "api",
    "--method",
    "POST",
    `repos/${repo}/rulesets`,
    "--input",
    "-",
  ], JSON.stringify(desiredRuleset));
  console.log(`Created ruleset ${desiredRuleset.name} on ${repo}.`);
}
