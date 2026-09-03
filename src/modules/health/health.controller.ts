import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  readonly status: 'ok';
  readonly service: string;
  readonly timestamp: string;
  readonly uptimeSeconds: number;
}

interface ProviderStatus {
  readonly provider: 'mock' | 'nemo';
  readonly mode: 'offline' | 'external';
  readonly enabled: boolean;
  readonly ready: boolean;
  readonly configured: boolean;
  readonly message: string;
}

@Controller()
export class HealthController {
  @Get('health')
  public health(): HealthResponse {
    return {
      status: 'ok',
      service: 'hotel-provider-service',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get('providers/status')
  public providersStatus(): { readonly providers: readonly ProviderStatus[] } {
    const nemoConfigured = Boolean(process.env.NEMO_AUTH_TOKEN?.trim());
    const nemoEnabled = process.env.NEMO_ENABLED?.trim().toLowerCase() === 'true';
    return {
      providers: [
        {
          provider: 'mock',
          mode: 'offline',
          enabled: true,
          ready: true,
          configured: true,
          message: 'Available locally without credentials or external requests.',
        },
        {
          provider: 'nemo',
          mode: 'external',
          enabled: nemoEnabled,
          ready: false,
          configured: nemoConfigured,
          message: 'Not tested or called by this endpoint; use mock endpoints until credentials are available.',
        },
      ],
    };
  }
}
