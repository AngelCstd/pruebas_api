import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

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

interface ProvidersStatusResponse {
  readonly providers: readonly ProviderStatus[];
}

@ApiTags('System')
@Controller()
export class HealthController {
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service health status.' })
  public health(): HealthResponse {
    return {
      status: 'ok',
      service: 'hotel-provider-service',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get('providers/status')
  @ApiOperation({ summary: 'Provider configuration and status' })
  @ApiResponse({ status: 200, description: 'Current status of configured providers.' })
  public providersStatus(): ProvidersStatusResponse {
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
