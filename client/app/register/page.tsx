"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, Notice } from "@/components/AuthShell";
import { PasswordRules } from "@/components/PasswordRules";
import { useAuth } from "@/hooks/useAuth";
import { describeError } from "@/lib/errors";
import Link from "next/link";
import React, { useState } from "react";

const Page = () => {
  const { register } = useAuth();
  const [formData, setFormData] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await register(formData.name, formData.email, formData.password);
      if (res.verificationRequired) setSent(true);
    } catch (err) {
      const p = describeError(err, "Failed to create account. Please try again.");
      setError(p.fields?.length ? p.fields.map((f) => f.message).join(". ") : p.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <AuthShell title="Check your inbox" footer={<Link href="/login" className="text-primary font-semibold hover:underline">Back to sign in</Link>}>
        <Notice kind="success">
          If <strong>{formData.email}</strong> can be registered, we&apos;ve sent a verification link. Open it to activate your account, then sign in.
        </Notice>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Get Started"
      subtitle="Create your account to begin practicing"
      footer={
        <>
          <span className="text-muted-foreground">Already have an account? </span>
          <Link href="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
        </>
      }
    >
      {error && <Notice kind="error">{error}</Notice>}
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-semibold mb-2 text-foreground">Full Name</label>
          <Input type="text" id="name" name="name" autoComplete="name" minLength={2} maxLength={100} value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="John Doe" required className="rounded-lg" />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-semibold mb-2 text-foreground">Email Address</label>
          <Input type="email" id="email" name="email" autoComplete="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="you@example.com" required className="rounded-lg" />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-semibold mb-2 text-foreground">Password</label>
          <Input type="password" id="password" name="password" autoComplete="new-password" aria-describedby="pw-rules" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="••••••••••" required className="rounded-lg" />
          <div id="pw-rules"><PasswordRules password={formData.password} /></div>
        </div>
        <Button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold rounded-full py-2 mt-2">
          {submitting ? "Creating Account..." : "Sign Up"}
        </Button>
        <p className="text-xs text-muted-foreground text-center">
          By signing up you agree that interview data is processed as described in the privacy notice shown before each interview.
        </p>
      </form>
    </AuthShell>
  );
};

export default Page;
