"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axiosInstance from "@/lib/axios";
import { describeError } from "@/lib/errors";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
const mmss = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
const Bar = ({ label, value }: { label: string; value: number | null }) => (
  <div>
    <div className="flex justify-between text-sm mb-1"><span>{label}</span><span className="font-semibold">{value ?? "n/a"}{value !== null && "/100"}</span></div>
    <div className="h-2 bg-muted rounded-full overflow-hidden" role="progressbar" aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="h-full bg-gradient-to-r from-primary to-accent" style={{ width: `${value ?? 0}%` }} />
    </div>
  </div>
);
const toMarkdown = (d: any) => {
  const { report: r, candidate, interview, questions } = d;
  const L = (t: string, a: string[]) => (a?.length ? `\n## ${t}\n${a.map((x) => `- ${x}`).join("\n")}\n` : "");
  return `# Interview Report\n\n- Candidate: ${candidate.name}\n- Role: ${interview.domain} (${r.interviewType})\n- Date: ${new Date(interview.startedAt).toLocaleString()}\n- Duration: ${mmss(interview.durationSeconds)}\n- Outcome: ${interview.status}\n\n## Overall score (AI-assisted): ${r.overallScore}/100\n\n> ${r.disclaimer}\n\n- Technical: ${r.technicalScore ?? "n/a"}\n- Accuracy: ${r.accuracyScore ?? "n/a"}\n- Communication: ${r.communicationScore ?? "n/a"}\n- Problem solving: ${r.problemSolvingScore ?? "n/a"}\n\n${r.summary}\n${L("Strengths", r.strengths)}${L("Areas for improvement", r.weaknesses)}${L("Recommendations", r.recommendations)}\n## Practice plan\n${(r.practicePlan || []).map((p: any) => `### ${p.focus}\n${p.why || ""}\n${(p.actions || []).map((x: string) => `- ${x}`).join("\n")}`).join("\n\n")}\n\n## Questions\n${questions.map((q: any) => `### Q${q.questionNumber} (${q.difficulty}${q.isFollowUp ? ", follow-up" : ""}) - ${q.status === "skipped" ? "skipped" : q.score ?? "not evaluated"}\n${q.question}\n\n**Answer:** ${q.answer || "-"}\n\n**AI feedback:** ${q.feedback || "-"}\n${q.modelAnswer ? `\n**Model answer:** ${q.modelAnswer}\n` : ""}`).join("\n")}\n`;
};
const download = (name: string, text: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

const List = ({ title, items }: { title: string; items: string[] }) => (
  <div>
    <h3 className="font-semibold mb-2">{title}</h3>
    {items?.length ? <ul className="list-disc pl-5 space-y-1 text-sm">{items.map((i, k) => <li key={k}>{i}</li>)}</ul> : <p className="text-sm text-muted-foreground">None recorded.</p>}
  </div>
);

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    axiosInstance.get(`/api/interviews/${id}/report`).then((r) => setData(r.data)).catch((e) => setError(describeError(e).message));
  }, [id]);

  if (error) return <main className="p-8 max-w-3xl mx-auto"><p role="alert" className="text-destructive">{error}</p><Link href="/dashboard" className="text-primary underline">Back to dashboard</Link></main>;
  if (!data) return <main className="p-8 text-center text-muted-foreground">Loading report…</main>;
  const { report: r, candidate, interview, questions, securityEvents } = data;
  const f = r.facts;

  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <Link href="/dashboard" className="text-sm text-primary hover:underline">← Dashboard</Link>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => download(`interview-report-${interview.id}.md`, toMarkdown(data), "text/markdown")}>Download .md</Button>
            <Button variant="outline" onClick={() => download(`interview-report-${interview.id}.json`, JSON.stringify(data, null, 2), "application/json")}>Download .json</Button>
            <Button variant="outline" onClick={() => window.print()}>Print / Save as PDF</Button>
          </div>
        </div>

        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-4">Interview Report</h1>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted-foreground">Candidate</dt><dd className="font-medium">{candidate.name}</dd></div>
            <div><dt className="text-muted-foreground">Job role</dt><dd className="font-medium">{interview.domain}</dd></div>
            <div><dt className="text-muted-foreground">Interview date</dt><dd className="font-medium">{new Date(interview.startedAt).toLocaleString()}</dd></div>
            <div><dt className="text-muted-foreground">Duration</dt><dd className="font-medium">{mmss(interview.durationSeconds)}</dd></div>
            <div><dt className="text-muted-foreground">Type</dt><dd className="font-medium capitalize">{String(r.interviewType || "technical").replace("_", " ")}</dd></div>
            <div><dt className="text-muted-foreground">Outcome</dt><dd className="font-medium capitalize">{interview.status.replace("_", " ")}</dd></div>
            <div><dt className="text-muted-foreground">Questions</dt><dd className="font-medium">{f.counts.evaluated} evaluated · {f.counts.skipped} skipped · {f.counts.unanswered} unanswered{f.counts.unevaluated ? ` · ${f.counts.unevaluated} not evaluated` : ""}</dd></div>
          </dl>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">AI-assisted assessment</h2>
            <span className="text-3xl font-bold" aria-label={`Overall score ${r.overallScore} out of 100`}>{r.overallScore}<span className="text-base text-muted-foreground">/100</span></span>
          </div>
          <p className="text-xs text-muted-foreground border border-border rounded p-2">{r.disclaimer}</p>
          <Bar label="Technical knowledge" value={r.technicalScore} />
          <Bar label="Accuracy" value={r.accuracyScore} />
          <Bar label="Communication" value={r.communicationScore} />
          <Bar label="Problem solving" value={r.problemSolvingScore} />
          {r.summary && <p className="text-sm">{r.summary}</p>}
          <div className="grid sm:grid-cols-2 gap-6">
            <List title="Strengths" items={r.strengths} />
            <List title="Areas for improvement" items={r.weaknesses} />
          </div>
          <List title="Recommendations" items={r.recommendations} />
          <p className="text-xs text-muted-foreground">Narrative source: {r.narrativeSource === "ai" ? "AI-written" : r.narrativeSource === "rule_based" ? "rule-based (AI unavailable)" : "not generated"}. {r.provenance?.scores}</p>
        </Card>

        {r.skillScores?.length > 0 && (
          <Card className="p-6 space-y-3">
            <h2 className="text-lg font-semibold">Skill-wise scores</h2>
            <p className="text-xs text-muted-foreground">Averages of evaluated answers per topic. Skipped and unevaluated questions are not included.</p>
            {r.skillScores.map((s: any) => <Bar key={s.category} label={`${s.category} (${s.questions} question${s.questions > 1 ? "s" : ""})`} value={s.average} />)}
          </Card>
        )}

        {r.practicePlan?.length > 0 && (
          <Card className="p-6 space-y-3">
            <h2 className="text-lg font-semibold">Your practice plan</h2>
            <p className="text-xs text-muted-foreground">{r.practicePlanSource === "ai" ? "Suggested by the AI from your answers." : "Generated from your lowest scores."} Suggestions only: no courses or resources are promised.</p>
            {r.practicePlan.map((p: any, i: number) => (
              <div key={i}><h3 className="font-semibold">{i + 1}. {p.focus}</h3>{p.why && <p className="text-sm text-muted-foreground">{p.why}</p>}<ul className="list-disc pl-5 text-sm">{(p.actions || []).map((a: string, k: number) => <li key={k}>{a}</li>)}</ul></div>
            ))}
          </Card>
        )}

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">Difficulty progression</h2>
          <p className="text-sm" aria-label="Difficulty progression">{r.difficultyProgression.map((d: string) => d[0].toUpperCase() + d.slice(1)).join(" → ") || "n/a"}</p>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-3">Question-wise scores</h2>
          <div className="space-y-4">
            {questions.map((q: any) => (
              <details key={q.id} className="border border-border rounded-lg p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Q{q.questionNumber}{q.isFollowUp ? " (follow-up)" : ""} · {q.difficulty} · {q.category} — {q.status === "skipped" ? "skipped (0)" : q.status === "unanswered" ? "not answered" : q.score == null ? "not evaluated" : `${q.score}/100`}
                </summary>
                <div className="mt-3 text-sm space-y-2">
                  <p className="font-medium">{q.question}</p>
                  {q.answer && <p className="whitespace-pre-wrap text-muted-foreground">{q.answer}</p>}
                  {q.feedback && <p><span className="font-semibold">AI feedback:</span> {q.feedback}</p>}
                  {q.criteria && <p className="text-xs text-muted-foreground">{Object.entries(q.criteria).map(([k, v]) => `${k}: ${v}/10`).join(" · ")}</p>}
                  {q.explanations && Object.keys(q.explanations).length > 0 && <ul className="text-xs list-disc pl-5 text-muted-foreground">{Object.entries(q.explanations).map(([k, v]) => <li key={k}><b>{k}:</b> {String(v)}</li>)}</ul>}
                  {q.evidence?.length > 0 && <p className="text-xs"><b>Quoted from your answer:</b> {q.evidence.map((e: string) => `“${e}”`).join(" · ")}</p>}
                  {q.strengths?.length > 0 && <p className="text-xs"><b>Strengths:</b> {q.strengths.join("; ")}</p>}
                  {q.improvements?.length > 0 && <p className="text-xs"><b>To improve:</b> {q.improvements.join("; ")}</p>}
                  {q.suggestions?.length > 0 && <p className="text-xs"><b>Next steps:</b> {q.suggestions.join("; ")}</p>}
                  {q.modelAnswer && <p className="text-xs bg-secondary/50 rounded p-2"><b>Model answer (AI-written):</b> {q.modelAnswer}</p>}
                </div>
              </details>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-1">Security & proctoring events</h2>
          <p className="text-xs text-muted-foreground mb-3">{f.security.note}</p>
          {securityEvents.length === 0 ? <p className="text-sm">No events recorded.</p> : (
            <ul className="text-sm space-y-1">
              {securityEvents.map((e: any, i: number) => (
                <li key={i}>{new Date(e.timestamp).toLocaleTimeString()} · <span className="font-medium">{e.eventType}</span> · {e.durationSeconds}s · {e.severity}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
