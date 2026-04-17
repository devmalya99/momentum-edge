import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.email('Enter a valid email').transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(64, 'Password is too long'),
});

export const loginSchema = z.object({
  email: z.email('Enter a valid email').transform((v) => v.toLowerCase()),
  password: z.string().min(1, 'Password is required'),
});

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.email().transform((v) => v.toLowerCase()),
    tradingExperience: z.string().trim().max(200).optional(),
    imageUrl: z.url().optional().or(z.literal('')),
    currentPassword: z.string().min(8).optional().or(z.literal('')),
    newPassword: z.string().min(8).max(64).optional().or(z.literal('')),
  })
  .refine(
    (data) => {
      if (data.newPassword && !data.currentPassword) return false;
      return true;
    },
    { path: ['currentPassword'], message: 'Current password is required to set a new password' },
  );

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
