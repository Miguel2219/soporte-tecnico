"""
Interfaz de línea de comandos del sistema.
"""
from datetime import datetime

from .ticket import Ticket
from .soporte_tecnico import SoporteTecnico
from .sesion import Sesion


def menu():
    menu_usuario = '''
    ================================
           SOPORTE TÉCNICO
    ================================
    ---- MENÚ USUARIO ----
    1. Crear ticket
    2. Consultar posición de mi ticket
    3. Ver tiempo estimado de espera
    4. Cancelar mi ticket
    5. Salir
    '''

    menu_agente = '''
    ================================
           SOPORTE TÉCNICO
    ================================
    ---- MENÚ AGENTE ----
    1. Ver cola de tickets
    2. Atender siguiente ticket
    3. Ver ticket en atención
    4. Registrar solución
    5. Verificar tiempo de atención
    6. Ver historial de resueltos
    7. Filtrar historial por categoría
    8. Filtrar historial por prioridad
    9. Ver tickets cancelados
    10. Ver resumen del sistema
    11. Ver estadísticas
    12. Salir
    '''


    soporteTecnico = SoporteTecnico()  # se mantiene entre sesiones

    while True:  # loop externo, vuelve al login cuando alguien sale
        sesion = Sesion()

        if not sesion.iniciar():
            continue  # si falla el login vuelve a preguntar

        state = True

        while state:
            try:
                if sesion.es_usuario():
                    opcion = int(input(f"{menu_usuario} Respuesta: "))

                    if opcion == 1:
                        nombre = input("Nombre: ")
                        descripcion = input("Descripción del problema: ")
                        horaLlegada = datetime.now()
                        ticket = Ticket(soporteTecnico.contador_id, nombre, descripcion, horaLlegada)
                        soporteTecnico.agregar_ticket(ticket)
                        soporteTecnico.contador_id += 1
                    elif opcion == 2:
                        soporteTecnico.posicion_ticket()

                    elif opcion == 3:
                        soporteTecnico.tiempo_de_espera()

                    elif opcion == 4:
                        soporteTecnico.cancelar_ticket()

                    elif opcion == 5:
                        print("Sesión cerrada, volviendo al inicio...")
                        state = False

                    else:
                        print("Opción inválida")

                elif sesion.es_agente():
                    opcion = int(input(f"{menu_agente} Respuesta: "))

                    if opcion == 1:
                        soporteTecnico.ver_cola()

                    elif opcion == 2:
                        soporteTecnico.atender_ticket()

                    elif opcion == 3:
                        soporteTecnico.ver_ticket_en_atencion()

                    elif opcion == 4:
                        soporteTecnico.ticket_atendido()

                    elif opcion == 5:
                        soporteTecnico.verificar_tiempo_atencion()

                    elif opcion == 6:
                        soporteTecnico.ver_historial_tickets_resueltos()

                    elif opcion == 7:
                        soporteTecnico.historial_por_categoria()

                    elif opcion == 8:
                        soporteTecnico.historial_por_prioridad()

                    elif opcion == 9:
                        soporteTecnico.ver_tickets_cancelados()

                    elif opcion == 10:
                        soporteTecnico.resumen_sistema()

                    elif opcion == 11:
                        soporteTecnico.estadisticas()

                    elif opcion == 12:
                        print("Sesión cerrada, volviendo al inicio...")
                        state = False

                    else:
                        print("Opción inválida")

            except ValueError:
                print("Opción inválida, ingresá un número.")