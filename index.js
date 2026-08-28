require("dotenv").config();
const express = require("express");
const axios = require("axios");
const admin = require("firebase-admin");

// ============ CONEXIÓN A FIREBASE ============
const serviceAccountPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  "/etc/secrets/firebase-service-account.json";

admin.initializeApp({
  credential: admin.credential.cert(require(serviceAccountPath)),
});
const db = admin.firestore();

// Config del negocio: el mismo documento que ya usa el panel (solo lectura desde el bot)
const CONFIG_DOC = db.collection("appData").doc("salinas_burger_config");
// Los pedidos que arma el bot viven en su PROPIA colección, para no pisar el guardado del panel
const ORDERS_COL = db.collection("orders_whatsapp");
// Estado de la conversación de cada cliente mientras arma su pedido
const SESSIONS_COL = db.collection("bot_sessions");

// ============ WHATSAPP / META ============
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const DELIVERY_FEE = 3.0; // igual que en la simulación del panel; ajustable a futuro

async function sendWhatsAppText(to, body) {
  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, text: { body } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
  );
}

// ============ EXPRESS APP ============
const app = express();
app.use(express.json());

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado por Meta");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200); // responder rápido a Meta

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message) return;

    const from = message.from; // número del cliente, ej "593999888777"
    const isImage = message.type === "image";
    const text = message.text?.body?.trim() || "";

    console.log(`📩 [${from}] ${isImage ? "(imagen)" : text}`);

    await handleIncomingMessage(from, text, isImage);
  } catch (err) {
    console.error("⚠️ Error procesando el webhook:", err.response?.data || err.message);
  }
});

// ============ LÓGICA DE LA CONVERSACIÓN (REGLAS FIJAS) ============

async function getBusinessConfig() {
  const snap = await CONFIG_DOC.get();
  const data = snap.exists ? snap.data() : {};
  return {
    menuItems: data.menuItems || [],
    botConfig: data.botConfig || {},
    bankHolders: data.bankHolders || [],
  };
}

function formatBankAccountsForChat(holders) {
  if (!holders || holders.length === 0) return "\n(No hay cuentas configuradas)";
  return holders
    .map((h) => `\n- ${h.bank}: ${h.accountNumber} (${h.holderName}, ${h.accountType || "Ahorros"})`)
    .join("");
}

async function getSession(phone) {
  const snap = await SESSIONS_COL.doc(phone).get();
  return snap.exists ? snap.data() : null;
}

async function saveSession(phone, session) {
  await SESSIONS_COL.doc(phone).set(session);
}

async function clearSession(phone) {
  await SESSIONS_COL.doc(phone).delete();
}

async function replyAndLog(phone, session, text) {
  await sendWhatsAppText(phone, text);
  session.chatHistory.push({ sender: "ai", text });
}

function logClient(session, text) {
  session.chatHistory.push({ sender: "client", text });
}

async function handleIncomingMessage(phone, text, isImage) {
  const { menuItems, botConfig, bankHolders } = await getBusinessConfig();
  let session = await getSession(phone);

  // --- Inicio de conversación ---
  if (!session) {
    session = { step: "menu", data: {}, chatHistory: [] };
    logClient(session, text || "(imagen)");
    await replyAndLog(
      phone,
      session,
      botConfig.welcomeMsg || "¡Hola! Bienvenido a Salinas Burger 🍔"
    );

    const burgers = menuItems.filter((i) => i.category === "burger" && i.available);
    if (burgers.length === 0) {
      await replyAndLog(phone, session, "Por ahora no tenemos hamburguesas disponibles, intenta más tarde 🙏");
      await clearSession(phone);
      return;
    }
    const listado = burgers.map((b, i) => `${i + 1}. ${b.name} - $${b.price.toFixed(2)}`).join("\n");
    session.data.burgers = burgers;
    await replyAndLog(phone, session, `Este es nuestro menú de hamburguesas:\n\n${listado}\n\nResponde con el número de la que deseas.`);
    await saveSession(phone, session);
    return;
  }

  logClient(session, text || "(imagen)");

  // --- Paso: eligiendo hamburguesa ---
  if (session.step === "menu") {
    const idx = parseInt(text, 10) - 1;
    const burgers = session.data.burgers || [];
    if (isNaN(idx) || !burgers[idx]) {
      await replyAndLog(phone, session, "No entendí esa opción 🙁 Responde solo con el número de la hamburguesa de la lista.");
      await saveSession(phone, session);
      return;
    }
    session.data.items = [burgers[idx]];
    session.data.foodTotal = burgers[idx].price;
    session.step = "delivery_type";
    await replyAndLog(phone, session, "¿Tu pedido es para *domicilio* o para *retirar en tienda*?\n1. Domicilio\n2. Retirar en tienda");
    await saveSession(phone, session);
    return;
  }

  // --- Paso: domicilio o retiro ---
  if (session.step === "delivery_type") {
    if (text === "1") {
      session.data.deliveryType = "domicilio";
      session.step = "address";
      await replyAndLog(phone, session, "Perfecto, ¿cuál es tu dirección o sector de entrega?");
    } else if (text === "2") {
      session.data.deliveryType = "retiro";
      session.data.deliveryFee = 0;
      session.step = "sides";
      await sendSidesMenu(phone, session, menuItems);
    } else {
      await replyAndLog(phone, session, "Responde 1 para Domicilio o 2 para Retirar en tienda.");
    }
    await saveSession(phone, session);
    return;
  }

  // --- Paso: dirección ---
  if (session.step === "address") {
    session.data.address = text;
    session.data.deliveryFee = DELIVERY_FEE;
    session.step = "sides";
    await sendSidesMenu(phone, session, menuItems);
    await saveSession(phone, session);
    return;
  }

  // --- Paso: adicionales/acompañantes ---
  if (session.step === "sides") {
    const sides = session.data.sidesOptions || [];
    if (text !== "0") {
      const idx = parseInt(text, 10) - 1;
      if (isNaN(idx) || !sides[idx]) {
        await replyAndLog(phone, session, "Responde con el número de la opción, o 0 si no deseas ninguna.");
        await saveSession(phone, session);
        return;
      }
      session.data.items.push(sides[idx]);
      session.data.foodTotal += sides[idx].price;
    }
    session.step = "drink_yn";
    await replyAndLog(phone, session, "¿Deseas agregar una bebida?\n1. Sí\n2. No");
    await saveSession(phone, session);
    return;
  }

  // --- Paso: quiere bebida sí/no ---
  if (session.step === "drink_yn") {
    if (text === "2") {
      session.step = "payment";
      await sendPaymentInfo(phone, session, bankHolders);
    } else if (text === "1") {
      const drinks = menuItems.filter((i) => i.category === "drink" && i.available);
      const capacidades = [...new Set(drinks.map((d) => d.volume || "Personal"))];
      session.data.drinkCapacities = capacidades;
      session.step = "drink_capacity";
      const listado = capacidades.map((c, i) => `${i + 1}. ${c}`).join("\n");
      await replyAndLog(phone, session, `¿Qué presentación prefieres?\n\n${listado}`);
    } else {
      await replyAndLog(phone, session, "Responde 1 para Sí o 2 para No.");
    }
    await saveSession(phone, session);
    return;
  }

  // --- Paso: capacidad de bebida ---
  if (session.step === "drink_capacity") {
    const idx = parseInt(text, 10) - 1;
    const capacidades = session.data.drinkCapacities || [];
    if (isNaN(idx) || !capacidades[idx]) {
      await replyAndLog(phone, session, "Responde con el número de la presentación de la lista.");
      await saveSession(phone, session);
      return;
    }
    const capacidad = capacidades[idx];
    const drinks = menuItems.filter(
      (i) => i.category === "drink" && i.available && (i.volume || "Personal") === capacidad
    );
    session.data.drinkOptions = drinks;
    session.step = "drink_choice";
    const listado = drinks.map((d, i) => `${i + 1}. ${d.name} - $${d.price.toFixed(2)}`).join("\n");
    await replyAndLog(phone, session, `Marcas disponibles en ${capacidad}:\n\n${listado}`);
    await saveSession(phone, session);
    return;
  }

  // --- Paso: elige marca de bebida ---
  if (session.step === "drink_choice") {
    const idx = parseInt(text, 10) - 1;
    const drinks = session.data.drinkOptions || [];
    if (isNaN(idx) || !drinks[idx]) {
      await replyAndLog(phone, session, "Responde con el número de la bebida de la lista.");
      await saveSession(phone, session);
      return;
    }
    session.data.items.push(drinks[idx]);
    session.data.foodTotal += drinks[idx].price;
    session.step = "payment";
    await sendPaymentInfo(phone, session, bankHolders);
    await saveSession(phone, session);
    return;
  }

  // --- Paso: esperando comprobante ---
  if (session.step === "payment") {
    if (!isImage) {
      await replyAndLog(phone, session, "Cuando realices la transferencia, envíame la *foto o captura* del comprobante para confirmar tu pedido 📸");
      await saveSession(phone, session);
      return;
    }
    await finalizeOrder(phone, session);
    await clearSession(phone);
    return;
  }
}

async function sendSidesMenu(phone, session, menuItems) {
  const sides = menuItems.filter((i) => i.category === "other" && i.available);
  session.data.sidesOptions = sides;
  if (sides.length === 0) {
    session.step = "drink_yn";
    await replyAndLog(phone, session, "¿Deseas agregar una bebida?\n1. Sí\n2. No");
    return;
  }
  const listado = sides.map((s, i) => `${i + 1}. ${s.name} - $${s.price.toFixed(2)}`).join("\n");
  await replyAndLog(phone, session, `¿Deseas acompañar tu pedido con algo de esto?\n\n${listado}\n\nResponde con el número, o 0 si no deseas ninguna.`);
}

async function sendPaymentInfo(phone, session, bankHolders) {
  const total = session.data.foodTotal + (session.data.deliveryFee || 0);
  const cuentas = formatBankAccountsForChat(bankHolders);
  let msg = `El total de tu pedido es $${session.data.foodTotal.toFixed(2)}`;
  if (session.data.deliveryFee > 0) {
    msg += ` + $${session.data.deliveryFee.toFixed(2)} de envío = $${total.toFixed(2)}`;
  }
  msg += `\n\nPuedes pagar por transferencia a:${cuentas}\n\nCuando termines, envíame la foto del comprobante para confirmar tu pedido.`;
  await replyAndLog(phone, session, msg);
}

async function finalizeOrder(phone, session) {
  const { items, foodTotal, deliveryFee, address, deliveryType } = session.data;
  session.chatHistory.push({ sender: "client", text: "[Imagen adjunta: Comprobante de Transferencia]" });
  const confirmMsg = "✅ ¡Comprobante recibido! Tu pedido ya fue enviado a cocina. En breve nos comunicamos si es necesario. ¡Gracias por tu compra! 🍔";
  await replyAndLog(phone, session, confirmMsg);

  const itemsSummary = items.map((i) => `1x ${i.name}${i.volume ? ` (${i.volume})` : ""} ($${i.price.toFixed(2)})`).join(", ");

  await ORDERS_COL.add({
    code: `WA-${Date.now()}`,
    client: phone,
    phone,
    sector: deliveryType === "domicilio" ? address : "Retiro en tienda",
    items: itemsSummary,
    foodTotal,
    deliveryFee: deliveryFee || 0,
    status: "process",
    startTime: Date.now(),
    dispatchTime: null,
    estimatedTravelMinutes: 10,
    date: new Date().toISOString().split("T")[0],
    chatHistory: session.chatHistory,
    source: "whatsapp_bot",
  });

  console.log(`✅ Pedido confirmado y guardado para ${phone}`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));
