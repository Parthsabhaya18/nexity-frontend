import { apiClient } from './client';

export interface NearbySettings {
  enabled: boolean;
  bluetooth_enabled: boolean;
  location_enabled: boolean;
  notifications_enabled: boolean;
  timezone: string;
  updated_at: string | null;
  /** False while Nearby is paused for everyone (server switch). */
  feature_available: boolean;
  location_sample_seconds: number;
  location_accuracy_limit_m: number;
}

export type NearbySettingsPatch = Partial<
  Pick<
    NearbySettings,
    'enabled' | 'bluetooth_enabled' | 'location_enabled' | 'notifications_enabled' | 'timezone'
  >
>;

export const nearbyApi = {
  async settings() {
    const { data } = await apiClient.get<NearbySettings>('/nearby/settings');
    return data;
  },
  async update(patch: NearbySettingsPatch) {
    const { data } = await apiClient.patch<NearbySettings>(
      '/nearby/settings',
      patch,
    );
    return data;
  },
  async sendLocation(sample: {
    lat: number;
    lng: number;
    accuracy_m: number;
    captured_at: string;
  }) {
    const { data } = await apiClient.post<{ accepted: boolean }>(
      '/nearby/location',
      sample,
    );
    return data;
  },
  async bleTokens() {
    const { data } = await apiClient.post<{
      items: { eph_id: string; valid_from: string; valid_until: string }[];
    }>('/nearby/ble/tokens');
    return data.items;
  },
  async bleSightings(
    sightings: {
      eph_id: string;
      first_seen_at: string;
      last_seen_at: string;
      count: number;
      rssi_max: number;
    }[],
  ) {
    const { data } = await apiClient.post<{ accepted: number }>('/nearby/ble/sightings', { sightings });
    return data;
  },
  async nearbyUsers() {
    const { data } = await apiClient.get<{
      items: {
        user: { id: string; username: string; display_name: string; avatar_url: string | null };
        follow_state: 'none' | 'pending' | 'accepted';
        is_premium: boolean;
      }[];
      refreshed_at: string;
    }>('/nearby/users');
    return data;
  },
};
