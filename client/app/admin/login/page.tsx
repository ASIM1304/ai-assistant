"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, Notice } from "@/components/AuthShell";
import adminAxios, { setAdminCsrf } from "@/lib/adminAxios";
import { describeError } from "@/lib/errors";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

export default function AdminLogin() {
  const router = useRouter();
  const [f, setF] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("reason") === "expired") setInfo("Your admin session expired. Please sign in again."); }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const { data } = await adminAxios.post("/api/admin/auth/login", f);
      setAdminCsrf(data.csrfToken);
      router.push("/admin");
    } catch (err) { setError(describeError(err, "Sign-in failed.").message); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Admin sign in" subtitle="Administrator accounts are separate from candidate accounts">
      {info && <Notice kind="info">{info}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <form onSubmit={submit} className="space-y-5">
        <div><label htmlFor="email" className="block text-sm font-semibold mb-2">Email</label>
          <Input id="email" type="email" autoComplete="username" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
        <div><label htmlFor="password" className="block text-sm font-semibold mb-2">Password</label>
          <Input id="password" type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></div>
        <Button type="submit" disabled={busy} className="w-full rounded-full">{busy ? "Signing in…" : "Sign in"}</Button>
      </form>
    </AuthShell>
  );
}
