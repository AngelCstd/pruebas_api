export enum ProviderType {
  MOCK = 'mock',
  NEMO = 'nemo',
  /** Hoteles con convenio, leídos del catálogo propio (tabla hotel_catalog_v en Supabase). */
  CONVENIO = 'convenio',
  /** Búsqueda combinada: proveedor externo (mock o Nemo) + convenio. */
  ALL = 'all',
}
