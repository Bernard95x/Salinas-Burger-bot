# Bot de WhatsApp — Salinas Burger

Este servidor conecta tu número de WhatsApp Business (+593 4 249-8947) con
la API de Meta: recibe los mensajes de los clientes y responde automáticamente.

## 1. Instalar dependencias

Necesitas [Node.js](https://nodejs.org) instalado (ya lo tienes, del paso de la APK).

```
cd salinas-bot
npm install
```

## 2. Configurar tus datos

1. Copia `.env.example` y renómbralo a `.env`
2. Pega tu `WHATSAPP_TOKEN` (genera uno nuevo en Meta — regenera el que compartiste antes, quedó expuesto)
3. Deja `VERIFY_TOKEN` como está, o cámbialo por cualquier palabra que quieras (la usarás en el paso 4)

## 3. Encender el servidor

```
npm start
```

Debe mostrar: `Servidor escuchando en http://localhost:3000`

## 4. Exponerlo a internet (para pruebas)

Meta necesita una URL pública (https), no puede llamar a tu `localhost`. Para
pruebas, usa [ngrok](https://ngrok.com/download):

```
ngrok http 3000
```

Te va a dar una URL como `https://algo-random.ngrok-free.app`. Cópiala.

> ⚠️ Cada vez que reinicies ngrok (versión gratis) la URL cambia, y tendrás
> que actualizarla en Meta de nuevo. Cuando quieras dejarlo funcionando de
> forma permanente, hay que subir este servidor a un hosting real (Render,
> Railway, un VPS, etc.) — te ayudo con eso cuando llegues a ese paso.

## 5. Completar la pantalla de Meta (la de tu captura)

- **URL de devolución de llamada**: `https://algo-random.ngrok-free.app/webhook`
  (la URL de ngrok + `/webhook` al final)
- **Identificador de verificación**: el mismo texto que pusiste en `VERIFY_TOKEN`
  dentro de tu `.env` (por defecto: `salinasburger2026`)

Dale click en "Verificar y guardar". Si tu servidor está corriendo, en la
consola vas a ver `✅ Webhook verificado por Meta`.

## 6. Suscribirte al campo "messages"

Justo debajo de esta pantalla en Meta, hay una lista de "campos de webhook"
(messages, message_status, etc.). Activa/suscríbete al menos a **messages** —
si no, aunque el webhook esté verificado, no te van a llegar los mensajes.

## 7. Probar

Desde tu celular personal (agregado antes como número de prueba en Meta),
escríbele algo a tu número de WhatsApp Business. Deberías ver en la consola
del servidor el mensaje recibido, y recibir una respuesta automática en tu
WhatsApp.

## Siguiente paso

Este servidor por ahora responde siempre lo mismo, solo para validar que el
circuito completo funciona. El siguiente paso es reemplazar esa respuesta fija
por la lógica real: leer el menú, tomar el pedido, y guardarlo en la misma
base de datos que usa el panel de administración (App.jsx), para que aparezca
ahí como "pendiente".
