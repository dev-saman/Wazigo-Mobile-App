/**
 * Shared login validation. Client-side rules only reject input the API would
 * certainly refuse - the server stays the authority on whether an account,
 * password or code is valid.
 */
import { z } from 'zod';

import { Config } from '@/constants/config';
import { isValidNationalNumber, toNationalDigits } from '@/utils/phone';

export const ValidationMessages = {
  phone: 'Enter a valid 10-digit mobile number.',
  password: 'Enter your password.',
  code: `Enter the ${Config.otpLength}-digit code.`,
} as const;

const DIGITS_ONLY = /^[0-9]+$/;

/** Accepts what the user sees (`98765 43210`); the screen converts it to E.164. */
const phoneField = z
  .string()
  .refine((value) => isValidNationalNumber(toNationalDigits(value)), { message: ValidationMessages.phone });

/** How the user chose to sign in. Both modes share one form. */
export const LoginModes = ['otp', 'password'] as const;
export type LoginMode = (typeof LoginModes)[number];

/**
 * One schema for both modes so the resolver type stays stable when the user
 * switches. The password is only required in password mode, and has no length
 * rule - an existing password must never be rejected before the API sees it.
 */
export const loginFormSchema = z
  .object({
    phone: phoneField,
    password: z.string(),
    mode: z.enum(LoginModes),
  })
  .refine((values) => values.mode === 'otp' || values.password.length > 0, {
    message: ValidationMessages.password,
    path: ['password'],
  });

/** Login codes are digits only and exactly `Config.otpLength` long. */
export const otpCodeSchema = z
  .string()
  .refine((code) => code.length === Config.otpLength && DIGITS_ONLY.test(code), {
    message: ValidationMessages.code,
  });

export const isCompleteOtpCode = (code: string) => otpCodeSchema.safeParse(code).success;

export type LoginFormValues = z.infer<typeof loginFormSchema>;
