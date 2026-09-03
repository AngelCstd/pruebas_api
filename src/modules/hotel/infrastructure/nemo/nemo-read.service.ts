import {
  Injectable,
  NotImplementedException,
  ServiceUnavailableException,
} from '@nestjs/common';

@Injectable()
export class NemoReadService {
  public listCatalog(): never {
    this.assertCredentialsAvailable();
    throw new NotImplementedException(
      'Nemo hotel catalog is documented but its adapter has not been added yet.',
    );
  }

  public getHotelDetail(): never {
    this.assertCredentialsAvailable();
    throw new NotImplementedException(
      'Nemo hotel detail is documented but its adapter has not been added yet.',
    );
  }

  public listDestinations(): never {
    // TODO(Nemo Excel): API_DOCUMENTATION.md does not define an operation to list
    // destinations. Confirm the provider Excel specification before implementing it.
    throw new NotImplementedException(
      'Nemo destination listing has not been added because the operation is not present in the available documentation. Review the Nemo Excel documentation.',
    );
  }

  public listRoomTypes(): never {
    // TODO(Nemo Excel): API_DOCUMENTATION.md only shows room types inside search
    // criteria; it does not define a standalone room-type catalog operation.
    throw new NotImplementedException(
      'Nemo room-type listing has not been added because the operation is not present in the available documentation. Review the Nemo Excel documentation.',
    );
  }

  private assertCredentialsAvailable(): void {
    const enabled = process.env.NEMO_ENABLED?.trim().toLowerCase() === 'true';
    const hasToken = Boolean(process.env.NEMO_AUTH_TOKEN?.trim());

    if (!enabled || !hasToken) {
      throw new ServiceUnavailableException(
        'Nemo is disabled or missing credentials. Configure NEMO_ENABLED=true and NEMO_AUTH_TOKEN before using this provider.',
      );
    }
  }
}
