import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { QueryClientsDto } from '../domain/dtos/query-clients.dto';
import { QueryPersonsDto } from '../domain/dtos/query-persons.dto';
import { ClientCredit, PersonSummary } from '../domain/models/care-reservation.model';
import { CareDirectoryService } from '../services/care-directory.service';

@ApiTags('Care')
@Controller()
export class CareDirectoryController {
  public constructor(private readonly directory: CareDirectoryService) {}

  @Get('clients')
  @ApiOperation({ summary: 'List clients and their available credit' })
  @ApiResponse({ status: 200, description: 'Clients ordered by name.' })
  @ApiResponse({ status: 400, description: 'tenantId is missing or invalid.' })
  @ApiResponse({ status: 503, description: 'Care reservation store unavailable.' })
  public listClients(@Query() dto: QueryClientsDto): Promise<{ readonly items: readonly ClientCredit[] }> {
    return this.directory.listClients(dto.tenantId);
  }

  @Get('persons')
  @ApiOperation({ summary: 'List people linked to a client' })
  @ApiResponse({ status: 200, description: 'People ordered by full name.' })
  @ApiResponse({ status: 400, description: 'Required query parameters are missing or invalid.' })
  @ApiResponse({ status: 503, description: 'Care reservation store unavailable.' })
  public listPersons(@Query() dto: QueryPersonsDto): Promise<{ readonly items: readonly PersonSummary[] }> {
    return this.directory.listPersons(dto.tenantId, dto.organizationId, dto.q, dto.limit ?? 20);
  }
}
