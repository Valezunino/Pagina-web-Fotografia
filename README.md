# Galería Fotográfica

Tienda de fotografías en Next.js para Vercel. La portada organiza el contenido por carpetas de eventos. Desde el panel de administración se pueden crear, editar, ordenar, ocultar o eliminar carpetas vacías y subir fotografías dentro de cada una.

La identidad visual es genérica. Las vistas públicas se protegen con una marca de agua de texto; las vistas previas antiguas se pueden regenerar desde el panel administrativo, carpeta por carpeta, sin modificar los originales ni las compras.

Los clientes pueden agregar fotos de distintos eventos a un carrito, abonarlas juntas con Mercado Pago y descargar cada original sin marca después de validar el pago.

## Servicios

- PostgreSQL mediante Neon.
- Vercel Blob privado para vistas protegidas y originales.
- Mercado Pago Checkout Pro.

## Desarrollo

1. Configurá las variables de entorno necesarias.
2. Ejecutá `npm run db:push`.
3. Ejecutá `npm run dev`.

## Producción

El dominio público se configura desde el proyecto de Vercel.
