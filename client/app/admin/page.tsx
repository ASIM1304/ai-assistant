"use client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import adminAxios, { setAdminCsrf } from "@/lib/adminAxios";
import { describeError } from "@/lib/errors";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Tab = "interviews" | "candidates" | "roles" | "settings" | "activity";
const TABS: Tab[] = ["interviews", "candidates", "roles", "settings", "activity"];
const mmss = (s: number) => `${Math.floor((s || 0) / 60)}m ${String((s || 0) % 60).padStart(2, "0")}s`;

export default function AdminPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("interviews");
  const [stats, setStats] = useState<any>(null);
  const [msg, setMsg] = useState("");

  const run = useCallback(async (fn: () => Promise<unknown>, ok = "Saved.") => {
    try { await fn(); setMsg(ok); } catch (e) { setMsg(describeError(e).message); }
  }, []);

  useEffect(() => {
    adminAxios.get("/api/admin/auth/me")
      .then(({ data }) => { setAdminCsrf(data.csrfToken); setAdmin(data.admin); return adminAxios.get("/api/admin/stats"); })
      .then(({ data }) => setStats(data))
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  const logout = async () => { await adminAxios.post("/api/admin/auth/logout").catch(() => {}); setAdminCsrf(null); router.push("/admin/login"); };
  if (!admin) return <main className="p-8 text-center text-muted-foreground">Loading…</main>;

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div><h1 className="text-2xl font-bold">Admin dashboard</h1><p className="text-xs text-muted-foreground">Signed in as {admin.name} · candidate e-mails are masked and contact/profile data is never shown here</p></div>
          <Button variant="outline" onClick={logout}>Sign out</Button>
        </header>
        {stats && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["Candidates", stats.candidates], ["In progress", stats.inProgress], ["Completed", stats.completed], ["Awaiting review", stats.pendingReview]].map(([l, v]) => <Card key={l as string} className="p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-bold">{v}</p></Card>)}</div>}
        <nav className="flex gap-2 flex-wrap" aria-label="Sections">{TABS.map((t) => <Button key={t} size="sm" variant={tab === t ? "default" : "outline"} onClick={() => { setTab(t); setMsg(""); }} className="capitalize">{t}</Button>)}</nav>
        {msg && <p role="status" className="text-sm bg-muted rounded p-2">{msg}</p>}
        {tab === "interviews" && <Interviews run={run} />}
        {tab === "candidates" && <Candidates run={run} />}
        {tab === "roles" && <Roles run={run} />}
        {tab === "settings" && <Settings run={run} />}
        {tab === "activity" && <Activity />}
      </div>
    </main>
  );
}

type RunFn = (fn: () => Promise<unknown>, ok?: string) => Promise<void>;

function Interviews({ run }: { run: RunFn }) {
  const [flagged, setFlagged] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const load = useCallback(() => adminAxios.get(`/api/admin/interviews${flagged ? "?flagged=true" : ""}`).then((r) => setList(r.data.interviews)).catch(() => {}), [flagged]);
  useEffect(() => { load(); }, [load]);
  const open = (id: string) => run(async () => { setDetail((await adminAxios.get(`/api/admin/interviews/${id}`)).data); setNotes(""); }, "Opened (this view is audit-logged).");
  const review = (decision: string) => run(async () => { await adminAxios.post(`/api/admin/interviews/${detail.interview.id}/review`, { decision, notes }); await open(detail.interview.id); load(); }, "Review saved.");

  if (detail) {
    const d = detail.interview;
    return (
      <Card className="p-5 space-y-4">
        <Button variant="outline" size="sm" onClick={() => setDetail(null)}>← Back</Button>
        <p className="font-semibold">{detail.candidate?.name} ({detail.candidate?.emailMasked}) · {d.domain} · {d.status} · {mmss(d.durationSeconds)} · score {detail.report?.overallScore ?? "n/a"}</p>
        <p className="text-xs text-muted-foreground">Review status: {d.reviewStatus}. Flags are automated signals, not proof of misconduct.</p>
        <div><h3 className="font-semibold mb-1">Security events ({detail.securityEvents.length})</h3>
          <ul className="text-sm space-y-1">{detail.securityEvents.map((e: any) => <li key={e.id}>{new Date(e.timestamp).toLocaleTimeString()} · {e.eventType} · {e.durationSeconds}s · {e.severity}{e.countsTowardLimit ? "" : " (not counted)"} · {e.source}</li>)}{!detail.securityEvents.length && <li>None.</li>}</ul></div>
        <div><h3 className="font-semibold mb-1">Questions</h3>
          {detail.questions.map((q: any) => <details key={q.id} className="border border-border rounded p-2 mb-2"><summary className="text-sm cursor-pointer">Q{q.questionNumber} · {q.difficulty} · {q.status} · {q.score ?? "-"}{q.promptInjectionSuspected ? " · ⚠ injection suspected" : ""}</summary><p className="text-sm mt-2 font-medium">{q.question}</p><p className="text-sm whitespace-pre-wrap text-muted-foreground">{q.answer}</p><p className="text-sm">{q.feedback}</p></details>)}</div>
        <div className="space-y-2 border-t border-border pt-3">
          <Input placeholder="Review notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          <div className="flex gap-2"><Button onClick={() => review("cleared")}>Mark cleared</Button><Button variant="outline" onClick={() => review("concern_confirmed")}>Confirm concern</Button></div>
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-5 space-y-3">
      <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} /> Flagged for review only</label>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Candidate</th><th>Role</th><th>Status</th><th>Score</th><th>Flags</th><th>Review</th><th /></tr></thead>
        <tbody>{list.map((i) => <tr key={i.id} className="border-t border-border"><td>{i.candidate?.name} <span className="text-muted-foreground">{i.candidate?.emailMasked}</span></td><td>{i.domain}</td><td>{i.status}</td><td>{i.score ?? "-"}</td><td>{i.warningCount}</td><td>{i.reviewStatus}</td><td><Button size="sm" variant="outline" onClick={() => open(i.id)}>Open</Button></td></tr>)}</tbody></table>
        {!list.length && <p className="text-sm text-muted-foreground py-3">No interviews.</p>}</div>
    </Card>
  );
}

function Candidates({ run }: { run: RunFn }) {
  const [list, setList] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const load = useCallback(() => adminAxios.get(`/api/admin/candidates${q ? `?search=${encodeURIComponent(q)}` : ""}`).then((r) => setList(r.data.candidates)).catch(() => {}), [q]);
  useEffect(() => { load(); }, [load]);
  return (
    <Card className="p-5 space-y-3">
      <Input placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Name</th><th>E-mail</th><th>Interviews</th><th>Status</th><th /></tr></thead>
        <tbody>{list.map((c) => <tr key={c.id} className="border-t border-border"><td>{c.name}</td><td>{c.emailMasked}</td><td>{c.interviewCount}</td><td>{c.isActive ? "active" : "disabled"}</td>
          <td className="space-x-2 whitespace-nowrap"><Button size="sm" variant="outline" onClick={() => run(async () => { await adminAxios.patch(`/api/admin/candidates/${c.id}`, { isActive: !c.isActive }); load(); }, "Updated.")}>{c.isActive ? "Disable" : "Enable"}</Button>
            <Button size="sm" variant="outline" onClick={() => { if (confirm(`Permanently delete ${c.name} and all their data?`)) run(async () => { await adminAxios.delete(`/api/admin/candidates/${c.id}`); load(); }, "Deleted."); }}>Delete</Button></td></tr>)}</tbody></table>
    </Card>
  );
}

function Roles({ run }: { run: RunFn }) {
  const [roles, setRoles] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [label, setLabel] = useState("");
  const [cat, setCat] = useState("");
  const load = useCallback(async () => { setRoles((await adminAxios.get("/api/admin/job-roles")).data.roles); setCats((await adminAxios.get("/api/admin/categories")).data.categories); }, []);
  useEffect(() => { load().catch(() => {}); }, [load]);
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="p-5 space-y-3"><h2 className="font-semibold">Job roles</h2>
        {roles.map((r) => <div key={r.id} className="flex items-center justify-between text-sm"><span>{r.label} {!r.active && <em className="text-muted-foreground">(inactive)</em>}</span><Button size="sm" variant="outline" onClick={() => run(async () => { await adminAxios.patch(`/api/admin/job-roles/${r.id}`, { active: !r.active }); load(); }, "Updated.")}>{r.active ? "Deactivate" : "Activate"}</Button></div>)}
        <div className="flex gap-2"><Input placeholder="New role name" value={label} onChange={(e) => setLabel(e.target.value)} /><Button onClick={() => run(async () => { await adminAxios.post("/api/admin/job-roles", { label, categories: cats.filter((c) => c.active).map((c) => c.name) }); setLabel(""); load(); }, "Role added.")}>Add</Button></div></Card>
      <Card className="p-5 space-y-3"><h2 className="font-semibold">Question categories</h2>
        {cats.map((c) => <div key={c.id} className="flex items-center justify-between text-sm"><span>{c.name} {!c.active && <em className="text-muted-foreground">(inactive)</em>}</span><Button size="sm" variant="outline" onClick={() => run(async () => { await adminAxios.patch(`/api/admin/categories/${c.id}`, { active: !c.active }); load(); }, "Updated.")}>{c.active ? "Deactivate" : "Activate"}</Button></div>)}
        <div className="flex gap-2"><Input placeholder="New category" value={cat} onChange={(e) => setCat(e.target.value)} /><Button onClick={() => run(async () => { await adminAxios.post("/api/admin/categories", { name: cat }); setCat(""); load(); }, "Category added.")}>Add</Button></div></Card>
    </div>
  );
}

function Settings({ run }: { run: RunFn }) {
  const [s, setS] = useState<any>(null);
  useEffect(() => { adminAxios.get("/api/admin/settings").then((r) => setS(r.data.settings)).catch(() => {}); }, []);
  if (!s) return null;
  const num = (path: [string, string, string?], label: string) => {
    const get = () => (path[2] ? s[path[0]][path[1]][path[2]] : s[path[0]][path[1]]);
    return <label className="text-sm block">{label}<Input type="number" value={get()} onChange={(e) => { const v = Number(e.target.value); const n = structuredClone(s); if (path[2]) n[path[0]][path[1]][path[2]] = v; else n[path[0]][path[1]] = v; setS(n); }} /></label>;
  };
  const save = () => run(async () => {
    const i = s.interview, p = s.proctoring;
    const r = await adminAxios.put("/api/admin/settings", {
      interview: { totalQuestions: i.totalQuestions, durationMinutes: i.durationMinutes, maxSkips: i.maxSkips, startDifficulty: i.startDifficulty, adaptive: i.adaptive },
      proctoring: { inactivitySeconds: p.inactivitySeconds, requireFullscreen: p.requireFullscreen, warningLimits: p.warningLimits },
      retention: { interviewDays: s.retention.interviewDays, resumeDays: s.retention.resumeDays },
    });
    setS(r.data.settings);
  }, "Settings saved. They apply to interviews created from now on.");
  return (
    <Card className="p-5 space-y-4">
      <div className="grid sm:grid-cols-3 gap-3">
        {num(["interview", "totalQuestions"], "Number of questions")}{num(["interview", "durationMinutes"], "Duration (minutes)")}{num(["interview", "maxSkips"], "Max skips")}
        <label className="text-sm block">Start difficulty<select className="w-full border border-border rounded-md bg-background p-2" value={s.interview.startDifficulty} onChange={(e) => setS({ ...s, interview: { ...s.interview, startDifficulty: e.target.value } })}>{["easy", "medium", "hard"].map((d) => <option key={d}>{d}</option>)}</select></label>
        <label className="text-sm flex items-end gap-2 pb-2"><input type="checkbox" checked={s.interview.adaptive} onChange={(e) => setS({ ...s, interview: { ...s.interview, adaptive: e.target.checked } })} /> Adaptive difficulty</label>
        <label className="text-sm flex items-end gap-2 pb-2"><input type="checkbox" checked={s.proctoring.requireFullscreen} onChange={(e) => setS({ ...s, proctoring: { ...s.proctoring, requireFullscreen: e.target.checked } })} /> Require fullscreen</label>
        {num(["proctoring", "inactivitySeconds"], "Inactivity flag (seconds)")}
        {num(["proctoring", "warningLimits", "notifyUntil"], "Notify candidate up to warning #")}{num(["proctoring", "warningLimits", "reviewAt"], "Flag for admin review at #")}{num(["proctoring", "warningLimits", "terminateAt"], "End interview at # (0 = never)")}
        {num(["retention", "interviewDays"], "Keep interviews (days)")}{num(["retention", "resumeDays"], "Keep resume analysis (days)")}
      </div>
      <Button onClick={save}>Save settings</Button>
    </Card>
  );
}

function Activity() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { adminAxios.get("/api/admin/activity?limit=100").then((r) => setRows(r.data.activity)).catch(() => {}); }, []);
  return <Card className="p-5"><ul className="text-sm space-y-1">{rows.map((r) => <li key={r.id}><span className="text-muted-foreground">{new Date(r.at).toLocaleString()}</span> · {r.action} {r.targetType ? `· ${r.targetType}` : ""}</li>)}{!rows.length && <li>No activity yet.</li>}</ul></Card>;
}
