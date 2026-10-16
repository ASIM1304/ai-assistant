"use client";

import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import axiosInstance from "@/lib/axios";
import { AuthUser, purgeLegacyStorage, setCsrfToken } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isLoggedIn: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Resolves with verificationRequired=true when the e-mail must be confirmed before sign-in. */
  register: (name: string, email: string, password: string) => Promise<{ verificationRequired: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // The cookie is the source of truth: ask the server who we are.
  useEffect(() => {
    purgeLegacyStorage();
    let cancelled = false;
    axiosInstance
      .get("/api/auth/me")
      .then(({ data }) => {
        if (cancelled) return;
        setCsrfToken(data.csrfToken);
        setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) {
          setCsrfToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await axiosInstance.post("/api/auth/login", { email, password });
      setCsrfToken(data.csrfToken);
      setUser(data.user);
      router.push("/dashboard");
    },
    [router],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const { data } = await axiosInstance.post("/api/auth/register", { name, email, password });
      if (data.verificationRequired) return { verificationRequired: true };
      setCsrfToken(data.csrfToken);
      setUser(data.user);
      router.push("/dashboard");
      return { verificationRequired: false };
    },
    [router],
  );

  const logout = useCallback(async () => {
    try {
      await axiosInstance.post("/api/auth/logout");
    } catch {
      /* already logged out / offline: clear locally regardless */
    }
    setCsrfToken(null);
    setUser(null);
    router.push("/");
  }, [router]);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get("/api/auth/me");
      setCsrfToken(data.csrfToken);
      setUser(data.user);
    } catch {
      setCsrfToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, isLoggedIn: !!user, isAdmin: user?.role === "admin", login, register, logout, refreshUser }),
    [user, isLoading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
