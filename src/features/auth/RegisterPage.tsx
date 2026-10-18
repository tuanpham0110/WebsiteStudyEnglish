import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { Alert } from '@/components/ui/feedback';
import { supabase } from '@/lib/supabase';
import { AuthShell, authErrorMessage } from './AuthShell';
import { passwordSchema } from './schemas';

const schema = z
  .object({
    displayName: z.string().trim().min(1, 'Nhập tên hiển thị.').max(80, 'Tối đa 80 ký tự.'),
    email: z.email('Email không hợp lệ.'),
    password: passwordSchema,
    confirm: z.string(),
    accept: z.boolean().refine((v) => v, 'Bạn cần đồng ý với điều khoản để tiếp tục.'),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'Mật khẩu nhập lại không khớp.' });
type Values = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { accept: false } });

  const onSubmit = async (values: Values) => {
    setError(null);
    const { data, error: err } = await supabase!.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { display_name: values.displayName }, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) return setError(authErrorMessage(err.message));
    if (data.session) navigate('/onboarding', { replace: true });
    else setSentTo(values.email); // email confirmation is enabled in Supabase
  };

  if (sentTo) {
    return (
      <AuthShell title="Kiểm tra hộp thư của bạn">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 rounded-xl bg-primary-soft p-3 text-primary">
            <MailCheck className="h-6 w-6" aria-hidden />
          </div>
          <p className="text-sm text-fg-2">
            Nếu địa chỉ <strong>{sentTo}</strong> hợp lệ, chúng tôi đã gửi một liên kết xác minh. Mở liên kết đó để kích hoạt tài khoản. Nhớ
            kiểm tra cả thư mục Spam.
          </p>
          <Link to="/login" className="mt-6 text-sm font-medium text-primary hover:underline">
            Về trang đăng nhập
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Tạo tài khoản"
      description="Miễn phí, trong giới hạn lượt dùng mỗi ngày."
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Tên hiển thị" error={formState.errors.displayName?.message}>
          {(p) => <Input {...p} autoComplete="nickname" {...register('displayName')} />}
        </Field>
        <Field label="Email" error={formState.errors.email?.message}>
          {(p) => <Input {...p} type="email" autoComplete="email" {...register('email')} />}
        </Field>
        <Field label="Mật khẩu" hint="Ít nhất 8 ký tự, gồm chữ và số." error={formState.errors.password?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('password')} />}
        </Field>
        <Field label="Nhập lại mật khẩu" error={formState.errors.confirm?.message}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" {...register('confirm')} />}
        </Field>
        <div>
          <label className="flex items-start gap-2 text-sm text-fg-2">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--primary)]" {...register('accept')} />
            <span>
              Tôi đồng ý với{' '}
              <Link to="/terms" className="text-primary hover:underline" target="_blank">
                Điều khoản sử dụng
              </Link>{' '}
              và{' '}
              <Link to="/privacy" className="text-primary hover:underline" target="_blank">
                Chính sách quyền riêng tư
              </Link>
              .
            </span>
          </label>
          {formState.errors.accept && (
            <p className="mt-1.5 text-sm text-danger" role="alert">
              {formState.errors.accept.message}
            </p>
          )}
        </div>
        <Button type="submit" className="w-full" loading={formState.isSubmitting}>
          Tạo tài khoản
        </Button>
      </form>
    </AuthShell>
  );
}
