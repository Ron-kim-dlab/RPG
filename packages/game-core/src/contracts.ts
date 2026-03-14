import type { PlayerSave, WorldContent } from "./types";

export type ApiErrorCode =
  | "bad_request"
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "internal_error";

export type ApiErrorPayload = {
  code: ApiErrorCode;
  message: string;
  details?: string[];
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
};

export type ApiFailure = {
  success: false;
  error: ApiErrorPayload;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type HealthPayload = {
  status: "ok";
};

export type BootstrapPayload = {
  world: WorldContent;
};

export type PlayerPayload = {
  player: PlayerSave;
};

export type SessionPayload = {
  token: string;
  player: PlayerSave;
};
