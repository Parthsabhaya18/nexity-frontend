import { suggestPlaces } from '../src/features/posts/places';

describe('suggestPlaces', () => {
  it('opens with a dropdown of suggested places', () => {
    const rows = suggestPlaces('');
    expect(rows.length).toBeGreaterThan(5);
    expect(rows.some(row => row.custom)).toBe(false);
    expect(rows.map(row => row.name)).toEqual(
      expect.arrayContaining([
        'Sabarmati Riverfront, Ahmedabad',
        'Marine Drive, Mumbai',
        'Ahmedabad, Gujarat',
      ]),
    );
    expect(rows[0]?.latitude).not.toBeNull();
  });

  it('filters suggestions as the user searches', () => {
    const rows = suggestPlaces('  sabar ');
    expect(rows.map(row => row.name)).toEqual([
      'Sabarmati Riverfront, Ahmedabad',
    ]);
    expect(rows[0]).toMatchObject({
      subtitle: 'Ahmedabad',
      latitude: 23.0426,
      longitude: 72.5714,
    });
  });

  it('matches a city and its venues together', () => {
    const names = suggestPlaces('mumbai').map(row => row.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'Marine Drive, Mumbai',
        'Gateway of India, Mumbai',
        'Mumbai, Maharashtra',
      ]),
    );
    expect(names.some(name => name.includes('Ahmedabad'))).toBe(false);
  });

  it('offers the typed name when it is not already listed', () => {
    const rows = suggestPlaces('My terrace');
    expect(rows[0]).toEqual({
      name: 'My terrace',
      subtitle: 'Use this place',
      latitude: null,
      longitude: null,
      custom: true,
    });
  });

  it('does not duplicate a suggestion that matches the typed name', () => {
    const rows = suggestPlaces('Ahmedabad, Gujarat');
    expect(rows.filter(row => row.custom)).toEqual([]);
    expect(rows.filter(row => row.name === 'Ahmedabad, Gujarat')).toHaveLength(
      1,
    );
  });

  it('adds places from posts without repeating a suggestion', () => {
    const rows = suggestPlaces('beach', [
      { name: 'Secret Beach', post_count: 2 },
      { name: 'Juhu Beach, Mumbai', post_count: 9 },
    ]);
    expect(rows.find(row => row.name === 'Secret Beach')).toMatchObject({
      subtitle: '2 posts',
      latitude: null,
    });
    expect(rows.filter(row => row.name === 'Juhu Beach, Mumbai')).toHaveLength(
      1,
    );
    expect(rows.find(row => row.name === 'Juhu Beach, Mumbai')?.latitude).toBe(
      19.0988,
    );
  });

  it('shows any real place from the map search, like a village', () => {
    const rows = suggestPlaces('hadmatiya', [
      {
        name: 'Hadmatiya, Paddhari Taluka, Gujarat, India',
        post_count: 0,
        area: 'Paddhari Taluka, Gujarat, India',
        latitude: 22.4335,
        longitude: 70.48,
      },
    ]);
    expect(rows[0]).toEqual({
      name: 'Hadmatiya, Paddhari Taluka, Gujarat, India',
      subtitle: 'Paddhari Taluka, Gujarat, India',
      latitude: 22.4335,
      longitude: 70.48,
    });
    expect(rows[rows.length - 1]).toMatchObject({
      name: 'hadmatiya',
      custom: true,
    });
  });

  it('uses a known city name instead of a second custom row', () => {
    const rows = suggestPlaces('goa');
    expect(rows.some(row => row.custom)).toBe(false);
    expect(rows.some(row => row.name === 'Goa, India')).toBe(true);
  });
});
