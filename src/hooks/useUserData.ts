import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AppConfigResponse } from '@shared/schemas';
import type { ExplanationLanguage, Goal, Level, Skill } from '@shared/constants';
import { api } from '@/lib/api';
import { db, unwrap } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';

export type Profile = {
  id: string;
  display_name: string | null;
  level: Level;
  role: 'user' | 'admin';
  onboarded_at: string | null;
  created_at: string;
};

export type UserSettings = {
  theme: 'system' | 'light' | 'dark';
  auto_correct: boolean;
  show_translation: boolean;
  tts_voice: string | null;
  tts_rate: number;
  speaking_voice: string;
  timezone: string;
};

export type LearningPreferences = {
  goals: Goal[];
  daily_minutes: number;
  explanation_language: ExplanationLanguage;
  focus_skills: Skill[];
  placement_level: Level | null;
  placement_score: number | null;
};

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['profile', user?.id],
    enabled: Boolean(user),
    staleTime: 60_000,
    queryFn: async () =>
      unwrap(
        await db().from('profiles').select('id, display_name, level, role, onboarded_at, created_at').eq('id', user!.id).single(),
      ) as Profile,
  });
}

export function useSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['settings', user?.id],
    enabled: Boolean(user),
    staleTime: 60_000,
    queryFn: async () => {
      const row = unwrap(
        await db()
          .from('user_settings')
          .select('theme, auto_correct, show_translation, tts_voice, tts_rate, speaking_voice, timezone')
          .eq('user_id', user!.id)
          .single(),
      ) as UserSettings;
      return { ...row, tts_rate: Number(row.tts_rate) };
    },
  });
}

export function usePreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['preferences', user?.id],
    enabled: Boolean(user),
    staleTime: 60_000,
    queryFn: async () =>
      unwrap(
        await db()
          .from('learning_preferences')
          .select('goals, daily_minutes, explanation_language, focus_skills, placement_level, placement_score')
          .eq('user_id', user!.id)
          .single(),
      ) as LearningPreferences,
  });
}

export function useUpdateSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<UserSettings>) => {
      unwrap(await db().from('user_settings').update(patch).eq('user_id', user!.id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', user?.id] }),
  });
}

export function useUpdateProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Profile, 'display_name' | 'level' | 'onboarded_at'>>) => {
      unwrap(await db().from('profiles').update(patch).eq('id', user!.id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', user?.id] }),
  });
}

export function useUpdatePreferences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<LearningPreferences>) => {
      unwrap(await db().from('learning_preferences').update(patch).eq('user_id', user!.id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['preferences', user?.id] }),
  });
}

/** Server feature flags, limits and today's usage. */
export function useAppConfig() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['app-config', user?.id],
    enabled: Boolean(user),
    staleTime: 30_000,
    retry: 1,
    queryFn: () => api<AppConfigResponse>('/api/config'),
  });
}

/** Learner defaults used by AI features (level + explanation language). */
export function useLearnerContext() {
  const profile = useProfile();
  const prefs = usePreferences();
  const settings = useSettings();
  return {
    level: (profile.data?.level ?? 'A2') as Level,
    explanationLanguage: (prefs.data?.explanation_language ?? 'vi') as ExplanationLanguage,
    autoCorrect: settings.data?.auto_correct ?? true,
    showTranslation: settings.data?.show_translation ?? false,
    ttsVoice: settings.data?.tts_voice ?? null,
    ttsRate: settings.data?.tts_rate ?? 1,
    speakingVoice: settings.data?.speaking_voice ?? 'Kore',
    timezone: settings.data?.timezone ?? 'Asia/Ho_Chi_Minh',
    dailyMinutes: prefs.data?.daily_minutes ?? 15,
    loading: profile.isLoading || prefs.isLoading || settings.isLoading,
  };
}
