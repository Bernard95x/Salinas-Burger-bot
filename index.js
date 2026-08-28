require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// 1) Meta llama a esta ruta UNA VEZ para confirmar que el webhook es tuyo.
//    Debe devolver exactamente el "challenge" que Meta envía, si el token coincide.
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado por Meta");
    return res.status(200).send(challenge);
  }
  console.log("❌ Verificación fallida (token no coincide)");
  return res.sendStatus(403);
});

// 2) Meta manda aquí cada mensaje entrante de un cliente.
app.post("/webhook", async (req, res) => {
  // Responder rápido a Meta (si no, reintenta el envío del webhook)
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message) return; // puede ser un evento de "estado" (entregado/leído), lo ignoramos por ahora

    const from = message.from; // número del cliente que escribió
    const texto = message.text?.body || "(mensaje sin texto, ej. imagen o ubicación)";

    console.log(`📩 Mensaje de ${from}: ${texto}`);

    // 3) Responder al cliente (esto SOLO funciona porque él escribió primero,
    //    dentro de la ventana de 24h no hace falta plantilla aprobada).
    await axios.post(
      `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: `¡Hola! Recibimos tu mensaje: "${texto}". Un momento por favor 🍔` },
      },
      { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
    );

    console.log(`✅ Respuesta enviada a ${from}`);
  } catch (err) {
    console.error("⚠️ Error procesando el webhook:", err.response?.data || err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));
