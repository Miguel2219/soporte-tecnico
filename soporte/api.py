"""
API REST sobre la clase SoporteTecnico, con FastAPI.

Sirve tambien el frontend estatico desde /frontend/.

Para correr:
    cd <carpeta padre de soporte/>
    pip install fastapi uvicorn
    uvicorn soporte.api:app --reload

Despues abrir http://localhost:8000/

El estado vive en memoria. Al reiniciar el servidor o llamar a /api/reset,
el sistema vuelve a quedar vacio (sin tickets, sin historial, sin cancelados).
Lo unico constante es la contraseña de agente, definida en Sesion.CLAVE_AGENTE.
"""
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .soporte_tecnico import SoporteTecnico
from .sesion import Sesion


# ============================================================
# INSTANCIA SINGLETON (estado en memoria, vacio al arrancar)
# ============================================================
soporte = SoporteTecnico()


def reset_estado():
    """Reemplaza la instancia por una nueva vacia. Borra cola, historial y cancelados."""
    global soporte
    soporte = SoporteTecnico()


# ============================================================
# FASTAPI APP
# ============================================================
app = FastAPI(title="Soporte Tecnico API")

# CORS por si el front se sirve desde otro origen (ej. abrir el .html con file://)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MODELOS DE REQUEST
# ============================================================
class LoginIn(BaseModel):
    rol: str           # "usuario" | "agente"
    password: str = ""


class CrearTicketIn(BaseModel):
    nombre: str
    descripcion: str


class ResolverIn(BaseModel):
    solucion: str


# ============================================================
# ENDPOINTS
# ============================================================
@app.post("/api/login")
def login(body: LoginIn):
    if body.rol not in ("usuario", "agente"):
        raise HTTPException(400, "Rol invalido")
    if body.rol == "agente" and body.password != Sesion.CLAVE_AGENTE:
        raise HTTPException(401, "Contraseña incorrecta")
    return {"ok": True, "rol": body.rol}


@app.get("/api/state")
def get_state():
    return soporte.obtener_estado()


@app.post("/api/tickets")
def crear_ticket(body: CrearTicketIn):
    nombre = body.nombre.strip() or "Anonimo"
    descripcion = body.descripcion.strip()
    if not descripcion:
        raise HTTPException(400, "La descripcion no puede estar vacia")

    resultado = soporte.crear_ticket(nombre, descripcion)

    serial = SoporteTecnico._serializar_ticket
    resp = {"estado": resultado["estado"], "ticket": serial(resultado["ticket"])}
    if resultado["estado"] == "duplicados":
        resp["duplicados"] = [serial(d) for d in resultado["duplicados"]]

    return {"resultado": resp, "state": soporte.obtener_estado()}


@app.post("/api/tickets/pendiente/confirmar")
def confirmar_pendiente():
    ticket = soporte.confirmar_ticket_pendiente()
    if ticket is None:
        raise HTTPException(400, "No hay ticket pendiente")
    return {
        "ticket": SoporteTecnico._serializar_ticket(ticket),
        "state": soporte.obtener_estado(),
    }


@app.post("/api/tickets/pendiente/descartar")
def descartar_pendiente():
    soporte.descartar_ticket_pendiente()
    return {"state": soporte.obtener_estado()}


@app.delete("/api/tickets/{ticket_id}")
def cancelar(ticket_id: int):
    ok = soporte.cancelar_por_id(ticket_id)
    if not ok:
        raise HTTPException(404, f"Ticket #{ticket_id} no encontrado en la cola")
    return {"state": soporte.obtener_estado()}


@app.post("/api/atender")
def atender():
    ticket = soporte.atender_siguiente()
    return {
        "ticket": SoporteTecnico._serializar_ticket(ticket),
        "state": soporte.obtener_estado(),
    }


@app.post("/api/resolver")
def resolver(body: ResolverIn):
    solucion = body.solucion.strip()
    if not solucion:
        raise HTTPException(400, "La solucion no puede estar vacia")
    ok = soporte.resolver_actual(solucion)
    if not ok:
        raise HTTPException(400, "No hay ticket en atencion")
    return {"state": soporte.obtener_estado()}


@app.post("/api/reset")
def reset():
    reset_estado()
    return {"state": soporte.obtener_estado()}


# ============================================================
# FRONTEND ESTATICO
# ============================================================
# El frontend vive en <paquete>/frontend/. Lo servimos desde /.
FRONTEND_DIR = Path(__file__).parent / "frontend"

if FRONTEND_DIR.exists():
    @app.get("/")
    def index():
        return FileResponse(FRONTEND_DIR / "index.html")

    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
