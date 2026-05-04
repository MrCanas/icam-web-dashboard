# Políticas RLS y lectura de `proyectos`

El dashboard usa `NEXT_PUBLIC_SUPABASE_ANON_KEY` en el navegador y en Server Components. Ese rol en PostgREST es **`anon`**.

Si **no** hay política `SELECT` que permita leer `public.proyectos`, la query devuelve **0 filas** (sin error). El chart y las tablas quedarán vacíos hasta corregir RLS.

## Ejemplo (ajustar a vuestro modelo de seguridad)

En el SQL Editor de Supabase, para un portfolio interno protegido por la propia app:

```sql
-- Solo si aceptáis que el rol anon lea el portfolio (la URL del dashboard no es pública).
CREATE POLICY "proyectos_select_anon"
  ON public.proyectos
  FOR SELECT
  TO anon
  USING (true);
```

En producción se suele acotar con `USING (es_ultima_fila = 1)` o restringir columnas; lo crítico es que **exista** al menos un `SELECT` coherente con el anon key.

La escritura por subida de Excel usa **service role** en el servidor y no depende de estas políticas.
