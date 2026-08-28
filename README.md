# Bot de WhatsApp — Salinas Burger (con reglas fijas + Firebase)

Este servidor recibe los mensajes de los clientes por WhatsApp, los guía con
un menú por pasos (sin IA), y guarda el pedido confirmado en Firestore para
que aparezca en la app del panel.

## Variables de entorno (Render > Environment)

- `PHONE_NUMBER_ID` = 1328549223667218
- `WHATSAPP_TOKEN` = tu token (regenéralo si quedó expuesto antes)
- `VERIFY_TOKEN` = la palabra que pusiste en Meta como "Identificador de verificación"

## Secret File (Render > Environment > Secret Files)

- Filename: `firebase-service-account.json`
- Contenido: pega ahí el JSON completo de la clave privada que descargaste
  desde Firebase (Configuración del proyecto > Cuentas de servicio > Generar
  nueva clave privada).

## Cómo funciona la conversación

1. Cliente escribe algo por primera vez → el bot manda el mensaje de
   bienvenida (el que configuraste en "Configurar Bot IA" del panel) + el
   listado de hamburguesas disponibles.
2. Cliente responde con un número → domicilio o retiro.
3. Si es domicilio, pide la dirección.
4. Ofrece adicionales (papas, etc.) del menú.
5. Ofrece bebida, y si acepta, primero la presentación (capacidad) y luego
   la marca.
6. Envía el total y los datos bancarios (los que configuraste en el panel).
7. Cuando el cliente manda una FOTO (comprobante), el pedido se confirma y
   se guarda en Firestore, colección `orders_whatsapp`.

## Dónde quedan los pedidos

En la base de datos `salinasburger`, colección `orders_whatsapp` — separada
del documento que usa el botón "Guardar Cambios" del panel, para que no se
pisen entre sí. Hace falta un pequeño cambio en `App.jsx` (ver abajo) para
que esos pedidos aparezcan automáticamente en el panel.

## Importante — lo que NO hace esta primera versión

- No descarga ni valida el comprobante de pago en sí, solo detecta que
  llegó una imagen y confirma el pedido (igual que hace el flujo simulado
  del panel). La verificación real la sigue haciendo el dueño desde la app.
- No envía el PDF del menú (el archivo solo vive en el celular del dueño,
  no en un servidor); en su lugar, el bot arma la lista de precios desde
  los mismos datos del menú.
- No entiende texto libre ("quiero una doble con papas") — el cliente debe
  responder con los números que el bot va mostrando.
