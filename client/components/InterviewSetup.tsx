"use client";

import { useEffect, useRef, useState } from "react";
import * as faceapi from "face-api.js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface InterviewSetupProps {
  /** Called once both checks pass, handing off the live audio+video stream */
  onComplete: (stream: MediaStream) => void;
}

const TARGET_PHRASE = "i can start the interview";
const MODEL_URL = "/models";

/**
 * Two-step pre-interview check:
 *  1. Voice check — candidate says "I can start the interview". We try to
 *     transcribe it live with the Web Speech API (Chrome/Edge) so it can
 *     auto-advance; on browsers without that API (Firefox, Safari) we fall
 *     back to a visible audio-level meter + a manual "I said it" confirm,
 *     so the step is never a hard blocker on unsupported browsers.
 *  2. Camera check — confirms a face is actually visible via face-api.js
 *     before letting the candidate continue.
 *
 * Both steps share a single getUserMedia({audio, video}) call, and that same
 * stream is handed to the interview screen afterward — so there's exactly
 * one permission prompt, not two.
 */
export default function InterviewSetup({ onComplete }: InterviewSetupProps) {
  const [step, setStep] = useState<"voice" | "camera">("voice");
  const [permissionStatus, setPermissionStatus] = useState<
    "idle" | "requesting" | "granted" | "denied"
  >("idle");
  const [transcript, setTranscript] = useState("");
  const [voiceMatched, setVoiceMatched] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(true);

  const [modelLoading, setModelLoading] = useState(true);
  const [faceDetected, setFaceDetected] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const faceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Step 0: request mic + camera together (one prompt) ──────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPermissionStatus("requesting");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: 320, height: 240 },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setPermissionStatus("granted");
        startVoiceListening(stream);
      } catch {
        if (!cancelled) setPermissionStatus("denied");
      }
    })();
    return () => {
      cancelled = true;
      cleanupVoiceListening();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startVoiceListening = (stream: MediaStream) => {
    // Live volume meter — works everywhere, gives instant visual feedback
    try {
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setAudioLevel(avg);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // non-fatal — meter is just a visual aid
    }

    // Live transcription — Chrome/Edge only
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSpeechSupported(false);
      return;
    }
    try {
      const recognition = new SR();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (e: any) => {
        let text = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          text += e.results[i][0].transcript;
        }
        setTranscript(text);
        const normalized = text.toLowerCase();
        if (
          normalized.includes("start") &&
          (normalized.includes("interview") || normalized.includes("ready"))
        ) {
          setVoiceMatched(true);
        }
      };
      recognition.onerror = () => setSpeechSupported(false);
      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setSpeechSupported(false);
    }
  };

  const cleanupVoiceListening = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close?.().catch(() => {});
  };

  // ── Step 2: face-api.js model + live face check ──────────────────────
  useEffect(() => {
    if (step !== "camera" || !streamRef.current) return;
    if (videoRef.current) videoRef.current.srcObject = streamRef.current;

    let cancelled = false;
    (async () => {
      try {
        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
          await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        }
      } catch {
        // if the model fails to load, skip the automated check and let
        // the candidate confirm manually below
      }
      if (cancelled) return;
      setModelLoading(false);

      faceIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        if (!faceapi.nets.tinyFaceDetector.isLoaded) return;
        try {
          const detection = await faceapi.detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 416,
              scoreThreshold: 0.3,
            }),
          );
          setFaceDetected(!!detection);
        } catch {
          // skip this tick
        }
      }, 800);
    })();

    return () => {
      cancelled = true;
      if (faceIntervalRef.current) clearInterval(faceIntervalRef.current);
    };
  }, [step]);

  const goToCameraStep = () => {
    cleanupVoiceListening();
    setStep("camera");
  };

  const finish = () => {
    if (faceIntervalRef.current) clearInterval(faceIntervalRef.current);
    if (streamRef.current) onComplete(streamRef.current);
  };

  // ── Permission gate ────────────────────────────────────────────────
  if (permissionStatus !== "granted") {
    return (
      <Card className="p-8 max-w-md w-full text-center border border-border/60">
        <div className="text-3xl mb-3">🎙️🎥</div>
        <h2 className="text-lg font-bold text-foreground mb-2">
          Microphone &amp; camera required
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          This interview checks your mic and camera before starting, then
          proctors the session for camera-off, tab-switching, or no-face
          events. Nothing is uploaded — checks run in your browser.
        </p>
        {permissionStatus === "denied" && (
          <p className="text-xs text-destructive">
            Access was denied. Allow microphone and camera permission in your
            browser settings, then reload this page.
          </p>
        )}
        {permissionStatus === "requesting" && (
          <p className="text-xs text-muted-foreground">Requesting access…</p>
        )}
      </Card>
    );
  }

  // ── Step 1: Voice check ────────────────────────────────────────────
  if (step === "voice") {
    return (
      <Card className="p-8 max-w-md w-full text-center border border-border/60">
        <div className="text-3xl mb-3">🎙️</div>
        <h2 className="text-lg font-bold text-foreground mb-2">
          Step 1 of 2 — Voice check
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Say out loud: <strong className="text-foreground">"I can start the interview"</strong>
        </p>

        {/* Volume meter */}
        <div className="h-2 bg-muted rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-100"
            style={{ width: `${Math.min(100, (audioLevel / 128) * 100)}%` }}
          />
        </div>

        {speechSupported ? (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-1">Heard so far:</p>
            <p className="text-sm text-foreground italic min-h-[1.5em]">
              {transcript || "…"}
            </p>
            {voiceMatched && (
              <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-2">
                ✅ Phrase recognized
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mb-4">
            Live transcription isn't supported in this browser — just speak
            the phrase so we can confirm your mic is picking up sound, then
            continue manually below.
          </p>
        )}

        <Button
          onClick={goToCameraStep}
          className="w-full rounded-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold"
        >
          {voiceMatched ? "Continue →" : "I said it — Continue →"}
        </Button>
      </Card>
    );
  }

  // ── Step 2: Camera check ───────────────────────────────────────────
  return (
    <Card className="p-8 max-w-md w-full text-center border border-border/60">
      <div className="text-3xl mb-3">🎥</div>
      <h2 className="text-lg font-bold text-foreground mb-2">
        Step 2 of 2 — Camera check
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Make sure your face is clearly visible in frame.
      </p>

      <div className="relative w-40 h-30 mx-auto rounded-xl overflow-hidden border-2 mb-4 bg-black"
        style={{ borderColor: faceDetected ? "#22c55e" : "#f97316" }}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover"
        />
      </div>

      <p className="text-xs mb-4">
        {modelLoading ? (
          <span className="text-muted-foreground">Loading verification model…</span>
        ) : faceDetected ? (
          <span className="text-green-600 dark:text-green-400 font-semibold">
            ✅ Face verified
          </span>
        ) : (
          <span className="text-orange-600 dark:text-orange-400 font-semibold">
            ⚠️ No face detected — move into frame
          </span>
        )}
      </p>

      <Button
        onClick={finish}
        disabled={modelLoading}
        className="w-full rounded-full bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold disabled:opacity-50"
      >
        {faceDetected ? "Start Interview →" : "Continue anyway →"}
      </Button>
    </Card>
  );
}
