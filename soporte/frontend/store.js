/* ============================================================
   STORE — Simula el backend de Python en JS.
   Replica fielmente:
     - Cola heap por prioridad (critica=1, alta=2, media=3, baja=4)
     - Clasificador por palabras clave + IA (placeholder)
     - Detector de duplicados (similitud de texto)
     - Historial, cancelados, estadísticas
   ============================================================ */

// ============================================================
// CLASIFICADOR
// ============================================================
const PALABRAS = {
  critica: ["caido", "perdida de datos", "urgente",
            "sin acceso", "todos los usuarios", "no funciona nada",
            "sistema caido", "fuera de servicio", "no puede trabajar nadie",
            "todo el equipo", "toda la oficina", "produccion", "critico"],
  alta:    ["error", "falla", "no carga", "no abre", "no responde",
            "no puedo", "imposible", "grave", "bloqueado", "trabado"],
  media:   ["lento", "tarda", "demora", "intermitente",
            "ocasional", "raro", "a veces"],
  baja:    ["cambiar", "actualizar", "consulta", "quisiera",
            "me gustaría", "cuando pueda", "pequeño", "duda", "pregunta"],
  hardware: ["teclado", "pantalla", "monitor", "computador", "computadora",
             "impresora", "mouse", "disco", "memoria", "equipo",
             "dispositivo", "cable", "usb", "ram", "ventilador"],
  software: ["programa", "aplicacion", "app", "sistema",
             "software", "instalacion", "actualizar",
             "error al abrir", "se cierra", "excel", "outlook", "word",
             "navegador", "chrome", "firefox", "office", "antivirus"],
  red:      ["internet", "red", "wifi", "wi-fi", "conexion",
             "conectar", "pagina", "navegar", "sin senal",
             "lento internet", "vpn", "lan", "router", "modem"],
  cuenta:   ["contrasena", "password", "usuario", "acceso", "iniciar sesion",
             "cuenta", "bloqueado", "permiso", "login",
             "ingresar", "mi clave"]
};

function normalize(s) {
  return (s || "").toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function countMatches(text, words) {
  const n = normalize(text);
  return words.reduce((sum, w) => sum + (n.includes(normalize(w)) ? 1 : 0), 0);
}

function clasificarCategoria(descripcion) {
  const puntajes = {
    "hardware": countMatches(descripcion, PALABRAS.hardware),
    "software": countMatches(descripcion, PALABRAS.software),
    "red": countMatches(descripcion, PALABRAS.red),
    "cuenta de usuario": countMatches(descripcion, PALABRAS.cuenta)
  };
  const max = Math.max(...Object.values(puntajes));
  if (max === 0) return "otro";
  return Object.keys(puntajes).find(k => puntajes[k] === max);
}

function clasificarTicket(descripcion) {
  const categoria = clasificarCategoria(descripcion);

  const puntajes = {
    critica: countMatches(descripcion, PALABRAS.critica),
    alta: countMatches(descripcion, PALABRAS.alta),
    media: countMatches(descripcion, PALABRAS.media),
    baja: countMatches(descripcion, PALABRAS.baja)
  };

  if (puntajes.critica >= 2) {
    return { categoria, prioridad: "critica", razon: `${puntajes.critica} señales críticas detectadas en la descripción.` };
  }
  if (puntajes.critica === 1) puntajes.alta += 1;

  const orden = ["alta", "media", "baja"];
  const max = Math.max(puntajes.alta, puntajes.media, puntajes.baja);

  if (max === 0) {
    const fallback = { "red": "alta", "hardware": "media", "software": "media", "cuenta de usuario": "baja", "otro": "baja" };
    const prioridad = fallback[categoria] || "media";
    return { categoria, prioridad, razon: `Sin palabras clave fuertes; prioridad inferida por categoría '${categoria}'.` };
  }

  const prioridad = orden.find(p => puntajes[p] === max);
  return { categoria, prioridad, razon: `Detectadas señales: alta=${puntajes.alta}, media=${puntajes.media}, baja=${puntajes.baja}.` };
}

// Similitud de texto (Dice coefficient sobre bigramas — rápido y razonable)
function similitud(a, b) {
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;
  const bigA = new Set();
  const bigB = new Set();
  for (let i = 0; i < na.length - 1; i++) bigA.add(na.substring(i, i + 2));
  for (let i = 0; i < nb.length - 1; i++) bigB.add(nb.substring(i, i + 2));
  let inter = 0;
  bigA.forEach(g => { if (bigB.has(g)) inter++; });
  return (2 * inter) / (bigA.size + bigB.size);
}

function detectarDuplicados(descripcionNueva, categoria, ticketsEnEspera, threshold = 0.55) {
  return ticketsEnEspera.filter(t =>
    t.categoria === categoria &&
    similitud(descripcionNueva, t.descripcion) >= threshold
  );
}

// ============================================================
// PRIORIDAD ↔ NUMERO
// ============================================================
const PRIO_NUM = { critica: 1, alta: 2, media: 3, baja: 4 };
const PRIO_LABEL = { critica: "Crítica", alta: "Alta", media: "Media", baja: "Baja" };
const CAT_LABEL = {
  "hardware": "Hardware",
  "software": "Software",
  "red": "Red",
  "cuenta de usuario": "Cuenta",
  "otro": "Otro"
};
const CAT_KEY = { // para clases css
  "hardware": "hardware",
  "software": "software",
  "red": "red",
  "cuenta de usuario": "cuenta",
  "otro": "otro"
};

// ============================================================
// DEMO DATA
// ============================================================
function nowMinus(min) {
  return new Date(Date.now() - min * 60_000);
}

function buildDemoState() {
  let id = 1;
  const mk = (nombre, descripcion, minAtras) => {
    const t = {
      id: id++,
      nombre,
      descripcion,
      categoria: null,
      prioridad: null,
      horaLlegada: nowMinus(minAtras),
      horaInicioAtencion: null,
      horaSolucion: null,
      solucion: null,
      estado: "en espera"
    };
    const { categoria, prioridad } = clasificarTicket(descripcion);
    t.categoria = categoria;
    t.prioridad = prioridad;
    return t;
  };

  const cola = [
    mk("María González",   "El servidor de archivos está caído y no puede trabajar nadie de contabilidad, urgente", 4),
    mk("Carlos Ramírez",   "No carga el Outlook, da error al abrir el programa", 12),
    mk("Laura Pérez",      "WiFi caído en piso 3, varios usuarios sin internet", 18),
    mk("Diego Suárez",     "Mi pantalla parpadea de a ratos, intermitente", 25),
    mk("Sofía Castaño",    "Olvidé mi contraseña y no puedo iniciar sesión en el sistema", 32),
    mk("Andrés Molina",    "Quisiera actualizar la versión del Excel cuando pueda, no es urgente", 41),
    mk("Valentina Ortiz",  "El antivirus se cierra solo, ya probé reiniciar", 49),
    mk("Roberto Aguilar",  "La impresora del piso 2 no responde desde la mañana", 58),
  ];

  const historial = [
    {
      id: 100, nombre: "Andrea López",
      descripcion: "No me conecta a la VPN, error de conexión",
      categoria: "red", prioridad: "alta",
      horaLlegada: nowMinus(220), horaInicioAtencion: nowMinus(210), horaSolucion: nowMinus(192),
      solucion: "Renové el certificado de VPN y reinstalé el cliente. Resuelto.",
      estado: "resuelto"
    },
    {
      id: 101, nombre: "Pablo Méndez",
      descripcion: "Cambiar el tamaño de fuente del sistema interno",
      categoria: "software", prioridad: "baja",
      horaLlegada: nowMinus(180), horaInicioAtencion: nowMinus(160), horaSolucion: nowMinus(149),
      solucion: "Apliqué la configuración global de zoom 110% en el navegador.",
      estado: "resuelto"
    },
    {
      id: 102, nombre: "Camila Rojas",
      descripcion: "El mouse no responde, ya cambié pilas",
      categoria: "hardware", prioridad: "media",
      horaLlegada: nowMinus(140), horaInicioAtencion: nowMinus(125), horaSolucion: nowMinus(108),
      solucion: "Reemplazo del receptor USB inalámbrico. Operativo.",
      estado: "resuelto"
    },
    {
      id: 103, nombre: "Felipe Cano",
      descripcion: "Sistema de facturación caído, todos los usuarios afectados, urgente",
      categoria: "software", prioridad: "critica",
      horaLlegada: nowMinus(90), horaInicioAtencion: nowMinus(86), horaSolucion: nowMinus(58),
      solucion: "Reinicio del servicio en el servidor de aplicaciones y purge de caché.",
      estado: "resuelto"
    },
    {
      id: 104, nombre: "Daniela Quiroz",
      descripcion: "Bloqueado mi acceso al portal de RRHH",
      categoria: "cuenta de usuario", prioridad: "alta",
      horaLlegada: nowMinus(60), horaInicioAtencion: nowMinus(48), horaSolucion: nowMinus(34),
      solucion: "Desbloqueo manual desde AD y forzado de cambio de contraseña al próximo login.",
      estado: "resuelto"
    },
  ];

  const cancelados = [
    {
      id: 200, nombre: "Tomás Reyes",
      descripcion: "Mouse tarda en responder",
      categoria: "hardware", prioridad: "media",
      horaLlegada: nowMinus(310), horaInicioAtencion: null, horaSolucion: null,
      solucion: null, estado: "cancelado"
    },
    {
      id: 201, nombre: "Lucía Vargas",
      descripcion: "Actualizar driver de la impresora",
      categoria: "software", prioridad: "baja",
      horaLlegada: nowMinus(250), horaInicioAtencion: null, horaSolucion: null,
      solucion: null, estado: "cancelado"
    },
  ];

  return {
    cola,
    historial,
    cancelados,
    ticketActual: null,
    contadorId: 1000,
    tiempoAtencionPromedio: 15,
    tiempoLimiteAtencion: 30,
    ticketPendiente: null
  };
}

// ============================================================
// HELPERS DE ORDEN (cola heap → lista ordenada por prioridad y luego por id)
// ============================================================
function ordenarCola(cola) {
  return [...cola].sort((a, b) => {
    const da = PRIO_NUM[a.prioridad] - PRIO_NUM[b.prioridad];
    return da !== 0 ? da : a.id - b.id;
  });
}

// Index en el heap binario (top = peek)
function heapVisualOrder(cola) {
  return ordenarCola(cola);
}

// ============================================================
// FORMATTERS
// ============================================================
function fmtHora(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}
function fmtMinAgo(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  const min = Math.max(0, Math.round((Date.now() - dt.getTime()) / 60000));
  if (min < 1) return "hace segundos";
  if (min === 1) return "hace 1 min";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  return h === 1 ? "hace 1 h" : `hace ${h} h`;
}
function fmtDur(start, end) {
  if (!start || !end) return "—";
  const a = start instanceof Date ? start : new Date(start);
  const b = end instanceof Date ? end : new Date(end);
  const min = Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60); const r = min % 60;
  return r ? `${h}h ${r}min` : `${h}h`;
}

// Export to window for cross-script access
Object.assign(window, {
  clasificarTicket, detectarDuplicados, similitud,
  PRIO_NUM, PRIO_LABEL, CAT_LABEL, CAT_KEY,
  buildDemoState, ordenarCola, heapVisualOrder,
  fmtHora, fmtMinAgo, fmtDur, normalize
});
