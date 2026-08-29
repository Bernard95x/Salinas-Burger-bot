import React, { useState, useEffect, useRef } from "react";
import { FilePicker } from "@capawesome/capacitor-file-picker";
import { NativeSettings, AndroidSettings } from "capacitor-native-settings";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";

// === AQUÍ CONFIGURAMOS FIREBASE CON TUS CREDENCIALES ===
import { initializeApp } from "firebase/app";
import { initializeFirestore, doc, setDoc, collection, onSnapshot, query, orderBy, getDocs, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCy3LgmAsOKYC5Iq18EiSaogvQeJlI_q0E",
  authDomain: "salinasburger.firebaseapp.com",
  projectId: "salinasburger",
  storageBucket: "salinasburger.firebasestorage.app",
  messagingSenderId: "104387671471",
  appId: "1:104387671471:web:3b9a44f00eedf8cf87eb5a"
};

// Inicializamos Firebase y Firestore
const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
// ========================================================

import {
  Flame, UtensilsCrossed, MessageCircle, ListChecks, Banknote, PieChart, Scale,
  Plus, Pencil, X, Bike, Clock, TrendingUp, Flag, AlertTriangle, CircleCheck,
  Settings, Calendar, DollarSign, ShoppingBag, ArrowRight, Sliders, LogOut, Save, Image as ImageIcon, Bell, FileText, Upload, Wine, Trash2, Droplet
} from "lucide-react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Cell
} from "recharts";

const MENU_INICIAL = [
  { id: 1, name: "Clásica Burger", category: "burger", price: 3.5, desc: "Pan de papa, carnes smash, tocino, queso cheddar y mozzarella, mayonesa smash.", available: true, imgKey: "Clásica Burger.png" },
  { id: 2, name: "Bacon Burger", category: "burger", price: 5.5, desc: "Pan de vainiquilla, carne smash, queso cheddar y mozzarella, mermelada de tocino, 4 tocino crujiente, mayonesa smash.", available: true, imgKey: "Bacon Burger.png" },
  { id: 3, name: "Jalapeño Burger", category: "burger", price: 5.5, desc: "Pan de papa, carne smash, doble queso cheddar y mozzarella, doble tocino crujiente, jalapeños, cebolla crispy, mayonesa de tocino con chipotle.", available: true, imgKey: "Jalapeño Burger.png" },
  { id: 4, name: "Sweet Onion Burger", category: "burger", price: 5.5, desc: "Pan de papa, pepinillos agridulces, doble queso mozzarella, doble carne smasheada, cebolla perla, salsa barbacoa rebajada en whisky.", available: true, imgKey: "Sweet Onion Burger.png" },
  { id: 5, name: "Bandida Burger", category: "burger", price: 6.0, desc: "Pan de mozzarella y orégano, carne smash, chorizo de cerdo, doble queso mozzarella, chimichurri, salsa verde de la casa.", available: true, imgKey: "Bandida Burger.png" },
  { id: 6, name: "Chizz Burger", category: "burger", price: 6.5, desc: "Pan de papa, doble carne, doble queso cheddar, cuatro tocinos crujiente, queso cheddar fundido, mayonesa smash.", available: true, imgKey: "Chizz Burger.png" },
  { id: 7, name: "Carnívora Burger", category: "burger", price: 6.5, desc: "Pan de vainiquilla, triple carne, triple queso cheddar, salsa barbacoa rebajada en whisky.", available: true, imgKey: "Carnívora Burger.png" },
  { id: 8, name: "Golosa Burger", category: "burger", price: 7.0, desc: "Pan de vainiquilla, doble carne, doble queso cheddar, triple aro de cebolla, salsa barbacoa rebajada en whisky, mayonesa de la casa.", available: true, imgKey: "Golosa Burger.png" },
  { id: 9, name: "Grosera Burger", category: "burger", price: 7.5, desc: "Pan de vainiquilla, doble carne smash (200g), doble queso cheddar, doble mozzarella, tocino crujiente, salsa agridulce de tocino, pepinillos, triple aro de cebolla.", available: true, imgKey: "Grosera Burger.png" },
  { id: 10, name: "Papas Marranitas", category: "other", price: 3.5, desc: "350g de papas bañadas en queso cheddar, mayonesa de tocino con chipotle, tocino crocante, chorizo de cerdo. Incluye cola personal.", available: true, imgKey: "Papas Marranitas.png" },
  
  { id: 19, name: "Coca-Cola Personal", category: "drink", volume: "300 ml", price: 0.75, desc: "Gaseosa fría personal.", available: true, imgKey: "coca_300.png" },
  { id: 20, name: "Sprite Personal", category: "drink", volume: "300 ml", price: 0.75, desc: "Gaseosa lima-limón fría personal.", available: true, imgKey: "sprite_300.png" },
  { id: 21, name: "Fanta Personal", category: "drink", volume: "300 ml", price: 0.75, desc: "Gaseosa sabor naranja fría personal.", available: true, imgKey: "fanta_300.png" },
  { id: 22, name: "Coca-Cola Litro y Medio", category: "drink", volume: "1.5 LT", price: 2.25, desc: "Gaseosa familiar ideal para compartir.", available: true, imgKey: "coca_1.5lt.png" },

  { id: 11, name: "Combo #1 (Grosera + Bandida)", category: "combo", price: 11.0, desc: "1 Grosera Burger + 1 Bandida Burger.", available: true, components: [9, 5], imgKey: "Combo #1 (Grosera + Bandida).png" },
  { id: 12, name: "Combo #2 (Carnívora + Bacon)", category: "combo", price: 10.0, desc: "1 Carnívora Burger + 1 Bacon Burger.", available: true, components: [7, 2], imgKey: "Combo #2 (Carnívora + Bacon).png" },
  { id: 13, name: "Combo #3 (Jalapeño + Bacon + Clásica)", category: "combo", price: 11.0, desc: "1 Jalapeño Burger + 1 Bacon Burger + 1 Clásica Burger.", available: true, components: [3, 2, 1], imgKey: "Combo #3 (Jalapeño + Bacon + Clásica).png" },
  { id: 14, name: "Combo #4 (Papas Marranitas + Grosera + Cola)", category: "combo", price: 10.0, desc: "1 Papas Marranita + 1 Grosera Burger + 1 Cola Personal 300ml.", available: true, components: [10, 9], extraCost: 0.35, imgKey: "Combo #4 (Papas Marranitas + Grosera + Cola).png" },
  { id: 15, name: "Combo #5 (Papas Marranitas + Carnívora + Cola)", category: "combo", price: 9.0, desc: "1 Papas Marranita + 1 Carnívora Burger + 1 Cola Personal 300ml.", available: true, components: [10, 7], extraCost: 0.35, imgKey: "Combo #5 (Papas Marranitas + Carnívora + Cola).png" },
  { id: 16, name: "Combo #6 (Papas Marranitas + Bandida + Cola)", category: "combo", price: 8.5, desc: "1 Papas Marranita + 1 Bandida Burger + 1 Cola Personal 300ml.", available: true, components: [10, 5], extraCost: 0.35, imgKey: "Combo #6 (Papas Marranitas + Bandida + Cola).png" },
  { id: 17, name: "Combo #7 (Papas Marranitas + Bacon + Cola)", category: "combo", price: 8.0, desc: "1 Papas Marranita + 1 Bacon Burger + 1 Cola Personal 300ml.", available: true, components: [10, 2], extraCost: 0.35, imgKey: "Combo #7 (Papas Marranitas + Bacon + Cola).png" },
  { id: 18, name: "Combo #8 (Papas Marranitas + Jalapeño + Cola)", category: "combo", price: 8.0, desc: "1 Papas Marranita + 1 Jalapeño Burger + 1 Cola Personal 300ml.", available: true, components: [10, 3], extraCost: 0.35, imgKey: "Combo #8 (Papas Marranitas + Jalapeño + Cola).png" },

  { id: 23, name: "Cheddar", category: "sauce", price: 0, desc: "Salsa de queso cheddar.", available: true },
  { id: 24, name: "Chipotle (picante)", category: "sauce", price: 0, desc: "Salsa chipotle picante.", available: true },
  { id: 25, name: "Albahaca", category: "sauce", price: 0, desc: "Salsa de albahaca.", available: true },
];

const INGREDIENTES_INICIAL = {
  "Pan de papa": 0.35, "Pan de vainiquilla": 0.4, "Pan de mozzarella y orégano": 0.45,
  "Carne smash": 0.8, "Tocino": 0.5, "Queso cheddar": 0.4, "Queso mozzarella": 0.4,
  "Mayonesa smash": 0.15, "Mermelada de tocino": 0.3, "Jalapeños": 0.2, "Cebolla crispy": 0.2,
  "Mayonesa de tocino con chipotle": 0.2, "Pepinillos agridulces": 0.25, "Cebolla perla": 0.15,
  "Salsa barbacoa rebajada en whisky": 0.3, "Chorizo de cerdo": 0.7, "Chimichurri": 0.15,
  "Salsa verde de la casa": 0.15, "Aro de cebolla": 0.2, "Papas (350g)": 0.8, "Cola personal 300ml": 0.35,
};

const ECUADOR_BANKS = [
  "Banco Pichincha", "Banco Guayaquil", "Banco del Pacífico", "Banco Bolivariano",
  "Produbanco", "Banco Internacional", "Banco General Rumiñahui", "Banco de Machala",
  "Banco Solidario", "Banco ProCredit", "Banco Amazonas", "Banco Comercial de Manabí",
  "Banco de Loja", "Banco D-MIRO", "Banco Finca", "Cooperativa JEP",
  "Cooperativa Policía Nacional", "Banco VisionFund Ecuador", "Otro",
];

const ORDEN_INICIAL = {
  id: 1, code: "ORD-001", client: "Carlos Mendoza", phone: "+593 98 123 4567",
  items: "1x Grosera Burger ($7.50), 1x Papas Marranitas ($3.50)",
  foodTotal: 11.0, deliveryFee: 3.0, sector: "Chipipe", status: "process",
  startTime: Date.now() - 120000, dispatchTime: null, estimatedTravelMinutes: 12,
  chatHistory: [
    { sender: "client", text: "Hola buenas noches" },
    { sender: "ai", text: "¡Hola! Bienvenido a Salinas Burger 🍔. ¿En qué le podemos ayudar hoy? Le comparto nuestro menú digital." },
    { sender: "client", text: "Quiero una Grosera Burger y unas papas marranitas y estoy por Chipipe." },
    { sender: "ai", text: "Compartiendo ubicación con motorizado para cotizar envío..." },
    { sender: "delivery", text: "3 0" },
    { sender: "ai", text: "El costo del envío para Chipipe es $3.00 en efectivo al motorizado. El pago de su pedido ($11.00) es por transferencia. ¿Desea continuar? Y si es así, me envía el comprobante para proceder con su pedido." },
    { sender: "client", text: "Sí, acepto. Aquí le envío mi comprobante de transferencia." },
    { sender: "client", text: "[Imagen adjunta: Comprobante de Transferencia]" },
    { sender: "ai", text: "✅ ¡Comprobante verificado con éxito! Listo, su pedido se está realizando y ya fue enviado a cocina para su preparación 🍳." },
  ],
};

const RANKING = [
  { nombre: "Grosera Burger", ventas: 142 }, { nombre: "Bacon Burger", ventas: 118 },
  { nombre: "Combo #1", ventas: 95 }, { nombre: "Papas Marranitas", ventas: 84 },
  { nombre: "Carnívora Burger", ventas: 76 },
];

const VENTAS_HORA = [
  { hora: "17:00", volumen: 12 }, { hora: "18:00", volumen: 35 }, { hora: "19:00", volumen: 68 },
  { hora: "20:00", volumen: 95 }, { hora: "21:00", volumen: 110 }, { hora: "22:00", volumen: 85 }, { hora: "23:00", volumen: 40 },
];

const HISTORIAL_ENVIOS_INICIAL = [
  { id: 1, sector: "Chipipe", fecha: "2026-08-15", costo: 3.0, distancia: "2.4 km", pedidoId: "ORD-001" },
  { id: 2, sector: "Chipipe", fecha: "2026-08-14", costo: 3.5, distancia: "2.6 km", pedidoId: "ORD-092" },
  { id: 3, sector: "Chipipe", fecha: "2026-08-12", costo: 3.0, distancia: "2.4 km", pedidoId: "ORD-085" },
  { id: 4, sector: "San Lorenzo", fecha: "2026-08-15", costo: 2.5, distancia: "1.8 km", pedidoId: "ORD-002" },
  { id: 5, sector: "San Lorenzo", fecha: "2026-08-13", costo: 2.5, distancia: "1.7 km", pedidoId: "ORD-078" },
  { id: 6, sector: "La Milina", fecha: "2026-08-15", costo: 4.0, distancia: "4.5 km", pedidoId: "ORD-003" },
  { id: 7, sector: "La Milina", fecha: "2026-08-11", costo: 5.0, distancia: "4.8 km", pedidoId: "ORD-065" },
  { id: 8, sector: "Bufadero", fecha: "2026-08-14", costo: 3.5, distancia: "3.2 km", pedidoId: "ORD-088" },
  { id: 9, sector: "Bufadero", fecha: "2026-08-10", costo: 3.5, distancia: "3.1 km", pedidoId: "ORD-055" },
  { id: 10, sector: "Ecuatoriano Suizo", fecha: "2026-08-15", costo: 3.0, distancia: "2.5 km", pedidoId: "ORD-004" },
];

const ESTADO_LABEL = { process: "process", ready: "process", sent: "sent", delivered: "delivered" };

const TABS = [
  { id: "menu", label: "Menú & Combos", icon: UtensilsCrossed },
  { id: "orders", label: "Pedidos WhatsApp / IA", icon: MessageCircle },
  { id: "kanban", label: "Producción & Tiempos", icon: ListChecks },
  { id: "historial", label: "Historial de Envíos", icon: Bike },
  { id: "cash", label: "Caja Diaria & Arqueo", icon: Banknote },
  { id: "analytics", label: "Analíticas", icon: PieChart },
  { id: "reports", label: "Reportes Históricos", icon: Calendar },
  { id: "botconfig", label: "Configurar Bot IA", icon: Settings },
  { id: "ingredients", label: "Ingredientes & Costos", icon: Scale },
];

function playCustomSound(eventType, soundStyle, volume = 0.5) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);
    masterGain.connect(ctx.destination);
    const now = ctx.currentTime;

    const playNotes = (notes, type = "sine", duration = 0.25, gap = 0.08) => {
      notes.forEach((f, idx) => {
        const osc = ctx.createOscillator(); const g = ctx.createGain();
        osc.type = type; osc.frequency.setValueAtTime(f, now + idx * gap);
        g.gain.setValueAtTime(0.3, now + idx * gap); g.gain.exponentialRampToValueAtTime(0.001, now + idx * gap + duration);
        osc.connect(g); g.connect(masterGain); osc.start(now + idx * gap); osc.stop(now + idx * gap + duration);
      });
    };

    if (eventType === "new-order") {
      switch (soundStyle) {
        case "msg_pop": playNotes([800, 1200], "sine", 0.15, 0.06); break;
        case "bell_soft": playNotes([659.25, 783.99], "sine", 0.3, 0.1); break;
        case "marimba_note": playNotes([523.25, 659.25, 783.99], "triangle", 0.2, 0.08); break;
        default: playNotes([800, 1200], "sine", 0.15, 0.06); break;
      }
    } else if (eventType === "arrival") {
      switch (soundStyle) {
        case "double_beep": playNotes([880, 880], "square", 0.15, 0.15); break;
        case "horn_soft": playNotes([350, 440], "sawtooth", 0.3, 0.12); break;
        default: playNotes([880, 880], "square", 0.15, 0.15); break;
      }
    }
  } catch (e) {}
}

const QUANTITY_WORDS = [{ word: "cuatro", factor: 4 }, { word: "triple", factor: 3 }, { word: "doble", factor: 2 }];
const DATA_FILE_NAME = "salinas_burger_data.json";

function segmentCost(segment, ingredientsMap) {
  const lower = segment.toLowerCase();
  let factor = 1;
  for (const q of QUANTITY_WORDS) { if (lower.includes(q.word)) { factor = q.factor; break; } }
  let cost = 0;
  for (const [ing, ingCost] of Object.entries(ingredientsMap)) {
    if (lower.includes(ing.toLowerCase())) cost += ingCost * factor;
  }
  return cost;
}

function calculateSingleItemCost(desc, ingredientsMap) {
  const baseCost = 0.3;
  const segments = desc.split(",");
  let total = baseCost;
  segments.forEach((seg) => { total += segmentCost(seg, ingredientsMap); });
  return Math.max(total, 1.0);
}

function calculatePlateCost(item, allItems, ingredientsMap) {
  if (item.category === "drink") return item.price * 0.4;
  if (item.components && item.components.length) {
    let total = item.extraCost || 0;
    item.components.forEach((cid) => {
      const comp = allItems.find((m) => m.id === cid);
      if (comp) total += calculateSingleItemCost(comp.desc, ingredientsMap);
    });
    return total;
  }
  return calculateSingleItemCost(item.desc, ingredientsMap);
}

export default function App() {
  const [tab, setTab] = useState("menu");
  const [menuFilter, setMenuFilter] = useState("all");
  const [menuItems, setMenuItems] = useState(MENU_INICIAL);
  const [ingredientes, setIngredientes] = useState(INGREDIENTES_INICIAL);
  const [orders, setOrders] = useState([ORDEN_INICIAL]);
  const [selectedOrderId, setSelectedOrderId] = useState(1);
  const [historialEnvios, setHistorialEnvios] = useState(HISTORIAL_ENVIOS_INICIAL);
  const [nuevoEnvioModal, setNuevoEnvioModal] = useState(false);
  const [nuevoEnvioForm, setNuevoEnvioForm] = useState({ sector: "Chipipe", costo: "", distancia: "2.0 km", pedidoId: "ORD-00X" });

  const [cashTransactions, setCashTransactions] = useState([
    { id: 1, type: "income", desc: "Pedido #1 - Comida (Transferencia Verificada)", amount: 11.0, category: "transfer", date: new Date().toISOString().split("T")[0] },
  ]);
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([
    { id: 1, title: "Catálogo actualizado", message: "Menú activo y sincronizado.", type: "success", time: "Hace 5 min" },
    { id: 2, title: "Nuevo Pedido", message: "Recibido #ORD-001 de Carlos Mendoza.", type: "new-order", time: "Hace 12 min" }
  ]);
  const [notificationsModal, setNotificationsModal] = useState(false);

  const [productModal, setProductModal] = useState(null);
  const [expenseModal, setExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ desc: "", amount: "" });
  const [cashCloseModal, setCashCloseModal] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [exitConfirmModal, setExitConfirmModal] = useState(false);
  const [storagePermissionModal, setStoragePermissionModal] = useState(false);

  // Función para persistir automáticamente en el almacenamiento local del dispositivo
  const autoSaveLocally = async () => {
    try {
      const snapshot = {
        menuItems, ingredientes, orders, historialEnvios, cashTransactions,
        notifications, botConfig, bankHolders, audioSettings,
      };
      await Filesystem.writeFile({
        path: DATA_FILE_NAME,
        directory: Directory.Data,
        data: JSON.stringify(snapshot),
        encoding: Encoding.UTF8,
      });
    } catch (err) {
      // Error silencioso para autoguardado local
    }
  };

  const handleSelectProductImage = async () => {
    try {
      const result = await FilePicker.pickImages({ multiple: false, readData: true });
      if (!result.files || result.files.length === 0) return;
      const file = result.files[0];
      setProductModal((prev) => ({ ...prev, img: `data:${file.mimeType || "image/png"};base64,${file.data}` }));
    } catch (err) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("permission") || msg.includes("denied")) {
        setStoragePermissionModal(true);
      } else if (!msg.includes("cancel")) {
        showToast("Aviso", "No se pudo leer la imagen seleccionada.", "alert");
      }
    }
  };

  const handleSelectLogo = async () => {
    try {
      const result = await FilePicker.pickImages({ multiple: false, readData: true });
      if (!result.files || result.files.length === 0) return;
      const file = result.files[0];
      setAudioSettings((prev) => ({ ...prev, logoUrl: `data:${file.mimeType || "image/png"};base64,${file.data}` }));
      setHasUnsavedChanges(true);
      autoSaveLocally();
      showToast("Logo Actualizado", "El logo de la app se actualizó correctamente.", "success");
    } catch (err) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("permission") || msg.includes("denied")) {
        setStoragePermissionModal(true);
      } else if (!msg.includes("cancel")) {
        showToast("Aviso", "No se pudo leer la imagen seleccionada.", "alert");
      }
    }
  };

  const [botConfig, setBotConfig] = useState({
    welcomeMsg: "¡Hola! te saluda Salinas Burger 🍔. Por el momento no tenemos local físico, trabajamos con envío a domicilio o puedes retirar tu pedido en nuestra ubicación.\nHorario de atención\nMiércoles, Jueves y Viernes\n19:30 - 22:30\nSábado y Domingo\n17:00 - 22:30\nConsulta nuestras promociones, te comparto nuestro menú",
    menuPdfName: "Menú Salinas Burger.pdf",
    menuPdfSize: "2.4 MB",
    upsellMsg: "¿Te gustaría agregar unas Papas Marranitas o una bebida adicional por un costo preferencial?",
    soldOutMsg: "Lo sentimos mucho, este plato se encuentra temporalmente agotado. ¿Deseas elegir otra opción de nuestro menú?",
    farewellMsg: "✅ ¡Tu pedido está confirmado y ya fue enviado a cocina! 🍳 Recuerda tener tu pago listo. ¡Gracias por tu compra! 🍔\n\nAyúdanos a crecer siguiéndonos o etiquetándonos en nuestras redes sociales, ¡nos encantaría verte por ahí!",
    instagramUrl: "",
    tiktokUrl: ""
  });

  const [bankHolders, setBankHolders] = useState([
    {
      id: 1,
      nombre: "Armando Agustin De la A Ruiz",
      cedula: "0927547695",
      correo: "salinasburger2014@gmail.com",
      cuentas: [
        { id: 1, banco: "Banco Pichincha", tipo: "Ahorros", numero: "2203850545" },
      ],
    },
    {
      id: 2,
      nombre: "Adriana Katherine Luzardo Cadena",
      cedula: "0930359047",
      correo: "salinasburger2014@gmail.com",
      cuentas: [
        { id: 1, banco: "Banco Pacífico", tipo: "Ahorros", numero: "1051952661" },
        { id: 2, banco: "Banco Guayaquil", tipo: "Ahorros", numero: "0029760858" },
        { id: 3, banco: "Produbanco", tipo: "Ahorros", numero: "20059980281" },
        { id: 4, banco: "Banco General Rumiñahui", tipo: "Ahorros", numero: "8637256000" },
      ],
    },
  ]);

  const addBankHolder = () => {
    setBankHolders((prev) => [...prev, { id: Date.now(), nombre: "", cedula: "", correo: "", cuentas: [{ id: Date.now(), banco: ECUADOR_BANKS[0], tipo: "Ahorros", numero: "" }] }]);
    setHasUnsavedChanges(true);
    autoSaveLocally();
  };
  const removeBankHolder = (holderId) => {
    setBankHolders((prev) => prev.filter((h) => h.id !== holderId));
    setHasUnsavedChanges(true);
    autoSaveLocally();
  };
  const updateBankHolder = (holderId, field, value) => {
    setBankHolders((prev) => prev.map((h) => (h.id === holderId ? { ...h, [field]: value } : h)));
    setHasUnsavedChanges(true);
    autoSaveLocally();
  };
  const addBankAccountToHolder = (holderId) => {
    setBankHolders((prev) => prev.map((h) => (h.id === holderId ? { ...h, cuentas: [...h.cuentas, { id: Date.now(), banco: ECUADOR_BANKS[0], tipo: "Ahorros", numero: "" }] } : h)));
    setHasUnsavedChanges(true);
    autoSaveLocally();
  };
  const removeBankAccountFromHolder = (holderId, cuentaId) => {
    setBankHolders((prev) => prev.map((h) => (h.id === holderId ? { ...h, cuentas: h.cuentas.filter((c) => c.id !== cuentaId) } : h)));
    setHasUnsavedChanges(true);
    autoSaveLocally();
  };
  const updateBankAccountInHolder = (holderId, cuentaId, field, value) => {
    setBankHolders((prev) => prev.map((h) => (h.id === holderId ? { ...h, cuentas: h.cuentas.map((c) => (c.id === cuentaId ? { ...c, [field]: value } : c)) } : h)));
    setHasUnsavedChanges(true);
    autoSaveLocally();
  };

  const formatBankAccountsForChat = (holders) => {
    if (!holders.length) return "nuestras cuentas bancarias (aún no configuradas)";
    return "\n\n" + holders
      .map((h) => {
        const cuentasTxt = h.cuentas.map((c) => `${c.banco}: Cuenta de ${c.tipo} # ${c.numero}`).join("\n");
        return `${cuentasTxt}\nCédula: ${h.cedula}\nNombre: ${h.nombre}\nCorreo: ${h.correo}`;
      })
      .join("\n\n");
  };

  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [settingsModal, setSettingsModal] = useState(false);
  
  const [audioSettings, setAudioSettings] = useState({
    volume: 0.6,
    newOrderSound: "msg_pop",
    arrivalSound: "double_beep",
    motorcyclePhone: "+593 99 999 9999",
    ownerPhone: "+5930939851968",
    whatsappBusinessPhone: "+593 98 888 8888",
    logoUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=200&q=80"
  });

  const audioSettingsRef = useRef(audioSettings);
  const menuItemsRef = useRef(menuItems);
  useEffect(() => {
    audioSettingsRef.current = audioSettings;
  }, [audioSettings]);

  useEffect(() => {
    menuItemsRef.current = menuItems;
  }, [menuItems]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (tab === "kanban" && orders.some((o) => o.status === "sent")) setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [tab, orders]);

  const showToast = (title, message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setNotifications((prev) => [{ id, title, message, type, time: "Hace un momento" }, ...prev]);

    const currentAudio = audioSettingsRef.current;
    if (type === "new-order") {
      playCustomSound("new-order", currentAudio.newOrderSound, currentAudio.volume);
    } else if (type === "gps-arrival") {
      playCustomSound("arrival", currentAudio.arrivalSound, currentAudio.volume);
    }

    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  };

  const filteredMenu = menuFilter === "all" ? menuItems : menuItems.filter((i) => i.category === menuFilter);

  const toggleAvailability = (id) => {
    setMenuItems((prev) => prev.map((i) => (i.id === id ? { ...i, available: !i.available } : i)));
    setHasUnsavedChanges(true);
    autoSaveLocally();
    const item = menuItems.find((i) => i.id === id);
    if (item) showToast("Estado Actualizado", `"${item.name}" ahora está ${!item.available ? "Disponible" : "Agotado"}.`, "alert");
  };

  const saveProduct = () => {
    const { id, name, category, price, volume, desc, img } = productModal;
    const priceNum = category === "sauce" ? 0 : parseFloat(price) || 0;
    if (!name || (category !== "sauce" && priceNum <= 0)) { showToast("Atención", "Completa el nombre y un precio válido.", "alert"); return; }
    if (id) {
      setMenuItems((prev) => prev.map((i) => (i.id === id ? { ...i, name, category, price: priceNum, volume: category === "drink" ? volume : undefined, desc, img } : i)));
      showToast("Ítem Actualizado", `Se guardaron los cambios en "${name}".`, "success");
    } else {
      const newId = menuItems.length ? Math.max(...menuItems.map((i) => i.id)) + 1 : 1;
      setMenuItems((prev) => [...prev, { id: newId, name, category, price: priceNum, volume: category === "drink" ? volume : undefined, desc, img, available: true }]);
      showToast("Nuevo Ítem Creado", `Se agregó "${name}" al menú.`, "success");
    }
    setHasUnsavedChanges(true);
    autoSaveLocally();
    setProductModal(null);
  };

  const markFoodReady = (id) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: "ready" } : o)));
    autoSaveLocally();
    showToast("Aviso a Motorizado 🛵", `Mensaje enviado al número ${audioSettings.motorcyclePhone} de la agencia: "Pedido #${id} listo, pasar retirando".`, "whatsapp");
  };

  const moveOrder = (id, newStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: newStatus, dispatchTime: newStatus === "sent" ? Date.now() : o.dispatchTime } : o))
    );
    autoSaveLocally();
    const ord = orders.find((o) => o.id === id);
    if (newStatus === "sent") {
      showToast("Motorizado en Ruta 🛵", `Pedido #${id} retirado del local. Cronometrando tiempo hacia el cliente...`, "whatsapp");
      setTimeout(() => {
        showToast("¡Repartidor ha llegado!", `Pedido #${id}: completó el tiempo de ruta hacia el cliente. Revise su WhatsApp.`, "gps-arrival");
      }, (ord?.estimatedTravelMinutes || 10) * 1000);
    } else {
      showToast("Estado Actualizado", `Pedido #${id} marcado como ${newStatus.toUpperCase()}`, "success");
    }
  };

  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const getAvailableDrinks = (menu) => {
    return menu.filter((i) => i.category === "drink" && i.available);
  };

  const simulateNewOrder = () => {
    const currentMenu = menuItemsRef.current;
    const names = ["Esteban Pérez", "Andrea Gómez", "Luis Alcívar", "Gabriela Torres"];
    const sectoresList = ["Chipipe", "San Lorenzo", "La Milina", "Bufadero", "Ecuatoriano Suizo"];
    const name = pickRandom(names);
    const sectorSel = pickRandom(sectoresList);
    const newId = orders.length ? Math.max(...orders.map((o) => o.id)) + 1 : 1;
    const todayStr = new Date().toISOString().split("T")[0];

    const allBurgers = currentMenu.filter((i) => i.category === "burger");
    const allDrinks = getAvailableDrinks(currentMenu);
    const allSides = currentMenu.filter((i) => i.category === "other" && i.available);

    const requestedBurger = pickRandom(allBurgers);
    const orderLines = [];
    let foodTotal = 0;

    const checkAndAdd = (item, fallbackList) => {
      if (!item) return;
      if (item.available) {
        orderLines.push(item);
        foodTotal += item.price;
      } else {
        const fallback = fallbackList.find((i) => i.available && i.id !== item.id);
        if (fallback) {
          orderLines.push(fallback);
          foodTotal += fallback.price;
        }
      }
    };

    checkAndAdd(requestedBurger, allBurgers);

    let chatHistory = [];
    chatHistory.push({ sender: "client", text: `Hola, quiero una ${requestedBurger.name}.` });
    chatHistory.push({ sender: "ai", text: botConfig.welcomeMsg });
    chatHistory.push({ sender: "ai", text: `📄 [PDF adjunto del menú: ${botConfig.menuPdfName}]` });

    // Simulación de cliente recurrente (ubicación previa) vs nueva ubicación
    const isRecurringClient = Math.random() < 0.5;
    if (isRecurringClient) {
      chatHistory.push({ sender: "ai", text: `Hola ${name}, veo que ya nos has pedido antes. ¿Deseas que enviemos tu pedido a tu última ubicación guardada (${sectorSel}) o prefieres enviar una nueva ubicación?` });
      const usesPrevious = Math.random() < 0.5;
      if (usesPrevious) {
        chatHistory.push({ sender: "client", text: "Sí, envíalo a mi última ubicación por favor." });
        chatHistory.push({ sender: "ai", text: `Compartiendo ubicación anterior (${sectorSel}) con el motorizado para cotizar envío...` });
      } else {
        chatHistory.push({ sender: "client", text: "No, aquí está mi nueva ubicación: San Lorenzo." });
        chatHistory.push({ sender: "ai", text: "Compartiendo nueva ubicación (San Lorenzo) con el motorizado para cotizar envío..." });
      }
    } else {
      chatHistory.push({ sender: "ai", text: "¿Tu pedido es con envío a domicilio o para retirar en tienda?" });
      chatHistory.push({ sender: "client", text: `Es con envío a domicilio, estoy por ${sectorSel}.` });
      chatHistory.push({ sender: "ai", text: `Compartiendo ubicación actual (${sectorSel}) con el motorizado para cotizar envío...` });
    }

    const sidesText = allSides.map(s => `${s.name} ($${s.price.toFixed(2)})`).join(", ");
    chatHistory.push({ 
      sender: "ai", 
      text: `¿Le gustaría acompañar su hamburguesa con alguna de nuestras opciones como ${sidesText}?` 
    });

    const acceptsSide = Math.random() < 0.5;
    let chosenSide = null;
    if (acceptsSide && allSides.length > 0) {
      chosenSide = pickRandom(allSides);
      chatHistory.push({ sender: "client", text: `Sí, agrégame unas ${chosenSide.name}.` });
      orderLines.push(chosenSide);
      foodTotal += chosenSide.price;
    } else {
      chatHistory.push({ sender: "client", text: "No, gracias, así está bien." });
    }

    // Dinámica avanzada de bebidas con lectura dinámica de capacidades desde el menú
    const wantsDrink = Math.random() < 0.6;
    if (wantsDrink && allDrinks.length > 0) {
      chatHistory.push({ sender: "client", text: `Deme una cola.` });
      
      // Agrupamos dinámicamente todas las capacidades disponibles en el menú activo
      const availableCapacitiesMap = {};
      allDrinks.forEach(d => {
        const vol = d.volume || "Personal";
        if (!availableCapacitiesMap[vol]) {
          availableCapacitiesMap[vol] = { price: d.price, drinks: [] };
        }
        availableCapacitiesMap[vol].drinks.push(d);
      });

      const uniqueCapacities = Object.keys(availableCapacitiesMap);
      const capacitiesText = uniqueCapacities.join(", ");

      chatHistory.push({ 
        sender: "ai", 
        text: `¿Qué presentación prefiere? Tenemos disponibles: ${capacitiesText}.` 
      });

      const chosenCapacity = pickRandom(uniqueCapacities);
      const capacityData = availableCapacitiesMap[chosenCapacity];
      const brandNames = capacityData.drinks.map(d => d.name).join(", ");

      chatHistory.push({ sender: "client", text: `Deme una de ${chosenCapacity}.` });
      chatHistory.push({ 
        sender: "ai", 
        text: `La bebida de ${chosenCapacity} tiene un valor de $${capacityData.price.toFixed(2)} y las marcas disponibles son: ${brandNames}. ¿Cuál le gustaría?` 
      });

      const chosenDrink = pickRandom(capacityData.drinks);
      chatHistory.push({ sender: "client", text: `Quiero una ${chosenDrink.name}.` });
      orderLines.push(chosenDrink);
      foodTotal += chosenDrink.price;
    }

    const deliveryFee = 3.0;
    chatHistory.push({ sender: "delivery", text: "3 0" });
    chatHistory.push({ sender: "ai", text: `El costo del envío para ${sectorSel} es $${deliveryFee.toFixed(2)} en efectivo al motorizado. El pago de su pedido ($${foodTotal.toFixed(2)}) es por transferencia a:${formatBankAccountsForChat(bankHolders)}\n\n¿Desea continuar? Y si es así, me envía el comprobante para proceder con su pedido.` });
    chatHistory.push({ sender: "client", text: "Sí, acepto. Aquí le envío mi comprobante." });
    chatHistory.push({ sender: "client", text: "[Imagen adjunta: Comprobante de Transferencia]" });
    chatHistory.push({ sender: "ai", text: "✅ ¡Comprobante verificado con éxito! Listo, su pedido se está realizando y ya fue enviado a cocina." });

    const itemsSummary = orderLines.map((i) => `1x ${i.name} ${i.volume ? `(${i.volume})` : ""} ($${i.price.toFixed(2)})`).join(", ");

    const orderObject = {
      id: newId, code: `ORD-00${newId}`, client: name, sector: sectorSel,
      phone: "+593 99 " + Math.floor(100 + Math.random() * 900) + " " + Math.floor(1000 + Math.random() * 9000),
      items: itemsSummary, foodTotal, deliveryFee,
      status: "process", startTime: Date.now(), dispatchTime: null, estimatedTravelMinutes: 10,
      date: todayStr,
      chatHistory,
    };

    setOrders((prev) => [orderObject, ...prev]);
    setSelectedOrderId(newId);

    setHistorialEnvios((prev) => [
      { id: Date.now(), sector: sectorSel, fecha: todayStr, costo: deliveryFee, distancia: "2.2 km", pedidoId: `ORD-00${newId}` },
      ...prev,
    ]);

    setCashTransactions((prev) => [...prev, { id: prev.length + 1, type: "income", desc: `Pedido #${newId} - Comida (Transferencia Verificada)`, amount: foodTotal, category: "transfer", date: todayStr }]);
    
    autoSaveLocally();

    showToast(
      `¡Nuevo Pedido #${newId} en Cocina!`,
      `Comprobante validado de ${name} (${sectorSel}) por $${foodTotal.toFixed(2)}.`,
      "new-order"
    );
  };

  const handleClearAllOrders = async () => {
    try {
      // 1. Borra los documentos guardados por el bot en Firebase (colección "pedidos")
      const snap = await getDocs(collection(db, "pedidos"));
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, "pedidos", d.id))));

      // 2. Reinicia el contador de números de pedido, para que el próximo cliente sea el #1
      await setDoc(doc(db, "appData", "counter"), { nextOrderNumber: 1 });

      // 3. Limpia la lista local del panel
      setOrders([]);
      setHasUnsavedChanges(true);
      autoSaveLocally();

      showToast("Pedidos Borrados", "Se eliminaron todos los pedidos y se reinició la numeración desde el #1.", "success");
    } catch (err) {
      showToast("Error al Borrar", "No se pudo completar la limpieza de pedidos.", "alert");
    }
  };

  const totalTransfers = cashTransactions.filter((t) => t.category === "transfer").reduce((s, t) => s + t.amount, 0);

  // Muestra los ítems de un pedido en líneas separadas, con el total resaltado en otro color.
  // Compatible con pedidos antiguos donde "items" todavía es un solo texto.
  const renderOrderItems = (items, textSizeClass) => {
    if (!Array.isArray(items)) {
      return <p className={`${textSizeClass} text-gray-300 whitespace-pre-line`}>{items}</p>;
    }
    return (
      <div className="space-y-0.5">
        {items.map((it, idx) => (
          <p key={idx} className={`${textSizeClass} text-gray-300`}>
            Cantidad: {it.qty} {it.name}{it.category === "combo" ? " (Combo)" : ""} — ${it.unitPrice.toFixed(2)} c/u —{" "}
            <span className="text-yellow-400 font-bold">total ${it.total.toFixed(2)}</span>
            {it.flavor ? ` (sabor bebida: ${it.flavor})` : ""}
          </p>
        ))}
      </div>
    );
  };

  const confirmExpense = () => {
    const amount = parseFloat(expenseForm.amount);
    if (!expenseForm.desc.trim() || isNaN(amount) || amount <= 0) { showToast("Atención", "Completa el motivo y un valor válido.", "alert"); return; }
    const todayStr = new Date().toISOString().split("T")[0];
    setCashTransactions((prev) => [...prev, { id: prev.length + 1, type: "expense", desc: `Gasto: ${expenseForm.desc}`, amount, category: "expense", date: todayStr }]);
    showToast("Gasto Registrado", `Se restó $${amount.toFixed(2)}`, "alert");
    setHasUnsavedChanges(true);
    autoSaveLocally();
    setExpenseModal(false);
    setExpenseForm({ desc: "", amount: "" });
  };

  const confirmCashClose = () => {
    setCashCloseModal(false);
    showToast("Cierre Exitoso", `Total Comidas: $${totalTransfers.toFixed(2)}`, "success");
  };

  // El botón guardar sincroniza localmente y además guarda en la base de datos de Firebase Firestore en formato JSON
  const handleSaveAllChanges = async () => {
    try {
      const snapshot = {
        menuItems, 
        ingredientes, 
        orders, 
        historialEnvios, 
        cashTransactions,
        notifications, 
        botConfig, 
        bankHolders, 
        audioSettings,
        updatedAt: new Date().toISOString()
      };

      // 1. Respaldo local en el dispositivo
      await Filesystem.writeFile({
        path: DATA_FILE_NAME,
        directory: Directory.Data,
        data: JSON.stringify(snapshot),
        encoding: Encoding.UTF8,
      });

      // 2. Guardado en Firebase, separado en dos apartados claros: menú y configuración
      // Las imágenes (base64) se quedan solo en el dispositivo: el bot no las necesita,
      // y superan el límite de 1MB por documento de Firestore.
      const menuItemsSinImagenes = menuItems.map(({ img, ...resto }) => resto);
      await setDoc(doc(db, "appData", "menu"), {
        menuItems: menuItemsSinImagenes,
        updatedAt: new Date().toISOString(),
      });
      const { logoUrl, ...audioSettingsSinLogo } = audioSettings;
      await setDoc(doc(db, "appData", "config"), {
        ingredientes, historialEnvios, cashTransactions, notifications,
        botConfig, bankHolders, audioSettings: audioSettingsSinLogo,
        updatedAt: new Date().toISOString(),
      });

      setHasUnsavedChanges(false);
      showToast("Cambios Guardados", "Sincronizado localmente y guardado en la base de datos de Firebase.", "success");
    } catch (err) {
      console.error("Error al guardar en Firebase:", err);
      showToast("Error al Guardar", `Detalle: ${err.message || err.code || "desconocido"}`, "alert");
    }
  };

  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const result = await Filesystem.readFile({
          path: DATA_FILE_NAME,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
        });
        const saved = JSON.parse(result.data);
        if (saved.menuItems) setMenuItems(saved.menuItems);
        if (saved.ingredientes) setIngredientes(saved.ingredientes);
        if (saved.orders) setOrders(saved.orders);
        if (saved.historialEnvios) setHistorialEnvios(saved.historialEnvios);
        if (saved.cashTransactions) setCashTransactions(saved.cashTransactions);
        if (saved.notifications) setNotifications(saved.notifications);
        if (saved.botConfig) setBotConfig(saved.botConfig);
        if (saved.bankHolders) setBankHolders(saved.bankHolders);
        if (saved.audioSettings) setAudioSettings(saved.audioSettings);
      } catch (err) {}
    };
    loadSavedData();
  }, []);

  // Escucha en vivo los pedidos que el bot de WhatsApp va guardando en Firebase
  // (colección aparte, no se mezcla con el guardado local del panel)
  useEffect(() => {
    const q = query(collection(db, "pedidos"), orderBy("startTime", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const botOrder = { ...change.doc.data(), id: change.doc.id, firestoreId: change.doc.id };
          setOrders((prev) => {
            const yaExiste = prev.some((o) => o.firestoreId === change.doc.id);
            if (yaExiste) return prev;
            showToast(
              `¡Nuevo Pedido por WhatsApp!`,
              `${botOrder.client} (${botOrder.sector}) por $${(botOrder.foodTotal || 0).toFixed(2)}`,
              "new-order"
            );
            return [botOrder, ...prev];
          });
        }
      });
    });
    return () => unsubscribe();
  }, []);

  const handleExitAppClick = () => {
    if (hasUnsavedChanges) {
      setExitConfirmModal(true);
    } else {
      window.location.reload();
    }
  };

  const filteredTransactions = cashTransactions.filter(t => t.date === reportDate);
  const reportIncome = filteredTransactions.filter(t => t.category === "transfer").reduce((s, t) => s + t.amount, 0);
  const reportOrdersCount = orders.filter(o => (o.date || new Date().toISOString().split("T")[0]) === reportDate).length;

  const kanbanCols = { process: [], sent: [], delivered: [] };
  orders.forEach((o) => kanbanCols[ESTADO_LABEL[o.status]].push(o));
  const selectedOrder = orders.find((o) => o.id === selectedOrderId);
  const maxRanking = Math.max(...RANKING.map((r) => r.ventas));

  const sectorMap = {};
  historialEnvios.forEach(item => {
    if (!sectorMap[item.sector]) {
      sectorMap[item.sector] = { totalCost: 0, count: 0 };
    }
    sectorMap[item.sector].totalCost += item.costo;
    sectorMap[item.sector].count += 1;
  });

  const sectoresResumen = Object.keys(sectorMap).map(sector => {
    return {
      sector,
      promedio: sectorMap[sector].totalCost / sectorMap[sector].count,
      totalCotizaciones: sectorMap[sector].count
    };
  });

  const registrarEnvioManual = () => {
    const costoNum = parseFloat(nuevoEnvioForm.costo);
    if (!nuevoEnvioForm.sector.trim() || isNaN(costoNum) || costoNum <= 0) {
      showToast("Atención", "Ingrese un sector válido y un costo de envío superior a 0.", "alert");
      return;
    }
    const todayStr = new Date().toISOString().split("T")[0];
    const nuevoRegistro = {
      id: Date.now(),
      sector: nuevoEnvioForm.sector.trim(),
      fecha: todayStr,
      costo: costoNum,
      distancia: nuevoEnvioForm.distancia || "2.0 km",
      pedidoId: nuevoEnvioForm.pedidoId || "MANUAL"
    };
    setHistorialEnvios([nuevoRegistro, ...historialEnvios]);
    setHasUnsavedChanges(true);
    autoSaveLocally();
    setNuevoEnvioModal(false);
    setNuevoEnvioForm({ sector: "Chipipe", costo: "", distancia: "2.0 km", pedidoId: "ORD-00X" });
    showToast("Registro Guardado", `Cotización de $${costoNum.toFixed(2)} para ${nuevoRegistro.sector} agregada al historial.`, "success");
  };

  const TOAST_STYLE = {
    success: { border: "border-green-600", icon: <CircleCheck size={16} className="text-green-400" /> },
    whatsapp: { border: "border-emerald-500", icon: <MessageCircle size={16} className="text-emerald-400" /> },
    alert: { border: "border-yellow-500", icon: <AlertTriangle size={16} className="text-yellow-400" /> },
    "gps-arrival": { border: "border-blue-500", icon: <Bike size={16} className="text-blue-400" /> },
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans flex flex-col relative">
      <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-sm w-full pointer-events-none px-4">
        {toasts.map((t) => {
          const style = TOAST_STYLE[t.type] || TOAST_STYLE.success;
          return (
            <div
              key={t.id}
              onTouchStart={(e) => { e.currentTarget.dataset.startX = e.touches[0].clientX; }}
              onTouchEnd={(e) => {
                const diff = e.changedTouches[0].clientX - (parseFloat(e.currentTarget.dataset.startX) || 0);
                if (Math.abs(diff) > 60) setToasts((prev) => prev.filter((x) => x.id !== t.id));
              }}
              className={`pointer-events-auto bg-gray-900 border-l-4 ${style.border} border border-gray-800 p-4 rounded-xl shadow-2xl flex items-start gap-3 transition-transform`}
            >
              <div className="mt-0.5">{style.icon}</div>
              <div className="flex-1">
                <h4 className="font-bold text-xs text-white">{t.title}</h4>
                <p className="text-[11px] text-gray-300 mt-0.5">{t.message}</p>
              </div>
              <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="text-gray-400 hover:text-white">
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      <header className="bg-red-900 border-b border-red-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/40 flex items-center justify-center overflow-hidden shadow">
              {audioSettings.logoUrl ? (
                <img src={audioSettings.logoUrl} alt="Salinas Burger Logo" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = "none"; }} />
              ) : (
                <div className="text-yellow-400"><Flame size={22} strokeWidth={2.5} /></div>
              )}
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wider text-white">SALINAS BURGER</h1>
              <p className="text-xs text-yellow-300 font-medium">Panel de Administración & IA WhatsApp</p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            <span className="bg-green-600 text-white text-xs px-3 py-1 rounded-full font-bold hidden sm:flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> Bot WhatsApp: Activo
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setNotificationsModal(true)}
                title="Notificaciones"
                className="relative bg-red-950/60 hover:bg-red-800 text-gray-200 p-2 rounded-xl border border-red-700/50 transition flex items-center justify-center shadow"
              >
                <Bell size={18} className="text-yellow-400" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {notifications.length}
                  </span>
                )}
              </button>

              <button
                onClick={handleSaveAllChanges}
                title="Guardar Cambios (Sube a Firebase)"
                className={`p-2 rounded-xl border transition flex items-center justify-center shadow ${
                  hasUnsavedChanges ? "bg-yellow-500 text-red-950 border-yellow-400 animate-pulse font-bold" : "bg-red-950/60 hover:bg-red-800 text-gray-200 border-red-700/50"
                }`}
              >
                <Save size={18} />
              </button>

              <button
                onClick={() => setSettingsModal(true)}
                title="Ajustes y Números"
                className="bg-red-950/60 hover:bg-red-800 text-gray-200 p-2 rounded-xl border border-red-700/50 transition flex items-center justify-center shadow"
              >
                <Sliders size={18} className="text-yellow-400" />
              </button>

              <button
                onClick={handleExitAppClick}
                title="Salir de la App"
                className="bg-red-950/60 hover:bg-red-800 text-red-300 p-2 rounded-xl border border-red-700/50 transition flex items-center justify-center shadow"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-gray-900 border-b border-gray-800 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 flex gap-1 sm:gap-4">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-3 font-bold text-sm border-b-2 flex items-center gap-2 whitespace-nowrap transition-all ${
                  tab === t.id ? "border-yellow-500 text-yellow-400" : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {tab === "menu" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-900 p-4 rounded-xl border border-gray-800">
              <div>
                <h2 className="text-xl font-bold text-white">Gestión de Catálogo (Individuales, Combos y Bebidas)</h2>
                <p className="text-sm text-gray-400">Edita nombres, ingredientes, precios, ml/LT y disponibilidad en tiempo real.</p>
              </div>
              <button onClick={() => setProductModal({ id: null, name: "", category: "burger", price: "", volume: "300 ml", desc: "", img: "" })} className="bg-yellow-500 hover:bg-yellow-400 text-red-950 font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow">
                <Plus size={14} /> Nuevo Ítem
              </button>
            </div>

            <div className="flex gap-2 border-b border-gray-800 pb-3 flex-wrap">
              {[{ id: "all", label: "Todos" }, { id: "burger", label: "Hamburguesas" }, { id: "other", label: "Papas & Extras" }, { id: "drink", label: "Bebidas" }, { id: "combo", label: "Combos" }, { id: "sauce", label: "Salsas" }].map((f) => {
                const count = f.id === "all" ? menuItems.length : menuItems.filter((i) => i.category === f.id).length;
                return (
                  <button
                    key={f.id}
                    onClick={() => setMenuFilter(f.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition flex items-center gap-1.5 ${menuFilter === f.id ? "bg-red-900 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
                  >
                    {f.label}
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${menuFilter === f.id ? "bg-red-950 text-yellow-400" : "bg-gray-900 text-gray-400"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredMenu.map((item) => {
                const catMeta = {
                  burger: { icon: UtensilsCrossed, color: "text-orange-400", bg: "bg-orange-500/10", ring: "ring-orange-500/20", label: "Hamburguesa" },
                  other: { icon: Flame, color: "text-amber-400", bg: "bg-amber-500/10", ring: "ring-amber-500/20", label: "Papas & Extras" },
                  drink: { icon: Wine, color: "text-sky-400", bg: "bg-sky-500/10", ring: "ring-sky-500/20", label: "Bebida" },
                  combo: { icon: ShoppingBag, color: "text-purple-400", bg: "bg-purple-500/10", ring: "ring-purple-500/20", label: "Combo" },
                  sauce: { icon: Droplet, color: "text-lime-400", bg: "bg-lime-500/10", ring: "ring-lime-500/20", label: "Salsa" },
                }[item.category] || { icon: UtensilsCrossed, color: "text-gray-400", bg: "bg-gray-500/10", ring: "ring-gray-500/20", label: "Ítem" };
                const CatIcon = catMeta.icon;
                return (
                  <div key={item.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-3 shadow hover:border-gray-700 hover:bg-gray-900/70 transition">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-11 h-11 shrink-0 rounded-lg ${catMeta.bg} ring-1 ${catMeta.ring} flex items-center justify-center`}>
                          <CatIcon size={20} className={catMeta.color} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-white leading-snug truncate" title={item.name}>{item.name}</h3>
                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${catMeta.color}`}>
                            {catMeta.label}{item.volume ? ` · ${item.volume}` : ""}
                          </span>
                        </div>
                      </div>
                      {item.category === "sauce" ? (
                        <span className="shrink-0 bg-gray-950 border border-gray-800 text-gray-400 font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wide">
                          Sin costo
                        </span>
                      ) : (
                        <span className="shrink-0 bg-gray-950 border border-gray-800 text-yellow-400 font-black px-2.5 py-1 rounded-lg text-sm">
                          ${item.price.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{item.desc}</p>

                    <div className="flex justify-between items-center pt-3 border-t border-gray-800/60">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border flex items-center gap-1.5 ${item.available ? "bg-green-950 text-green-400 border-green-800" : "bg-red-950 text-red-400 border-red-800"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.available ? "bg-green-400" : "bg-red-400"}`} />
                        {item.available ? "Disponible" : "Agotado"}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => setProductModal({ id: item.id, name: item.name, category: item.category, price: item.price, volume: item.volume || "300 ml", desc: item.desc, img: item.img || "" })} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-red-950 flex items-center gap-1 transition">
                          <Pencil size={11} /> Editar
                        </button>
                        <button onClick={() => toggleAvailability(item.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition">
                          {item.available ? "Pausar" : "Activar"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div className="space-y-6">
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Centro de Pedidos WhatsApp & Conversación Real</h2>
                <p className="text-sm text-gray-400">Simulación del flujo natural paso a paso hasta la validación del comprobante.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleClearAllOrders} className="bg-red-700 hover:bg-red-600 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow">
                  <Trash2 size={14} /> Borrar todos los pedidos (Firebase)
                </button>
                <button onClick={simulateNewOrder} className="bg-green-600 hover:bg-green-500 text-white font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow">
                  <MessageCircle size={14} /> Simular Conversación Real
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col h-[500px]">
                <h3 className="font-bold text-sm text-yellow-400 mb-3">Historial de Conversación IA</h3>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 text-xs bg-gray-950 p-3 rounded-lg border border-gray-800">
                  {!selectedOrder && <div className="text-gray-500 text-center italic mt-8">Selecciona un pedido para ver el hilo del bot o simula uno nuevo.</div>}
                  {selectedOrder && (
                    <>
                      <div className="text-center text-[10px] text-yellow-500 font-semibold mb-2">--- Hilo Activo: Pedido #{selectedOrder.id} ({selectedOrder.client}) ---</div>
                      {selectedOrder.chatHistory.map((m, i) => {
                        let bg = "bg-gray-800 text-gray-200", align = "mr-auto";
                        if (m.sender === "ai") { bg = "bg-red-950 text-red-200 border border-red-900"; align = "mx-auto w-full text-center"; }
                        if (m.sender === "client") { bg = "bg-gray-900 text-white"; align = "ml-auto"; }
                        if (m.sender === "delivery") { bg = "bg-blue-950 text-blue-200 border border-blue-900"; align = "mr-auto"; }
                        return (
                          <div key={i} className={`p-2 rounded-lg text-xs whitespace-pre-line ${bg} ${align} max-w-[90%]`}>
                            <strong className="block text-[10px] opacity-70">{m.sender.toUpperCase()}</strong>
                            {m.text}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col h-[500px]">
                <h3 className="font-bold text-sm text-yellow-400 mb-3">Cola de Pedidos en Cocina</h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  {orders.map((ord) => (
                    <div key={ord.id} onClick={() => setSelectedOrderId(ord.id)} className="bg-gray-950 border border-gray-800 hover:border-yellow-500/50 p-3 rounded-xl cursor-pointer transition space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-yellow-400 flex items-center gap-1.5">
                          Pedido {ord.code || `#${ord.id}`} - {ord.client} {ord.sector ? `(${ord.sector})` : ""}
                          {ord.notes && ord.notes.length > 0 && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); showToast("📝 Notas de " + ord.client, ord.notes.join(" | "), "alert"); }} 
                              className="text-orange-400 hover:text-white" title="Ver notas del cliente"
                            >
                              <FileText size={14} />
                            </button>
                          )}
                        </span>
                        <span className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded">{ord.phone}</span>
                      </div>
                      {renderOrderItems(ord.items, "text-xs")}
                      <div className="flex justify-between items-center pt-2 border-t border-gray-900 text-[11px]">
                        <span className="text-green-400 font-bold">Comida: ${ord.foodTotal.toFixed(2)} (Comprobante ✅)</span>
                        <span className="text-orange-400 font-bold">Envío: ${ord.deliveryFee.toFixed(2)} (Efectivo)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "kanban" && (
          <div className="space-y-6">
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
              <h2 className="text-xl font-bold text-white">Tablero de Producción, Aviso a Motorizado y Tiempos</h2>
              <p className="text-sm text-gray-400">Marca "Comida Terminada" para notificar al motorizado, luego despacha.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: "process", title: "En Proceso (Cocina)", icon: <Flame size={14} className="text-orange-500" />, color: "text-yellow-400" },
                { key: "sent", title: "En Ruta (Agencia)", icon: <Bike size={14} />, color: "text-blue-400" },
                { key: "delivered", title: "Entregado", icon: <CircleCheck size={14} />, color: "text-green-400" },
              ].map((col) => (
                <div key={col.key} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col h-[550px]">
                  <div className="flex justify-between items-center pb-3 border-b border-gray-800 mb-3">
                    <h3 className={`font-bold text-sm flex items-center gap-2 ${col.color}`}>{col.icon} {col.title}</h3>
                    <span className="bg-gray-800 text-xs px-2.5 py-1 rounded-full font-bold">{kanbanCols[col.key].length}</span>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {kanbanCols[col.key].map((ord) => {
                      const durationMin = Math.floor((now - ord.startTime) / 60000);
                      return (
                        <div key={ord.id} className="bg-gray-950 border border-gray-800 p-3 rounded-xl space-y-2 shadow">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-xs text-white flex items-center gap-1.5">
                              Pedido {ord.code || `#${ord.id}`} ({ord.client})
                              {ord.notes && ord.notes.length > 0 && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); showToast("📝 Notas de " + ord.client, ord.notes.join(" | "), "alert"); }} 
                                  className="text-orange-400 hover:text-white" title="Ver notas del cliente"
                                >
                                  <FileText size={14} />
                                </button>
                              )}
                            </span>
                            <span className="text-[10px] bg-red-950 text-red-300 px-2 py-0.5 rounded font-mono flex items-center gap-1"><Clock size={10} /> {durationMin} min</span>
                          </div>
                          {renderOrderItems(ord.items, "text-[11px]")}

                          {ord.status === "process" && (
                            <>
                              <div className="text-[10px] text-gray-400 bg-gray-900 p-2 rounded">
                                <div>💳 Comida: <strong>${ord.foodTotal.toFixed(2)} (Pago OK)</strong></div>
                                <div>🛵 Envío: <strong>${ord.deliveryFee.toFixed(2)} ({ord.sector || "General"} - Efectivo)</strong></div>
                              </div>
                              <div className="pt-2 border-t border-gray-900">
                                <button onClick={() => markFoodReady(ord.id)} className="w-full bg-yellow-500 hover:bg-yellow-400 text-red-950 text-[11px] font-bold py-1.5 rounded flex items-center justify-center gap-1.5 shadow">
                                  <UtensilsCrossed size={12} /> Comida Terminada (Avisar Motorizado)
                                </button>
                              </div>
                            </>
                          )}

                          {ord.status === "ready" && (
                            <div className="pt-2 border-t border-gray-900">
                              <button onClick={() => moveOrder(ord.id, "sent")} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold py-1.5 rounded flex items-center justify-center gap-1.5 shadow">
                                <Bike size={12} /> Motorizado retiró el pedido
                              </button>
                            </div>
                          )}

                          {ord.status === "sent" && (() => {
                            const elapsedSecs = Math.floor((now - ord.dispatchTime) / 1000);
                            const totalSecs = ord.estimatedTravelMinutes * 60;
                            const remainingSecs = Math.max(0, totalSecs - elapsedSecs);
                            const remMin = Math.floor(remainingSecs / 60);
                            const remSec = remainingSecs % 60;
                            const progress = Math.min(100, (elapsedSecs / totalSecs) * 100);
                            return (
                              <>
                                <div className="bg-blue-950/60 border border-blue-900 p-2.5 rounded-lg space-y-2">
                                  <div className="flex justify-between items-center text-[11px] text-blue-300 font-semibold">
                                    <span className="flex items-center gap-1"><Flag size={11} className="text-yellow-400" /> Llegando a la meta</span>
                                    <span className="font-mono bg-blue-900 px-2 py-0.5 rounded text-white">{remMin}m {remSec < 10 ? "0" : ""}{remSec}s</span>
                                  </div>
                                  <div className="w-full bg-gray-900 h-2.5 rounded-full overflow-hidden border border-blue-800/50">
                                    <div className="bg-gradient-to-r from-blue-500 to-yellow-400 h-full transition-all duration-500 rounded-full" style={{ width: `${progress}%` }} />
                                  </div>
                                  <div className="flex justify-between text-[10px] text-gray-400 items-center">
                                    <span>Local</span><Bike size={12} className="text-yellow-400" /><span>Destino ({ord.sector || "Cliente"})</span>
                                  </div>
                                </div>
                                <div className="pt-2 border-t border-gray-900">
                                  <button onClick={() => moveOrder(ord.id, "delivered")} className="w-full bg-green-600 hover:bg-green-500 text-white text-[11px] font-bold py-1.5 rounded shadow">
                                    Marcar Entregado ✔
                                  </button>
                                </div>
                              </>
                            );
                          })()}

                          {ord.status === "delivered" && (
                            <div className="text-[10px] text-gray-400 bg-gray-900 p-2 rounded text-center">
                              <CircleCheck size={12} className="inline text-green-400 mr-1" /> Pedido despachado y entregado con éxito.
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "historial" && (
          <div className="space-y-6">
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Bike className="text-yellow-400" size={24} /> Puntos con más Ventas (Basado en GPS del cliente)
                </h2>
                <p className="text-sm text-gray-400">
                  Controla las zonas con mayor demanda y el costo promedio de envío registrado mediante la ubicación enviada por los clientes.
                </p>
              </div>
              <button
                onClick={() => setNuevoEnvioModal(true)}
                className="bg-yellow-500 hover:bg-yellow-400 text-red-950 font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 shadow"
              >
                <Plus size={14} /> Registrar Cotización Manual
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sectoresResumen.map((s) => {
                return (
                  <div key={s.sector} className="bg-gray-900 border border-gray-800 p-4 rounded-xl space-y-3 shadow relative overflow-hidden">
                    <div>
                      <h3 className="font-black text-base text-white">{s.sector}</h3>
                      <p className="text-xs text-gray-400">{s.totalCotizaciones} pedidos registrados por GPS</p>
                    </div>
                    <div className="flex justify-between items-baseline pt-2 border-t border-gray-800">
                      <span className="text-xs text-gray-400">Costo Promedio Envío:</span>
                      <span className="text-xl font-black text-yellow-400">${s.promedio.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-sm font-bold text-white">Registro Detallado por Sectores (GPS)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-950 text-gray-400 uppercase border-b border-gray-800">
                    <tr>
                      <th className="p-3">Zona (Sector)</th>
                      <th className="p-3">Número de Orden</th>
                      <th className="p-3">Distancia (GPS)</th>
                      <th className="p-3">Valor del Envío</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {historialEnvios.map((item) => {
                      return (
                        <tr key={item.id} className="hover:bg-gray-950/50 transition">
                          <td className="p-3 font-bold text-white">{item.sector}</td>
                          <td className="p-3 text-yellow-400 font-mono">{item.pedidoId}</td>
                          <td className="p-3 text-gray-300">{item.distancia}</td>
                          <td className="p-3 font-bold text-green-400">${item.costo.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {tab === "cash" && (
          <div className="space-y-6">
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex justify-between items-center flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Caja Diaria & Cierre de Turno (Solo Comidas)</h2>
                <p className="text-sm text-gray-400">Control de ingresos por transferencias validadas con comprobante.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setExpenseModal(true)} className="bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold px-3 py-2 rounded-lg border border-gray-700">
                  − Registrar Gasto
                </button>
                <button onClick={() => setCashCloseModal(true)} className="bg-yellow-500 hover:bg-yellow-400 text-red-950 text-xs font-bold px-3 py-2 rounded-lg shadow">
                  🔒 Cierre de Turno
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl space-y-1">
                <span className="text-xs text-gray-400">Total Ingresos Comidas (Transferencias Validadas)</span>
                <h3 className="text-2xl font-black text-green-400">${totalTransfers.toFixed(2)}</h3>
              </div>
              <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl space-y-1">
                <span className="text-xs text-gray-400">Ingreso Neto del Negocio</span>
                <h3 className="text-2xl font-black text-white">${totalTransfers.toFixed(2)}</h3>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-3">Historial de Movimientos</h3>
              <div className="space-y-2 text-xs">
                {cashTransactions.map((tx) => (
                  <div key={tx.id} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg flex justify-between items-center">
                    <span className="text-gray-300">{tx.desc}</span>
                    <span className={`font-bold ${tx.type === "income" ? "text-green-400" : "text-red-400"}`}>
                      {tx.type === "income" ? "+" : "-"}${tx.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "analytics" && (
          <div className="space-y-6">
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
              <h2 className="text-xl font-bold text-white">Analíticas de Combos, Días y Horarios Activos</h2>
              <p className="text-sm text-gray-400">Métricas clave para la toma de decisiones estratégicas.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl">
                <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-1.5"><TrendingUp size={13} className="text-yellow-400" /> Combos y Platos más Vendidos</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={RANKING} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                    <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#374151" }} tickLine={false} />
                    <YAxis type="category" dataKey="nombre" tick={{ fill: "#D1D5DB", fontSize: 10 }} width={100} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }} cursor={{ fill: "#1F2937" }} />
                    <Bar dataKey="ventas" radius={[0, 4, 4, 0]}>
                      {RANKING.map((r, i) => <Cell key={i} fill={r.ventas === maxRanking ? "#EAB308" : "#92400E"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-gray-900 border border-gray-800 p-5 rounded-xl">
                <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-1.5"><Clock size={13} className="text-yellow-400" /> Horarios de Mayor Rotación (Pico)</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={VENTAS_HORA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                    <XAxis dataKey="hora" tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={{ stroke: "#374151" }} tickLine={false} />
                    <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }} />
                    <Line type="monotone" dataKey="volumen" stroke="#EF4444" strokeWidth={2} dot={{ fill: "#EF4444", r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {tab === "reports" && (
          <div className="space-y-6">
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Reportes de Ventas Históricos por Fecha</h2>
                <p className="text-sm text-gray-400">Selecciona un día específico para consultar el resumen contable y de pedidos.</p>
              </div>
              <div className="flex items-center gap-2 bg-gray-950 px-3 py-2 rounded-lg border border-gray-800">
                <Calendar size={16} className="text-yellow-400" />
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="bg-transparent text-white text-xs font-semibold focus:outline-none cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl space-y-1">
                <span className="text-xs text-gray-400 flex items-center gap-1.5"><DollarSign size={14} className="text-green-400" /> Ingresos por Comidas ({reportDate})</span>
                <h3 className="text-2xl font-black text-green-400">${reportIncome.toFixed(2)}</h3>
              </div>
              <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl space-y-1">
                <span className="text-xs text-gray-400 flex items-center gap-1.5"><ShoppingBag size={14} className="text-yellow-400" /> Total Pedidos del Día</span>
                <h3 className="text-2xl font-black text-white">{reportOrdersCount}</h3>
              </div>
              <div className="bg-gray-900 border border-gray-800 p-4 rounded-xl space-y-1">
                <span className="text-xs text-gray-400 flex items-center gap-1.5"><TrendingUp size={14} className="text-blue-400" /> Ticket Promedio</span>
                <h3 className="text-2xl font-black text-blue-400">${reportOrdersCount > 0 ? (reportIncome / reportOrdersCount).toFixed(2) : "0.00"}</h3>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-white mb-3">Transacciones registradas para el {reportDate}</h3>
              {filteredTransactions.length === 0 ? (
                <p className="text-xs text-gray-500 italic py-6 text-center">No se registraron movimientos de caja para esta fecha.</p>
              ) : (
                <div className="space-y-2 text-xs">
                  {filteredTransactions.map((tx) => (
                    <div key={tx.id} className="bg-gray-950 border border-gray-800 p-2.5 rounded-lg flex justify-between items-center">
                      <span className="text-gray-300">{tx.desc}</span>
                      <span className={`font-bold ${tx.type === "income" ? "text-green-400" : "text-red-400"}`}>
                        {tx.type === "income" ? "+" : "-"}${tx.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "botconfig" && (
          <div className="space-y-6">
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800">
              <h2 className="text-xl font-bold text-white">Configuración del Bot IA de WhatsApp</h2>
              <p className="text-sm text-gray-400">Personaliza los mensajes automáticos y datos bancarios que el bot comparte con tus clientes.</p>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4 max-w-2xl">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Mensaje de Bienvenida Automático</label>
                <textarea
                  rows={8}
                  value={botConfig.welcomeMsg}
                  onChange={(e) => { setBotConfig({ ...botConfig, welcomeMsg: e.target.value }); setHasUnsavedChanges(true); autoSaveLocally(); }}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs text-white whitespace-pre-line focus:outline-none focus:border-yellow-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Menú PDF del Bot (Enlace)</label>
                <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 space-y-2">
                  {botConfig.menuPdfUrl && (
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <FileText size={20} className="text-yellow-400 shrink-0" />
                      <p className="text-xs font-bold text-white truncate">{botConfig.menuPdfName || "Menú cargado"}</p>
                    </div>
                  )}
                  <input
                    type="text"
                    value={botConfig.menuPdfUrl || ""}
                    onChange={(e) => {
                      const url = e.target.value;
                      const nombre = url.split("/").pop() || "Menu.pdf";
                      setBotConfig({ ...botConfig, menuPdfUrl: url, menuPdfName: decodeURIComponent(nombre) });
                      setHasUnsavedChanges(true);
                      autoSaveLocally();
                    }}
                    placeholder="https://raw.githubusercontent.com/tu-usuario/tu-repo/main/Menu.pdf"
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-yellow-500"
                  />
                </div>
                <span className="text-[10px] text-gray-500 block mt-1">
                  Sube tu PDF a GitHub, copia su enlace "Raw" y pégalo aquí. Se enviará automáticamente en el chat con los clientes apenas saluden.
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wide">Cuentas para Transferencia</label>
                  <button
                    onClick={addBankHolder}
                    className="w-6 h-6 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-red-950 font-bold flex items-center justify-center shadow"
                    title="Agregar otro titular"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="space-y-3">
                  {bankHolders.map((h) => (
                    <div key={h.id} className="bg-gray-950 border border-gray-800 rounded-lg p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wide">Titular</span>
                        <button
                          onClick={() => removeBankHolder(h.id)}
                          className="w-6 h-6 rounded-lg bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-white flex items-center justify-center transition"
                          title="Eliminar titular"
                        >
                          <X size={12} />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        {h.cuentas.map((c) => (
                          <div key={c.id} className="grid grid-cols-1 sm:grid-cols-[1.3fr_0.8fr_1fr_auto] gap-1.5">
                            <select
                              value={c.banco}
                              onChange={(e) => updateBankAccountInHolder(h.id, c.id, "banco", e.target.value)}
                              className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-yellow-500"
                            >
                              {ECUADOR_BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
                            </select>
                            <select
                              value={c.tipo}
                              onChange={(e) => updateBankAccountInHolder(h.id, c.id, "tipo", e.target.value)}
                              className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-yellow-500"
                            >
                              <option value="Ahorros">Ahorros</option>
                              <option value="Corriente">Corriente</option>
                            </select>
                            <input
                              value={c.numero}
                              onChange={(e) => updateBankAccountInHolder(h.id, c.id, "numero", e.target.value)}
                              placeholder="N° de cuenta"
                              className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-yellow-500"
                            />
                            <button
                              onClick={() => removeBankAccountFromHolder(h.id, c.id)}
                              className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-white flex items-center justify-center transition"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => addBankAccountToHolder(h.id)}
                          className="text-[10px] text-yellow-400 hover:text-yellow-300 font-semibold flex items-center gap-1"
                        >
                          <Plus size={11} /> Agregar otro banco a este titular
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1.5 border-t border-gray-900">
                        <input
                          value={h.cedula}
                          onChange={(e) => updateBankHolder(h.id, "cedula", e.target.value)}
                          placeholder="Cédula"
                          className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-yellow-500"
                        />
                        <input
                          value={h.nombre}
                          onChange={(e) => updateBankHolder(h.id, "nombre", e.target.value)}
                          placeholder="Nombre completo"
                          className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-yellow-500"
                        />
                        <input
                          value={h.correo}
                          onChange={(e) => updateBankHolder(h.id, "correo", e.target.value)}
                          placeholder="Correo"
                          className="bg-gray-900 border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-yellow-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Mensaje de Sugerencia / Venta Cruzada (Upselling)</label>
                <textarea
                  rows={2}
                  value={botConfig.upsellMsg}
                  onChange={(e) => { setBotConfig({ ...botConfig, upsellMsg: e.target.value }); setHasUnsavedChanges(true); autoSaveLocally(); }}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-yellow-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Mensaje de Plato Agotado</label>
                <textarea
                  rows={2}
                  value={botConfig.soldOutMsg}
                  onChange={(e) => { setBotConfig({ ...botConfig, soldOutMsg: e.target.value }); setHasUnsavedChanges(true); autoSaveLocally(); }}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-yellow-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Enlace de Instagram</label>
                <input
                  type="text"
                  value={botConfig.instagramUrl || ""}
                  onChange={(e) => { setBotConfig({ ...botConfig, instagramUrl: e.target.value }); setHasUnsavedChanges(true); autoSaveLocally(); }}
                  placeholder="https://instagram.com/salinasburger"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-yellow-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Enlace de TikTok</label>
                <input
                  type="text"
                  value={botConfig.tiktokUrl || ""}
                  onChange={(e) => { setBotConfig({ ...botConfig, tiktokUrl: e.target.value }); setHasUnsavedChanges(true); autoSaveLocally(); }}
                  placeholder="https://tiktok.com/@salinasburger"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-yellow-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Mensaje de Despedida (Con invitación a redes)</label>
                <textarea
                  rows={4}
                  value={botConfig.farewellMsg}
                  onChange={(e) => { setBotConfig({ ...botConfig, farewellMsg: e.target.value }); setHasUnsavedChanges(true); autoSaveLocally(); }}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-yellow-500"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleSaveAllChanges}
                  className="bg-yellow-500 hover:bg-yellow-400 text-red-950 font-bold px-4 py-2 rounded-lg text-xs shadow flex items-center gap-1.5"
                >
                  Guardar Cambios en Firebase <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "ingredients" && (
          <div className="space-y-6">
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 flex justify-between items-center flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Control de Insumos y Costo-Beneficio</h2>
                <p className="text-sm text-gray-400">Modifica el costo unitario de cada ingrediente para recalcular la rentabilidad.</p>
              </div>
              <div className="bg-gray-950 px-4 py-2 rounded-lg border border-gray-800 text-xs">
                <span className="text-gray-400">Insumos Únicos:</span> <strong className="text-yellow-400">{Object.keys(ingredientes).length}</strong>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-1.5"><Scale size={13} /> Costo Unitario por Insumo (Editable)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Object.entries(ingredientes).map(([ing, cost]) => (
                  <div key={ing} className="bg-gray-950 border border-gray-800 p-3 rounded-lg flex flex-col justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-300">{ing}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-yellow-400 font-bold">$</span>
                      <input
                        type="number" step="0.05" defaultValue={cost.toFixed(2)}
                        onBlur={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val) && val >= 0) {
                            setIngredientes((prev) => ({ ...prev, [ing]: val }));
                            setHasUnsavedChanges(true);
                            autoSaveLocally();
                            showToast("Costo Actualizado", `Insumo "${ing}" cambiado a $${val.toFixed(2)}`, "success");
                          }
                        }}
                        className="w-full bg-gray-900 border border-gray-800 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-sm font-bold text-white">Margen de Rentabilidad por Plato</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-950 text-gray-400 uppercase border-b border-gray-800">
                    <tr>
                      <th className="p-3">Plato / Combo</th>
                      <th className="p-3">Precio Venta ($)</th>
                      <th className="p-3">Costo Est. Insumos ($)</th>
                      <th className="p-3">Margen Bruto ($)</th>
                      <th className="p-3">Rentabilidad (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {menuItems.map((item) => {
                      const cost = calculatePlateCost(item, menuItems, ingredientes);
                      const margin = item.price - cost;
                      const marginPct = item.price > 0 ? ((margin / item.price) * 100).toFixed(1) : 0;
                      return (
                        <tr key={item.id} className="hover:bg-gray-950/50 transition">
                          <td className="p-3 font-bold text-white">{item.name}</td>
                          <td className="p-3 text-yellow-400">${item.price.toFixed(2)}</td>
                          <td className="p-3 text-gray-400">${cost.toFixed(2)}</td>
                          <td className="p-3 text-green-400 font-semibold">${margin.toFixed(2)}</td>
                          <td className="p-3"><span className="bg-green-950 text-green-400 px-2 py-0.5 rounded font-bold">{marginPct}%</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {storagePermissionModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-yellow-600/50 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center mx-auto text-xl font-bold">📁</div>
            <h3 className="font-bold text-base text-white">Permiso de Almacenamiento Requerido</h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              Salinas Burger necesita permiso para acceder a tus imágenes y así vincular automáticamente las fotos del menú. Parece que el permiso fue denegado anteriormente — actívalo desde los Ajustes de tu teléfono.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setStoragePermissionModal(false)}
                className="flex-1 px-3 py-2.5 rounded-lg bg-gray-800 text-gray-300 font-semibold text-xs hover:bg-gray-700 transition"
              >
                Ahora no
              </button>
              <button
                onClick={async () => {
                  setStoragePermissionModal(false);
                  try {
                    await NativeSettings.open({ optionAndroid: AndroidSettings.ApplicationDetails });
                  } catch (e) {
                    showToast("Aviso", "Abre manualmente: Ajustes del teléfono → Apps → Salinas Burger → Permisos.", "alert");
                  }
                }}
                className="flex-1 px-3 py-2.5 rounded-lg bg-yellow-500 text-red-950 font-bold text-xs hover:bg-yellow-400 transition shadow"
              >
                Abrir Ajustes del Teléfono
              </button>
            </div>
          </div>
        </div>
      )}

      {notificationsModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-yellow-400" />
                <h3 className="font-bold text-base text-white">Centro de Notificaciones</h3>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={() => { setNotifications([]); showToast("Aviso", "Se borraron todas las notificaciones.", "alert"); }}
                    className="text-xs text-red-400 hover:text-red-300 font-bold px-2.5 py-1 rounded-lg bg-red-950/50 border border-red-900/50"
                  >
                    Borrar todas
                  </button>
                )}
                <button onClick={() => setNotificationsModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {notifications.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-xs italic">No tienes notificaciones pendientes.</div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="bg-gray-950 border border-gray-800 p-3 rounded-xl flex items-start justify-between gap-3 shadow">
                    <div>
                      <h4 className="font-bold text-xs text-white">{n.title}</h4>
                      <p className="text-[11px] text-gray-300 mt-0.5">{n.message}</p>
                      <span className="text-[9px] text-gray-500 mt-1 block font-mono">{n.time}</span>
                    </div>
                    <button
                      onClick={() => setNotifications((prev) => prev.filter((x) => x.id !== n.id))}
                      className="text-gray-500 hover:text-white p-1 rounded transition"
                      title="Eliminar notificación"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => setNotificationsModal(false)}
                className="px-5 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-red-950 font-bold text-xs shadow"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Sliders size={18} className="text-yellow-400" /> Ajustes de Sistema, Logo y Audio
              </h3>
              <button onClick={() => setSettingsModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-3 bg-gray-950 p-4 rounded-xl border border-gray-800">
                <h4 className="font-bold text-yellow-400 mb-2 flex items-center gap-1.5"><ImageIcon size={14} /> Logo Oficial de Salinas Burger</h4>
                <div className="space-y-2">
                  <label className="block font-bold text-gray-300">Seleccionar Imagen del Logo</label>
                  <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-lg p-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {audioSettings.logoUrl ? (
                        <img src={audioSettings.logoUrl} alt="Logo actual" className="w-10 h-10 rounded-lg object-cover border border-gray-800 shrink-0" onError={(e) => { e.target.style.display = "none"; }} />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0"><ImageIcon size={16} className="text-gray-600" /></div>
                      )}
                      <p className="text-[10px] text-gray-400 truncate">{audioSettings.logoUrl ? "Logo cargado" : "Ningún logo seleccionado"}</p>
                    </div>
                    <button
                      onClick={handleSelectLogo}
                      className="bg-yellow-500 hover:bg-yellow-400 text-red-950 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer transition shadow shrink-0"
                    >
                      Seleccionar PNG
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3 bg-gray-950 p-4 rounded-xl border border-gray-800">
                <h4 className="font-bold text-yellow-400 mb-2">📲 Números de Enlace Automático</h4>
                
                <div className="space-y-1">
                  <label className="flex items-center gap-1.5 font-bold text-gray-300">
                    <UtensilsCrossed size={14} className="text-yellow-500" /> Número de WhatsApp Business (Negocio)
                  </label>
                  <input
                    type="text"
                    value={audioSettings.whatsappBusinessPhone}
                    onChange={(e) => { setAudioSettings({ ...audioSettings, whatsappBusinessPhone: e.target.value }); setHasUnsavedChanges(true); autoSaveLocally(); }}
                    placeholder="+593 98 888 8888"
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-yellow-500"
                  />
                </div>

                <div className="space-y-1 pt-2">
                  <label className="flex items-center gap-1.5 font-bold text-gray-300">
                    <Bike size={14} className="text-blue-400" /> Número de Teléfono del Motorizado (Agencia)
                  </label>
                  <input
                    type="text"
                    value={audioSettings.motorcyclePhone}
                    onChange={(e) => { setAudioSettings({ ...audioSettings, motorcyclePhone: e.target.value }); setHasUnsavedChanges(true); autoSaveLocally(); }}
                    placeholder="+593 99 999 9999"
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-yellow-500"
                  />
                </div>

                <div className="space-y-1 pt-2">
                  <label className="flex items-center gap-1.5 font-bold text-gray-300">
                    <Bike size={14} className="text-yellow-400" /> Tu Número (Dueño) — recibe las cotizaciones de envío del bot
                  </label>
                  <input
                    type="text"
                    value={audioSettings.ownerPhone}
                    onChange={(e) => { setAudioSettings({ ...audioSettings, ownerPhone: e.target.value }); setHasUnsavedChanges(true); autoSaveLocally(); }}
                    placeholder="+593 99 999 9999"
                    className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-yellow-500"
                  />
                  <p className="text-xs text-gray-500">Cuando un cliente pide domicilio, el bot te escribe a este número con los datos del pedido. Tú se lo pasas al motorizado y le respondes al bot con el precio.</p>
                </div>
              </div>

              <div className="space-y-1 bg-gray-950 p-3.5 rounded-xl border border-gray-800">
                <div className="flex justify-between font-semibold text-gray-300">
                  <span>Volumen General de Notificaciones</span>
                  <span className="text-yellow-400">{Math.round(audioSettings.volume * 100)}%</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.05"
                  value={audioSettings.volume}
                  onChange={(e) => setAudioSettings({ ...audioSettings, volume: parseFloat(e.target.value) })}
                  className="w-full accent-yellow-500 cursor-pointer mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-800">
              <button
                onClick={() => {
                  setSettingsModal(false);
                  handleSaveAllChanges();
                }}
                className="px-5 py-2 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-red-950 font-bold text-xs shadow"
              >
                Guardar Ajustes y Sincronizar
              </button>
            </div>
          </div>
        </div>
      )}

      {exitConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-yellow-600/50 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center mx-auto text-xl font-bold">⚠️</div>
            <h3 className="font-bold text-base text-white">¿Desea guardar los cambios en Firebase antes de salir?</h3>
            <p className="text-xs text-gray-300">Tiene modificaciones pendientes que no han sido enviadas a la base de datos de Salinas Burger.</p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setExitConfirmModal(false); window.location.reload(); }}
                className="flex-1 px-3 py-2 rounded-lg bg-gray-800 text-gray-300 font-semibold text-xs hover:bg-gray-700"
              >
                Salir sin guardar
              </button>
              <button
                onClick={() => { handleSaveAllChanges(); setExitConfirmModal(false); }}
                className="flex-1 px-3 py-2 rounded-lg bg-yellow-500 text-red-950 font-bold text-xs hover:bg-yellow-400 shadow"
              >
                Guardar y Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {productModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="font-bold text-base text-white">{productModal.id ? "Editar Ítem o Combo" : "Agregar Nuevo Ítem"}</h3>
              <button onClick={() => setProductModal(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Nombre del Plato / Combo / Bebida</label>
                <input value={productModal.name} onChange={(e) => setProductModal({ ...productModal, name: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500" />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Categoría</label>
                <select value={productModal.category} onChange={(e) => setProductModal({ ...productModal, category: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500">
                  <option value="burger">Hamburguesa</option>
                  <option value="other">Papas & Extras</option>
                  <option value="drink">Bebida</option>
                  <option value="combo">Combo</option>
                  <option value="sauce">Salsa</option>
                </select>
              </div>
              {productModal.category === "drink" && (
                <div>
                  <label className="block text-gray-400 mb-1">Volumen (ml o LT)</label>
                  <input value={productModal.volume} onChange={(e) => setProductModal({ ...productModal, volume: e.target.value })} placeholder="Ej: 300 ml o 1.5 LT" className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500" />
                </div>
              )}
              {productModal.category !== "sauce" && (
                <div>
                  <label className="block text-gray-400 mb-1">Precio ($)</label>
                  <input type="number" step="0.25" value={productModal.price} onChange={(e) => setProductModal({ ...productModal, price: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500" />
                </div>
              )}
              <div>
                <label className="block text-gray-400 mb-1">Ingredientes / Descripción</label>
                <textarea rows={3} value={productModal.desc} onChange={(e) => setProductModal({ ...productModal, desc: e.target.value })} className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500" />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Imagen del Producto</label>
                <div className="flex items-center gap-3 bg-gray-950 border border-gray-800 rounded-lg p-2.5">
                  {productModal.img ? (
                    <img src={productModal.img} alt="Vista previa" className="w-12 h-12 rounded-lg object-contain border border-gray-800 shrink-0 bg-black/40" onError={(e) => { e.target.style.display = "none"; }} />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center shrink-0"><ImageIcon size={16} className="text-gray-600" /></div>
                  )}
                  <button
                    onClick={handleSelectProductImage}
                    className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-red-950 text-xs font-bold px-3 py-2 rounded-lg transition shadow"
                  >
                    {productModal.img ? "Cambiar Imagen" : "Seleccionar Imagen"}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
              <button onClick={() => setProductModal(null)} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 font-semibold text-xs hover:bg-gray-700">Cancelar</button>
              <button onClick={saveProduct} className="px-4 py-2 rounded-lg bg-yellow-500 text-red-950 font-bold text-xs hover:bg-yellow-400 shadow">Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}

      {nuevoEnvioModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="font-bold text-base text-white">Registrar Cotización Manual de Envío</h3>
              <button onClick={() => setNuevoEnvioModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Zona (Sector)</label>
                <input
                  value={nuevoEnvioForm.sector}
                  onChange={(e) => setNuevoEnvioForm({ ...nuevoEnvioForm, sector: e.target.value })}
                  placeholder="Ej: Chipipe, San Lorenzo..."
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Número de Orden</label>
                <input
                  value={nuevoEnvioForm.pedidoId}
                  onChange={(e) => setNuevoEnvioForm({ ...nuevoEnvioForm, pedidoId: e.target.value })}
                  placeholder="ORD-00X"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Distancia</label>
                <input
                  value={nuevoEnvioForm.distancia}
                  onChange={(e) => setNuevoEnvioForm({ ...nuevoEnvioForm, distancia: e.target.value })}
                  placeholder="2.5 km"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Valor del Envío ($)</label>
                <input
                  type="number" step="0.5"
                  value={nuevoEnvioForm.costo}
                  onChange={(e) => setNuevoEnvioForm({ ...nuevoEnvioForm, costo: e.target.value })}
                  placeholder="3.00"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
              <button onClick={() => setNuevoEnvioModal(false)} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 font-semibold text-xs hover:bg-gray-700">Cancelar</button>
              <button onClick={registrarEnvioManual} className="px-4 py-2 rounded-lg bg-yellow-500 text-red-950 font-bold text-xs hover:bg-yellow-400 shadow">Guardar Registro</button>
            </div>
          </div>
        </div>
      )}

      {expenseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="font-bold text-base text-white">Registrar Gasto</h3>
              <button onClick={() => setExpenseModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Motivo del gasto</label>
                <input value={expenseForm.desc} onChange={(e) => setExpenseForm({ ...expenseForm, desc: e.target.value })} placeholder="Ej: Compra de carbón" className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500" />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Valor ($)</label>
                <input type="number" step="0.05" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} placeholder="0.00" className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2 text-white focus:outline-none focus:border-yellow-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
              <button onClick={() => setExpenseModal(false)} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 font-semibold text-xs hover:bg-gray-700">Cancelar</button>
              <button onClick={confirmExpense} className="px-4 py-2 rounded-lg bg-yellow-500 text-red-950 font-bold text-xs hover:bg-yellow-400 shadow">Registrar</button>
            </div>
          </div>
        </div>
      )}

      {cashCloseModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-800 pb-3">
              <h3 className="font-bold text-base text-white">🔒 Confirmar Cierre de Turno</h3>
              <button onClick={() => setCashCloseModal(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <p className="text-xs text-gray-300">Total de comidas por transferencias validadas en este turno:</p>
            <p className="text-2xl font-black text-green-400">${totalTransfers.toFixed(2)}</p>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
              <button onClick={() => setCashCloseModal(false)} className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 font-semibold text-xs hover:bg-gray-700">Cancelar</button>
              <button onClick={confirmCashClose} className="px-4 py-2 rounded-lg bg-yellow-500 text-red-950 font-bold text-xs hover:bg-yellow-400 shadow">Confirmar Cierre</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}