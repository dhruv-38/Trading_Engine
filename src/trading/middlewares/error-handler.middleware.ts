import { ApiMiddleware } from "motia";
import { ZodError } from "zod";

export const errorHandler: ApiMiddleware = async (req, context, next) => {
    try {
        const response = await next();
        return response;
    } catch (error) {
        const requestPath = (req as any).path ?? JSON.stringify(req.pathParams ?? {});
        const requestMethod = (req as any).method ?? (req.headers ? (Array.isArray(req.headers[':method']) ? req.headers[':method'][0] : (req.headers as any)[':method']) : undefined) ?? '<unknown>';

        context.logger.error('Request error', {
            error,
            path: requestPath,
            method: requestMethod,
            stack: (error as Error)?.stack,
        });

        if (error instanceof ZodError) {
            const formattedErrors = error.issues.map(err => ({
                field: err.path.map(p => String(p)).join('.'),
                message: err.message,
            }));

            return {
                status: 400,
                body: {
                    error: 'Validation failed',
                    details: formattedErrors,
                },
            };
        }

        if (error instanceof Error) {
            if (error.message.includes('not found')) {
                return {
                    status: 404,
                    body: {
                        error: error.message,
                    },
                };
            }

            if (error.message.includes('unauthorized') || error.message.includes('forbidden')) {
                return {
                    status: 403,
                    body: {
                        error: error.message,
                    },
                };
            }

            return {
                status: 500,
                body: {
                    error: 'Internal server error',
                    message: error.message,
                },
            };
        }

        return {
            status: 500,
            body: {
                error: 'Unknown error occurred',
            },
        };
    }
};
