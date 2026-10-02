-- ============================================================================
-- BASE MÍNIMA PARA RESERVAR CON CRÉDITO: cliente demo + agencia vendedora (DATOS INVENTADOS)
-- BORRADOR, NO APLICADO, NO PROBADO. Lo corre el usuario a mano, primero en pruebas.
--
-- Qué crea, en el tenant 'tnt_stg_personal':
--   * 'Agencia Demo (vendedor)'   organización tipo AGENCY: quien COBRA al cliente (la que vende
--                                 y da el crédito). El hotel NO cobra aquí: a él se le paga aparte.
--   * 'Cliente Demo, S.A. de C.V.' organización tipo CLIENT: quien PAGA.
--       - su cuenta de cliente (client_accounts)
--       - su workspace corporativo (el contenedor que Care exige en viajes y servicios)
--       - su cuenta de facturación (billing_accounts): el cargo la exige. NO es facturación fiscal.
--       - su cuenta de crédito (credit_accounts): límite 100,000 MXN
--   * 3 personas inventadas ligadas al cliente, para probar "asignar una persona existente".
--
-- Es reimportable: ids fijos y ON CONFLICT DO NOTHING. Para probar sin guardar, cambia
-- COMMIT por ROLLBACK al final. Si tu tenant no es tnt_stg_personal, reemplázalo en todo el archivo.
-- Solo usa tablas base de Care que ya existen (organizations, client_accounts, workspaces,
-- billing_accounts, credit_accounts, persons...); no depende del 01_schema.sql de esta carpeta.
-- ============================================================================

begin;

-- 1. Organizaciones --------------------------------------------------------------
insert into public.organizations (id, tenant_id, name, kind, status, legal_name, commercial_name) values
  ('org_demo_agencia', 'tnt_stg_personal', 'Agencia Demo (vendedor)', 'AGENCY', 'ACTIVE',
   'Agencia Demo, S.A. de C.V.', 'Agencia Demo'),
  ('org_demo_cliente', 'tnt_stg_personal', 'Cliente Demo, S.A. de C.V.', 'CLIENT', 'ACTIVE',
   'Cliente Demo, S.A. de C.V.', 'Cliente Demo')
on conflict (id) do nothing;

-- 2. Cuenta de cliente y workspace corporativo del cliente --------------------------
insert into public.client_accounts (id, tenant_id, organization_id, name, status) values
  ('cla_demo_cliente', 'tnt_stg_personal', 'org_demo_cliente', 'Cliente Demo, S.A. de C.V.', 'ACTIVE')
on conflict (id) do nothing;

insert into public.workspaces (id, tenant_id, workspace_type, name, organization_id, client_account_id, status) values
  ('wsp_demo_cliente', 'tnt_stg_personal', 'CORPORATE', 'Cliente Demo · Viajes corporativos',
   'org_demo_cliente', 'cla_demo_cliente', 'ACTIVE')
on conflict (id) do nothing;

insert into public.workspace_client_accounts (id, tenant_id, workspace_id, client_account_id, relationship_type, status) values
  ('wca_demo_cliente', 'tnt_stg_personal', 'wsp_demo_cliente', 'cla_demo_cliente', 'OWNS', 'ACTIVE')
on conflict (id) do nothing;

-- 3. Cuenta de facturación (la exige el cargo) y cuenta de crédito -----------------
insert into public.billing_accounts (id, tenant_id, organization_id, currency, billing_terms, payment_terms_days, status) values
  ('bill_demo_cliente', 'tnt_stg_personal', 'org_demo_cliente', 'MXN', 'Crédito corporativo · 30 días', 30, 'ACTIVE')
on conflict (id) do nothing;

insert into public.credit_accounts (id, tenant_id, organization_id, credit_limit, currency, terms, status) values
  ('credit_demo_cliente', 'tnt_stg_personal', 'org_demo_cliente', 100000, 'MXN', '30 días', 'ACTIVE')
on conflict (id) do nothing;

-- 4. Personas inventadas, ligadas al cliente ---------------------------------------
insert into public.persons (id, tenant_id, full_name, email, phone) values
  ('per_demo_ana',   'tnt_stg_personal', 'Ana Torres Méndez',  'ana.torres@clientedemo.example',  '+5215512340001'),
  ('per_demo_luis',  'tnt_stg_personal', 'Luis Herrera Díaz',  'luis.herrera@clientedemo.example', '+5215512340002'),
  ('per_demo_marta', 'tnt_stg_personal', 'Marta Solís Ortega', 'marta.solis@clientedemo.example',  '+5215512340003')
on conflict (id) do nothing;

insert into public.person_organization_links (id, tenant_id, person_id, organization_id, relationship_type) values
  ('pol_demo_ana',   'tnt_stg_personal', 'per_demo_ana',   'org_demo_cliente', 'TRAVELER'),
  ('pol_demo_luis',  'tnt_stg_personal', 'per_demo_luis',  'org_demo_cliente', 'TRAVELER'),
  ('pol_demo_marta', 'tnt_stg_personal', 'per_demo_marta', 'org_demo_cliente', 'TRAVELER')
on conflict (id) do nothing;

-- Verificación (antes del COMMIT) ----------------------------------------------------
select
  (select count(*) from public.organizations where id in ('org_demo_agencia','org_demo_cliente')) as organizaciones,
  (select count(*) from public.client_accounts where id = 'cla_demo_cliente')                      as cuenta_cliente,
  (select count(*) from public.workspaces where id = 'wsp_demo_cliente')                           as workspace,
  (select count(*) from public.billing_accounts where id = 'bill_demo_cliente')                    as facturacion,
  (select count(*) from public.credit_accounts where id = 'credit_demo_cliente')                   as credito,
  (select count(*) from public.persons where id like 'per_demo_%')                                 as personas,
  (select count(*) from public.person_organization_links where id like 'pol_demo_%')               as vinculos;

commit;   -- cambiar por ROLLBACK para probar sin guardar
