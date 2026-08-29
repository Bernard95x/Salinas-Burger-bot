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

const MENU_DOC = db.collection("appData").doc("menu");
const CONFIG_DOC = db.collection("appData").doc("config");
const ORDERS_COL = db.collection("pedidos");
const SESSIONS_COL = db.collection("bot_sessions");
const QUOTES_COL = db.collection("cotizaciones_envio"); // pedidos esperando precio de envío del dueño
const APPROVALS_COL = db.collection("aprobaciones_pago"); // comprobantes esperando aprobación del dueño

// ============ WHATSAPP / META ============
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

async function sendWhatsAppText(to, body) {
  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, text: { body } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
  );
}

async function sendWhatsAppDocument(to, link, filename) {
  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, type: "document", document: { link, filename } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
  );
}

// Reenvía una imagen ya recibida (por su media id) a otro número, sin volver a subirla
async function sendWhatsAppImageById(to, mediaId, caption) {
  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, type: "image", image: { id: mediaId, caption } },
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

    const from = message.from;
    const isImage = message.type === "image";
    const isLocation = message.type === "location";
    const mediaId = isImage ? message.image?.id : null;
    const text = message.text?.body?.trim() || "";
    const locationLink = isLocation
      ? `https://www.google.com/maps?q=${message.location.latitude},${message.location.longitude}`
      : null;

    console.log(`📩 [${from}] ${isImage ? "(imagen)" : isLocation ? "(ubicación)" : text}`);

    const { botConfig } = await getBusinessConfig();
    const ownerPhone = normalizePhone(botConfig.ownerPhone);

    if (ownerPhone && normalizePhone(from) === ownerPhone) {
      await handleOwnerReply(text);
    } else {
      await handleIncomingMessage(from, text, isImage, isLocation, locationLink, mediaId);
    }
  } catch (err) {
    console.error("⚠️ Error procesando el webhook:", err.response?.data || err.message);
  }
});

function normalizePhone(p) {
  return (p || "").replace(/\D/g, ""); // deja solo dígitos, para comparar sin importar formato (+593, espacios, etc.)
}

// ============ CONFIGURACIÓN DEL NEGOCIO ============

async function getBusinessConfig() {
  const [menuSnap, configSnap] = await Promise.all([MENU_DOC.get(), CONFIG_DOC.get()]);
  const menuData = menuSnap.exists ? menuSnap.data() : {};
  const configData = configSnap.exists ? configSnap.data() : {};
  return {
    menuItems: menuData.menuItems || [],
    botConfig: { ...(configData.botConfig || {}), ownerPhone: configData.audioSettings?.ownerPhone },
    bankHolders: configData.bankHolders || [],
  };
}

function formatBankAccountsForChat(holders) {
  if (!holders || holders.length === 0) return "\n(No hay cuentas configuradas)";
  return holders
    .flatMap((h) => (h.cuentas || []).map((c) => `\n- ${c.banco}: ${c.numero} (${h.nombre}, ${c.tipo})`))
    .join("");
}

function normalizeText(t) {
  return (t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// Interpreta precios informales: "3 0" -> 3.0, "3,50" -> 3.5, "3" -> 3, "3.5" -> 3.5
function parsePrice(raw) {
  let cleaned = raw.trim().replace(",", ".");
  if (/^\d+\s+\d{1,2}$/.test(cleaned)) cleaned = cleaned.replace(/\s+/, ".");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function randomSuggestions(menuItems, excludeId, count = 2) {
  const disponibles = menuItems.filter(
    (i) => (i.category === "burger" || i.category === "combo") && i.available && i.id !== excludeId
  );
  const shuffled = disponibles.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

// El producto trae una bebida incluida si la palabra "cola" aparece en su nombre o descripción
function itemIncludesDrink(item) {
  return /cola/i.test(`${item.name} ${item.desc || ""}`);
}

function generateCode(prefix = "") {
  return prefix + String(Math.floor(100 + Math.random() * 900)); // 3 dígitos
}

// ============ SESIONES DE CONVERSACIÓN ============

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

// ============ CONVERSACIÓN CON EL CLIENTE ============

async function handleIncomingMessage(phone, text, isImage, isLocation, locationLink, mediaId) {
  const { menuItems, botConfig, bankHolders } = await getBusinessConfig();
  let session = await getSession(phone);
  const entrada = isImage ? "(imagen)" : isLocation ? "(ubicación compartida)" : text;

  // --- Inicio de conversación ---
  if (!session) {
    session = { step: "menu", data: {}, chatHistory: [] };
    logClient(session, entrada);
    await replyAndLog(phone, session, botConfig.welcomeMsg || "¡Hola! Bienvenido a Salinas Burger 🍔");

    if (botConfig.menuPdfUrl) {
      await sendWhatsAppDocument(phone, botConfig.menuPdfUrl, botConfig.menuPdfName || "Menu.pdf");
      session.chatHistory.push({ sender: "ai", text: `📄 [PDF enviado: ${botConfig.menuPdfName || "Menu.pdf"}]` });
    }

    const disponibles = menuItems.filter((i) => (i.category === "burger" || i.category === "combo") && i.available);
    if (disponibles.length === 0) {
      await replyAndLog(phone, session, botConfig.soldOutMsg || "Por ahora no tenemos productos disponibles, intenta más tarde 🙏");
      await clearSession(phone);
      return;
    }
    session.data.opciones = disponibles;
    const listado = disponibles
      .map((b, i) => `${i + 1}. ${b.name}${b.category === "combo" ? " (Combo)" : ""} - $${b.price.toFixed(2)}`)
      .join("\n");
    await replyAndLog(phone, session, `Este es nuestro menú:\n\n${listado}\n\nResponde con el número que deseas.`);
    await saveSession(phone, session);
    return;
  }

  logClient(session, entrada);

  // --- Paso: eligiendo hamburguesa o combo ---
  if (session.step === "menu") {
    const idx = parseInt(text, 10) - 1;
    const opciones = session.data.opciones || [];

    if (!isNaN(idx) && opciones[idx]) {
      await selectMainItem(phone, session, opciones[idx], botConfig);
      await saveSession(phone, session);
      return;
    }

    // No fue un número válido: intenta reconocer el nombre de un producto (aunque esté en pausa)
    const match = menuItems.find(
      (i) => (i.category === "burger" || i.category === "combo") && normalizeText(i.name).includes(normalizeText(text))
    );
    if (match && !match.available) {
      const sugerencias = randomSuggestions(menuItems, match.id);
      const listadoSug = sugerencias.map((s) => `- ${s.name} ($${s.price.toFixed(2)})`).join("\n");
      await replyAndLog(
        phone,
        session,
        `${botConfig.soldOutMsg || `Lo sentimos, "${match.name}" no está disponible por ahora.`}\n\n${
          sugerencias.length ? `Te sugerimos:\n${listadoSug}\n\n` : ""
        }Responde con el número de alguna opción del menú que te mostramos arriba.`
      );
      await saveSession(phone, session);
      return;
    }
    if (match && match.available) {
      const realIdx = opciones.findIndex((o) => o.id === match.id);
      if (realIdx >= 0) {
        await selectMainItem(phone, session, opciones[realIdx], botConfig);
        await saveSession(phone, session);
        return;
      }
    }

    await replyAndLog(phone, session, "No entendí esa opción 🙁 Responde con el número del producto de la lista.");
    await saveSession(phone, session);
    return;
  }

  // --- Paso: cantidad del producto principal ---
  if (session.step === "quantity") {
    const qty = parseInt(text, 10);
    if (isNaN(qty) || qty < 1 || qty > 20) {
      await replyAndLog(phone, session, "Escribe un número válido de unidades (ej. 1, 2, 3...).");
      await saveSession(phone, session);
      return;
    }
    const item = session.data.items[0];
    item.qty = qty;
    session.data.foodTotal = item.price * qty;

    if (itemIncludesDrink(item)) {
      const drinks = menuItems.filter((i) => i.category === "drink" && i.available);
      session.data.comboDrinkOptions = drinks;
      session.step = "combo_drink_flavor";
      const listado = drinks.map((d, i) => `${i + 1}. ${d.name}`).join("\n");
      await replyAndLog(phone, session, `Tu pedido incluye una bebida 🥤 ¿Cuál prefieres?\n\n${listado}`);
      await saveSession(phone, session);
      return;
    }

    await continueAfterMainItem(phone, session, botConfig);
    await saveSession(phone, session);
    return;
  }

  // --- Paso: sabor de la bebida incluida ---
  if (session.step === "combo_drink_flavor") {
    const idx = parseInt(text, 10) - 1;
    const drinks = session.data.comboDrinkOptions || [];
    if (isNaN(idx) || !drinks[idx]) {
      await replyAndLog(phone, session, "Responde con el número de la bebida de la lista.");
      await saveSession(phone, session);
      return;
    }
    session.data.items.push({ ...drinks[idx], price: 0, qty: 1, incluida: true });
    session.data.includesDrink = true;
    await continueAfterMainItem(phone, session, botConfig);
    await saveSession(phone, session);
    return;
  }

  // --- Paso: domicilio o retiro ---
  if (session.step === "delivery_type") {
    if (text === "1" || isLocation) {
      session.data.deliveryType = "domicilio";
      if (isLocation) {
        await requestDeliveryQuote(phone, session, botConfig, locationLink);
      } else {
        session.step = "address";
        await replyAndLog(phone, session, "Perfecto, ¿cuál es tu dirección o sector de entrega? (o comparte tu ubicación de WhatsApp 📍)");
      }
    } else if (text === "2") {
      session.data.deliveryType = "retiro";
      session.data.deliveryFee = 0;
      session.step = "sides";
      await sendSidesMenu(phone, session, menuItems);
    } else {
      await replyAndLog(phone, session, "Responde 1 para Domicilio o 2 para Retirar en tienda (o comparte tu ubicación 📍).");
    }
    await saveSession(phone, session);
    return;
  }

  // --- Paso: dirección ---
  if (session.step === "address") {
    const address = isLocation ? locationLink : text;
    await requestDeliveryQuote(phone, session, botConfig, address);
    await saveSession(phone, session);
    return;
  }

  // --- Paso: esperando el precio del envío (lo resuelve el dueño) ---
  if (session.step === "awaiting_delivery_price") {
    await replyAndLog(phone, session, "Seguimos cotizando tu envío con nuestro motorizado, un momento por favor 🛵");
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
      session.data.items.push({ ...sides[idx], qty: 1 });
      session.data.foodTotal += sides[idx].price;
    }
    await goToDrinkStepOrPayment(phone, session, bankHolders);
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
    session.data.items.push({ ...drinks[idx], qty: 1 });
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
    await requestPaymentApproval(phone, session, botConfig, mediaId);
    await saveSession(phone, session);
    return;
  }

  // --- Paso: esperando que el dueño apruebe el comprobante ---
  if (session.step === "awaiting_approval") {
    await replyAndLog(phone, session, "Estamos verificando tu comprobante, un momento por favor 🙏");
    await saveSession(phone, session);
    return;
  }
}

async function selectMainItem(phone, session, item, botConfig) {
  session.data.items = [item];
  session.step = "quantity";
  await replyAndLog(phone, session, `¿Cuántas unidades de "${item.name}" deseas?`);
}

async function continueAfterMainItem(phone, session, botConfig) {
  session.step = "delivery_type";
  if (botConfig.upsellMsg) await replyAndLog(phone, session, botConfig.upsellMsg);
  await replyAndLog(phone, session, "¿Tu pedido es para *domicilio* o para *retirar en tienda*?\n1. Domicilio\n2. Retirar en tienda");
}

async function goToDrinkStepOrPayment(phone, session, bankHolders) {
  if (session.data.includesDrink) {
    session.step = "payment";
    await sendPaymentInfo(phone, session, bankHolders);
  } else {
    session.step = "drink_yn";
    await replyAndLog(phone, session, "¿Deseas agregar una bebida?\n1. Sí\n2. No");
  }
}

async function sendSidesMenu(phone, session, menuItems) {
  const sides = menuItems.filter((i) => i.category === "other" && i.available);
  session.data.sidesOptions = sides;
  if (sides.length === 0) {
    await goToDrinkStepOrPayment(phone, session, null);
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
    msg += ` + $${session.data.deliveryFee.toFixed(2)} de envío (en efectivo al motorizado) = $${total.toFixed(2)}`;
  }
  msg += `\n\nEl total del pedido se paga por transferencia a:${cuentas}\n\nCuando termines, envíame la foto del comprobante para confirmar tu pedido.`;
  await replyAndLog(phone, session, msg);
}

// --- Pide la cotización del envío al dueño, con un código de pedido para identificarlo ---
async function requestDeliveryQuote(phone, session, botConfig, direccionOUbicacion) {
  const ownerPhone = botConfig.ownerPhone;
  const code = generateCode();

  session.data.address = direccionOUbicacion;
  session.step = "awaiting_delivery_price";

  await QUOTES_COL.doc(code).set({
    phone,
    address: direccionOUbicacion,
    status: "pending",
    createdAt: Date.now(),
  });

  await replyAndLog(phone, session, "Estamos cotizando el valor de tu envío con nuestro motorizado, en un momento te aviso 🛵");

  if (ownerPhone) {
    await sendWhatsAppText(
      ownerPhone,
      `🛵 Nueva cotización de envío\nPedido #${code}\nCliente: ${phone}\nDirección: ${direccionOUbicacion}\n\nResponde escribiendo: #${code} <precio>\n(ej: #${code} 3 0 para $3.00)`
    );
  } else {
    console.error("⚠️ No hay un ownerPhone configurado — no se pudo avisar del envío.");
  }
}

// --- Reenvía el comprobante al dueño y espera su aprobación ---
async function requestPaymentApproval(phone, session, botConfig, mediaId) {
  const ownerPhone = botConfig.ownerPhone;
  const code = generateCode("P");
  const total = session.data.foodTotal + (session.data.deliveryFee || 0);

  session.step = "awaiting_approval";

  await APPROVALS_COL.doc(code).set({ phone, status: "pending", createdAt: Date.now() });

  await replyAndLog(phone, session, "📸 ¡Comprobante recibido! Lo estamos verificando, en un momento confirmamos tu pedido ✅");

  if (ownerPhone && mediaId) {
    await sendWhatsAppImageById(
      ownerPhone,
      mediaId,
      `🧾 Comprobante de pago\nPedido #${code}\nCliente: ${phone}\nTotal: $${total.toFixed(2)}\n\nResponde: #${code} ok (confirmar) o #${code} no (rechazar)`
    );
  } else {
    console.error("⚠️ No se pudo reenviar el comprobante al dueño (falta ownerPhone o mediaId).");
  }
}

// --- Procesa la respuesta del dueño: cotización de envío O aprobación de comprobante ---
async function handleOwnerReply(text) {
  const { botConfig } = await getBusinessConfig();
  const ownerPhone = botConfig.ownerPhone;

  const match = text.trim().match(/^#?([A-Za-z]?\d{1,4})\s+(.+)$/);
  if (!match) {
    if (ownerPhone) {
      await sendWhatsAppText(
        ownerPhone,
        "Formato no reconocido.\nPara envío: #<código> <precio> (ej: #087 3 0)\nPara comprobante: #<código> ok  ó  #<código> no"
      );
    }
    return;
  }
  const code = match[1].toUpperCase();
  const rest = match[2].trim();

  if (code.startsWith("P")) {
    await resolvePaymentApproval(code, rest, ownerPhone);
  } else {
    await resolveDeliveryQuote(code, rest, ownerPhone);
  }
}

async function resolveDeliveryQuote(code, rest, ownerPhone) {
  const price = parsePrice(rest);
  const quoteSnap = await QUOTES_COL.doc(code).get();
  if (!quoteSnap.exists || quoteSnap.data().status !== "pending" || price === null) {
    if (ownerPhone) await sendWhatsAppText(ownerPhone, `No encontré un pedido pendiente con el código #${code}, o el precio no es válido.`);
    return;
  }
  const { phone } = quoteSnap.data();
  await QUOTES_COL.doc(code).update({ status: "resolved", price });

  const session = await getSession(phone);
  if (!session) return;

  session.data.deliveryFee = price;
  await replyAndLog(phone, session, `El envío tiene un valor de $${price.toFixed(2)}, se paga en *efectivo* directo al motorizado 🛵`);

  const { menuItems } = await getBusinessConfig();
  await sendSidesMenu(phone, session, menuItems);
  await saveSession(phone, session);

  if (ownerPhone) await sendWhatsAppText(ownerPhone, `✅ Envié $${price.toFixed(2)} al cliente del pedido #${code}.`);
}

async function resolvePaymentApproval(code, rest, ownerPhone) {
  const approvalSnap = await APPROVALS_COL.doc(code).get();
  if (!approvalSnap.exists || approvalSnap.data().status !== "pending") {
    if (ownerPhone) await sendWhatsAppText(ownerPhone, `No encontré un comprobante pendiente con el código #${code}.`);
    return;
  }
  const { phone } = approvalSnap.data();
  const session = await getSession(phone);
  if (!session) return;

  if (/^(ok|si|s[ií]|aprobado|confirmar)$/i.test(rest)) {
    await APPROVALS_COL.doc(code).update({ status: "approved" });
    await finalizeOrder(phone, session);
    await clearSession(phone);
    if (ownerPhone) await sendWhatsAppText(ownerPhone, `✅ Pedido #${code} confirmado.`);
  } else if (/^(no|rechazar|rechazado)$/i.test(rest)) {
    await APPROVALS_COL.doc(code).update({ status: "rejected" });
    session.step = "payment";
    await replyAndLog(phone, session, "No pudimos verificar tu comprobante 🙁 Por favor envía una foto más clara o vuelve a intentar la transferencia.");
    await saveSession(phone, session);
    if (ownerPhone) await sendWhatsAppText(ownerPhone, `❌ Pedido #${code} rechazado, se le pidió reenviar el comprobante.`);
  } else if (ownerPhone) {
    await sendWhatsAppText(ownerPhone, `No entendí. Responde: #${code} ok  ó  #${code} no`);
  }
}

async function finalizeOrder(phone, session) {
  const { items, foodTotal, deliveryFee, address, deliveryType } = session.data;
  const confirmMsg = "✅ ¡Pago confirmado! Tu pedido ya fue enviado a cocina. En breve nos comunicamos si es necesario. ¡Gracias por tu compra! 🍔";
  await replyAndLog(phone, session, confirmMsg);

  const itemsSummary = items
    .map((i) => `${i.qty || 1}x ${i.name}${i.incluida ? " (incluida)" : ""}${i.volume ? ` (${i.volume})` : ""} ($${i.price.toFixed(2)} c/u)`)
    .join(", ");

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
