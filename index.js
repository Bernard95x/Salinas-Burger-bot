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
const QUOTES_COL = db.collection("cotizaciones_envio"); 
const APPROVALS_COL = db.collection("aprobaciones_pago"); 

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

// Envía al dueño la sugerencia formal con las opciones 1 y 2
async function sendComandoFEjemplo(ownerPhone, orderNumber, sugerencia) {
  if (!ownerPhone) return;
  
  // Guardamos temporalmente la sugerencia en la sesión del dueño o en una colección si se desea, 
  // o se presenta de forma clara para que elija.
  await sendWhatsAppText(
    ownerPhone,
    `💬 *Notificación para el cliente*\nSugerencia automática para el Pedido #${orderNumber}:\n\n"${sugerencia}"\n\nElija una opción:\n1️⃣ Enviar esta sugerencia (escriba: \`#F${orderNumber} ${sugerencia}\`)\n2️⃣ Redactar su propio mensaje (escriba: \`#F${orderNumber} <su mensaje personalizado>\`)`
  );
}

async function sendWhatsAppDocument(to, link, filename) {
  await axios.post(
    `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`,
    { messaging_product: "whatsapp", to, type: "document", document: { link, filename } },
    { headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` } }
  );
}

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

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, x-api-secret");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const APP_API_SECRET = process.env.APP_API_SECRET || "";

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
  res.sendStatus(200); 

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message) return;

    const from = message.from;
    const isImage = message.type === "image";
    const isLocation = message.type === "location";
    const isOrder = message.type === "order"; 
    const mediaId = isImage ? message.image?.id : null;
    const text = message.text?.body?.trim() || "";
    const orderData = isOrder ? message.order : null;
    
    const locationLink = isLocation
      ? `https://www.google.com/maps?q=${message.location.latitude},${message.location.longitude}`
      : null;

    console.log(`📩 [${from}] ${isImage ? "(imagen)" : isLocation ? "(ubicación)" : isOrder ? "(carrito)" : text}`);

    const { botConfig } = await getBusinessConfig();
    const ownerPhone = normalizePhone(botConfig.ownerPhone);
    const fromPhone = normalizePhone(from);

    const isOwner = ownerPhone && fromPhone.endsWith(ownerPhone.slice(-9));

    if (isOwner) {
      await handleOwnerReply(text);
    } else {
      await handleIncomingMessage(from, text, isImage, isLocation, isOrder, orderData, locationLink, mediaId);
    }
  } catch (err) {
    console.error("⚠️ Error procesando el webhook:", err.response?.data || err.message);
  }
});

function normalizePhone(p) {
  return (p || "").replace(/\D/g, ""); 
}

// ============ CONFIGURACIÓN DEL NEGOCIO ============

async function getBusinessConfig() {
  const [menuSnap, configSnap] = await Promise.all([MENU_DOC.get(), CONFIG_DOC.get()]);
  const menuData = menuSnap.exists ? menuSnap.data() : {};
  const configData = configSnap.exists ? configSnap.data() : {};
  return {
    menuItems: menuData.menuItems || [],
    botConfig: { 
      ...(configData.botConfig || {}), 
      ownerPhone: configData.botConfig?.ownerPhone || configData.audioSettings?.ownerPhone 
    },
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

function parsePrice(raw) {
  let cleaned = raw.trim().replace(",", ".");
  if (/^\d+\s+\d{1,2}$/.test(cleaned)) cleaned = cleaned.replace(/\s+/, ".");
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

function randomSuggestions(menuItems, excludeId, count = 2, categorias = ["burger", "combo"]) {
  const disponibles = menuItems.filter(
    (i) => categorias.includes(i.category) && i.available && i.id !== excludeId
  );
  const shuffled = disponibles.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function itemIncludesDrink(item) {
  return /cola/i.test(`${item.name} ${item.desc || ""}`);
}

function itemIncludesFries(item) {
  return /papas|marranita/i.test(`${item.name} ${item.desc || ""}`);
}

function getSauceOptions(menuItems) {
  return menuItems.filter((i) => i.category === "sauce" && i.available);
}

function getPersonalDrinkOptions(menuItems) {
  const ejemploPersonal = menuItems.find((i) => i.category === "drink" && /personal/i.test(i.name));
  const volumenPersonal = ejemploPersonal ? ejemploPersonal.volume || "Personal" : "Personal";
  return menuItems.filter((i) => i.category === "drink" && i.available && (i.volume || "Personal") === volumenPersonal);
}

async function tryMatchUnavailable(phone, session, botConfig, menuItems, text, categorias) {
  const match = menuItems.find((i) => categorias.includes(i.category) && normalizeText(i.name).includes(normalizeText(text)));
  if (!match || match.available) return false; 

  const sugerencias = randomSuggestions(menuItems, match.id, 2, categorias);
  const listadoSug = sugerencias.map((s) => `- ${s.name}${s.price ? ` ($${s.price.toFixed(2)})` : ""}`).join("\n");
  await replyAndLog(
    phone,
    session,
    `${botConfig.soldOutMsg || `Lo sentimos, "${match.name}" no está disponible por ahora.`}\n\n${
      sugerencias.length ? `Te sugerimos:\n${listadoSug}\n\n` : ""
    }Responde con el número de alguna opción de la lista que te mostramos.`
  );
  return true; 
}

const COUNTER_DOC = db.collection("appData").doc("counter");

async function getNextOrderNumber() {
  return db.runTransaction(async (t) => {
    const snap = await t.get(COUNTER_DOC);
    const next = snap.exists ? snap.data().nextOrderNumber || 1 : 1;
    t.set(COUNTER_DOC, { nextOrderNumber: next + 1 });
    return next;
  });
}

async function getOrderNumber(session) {
  if (!session.data.orderNumber) {
    session.data.orderNumber = await getNextOrderNumber();
  }
  return session.data.orderNumber;
}

// ============ SESIONES DE CONVERSACIÓN ============

async function getSession(phone) {
  const snap = await SESSIONS_COL.doc(phone).get();
  if (!snap.exists) return null;
  const session = snap.data();

  const TIEMPO_INACTIVIDAD = 90 * 60 * 1000;
  if (session.lastInteraction && (Date.now() - session.lastInteraction > TIEMPO_INACTIVIDAD)) {
    await clearSession(phone);
    return null;
  }

  return session;
}

async function saveSession(phone, session) {
  session.lastInteraction = Date.now();
  await SESSIONS_COL.doc(phone).set(session);
}

async function clearSession(phone) {
  await SESSIONS_COL.doc(phone).delete();
}

async function replyAndLog(phone, session, text) {
  await sendWhatsAppText(phone, text);
  session.chatHistory.push({ sender: "ai", text });
  session.lastInteraction = Date.now();
}

function logClient(session, text) {
  session.chatHistory.push({ sender: "client", text });
  session.lastInteraction = Date.now();
}

// ============ FUNCIONES DE FLUJO AUXILIARES ============

async function processNextPendingMainItem(phone, session) {
  if (!session.data.pendingMainItems || session.data.pendingMainItems.length === 0) {
    const { menuItems } = await getBusinessConfig();
    const hasBurger = session.data.items.some(i => i.category === 'burger');
    session.step = "sides";
    await sendSidesMenu(phone, session, menuItems, hasBurger);
    return;
  }
  
  const currentItem = session.data.pendingMainItems[0];

  if (currentItem.qty) {
    if (!currentItem._pushed) {
      session.data.items.push(currentItem);
      session.data.foodTotal = (session.data.foodTotal || 0) + (currentItem.price * currentItem.qty);
      currentItem._pushed = true;
    }

    if (itemIncludesFries(currentItem) && !currentItem._sauceDone) {
      currentItem._sauceDone = true;
      const pregunto = await askSauceFlavor(phone, session, currentItem, "main_item_continue");
      if (pregunto) return;
    }

    if (itemIncludesDrink(currentItem) && !currentItem._drinkDone) {
      currentItem._drinkDone = true;
      await askDrinkFlavor(phone, session, currentItem, "main_item_continue");
      return;
    }

    session.data.pendingMainItems.shift();
    return processNextPendingMainItem(phone, session);
  }

  session.step = "quantity";
  await replyAndLog(phone, session, `¿Cuántas unidades de "${currentItem.name}" deseas?`);
}

async function sendSidesMenu(phone, session, menuItems, hasBurger) {
  const sides = menuItems.filter((i) => i.category === "other" && i.available);
  session.data.sidesOptions = sides;
  
  if (sides.length === 0) {
    await goToDrinkStepOrDelivery(phone, session);
    return;
  }
  
  const listado = sides.map((s, i) => `${i + 1}. ${s.name} - $${s.price.toFixed(2)}`).join("\n");
  
  const msg = hasBurger 
    ? `Notamos que pediste hamburguesas 🍔 ¿Deseas acompañar tu pedido con unas papas o extras?\n\nResponde con el número de la opción, o *0* si no deseas nada más.\n\n${listado}`
    : `¿Deseas acompañar tu pedido con algo de esto?\n\nResponde con el número de la opción, o *0* si no deseas nada más.\n\n${listado}`;

  await replyAndLog(phone, session, msg);
}

async function askSauceFlavor(phone, session, item, afterStep) {
  const { menuItems } = await getBusinessConfig();
  const salsas = getSauceOptions(menuItems);
  if (salsas.length === 0) return false; 
  session.data.sauceOptions = salsas;
  session.data.afterSauceStep = afterStep;
  session.step = "item_sauce_flavor";
  const listado = salsas.map((s, i) => `${i + 1}. ${s.name}`).join("\n");
  await replyAndLog(phone, session, `Tu producto "${item.name}" incluye papas 🍟 ¿Qué salsa deseas?\n\n${listado}`);
  return true;
}

async function askDrinkFlavor(phone, session, item, afterStep) {
  const { menuItems } = await getBusinessConfig();
  const drinks = getPersonalDrinkOptions(menuItems);
  session.data.comboDrinkOptions = drinks;
  session.data.afterComboDrinkStep = afterStep;
  session.step = "combo_drink_flavor";
  const listado = drinks.map((d, i) => `${i + 1}. ${d.name}`).join("\n");
  await replyAndLog(phone, session, `Tu producto "${item.name}" incluye una cola personal 🥤 ¿Cuál sabor prefieres?\n\n${listado}`);
}

async function goToDrinkStepOrDelivery(phone, session) {
  session.step = "drink_yn";
  await replyAndLog(phone, session, "¿Deseas agregar una *bebida extra* a tu pedido?\n1. Sí\n2. No");
}

async function askSpecialNotes(phone, session) {
  session.step = "ask_special_notes";
  await replyAndLog(phone, session, "¡Perfecto! Ya tenemos tu pedido completo 🛍️\n\nAntes de continuar, ¿deseas escribirle alguna indicación especial a la cocina (ej. sin cebolla, sin pepinillos) o hacernos una consulta rápida?\n1. No, continuar con el pedido\n2. Sí, quiero escribirles un mensaje");
}

async function askOrderPaymentMethod(phone, session) {
  session.step = "order_payment_method";
  await replyAndLog(phone, session, "¿Cómo deseas pagar tu *pedido*?\n1. Efectivo\n2. Transferencia");
}

async function askDeliveryType(phone, session, botConfig) {
  session.step = "delivery_type";
  await replyAndLog(phone, session, "¡Excelente! Ya tenemos todo lo que necesitas.\n\n¿Tu pedido es para *domicilio* o para *retirar en tienda*?\n1. Domicilio\n2. Retirar en tienda");
}

async function sendPaymentInfo(phone, session, bankHolders) {
  const foodTotal = session.data.foodTotal || 0;
  const deliveryFee = session.data.deliveryFee || 0;
  const total = foodTotal + deliveryFee;

  const orderMethod = session.data.orderPaymentMethod; 
  const deliveryMethod = session.data.deliveryPaymentMethod; 

  const cashAmount = (orderMethod === "efectivo" ? foodTotal : 0) + (deliveryMethod === "efectivo" ? deliveryFee : 0);
  const transferAmount = (orderMethod === "transferencia" ? foodTotal : 0) + (deliveryMethod === "transferencia" ? deliveryFee : 0);

  function getLabel(method) {
    let parts = [];
    if (orderMethod === method) parts.push("pedido");
    if (deliveryMethod === method) parts.push("envío");
    return parts.length > 0 ? `(${parts.join(" y ")})` : "";
  }

  let msg = `El total de tu pedido es $${total.toFixed(2)}.\n\n`;
  if (cashAmount > 0) msg += `💵 Pago en efectivo ${getLabel("efectivo")}: $${cashAmount.toFixed(2)}\n`;
  if (transferAmount > 0) msg += `💳 Pago por transferencia ${getLabel("transferencia")}: $${transferAmount.toFixed(2)}\n`;

  if (transferAmount > 0) {
    const cuentas = formatBankAccountsForChat(bankHolders);
    msg += `\nEl monto por transferencia se paga a:${cuentas}\n\nCuando termines, envíame la *foto del comprobante* por aquí para confirmar tu pedido 📸.`;
    if (cashAmount > 0) {
      msg += ` (El monto en efectivo lo pagas directo ${deliveryMethod === "efectivo" ? "al motorizado" : "al retirar tu pedido"}).`;
    }
    session.step = "payment";
    await replyAndLog(phone, session, msg);
    return false;
  }

  msg += `\nTen el efectivo listo, se paga directo ${deliveryMethod === "efectivo" || session.data.deliveryType === "domicilio" ? "al motorizado" : "al retirar tu pedido"} 🙌`;
  await replyAndLog(phone, session, msg);

  const orderNumber = await getOrderNumber(session);
  await finalizeOrder(phone, session, "✅ ¡Pago confirmado! Tu pedido ya fue enviado a cocina. En breve nos comunicamos si es necesario. ¡Gracias por tu compra! 🍔");

  const { botConfig } = await getBusinessConfig();
  if (botConfig.ownerPhone) {
    await sendWhatsAppText(botConfig.ownerPhone, `💵 Pedido #${orderNumber} pagado en EFECTIVO\n\n${buildOrderBreakdownText(phone, session, orderNumber)}`);
  }
  await clearSession(phone);
  return true;
}

// ============ CONVERSACIÓN CON EL CLIENTE ============

async function handleIncomingMessage(phone, text, isImage, isLocation, isOrder, orderData, locationLink, mediaId) {
  const { menuItems, botConfig, bankHolders } = await getBusinessConfig();
  
  if (text.toLowerCase() === "reiniciar" || text.toLowerCase() === "cancelar") {
    await clearSession(phone);
    await sendWhatsAppText(phone, "✅ Tu pedido anterior ha sido cancelado. Envía cualquier mensaje (como 'Hola') para empezar uno nuevo 🍔");
    return;
  }

  let session = await getSession(phone);
  const esSesionNueva = !session;

  let entrada = text;
  if (isImage) entrada = "(imagen)";
  if (isLocation) entrada = "(ubicación compartida)";
  if (isOrder) entrada = "(carrito de compras recibido)";

  if (!session || (isOrder && session.step === "menu")) {
    session = session || { step: "menu", data: {}, chatHistory: [], lastInteraction: Date.now() };
    logClient(session, entrada);

    if (isOrder && orderData) {
      let cartItems = [];
      for (let oItem of orderData.product_items) {
        let dbItem = menuItems.find(m => String(m.id) === String(oItem.product_retailer_id));
        if (dbItem) cartItems.push({ ...dbItem, qty: oItem.quantity });
      }
      if (cartItems.length > 0) {
        session.data.pendingMainItems = cartItems;
        session.data.items = [];
        session.data.foodTotal = 0;
        await replyAndLog(phone, session, "¡Recibimos tu carrito de compras! 🛒");
        await processNextPendingMainItem(phone, session);
        await saveSession(phone, session);
        return;
      }
    }

    if (esSesionNueva) {
      await replyAndLog(phone, session, botConfig.welcomeMsg || "¡Hola! Bienvenido a Salinas Burger 🍔");

      if (botConfig.menuPdfUrl) {
        await sendWhatsAppDocument(phone, botConfig.menuPdfUrl, botConfig.menuPdfName || "Menu.pdf");
        session.chatHistory.push({ sender: "ai", text: `📄 [PDF enviado: ${botConfig.menuPdfName || "Menu.pdf"}]` });
      }
    }

    const disponibles = menuItems.filter((i) => (i.category === "burger" || i.category === "combo") && i.available);
    if (disponibles.length === 0) {
      await replyAndLog(phone, session, botConfig.soldOutMsg || "Por ahora no tenemos productos disponibles, intenta más tarde 🙏");
      await clearSession(phone);
      return;
    }
    
    session.data.opciones = disponibles;
    const listado = disponibles
      .map((b, i) => {
        const linea = `${i + 1}. ${b.name}${b.category === "combo" ? " (Combo)" : ""} - $${b.price.toFixed(2)}`;
        const detalle = (b.category === "combo" || !b.desc) ? "" : `\n   🧾 ${b.desc}`;
        return linea + detalle;
      })
      .join("\n");
      
    await replyAndLog(phone, session, `Este es nuestro menú principal.\nResponde con el número que deseas (Si deseas varios, escríbelos como "1 y 3").\n*(💡 Tip: Si te equivocas, escribe "cancelar". Más adelante podrás dejarnos instrucciones especiales como 'sin pepinillos')*\n\n${listado}`);
    await saveSession(phone, session);
    return;
  }

  logClient(session, entrada);

  if (session.step === "menu") {
    const opciones = session.data.opciones || [];
    const matches = text.match(/\d+/g);
    let selectedItems = [];

    if (matches && matches.length > 0) {
      for (let numStr of matches) {
        const idx = parseInt(numStr, 10) - 1;
        if (opciones[idx] && !selectedItems.find((i) => i.id === opciones[idx].id)) {
          selectedItems.push(opciones[idx]);
        }
      }
    }

    if (selectedItems.length === 0) {
      const match = menuItems.find(
        (i) => (i.category === "burger" || i.category === "combo") && normalizeText(i.name).includes(normalizeText(text))
      );
      if (match) {
        if (!match.available) {
          const sugerencias = randomSuggestions(menuItems, match.id);
          const listadoSug = sugerencias.map((s) => `- ${s.name} ($${s.price.toFixed(2)})`).join("\n");
          await replyAndLog(
            phone,
            session,
            `${botConfig.soldOutMsg || `Lo sentimos, "${match.name}" no está disponible por ahora.`}\n\n${
              su