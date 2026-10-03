/**
 * The single way to read an environment variable. Without a fallback the
 * variable is required: a missing or empty value throws at the call site
 * instead of surfacing later as `undefined` deep in the code.
 */
export function getEnv(key: string): string;
export function getEnv(key: string, fallback: string): string;
export function getEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value !== undefined && value.length > 0) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required environment variable: ${key}`);
}
