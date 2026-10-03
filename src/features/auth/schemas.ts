import { z } from 'zod';

export const MIN_AGE = 18;

export const emailField = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .email('Enter a valid email address.')
  .transform(v => v.toLowerCase());

export const passwordField = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .max(128, 'Use at most 128 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one number.');

export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local calendar date → `YYYY-MM-DD` (pickers return local dates; never use toISOString here). */
export function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

/** `YYYY-MM-DD` → local Date at midnight, or null if it isn't a real date. */
export function fromIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  const date = new Date(y, mo, d);
  return date.getFullYear() === y &&
    date.getMonth() === mo &&
    date.getDate() === d
    ? date
    : null;
}

/** Latest birth date allowed for someone `MIN_AGE` today. */
export function latestAllowedDob(today = new Date()) {
  return new Date(
    today.getFullYear() - MIN_AGE,
    today.getMonth(),
    today.getDate(),
  );
}

export const EARLIEST_DOB = new Date(1900, 0, 1);

export function ageFrom(isoDate: string, today = new Date()) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  let age = today.getUTCFullYear() - d.getUTCFullYear();
  const m = today.getUTCMonth() - d.getUTCMonth();
  if (m < 0 || (m === 0 && today.getUTCDate() < d.getUTCDate())) age--;
  return age;
}

/** 0–4: length, upper + lower, digit, symbol. */
export function passwordStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Enter your email or username.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const registerSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, 'Please enter your name.')
    .max(50, 'Use at most 50 characters.'),
  username: z
    .string()
    .trim()
    .transform(v => v.toLowerCase())
    .refine(
      v => USERNAME_PATTERN.test(v),
      'Use 3–30 lowercase letters, numbers, dots or underscores.',
    ),
  email: emailField,
  password: passwordField,
  gender: z.enum(['woman', 'man', 'non_binary', 'prefer_not_to_say'], {
    errorMap: () => ({ message: 'Please choose an option.' }),
  }),
  dob: z
    .string()
    .min(1, 'Please select your date of birth.')
    .refine(v => fromIsoDate(v) !== null, 'Please select a valid date.')
    .refine(
      v => fromIsoDate(v) !== null && ageFrom(v) >= MIN_AGE,
      `You must be ${MIN_AGE} or older to use Nexity.`,
    ),
  terms: z
    .boolean()
    .refine(v => v, 'Please accept the Terms and Privacy Policy.'),
});

export const forgotSchema = z.object({ email: emailField });

export const newPasswordSchema = z
  .object({
    password: passwordField,
    confirm: z.string().min(1, 'Type your new password again.'),
  })
  .refine(v => v.password === v.confirm, {
    path: ['confirm'],
    message: 'Passwords don’t match.',
  });

export type LoginForm = z.input<typeof loginSchema>;
export type RegisterFormInput = z.input<typeof registerSchema>;
export type RegisterFormOutput = z.output<typeof registerSchema>;
export type ForgotFormInput = z.input<typeof forgotSchema>;
export type NewPasswordForm = z.input<typeof newPasswordSchema>;
