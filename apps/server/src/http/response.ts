import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ApiErrorCode, ApiFailure } from "@rpg/game-core";

export class ApiRouteError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: string[],
  ) {
    super(message);
    this.name = "ApiRouteError";
  }
}

export function createRouteError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: string[],
): ApiRouteError {
  return new ApiRouteError(status, code, message, details);
}

export function sendSuccess<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({
    success: true,
    data,
  });
}

export function sendFailure(
  res: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: string[],
): void {
  const payload: ApiFailure = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };

  res.status(status).json(payload);
}

export function sendRouteError(res: Response, error: unknown): void {
  if (error instanceof ApiRouteError) {
    sendFailure(res, error.status, error.code, error.message, error.details);
    return;
  }

  console.error(error);
  sendFailure(res, 500, "internal_error", "서버 처리 중 오류가 발생했습니다.");
}

export function route(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void> | void,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((error) => sendRouteError(res, error));
  };
}
