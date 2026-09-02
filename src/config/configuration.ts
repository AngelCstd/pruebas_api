import * as dotenv from 'dotenv';
import { AppConfig } from './configuration.interface';

dotenv.config();

function parseProvider(raw: string | undefined): 'MOCK' | 'NEMO' {
  const upper = (raw ?? '').trim().toUpperCase();
  if (upper === 'NEMO') {
    return 'NEMO';
  }
  return 'MOCK';
}

function parseNumber(raw: string | undefined, defaultValue: number): number {
  if (!raw) {
    return defaultValue;
  }
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export function loadConfiguration(): AppConfig {
  return {
    port: parseNumber(process.env.PORT, 3000),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    defaultProvider: parseProvider(process.env.DEFAULT_HOTEL_PROVIDER),
    nemo: {
      apiUrl: process.env.NEMO_API_URL ?? 'https://service-cert.psurfer.net/pricesurfer',
      authToken: process.env.NEMO_AUTH_TOKEN ?? '',
      timeoutMs: parseNumber(process.env.NEMO_TIMEOUT_MS, 15000),
      rateLimitRps: parseNumber(process.env.NEMO_RATE_LIMIT_RPS, 8),
    },
  };
}

export const configuration: AppConfig = loadConfiguration();
