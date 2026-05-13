"""
Clasificador de tickets de soporte técnico.

Estrategia:
1. Intenta clasificar usando OpenAI (categoría + prioridad en una sola llamada).
2. Si la API falla por cualquier motivo, cae al clasificador local
   basado en palabras clave.

El fallback garantiza que el sistema sigue funcionando sin internet
o cuando OpenAI está caído.
"""
import os
import unicodedata
from enum import Enum
from openai import OpenAI
from pydantic import BaseModel
from dotenv import load_dotenv
from difflib import SequenceMatcher

load_dotenv()


def _normalizar(texto: str) -> str:
    """
    Pasa a minusculas y remueve tildes/acentos.
    Asi 'caído' y 'caido' (o 'CAIDO') matchean igual.
    """
    sin_tildes = unicodedata.normalize("NFKD", texto)
    sin_tildes = "".join(c for c in sin_tildes if not unicodedata.combining(c))
    return sin_tildes.lower()

_cliente = None


def _get_cliente():
    global _cliente
    if _cliente is None:
        _cliente = OpenAI()
    return _cliente


# ==================== ESQUEMA DE RESPUESTA ====================

class NivelPrioridad(str, Enum):
    CRITICA = "critica"
    ALTA    = "alta"
    MEDIA   = "media"
    BAJA    = "baja"


class NivelCategoria(str, Enum):
    HARDWARE        = "hardware"
    SOFTWARE        = "software"
    RED             = "red"
    CUENTA_USUARIO  = "cuenta de usuario"
    OTRO            = "otro"


class ClasificacionTicket(BaseModel):
    categoria: NivelCategoria
    prioridad: NivelPrioridad
    razon:     str  # explicacion corta del modelo


# ==================== PROMPT ====================

PROMPT_SISTEMA = (
    "Sos un clasificador de tickets de soporte tecnico. "
    "Dado el problema del usuario, asignas una categoria y una prioridad.\n\n"

    "CATEGORIAS:\n"
    "- hardware: problemas fisicos con equipos (teclado, pantalla, computador).\n"
    "- software: problemas con programas o aplicaciones.\n"
    "- red: problemas de conectividad o internet.\n"
    "- cuenta de usuario: problemas de acceso, contraseñas, permisos.\n"
    "- otro: no encaja en ninguna categoria anterior.\n\n"

    "PRIORIDADES:\n"
    "- critica: caidas totales, perdida de datos, multiples usuarios afectados.\n"
    "- alta: errores que impiden trabajar a un usuario individual.\n"
    "- media: problemas que ralentizan pero no bloquean, intermitencia.\n"
    "- baja: consultas, cambios cosmeticos, mejoras opcionales.\n\n"

    "Devolve la categoria, la prioridad y una razon breve en una sola frase."
)


# ==================== CLASIFICADOR CON IA ====================

def clasificar_con_ia(descripcion: str) -> tuple[str, str, str]:
    """
    Llama a OpenAI para clasificar el ticket.
    Retorna (categoria, prioridad, razon). Lanza excepcion si falla.
    """
    cliente = _get_cliente()
    respuesta = cliente.chat.completions.parse(
        model="gpt-5.4-nano",
        messages=[
            {"role": "system", "content": PROMPT_SISTEMA},
            {"role": "user",   "content": f"Problema: {descripcion}"}
        ],
        response_format=ClasificacionTicket,
        temperature=0
    )
    resultado = respuesta.choices[0].message.parsed
    return resultado.categoria.value, resultado.prioridad.value, resultado.razon


# ==================== CLASIFICADOR LOCAL (FALLBACK) ====================

PALABRAS_CRITICAS = [
    "caído", "caida", "perdida de datos", "urgente",
    "sin acceso", "todos los usuarios", "no funciona nada",
    "sistema caido", "fuera de servicio", "no puede trabajar nadie"
]

PALABRAS_ALTAS = [
    "error", "falla", "no carga", "no abre", "no responde",
    "no puedo", "imposible", "grave"
]

PALABRAS_MEDIAS = [
    "lento", "tarda", "demora", "intermitente",
    "a veces", "ocasional", "raro"
]

PALABRAS_BAJAS = [
    "cambiar", "actualizar", "consulta", "quisiera",
    "me gustaría", "cuando pueda", "pequeño"
]

PALABRAS_HARDWARE = [
    "teclado", "pantalla", "monitor", "computador", "impresora",
    "mouse", "disco", "memoria", "equipo", "dispositivo"
]

PALABRAS_SOFTWARE = [
    "programa", "aplicacion", "app", "sistema", "software",
    "instalacion", "actualizar", "error al abrir", "se cierra"
]

PALABRAS_RED = [
    "internet", "red", "wifi", "conexion", "conectar",
    "pagina", "navegar", "sin señal", "lento internet"
]

PALABRAS_CUENTA = [
    "contraseña", "password", "usuario", "acceso", "iniciar sesion",
    "cuenta", "bloqueado", "permiso", "login"
]


def clasificar_categoria_local(descripcion: str) -> str:
    """Detecta la categoría según palabras clave en la descripción."""
    desc = _normalizar(descripcion)

    puntajes = {
        "hardware":         sum(1 for p in PALABRAS_HARDWARE if _normalizar(p) in desc),
        "software":         sum(1 for p in PALABRAS_SOFTWARE if _normalizar(p) in desc),
        "red":              sum(1 for p in PALABRAS_RED      if _normalizar(p) in desc),
        "cuenta de usuario":sum(1 for p in PALABRAS_CUENTA   if _normalizar(p) in desc),
    }

    mejor = max(puntajes, key=puntajes.get)
    return mejor if puntajes[mejor] > 0 else "otro"


def clasificar_por_palabras(descripcion: str) -> tuple[str, str, str]:
    """
    Clasifica usando un sistema de puntajes por palabras clave.
    No depende de internet.

    Reglas:
    - Cada nivel suma 1 por cada palabra clave detectada.
    - 'critica' requiere al menos 2 coincidencias para evitar falsos positivos
      (palabras como 'urgente' solas no alcanzan).
    - Entre alta/media/baja gana el de mayor puntaje. En empate, gana la
      prioridad más alta.
    - Si no hay coincidencias, se usa un fallback por categoría.
    """
    desc = _normalizar(descripcion)
    categoria = clasificar_categoria_local(descripcion)

    puntajes = {
        "critica": sum(1 for p in PALABRAS_CRITICAS if _normalizar(p) in desc),
        "alta":    sum(1 for p in PALABRAS_ALTAS    if _normalizar(p) in desc),
        "media":   sum(1 for p in PALABRAS_MEDIAS   if _normalizar(p) in desc),
        "baja":    sum(1 for p in PALABRAS_BAJAS    if _normalizar(p) in desc),
    }

    # critica requiere >=2 señales para confirmarse
    if puntajes["critica"] >= 2:
        return categoria, "critica", f"{puntajes['critica']} señales criticas detectadas"

    # 1 sola señal critica no alcanza para criticar, pero sumamos como alta
    # para no perderla en el fallback
    if puntajes["critica"] == 1:
        puntajes["alta"] += 1

    # entre el resto: mayor puntaje gana; en empate gana mayor prioridad
    orden = ["alta", "media", "baja"]
    candidatos = {p: puntajes[p] for p in orden}

    if max(candidatos.values()) == 0:
        # sin palabras clave: usar categoria como criterio de prioridad
        fallback_prioridad = {
            "red": "alta", "hardware": "media",
            "software": "media", "cuenta de usuario": "baja", "otro": "baja"
        }
        prioridad = fallback_prioridad.get(categoria, "media")
        return categoria, prioridad, f"sin palabras clave, fallback por categoria '{categoria}'"

    prioridad = max(orden, key=lambda p: (candidatos[p], -orden.index(p)))
    return categoria, prioridad, f"puntajes {puntajes} → '{prioridad}'"


# ==================== DETECTOR DE DUPLICADOS ====================

def detectar_duplicados(descripcion_nueva: str, categoria: str, tickets_en_espera: list) -> list:
    """
    Devuelve TODOS los tickets en espera que parecen duplicados del nuevo.

    Estrategia:
    1. Filtra los tickets de la misma categoría.
    2. Le pregunta a OpenAI cuáles son similares (puede devolver varios IDs).
    3. Si la IA falla o el parseo no es válido, cae al fallback local con
       SequenceMatcher y threshold 0.75.

    Retorna lista vacía si no hay duplicados.
    """
    tickets_misma_categoria = [
        t for t in tickets_en_espera if t.categoria == categoria
    ]

    if not tickets_misma_categoria:
        return []

    try:
        cliente = _get_cliente()
        lista = "\n".join(
            f"- Ticket #{t.id}: {t.descripcion}"
            for t in tickets_misma_categoria
        )
        prompt = (
            f"Tienes estos tickets abiertos de categoría '{categoria}':\n{lista}\n\n"
            f"El usuario quiere crear este ticket:\n\"{descripcion_nueva}\"\n\n"
            "Identifica SOLO los tickets que reportan el MISMO incidente sobre un "
            "RECURSO COMPARTIDO (servidor caido, WiFi de un piso, impresora del area, "
            "sistema corporativo, VPN, red del edificio, etc.).\n\n"
            "Si los tickets describen problemas en recursos INDIVIDUALES de cada usuario "
            "(su propio teclado, su mouse, su contraseña personal, su laptop, su Outlook, "
            "su pantalla, su pc), NO son duplicados aunque la redacción sea parecida, "
            "porque cada usuario tiene su propia instancia del recurso.\n\n"
            "Responde ÚNICAMENTE con los IDs separados por comas (ejemplo: 3,5,7) "
            "o con la palabra 'ninguno' si no hay coincidencias."
        )
        respuesta = cliente.chat.completions.create(
            model="gpt-5.4-nano",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        texto = respuesta.choices[0].message.content.strip().lower()

        if texto == "ninguno":
            return []

        ids_duplicados = {int(x.strip()) for x in texto.split(",") if x.strip().isdigit()}
        duplicados = [t for t in tickets_misma_categoria if t.id in ids_duplicados]

        # si el parseo dejó la lista vacía pero el modelo dijo algo distinto a "ninguno",
        # forzamos el fallback para no perder posibles coincidencias
        if not duplicados and ids_duplicados == set():
            raise ValueError("respuesta de IA no parseable")

        return duplicados

    except Exception:
        # fallback local con similitud de texto (normalizada para no fallar por tildes)
        desc_nueva_norm = _normalizar(descripcion_nueva)
        return [
            t for t in tickets_misma_categoria
            if SequenceMatcher(
                None,
                desc_nueva_norm,
                _normalizar(t.descripcion)
            ).ratio() > 0.75
        ]


# ==================== PUNTO DE ENTRADA UNIFICADO ====================

def clasificar_ticket(descripcion: str) -> tuple[str, str, str]:
    """
    Clasifica un ticket asignando categoría y prioridad automáticamente.
    Intenta primero con IA; si falla, usa el clasificador local.
    Retorna (categoria, prioridad, razon).
    """
    try:
        categoria, prioridad, razon = clasificar_con_ia(descripcion)
        print(f"  → [IA] Categoría: {categoria} | Prioridad: {prioridad}")
        print(f"    Razón: {razon}")
        return categoria, prioridad, razon
    except Exception as e:
        categoria, prioridad, razon = clasificar_por_palabras(descripcion)
        print(f"  ⚠ API no disponible ({type(e).__name__}). Usando clasificador local.")
        print(f"  → [Local] Categoría: {categoria} | Prioridad: {prioridad}")
        print(f"    Razón: {razon}")
        return categoria, prioridad, razon
