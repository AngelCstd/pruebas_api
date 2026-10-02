import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

interface HealthResponse {
  readonly status: 'ok';
  readonly service: string;
  readonly timestamp: string;
  readonly uptimeSeconds: number;
}

interface ProviderStatus {
  readonly provider: 'mock' | 'nemo' | 'convenio' | 'all';
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
    const convenioConfigured = Boolean(
      process.env.SUPABASE_URL?.trim()
      && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    );
    const externalProvider = process.env.HOTEL_EXTERNAL_PROVIDER?.trim().toLowerCase() === 'nemo' ? 'nemo' : 'mock';
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
        {
          provider: 'convenio',
          mode: 'external',
          enabled: true,
          ready: false,
          configured: convenioConfigured,
          message: 'Convenio hotels are read from Supabase (hotel_catalog_v). Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; tenantId is supplied per request. Not called by this endpoint.',
        },
        {
          provider: 'all',
          mode: 'external',
          enabled: true,
          ready: false,
          configured: convenioConfigured,
          message: `Combined search: convenio + ${externalProvider}. A failing source is reported in "sources" and does not break the others.`,
        },
      ],
    };
  }
}
