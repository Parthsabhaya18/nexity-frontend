import { apiClient } from './client';

export interface HealthResponse {
  status: 'ok';
  uptime: number;
  timestamp: string;
  environment: string;
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await apiClient.get<HealthResponse>('/health');
  return data;
}
