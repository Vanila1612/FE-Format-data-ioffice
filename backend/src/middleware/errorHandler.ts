import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { AppError } from '../utils/appError.js';
import { fail } from '../utils/apiResponse.js';

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const isP2002 = (error as { code?: string })?.code === 'P2002';
  const status = error instanceof AppError ? error.status : error instanceof ZodError ? 400 : isP2002 ? 409 : 500;
  const code = error instanceof AppError ? error.code : error instanceof ZodError ? 'VALIDATION_ERROR' : isP2002 ? 'DUPLICATE_KEY' : 'INTERNAL_ERROR';
  const message = error instanceof AppError
    ? error.message
    : error instanceof ZodError
      ? 'Validation failed'
      : isP2002
        ? 'Dữ liệu đã tồn tại'
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
