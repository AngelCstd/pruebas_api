-- ============================================================================
-- CONSULTAS PARA SACAR HOTELES Y TARIFAS DE MIA (MySQL) A CSV
-- Solo lectura. Correr en MIA (de preferencia en el ambiente "pruebas" primero).
--
-- POR QUÉ BASE64: los campos de texto libre (comentarios, direcciones, contactos) traen
-- comillas, comas y saltos de línea que los exportadores de CSV no escapan bien, y las filas se
-- parten al importar. Aquí cada campo de texto se exporta como "b64:<texto en base64>", que no
-- tiene comillas, comas ni saltos de línea. La importación (03_import_from_staging.sql) los
-- decodifica sola. Los ids (id_hotel, id_proveedor, id_tarifa) van en claro.
-- Requiere MySQL 5.6 o superior (TO_BASE64).
--
-- Cómo exportar a CSV:
--   * MySQL Workbench: correr la consulta > "Export recordset to an external file" > CSV.
--   * DBeaver: clic derecho en el resultado > Export data > CSV.
--   UTF-8 y con la primera fila de encabezados. Con base64 ya no importa el escape de comillas.
--
-- Los alias (en minúsculas) deben quedar EXACTAMENTE así: son los nombres de columna de
-- stg_mia_hoteles y stg_mia_tarifas en 01_schema.sql.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- CSV 1: hoteles  ->  stg_mia_hoteles   (43 columnas)
--   Une proveedores (type='hotel', id_relacion = id_hotel) para traer los datos de pago al
--   proveedor. Si un hotel tuviera varias filas en proveedores, se toma la de menor id.
-- ----------------------------------------------------------------------------
SELECT
  h.id_hotel AS id_hotel,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.nombre AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS nombre,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.correo AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS correo,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.telefono AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS telefono,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.direccion AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS direccion,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.lat AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS lat,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.lng AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS lng,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.descripcion AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS descripcion,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.calificacion AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS calificacion,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.tipo_hospedaje AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS tipo_hospedaje,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.Estado AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS estado,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.Ciudad_Zona AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS ciudad,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.CodigoPostal AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS codigo_postal,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.Colonia AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS colonia,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.pais AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS pais,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.URLImagenHotel AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS url_imagen_hotel,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.URLImagenHotelQ AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS url_imagen_hotel_q,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.URLImagenHotelQQ AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS url_imagen_hotel_qq,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.Activo AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS activo,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.tipo_negociacion AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS tipo_negociacion,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.vigencia_convenio AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS vigencia_convenio,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.comentario_vigencia AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS comentario_vigencia,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.tipo_pago AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS hotel_tipo_pago,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.disponibilidad_precio AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS disponibilidad_precio,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.contacto_convenio AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS contacto_convenio,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.contacto_recepcion AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS contacto_recepcion,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.comentario_pago AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS comentario_pago,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.DesayunoIncluido AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS desayuno_incluido,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.DesayunoComentarios AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS desayuno_comentarios,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.DesayunoPrecioPorPersona AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS desayuno_precio_por_persona,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.MenoresEdad AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS menores_edad,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.PaxExtraPersona AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS pax_extra_persona,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.mascotas AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS mascotas,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.salones AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS salones,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.Transportacion AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS transportacion,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.TransportacionComentarios AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS transportacion_comentarios,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(h.Comentarios AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS comentarios,
  p.id AS id_proveedor,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(p.tipo_pago AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS proveedor_tipo_pago,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(p.vencimiento_credito AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS vencimiento_credito,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(p.intermediario AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS intermediario,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(p.internacional AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS internacional,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(p.bilingue AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS bilingue
FROM hoteles h
LEFT JOIN (
  SELECT id_relacion, MIN(id) AS id
  FROM proveedores
  WHERE type = 'hotel'
  GROUP BY id_relacion
) pm ON pm.id_relacion = h.id_hotel
LEFT JOIN proveedores p ON p.id = pm.id
ORDER BY h.id_hotel;


-- ----------------------------------------------------------------------------
-- CSV 2: tarifas  ->  stg_mia_tarifas   (11 columnas)
--   Se exportan TODAS (activas e inactivas). La importación elige una por hotel:
--   la activa con id_tarifa más alto.
-- ----------------------------------------------------------------------------
SELECT
  t.id_tarifa AS id_tarifa,
  t.id_hotel AS id_hotel,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(t.precio AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS precio,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(t.costo AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS costo,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(t.incluye_desayuno AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS incluye_desayuno,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(t.precio_desayuno AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS precio_desayuno,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(t.precio_noche_extra AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS precio_noche_extra,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(t.comentario_desayuno AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS comentario_desayuno,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(t.precio_persona_extra AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS precio_persona_extra,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(t.tipo_desayuno AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS tipo_desayuno,
  CONCAT('b64:', REPLACE(REPLACE(TO_BASE64(CONVERT(CAST(t.activa AS CHAR) USING utf8mb4)), CHAR(10), ''), CHAR(13), '')) AS activa
FROM tarifas t
WHERE t.id_hotel IS NOT NULL
ORDER BY t.id_hotel, t.id_tarifa;


-- ============================================================================
-- DIAGNÓSTICO (opcional, solo para conocer los datos antes de migrar; no se exporta)
-- ============================================================================

-- Totales
SELECT
  (SELECT COUNT(*) FROM hoteles)                                         AS hoteles,
  (SELECT COUNT(*) FROM hoteles WHERE Activo = 1)                        AS hoteles_activos,
  (SELECT COUNT(*) FROM hoteles WHERE vigencia_convenio >= CURDATE())    AS con_convenio_vigente,
  (SELECT COUNT(*) FROM tarifas WHERE activa = 1)                        AS tarifas_activas;

-- Hoteles con MÁS de una tarifa activa (nada lo impide en MIA; el import toma la de id más alto)
SELECT id_hotel, COUNT(*) AS tarifas_activas
FROM tarifas
WHERE activa = 1 AND id_hotel IS NOT NULL
GROUP BY id_hotel
HAVING COUNT(*) > 1;

-- Hoteles activos SIN tarifa activa (no aparecerán en la búsqueda porque no tienen precio)
SELECT h.id_hotel, h.nombre
FROM hoteles h
WHERE h.Activo = 1
  AND NOT EXISTS (SELECT 1 FROM tarifas t WHERE t.id_hotel = h.id_hotel AND t.activa = 1);

-- Hoteles sin ciudad (no se podrán buscar por destino)
SELECT id_hotel, nombre, Estado
FROM hoteles
WHERE Ciudad_Zona IS NULL OR TRIM(Ciudad_Zona) = '';

-- Ciudades distintas y cuántos hoteles tiene cada una (sirve para ver cómo vienen escritas)
SELECT Ciudad_Zona AS ciudad, Estado AS estado, COUNT(*) AS hoteles
FROM hoteles
GROUP BY Ciudad_Zona, Estado
ORDER BY hoteles DESC;

-- Hoteles con más de una fila en proveedores (el export toma la de menor id)
SELECT id_relacion, COUNT(*) AS filas
FROM proveedores
WHERE type = 'hotel'
GROUP BY id_relacion
HAVING COUNT(*) > 1;
