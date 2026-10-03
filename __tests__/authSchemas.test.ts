import {
  fromIsoDate,
  latestDob,
  loginSchema,
  newPasswordSchema,
  passwordStrength,
  registerSchema,
  toIsoDate,
} from '@/features/auth/schemas';

const validRegister = {
  display_name: 'Jane Doe',
  username: 'Jane.Doe',
  email: ' Jane@Example.com ',
  password: 'secretPass1',
  gender: 'woman' as const,
  dob: '1998-03-15',
  terms: true,
};

describe('auth schemas', () => {
  it('round-trips local dates and rejects impossible ones', () => {
    expect(toIsoDate(new Date(1998, 2, 5))).toBe('1998-03-05');
    expect(fromIsoDate('1998-03-05')?.getDate()).toBe(5);
    expect(fromIsoDate('2000-02-31')).toBeNull();
    expect(fromIsoDate('05/03/1998')).toBeNull();
  });

  it('caps the picker at today', () => {
    const max = latestDob(new Date(2026, 9, 3, 15, 30));
    expect(toIsoDate(max)).toBe('2026-10-03');
    expect(max.getHours()).toBe(0);
  });

  it('normalises a valid registration', () => {
    const out = registerSchema.parse(validRegister);
    expect(out.username).toBe('jane.doe');
    expect(out.email).toBe('jane@example.com');
  });

  it('rejects future birth dates, bad usernames, weak passwords and unaccepted terms', () => {
    const result = registerSchema.safeParse({
      ...validRegister,
      username: 'no spaces!',
      password: 'onlyletters',
      dob: '2999-01-01',
      terms: false,
    });
    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map(i => i.path[0]);
    expect(paths).toEqual(
      expect.arrayContaining(['username', 'password', 'dob', 'terms']),
    );
  });

  it('requires both login fields', () => {
    expect(
      loginSchema.safeParse({ identifier: ' ', password: '' }).success,
    ).toBe(false);
  });

  it('requires matching new passwords', () => {
    const result = newPasswordSchema.safeParse({
      password: 'secretPass1',
      confirm: 'secretPass2',
    });
    expect(result.success).toBe(false);
    expect(result.success ? null : result.error.issues[0].path).toEqual([
      'confirm',
    ]);
  });

  it('scores password strength 0–4', () => {
    expect(passwordStrength('abc')).toBe(0);
    expect(passwordStrength('Secret#Pass1')).toBe(4);
  });
});
