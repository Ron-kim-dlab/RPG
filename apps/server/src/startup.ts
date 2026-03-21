type StartupErrorLike = NodeJS.ErrnoException & {
  port?: number;
};

export function formatStartupError(error: unknown, port: number): string {
  if (typeof error === "object" && error !== null) {
    const startupError = error as StartupErrorLike;
    const actualPort = typeof startupError.port === "number" ? startupError.port : port;

    if (startupError.code === "EADDRINUSE") {
      return `Port ${actualPort} is already in use. Stop the existing server process or change PORT in apps/server/.env before starting a new one.`;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown startup error";
}
