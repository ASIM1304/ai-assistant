"use client";

import { useEffect, useRef, useState } from "react";

export type ProctorEvent =
  | "TAB_SWITCH" | "FULLSCREEN_EXIT" | "CAMERA_DISABLED" | "MICROPHONE_DISABLED"
  | "FACE_NOT_DETECTED" | "MULTIPLE_FACES" | "INACTIVITY";

interface Props {
  stream: MediaStream | null;
  /** Event types the server policy wants reported; others are ignored. */
  enabledEvents: string[];
  inactivitySeconds: number;
  requireFullscreen: boolean;
  /** True while the candidate is speaking/dictating, so voice answers aren't "inactivity". */
  voiceActive?: boolean;
  /** Fires on every detected flag. The SERVER decides severity, counting and consequences. */
  onEvent: (type: ProctorEvent, durationSeconds: number, note?: string) => void;
}

const CHECK_MS = 4000;
const MISSES_BEFORE_FLAG = 5; // ~20s without a face
const MODEL_URL = "/models";

/**
 * Browser-side monitoring. Face detection runs locally with face-api.js; no
 * frames or audio ever leave the browser. Reported events are *flags for human
 * review* - lighting, glasses, notifications etc. can all trigger them.
 */
export default function WebcamMonitor({ stream, enabledEvents, inactivitySeconds, requireFullscreen, voiceActive, onEvent }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [faceStatus, setFaceStatus] = useState<"checking" | "ok" | "missing" | "multiple" | "unavailable">("checking");
  const onEventRef = useRef(onEvent);
  const voiceRef = useRef(!!voiceActive);
  const lastActivity = useRef(Date.now());
  onEventRef.current = onEvent;
  voiceRef.current = !!voiceActive;
  const enabled = useRef(new Set(enabledEvents));
  enabled.current = new Set(enabledEvents);

  const emit = (t: ProctorEvent, secs = 0, note?: string) => {
    if (enabled.current.has(t)) onEventRef.current(t, Math.round(secs), note);
  };

  // Attach the stream once.
  useEffect(() => {
    const v = videoRef.current;
    if (v && stream) {
      v.srcObject = stream;
      v.play().catch(() => {});
    }
  }, [stream]);

  // Track end = camera/mic switched off or unplugged.
  useEffect(() => {
    if (!stream) return;
    const cleanups: (() => void)[] = [];
    stream.getVideoTracks().forEach((t) => {
      const h = () => emit("CAMERA_DISABLED");
      t.addEventListener("ended", h);
      cleanups.push(() => t.removeEventListener("ended", h));
    });
    stream.getAudioTracks().forEach((t) => {
      const h = () => emit("MICROPHONE_DISABLED");
      t.addEventListener("ended", h);
      cleanups.push(() => t.removeEventListener("ended", h));
    });
    return () => cleanups.forEach((c) => c());
  }, [stream]);

  // Tab switching (with how long the tab was hidden) + fullscreen exits.
  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt) {
        emit("TAB_SWITCH", (Date.now() - hiddenAt) / 1000);
        hiddenAt = null;
      }
    };
    const onFs = () => {
      if (requireFullscreen && !document.fullscreenElement) emit("FULLSCREEN_EXIT");
    };
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [requireFullscreen]);

  // Long inactivity (keyboard / mouse / touch / voice).
  useEffect(() => {
    const bump = () => (lastActivity.current = Date.now());
    const evs = ["mousemove", "keydown", "pointerdown", "touchstart", "scroll"];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    let flagged = false;
    const id = setInterval(() => {
      if (voiceRef.current) lastActivity.current = Date.now();
      const idle = (Date.now() - lastActivity.current) / 1000;
      if (idle >= inactivitySeconds && !flagged) {
        flagged = true;
        emit("INACTIVITY", idle);
      } else if (idle < inactivitySeconds) flagged = false;
    }, 5000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, bump));
      clearInterval(id);
    };
  }, [inactivitySeconds]);

  // Local face detection.
  useEffect(() => {
    if (!stream) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      try {
        const faceapi = await import("face-api.js");
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        if (cancelled) return;
        let misses = 0;
        let multi = 0;
        let missingSince: number | null = null;
        timer = setInterval(async () => {
          const v = videoRef.current;
          if (!v || v.readyState < 2) return;
          const faces = await faceapi.detectAllFaces(v, new faceapi.TinyFaceDetectorOptions());
          if (faces.length === 1) {
            misses = 0; multi = 0; missingSince = null;
            setFaceStatus("ok");
          } else if (faces.length === 0) {
            multi = 0;
            misses++;
            if (misses === 1) missingSince = Date.now();
            setFaceStatus("missing");
            if (misses === MISSES_BEFORE_FLAG) emit("FACE_NOT_DETECTED", missingSince ? (Date.now() - missingSince) / 1000 : 20);
            if (misses >= MISSES_BEFORE_FLAG) misses = 0; // start a new window after flagging
          } else {
            misses = 0;
            multi++;
            setFaceStatus("multiple");
            if (multi === 2) emit("MULTIPLE_FACES", CHECK_MS / 1000, `${faces.length} faces`);
            if (multi >= 5) multi = 0;
          }
        }, CHECK_MS);
      } catch {
        // Models failed to load: continue without face detection rather than blocking the candidate.
        if (!cancelled) setFaceStatus("unavailable");
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [stream]);

  const label = { checking: "Starting…", ok: "Face detected", missing: "Face not visible", multiple: "More than one face", unavailable: "Camera on (face check unavailable)" }[faceStatus];
  const dot = faceStatus === "ok" ? "bg-green-500" : faceStatus === "checking" || faceStatus === "unavailable" ? "bg-muted-foreground" : "bg-amber-500";

  return (
    <div className="fixed bottom-4 right-4 z-40 w-40 rounded-lg overflow-hidden border border-border bg-card shadow-lg">
      <video ref={videoRef} muted playsInline className="w-full h-24 object-cover bg-black scale-x-[-1]" aria-label="Your camera preview" />
      <div className="flex items-center gap-2 px-2 py-1 text-[11px] text-foreground" role="status" aria-live="polite">
        <span className={`w-2 h-2 rounded-full ${dot}`} aria-hidden />
        {label}
      </div>
      <div className="px-2 pb-1 text-[10px] text-muted-foreground">Not recorded or uploaded</div>
    </div>
  );
}
