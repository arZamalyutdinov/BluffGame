import {
  type AppErrorCode,
  appErrorPayloadSchema,
  getDefaultAppErrorMessage,
} from '@bluff-game/shared';

export interface AppErrorInfo {
  code?: AppErrorCode | undefined;
  message?: string | undefined;
}

export class ClientAppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message = getDefaultAppErrorMessage(code)) {
    super(message);
    this.code = code;
  }
}

export function parseAppErrorPayload(payload: unknown): AppErrorInfo | null {
  const parsed = appErrorPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export function toAppErrorInfo(
  error: unknown,
  fallbackCode?: AppErrorCode,
): AppErrorInfo {
  if (error instanceof ClientAppError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error && fallbackCode) {
    return {
      code: fallbackCode,
      message: error.message,
    };
  }

  return fallbackCode
    ? {
        code: fallbackCode,
        message: getDefaultAppErrorMessage(fallbackCode),
      }
    : error instanceof Error
      ? { message: error.message }
      : {};
}
