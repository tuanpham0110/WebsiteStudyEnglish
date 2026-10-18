import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Alert } from '@/components/ui/feedback';
import { supabase } from '@/lib/supabase';
import { AuthShell, authErrorMessage } from './AuthShell';

const schema = z.object({ email: z.email('Email không hợp lệ.') });

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({ resolver: zodResolver(schema) });

  const onSubmit = async ({ email }: { email: string }) => {
    setError(null);
    const { error: err } = await supabase!.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    // Same message whether or not the email exists, to avoid account enumeration.
    if (err && !err.message.toLowerCase().includes('not found')) return setError(authErrorMessage(err.message));
    setSent(true);
  };

  return (
    <AuthShell
      title="Quên mật khẩu"
      description="Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Quay lại đăng nhập
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success" title="Đã gửi yêu cầu">
          Nếu email tồn tại trong hệ thống, bạn sẽ nhận được liên kết đặt lại mật khẩu trong vài phút.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Email" error={formState.errors.email?.message}>
            {(p) => <Input {...p} type="email" autoComplete="email" {...register('email')} />}
          </Field>
          <Button type="submit" className="w-full" loading={formState.isSubmitting}>
            Gửi liên kết
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
