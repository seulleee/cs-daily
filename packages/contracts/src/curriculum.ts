import { z } from 'zod';

export const TrackSummary = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  unitCount: z.number().int(),
  lessonCount: z.number().int(),
});
export type TrackSummary = z.infer<typeof TrackSummary>;

export const LessonStatus = z.enum(['locked', 'available', 'completed']);
export type LessonStatus = z.infer<typeof LessonStatus>;

export const PathLesson = z.object({
  id: z.number().int(),
  name: z.string(),
  sortOrder: z.number().int(),
  status: LessonStatus,
  bestScore: z.number().int().min(0).max(100),
  questionCount: z.number().int(),
});

export const PathUnit = z.object({
  id: z.number().int(),
  name: z.string(),
  sortOrder: z.number().int(),
  lessons: z.array(PathLesson),
});

/** GET /me/path?track=slug */
export const PathResponse = z.object({
  track: TrackSummary,
  units: z.array(PathUnit),
  /** 경로상 다음에 풀 레슨 (없으면 트랙 완료) */
  nextLessonId: z.number().int().nullable(),
});
export type PathResponse = z.infer<typeof PathResponse>;

/** PUT /me/tracks */
export const SetTracksRequest = z.object({
  trackIds: z.array(z.number().int()).min(1).max(12),
});

/** 콘텐츠 패키지의 curriculum.json 스키마 */
export const CurriculumFile = z.object({
  tracks: z.array(
    z.object({
      slug: z.string().regex(/^[a-z-]+$/),
      name: z.string(),
      description: z.string(),
      phase: z.enum(['mvp', 'phase2', 'phase3']),
      units: z.array(
        z.object({
          slug: z.string().regex(/^u\d{2}-[a-z0-9-]+$/),
          name: z.string(),
          lessons: z.array(
            z.object({
              slug: z.string().regex(/^l\d{2}$/),
              name: z.string(),
              /** 학습 목표 1줄 */
              objective: z.string(),
              /** 핵심 정리 2~4줄 — "용어 — 한 줄 정의". 선택 필드(없으면 시작 카드에 목표만 표시) */
              keyPoints: z.array(z.string().min(1).max(80)).max(4).default([]),
            }),
          ).min(1),
        }),
      ).min(1),
    }),
  ),
});
export type CurriculumFile = z.infer<typeof CurriculumFile>;
