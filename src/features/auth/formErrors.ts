import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

import { ApiError } from '@/services/api/client';

/**
 * Puts server field errors on the matching inputs and returns the message for
 * the form-level banner, or null when every error landed on a field.
 */
export function applyServerErrors<T extends FieldValues>(
  err: unknown,
  setError: UseFormSetError<T>,
  fieldMap: Partial<Record<string, Path<T>>> = {},
): string | null {
  if (!(err instanceof ApiError))
    return 'Something went wrong. Please try again.';

  const fields = err.fieldErrors
    .map(f => ({
      name: fieldMap[f.path] ?? (f.path as Path<T>),
      message: f.message,
    }))
    .filter(f => f.name);
  if (fields.length === 0) return err.message;

  fields.forEach((f, i) =>
    setError(
      f.name,
      { type: 'server', message: f.message },
      { shouldFocus: i === 0 },
    ),
  );
  return null;
}
