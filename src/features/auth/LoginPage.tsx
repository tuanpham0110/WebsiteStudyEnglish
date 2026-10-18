import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Alert } from '@/components/ui/feedback';
import { supabase } from '@/lib/supabase';
import { AuthShell, authErrorMessage } from './AuthShell';

const schema = z.object({
  email: z.email('Email không hợp lệ.'),
  password: z.string().min(1, 'Nhập mật khẩu.'),
});
type Values = z.infer<typeof schema>;

function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    setError(null);
    setUnconfirmed(null);
    const { error: err } = await supabase!.auth.signInWithPassword(values);
    if (err) {
      setError(authErrorMessage(err.message));
      if (err.message.toLowerCase().includes('email not confirmed')) setUnconfirmed(values.email);
      return;
    }
    navigate(safeNext(params.get('next')), { replace: true });
  };

  const resend = async () => {
    if (!unconfirmed) return;
    const { error: err } = await supabase!.auth.resend({
      type: 'signup',
      email: unconfirmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) toast.error(authErrorMessage(err.message));
    else toast.success('Đã gửi lại email xác minh.');
  };

  return (
    <AuthShell
      title="Đăng nhập"
      description="Tiếp tục hành trình học tiếng Anh của bạn."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Đăng ký
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && (
          <Alert
            tone="danger"
            action={
              unconfirmed ? (
                <Button size="sm" variant="outline" onClick={resend}>
                  Gửi lại
                </Button>
              ) : undefined
            }
          >
            {error}
          </Alert>
        )}
        <Field label="Email" error={formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...register('email')} />}
        </Field>
        <Field label="Mật khẩu" error={formState.errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" {...register('password')} />}
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-primary hover:underline">
            Quên mật khẩu?
          </Link>
        </div>
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Đăng nhập
        </Button>
      </form>
    </AuthShell>
  );
}
