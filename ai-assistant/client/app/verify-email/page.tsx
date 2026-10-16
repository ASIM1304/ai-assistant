"use client";
import { AuthShell, Notice } from "@/components/AuthShell";
import axiosInstance from "@/lib/axios";
import { describeError } from "@/lib/errors";
import Link from "next/link";
import React, { useEffect, useState } from "react";

const Page = () => {
  const [state, setState] = useState<{ status: "working" | "ok" | "error"; message: string }>({ status: "working", message: "Verifying your e-mail…" });

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState({ status: "error", message: "This verification link is missing its token." });
      return;
    }
    axiosInstance
      .post("/api/auth/verify-email", { token })
      .then(() => setState({ status: "ok", message: "E-mail verified. You can now sign in." }))
      .catch((err) => setState({ status: "error", message: describeError(err).message }));
  }, []);

  return (
    <AuthShell title="E-mail verification" footer={<Link href="/login" className="text-primary font-semibold hover:underline">Go to sign in</Link>}>
      <Notice kind={state.status === "ok" ? "success" : state.status === "error" ? "error" : "info"}>{state.message}</Notice>
    </AuthShell>
  );
};

export default Page;
