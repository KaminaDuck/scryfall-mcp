export class ScryfallMCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>,
  ) {
    super(message);
    this.name = 'ScryfallMCPError';
  }
}

export class ScryfallApiError extends ScryfallMCPError {
  constructor(
    message: string,
    public statusCode: number,
    public apiCode?: string,
    context?: Record<string, any>,
  ) {
    super(message, 'SCRYFALL_API_ERROR', context);
    this.name = 'ScryfallApiError';
  }
}

export class DatabaseError extends ScryfallMCPError {
  constructor(
    message: string,
    public operation: string,
    context?: Record<string, any>,
  ) {
    super(message, 'DATABASE_ERROR', context);
    this.name = 'DatabaseError';
  }
}

export class ImageDownloadError extends ScryfallMCPError {
  constructor(
    message: string,
    public imageUrl?: string,
    public cardId?: string,
    context?: Record<string, any>,
  ) {
    super(message, 'IMAGE_DOWNLOAD_ERROR', context);
    this.name = 'ImageDownloadError';
  }
}

export class ValidationError extends ScryfallMCPError {
  constructor(
    message: string,
    public field?: string,
    public value?: any,
    context?: Record<string, any>,
  ) {
    super(message, 'VALIDATION_ERROR', context);
    this.name = 'ValidationError';
  }
}

export class ConfigurationError extends ScryfallMCPError {
  constructor(
    message: string,
    public configKey?: string,
    context?: Record<string, any>,
  ) {
    super(message, 'CONFIGURATION_ERROR', context);
    this.name = 'ConfigurationError';
  }
}

export class MCPError extends ScryfallMCPError {
  constructor(
    message: string,
    public toolName?: string,
    public resourceUri?: string,
    context?: Record<string, any>,
  ) {
    super(message, 'MCP_ERROR', context);
    this.name = 'MCPError';
  }
}

export class RateLimitError extends ScryfallMCPError {
  constructor(
    message: string,
    public retryAfter?: number,
    context?: Record<string, any>,
  ) {
    super(message, 'RATE_LIMIT_ERROR', context);
    this.name = 'RateLimitError';
  }
}

export function isKnownError(error: any): error is ScryfallMCPError {
  return error instanceof ScryfallMCPError;
}

export function createErrorResponse(error: any): { success: false; error: string; code?: string; context?: Record<string, any> } {
  if (isKnownError(error)) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      context: error.context,
    };
  }

  return {
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error occurred',
    code: 'UNKNOWN_ERROR',
  };
}

export function handleAsyncError<T>(
  promise: Promise<T>,
  errorContext?: Record<string, any>,
): Promise<T> {
  return promise.catch((error) => {
    if (isKnownError(error)) {
      throw error;
    }

    throw new ScryfallMCPError(
      error instanceof Error ? error.message : 'Unknown error occurred',
      'ASYNC_ERROR',
      errorContext,
    );
  });
}