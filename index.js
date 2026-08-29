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

    // Validar usando los últimos 9 dígitos para evitar problemas con el código de país
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

// Detecta qué valor de "volume" usan las bebidas Personales en este menú (ej. "300 ml"),
// buscando cualquier bebida cuyo nombre diga "Personal", y devuelve solo esas opciones disponibles.
function getPersonalDrinkOptions(menuItems) {
  const ejemploPersonal = menuItems.find((i) => i.category === "drink" && /personal/i.test(i.name));
  const volumenPersonal = ejemploPersonal ? ejemploPersonal.volume || "Personal" : "Personal";
  return menuItems.filter((i) => i.category === "drink" && i.available && (i.volume || "Personal") === volumenPersonal);
}

// Busca en TODO el menú (disponible o no) algo que coincida con el texto del cliente, dentro de las categorías dadas.
// Si encuentra algo en pausa, devuelve el mensaje de "agotado" + sugerencias al azar de lo que sí está disponible.
async function tryMatchUnavailable(phone, session, botConfig, menuItems, text, categorias) {
  const match = menuItems.find((i) => categorias.includes(i.category) && normalizeText(i.name).includes(normalizeText(text)));
  if (!match || match.available) return false; // no hubo coincidencia, o sí está disponible: seguir con el flujo normal

  const sugerencias = randomSuggestions(menuItems, match.id, 2, categorias);
  const listadoSug = sugerencias.map((s) => `- ${s.name}${s.price ? ` ($${s.price.toFixed(2)})` : ""}`).join("\n");
  await replyAndLog(
    phone,
    session,
    `${botConfig.soldOutMsg || `Lo sentimos, "${match.name}" no está disponible por ahora.`}\n\n${
      sugerencias.length ? `Te sugerimos:\n${listadoSug}\n\n` : ""
    }Responde con el número de alguna opción de la lista que te mostramos.`
  );
  return true; // ya se respondió, no seguir procesando este mensaje
}

const COUNTER_DOC = db.collection("appData").doc("counter");

// Devuelve el siguiente número de pedido (1, 2, 3...), llevando la cuenta en Firebase
async function getNextOrderNumber() {
  return db.runTransaction(async (t) => {
    const snap = await t.get(COUNTER_DOC);
    const next = snap.exists ? snap.data().nextOrderNumber || 1 : 1;
    t.set(COUNTER_DOC, { nextOrderNumber: next + 1 });
    return next;
  });
}

// Asigna un número de pedido a la sesión (una sola vez), para que la cotización de envío
// y la aprobación del comprobante del mismo cliente usen el mismo número.
async function getOrderNumber(session) {
  if (!session.data.orderNumber) {
    session.data.orderNumber = await getNextOrderNumber();
  }
  return session.data.orderNumber;
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

// Pregunta qué salsa desea para un ítem que incluye papas/marranitas (individual, side o dentro de un combo).
async function askSauceFlavor(phone, session, item, afterStep) {
  const { menuItems } = await getBusinessConfig();
  const salsas = getSauceOptions(menuItems);
  if (salsas.length === 0) return false; // no hay salsas configuradas, seguir el flujo normal
  session.data.sauceOptions = salsas;
  session.data.afterSauceStep = afterStep;
  session.step = "item_sauce_flavor";
  const listado = salsas.map((s, i) => `${i + 1}. ${s.name}`).join("\n");
  await replyAndLog(phone, session, `Tu producto "${item.name}" incluye papas 🍟 ¿Qué salsa deseas?\n\n${listado}`);
  return true;
}

// Pregunta el sabor de la cola incluida en un ítem principal o en un side.
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

async function askOrderPaymentMethod(phone, session) {
  session.step = "order_payment_method";
  await replyAndLog(phone, session, "¡Perfecto! Ya tenemos tu pedido completo 🛍️\n\n¿Cómo deseas pagar tu *pedido*?\n1. Efectivo\n2. Transferencia");
}

async function askDeliveryType(phone, session, botConfig) {
  session.step = "delivery_type";
  await replyAndLog(phone, session, "¡Excelente! Ya tenemos todo lo que necesitas.\n\n¿Tu pedido es para *domicilio* o para *retirar en tienda*?\n1. Domicilio\n2. Retirar en tienda");
}

// Devuelve true si el pedido quedó finalizado dentro de esta función (100% efectivo, sin comprobante que esperar),
// para que quien la llame NO vuelva a guardar la sesión (ya fue borrada). Devuelve false si sigue en curso
// (falta comprobante de transferencia), y quien la llame sí debe guardar la sesión normalmente.
async function sendPaymentInfo(phone, session, bankHolders) {
  const foodTotal = session.data.foodTotal || 0;
  const deliveryFee = session.data.deliveryFee || 0;
  const total = foodTotal + deliveryFee;

  const orderMethod = session.data.orderPaymentMethod; // "efectivo" | "transferencia"
  const deliveryMethod = session.data.deliveryPaymentMethod; // "efectivo" | "transferencia" | undefined (retiro en tienda)

  const cashAmount = (orderMethod === "efectivo" ? foodTotal : 0) + (deliveryMethod === "efectivo" ? deliveryFee : 0);
  const transferAmount = (orderMethod === "transferencia" ? foodTotal : 0) + (deliveryMethod === "transferencia" ? deliveryFee : 0);

  let msg = `El total de tu pedido es $${total.toFixed(2)}.\n\n`;
  if (cashAmount > 0) msg += `💵 Pago en efectivo (pedido o envío): $${cashAmount.toFixed(2)}\n`;
  if (transferAmount > 0) msg += `💳 Pago por transferencia (pedido o envío): $${transferAmount.toFixed(2)}\n`;

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

  // Todo el pedido se paga en efectivo: no se necesita comprobante, se envía directo a cocina.
  msg += `\nTen el efectivo listo, se paga directo ${deliveryMethod === "efectivo" || session.data.deliveryType === "domicilio" ? "al motorizado" : "al retirar tu pedido"} 🙌`;
  await replyAndLog(phone, session, msg);

  const orderNumber = await getOrderNumber(session);
  await finalizeOrder(phone, session, "✅ ¡Pedido confirmado! Ya fue enviado a cocina 🍳. Recuerda tener el efectivo listo. ¡Gracias por tu compra! 🍔");

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
    session = session || { step: "menu", data: {}, chatHistory: [] };
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
      .map((b, i) => `${i + 1}. ${b.name}${b.category === "combo" ? " (Combo)" : ""} - $${b.price.toFixed(2)}`)
      .join("\n");
      
    await replyAndLog(phone, session, `Este es nuestro menú principal.\nResponde con el número que deseas (Si deseas varios, escríbelos como "1 y 3").\n*(💡 Tip: Si te equivocas en tu pedido, puedes escribir "cancelar" en cualquier momento)*\n\n${listado}`);
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
              sugerencias.length ? `Te sugerimos:\n${listadoSug}\n\n` : ""
            }Responde con el número de alguna opción.`
          );
          await saveSession(phone, session);
          return;
        }
        selectedItems.push(match);
      }
    }

    if (selectedItems.length > 0) {
      session.data.pendingMainItems = selectedItems;
      session.data.items = [];
      session.data.foodTotal = 0;
      await processNextPendingMainItem(phone, session);
      await saveSession(phone, session);
      return;
    }

    await replyAndLog(phone, session, "No entendí esa opción 🙁 Responde con el número del producto de la lista.\n*(O escribe la palabra 'cancelar' para empezar de nuevo)*");
    await saveSession(phone, session);
    return;
  }

  if (session.step === "quantity") {
    const qty = parseInt(text, 10);
    if (isNaN(qty) || qty < 1 || qty > 20) {
      await replyAndLog(phone, session, "Escribe un número válido de unidades (ej. 1, 2, 3...).\n*(O escribe la palabra 'cancelar' para empezar de nuevo)*");
      await saveSession(phone, session);
      return;
    }
    
    const currentItem = session.data.pendingMainItems.shift(); 
    
    if (itemIncludesDrink(currentItem) || itemIncludesFries(currentItem)) {
      for (let i = 0; i < qty; i++) {
         session.data.pendingMainItems.unshift({ ...currentItem, qty: 1 });
      }
    } else {
      session.data.items.push({ ...currentItem, qty });
      session.data.foodTotal = (session.data.foodTotal || 0) + (currentItem.price * qty);
    }
    
    await processNextPendingMainItem(phone, session);
    await saveSession(phone, session);
    return;
  }

  if (session.step === "combo_drink_flavor") {
    const idx = parseInt(text, 10) - 1;
    const drinks = session.data.comboDrinkOptions || [];
    if (isNaN(idx) || !drinks[idx]) {
      await replyAndLog(phone, session, "Responde con el número de la bebida de la lista.\n*(O escribe 'cancelar' para empezar de nuevo)*");
      await saveSession(phone, session);
      return;
    }

    const afterStep = session.data.afterComboDrinkStep;
    delete session.data.afterComboDrinkStep;

    if (afterStep === "sides_continue") {
      const side = session.data.currentSide;
      session.data.items.push({
        ...drinks[idx],
        price: 0,
        qty: 1,
        incluida: true,
        name: `${drinks[idx].name} (para ${side.name})`,
      });
      await goToDrinkStepOrDelivery(phone, session);
      await saveSession(phone, session);
      return;
    }

    const currentItem = session.data.pendingMainItems[0];

    session.data.items.push({ 
      ...drinks[idx], 
      price: 0, 
      qty: 1, 
      incluida: true,
      name: `${drinks[idx].name} (para ${currentItem.name})`
    });

    await processNextPendingMainItem(phone, session);
    await saveSession(phone, session);
    return;
  }

  if (session.step === "item_sauce_flavor") {
    const idx = parseInt(text, 10) - 1;
    const salsas = session.data.sauceOptions || [];
    if (isNaN(idx) || !salsas[idx]) {
      await replyAndLog(phone, session, "Responde con el número de la salsa de la lista.\n*(O escribe 'cancelar' para empezar de nuevo)*");
      await saveSession(phone, session);
      return;
    }
    const salsaElegida = salsas[idx];
    const afterStep = session.data.afterSauceStep;
    delete session.data.afterSauceStep;

    if (afterStep === "sides_continue") {
      const side = session.data.currentSide;
      session.data.items.push({
        ...salsaElegida,
        price: 0,
        qty: 1,
        incluida: true,
        name: `${salsaElegida.name} (para ${side.name})`,
      });

      if (itemIncludesDrink(side)) {
        await askDrinkFlavor(phone, session, side, "sides_continue");
        await saveSession(phone, session);
        return;
      }

      await goToDrinkStepOrDelivery(phone, session);
      await saveSession(phone, session);
      return;
    }

    // afterStep === "main_item_continue"
    const currentItem = session.data.pendingMainItems[0];
    session.data.items.push({
      ...salsaElegida,
      price: 0,
      qty: 1,
      incluida: true,
      name: `${salsaElegida.name} (para ${currentItem.name})`,
    });

    await processNextPendingMainItem(phone, session);
    await saveSession(phone, session);
    return;
  }

  if (session.step === "sides") {
    if (text === "0") {
      await goToDrinkStepOrDelivery(phone, session);
      await saveSession(phone, session);
      return;
    }
    const sides = session.data.sidesOptions || [];
    const idx = parseInt(text, 10) - 1;
    if (isNaN(idx) || !sides[idx]) {
      if (await tryMatchUnavailable(phone, session, botConfig, menuItems, text, ["other"])) {
        await saveSession(phone, session);
        return;
      }
      await replyAndLog(phone, session, "Responde con el número de la opción, o 0 si no deseas ninguna.\n*(O escribe 'cancelar' para empezar de nuevo)*");
      await saveSession(phone, session);
      return;
    }
    session.data.currentSide = sides[idx];
    session.step = "side_quantity";
    await replyAndLog(phone, session, `¿Cuántas unidades de "${sides[idx].name}" deseas agregar?`);
    await saveSession(phone, session);
    return;
  }

  if (session.step === "side_quantity") {
    const qty = parseInt(text, 10);
    if (isNaN(qty) || qty < 1 || qty > 20) {
      await replyAndLog(phone, session, "Escribe un número válido de unidades.\n*(O escribe 'cancelar' para empezar de nuevo)*");
      await saveSession(phone, session);
      return;
    }
    const side = session.data.currentSide;
    session.data.items.push({ ...side, qty });
    session.data.foodTotal += side.price * qty;

    if (itemIncludesFries(side)) {
      const pregunto = await askSauceFlavor(phone, session, side, "sides_continue");
      if (pregunto) {
        await saveSession(phone, session);
        return;
      }
    }

    if (itemIncludesDrink(side)) {
      await askDrinkFlavor(phone, session, side, "sides_continue");
      await saveSession(phone, session);
      return;
    }

    // Aquí evitamos volver a preguntar por los extras y saltamos a las bebidas directamente
    await goToDrinkStepOrDelivery(phone, session);
    await saveSession(phone, session);
    return;
  }

  if (session.step === "drink_yn") {
    if (text === "2") {
      await askOrderPaymentMethod(phone, session);
      await saveSession(phone, session);
      return;
    } else if (text === "1") {
      const drinks = menuItems.filter((i) => i.category === "drink" && i.available);
      const capacidades = [...new Set(drinks.map((d) => d.volume || "Personal"))];
      session.data.drinkCapacities = capacidades;
      session.step = "drink_capacity";
      const listado = capacidades.map((c, i) => `${i + 1}. ${c}`).join("\n");
      await replyAndLog(phone, session, `¿Qué presentación prefieres?\n\n${listado}`);
    } else {
      await replyAndLog(phone, session, "Responde 1 para Sí o 2 para No.\n*(O escribe 'cancelar' para empezar de nuevo)*");
    }
    await saveSession(phone, session);
    return;
  }

  if (session.step === "drink_capacity") {
    const idx = parseInt(text, 10) - 1;
    const capacidades = session.data.drinkCapacities || [];
    if (isNaN(idx) || !capacidades[idx]) {
      const todasLasCapacidades = [...new Set(menuItems.filter((i) => i.category === "drink").map((d) => d.volume || "Personal"))];
      const pidioCapacidadSinStock = todasLasCapacidades.some((c) => normalizeText(c).includes(normalizeText(text)) && !capacidades.includes(c));
      if (pidioCapacidadSinStock) {
        const listado = capacidades.map((c, i) => `${i + 1}. ${c}`).join("\n");
        await replyAndLog(phone, session, `${botConfig.soldOutMsg || "Lo sentimos, esa presentación no está disponible por ahora."}\n\nPresentaciones disponibles:\n${listado}`);
        await saveSession(phone, session);
        return;
      }
      await replyAndLog(phone, session, "Responde con el número de la presentación de la lista.\n*(O escribe 'cancelar' para empezar de nuevo)*");
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

  if (session.step === "drink_choice") {
    const idx = parseInt(text, 10) - 1;
    const drinks = session.data.drinkOptions || [];
    if (isNaN(idx) || !drinks[idx]) {
      if (await tryMatchUnavailable(phone, session, botConfig, menuItems, text, ["drink"])) {
        await saveSession(phone, session);
        return;
      }
      await replyAndLog(phone, session, "Responde con el número de la bebida de la lista.\n*(O escribe 'cancelar' para empezar de nuevo)*");
      await saveSession(phone, session);
      return;
    }
    session.data.currentDrink = drinks[idx];
    session.step = "drink_quantity";
    await replyAndLog(phone, session, `¿Cuántas unidades de "${drinks[idx].name}" deseas?`);
    await saveSession(phone, session);
    return;
  }

  if (session.step === "drink_quantity") {
    const qty = parseInt(text, 10);
    if (isNaN(qty) || qty < 1 || qty > 20) {
      await replyAndLog(phone, session, "Escribe un número válido de unidades.\n*(O escribe 'cancelar' para empezar de nuevo)*");
      await saveSession(phone, session);
      return;
    }
    const drink = session.data.currentDrink;
    session.data.items.push({ ...drink, qty });
    session.data.foodTotal += drink.price * qty;

    await askOrderPaymentMethod(phone, session);
    await saveSession(phone, session);
    return;
  }

  if (session.step === "order_payment_method") {
    if (text === "1") {
      session.data.orderPaymentMethod = "efectivo";
    } else if (text === "2") {
      session.data.orderPaymentMethod = "transferencia";
    } else {
      await replyAndLog(phone, session, "Responde 1 para Efectivo o 2 para Transferencia.\n*(O escribe 'cancelar' para empezar de nuevo)*");
      await saveSession(phone, session);
      return;
    }
    await askDeliveryType(phone, session, botConfig);
    await saveSession(phone, session);
    return;
  }

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
      session.step = "payment";
      const finalizado = await sendPaymentInfo(phone, session, bankHolders);
      if (!finalizado) await saveSession(phone, session);
      return;
    } else {
      await replyAndLog(phone, session, "Responde 1 para Domicilio o 2 para Retirar en tienda (o comparte tu ubicación 📍).\n*(O escribe 'cancelar' para empezar de nuevo)*");
    }
    await saveSession(phone, session);
    return;
  }

  if (session.step === "address") {
    const address = isLocation ? locationLink : text;
    await requestDeliveryQuote(phone, session, botConfig, address);
    await saveSession(phone, session);
    return;
  }

  if (session.step === "awaiting_delivery_price") {
    await replyAndLog(phone, session, "Seguimos cotizando tu envío con nuestro motorizado, un momento por favor 🛵.\n\n*(Si ya no deseas esperar o quieres modificar tu pedido, escribe 'cancelar')*");
    await saveSession(phone, session);
    return;
  }

  if (session.step === "delivery_payment_method") {
    if (text === "1") {
      session.data.deliveryPaymentMethod = "efectivo";
    } else if (text === "2") {
      session.data.deliveryPaymentMethod = "transferencia";
    } else {
      await replyAndLog(phone, session, "Responde 1 para Efectivo o 2 para Transferencia.\n*(O escribe 'cancelar' para empezar de nuevo)*");
      await saveSession(phone, session);
      return;
    }
    session.step = "payment";
    const finalizado = await sendPaymentInfo(phone, session, bankHolders);
    if (!finalizado) await saveSession(phone, session);
    return;
  }

  if (session.step === "payment") {
    if (!isImage) {
      await replyAndLog(phone, session, "Para confirmar tu pedido, envíame la *foto o captura* de la transferencia 📸.\n\n*(Si tuviste un problema y deseas anular este pedido, escribe 'cancelar')*");
      await saveSession(phone, session);
      return;
    }
    await requestPaymentApproval(phone, session, botConfig, mediaId);
    await saveSession(phone, session);
    return;
  }

  if (session.step === "awaiting_approval") {
    await replyAndLog(phone, session, "Estamos verificando tu comprobante, un momento por favor 🙏.\n*(Escribe 'cancelar' si necesitas anular el pedido)*");
    await saveSession(phone, session);
    return;
  }
}

async function requestDeliveryQuote(phone, session, botConfig, direccionOUbicacion) {
  const ownerPhone = botConfig.ownerPhone;
  const orderNumber = await getOrderNumber(session);
  const code = String(orderNumber);

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
  }
}

// Arma el texto con el desglose del pedido (ítems, sabores incluidos, subtotal, envío y total)
// para que el dueño pueda verificarlo contra el comprobante que recibirá justo después.
function buildOrderBreakdownText(phone, session, code) {
  const { items = [], foodTotal = 0, deliveryFee = 0, address, deliveryType } = session.data;
  const total = foodTotal + (deliveryFee || 0);

  // Igual criterio que en finalizeOrder: las bebidas incluidas (name = "X (para Y)")
  // se muestran como el "sabor" del producto padre, no como una línea aparte.
  const incluidas = items.filter((i) => i.incluida);
  const principales = items.filter((i) => !i.incluida);

  const lineas = principales.map((item) => {
    const incluidaDeEste = incluidas.find((inc) => inc.name.includes(`(para ${item.name})`));
    const qty = item.qty || 1;
    const lineTotal = item.price * qty;
    const sabor = incluidaDeEste ? ` (sabor: ${incluidaDeEste.name.split(" (para ")[0]})` : "";
    return `• ${qty}x ${item.name}${sabor} — $${lineTotal.toFixed(2)}`;
  });

  let msg = `📋 Desglose del Pedido #${code}\nCliente: ${phone}\n\n${lineas.join("\n")}\n\nSubtotal: $${foodTotal.toFixed(2)}`;
  if (deliveryFee > 0) msg += `\nEnvío: $${deliveryFee.toFixed(2)}`;
  msg += `\nTotal: $${total.toFixed(2)}`;
  msg += `\n\n${deliveryType === "domicilio" ? `📍 Domicilio: ${address || "-"}` : "🏬 Retira en tienda"}`;

  return msg;
}

async function requestPaymentApproval(phone, session, botConfig, mediaId) {
  const ownerPhone = botConfig.ownerPhone;
  const orderNumber = await getOrderNumber(session);
  const code = "P" + orderNumber;
  const total = session.data.foodTotal + (session.data.deliveryFee || 0);

  session.step = "awaiting_approval";

  await APPROVALS_COL.doc(code).set({ phone, status: "pending", createdAt: Date.now() });

  await replyAndLog(phone, session, "📸 ¡Comprobante recibido! Lo estamos verificando, en un momento confirmamos tu pedido ✅");

  if (ownerPhone) {
    // 1) Primero el desglose del pedido, para que quede en concordancia con el comprobante
    await sendWhatsAppText(ownerPhone, buildOrderBreakdownText(phone, session, code));

    // 2) Después el comprobante de pago
    if (mediaId) {
      await sendWhatsAppImageById(
        ownerPhone,
        mediaId,
        `🧾 Comprobante de pago\nPedido #${code}\nCliente: ${phone}\nTotal: $${total.toFixed(2)}\n\nResponde: #${code} ok (confirmar) o #${code} no (rechazar)`
      );
    }
  }
}

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
  session.step = "delivery_payment_method";
  await replyAndLog(phone, session, `El envío tiene un valor de $${price.toFixed(2)} 🛵\n\n¿Cómo deseas pagar el *envío*?\n1. Efectivo (directo al motorizado)\n2. Transferencia`);
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

async function finalizeOrder(phone, session, confirmMsg = "✅ ¡Pago confirmado! Tu pedido ya fue enviado a cocina. En breve nos comunicamos si es necesario. ¡Gracias por tu compra! 🍔") {
  const { items, foodTotal, deliveryFee, address, deliveryType } = session.data;
  await replyAndLog(phone, session, confirmMsg);

  // Las bebidas incluidas (name = "X (para Y)") se juntan como "sabor" del producto padre,
  // en vez de mostrarse como una línea aparte.
  const incluidas = items.filter((i) => i.incluida);
  const principales = items.filter((i) => !i.incluida);
  const itemsList = principales.map((item) => {
    const incluidaDeEste = incluidas.find((inc) => inc.name.includes(`(para ${item.name})`));
    return {
      qty: item.qty || 1,
      name: item.name,
      category: item.category,
      unitPrice: item.price,
      total: item.price * (item.qty || 1),
      flavor: incluidaDeEste ? incluidaDeEste.name.split(" (para ")[0] : null,
    };
  });

  const orderNumber = await getOrderNumber(session); // el mismo número usado en la cotización/aprobación con el dueño
  const generatedCode = `#${orderNumber}`;
  
  const numericalFoodTotal = parseFloat(foodTotal) || 0;
  const numericalDeliveryFee = parseFloat(deliveryFee) || 0;

  await ORDERS_COL.add({
    code: generatedCode,
    client: phone,
    sector: deliveryType === "domicilio" ? address : "Retiro en tienda",
    items: itemsList,
    foodTotal: numericalFoodTotal,
    deliveryFee: numericalDeliveryFee,
    total: numericalFoodTotal + numericalDeliveryFee, 
    status: "process",
    startTime: Date.now(),
    dispatchTime: null,
    estimatedTravelMinutes: 10,
    date: new Date().toISOString().split("T")[0],
    chatHistory: session.chatHistory,
    source: "whatsapp_bot",
  });

  console.log(`✅ Pedido ${generatedCode} guardado para ${phone}`);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));