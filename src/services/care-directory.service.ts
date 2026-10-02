import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ClientCredit, PersonSummary } from '../domain/models/care-reservation.model';
import {
  CARE_RESERVATION_REPOSITORY,
  ICareReservationRepository,
} from '../repositories/care-reservation.repository.interface';

@Injectable()
export class CareDirectoryService {
  public constructor(
    @Inject(CARE_RESERVATION_REPOSITORY) private readonly care: ICareReservationRepository,
  ) {}

  public async listClients(tenantId?: string): Promise<{ readonly items: readonly ClientCredit[] }> {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    return { items: await this.care.listClients(tenantId) };
  }

  public async listPersons(
    tenantId: string | undefined,
    organizationId: string | undefined,
    q?: string,
    limit = 20,
  ): Promise<{ readonly items: readonly PersonSummary[] }> {
    if (!tenantId) throw new BadRequestException('tenantId is required');
    if (!organizationId) throw new BadRequestException('organizationId is required');
    return { items: await this.care.listPersons(tenantId, organizationId, q, limit) };
  }
}
