import { Card } from "@/components/ui/card";
import Link from "next/link";
import React from "react";

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary px-4 py-8">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center mb-8" aria-label="Home">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">AI</span>
          </div>
        </Link>
        <Card className="p-8 border border-border/50 shadow-lg">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground mb-2 text-center">{title}</h1>
            {subtitle && <p className="text-center text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
        </Card>
      </div>
    </div>
  );
}

export function Notice({ kind, children }: { kind: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles = {
    error: "bg-destructive/10 text-destructive border-destructive/20",
    success: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    info: "bg-primary/10 text-foreground border-primary/20",
  }[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`mb-5 p-4 rounded-lg text-sm border ${styles}`}>
      {children}
    </div>
  );
}
