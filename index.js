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

// 🛠️ Muestra el formato claro con #F indicando cómo usar el 1 o el texto propio.
// Usa una transacción de Firestore para que, si dos avisos llegan casi al mismo tiempo
// (ej: confirmar pedido + marcar "listo para retiro" muy seguido), no se pisen entre sí.
async function sendComandoFEjemplo(ownerPhone, orderNumber, sugerencia) {
 if (!ownerPhone) return;

 const ref = SESSIONS_COL.doc(ownerSessionKey(ownerPhone));
 await db.runTransaction(async (t) => {
   const snap = await t.get(ref);
   const current = snap.exists ? snap.data() : { data: {} };
   if (!current.data) current.data = {};
   current.data[`sugerencia_${orderNumber}`] = sugerencia;
   current.lastInteraction = Date.now();
   t.set(ref, current);
 });

 await sendWhatsAppText(
   ownerPhone,
   `💬 *Notificación para el cliente*\nSugerencia automática para el Pedido #${orderNumber}:\n\n"${sugerencia}"\n\nElija una opción:\n1️⃣ Enviar sugerencia predeterminada: responda \`#F${orderNumber} 1\`\n2️⃣ Redactar mensaje personalizado: responda \`#F${orderNumber} <su mensaje>\``
 );
}

// Lee y borra la sugerencia guardada para ese pedido en una sola transacción atómica,
// para evitar que otro aviso la sobreescriba justo entre el "leer" y el "borrar".
async function consumeOwnerSuggestion(ownerPhone, orderNum) {
 const ref = SESSIONS_COL.doc(ownerSessionKey(ownerPhone));
 return db.runTransaction(async (t) => {
   const snap = await t.get(ref);
   if (!snap.exists) return null;
   const current = snap.data();
   const key = `sugerencia_${orderNum}`;
   const value = current.data?.[key];
   if (value === undefined) return null;
   delete current.data[key];
   current.lastInteraction = Date.now();
   t.set(ref, current);
   return value;
 });
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
     await handleOwnerReply(from, text);
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

// La clave de la "sesión" del dueño para guardar/leer sugerencias debe ser SIEMPRE la misma,
// sin importar si el teléfono llega con código de país, con "+", con espacios, o como lo haya
// escrito el dueño en Ajustes. Usamos los últimos 9 dígitos, igual que la detección de "es el dueño".
function ownerSessionKey(phone) {
 return "owner_" + normalizePhone(phone).slice(-9);
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
   await sendComandoFEjemplo(botConfig.ownerPhone, orderNumber, "su pedido está en preparación, toma aproximadamente 20 minutos");
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

   await goToDrinkStepOrDelivery(phone, session);
   await saveSession(phone, session);
   return;
 }

 if (session.step === "drink_yn") {
   if (text === "2") {
     await askSpecialNotes(phone, session);
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

   await askSpecialNotes(phone, session);
   await saveSession(phone, session);
   return;
 }

 if (session.step === "ask_special_notes") {
   if (text === "1") {
     await askOrderPaymentMethod(phone, session);
   } else if (text === "2") {
     session.step = "awaiting_note_text";
     await replyAndLog(phone, session, "Por favor, escribe tu mensaje o indicación a continuación:");
   } else {
     await replyAndLog(phone, session, "Responde 1 para continuar o 2 para escribirnos un mensaje.\n*(O escribe 'cancelar' para empezar de nuevo)*");
   }
   await saveSession(phone, session);
   return;
 }

 if (session.step === "awaiting_note_text") {
   session.data.notes = session.data.notes || [];
   session.data.notes.push(text);
   
   const orderNumber = await getOrderNumber(session);
   session.step = "awaiting_owner_reply";
   await replyAndLog(phone, session, "📩 Tu mensaje ha sido enviado al local. Por favor, espera un momento nuestra respuesta...");
   
   if (botConfig.ownerPhone) {
     await sendWhatsAppText(
       botConfig.ownerPhone, 
       `💬 Nuevo mensaje del cliente (Pedido #${orderNumber} / Tel: ${phone}):\n\n"${text}"\n\nPara responder, escribe:\n#M${orderNumber} <tu respuesta>`
     );
   }
   await saveSession(phone, session);
   return;
 }

 if (session.step === "awaiting_owner_reply") {
   await replyAndLog(phone, session, "Seguimos esperando la respuesta del local, un momento por favor 🙏.\n*(Si deseas continuar sin esperar más, responde '1')*");
   if (text === "1") {
       await askOrderPaymentMethod(phone, session);
   }
   await saveSession(phone, session);
   return;
 }

 if (session.step === "post_owner_reply") {
   if (text === "1") {
     await askOrderPaymentMethod(phone, session);
   } else if (text === "2") {
     session.step = "awaiting_note_text";
     await replyAndLog(phone, session, "Por favor, escribe tu nuevo mensaje:");
   } else {
     await replyAndLog(phone, session, "Responde 1 para Seguir con tu pedido o 2 para Enviar otro mensaje.");
   }
   await saveSession(phone, session);
   return;
 }

 if (session.step === "post_order_followup") {
   if (text === "1") {
     session.step = "post_order_reply_text";
     await replyAndLog(phone, session, "Escribe tu mensaje:");
   } else if (text === "2") {
     await replyAndLog(phone, session, "¡Perfecto! Gracias por tu compra 🍔 Que lo disfrutes.");
     await clearSession(phone);
     return;
   } else {
     await replyAndLog(phone, session, "Responde 1 para Responder o 2 para Finalizar la conversación.");
   }
   await saveSession(phone, session);
   return;
 }

 if (session.step === "post_order_reply_text") {
   const { botConfig } = await getBusinessConfig();
   const orderNum = session.data.orderNumber;
   if (botConfig.ownerPhone) {
     await sendWhatsAppText(botConfig.ownerPhone, `💬 Respuesta del cliente (Pedido #${orderNum}):\n"${text}"`);
   }
   session.step = "post_order_followup";
   await replyAndLog(phone, session, "Tu mensaje fue enviado al local ✅\n\n¿Deseas responder algo más o finalizar la conversación?\n1. Responder\n2. Finalizar conversación");
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
     `🛵 Nueva cotización de envío\nPedido #${code}\nCliente: ${phone}\nDirección: ${direccionOUbicacion}\n\nResponde escribiendo el precio (ej: \`3.00\`)`
   );
 }
}

function buildOrderBreakdownText(phone, session, code) {
 const { items = [], foodTotal = 0, deliveryFee = 0, address, deliveryType, orderPaymentMethod, deliveryPaymentMethod } = session.data;
 const total = foodTotal + (deliveryFee || 0);

 const incluidas = items.filter((i) => i.incluida);
 const principales = items.filter((i) => !i.incluida);

 const lineas = principales.map((item) => {
   const bebidaDeEste = incluidas.find((inc) => inc.category === "drink" && inc.name.includes(`(para ${item.name})`));
   const salsaDeEste = incluidas.find((inc) => inc.category === "sauce" && inc.name.includes(`(para ${item.name})`));
   const qty = item.qty || 1;
   const lineTotal = item.price * qty;
   let extras = "";
   if (bebidaDeEste) extras += ` (sabor bebida: ${bebidaDeEste.name.split(" (para ")[0]})`;
   if (salsaDeEste) extras += ` (salsa: ${salsaDeEste.name.split(" (para ")[0]})`;
   return `• ${qty}x ${item.name}${extras} — $${lineTotal.toFixed(2)}`;
 });

 const oMethod = orderPaymentMethod || 'efectivo';
 const dMethod = deliveryType === "domicilio" ? (deliveryPaymentMethod || 'efectivo') : null;

 let msg = `📋 Desglose del Pedido #${code}\nCliente: ${phone}\n\n${lineas.join("\n")}\n\nSubtotal: $${foodTotal.toFixed(2)} (${oMethod})`;
 if (deliveryFee > 0) msg += `\nEnvío: $${deliveryFee.toFixed(2)} (${dMethod})`;
 msg += `\nTotal General: $${total.toFixed(2)}`;
 
 const cashAmount = (oMethod === "efectivo" ? foodTotal : 0) + (dMethod === "efectivo" ? deliveryFee : 0);
 const transferAmount = (oMethod === "transferencia" ? foodTotal : 0) + (dMethod === "transferencia" ? deliveryFee : 0);

 msg += `\n`;
 if (transferAmount > 0) {
     msg += `\n💳 Comprobante debe ser por: $${transferAmount.toFixed(2)}`;
 }
 if (cashAmount > 0) {
     msg += `\n💵 A cobrar en efectivo: $${cashAmount.toFixed(2)}`;
 }

 if (session.data.notes && session.data.notes.length > 0) {
     msg += `\n\n📝 *Notas del cliente:*\n- ${session.data.notes.join("\n- ")}`;
 }

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
   await sendWhatsAppText(ownerPhone, buildOrderBreakdownText(phone, session, code));

   if (mediaId) {
     await sendWhatsAppImageById(
       ownerPhone,
       mediaId,
       `🧾 Comprobante de pago\nPedido #${code}\nCliente: ${phone}\nTotal: $${total.toFixed(2)}\n\nResponde: #${code} ok (confirmar) o #${code} no (rechazar)`
     );
   }

   await sendComandoFEjemplo(ownerPhone, orderNumber, "su pedido está en preparación, toma aproximadamente 20 minutos");
 }
}

// ============ MANEJADOR DE RESPUESTAS DEL DUEÑO (ACTUALIZADO AL FORMATO #F<pedido> 1 O MENSAJE) ============
async function handleOwnerReply(ownerPhone, text) {
 const trimmed = text.trim();

 // Si el mensaje del dueño empieza con #F seguido de un número y termina en "1" (Ej: #F7 1)
 const matchSugerencia = trimmed.match(/^#?F(\d{1,4})\s+1$/i);
 if (matchSugerencia) {
   const orderNum = matchSugerencia[1];
   const suggestion = await consumeOwnerSuggestion(ownerPhone, orderNum);

   if (suggestion) {
     await resolveFoodReadyMessage(`F${orderNum}`, suggestion, ownerPhone);
   } else {
     // Si por alguna razón la sugerencia expiró o no se encontró, enviamos el texto por defecto estándar
     await resolveFoodReadyMessage(`F${orderNum}`, "su pedido está en preparación, toma aproximadamente 20 minutos", ownerPhone);
   }
   return;
 }

 // Comportamiento normal con comandos tradicionales (#P, #M, #F con texto propio)
 const match = trimmed.match(/^#?([A-Za-z]?\d{1,4})\s+([\s\S]+)$/);
 if (!match) {
   await sendWhatsAppText(
     ownerPhone,
     "Formato no reconocido.\nPara usar sugerencia automática: *#F<código> 1*\nPara mensaje personalizado: *#F<código> <su mensaje>*"
   );
   return;
 }
 const code = match[1].toUpperCase();
 const rest = match[2].trim();

 if (code.startsWith("P")) {
   await resolvePaymentApproval(code, rest, ownerPhone);
 } else if (code.startsWith("M")) {
   await resolveOwnerMessage(code, rest, ownerPhone);
 } else if (code.startsWith("F")) {
   // Si escribe #F7 seguido de cualquier texto personalizado, se envía directo.
   // Limpiamos (atómicamente) la sugerencia pendiente guardada para ese pedido, si decidió escribir la suya propia.
   await consumeOwnerSuggestion(ownerPhone, code.substring(1));
   await resolveFoodReadyMessage(code, rest, ownerPhone);
 } else {
   await resolveDeliveryQuote(code, rest, ownerPhone);
 }
}

async function resolveFoodReadyMessage(code, rest, ownerPhone) {
 const orderNum = parseInt(code.substring(1), 10);
 if (isNaN(orderNum)) {
   if (ownerPhone) await sendWhatsAppText(ownerPhone, "Código de pedido inválido. Usa: #F<número> <mensaje>");
   return;
 }

 const snap = await ORDERS_COL.where("code", "==", `#${orderNum}`).limit(1).get();
 if (snap.empty) {
   if (ownerPhone) await sendWhatsAppText(ownerPhone, `No encontré el pedido #${orderNum}.`);
   return;
 }
 const orderData = snap.docs[0].data();
 const phone = orderData.phone || orderData.client;
 if (!phone) {
   if (ownerPhone) await sendWhatsAppText(ownerPhone, `El pedido #${orderNum} no tiene un teléfono asociado.`);
   return;
 }

 let session = (await getSession(phone)) || { data: {}, chatHistory: [] };
 session.data.orderNumber = orderNum;
 session.step = "post_order_followup";

 await replyAndLog(phone, session, `${rest}\n\n¿Deseas responder algo o finalizar la conversación?\n1. Responder\n2. Finalizar conversación`);
 await saveSession(phone, session);

 if (ownerPhone) await sendWhatsAppText(ownerPhone, `✅ Mensaje enviado con éxito al cliente del pedido #${orderNum}.`);
}

async function resolveOwnerMessage(code, rest, ownerPhone) {
 const orderNum = parseInt(code.substring(1), 10);
 
 const snap = await SESSIONS_COL.where("data.orderNumber", "==", orderNum).get();
 if (snap.empty) {
   if (ownerPhone) await sendWhatsAppText(ownerPhone, `No encontré un cliente en espera con el pedido #${orderNum}.`);
   return;
 }
 
 const phone = snap.docs[0].id;
 const session = snap.docs[0].data();
 
 if (session.step !== "awaiting_owner_reply") {
   if (ownerPhone) await sendWhatsAppText(ownerPhone, `El cliente del pedido #${orderNum} ya no está esperando respuesta.`);
   return;
 }

 session.step = "post_owner_reply";
 await replyAndLog(phone, session, `🧑‍🍳 *Respuesta del local:*\n"${rest}"\n\n¿Deseas enviarnos otro mensaje o seguimos con tu pedido?\n1. Seguir con mi pedido\n2. Enviar otro mensaje`);
 await saveSession(phone, session);
 
 if (ownerPhone) await sendWhatsAppText(ownerPhone, `✅ Respuesta enviada al cliente del pedido #${orderNum}.`);
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
 const { botConfig } = await getBusinessConfig();
 const baseMsg = botConfig.farewellMsg || confirmMsg;
 let finalMsg = baseMsg;
 
 if (botConfig.instagramUrl || botConfig.tiktokUrl) {
    if (botConfig.instagramUrl) finalMsg += `\n\n📸 *Instagram:* ${botConfig.instagramUrl}`;
    if (botConfig.tiktokUrl) finalMsg += `\n🎵 *TikTok:* ${botConfig.tiktokUrl}`;
 }

 const { items, foodTotal, deliveryFee, address, deliveryType } = session.data;
 await replyAndLog(phone, session, finalMsg);

 const incluidas = items.filter((i) => i.incluida);
 const principales = items.filter((i) => !i.incluida);
 const itemsList = principales.map((item) => {
   const bebidaDeEste = incluidas.find((inc) => inc.category === "drink" && inc.name.includes(`(para ${item.name})`));
   const salsaDeEste = incluidas.find((inc) => inc.category === "sauce" && inc.name.includes(`(para ${item.name})`));
   return {
     qty: item.qty || 1,
     name: item.name,
     category: item.category,
     unitPrice: item.price,
     total: item.price * (item.qty || 1),
     drinkFlavor: bebidaDeEste ? bebidaDeEste.name.split(" (para ")[0] : null,
     sauceFlavor: salsaDeEste ? salsaDeEste.name.split(" (para ")[0] : null,
   };
 });

 const orderNumber = await getOrderNumber(session); 
 const generatedCode = `#${orderNumber}`;
 
 const numericalFoodTotal = parseFloat(foodTotal) || 0;
 const numericalDeliveryFee = parseFloat(deliveryFee) || 0;

 await ORDERS_COL.add({
   code: generatedCode,
   client: phone,
   phone,
   deliveryType: deliveryType || "retiro",
   sector: deliveryType === "domicilio" ? address : "Retiro en tienda",
   items: itemsList,
   foodTotal: numericalFoodTotal,
   deliveryFee: numericalDeliveryFee,
   total: numericalFoodTotal + numericalDeliveryFee, 
   orderPaymentMethod: session.data.orderPaymentMethod || null,
   deliveryPaymentMethod: session.data.deliveryPaymentMethod || null,
   notes: session.data.notes || [],
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

app.post("/api/notify-ready", async (req, res) => {
 try {
   if (APP_API_SECRET && req.headers["x-api-secret"] !== APP_API_SECRET) {
     return res.sendStatus(401);
   }
   const { tipo, code, address, deliveryFee, clientPhone, total } = req.body;
   const { botConfig } = await getBusinessConfig();
   const ownerPhone = botConfig.ownerPhone;
   if (!ownerPhone) {
     return res.status(400).json({ error: "No hay un número de dueño configurado en la app." });
   }

   const fee = parseFloat(deliveryFee) || 0;
   const totalNum = parseFloat(total) || 0;
   const orderNumber = String(code || "").replace("#", "");
   let mensaje = "";
   let sugerenciaF = "";

   if (tipo === "retiro") {
     mensaje =
       `🏬 *¡Pedido listo para retiro!*\n\n` +
       `Pedido ${code || ""}\n` +
       `📞 Cliente: ${clientPhone || "No especificado"}\n` +
       `💵 Total a cobrar: $${totalNum.toFixed(2)}\n\n` +
       `El cliente puede acercarse al local a retirar su pedido.`;
     sugerenciaF = "tu pedido ya está listo, puedes acercarte a retirarlo cuando gustes";
   } else if (tipo === "despachado") {
     mensaje =
       `🛵 *Motorizado retiró el pedido*\n\n` +
       `Pedido ${code || ""}\n` +
       `💵 Valor del envío: $${fee.toFixed(2)} (en efectivo)`;
     sugerenciaF = "el motorizado ya va en camino con tu pedido";
   } else {
     mensaje =
       `🛵 *¡Pedido listo para despacho!*\n\n` +
       `Pedido ${code || ""}\n` +
       `📍 Ubicación: ${address || "No especificada"}\n` +
       `📞 Cliente: ${clientPhone || "No especificado"}\n` +
       `💵 Valor del envío: $${fee.toFixed(2)} (en efectivo)\n\n` +
       `Por favor, acércate al local a retirar el pedido para su despacho. ¡Muchas gracias! 🙏`;
     sugerenciaF = "tu pedido ya está listo, en breve el motorizado se dirige a entregarlo";
   }

   await sendWhatsAppText(ownerPhone, mensaje);
   if (orderNumber) await sendComandoFEjemplo(ownerPhone, orderNumber, sugerenciaF);

   res.json({ success: true });
 } catch (err) {
   console.error("⚠️ Error en /api/notify-ready:", err.response?.data || err.message);
   res.status(500).json({ error: "No se pudo enviar el mensaje." });
 }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor escuchando en http://localhost:${PORT}`));