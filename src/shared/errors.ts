export class AppError extends Error {}
export class ConnectionError extends AppError {
  constructor(
    message: string,
    readonly retry: 'never' | 'transient' | 'renew',
  ) {
    super(message);
  }
}
export function providerError(error: unknown): AppError {
  const raw = error instanceof Error ? error.message : String(error);
  if (/401|403|api.?key|unauth|permission/i.test(raw))
    return new AppError(
      'Google rejected this key or account. Check key restrictions, region and model access in AI Studio.',
    );
  if (/429|quota|resource.exhausted|billing/i.test(raw))
    return new AppError(
      'Google quota or billing limit reached. Review your account limits and pricing before retrying.',
    );
  if (/404|not.found|unsupported|not.supported/i.test(raw))
    return new AppError(
      'This account cannot access Gemini Live Transcribe. Check model availability and region in AI Studio.',
    );
  if (/timeout|timed.out/i.test(raw))
    return new ConnectionError(
      'Google did not respond in time. Check your connection and try again.',
      'transient',
    );
  if (/500|502|503|unavailable/i.test(raw))
    return new ConnectionError(
      'Google is temporarily unavailable. Please try again later.',
      'transient',
    );
  return new ConnectionError(
    'The transcription connection ended unexpectedly. Check your connection and API access.',
    /^100[01]\b/.test(raw) ? 'renew' : /^100[78]\b/.test(raw) ? 'never' : 'transient',
  );
}
export function publicError(error: unknown): string {
  return error instanceof AppError
    ? error.message
    : 'This operation could not be completed. Please retry or open the troubleshooting guide.';
}
