import { BadRequestException, CanActivate, ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { ProviderType } from '../domain/enums/provider.enum';

/** Rechaza proveedores no reservables antes de que Nest valide el cuerpo de la reserva. */
@Injectable()
export class BookingProviderGuard implements CanActivate {
  public canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ readonly query: Record<string, unknown> }>();
    const provider = request.query.provider;
    if (provider === undefined || provider === ProviderType.MOCK) return true;
    if (provider === ProviderType.ALL) {
      throw new BadRequestException('Booking is not available with provider=all; use the provider of the selected rate.');
    }
    if (provider === ProviderType.CONVENIO || provider === ProviderType.NEMO) {
      throw new HttpException({
        statusCode: 501,
        message: `Booking is not enabled for provider=${provider}.`,
        error: 'Not Implemented',
        code: 'BOOKING_NOT_ENABLED',
      }, 501);
    }
    return true;
  }
}
