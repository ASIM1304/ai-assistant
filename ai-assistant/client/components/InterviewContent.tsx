"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import axiosInstance from "@/lib/axios";
import { describeError } from "@/lib/errors";
import InterviewSetup from "@/components/InterviewSetup";
import WebcamMonitor, { ProctorEvent } from "@/components/WebcamMonitor";
import VoicePanel from "@/components/VoicePanel";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Stage = "loading" | "instructions" | "consent" | "devices" | "interview" | "ended" | "error";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function InterviewContent() {
  const router = useRouter();
  const params = useSearchParams();
  const domain = params.get("domain") || "";

  const [stage, setStage] = useState<Stage>("loading");
  const [fatal, setFatal] = useState("");
  const [defaults, setDefaults] = useState<any>(null);
  const [privacy, setPrivacy] = useState<any>(null);
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [state, setState] = useState<any>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [consent, setConsent] = useState({ privacyAccepted: false, identityConfirmed: false, cameraConsent: false, microphoneConsent: false });
  const [opts, setOpts] = useState({ interviewType: "technical", totalQuestions: 10, durationMinutes: 45, jobDescription: "" });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [offline, setOffline] = useState(false);
  const [warning, setWarning] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const idRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  idRef.current = interviewId;

  // ── initial load: privacy notice, defaults, and any interview already in progress ──
  useEffect(() => {
    (async () => {
      try {
        const [p, r, a] = await Promise.all([axiosInstance.get("/api/config/privacy"), axiosInstance.get("/api/config/roles"), axiosInstance.get("/api/interviews/active")]);
        setPrivacy(p.data);
        setDefaults(r.data.interviewDefaults);
        setOpts((o) => ({ ...o, totalQuestions: r.data.interviewDefaults.totalQuestions, durationMinutes: r.data.interviewDefaults.durationMinutes }));
        const act = a.data.interview;
        if (act?.status === "in_progress") {
          setInterviewId(act.id); // resume after refresh / crash: server still has everything
          const s = await axiosInstance.get(`/api/interviews/${act.id}/state`);
          setState(s.data);
          setStage("devices");
        } else if (!domain) setStage("error"), setFatal("No job role selected. Choose one from your dashboard.");
        else setStage("instructions");
      } catch (e) {
        setFatal(describeError(e).message);
        setStage("error");
      }
    })();
  }, [domain]);

  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setOffline(!navigator.onLine);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const applyState = useCallback((s: any) => {
    setState(s);
    setRemaining(s.interview.remainingSeconds);
    if (["completed", "terminated", "expired", "abandoned"].includes(s.interview.status)) {
      stream?.getTracks().forEach((t) => t.stop());
      setStage("ended");
    }
  }, [stream]);

  // ── countdown driven by the server's remaining time; server re-checks on every call ──
  useEffect(() => {
    if (stage !== "interview" || remaining === null) return;
    const id = setInterval(() => setRemaining((r) => (r === null ? r : Math.max(0, r - 1))), 1000);
    return () => clearInterval(id);
  }, [stage, remaining === null]);
  useEffect(() => {
    if (stage === "interview" && remaining === 0 && interviewId)
      axiosInstance.get(`/api/interviews/${interviewId}/state`).then((r) => applyState(r.data)).catch(() => {});
  }, [remaining, stage, interviewId, applyState]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [state?.currentQuestion?.id, state?.history?.length]);

  // ── heartbeat (lets the server tell "slow network" from "gone") ──
  useEffect(() => {
    if (stage !== "interview" || !interviewId) return;
    const id = setInterval(() => {
      axiosInstance.post(`/api/interviews/${interviewId}/heartbeat`, {}).then((r) => {
        if (r.data.status && r.data.status !== "in_progress") axiosInstance.get(`/api/interviews/${interviewId}/state`).then((s) => applyState(s.data));
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, [stage, interviewId, applyState]);

  // ── flow actions ──
  const begin = () => setStage("consent");

  const submitConsent = async () => {
    setBusy(true); setError("");
    try {
      let id = interviewId;
      if (!id) {
        const c = await axiosInstance.post("/api/interviews", {
          jobRole: domain,
          interviewType: opts.interviewType,
          totalQuestions: opts.totalQuestions,
          durationMinutes: opts.durationMinutes,
          ...(opts.jobDescription.trim() ? { jobDescription: opts.jobDescription.trim() } : {}),
        });
        id = c.data.interview.id;
        setInterviewId(id);
      }
      await axiosInstance.post(`/api/interviews/${id}/consent`, { privacyVersion: privacy.version, ...consent });
      setStage("devices");
    } catch (e) {
      const p = describeError(e);
      if (p.code === "INTERVIEW_IN_PROGRESS") router.refresh();
      setError(p.message);
    } finally { setBusy(false); }
  };

  const onDevicesReady = async (s: MediaStream) => {
    setStream(s); setError("");
    try {
      if (state?.interview?.status === "in_progress") { applyState(state); setStage("interview"); return; } // resuming
      const r = await axiosInstance.post(`/api/interviews/${interviewId}/start`, { verification: { faceDetected: true, voiceChecked: true } });
      applyState(r.data);
      setStage("interview");
    } catch (e) { setError(describeError(e).message); }
  };

  const send = async (text: string) => {
    if (!state?.currentQuestion || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const r = await axiosInstance.post(`/api/interviews/${interviewId}/answer`, { questionId: state.currentQuestion.id, answer: text });
      if (r.data.needsMoreDetail) { setNotice(r.data.message); setState(r.data.state); return; }
      setDraft(""); setVoiceMode(false);
      applyState(r.data.state);
    } catch (e) {
      const p = describeError(e);
      // The answer stays in the box: nothing is lost on a network/AI failure.
      if (p.code === "INTERVIEW_EXPIRED") { const s = await axiosInstance.get(`/api/interviews/${interviewId}/state`); applyState(s.data); return; }
      setError(p.retryable ? `${p.message} Your answer is kept - press Submit to try again.` : p.message);
      setVoiceMode(false);
    } finally { setBusy(false); }
  };

  const skip = async () => {
    if (!state?.currentQuestion || busy || !confirm("Skip this question? It will score 0.")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const r = await axiosInstance.post(`/api/interviews/${interviewId}/skip`, { questionId: state.currentQuestion.id });
      setDraft(""); applyState(r.data.state);
    } catch (e) { setError(describeError(e).message); } finally { setBusy(false); }
  };

  const exit = async () => {
    if (!confirm("End this interview now? You'll get a partial report for the questions you answered.")) return;
    try { const r = await axiosInstance.post(`/api/interviews/${interviewId}/abandon`, {}); applyState(r.data); }
    catch (e) { setError(describeError(e).message); }
  };

  const onProctor = useCallback(async (type: ProctorEvent, durationSeconds: number, note?: string) => {
    const id = idRef.current;
    if (!id) return;
    try {
      const r = await axiosInstance.post(`/api/interviews/${id}/events`, { eventType: type, durationSeconds, note });
      if (r.data.message) setWarning(r.data.message);
      if (r.data.terminated) { const s = await axiosInstance.get(`/api/interviews/${id}/state`); applyState(s.data); }
    } catch { /* a lost flag must never interrupt the candidate */ }
  }, [applyState]);

  useEffect(() => { if (!warning) return; const t = setTimeout(() => setWarning(""), 8000); return () => clearTimeout(t); }, [warning]);

  // ── views ──
  const shell = (children: React.ReactNode) => <main className="min-h-screen bg-background px-4 py-8"><div className="max-w-3xl mx-auto">{children}</div></main>;

  if (stage === "loading") return shell(<p className="text-center text-muted-foreground">Loading…</p>);
  if (stage === "error") return shell(<Card className="p-6"><p role="alert" className="text-destructive mb-4">{fatal}</p><Button onClick={() => router.push("/dashboard")}>Back to dashboard</Button></Card>);

  if (stage === "instructions") {
    const L = defaults?.limits || { minQuestions: 3, maxQuestions: 20, minDurationMinutes: 10, maxDurationMinutes: 90 };
    const TYPES: Record<string, string> = { technical: "Technical", behavioral: "Behavioral", hr: "HR", resume: "Based on my resume", job_description: "Based on a job description" };
    const needsJd = opts.interviewType === "job_description";
    const jdOk = !needsJd || opts.jobDescription.trim().length >= 80;
    const field = "w-full rounded-md border border-border bg-background p-2 text-sm";
    return shell(
      <Card className="p-6 space-y-5">
        <h1 className="text-2xl font-bold">{domain} interview</h1>
        <div className="grid sm:grid-cols-3 gap-4">
          <label className="text-sm">Interview type
            <select className={field} value={opts.interviewType} onChange={(e) => setOpts({ ...opts, interviewType: e.target.value })}>
              {(defaults?.interviewTypes || Object.keys(TYPES)).map((t: string) => <option key={t} value={t}>{TYPES[t] || t}</option>)}
            </select></label>
          <label className="text-sm">Questions ({L.minQuestions}–{L.maxQuestions})
            <input className={field} type="number" min={L.minQuestions} max={L.maxQuestions} value={opts.totalQuestions} onChange={(e) => setOpts({ ...opts, totalQuestions: Number(e.target.value) })} /></label>
          <label className="text-sm">Minutes ({L.minDurationMinutes}–{L.maxDurationMinutes})
            <input className={field} type="number" min={L.minDurationMinutes} max={L.maxDurationMinutes} value={opts.durationMinutes} onChange={(e) => setOpts({ ...opts, durationMinutes: Number(e.target.value) })} /></label>
        </div>
        {opts.interviewType === "resume" && <p className="text-sm text-muted-foreground">Questions will be based on the resume you analysed on your dashboard. Upload one there first if you haven&apos;t.</p>}
        {(needsJd || opts.interviewType === "technical") && (
          <label className="text-sm block">Job description {needsJd ? "(required)" : "(optional)"}
            <textarea className={`${field} h-28`} maxLength={6000} value={opts.jobDescription} onChange={(e) => setOpts({ ...opts, jobDescription: e.target.value })} placeholder="Paste the job posting you are preparing for…" />
            <span className="text-xs text-muted-foreground">It is sent to our AI provider to tailor questions and is stored with this interview.</span>
          </label>
        )}
        <ul className="list-disc pl-5 text-sm space-y-2">
          <li>{opts.totalQuestions} questions, one at a time, within {opts.durationMinutes} minutes. The server keeps the clock.</li>
          <li>Questions adapt over several answers, and may include follow-ups on points you left vague.</li>
          <li>You may skip up to {defaults?.maxSkips} question(s); a skipped question scores 0.</li>
          <li>Answers are scored by an AI against fixed criteria. It is an assessment, not an objective fact, and can make mistakes.</li>
          <li>Your camera is used to check a face is present; it is analysed in your browser and never recorded. Tab switches and similar events are logged as flags for review.</li>
          <li>If your connection drops, your progress is saved - reopen the interview to continue.</li>
        </ul>
        <div className="flex gap-3"><Button onClick={begin} disabled={!jdOk || opts.totalQuestions < L.minQuestions || opts.totalQuestions > L.maxQuestions || opts.durationMinutes < L.minDurationMinutes || opts.durationMinutes > L.maxDurationMinutes}>Continue</Button><Button variant="outline" onClick={() => router.push("/dashboard")}>Cancel</Button></div>
        {!jdOk && <p className="text-xs text-destructive">Paste at least a few sentences of the job description.</p>}
      </Card>);
  }

  if (stage === "consent") {
    const need = defaults;
    const ready = consent.privacyAccepted && consent.identityConfirmed && (!need?.requireCamera || consent.cameraConsent) && (!need?.requireMicrophone || consent.microphoneConsent);
    const box = (k: keyof typeof consent, label: string) => (
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={consent[k]} onChange={(e) => setConsent({ ...consent, [k]: e.target.checked })} /><span>{label}</span></label>
    );
    return shell(
      <Card className="p-6 space-y-5">
        <h1 className="text-2xl font-bold">{privacy?.title}</h1>
        {privacy?.sections.map((s: any) => (
          <section key={s.heading}><h2 className="font-semibold mb-1">{s.heading}</h2><ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">{s.items.map((i: string) => <li key={i}>{i}</li>)}</ul></section>
        ))}
        <div className="space-y-3 border-t border-border pt-4">
          {box("privacyAccepted", "I have read the privacy notice and agree to this processing.")}
          {box("cameraConsent", "I consent to camera access for in-browser face-presence checks (no video is recorded or uploaded).")}
          {box("microphoneConsent", "I consent to microphone access for the audio check and optional voice answers (no audio is recorded or uploaded by this service).")}
          {box("identityConfirmed", "I confirm I am the account holder and will complete this interview myself.")}
        </div>
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        <div className="flex gap-3"><Button disabled={!ready || busy} onClick={submitConsent}>{busy ? "Saving…" : "Accept & continue"}</Button><Button variant="outline" onClick={() => router.push("/dashboard")}>Decline</Button></div>
      </Card>);
  }

  if (stage === "devices") return shell(<>{error && <p role="alert" className="text-destructive text-sm mb-3">{error}</p>}<InterviewSetup onComplete={onDevicesReady} /></>);

  if (stage === "ended") {
    const s = state?.interview;
    const msg: Record<string, string> = { completed: "Interview complete.", terminated: "The interview ended because the configured flag limit was reached. It will be reviewed by an administrator.", expired: "Time is up. Your answers so far were saved.", abandoned: "Interview ended." };
    return shell(
      <Card className="p-6 space-y-4 text-center">
        <h1 className="text-2xl font-bold">{msg[s?.status] || "Interview ended."}</h1>
        <p className="text-sm text-muted-foreground">Your report is ready. Scores are AI-assisted assessments.</p>
        <div className="flex gap-3 justify-center"><Button onClick={() => router.push(`/reports/${s.id}`)}>View report</Button><Button variant="outline" onClick={() => router.push("/dashboard")}>Dashboard</Button></div>
      </Card>);
  }

  // stage === "interview": fixed-height layout. Header on top, history scrolls in the
  // middle, answer box + buttons are pinned at the bottom so they never fall off-screen.
  const i = state.interview;
  const q = state.currentQuestion;
  const isCoding = q?.questionType === "coding";
  return (
    <main className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="shrink-0 border-b border-border px-4 py-2">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2 text-sm">
          <div><span className="font-semibold">Question {i.questionNumber} of {i.totalQuestions}</span> <span className="text-muted-foreground">· {i.remainingQuestions} remaining · {i.difficulty}</span></div>
          <div className="flex items-center gap-4">
            <span role="timer" aria-label="Time remaining" className={`font-mono ${remaining !== null && remaining < 120 ? "text-destructive" : ""}`}>{remaining !== null ? mmss(remaining) : "--:--"}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">Status: {i.status.replace("_", " ")}</span>
            <Button variant="outline" size="sm" onClick={exit}>End interview</Button>
          </div>
        </div>
        {offline && <p role="status" className="max-w-4xl mx-auto mt-2 text-xs bg-amber-500/10 border border-amber-500/30 rounded p-2">You appear to be offline. Your progress is saved; reconnect and press Submit.</p>}
        {warning && <p role="status" className="max-w-4xl mx-auto mt-2 text-xs bg-muted rounded p-2">⚠ {warning} <span className="text-muted-foreground">(flags so far: {i.warningCount})</span></p>}
      </header>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="max-w-4xl mx-auto space-y-4" aria-live="polite">
          {state.history.map((h: any) => (
            <div key={h.id} className="text-sm space-y-1">
              <p className="font-medium">Q{h.questionNumber}. {h.question}</p>
              {h.status === "skipped" ? <p className="text-muted-foreground italic">Skipped</p> : <p className="whitespace-pre-wrap text-muted-foreground">{h.answer}</p>}
              {h.feedback && h.status !== "skipped" && <p className="bg-secondary/50 rounded p-2">{h.feedback}</p>}
            </div>
          ))}
          {q && (
            <Card className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Q{q.questionNumber} · {q.category} · {isCoding ? "coding" : "discussion"}</p>
              <p className="font-medium whitespace-pre-wrap">{q.question}</p>
            </Card>
          )}
        </div>
      </div>

      {q && (
        <footer className="shrink-0 border-t border-border bg-background px-4 py-3 md:pr-52 max-h-[55vh] overflow-y-auto">
          <div className="max-w-4xl mx-auto space-y-2">
            {notice && <p role="status" className="text-sm text-amber-600">{notice}</p>}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {voiceMode && !isCoding ? (
              <VoicePanel question={q.question} questionKey={q.id} disabled={busy} isCoding={false} onSubmit={(t) => { setDraft(t); send(t); }} />
            ) : (
              <>
                <label htmlFor="answer" className="sr-only">Your answer</label>
                <textarea id="answer" value={draft} onChange={(e) => setDraft(e.target.value)} disabled={busy} rows={isCoding ? 7 : 3} maxLength={10000}
                  placeholder={isCoding ? "Write your code here…" : "Type your answer…"}
                  className={`w-full resize-y max-h-48 rounded-lg border border-border bg-background p-3 text-sm ${isCoding ? "font-mono" : ""}`} />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => send(draft)} disabled={busy || !draft.trim()}>{busy ? "Evaluating…" : "Submit answer"}</Button>
                  <Button variant="outline" onClick={skip} disabled={busy || i.skipsRemaining === 0}>Skip ({i.skipsRemaining} left)</Button>
                  {!isCoding && <Button variant="ghost" onClick={() => setVoiceMode(true)} disabled={busy}>Answer by voice</Button>}
                </div>
              </>
            )}
          </div>
        </footer>
      )}

      {stream && state.proctoring && (
        <WebcamMonitor stream={stream} enabledEvents={state.proctoring.enabledEvents} inactivitySeconds={state.proctoring.inactivitySeconds} requireFullscreen={state.proctoring.requireFullscreen} voiceActive={voiceMode} onEvent={onProctor} />
      )}
    </main>
  );
}
