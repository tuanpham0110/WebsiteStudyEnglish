import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { LogOut, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DAILY_MINUTE_OPTIONS, GOAL_INFO, GOALS, LEVEL_INFO, LEVELS, SKILL_INFO, SKILLS, type Goal, type Level, type Skill } from '@shared/constants';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader, PageHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { ChoiceChip, Field, Input, Select } from '@/components/ui/form';
import { Alert, Skeleton } from '@/components/ui/feedback';
import { usePreferences, useProfile, useUpdatePreferences, useUpdateProfile } from '@/hooks/useUserData';
import { api, errorMessage } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { authErrorMessage } from '@/features/auth/AuthShell';
import { passwordSchema } from '@/features/auth/schemas';

const passwordForm = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Mật khẩu nhập lại không khớp.' });

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const profile = useProfile();
  const prefs = usePreferences();
  const updateProfile = useUpdateProfile();
  const updatePrefs = useUpdatePreferences();
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Level>('A2');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [minutes, setMinutes] = useState(15);
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const pw = useForm<z.infer<typeof passwordForm>>({ resolver: zodResolver(passwordForm) });

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.display_name ?? '');
      setLevel(profile.data.level);
    }
  }, [profile.data]);
  useEffect(() => {
    if (prefs.data) {
      setGoals(prefs.data.goals);
      setSkills(prefs.data.focus_skills);
      setMinutes(prefs.data.daily_minutes);
      setLang(prefs.data.explanation_language);
    }
  }, [prefs.data]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const saveProfile = async () => {
    try {
      await updateProfile.mutateAsync({ display_name: name.trim().slice(0, 80) || null, level });
      await updatePrefs.mutateAsync({ goals, focus_skills: skills, daily_minutes: minutes, explanation_language: lang });
      toast.success('Đã lưu hồ sơ.');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await api('/api/account', { method: 'DELETE', body: { confirm: 'DELETE' } });
      await signOut();
      toast.success('Tài khoản và dữ liệu của bạn đã được xóa.');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(false);
    }
  };

  if (profile.isLoading || prefs.isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <PageHeader title="Hồ sơ" description={user?.email ?? undefined} />

      <Card>
        <CardHeader title="Thông tin học tập" />
        <CardBody className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tên hiển thị">{(p) => <Input {...p} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />}</Field>
            <Field label="Trình độ" hint={prefs.data?.placement_level ? `Kết quả kiểm tra đầu vào (ước lượng): ${prefs.data.placement_level}` : undefined}>
              {(p) => (
                <Select {...p} value={level} onChange={(e) => setLevel(e.target.value as Level)}>
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l} — {LEVEL_INFO[l].vi}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Thời gian mỗi ngày">
              {(p) => (
                <Select {...p} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
                  {DAILY_MINUTE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m} phút
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Ngôn ngữ giải thích">
              {(p) => (
                <Select {...p} value={lang} onChange={(e) => setLang(e.target.value as 'vi' | 'en')}>
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                </Select>
              )}
            </Field>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-fg-2">Mục tiêu</p>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <ChoiceChip key={g} selected={goals.includes(g)} onClick={() => setGoals(toggle(goals, g))} className="py-1.5">
                  {GOAL_INFO[g]}
                </ChoiceChip>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-fg-2">Kỹ năng muốn cải thiện</p>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <ChoiceChip key={s} selected={skills.includes(s)} onClick={() => setSkills(toggle(skills, s))} className="py-1.5">
                  {SKILL_INFO[s]}
                </ChoiceChip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void saveProfile()} loading={updateProfile.isPending || updatePrefs.isPending}>
              Lưu thay đổi
            </Button>
            <ButtonLink to="/onboarding" variant="outline">
              Làm lại kiểm tra & kế hoạch
            </ButtonLink>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Đổi mật khẩu" />
        <CardBody>
          <form
            className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            noValidate
            onSubmit={pw.handleSubmit(async ({ password }) => {
              const { error } = await supabase!.auth.updateUser({ password });
              if (error) toast.error(authErrorMessage(error.message));
              else {
                toast.success('Đã đổi mật khẩu.');
                pw.reset();
              }
            })}
          >
            <Field label="Mật khẩu mới" error={pw.formState.errors.password?.message}>
              {(p) => <Input {...p} type="password" autoComplete="new-password" {...pw.register('password')} />}
            </Field>
            <Field label="Nhập lại" error={pw.formState.errors.confirm?.message}>
              {(p) => <Input {...p} type="password" autoComplete="new-password" {...pw.register('confirm')} />}
            </Field>
            <Button type="submit" variant="outline" loading={pw.formState.isSubmitting}>
              Cập nhật
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-fg-2">Đăng xuất khỏi thiết bị này.</p>
          <Button variant="outline" onClick={() => void signOut().then(() => navigate('/', { replace: true }))}>
            <LogOut className="h-4 w-4" aria-hidden /> Đăng xuất
          </Button>
        </CardBody>
      </Card>

      <Card className="border-danger/40">
        <CardHeader title="Xóa tài khoản" icon={<ShieldAlert className="h-5 w-5 text-danger" />} description="Xóa vĩnh viễn hồ sơ, hội thoại, bản ghi luyện nói, từ vựng và tiến độ. Không thể hoàn tác." />
        <CardBody>
          <Button variant="danger" onClick={() => setDeleteOpen(true)}>
            Xóa tài khoản của tôi
          </Button>
        </CardBody>
      </Card>

      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setConfirmText('');
        }}
        title="Xóa tài khoản vĩnh viễn?"
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Hủy
            </Button>
            <Button variant="danger" disabled={confirmText !== 'DELETE'} loading={deleting} onClick={() => void deleteAccount()}>
              Xóa vĩnh viễn
            </Button>
          </>
        }
      >
        <Alert tone="danger" className="mb-4">
          Toàn bộ dữ liệu cá nhân sẽ bị xóa. Nhật ký sử dụng được ẩn danh để giữ thống kê hạn mức hệ thống.
        </Alert>
        <Field label='Gõ "DELETE" để xác nhận'>{(p) => <Input {...p} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />}</Field>
      </Dialog>
    </div>
  );
}
