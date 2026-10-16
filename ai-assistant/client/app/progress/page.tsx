"use client";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import axiosInstance from "@/lib/axios";
import { describeError } from "@/lib/errors";
import { useEffect, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const LABELS: Record<string, string> = { technicalKnowledge: "Technical knowledge", accuracy: "Accuracy", relevance: "Relevance", problemSolving: "Problem solving", communication: "Communication", clarity: "Clarity", completeness: "Completeness" };

function TrendChart({ points }: { points: { score: number; date: string }[] }) {
  const W = 600, H = 180, P = 28;
  if (points.length < 2) return <p className="text-sm text-muted-foreground">Complete at least two interviews to see a trend.</p>;
  const x = (i: number) => P + (i * (W - 2 * P)) / (points.length - 1);
  const y = (s: number) => H - P - (s / 100) * (H - 2 * P);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Score trend over ${points.length} interviews, from ${points[0].score} to ${points[points.length - 1].score}`}>
      {[0, 50, 100].map((g) => <g key={g}><line x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="currentColor" opacity={0.15} /><text x={4} y={y(g) + 4} fontSize="10" fill="currentColor" opacity={0.6}>{g}</text></g>)}
      <polyline fill="none" stroke="hsl(var(--primary, 220 90% 56%))" strokeWidth="2" points={points.map((p, i) => `${x(i)},${y(p.score)}`).join(" ")} />
      {points.map((p, i) => <g key={i}><circle cx={x(i)} cy={y(p.score)} r="4" fill="hsl(var(--primary, 220 90% 56%))" /><title>{`${new Date(p.date).toLocaleDateString()}: ${p.score}/100`}</title></g>)}
    </svg>
  );
}
const Bar = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="flex justify-between text-sm mb-1"><span>{label}</span><span className="font-semibold">{value}</span></div>
    <div className="h-2 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}><div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${value}%` }} /></div>
  </div>
);

export default function ProgressPage() {
  const [d, setD] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => { axiosInstance.get("/api/interviews/stats/trends").then((r) => setD(r.data)).catch((e) => setError(describeError(e).message)); }, []);
  if (error) return <main className="p-8 max-w-3xl mx-auto"><p role="alert" className="text-destructive">{error}</p></main>;
  if (!d) return <main className="p-8 text-center text-muted-foreground">Loading…</main>;
  const s = d.summary;
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between"><h1 className="text-2xl font-bold">Your progress</h1><Link href="/dashboard" className="text-sm text-primary hover:underline">← Dashboard</Link></div>
        {s.interviews === 0 ? <Card className="p-6">No finished interviews yet. Complete one to start tracking progress.</Card> : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[["Interviews", s.interviews], ["Average", s.average ?? "n/a"], ["Best", s.best ?? "n/a"], ["Change since first", s.change === null ? "n/a" : `${s.change > 0 ? "+" : ""}${s.change}`]].map(([l, v]) => <Card key={l as string} className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-bold">{v}</p></Card>)}
            </div>
            <Card className="p-6"><h2 className="font-semibold mb-3">Score trend</h2><TrendChart points={d.points.map((p: any) => ({ score: p.score, date: p.date }))} /></Card>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="p-6 space-y-3"><h2 className="font-semibold">By criterion</h2>{Object.keys(d.criteria).length ? Object.entries(d.criteria).map(([k, v]) => <Bar key={k} label={LABELS[k] || k} value={v as number} />) : <p className="text-sm text-muted-foreground">No evaluated answers yet.</p>}</Card>
              <Card className="p-6 space-y-3"><h2 className="font-semibold">By topic</h2>{d.categories.length ? d.categories.map((c: any) => <Bar key={c.category} label={`${c.category} (${c.questions})`} value={c.average} />) : <p className="text-sm text-muted-foreground">No evaluated answers yet.</p>}</Card>
            </div>
            {d.practicePlan && (
              <Card className="p-6 space-y-3"><h2 className="font-semibold">Latest practice plan</h2>
                {d.practicePlan.items.map((p: any, i: number) => <div key={i}><h3 className="font-medium">{i + 1}. {p.focus}</h3>{p.why && <p className="text-sm text-muted-foreground">{p.why}</p>}<ul className="list-disc pl-5 text-sm">{(p.actions || []).map((a: string, k: number) => <li key={k}>{a}</li>)}</ul></div>)}
                <Link href={`/reports/${d.practicePlan.interviewId}`} className="text-sm text-primary hover:underline">View the full report</Link></Card>
            )}
            <p className="text-xs text-muted-foreground">{d.note}</p>
          </>
        )}
      </div>
    </main>
  );
}
