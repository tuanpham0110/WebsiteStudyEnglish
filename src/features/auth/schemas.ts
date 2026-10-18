import { z } from 'zod';

export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu cần ít nhất 8 ký tự.')
  .max(72, 'Mật khẩu tối đa 72 ký tự.')
  .regex(/[A-Za-z]/, 'Mật khẩu cần có chữ cái.')
  .regex(/[0-9]/, 'Mật khẩu cần có chữ số.');
