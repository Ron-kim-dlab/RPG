import mongoose from "mongoose";
import { buildMongoConnectionUri } from "./mongo-uri.mjs";

function readOption(argv, name, fallback = "") {
  const index = argv.indexOf(name);
  if (index === -1) {
    return fallback;
  }
  return argv[index + 1] ?? fallback;
}

function hasFlag(argv, name) {
  return argv.includes(name);
}

function readRequired(argv, name, envName) {
  const value = readOption(argv, name, process.env[envName] ?? "").trim();
  if (!value) {
    throw new Error(`Missing required value for ${name} (${envName}).`);
  }
  return value;
}

async function main() {
  const argv = process.argv.slice(2);
  const adminUri = readRequired(argv, "--admin-uri", "MONGO_ADMIN_URI");
  const database = readRequired(argv, "--db", "MONGO_APP_DB");
  const username = readRequired(argv, "--username", "MONGO_APP_USERNAME");
  const password = readRequired(argv, "--password", "MONGO_APP_PASSWORD");
  const role = readOption(argv, "--role", process.env.MONGO_APP_ROLE ?? "readWrite").trim() || "readWrite";
  const authSource = readOption(argv, "--auth-source", process.env.MONGO_APP_AUTH_SOURCE ?? database).trim() || database;
  const allowUpdate = hasFlag(argv, "--allow-update") || process.env.MONGO_APP_ALLOW_UPDATE === "1";
  const dryRun = hasFlag(argv, "--dry-run");

  const recommendedUri = buildMongoConnectionUri(adminUri, {
    username,
    password,
    database,
    authSource,
  });

  if (dryRun) {
    console.log(`Dry run: would ensure Mongo user "${username}" on db "${database}" with role "${role}".`);
    console.log("Recommended application URI:");
    console.log(recommendedUri);
    return;
  }

  const rootConnection = await mongoose.createConnection(adminUri).asPromise();

  try {
    const appDbConnection = rootConnection.useDb(database, { useCache: true });
    const usersInfo = await appDbConnection.db.command({ usersInfo: username });
    const exists = Array.isArray(usersInfo.users) && usersInfo.users.length > 0;
    const roles = [{ role, db: database }];

    if (exists && !allowUpdate) {
      throw new Error(
        `Mongo user "${username}" already exists on "${database}". Re-run with --allow-update if you intend to rotate that user's password.`,
      );
    }

    if (exists) {
      await appDbConnection.db.command({
        updateUser: username,
        pwd: password,
        roles,
      });
      console.log(`Updated Mongo user "${username}" on db "${database}" with role "${role}".`);
    } else {
      await appDbConnection.db.command({
        createUser: username,
        pwd: password,
        roles,
      });
      console.log(`Created Mongo user "${username}" on db "${database}" with role "${role}".`);
    }

    console.log("Recommended application URI:");
    console.log(recommendedUri);
  } finally {
    await rootConnection.close();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown Mongo user creation error";
  console.error(`Failed to create Mongo app user: ${message}`);
  process.exit(1);
});
