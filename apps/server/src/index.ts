import { createAppContext } from "./app";
import { readEnv } from "./config/env";
import { createUserRepository } from "./storage";

async function main(): Promise<void> {
  const env = readEnv();
  const repository = createUserRepository(env);

  const { httpServer } = await createAppContext({
    env,
    repository,
  });

  httpServer.listen(env.port, () => {
    console.log(`RPG server listening on http://localhost:${env.port}`);
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(`Failed to start RPG server: ${message}`);
  process.exit(1);
});
