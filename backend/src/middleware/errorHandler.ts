import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { AppError } from '../utils/appError.js';
import { fail } from '../utils/apiResponse.js';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const status = error instanceof AppError ? error.status : error instanceof ZodError ? 400 : 500;
  const code = error instanceof AppError ? error.code : error instanceof ZodError ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
  const message = error instanceof AppError
    ? error.message
    : error instanceof ZodError
      ? 'Validation failed'
      : 'Unable to process request';
  const details = error instanceof AppError
    ? error.details
    : error instanceof ZodError ? error.issues : undefined;

  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status,
    code,
    error: isProduction ? message : error.stack || error.message
  }));

  return fail(res, status, code, message, isProduction && status === 500 ? undefined : details);
};
