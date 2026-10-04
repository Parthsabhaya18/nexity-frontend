import {
  displayWebsite,
  profileLink,
  profileSchema,
} from '../src/features/profile/schemas';

const valid = {
  display_name: 'Jane Doe',
  username: 'Jane.Doe',
  bio: '',
  website: '',
  is_private: false,
};

describe('profileSchema', () => {
  it('accepts a normal profile and lowercases the username', () => {
    const res = profileSchema.parse({ ...valid, website: 'jane.dev/links' });
    expect(res.username).toBe('jane.doe');
    expect(res.website).toBe('jane.dev/links');
  });

  it.each(['not a url', 'localhost', ['javascript', 'alert(1)'].join(':')])(
    'rejects the website %s',
    website => {
      expect(profileSchema.safeParse({ ...valid, website }).success).toBe(
        false,
      );
    },
  );

  it('limits the bio to 150 characters', () => {
    expect(
      profileSchema.safeParse({ ...valid, bio: 'x'.repeat(150) }).success,
    ).toBe(true);
    expect(
      profileSchema.safeParse({ ...valid, bio: 'x'.repeat(151) }).success,
    ).toBe(false);
  });
});

describe('profile helpers', () => {
  it('shows websites without the scheme', () => {
    expect(displayWebsite('https://www.jane.dev/')).toBe('jane.dev');
    expect(displayWebsite('http://jane.dev/links')).toBe('jane.dev/links');
  });

  it('builds the public profile link', () => {
    expect(profileLink('jane.doe')).toBe('https://nexity.com/u/jane.doe');
  });
});
