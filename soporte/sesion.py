"""
Clase Sesion: maneja el rol activo en el sistema.

Roles disponibles:
- usuario: puede crear y consultar tickets
- agente: puede atender, resolver y ver estadísticas
"""


class Sesion:
    ROLES = {"1": "usuario", "2": "agente"}
    CLAVE_AGENTE = "agente456"

    def __init__(self):
        self.rol_actual = None

    def iniciar(self):
        print("""
    ================================
           SOPORTE TÉCNICO
    ================================
    ¿Con qué rol deseas ingresar?
    1. Usuario
    2. Agente
        """)
        opcion = input("Respuesta: ").strip()
        self.rol_actual = self.ROLES.get(opcion)

        if not self.rol_actual:
            print("Opción inválida, cerrando sistema.")  # ← aquí
            return False

        if self.rol_actual == "agente":
            intentos = 3
            while intentos > 0:
                clave = input("Ingrese la contraseña de agente: ")
                if clave == self.CLAVE_AGENTE:
                    break
                intentos -= 1
                if intentos > 0:
                    print(f"Contraseña incorrecta. Intentos restantes: {intentos}")
                else:
                    print("Demasiados intentos fallidos, volviendo al inicio.")
                    return False

        print(f"\nSesión iniciada como: {self.rol_actual.upper()}")
        return True

    def es_usuario(self):
        return self.rol_actual == "usuario"

    def es_agente(self):
        return self.rol_actual == "agente"

    def cerrar(self):
        self.rol_actual = None
        print("Sesión cerrada.")