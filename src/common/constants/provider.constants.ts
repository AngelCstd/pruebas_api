export type SupportedHotelProvider = 'MOCK' | 'NEMO';

export const PROVIDER_MOCK: SupportedHotelProvider = 'MOCK';
export const PROVIDER_NEMO: SupportedHotelProvider = 'NEMO';

export const DEFAULT_PROVIDER: SupportedHotelProvider = PROVIDER_MOCK;

export const VALID_PROVIDERS: readonly SupportedHotelProvider[] = [
  PROVIDER_MOCK,
  PROVIDER_NEMO,
] as const;

export function isSupportedProvider(provider: string): provider is SupportedHotelProvider {
  return VALID_PROVIDERS.includes(provider.toUpperCase() as SupportedHotelProvider);
}
