"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, Notice } from "@/components/AuthShell";
import { useAuth } from "@/hooks/useAuth";
import { describeError } from "@/lib/errors";
import Link from "next/link";
import React, { useEffect, useState } from "react";

const Page = () => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "expired") setInfo("Your session expired. Please sign in again.");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(formData.email, formData.password);
    } catch (err) {
      setError(describeError(err, "Sign-in failed. Please try again.").message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Welcome Back"
      subtitle="Sign in to continue your interview practice"
      footer={
        <>
          <span className="text-muted-foreground">Don&apos;t have an account? </span>
          <Link href="/register" className="text-primary font-semibold hover:underline">Create one</Link>
        </>
      }
    >
      {info && <Notice kind="info">{info}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold mb-2 text-foreground">Email Address</label>
          <Input type="email" id="email" name="email" autoComplete="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="you@example.com" required className="rounded-lg" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="password" className="block text-sm font-semibold text-foreground">Password</label>
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <Input type="password" id="password" name="password" autoComplete="current-password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••" required className="rounded-lg" />
        </div>
        <Button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold rounded-full py-2 mt-2">
          {submitting ? "Signing In..." : "Sign In"}
        </Button>
      </form>
    </AuthShell>
  );
};

export default Page;
