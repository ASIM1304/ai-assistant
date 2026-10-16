"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, Notice } from "@/components/AuthShell";
import axiosInstance from "@/lib/axios";
import { describeError } from "@/lib/errors";
import Link from "next/link";
import React, { useState } from "react";

const Page = () => {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await axiosInstance.post("/api/auth/forgot-password", { email });
      setDone(true);
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell title="Reset password" subtitle="We'll e-mail you a link to choose a new one" footer={<Link href="/login" className="text-primary font-semibold hover:underline">Back to sign in</Link>}>
      {done ? (
        <Notice kind="success">If an account exists for that address, a reset link is on its way. It expires in 1 hour.</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {error && <Notice kind="error">{error}</Notice>}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold mb-2 text-foreground">Email Address</label>
            <Input type="email" id="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-lg" />
          </div>
          <Button type="submit" disabled={submitting} className="w-full rounded-full">{submitting ? "Sending..." : "Send reset link"}</Button>
        </form>
      )}
    </AuthShell>
  );
};

export default Page;
