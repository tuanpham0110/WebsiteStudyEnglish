import type { ApiErrorCode } from '../shared/constants';

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  FEATURE_DISABLED: 503,
  QUOTA_EXCEEDED: 429,
  RATE_LIMITED: 429,
  GLOBAL_LIMIT: 429,
  SESSION_ACTIVE: 409,
  PROVIDER_QUOTA: 429,
  PROVIDER_ERROR: 502,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL: 500,
};

/** An error that is safe to show to the client (message is user-facing, in Vietnamese). */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }

  toBody() {
    return { error: { code: this.code, message: this.message, ...(this.details ? { details: this.details } : {}) } };
  }
}

/** Provider failures carry an internal reason for logs; the client only sees the mapped ApiError. */
export class ProviderError extends Error {
  readonly kind: 'quota' | 'auth' | 'bad_request' | 'blocked' | 'unavailable' | 'invalid_output';
  readonly httpStatus?: number;

  constructor(kind: ProviderError['kind'], message: string, httpStatus?: number) {
    super(message);
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ProviderError) {
    switch (error.kind) {
      case 'quota':
        return new ApiError(
          'PROVIDER_QUOTA',
          'Nhà cung cấp AI đã hết hạn mức miễn phí tạm thời. Hệ thống không tự chuyển sang gói trả phí — vui lòng thử lại sau.',
        );
      case 'blocked':
        return new ApiError('PROVIDER_ERROR', 'Nội dung bị bộ lọc an toàn của nhà cung cấp AI chặn. Hãy thử diễn đạt khác.');
      case 'invalid_output':
        return new ApiError('PROVIDER_ERROR', 'AI trả về dữ liệu không đúng định dạng. Vui lòng thử lại.');
      case 'auth':
        return new ApiError('PROVIDER_ERROR', 'Cấu hình nhà cung cấp AI không hợp lệ. Quản trị viên cần kiểm tra API key.');
      default:
        return new ApiError('PROVIDER_ERROR', 'Không kết nối được tới nhà cung cấp AI. Vui lòng thử lại.');
    }
  }
  return new ApiError('INTERNAL', 'Đã có lỗi xảy ra. Vui lòng thử lại.');
}

/** Strip anything that looks like a credential before logging. */
export function redact(text: string): string {
  return text
    .replace(/(key|token|access_token|apikey|authorization)=([^&\s"]+)/gi, '$1=[redacted]')
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/g, 'Bearer [redacted]')
    .replace(/AIza[0-9A-Za-z_\-]{20,}/g, '[redacted-google-key]')
    .replace(/sb_(secret|publishable)_[A-Za-z0-9_\-]+/g, 'sb_$1_[redacted]')
    .replace(/auth_tokens\/[A-Za-z0-9_\-]+/g, 'auth_tokens/[redacted]')
    .slice(0, 500);
}

export function logError(scope: string, error: unknown) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[${scope}] ${redact(message)}`);
}
