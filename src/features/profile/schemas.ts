import { z } from 'zod';

import { USERNAME_PATTERN } from '@/features/auth/schemas';

/** Instagram's limits; mirror of `backend/src/modules/users/user.model.ts`. */
export const BIO_MAX = 150;
export const WEBSITE_MAX = 200;

const WEBSITE_PATTERN = /^(https?:\/\/)?[^\s/.?#]+(\.[^\s/.?#]+)+([/?#]\S*)?$/i;

export const profileSchema = z.object({
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
  bio: z.string().max(BIO_MAX, `Use at most ${BIO_MAX} characters.`),
  website: z
    .string()
    .trim()
    .max(WEBSITE_MAX, `Use at most ${WEBSITE_MAX} characters.`)
    .refine(
      v => !v || WEBSITE_PATTERN.test(v),
      'Enter a valid website, like example.com.',
    ),
  is_private: z.boolean(),
});

export type ProfileFormInput = z.input<typeof profileSchema>;
export type ProfileFormOutput = z.output<typeof profileSchema>;

/** `https://www.jane.dev/` → `jane.dev` for display. */
export function displayWebsite(url: string) {
  return url
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

export function profileLink(username: string) {
  return `https://nexity.com/u/${username}`;
}
