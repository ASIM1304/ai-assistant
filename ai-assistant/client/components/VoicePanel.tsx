"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface VoicePanelProps {
  question: string;
  /** A fresh key (e.g. message id) each time a new question appears, so the panel resets */
  questionKey: string;
  onSubmit: (answer: string) => void;
  disabled?: boolean;
  /** Voice mode isn't offered for coding questions — dictating code by voice is impractical */
  isCoding?: boolean;
}

const RESPONSE_SECONDS = 60;

/**
 * Reads the question aloud (Web Speech Synthesis), then listens for a spoken
 * answer (Web Speech Recognition) with a 60-second countdown. If time runs
 * out, whatever was transcribed so far is submitted — if nothing was said at
 * all, the candidate is auto-excused from this question with a placeholder
 * answer, so the interview keeps moving.
 *
 * Both APIs are Chrome/Edge-only. On unsupported browsers, this panel says so
 * and the interview falls back to typed answers instead.
 */
export default function VoicePanel({
  question,
  questionKey,
  onSubmit,
  disabled,
  isCoding,
}: VoicePanelProps) {
  const [supported, setSupported] = useState(true);
  const [phase, setPhase] = useState<
    "speaking" | "listening" | "submitted"
  >("speaking");
  const [transcript, setTranscript] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RESPONSE_SECONDS);

  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittedRef = useRef(false);
  const transcriptRef = useRef("");

  useEffect(() => {
    const hasTTS = "speechSynthesis" in window;
    const hasSTT =
      !!(window as any).SpeechRecognition ||
      !!(window as any).webkitSpeechRecognition;
    setSupported(hasTTS && hasSTT);
  }, []);

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    window.speechSynthesis?.cancel();
  };

  const submit = (answer: string) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    cleanup();
    setPhase("submitted");
    onSubmit(answer.trim() || "(No response — time expired)");
  };

  const startListening = () => {
    setPhase("listening");
    setSecondsLeft(RESPONSE_SECONDS);
    setTranscript("");
    transcriptRef.current = "";

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          submit(transcriptRef.current);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (e: any) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript + " ";
      }
      transcriptRef.current = text.trim();
      setTranscript(text.trim());
    };
    recognition.onerror = () => {
      // non-fatal — the countdown still runs, candidate can use the manual
      // "I'm done" button, or the timeout will submit whatever was captured
    };
    recognition.start();
    recognitionRef.current = recognition;
  };

  // On a new question: reset, speak it, then start listening
  useEffect(() => {
    submittedRef.current = false;
    setTranscript("");
    setSecondsLeft(RESPONSE_SECONDS);

    if (!supported || isCoding) return;

    setPhase("speaking");
    window.speechSynthesis?.cancel();
    const utterance = new SpeechSynthesisUtterance(question);
    utterance.rate = 0.98;
    utterance.onend = () => startListening();
    utterance.onerror = () => startListening();
    window.speechSynthesis?.speak(utterance);

    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionKey, supported, isCoding]);

  if (isCoding) return null; // caller falls back to the code editor

  if (!supported) {
    return (
      <div className="border-t border-border bg-muted/30 p-3 text-center text-xs text-muted-foreground">
        Voice mode isn't supported in this browser (needs Chrome or Edge) —
        please type your answer below instead.
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {phase === "speaking" && "🔊 Reading question aloud…"}
          {phase === "listening" && "🎙️ Listening for your answer…"}
          {phase === "submitted" && "✅ Answer submitted"}
        </span>
        {phase === "listening" && (
          <span
            className={`text-xs font-mono font-bold tabular-nums ${
              secondsLeft <= 10 ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            0:{secondsLeft.toString().padStart(2, "0")}
          </span>
        )}
      </div>

      {phase === "listening" && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000 linear"
            style={{ width: `${(secondsLeft / RESPONSE_SECONDS) * 100}%` }}
          />
        </div>
      )}

      <p className="text-sm text-foreground italic min-h-[2.5em] bg-muted/30 rounded-lg p-3 mb-3">
        {transcript || (phase === "listening" ? "…" : "")}
      </p>

      <div className="flex justify-end">
        <Button
          onClick={() => submit(transcriptRef.current)}
          disabled={disabled || phase !== "listening"}
          className="rounded-full"
        >
          I'm done answering →
        </Button>
      </div>
    </div>
  );
}
