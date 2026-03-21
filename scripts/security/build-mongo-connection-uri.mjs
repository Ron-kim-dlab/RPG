import { buildMongoConnectionUri } from "./mongo-uri.mjs";

function readOption(argv, name, fallback = "") {
  const index = argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  return argv[index + 1] ?? fallback;
}

function readRequired(argv, name, envName) {
  const value = readOption(argv, name, process.env[envName] ?? "").trim();
  if (!value) {
    throw new Error(`Missing required value for ${name} (${envName}).`);
  }
  return value;
}

try {
  const argv = process.argv.slice(2);
  const baseUri = readRequired(argv, "--base-uri", "MONGO_BASE_URI");
  const database = readRequired(argv, "--db", "MONGO_APP_DB");
  const username = readRequired(argv, "--username", "MONGO_APP_USERNAME");
  const password = readRequired(argv, "--password", "MONGO_APP_PASSWORD");
  const authSource = readOption(argv, "--auth-source", process.env.MONGO_APP_AUTH_SOURCE ?? database).trim() || database;

  const uri = buildMongoConnectionUri(baseUri, {
    username,
    password,
    database,
    authSource,
  });

  console.log(uri);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown Mongo URI build error";
  console.error(`Failed to build Mongo connection URI: ${message}`);
  process.exit(1);
}
