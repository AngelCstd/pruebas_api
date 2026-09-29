import { DestinationLanguage, SearchDestinationsDto } from '../domain/dtos/query-destinations.dto';
import { DestinationItem } from '../domain/models/destination.model';

/**
 * Token de inyección de dependencias para el repositorio de destinos.
 */
export const DESTINATION_REPOSITORY = Symbol('DESTINATION_REPOSITORY');

export interface IDestinationRepository {
  search(query: SearchDestinationsDto): Promise<readonly DestinationItem[]>;
  findById(destinationId: string, language: DestinationLanguage): Promise<DestinationItem | null>;
}
