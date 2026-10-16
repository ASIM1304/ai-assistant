/**
 * Client-side auth state.
 *
 * The session itself is an httpOnly cookie set by the API - JavaScript (and so
 * any XSS) can't read it. The only thing kept here is the per-session CSRF
 * token, in memory only (never localStorage), re-fetched from /api/auth/me on
 * every page load.
 */
export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: 'candidate' | 'admin';
    emailVerified?: boolean;
    profile?: {
        phone?: string;
        education?: { degree?: string; institution?: string; year?: number }[];
        skills?: string[];
        experience?: { title?: string; company?: string; years?: number; summary?: string }[];
        selectedJobRole?: string;
    };
}

let csrfToken: string | null = null;
export const getCsrfToken = () => csrfToken;
export const setCsrfToken = (t: string | null) => {
    csrfToken = t;
};

// Clean up anything an older version of the app left behind in localStorage.
export const purgeLegacyStorage = () => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    } catch {
        /* storage may be unavailable */
    }
};
