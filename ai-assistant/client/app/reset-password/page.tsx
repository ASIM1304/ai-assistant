"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, Notice } from "@/components/AuthShell";
import { PasswordRules } from "@/components/PasswordRules";
import axiosInstance from "@/lib/axios";
import { describeError } from "@/lib/errors";
import Link from "next/link";
import React, { useEffect, useState } from "react";

const Page = () => {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setToken(new URLSearchParams(window.location.search).get("token") || ""), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await axiosInstance.post("/api/auth/reset-password", { token, password });
      setDone(true);
    } catch (err) {
      const p = describeError(err);
      setError(p.fields?.length ? p.fields.map((f) => f.message).join(". ") : p.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Choose a new password" footer={<Link href="/login" className="text-primary font-semibold hover:underline">Back to sign in</Link>}>
      {done ? (
        <Notice kind="success">Password updated. All other devices were signed out. You can sign in now.</Notice>
      ) : !token ? (
        <Notice kind="error">This reset link is missing its token. Request a new link.</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {error && <Notice kind="error">{error}</Notice>}
          <div>
            <label htmlFor="password" className="block text-sm font-semibold mb-2 text-foreground">New password</label>
            <Input type="password" id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-lg" />
            <PasswordRules password={password} />
          </div>
          <Button type="submit" disabled={submitting} className="w-full rounded-full">{submitting ? "Saving..." : "Update password"}</Button>
        </form>
      )}
    </AuthShell>
  );
};

export default Page;
