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
from enum import Enum
from openai import OpenAI
from pydantic import BaseModel
from dotenv import load_dotenv
from difflib import SequenceMatcher

load_dotenv()

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
    "caído", "caida", "no funciona", "todos", "nadie",
    "perdida de datos", "no puedo acceder", "urgente",
    "bloqueado", "sin acceso", "completo"
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
    desc = descripcion.lower()

    puntajes = {
        "hardware":         sum(1 for p in PALABRAS_HARDWARE if p in desc),
        "software":         sum(1 for p in PALABRAS_SOFTWARE if p in desc),
        "red":              sum(1 for p in PALABRAS_RED      if p in desc),
        "cuenta de usuario":sum(1 for p in PALABRAS_CUENTA   if p in desc),
    }

    mejor = max(puntajes, key=puntajes.get)
    return mejor if puntajes[mejor] > 0 else "otro"


def clasificar_por_palabras(descripcion: str) -> tuple[str, str, str]:
    """
    Clasifica usando palabras clave. No depende de internet.
    Retorna (categoria, prioridad, razon).
    """
    desc = descripcion.lower()
    categoria = clasificar_categoria_local(desc)

    for palabra in PALABRAS_CRITICAS:
        if palabra in desc:
            return categoria, "critica", f"palabra clave detectada: '{palabra}'"

    for palabra in PALABRAS_ALTAS:
        if palabra in desc:
            return categoria, "alta", f"palabra clave detectada: '{palabra}'"

    for palabra in PALABRAS_MEDIAS:
        if palabra in desc:
            return categoria, "media", f"palabra clave detectada: '{palabra}'"

    for palabra in PALABRAS_BAJAS:
        if palabra in desc:
            return categoria, "baja", f"palabra clave detectada: '{palabra}'"

    # sin palabras clave: usar categoria como criterio de prioridad
    fallback_prioridad = {
        "red": "alta", "hardware": "media",
        "software": "media", "cuenta de usuario": "baja", "otro": "baja"
    }
    prioridad = fallback_prioridad.get(categoria, "media")
    return categoria, prioridad, f"sin palabras clave, fallback por categoria '{categoria}'"


# ==================== DETECTOR DE DUPLICADOS ====================

def detectar_duplicado(descripcion_nueva: str, categoria: str, tickets_en_espera: list) -> object | None:
    tickets_misma_categoria = [
        t for t in tickets_en_espera if t.categoria == categoria
    ]

    if not tickets_misma_categoria:
        return None

    try:
        cliente = _get_cliente()
        lista = "\n".join(
            f"- Ticket #{t.id}: {t.descripcion}"
            for t in tickets_misma_categoria
        )
        prompt = (
            f"Tienes estos tickets abiertos de categoría '{categoria}':\n{lista}\n\n"
            f"El usuario quiere crear este ticket:\n\"{descripcion_nueva}\"\n\n"
            "¿Alguno de los tickets abiertos trata el mismo problema?\n"
            "Responde ÚNICAMENTE con el número del ID del ticket similar (ejemplo: 3) "
            "o con la palabra 'ninguno'."
        )
        respuesta = cliente.chat.completions.create(
            model="gpt-5.4-nano",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        texto = respuesta.choices[0].message.content.strip().lower()

        if texto != "ninguno":
            id_duplicado = int(texto)
            for t in tickets_misma_categoria:
                if t.id == id_duplicado:
                    return t

    except Exception:
        # fallback local con similitud de texto
        for ticket in tickets_misma_categoria:
            similitud = SequenceMatcher(
                None,
                descripcion_nueva.lower(),
                ticket.descripcion.lower()
            ).ratio()
            if similitud > 0.5:
                return ticket

    return None


# ==================== PUNTO DE ENTRADA UNIFICADO ====================

def clasificar_ticket(descripcion: str) -> tuple[str, str]:
    """
    Clasifica un ticket asignando categoría y prioridad automáticamente.
    Intenta primero con IA; si falla, usa el clasificador local.
    Retorna (categoria, prioridad).
    """
    try:
        categoria, prioridad, razon = clasificar_con_ia(descripcion)
        print(f"  → [IA] Categoría: {categoria} | Prioridad: {prioridad}")
        print(f"    Razón: {razon}")
        return categoria, prioridad
    except Exception as e:
        categoria, prioridad, razon = clasificar_por_palabras(descripcion)
        print(f"  ⚠ API no disponible ({type(e).__name__}). Usando clasificador local.")
        print(f"  → [Local] Categoría: {categoria} | Prioridad: {prioridad}")
        print(f"    Razón: {razon}")
        return categoria, prioridad