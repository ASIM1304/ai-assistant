const { z, objectId } = require("../utils/validate");
const { EVENT_TYPES } = require("../models/SecurityEvent");

const email = z.string().trim().toLowerCase().email().max(254);
const diff = z.enum(["easy", "medium", "hard"]);
const short = (n) => z.string().trim().max(n);

module.exports = {
  auth: {
    register: z.object({ name: z.string().trim().min(2).max(100), email, password: z.string().min(1).max(200) }).strict(),
    login: z.object({ email, password: z.string().min(1).max(200) }).strict(),
    token: z.object({ token: z.string().min(20).max(200) }).strict(),
    emailOnly: z.object({ email }).strict(),
    reset: z.object({ token: z.string().min(20).max(200), password: z.string().min(1).max(200) }).strict(),
    change: z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200) }).strict(),
  },
  profile: z
    .object({
      name: z.string().trim().min(2).max(100),
      phone: z.string().trim().max(30).regex(/^[0-9+()\-.\s]*$/, "Invalid phone number"),
      education: z.array(z.object({ degree: short(120).optional(), institution: short(120).optional(), year: z.number().int().min(1950).max(2100).optional() }).strict()).max(10),
      skills: z.array(z.string().trim().min(1).max(60)).max(30),
      experience: z.array(z.object({ title: short(120).optional(), company: short(120).optional(), years: z.number().min(0).max(60).optional(), summary: short(500).optional() }).strict()).max(15),
      selectedJobRole: short(80),
    })
    .partial()
    .strict(),
  deleteAccount: z.object({ password: z.string().min(1).max(200) }).strict(),
  interview: {
    create: z
      .object({
        jobRole: z.string().trim().min(1).max(80),
        interviewType: z.enum(["technical", "behavioral", "hr", "resume", "job_description"]).optional(),
        jobDescription: z.string().trim().max(6000).optional(),
        totalQuestions: z.number().int().min(1).max(40).optional(),
        durationMinutes: z.number().int().min(1).max(480).optional(),
        startDifficulty: z.enum(["easy", "medium", "hard"]).optional(),
      })
      .strict(),
    consent: z
      .object({
        privacyVersion: z.string().max(40),
        privacyAccepted: z.boolean(),
        identityConfirmed: z.boolean(),
        cameraConsent: z.boolean(),
        microphoneConsent: z.boolean(),
      })
      .strict(),
    start: z.object({ verification: z.object({ faceDetected: z.boolean().optional(), voiceChecked: z.boolean().optional() }).strict().default({}) }).strict().default({ verification: {} }),
    answer: z.object({ questionId: objectId, answer: z.string().max(10000) }).strict(),
    skip: z.object({ questionId: objectId }).strict(),
    event: z
      .object({
        eventType: z.enum(EVENT_TYPES),
        durationSeconds: z.number().min(0).max(3600).optional(),
        note: z.string().max(200).optional(),
        clientTimestamp: z.string().datetime().optional(),
      })
      .strict(),
    empty: z.object({}).strict(),
  },
  admin: {
    listQuery: z.object({ page: z.coerce.number().int().min(1).max(10000).optional(), search: z.string().trim().max(100).optional(), status: z.enum(["scheduled", "ready", "in_progress", "completed", "terminated", "abandoned", "expired"]).optional(), flagged: z.enum(["true"]).optional() }).strict(),
    active: z.object({ isActive: z.boolean() }).strict(),
    review: z.object({ decision: z.enum(["cleared", "concern_confirmed"]), notes: z.string().max(1000).optional() }).strict(),
    schedule: z.object({ candidateId: objectId, jobRole: z.string().trim().min(1).max(80), scheduledFor: z.string().datetime().optional() }).strict(),
    role: z.object({ label: z.string().trim().min(2).max(80), description: short(300).optional(), categories: z.array(z.string().trim().min(1).max(60)).max(20).optional(), active: z.boolean().optional(), sortOrder: z.number().int().min(0).max(1000).optional() }).strict(),
    category: z.object({ name: z.string().trim().min(2).max(60), description: short(300).optional(), active: z.boolean().optional() }).strict(),
    settings: z
      .object({
        interview: z
          .object({
            totalQuestions: z.number().int().min(1).max(30),
            durationMinutes: z.number().int().min(5).max(240),
            startDifficulty: diff,
            adaptive: z.boolean(),
            minDifficulty: diff,
            maxDifficulty: diff,
            codingQuestionNumbers: z.array(z.number().int().min(1).max(30)).max(10),
            maxSkips: z.number().int().min(0).max(10),
            minAnswerChars: z.number().int().min(0).max(200),
            abandonAfterMinutes: z.number().int().min(5).max(240),
            unstartedExpireHours: z.number().int().min(1).max(720),
            followUps: z.boolean(),
            limits: z.object({ minQuestions: z.number().int().min(1).max(30), maxQuestions: z.number().int().min(1).max(40), minDurationMinutes: z.number().int().min(5).max(240), maxDurationMinutes: z.number().int().min(5).max(480) }).partial().strict(),
          })
          .partial()
          .strict(),
        proctoring: z
          .object({
            enabled: z.boolean(),
            requireCamera: z.boolean(),
            requireMicrophone: z.boolean(),
            requireFullscreen: z.boolean(),
            inactivitySeconds: z.number().int().min(30).max(1800),
            minTabSwitchSeconds: z.number().int().min(0).max(60),
            warningLimits: z.object({ notifyUntil: z.number().int().min(0).max(20), reviewAt: z.number().int().min(1).max(20), terminateAt: z.number().int().min(0).max(50) }).partial().strict(),
            events: z.record(z.enum(EVENT_TYPES), z.object({ enabled: z.boolean(), severity: z.enum(["info", "warning", "critical"]), countsTowardLimit: z.boolean() }).partial().strict()),
          })
          .partial()
          .strict(),
        retention: z
          .object({ interviewDays: z.number().int().min(7).max(3650), resumeDays: z.number().int().min(1).max(3650), auditLogDays: z.number().int().min(30).max(3650), unverifiedAccountDays: z.number().int().min(1).max(365) })
          .partial()
          .strict(),
      })
      .partial()
      .strict(),
  },
};
