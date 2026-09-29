import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SearchDestinationsDto } from '../domain/dtos/query-destinations.dto';
import { DestinationItem } from '../domain/models/destination.model';
import { DestinationService } from '../services/destination.service';

@ApiTags('Locations')
@Controller('locations')
export class DestinationController {
  public constructor(private readonly destinationService: DestinationService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search destinations (autocomplete)' })
  @ApiResponse({ status: 200, description: 'Matching destinations returned successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid search parameters.' })
  @ApiResponse({ status: 503, description: 'Destination catalog not configured or unavailable.' })
  public search(@Query() query: SearchDestinationsDto): Promise<readonly DestinationItem[]> {
    return this.destinationService.search(query);
  }
}
