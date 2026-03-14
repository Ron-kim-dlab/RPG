import { createAppContext } from "./app";
import { readEnv } from "./config/env";
import { createUserRepository } from "./storage";

const env = readEnv();
const repository = createUserRepository(env.mongodbUri);

const { httpServer } = await createAppContext({
  env,
  repository,
});

httpServer.listen(env.port, () => {
  console.log(`RPG server listening on http://localhost:${env.port}`);
});
