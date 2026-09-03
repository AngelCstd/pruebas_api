# Hotel Provider Service

API NestJS para consultar información hotelera mediante un proveedor mock local y preparar la futura integración con Nemo Price Navigator.

## Estado actual

- Las consultas GET usan `provider=mock` por defecto y no modifican datos.
- Nemo permanece deshabilitado y ninguna consulta GET realiza llamadas externas.
- Las operaciones Nemo documentadas responden `503` sin credenciales y `501` mientras su adaptador siga pendiente.
- Las operaciones no encontradas en la documentación disponible responden `501` e indican revisar el Excel del proveedor.

## Inicio rápido

```powershell
npm.cmd install
npm.cmd run start:dev
```

El servicio queda disponible en `http://localhost:3000` salvo que se configure otro `PORT`.

## Endpoints de consulta

| Método | Endpoint | Descripción |
| --- | --- | --- |
| `GET` | `/health` | Salud y tiempo activo del servicio. |
| `GET` | `/providers/status` | Estado de Mock y configuración de Nemo, sin probar conexiones. |
| `GET` | `/hotels/destinations` | Destinos del catálogo mock. |
| `GET` | `/hotels/room-types` | Tipos de habitación disponibles. |
| `GET` | `/hotels/catalog` | Catálogo con filtros opcionales. |
| `GET` | `/hotels/catalog/:hotelCode` | Detalle de un hotel. |

Ejemplo:

```powershell
curl.exe "http://localhost:3000/hotels/catalog?provider=mock&destinationId=2262&minRating=4"
```

Consulte `API_CONTRACT.md` para parámetros, respuestas y errores.

## Documentación

- `API_CONTRACT.md`: contrato vigente de la API HTTP de este repositorio.
- `API_DOCUMENTATION.md`: especificación de referencia del proveedor Nemo.
- `ARCHITECTURE.md`: arquitectura objetivo y estado de implementación.
- `HANDOFF.md`: decisiones y entrega técnica.
- `PROGRESS.md`: trabajo completado, verificaciones y pendientes.

## Configuración de Nemo

Nemo debe permanecer apagado hasta contar con credenciales válidas:

```dotenv
NEMO_ENABLED=false
NEMO_BASE_URL=https://service-cert.psurfer.net/pricesurfer
NEMO_AUTH_TOKEN=
```

No almacene tokens reales en Git.
