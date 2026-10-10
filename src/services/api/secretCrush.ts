import { apiClient } from './client';
import type { NearbyHint, SecretUser } from './secretMessages';
import type { PlanId } from './subscriptions';

export interface CrushSummary {
  /** "N people have a secret crush on you". Never says who. */
  admirers_count: number;
  can_add: boolean;
  plan: PlanId;
  spots: { limit: number; used: number; left: number };
  matches_count: number;
  /** A match this user hasn't seen the celebration for yet. */
  pending_celebration_match_id: string | null;
}

export interface CrushItem {
  user: SecretUser;
  /** `paused`: the plan ended; it can't match until the user re-subscribes. */
  status: 'active' | 'paused' | 'matched';
  added_at: string;
  nearby_hint: NearbyHint | null;
}

export interface CrushMatch {
  id: string;
  user: SecretUser;
  conversation_id: string | null;
  matched_at: string;
  celebrated: boolean;
  nearby_hint: NearbyHint | null;
}

export interface CrushMatchDetail extends CrushMatch {
  me: SecretUser;
}

export interface CrushStatus {
  state: 'none' | 'active' | 'paused' | 'matched';
  match_id: string | null;
  conversation_id: string | null;
}

export type AddCrushResult =
  | { crush: CrushItem; matched: false; match: null }
  | { crush: CrushItem; matched: true; match: CrushMatch | null };

type List<T> = { data: T[]; pagination: { next_cursor: string | null; has_more: boolean } };

export const secretCrushApi = {
  async summary() {
    const { data } = await apiClient.get<CrushSummary>('/secret-crushes/summary');
    return data;
  },
  async list() {
    const { data } = await apiClient.get<List<CrushItem>>('/secret-crushes');
    return data;
  },
  async add(userId: string) {
    const { data } = await apiClient.post<AddCrushResult>('/secret-crushes', {
      user_id: userId,
    });
    return data;
  },
  async remove(userId: string) {
    await apiClient.delete(`/secret-crushes/${userId}`);
  },
  async status(userId: string) {
    const { data } = await apiClient.get<CrushStatus>(`/secret-crushes/status/${userId}`);
    return data;
  },
  async matches() {
    const { data } = await apiClient.get<List<CrushMatch>>('/secret-crushes/matches');
    return data;
  },
  async match(matchId: string) {
    const { data } = await apiClient.get<CrushMatchDetail>(`/secret-crushes/matches/${matchId}`);
    return data;
  },
  async celebrated(matchId: string) {
    await apiClient.post(`/secret-crushes/matches/${matchId}/celebrated`);
  },
};
