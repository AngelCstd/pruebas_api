import { Inject, Injectable } from '@nestjs/common';
import { SearchDestinationsDto } from '../domain/dtos/query-destinations.dto';
import { DestinationItem } from '../domain/models/destination.model';
import {
  DESTINATION_REPOSITORY,
  IDestinationRepository,
} from '../repositories/destination.repository.interface';

@Injectable()
export class DestinationService {
  public constructor(
    @Inject(DESTINATION_REPOSITORY)
    private readonly destinationRepository: IDestinationRepository,
  ) {}

  public search(query: SearchDestinationsDto): Promise<readonly DestinationItem[]> {
    return this.destinationRepository.search(query);
  }
}
