import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Alert, FullPageSpinner } from '@/components/ui/feedback';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { AuthShell, authErrorMessage } from './AuthShell';
import { passwordSchema } from './schemas';

const schema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Mật khẩu nhập lại không khớp.' });
type Values = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  if (loading) return <FullPageSpinner />;

  const onSubmit = async ({ password }: Values) => {
    setError(null);
    const { error: err } = await supabase!.auth.updateUser({ password });
    if (err) return setError(authErrorMessage(err.message));
    toast.success('Đã đổi mật khẩu.');
    navigate('/app', { replace: true });
  };

  return (
    <AuthShell title="Đặt lại mật khẩu" description="Chọn mật khẩu mới cho tài khoản của bạn.">
      {!session ? (
        <Alert tone="warning" title="Liên kết không hợp lệ hoặc đã hết hạn">
          Hãy yêu cầu một liên kết mới.{' '}
          <Link to="/forgot-password" className="font-medium text-primary hover:underline">
            Gửi lại liên kết
          </Link>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Mật khẩu mới" hint="Ít nhất 8 ký tự, gồm chữ và số." error={formState.errors.password?.message}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('password')} />}
          </Field>
          <Field label="Nhập lại mật khẩu" error={formState.errors.confirm?.message}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('confirm')} />}
          </Field>
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>
            Lưu mật khẩu mới
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
