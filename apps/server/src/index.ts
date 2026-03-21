import { createAppContext } from "./app";
import { readEnv } from "./config/env";
import { createUserRepository } from "./storage";
import { formatStartupError } from "./startup";

async function main(): Promise<void> {
  const env = readEnv();
  const repository = createUserRepository(env);

  const { httpServer } = await createAppContext({
    env,
    repository,
  });

  httpServer.once("error", (error: unknown) => {
    console.error(`Failed to start RPG server: ${formatStartupError(error, env.port)}`);
    process.exit(1);
  });

  httpServer.listen(env.port, () => {
    console.log(`RPG server listening on http://localhost:${env.port}`);
  });
}

main().catch((error: unknown) => {
  console.error(`Failed to start RPG server: ${formatStartupError(error, 0)}`);
  process.exit(1);
});
