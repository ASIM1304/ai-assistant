import axios from 'axios';

export interface ApiProblem {
    message: string;
    code?: string;
    status?: number;
    retryable: boolean;
    offline: boolean;
    fields?: { field: string; message: string }[];
}

/** Turns any thrown value into a message that is safe and useful to show. */
export function describeError(err: unknown, fallback = 'Something went wrong. Please try again.'): ApiProblem {
    if (axios.isAxiosError(err)) {
        if (!err.response) {
            const timeout = err.code === 'ECONNABORTED';
            return {
                message: timeout ? 'The server took too long to respond.' : 'Cannot reach the server. Check your internet connection.',
                retryable: true,
                offline: true,
            };
        }
        const e = err.response.data?.error;
        const status = err.response.status;
        return {
            message: e?.message || fallback,
            code: e?.code,
            status,
            retryable: !!e?.retryable || status >= 500 || status === 429,
            offline: false,
            fields: e?.fields,
        };
    }
    return { message: fallback, retryable: false, offline: false };
}
