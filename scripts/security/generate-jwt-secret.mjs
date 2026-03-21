import { randomBytes } from "node:crypto";

function readBytesArg(argv) {
  const index = argv.indexOf("--bytes");
  if (index === -1) {
    return 48;
  }

  const raw = argv[index + 1];
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 32) {
    throw new Error("--bytes must be an integer greater than or equal to 32.");
  }
  return value;
}

try {
  const bytes = readBytesArg(process.argv.slice(2));
  const secret = randomBytes(bytes).toString("base64url");
  process.stdout.write(`${secret}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown secret generation error";
  console.error(`Failed to generate JWT secret: ${message}`);
  process.exit(1);
}
