export interface NemoConfig {
  readonly apiUrl: string;
  readonly authToken: string;
  readonly timeoutMs: number;
  readonly rateLimitRps: number;
}

export interface AppConfig {
  readonly port: number;
  readonly nodeEnv: string;
  readonly defaultProvider: 'MOCK' | 'NEMO';
  readonly nemo: NemoConfig;
}
