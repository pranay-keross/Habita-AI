import { apiFetch, ApiError } from '../auth/api';
import type {
  AiMoodUpliftResponse,
  CbtChatMessage,
  CbtChatRequest,
  CbtRecommendationResponse,
  CompleteSessionRequest,
  ExerciseCategory,
  MoodCheckInRequest,
  MoodCheckInResponse,
  PageResponse,
  SessionCompletionResponse,
  WellnessExercise,
  WellnessSummaryResponse,
} from './types';

/**
 * Habita AI — Mental Health, CBT Assistant & Wellness Exercises backend API.
 *
 * Every path here was read off the backend's own OpenAPI document
 * (`https://ikon-vpm.keross.com/saheli/v3/api-docs`) and then exercised with a
 * real bearer token, so the shapes below are observed rather than assumed. Two
 * things the Postman folder gets wrong are worth knowing before editing this
 * file (both recorded in `docs/DECISIONS.md` D-058):
 *
 * - Chat history is `GET/DELETE /wellness/cbt/history`, not `/wellness/cbt/chat`.
 *   `/wellness/cbt/chat` is POST-only; any other verb on it 500s.
 * - The check-ins page size parameter is `limit`, not `size`. Sending `size` is
 *   accepted and silently ignored, which reads as "pagination is broken".
 *
 * All fourteen routes were re-verified end-to-end on 2026-08-31; all answer.
 *
 * `API_BASE_URL` already ends in `/api`, so paths start at `/wellness`.
 */

// ---------------------------------------------------------------------------
// 1. Mood check-ins
// ---------------------------------------------------------------------------

/**
 * Logs a mood check-in for the signed-in user.
 * POST /api/wellness/check-ins
 */
export async function createCheckIn(
  data: MoodCheckInRequest,
  token: string,
): Promise<MoodCheckInResponse> {
  return apiFetch<MoodCheckInResponse>('/wellness/check-ins', {
    method: 'POST',
    body: data,
    token,
  });
}

/**
 * One page of the user's check-ins, newest first.
 * GET /api/wellness/check-ins?page={page}&limit={limit}
 */
export async function listCheckIns(
  token: string,
  options?: { page?: number; limit?: number },
): Promise<PageResponse<MoodCheckInResponse>> {
  const page = options?.page ?? 0;
  const limit = options?.limit ?? 10;
  return apiFetch<PageResponse<MoodCheckInResponse>>(
    `/wellness/check-ins?page=${page}&limit=${limit}`,
    { method: 'GET', token },
  );
}

/**
 * A single check-in. Returns null when it no longer exists (backend 404), which
 * is the ordinary outcome after a delete on another device rather than an error.
 * GET /api/wellness/check-ins/{id}
 */
export async function getCheckIn(
  checkInId: string,
  token: string,
): Promise<MoodCheckInResponse | null> {
  try {
    return await apiFetch<MoodCheckInResponse>(`/wellness/check-ins/${checkInId}`, {
      method: 'GET',
      token,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Replaces mood, tags and note on an existing check-in. `loggedAt` is preserved
 * by the backend — an edit does not move the entry in the timeline.
 * PUT /api/wellness/check-ins/{id}
 */
export async function updateCheckIn(
  checkInId: string,
  data: MoodCheckInRequest,
  token: string,
): Promise<MoodCheckInResponse> {
  return apiFetch<MoodCheckInResponse>(`/wellness/check-ins/${checkInId}`, {
    method: 'PUT',
    body: data,
    token,
  });
}

/**
 * Deletes a check-in. Responds 204 with an empty body.
 * DELETE /api/wellness/check-ins/{id}
 */
export async function deleteCheckIn(checkInId: string, token: string): Promise<void> {
  await apiFetch<void>(`/wellness/check-ins/${checkInId}`, { method: 'DELETE', token });
}

// ---------------------------------------------------------------------------
// 2. CBT chat assistant & AI uplift
// ---------------------------------------------------------------------------

/**
 * Sends one message to the CBT assistant and returns its reply.
 * POST /api/wellness/cbt/chat
 *
 * Live and answering (~2s round-trip). It 500'd for every valid message earlier
 * on 2026-08-31 and was fixed server-side the same day (D-058) — callers still
 * fall back to `LocalCbtCoach` on failure, which is what an offline device needs
 * regardless.
 *
 * The reply carries `createdAt: null`; only the rows from `getCbtHistory` are
 * timestamped, so re-read the history rather than rendering this object directly
 * when the timestamp matters.
 */
export async function sendCbtMessage(
  message: string,
  token: string,
): Promise<CbtChatMessage> {
  const body: CbtChatRequest = { message };
  return apiFetch<CbtChatMessage>('/wellness/cbt/chat', {
    method: 'POST',
    body,
    token,
  });
}

/**
 * The full CBT conversation, oldest first.
 * GET /api/wellness/cbt/history
 */
export async function getCbtHistory(token: string): Promise<CbtChatMessage[]> {
  const history = await apiFetch<CbtChatMessage[] | null>('/wellness/cbt/history', {
    method: 'GET',
    token,
  });
  return history ?? [];
}

/**
 * Clears the stored conversation. Responds 204.
 * DELETE /api/wellness/cbt/history
 */
export async function clearCbtHistory(token: string): Promise<void> {
  await apiFetch<void>('/wellness/cbt/history', { method: 'DELETE', token });
}

/**
 * A short AI-generated lift — message, one micro-activity, and an affirmation,
 * chosen against today's logged mood.
 * GET /api/wellness/cbt/uplift
 */
export async function getMoodUplift(token: string): Promise<AiMoodUpliftResponse> {
  return apiFetch<AiMoodUpliftResponse>('/wellness/cbt/uplift', { method: 'GET', token });
}

/**
 * The exercise the backend recommends right now, with the mood it reasoned from.
 * GET /api/wellness/cbt/recommendation
 */
export async function getCbtRecommendation(
  token: string,
): Promise<CbtRecommendationResponse> {
  return apiFetch<CbtRecommendationResponse>('/wellness/cbt/recommendation', {
    method: 'GET',
    token,
  });
}

// ---------------------------------------------------------------------------
// 3. Exercises & session completion
// ---------------------------------------------------------------------------

/**
 * The exercise library, optionally narrowed to one category. An unrecognised
 * category 500s on the backend, so `category` is typed to the enum.
 * GET /api/wellness/exercises[?category={category}]
 */
export async function listExercises(
  token: string,
  category?: ExerciseCategory,
): Promise<WellnessExercise[]> {
  const path = category
    ? `/wellness/exercises?category=${encodeURIComponent(category)}`
    : '/wellness/exercises';
  const exercises = await apiFetch<WellnessExercise[] | null>(path, { method: 'GET', token });
  return exercises ?? [];
}

/**
 * One exercise with its full step list.
 * GET /api/wellness/exercises/{id}
 */
export async function getExercise(
  exerciseId: string,
  token: string,
): Promise<WellnessExercise | null> {
  try {
    return await apiFetch<WellnessExercise>(`/wellness/exercises/${exerciseId}`, {
      method: 'GET',
      token,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return null;
    }
    throw err;
  }
}

/**
 * Records that the user finished a session, which is what feeds the streak and
 * the recommendation engine. `durationMinutes` is how long they actually spent,
 * not the exercise's nominal length.
 * POST /api/wellness/exercises/{id}/complete
 */
export async function completeExerciseSession(
  exerciseId: string,
  durationMinutes: number,
  token: string,
): Promise<SessionCompletionResponse> {
  const body: CompleteSessionRequest = { durationMinutes };
  return apiFetch<SessionCompletionResponse>(`/wellness/exercises/${exerciseId}/complete`, {
    method: 'POST',
    body,
    token,
  });
}

// ---------------------------------------------------------------------------
// 4. Wellness dashboard & analytics
// ---------------------------------------------------------------------------

/**
 * Server-computed today count, 7-day average, day streak, per-day trend, most
 * mentioned tags, and the latest check-in — everything the hero and trend panel
 * render, without the client re-deriving it from a page of entries.
 * GET /api/wellness/summary
 */
export async function getWellnessSummary(token: string): Promise<WellnessSummaryResponse> {
  return apiFetch<WellnessSummaryResponse>('/wellness/summary', { method: 'GET', token });
}

export { ApiError };
