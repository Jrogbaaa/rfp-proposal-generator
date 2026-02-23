/**
 * Error Handler Utility
 *
 * Centralized error handling for development and debugging.
 * Captures, logs, and helps diagnose errors in localhost.
 */

export interface ErrorLog {
  timestamp: string;
  type: 'runtime' | 'network' | 'validation' | 'api' | 'unknown';
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  component?: string;
}

// In-memory error store for the current session
const errorStore: ErrorLog[] = [];

/**
 * Log an error with context
 */
export function logError(
  error: Error | string,
  type: ErrorLog['type'] = 'unknown',
  context?: Record<string, unknown>,
  component?: string
): void {
  const errorLog: ErrorLog = {
    timestamp: new Date().toISOString(),
    type,
    message: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    context,
    component,
  };

  errorStore.push(errorLog);

  // Console output with styling for dev
  console.group(`🚨 [${type.toUpperCase()}] ${errorLog.message}`);
  console.log('Timestamp:', errorLog.timestamp);
  if (component) console.log('Component:', component);
  if (context) console.log('Context:', context);
  if (errorLog.stack) console.log('Stack:', errorLog.stack);
  console.groupEnd();
}

/**
 * Get all logged errors
 */
export function getErrorLog(): ErrorLog[] {
  return [...errorStore];
}

/**
 * Clear the error log
 */
export function clearErrorLog(): void {
  errorStore.length = 0;
}

/**
 * Format error for display
 */
export function formatError(error: ErrorLog): string {
  return `[${error.timestamp}] ${error.type}: ${error.message}`;
}

/**
 * Network request wrapper with error handling
 */
export async function safeRequest<T>(
  requestFn: () => Promise<T>,
  context?: { endpoint?: string; component?: string }
): Promise<{ data: T | null; error: ErrorLog | null }> {
  try {
    const data = await requestFn();
    return { data, error: null };
  } catch (err) {
    const error = err as Error;

    // Determine error type
    let type: ErrorLog['type'] = 'unknown';
    if (error.message.includes('fetch') || error.message.includes('network')) {
      type = 'network';
    } else if (error.message.includes('API') || error.message.includes('401') || error.message.includes('403')) {
      type = 'api';
    }

    logError(error, type, context, context?.component);

    return {
      data: null,
      error: {
        timestamp: new Date().toISOString(),
        type,
        message: error.message,
        stack: error.stack,
        context,
        component: context?.component,
      }
    };
  }
}

/**
 * Validation error helper
 */
export function validationError(
  field: string,
  message: string,
  component?: string
): void {
  logError(`Validation failed for ${field}: ${message}`, 'validation', { field }, component);
}

/**
 * Create error boundary fallback message
 */
export function getErrorFallbackMessage(error: Error): string {
  const messages: Record<string, string> = {
    'ChunkLoadError': 'Failed to load application chunk. Please refresh the page.',
    'NetworkError': 'Network connection issue. Please check your connection.',
    'TypeError': 'An unexpected error occurred. Please try again.',
  };

  for (const [key, msg] of Object.entries(messages)) {
    if (error.name.includes(key) || error.message.includes(key)) {
      return msg;
    }
  }

  return 'Something went wrong. Please refresh and try again.';
}

/**
 * Debug helper - prints current state to console
 */
export function debugState(label: string, state: unknown): void {
  if (import.meta.env.DEV) {
    console.group(`🔍 Debug: ${label}`);
    console.log(JSON.stringify(state, null, 2));
    console.groupEnd();
  }
}

/**
 * Performance timing helper
 */
export function measureTime<T>(label: string, fn: () => T): T {
  if (import.meta.env.DEV) {
    console.time(label);
    const result = fn();
    console.timeEnd(label);
    return result;
  }
  return fn();
}

/**
 * Async performance timing helper
 */
export async function measureTimeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (import.meta.env.DEV) {
    console.time(label);
    const result = await fn();
    console.timeEnd(label);
    return result;
  }
  return fn();
}
