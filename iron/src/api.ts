// In dev: empty string → Vite proxy forwards /api → Django, /upload → Socket
// In production: set VITE_API_URL and VITE_SOCKET_URL to the deployed service URLs
const BASE        = import.meta.env.VITE_API_URL    ?? "";
const SOCKET_BASE = import.meta.env.VITE_SOCKET_URL ?? "";

export async function apiGetProfile(token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/api/user/profile/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json();
}

export async function apiSaveProfile(token: string, profile: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${BASE}/api/user/profile/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error('Failed to save profile');
}

export async function apiLogin(email: string, password: string): Promise<{ access: string; refresh: string }> {
  const res = await fetch(`${BASE}/api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: email, password }),
  });
  if (!res.ok) throw new Error("Invalid credentials");
  return res.json();
}

export interface SavePrompt {
  type: 'workout' | 'meal' | 'supplement';
  label: string;
  data: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  save_prompt?: SavePrompt;
}

export async function apiChat(
  message: string,
  profile: Record<string, unknown>,
  history: ChatMessage[],
  token?: string
): Promise<{ reply: string; save_prompt?: SavePrompt }> {
  const res = await fetch(`${BASE}/api/chat/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ message, profile, history }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error ?? 'Chat failed');
  }
  return res.json();
}

export async function apiWorkout(profile: Record<string, unknown>, days?: number): Promise<WorkoutPlan> {
  const res = await fetch(`${BASE}/api/workout/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile, days }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to generate workout plan');
  return data.plan;
}

export interface WorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  muscle: string;
  tip: string;
  how_to: string;
}

export interface WorkoutDay {
  day: string;
  focus: string;
  exercises: WorkoutExercise[];
}

export interface WorkoutPlan {
  plan_name: string;
  frequency: string;
  goal: string;
  days: WorkoutDay[];
}

export async function apiRegister(username: string, email: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/api/user/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(Object.values(err).flat().join(" "));
  }
}

export interface CustomExercise {
  name: string;
  sets: number;
  reps: string;
  rest: string;
  muscle: string;
  notes: string;
}

export interface CustomWorkout {
  id: number;
  name: string;
  description: string;
  exercises: CustomExercise[];
  created_at: string;
}

export async function apiGetCustomWorkouts(token: string): Promise<CustomWorkout[]> {
  const res = await fetch(`${BASE}/api/workouts/custom/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch workouts');
  return res.json();
}

export async function apiCreateCustomWorkout(token: string, workout: Omit<CustomWorkout, 'id' | 'created_at'>): Promise<CustomWorkout> {
  const res = await fetch(`${BASE}/api/workouts/custom/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(workout),
  });
  if (!res.ok) throw new Error('Failed to create workout');
  return res.json();
}

export async function apiDeleteCustomWorkout(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/workouts/custom/${id}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete workout');
}

export async function apiUpdateCustomWorkout(token: string, id: number, workout: Partial<Omit<CustomWorkout, 'id' | 'created_at'>>): Promise<CustomWorkout> {
  const res = await fetch(`${BASE}/api/workouts/custom/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(workout),
  });
  if (!res.ok) throw new Error('Failed to update workout');
  return res.json();
}

export interface CustomMeal {
  id: number;
  name: string;
  description: string;
  kcal: string;
  icon: string;
  recipe_url: string;
  ingredients: string[];
  created_at: string;
}

export async function apiGetCustomMeals(token: string): Promise<CustomMeal[]> {
  const res = await fetch(`${BASE}/api/meals/custom/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch meals');
  return res.json();
}

export async function apiCreateCustomMeal(token: string, meal: Omit<CustomMeal, 'id' | 'created_at'>): Promise<CustomMeal> {
  const res = await fetch(`${BASE}/api/meals/custom/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(meal),
  });
  if (!res.ok) throw new Error('Failed to create meal');
  return res.json();
}

export async function apiUpdateCustomMeal(token: string, id: number, meal: Partial<Omit<CustomMeal, 'id' | 'created_at'>>): Promise<CustomMeal> {
  const res = await fetch(`${BASE}/api/meals/custom/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(meal),
  });
  if (!res.ok) throw new Error('Failed to update meal');
  return res.json();
}

export async function apiDeleteCustomMeal(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/meals/custom/${id}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete meal');
}

export interface UserRecipe {
  id: number;
  title: string;
  url: string;
  created_at: string;
}

export async function apiGetRecipes(token: string): Promise<UserRecipe[]> {
  const res = await fetch(`${BASE}/api/recipes/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch recipes');
  return res.json();
}

export async function apiCreateRecipe(token: string, recipe: { title: string; url: string }): Promise<UserRecipe> {
  const res = await fetch(`${BASE}/api/recipes/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(recipe),
  });
  if (!res.ok) throw new Error('Failed to save recipe');
  return res.json();
}

export async function apiDeleteRecipe(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/recipes/${id}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete recipe');
}

export interface WorkoutVideo {
  id: number;
  title: string;
  url: string;
  created_at: string;
}

export async function apiGetWorkoutVideos(token: string): Promise<WorkoutVideo[]> {
  const res = await fetch(`${BASE}/api/workout-videos/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch videos');
  return res.json();
}

export async function apiCreateWorkoutVideo(token: string, video: { title: string; url: string }): Promise<WorkoutVideo> {
  const res = await fetch(`${BASE}/api/workout-videos/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(video),
  });
  if (!res.ok) throw new Error('Failed to save video');
  return res.json();
}

export async function apiDeleteWorkoutVideo(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/workout-videos/${id}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete video');
}

export interface PublicUser {
  id: number;
  username: string;
  name: string;
  profile_picture?: string;
}

export interface ChatConversation {
  id: number;
  is_group: boolean;
  group_name?: string;
  other_user: PublicUser | null;
  members?: PublicUser[];
  last_message: { content: string; sender_id: number; sender_name?: string; created_at: string } | null;
  unread_count: number;
  updated_at: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  user_ids: number[];
}

export interface DirectMessage {
  id: number;
  sender_id: number;
  sender_name: string;
  sender_profile_picture?: string;
  content: string;
  file_url?: string;
  file_type?: string;   // 'image' | 'video' | 'pdf' | 'file'
  file_name?: string;
  created_at: string;
  reactions?: MessageReaction[];
}

export interface UploadedFile {
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
}

export async function apiUploadFile(file: File): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${SOCKET_BASE}/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Upload failed');
  }
  return res.json();
}

export async function apiSearchUserByEmail(token: string, email: string): Promise<PublicUser> {
  const res = await fetch(`${BASE}/api/users/search/?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'User not found');
  return data;
}

export async function apiGetUserById(token: string, userId: number): Promise<PublicUser> {
  const res = await fetch(`${BASE}/api/users/${userId}/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'User not found');
  return data;
}

export async function apiGetUsers(token: string): Promise<PublicUser[]> {
  const res = await fetch(`${BASE}/api/users/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function apiGetConversations(token: string): Promise<ChatConversation[]> {
  const res = await fetch(`${BASE}/api/conversations/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch conversations');
  return res.json();
}

export async function apiStartConversation(token: string, userId: number): Promise<ChatConversation> {
  const res = await fetch(`${BASE}/api/conversations/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Failed to start conversation');
  }
  return res.json();
}

export async function apiCreateGroup(token: string, name: string, userIds: number[]): Promise<ChatConversation> {
  const res = await fetch(`${BASE}/api/conversations/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, user_ids: userIds }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Failed to create group');
  }
  return res.json();
}

export async function apiGetMessages(token: string, convoId: number): Promise<DirectMessage[]> {
  const res = await fetch(`${BASE}/api/conversations/${convoId}/messages/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch messages');
  return res.json();
}

export interface AIMealItem {
  meal: string;
  icon: string;
  kcal: number | string;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  desc: string;
  servings: string;
  ingredients: string[];
  steps?: string[];
}

export interface AIMealPlan {
  breakfast: AIMealItem[];
  lunch: AIMealItem[];
  dinner: AIMealItem[];
  snacks: AIMealItem[];
}

export async function apiGetAIMealPlan(profile: Record<string, unknown>): Promise<AIMealPlan> {
  const res = await fetch(`${BASE}/api/meals/ai-plan/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Failed to generate meal plan');
  return data.plan;
}

export interface WorkoutSession {
  id: number;
  workout_name: string;
  workout_type: 'ai' | 'custom';
  started_at: string;
  finished_at: string | null;
  duration_min: number | null;
  notes?: string;
}

export async function apiGetSessions(token: string): Promise<WorkoutSession[]> {
  const res = await fetch(`${BASE}/api/sessions/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

export async function apiStartSession(token: string, workout_name: string, workout_type: 'ai' | 'custom'): Promise<WorkoutSession> {
  const res = await fetch(`${BASE}/api/sessions/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ workout_name, workout_type }),
  });
  if (!res.ok) throw new Error('Failed to start session');
  return res.json();
}

export async function apiFinishSession(token: string, id: number, duration_min: number, notes?: string): Promise<WorkoutSession> {
  const res = await fetch(`${BASE}/api/sessions/${id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ finished_at: new Date().toISOString(), duration_min, notes: notes ?? '' }),
  });
  if (!res.ok) throw new Error('Failed to finish session');
  return res.json();
}

export async function apiDeleteSession(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/sessions/${id}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete session');
}

export async function apiRequestPasswordReset(email: string): Promise<void> {
  const res = await fetch(`${BASE}/api/password-reset/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, frontend_url: window.location.origin }),
  });
  if (!res.ok) throw new Error('Request failed');
}

export async function apiConfirmPasswordReset(uid: string, token: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/api/password-reset/confirm/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uid, token, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Reset failed');
}

export async function apiDeleteAccount(token: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/api/account/delete/`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to delete account');
}

export async function apiDeactivateAccount(token: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/api/account/deactivate/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Failed to deactivate account');
}

export async function apiChangePassword(token: string, currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${BASE}/api/password-change/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Password change failed');
}

export async function apiSendMessage(
  token: string,
  convoId: number,
  content: string,
  fileData?: { file_url: string; file_type: string; file_name: string }
): Promise<DirectMessage> {
  const res = await fetch(`${BASE}/api/conversations/${convoId}/messages/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content, ...fileData }),
  });
  if (!res.ok) throw new Error('Failed to send message');
  return res.json();
}

export async function apiDeleteConversation(token: string, convoId: number): Promise<void> {
  const res = await fetch(`${BASE}/api/conversations/${convoId}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete conversation');
}

export async function apiDeleteMessage(token: string, messageId: number): Promise<{ conversation_id: number }> {
  const res = await fetch(`${BASE}/api/messages/${messageId}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete message');
  return res.json();
}

export async function apiToggleReaction(
  token: string,
  messageId: number,
  emoji: string
): Promise<{ message_id: number; reactions: MessageReaction[] }> {
  const res = await fetch(`${BASE}/api/messages/${messageId}/react/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ emoji }),
  });
  if (!res.ok) throw new Error('Failed to toggle reaction');
  return res.json();
}

export interface WeightLog {
  id: number;
  weight: number;
  logged_at: string; // 'YYYY-MM-DD'
}

export async function apiGetWeightLogs(token: string): Promise<WeightLog[]> {
  const res = await fetch(`${BASE}/api/weight-log/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch weight logs');
  return res.json();
}

export async function apiAddWeightLog(token: string, weight: number, logged_at: string): Promise<WeightLog> {
  const res = await fetch(`${BASE}/api/weight-log/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ weight, logged_at }),
  });
  if (!res.ok) throw new Error('Failed to save weight entry');
  return res.json();
}

export async function apiDeleteWeightLog(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/weight-log/${id}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete weight entry');
}

export interface BodyMeasurement {
  id: number;
  chest?: number | null;
  waist?: number | null;
  hips?: number | null;
  arms?: number | null;
  logged_at: string; // 'YYYY-MM-DD'
}

export async function apiGetBodyMeasurements(token: string): Promise<BodyMeasurement[]> {
  const res = await fetch(`${BASE}/api/body-measurements/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch measurements');
  return res.json();
}

export async function apiAddBodyMeasurement(token: string, data: Omit<BodyMeasurement, 'id'>): Promise<BodyMeasurement> {
  const res = await fetch(`${BASE}/api/body-measurements/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save measurement');
  return res.json();
}

export async function apiDeleteBodyMeasurement(token: string, id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/body-measurements/${id}/`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to delete measurement');
}


// ── Exercise Library ─────────────────────────────────────────────────────────

export interface Exercise {
  id: number;
  exercise_id: string;
  name: string;
  body_part: string;
  target: string;
  secondary_muscles: string[];
  equipment: string;
  gif_url: string;
  instructions: string[];
  youtube_video_id: string;
  wger_image_url: string;
}

export interface ExercisePage {
  count: number;
  results: Exercise[];
}

export interface ExerciseMeta {
  body_parts: string[];
  targets: string[];
  equipment: string[];
}

export async function apiGetExercises(
  token: string,
  params: { body_part?: string; target?: string; equipment?: string; search?: string; limit?: number; offset?: number } = {}
): Promise<ExercisePage> {
  const q = new URLSearchParams();
  if (params.body_part) q.set('body_part', params.body_part);
  if (params.target)    q.set('target', params.target);
  if (params.equipment) q.set('equipment', params.equipment);
  if (params.search)    q.set('search', params.search);
  q.set('limit',  String(params.limit  ?? 20));
  q.set('offset', String(params.offset ?? 0));
  const res = await fetch(`${BASE}/api/exercises/?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch exercises');
  return res.json();
}

export async function apiGetExerciseMeta(token: string): Promise<ExerciseMeta> {
  const res = await fetch(`${BASE}/api/exercises/meta/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch exercise metadata');
  return res.json();
}

export async function apiFetchExerciseMedia(token: string, force = false): Promise<void> {
  const res = await fetch(`${BASE}/api/exercises/fetch-media/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ force }),
  });
  if (!res.ok) throw new Error('Failed to start media fetch');
}
