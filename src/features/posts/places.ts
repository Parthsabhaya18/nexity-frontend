import { LOCATION_MAX } from '@/features/posts/caption';

/** A place offered in the location dropdown before the user types. */
export type SuggestedPlace = {
  name: string;
  area: string;
  latitude: number;
  longitude: number;
};

/** From the API: a name used on posts, or a real place with coordinates. */
export type RemotePlace = {
  name: string;
  post_count?: number;
  area?: string;
  latitude?: number;
  longitude?: number;
};

export type PlaceRow = {
  name: string;
  subtitle: string;
  latitude: number | null;
  longitude: number | null;
  custom?: boolean;
};

/** Shown as soon as Add location opens. Search filters this list. */
export const SUGGESTED_PLACES: SuggestedPlace[] = [
  {
    name: 'Sabarmati Riverfront',
    area: 'Ahmedabad',
    latitude: 23.0426,
    longitude: 72.5714,
  },
  {
    name: 'Law Garden',
    area: 'Ahmedabad',
    latitude: 23.0267,
    longitude: 72.5606,
  },
  {
    name: 'Kankaria Lake',
    area: 'Ahmedabad',
    latitude: 23.0063,
    longitude: 72.6026,
  },
  {
    name: 'Marine Drive',
    area: 'Mumbai',
    latitude: 18.9432,
    longitude: 72.8236,
  },
  {
    name: 'Gateway of India',
    area: 'Mumbai',
    latitude: 18.922,
    longitude: 72.8347,
  },
  { name: 'Juhu Beach', area: 'Mumbai', latitude: 19.0988, longitude: 72.8266 },
  {
    name: 'Connaught Place',
    area: 'New Delhi',
    latitude: 28.6315,
    longitude: 77.2167,
  },
  {
    name: 'India Gate',
    area: 'New Delhi',
    latitude: 28.6129,
    longitude: 77.2295,
  },
  {
    name: 'Lalbagh Botanical Garden',
    area: 'Bengaluru',
    latitude: 12.9507,
    longitude: 77.5848,
  },
  {
    name: 'Cubbon Park',
    area: 'Bengaluru',
    latitude: 12.9763,
    longitude: 77.5929,
  },
  {
    name: 'Charminar',
    area: 'Hyderabad',
    latitude: 17.3616,
    longitude: 78.4747,
  },
  {
    name: 'Marina Beach',
    area: 'Chennai',
    latitude: 13.05,
    longitude: 80.2824,
  },
  { name: 'Ahmedabad', area: 'Gujarat', latitude: 23.0225, longitude: 72.5714 },
  { name: 'Surat', area: 'Gujarat', latitude: 21.1702, longitude: 72.8311 },
  { name: 'Vadodara', area: 'Gujarat', latitude: 22.3072, longitude: 73.1812 },
  { name: 'Mumbai', area: 'Maharashtra', latitude: 19.076, longitude: 72.8777 },
  { name: 'Goa', area: 'India', latitude: 15.2993, longitude: 74.124 },
  { name: 'Jaipur', area: 'Rajasthan', latitude: 26.9124, longitude: 75.7873 },
  { name: 'Udaipur', area: 'Rajasthan', latitude: 24.5854, longitude: 73.7125 },
  {
    name: 'Bengaluru',
    area: 'Karnataka',
    latitude: 12.9716,
    longitude: 77.5946,
  },
];

export function placeLabel(place: SuggestedPlace) {
  return place.area ? `${place.name}, ${place.area}` : place.name;
}

/**
 * Dropdown rows for Add location.
 * An empty query returns the suggested places. A query filters those places,
 * adds names already used on posts and real places from the map search
 * (any village or area), and offers the typed text when nothing local matches.
 */
export function suggestPlaces(
  query: string,
  remote: RemotePlace[] = [],
): PlaceRow[] {
  const typed = query.trim().slice(0, LOCATION_MAX);
  const needle = typed.toLowerCase();
  const local = SUGGESTED_PLACES.filter(place => {
    if (!needle) return true;
    return `${place.name} ${place.area} ${placeLabel(place)}`
      .toLowerCase()
      .includes(needle);
  }).map(place => ({
    name: placeLabel(place).slice(0, LOCATION_MAX),
    subtitle: place.area,
    latitude: place.latitude,
    longitude: place.longitude,
  }));

  const seen = new Set(local.map(row => row.name.toLowerCase()));
  const fromPosts: PlaceRow[] = [];
  const fromMap: PlaceRow[] = [];
  for (const place of remote) {
    const name = place.name.trim().slice(0, LOCATION_MAX);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    const onMap =
      typeof place.latitude === 'number' && typeof place.longitude === 'number';
    if (!onMap && needle && !key.includes(needle)) continue;
    seen.add(key);
    if (onMap) {
      fromMap.push({
        name,
        subtitle: place.area || 'Place',
        latitude: place.latitude!,
        longitude: place.longitude!,
      });
      continue;
    }
    const count = place.post_count ?? 0;
    fromPosts.push({
      name,
      subtitle: count > 0 ? `${count} post${count === 1 ? '' : 's'}` : 'Place',
      latitude: null,
      longitude: null,
    });
  }

  const custom: PlaceRow[] =
    typed && local.length === 0 && fromPosts.length === 0
      ? [
          {
            name: typed,
            subtitle: 'Use this place',
            latitude: null,
            longitude: null,
            custom: true,
          },
        ]
      : [];

  return fromMap.length
    ? [...local, ...fromPosts, ...fromMap, ...custom]
    : [...custom, ...local, ...fromPosts];
}
