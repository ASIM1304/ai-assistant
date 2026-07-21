"use client";

import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const INTERVIEW_DOMAINS = [
  {
    label: "JavaScript/Node.js",
    icon: "🟨",
    desc: "ES6+, async, Node runtime",
  },
  { label: "React", icon: "⚛️", desc: "Hooks, state, lifecycle" },
  { label: "Python", icon: "🐍", desc: "OOP, data structures, stdlib" },
  { label: "Data Science", icon: "📊", desc: "ML, pandas, statistics" },
  { label: "DevOps", icon: "⚙️", desc: "CI/CD, Docker, Kubernetes" },
  { label: "System Design", icon: "🏗️", desc: "Scalability, architecture" },
  { label: "Database Design", icon: "🗄️", desc: "SQL, NoSQL, indexing" },
  { label: "General", icon: "🎯", desc: "Behavioural & fundamentals" },
];

const page = () => {
  const router = useRouter();
  const { isLoggedIn, isLoading: authLoading } = useAuth();
  const [hoveredDomain, setHoveredDomain] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isLoggedIn) {
      router.push("/login");
    }
  }, [isLoggedIn, authLoading, router]);

  const handleSelectDomain = (domain: string) => {
    const interviewData = JSON.parse(
      localStorage.getItem("interviewData") || "{}",
    );
    interviewData.domain = domain;
    localStorage.setItem("interviewData", JSON.stringify(interviewData));
    router.push("/interview");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }
  if (!isLoggedIn) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12 space-y-8">
        <section>
          <p className="text-sm text-muted-foreground font-medium mb-1">
            🎯 Practice
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-foreground mb-2">
            Pick a Domain
          </h1>
          <p className="text-sm text-muted-foreground">
            Choose what you want to practice today. Each session runs 10
            AI-generated questions tailored to the domain.
          </p>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {INTERVIEW_DOMAINS.map((domain) => (
            <button
              key={domain.label}
              onMouseEnter={() => setHoveredDomain(domain.label)}
              onMouseLeave={() => setHoveredDomain(null)}
              onClick={() => handleSelectDomain(domain.label)}
              className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-150 bg-background ${
                hoveredDomain === domain.label
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/60 hover:border-primary/40"
              }`}
            >
              <span className="text-2xl flex-shrink-0">{domain.icon}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {domain.label}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {domain.desc}
                </p>
              </div>
              <span
                className={`ml-auto text-primary transition-opacity text-sm ${
                  hoveredDomain === domain.label ? "opacity-100" : "opacity-0"
                }`}
              >
                →
              </span>
            </button>
          ))}
        </section>

        <Card className="p-5 border border-border/50 bg-muted/20">
          <p className="text-sm text-foreground font-semibold mb-1">
            Not sure where to start?
          </p>
          <p className="text-xs text-muted-foreground">
            Upload your resume from the{" "}
            <button
              onClick={() => router.push("/dashboard")}
              className="text-primary font-medium underline underline-offset-2"
            >
              Dashboard
            </button>{" "}
            and we'll recommend the best-fit domains for you.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default page;