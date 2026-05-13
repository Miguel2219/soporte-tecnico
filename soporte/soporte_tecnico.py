"""
Clase SoporteTecnico: lógica principal del sistema.

Maneja:
- Cola de prioridad (heap binario via heapq)
- Atención de tickets
- Historial de resueltos
- Tickets cancelados
- Estadísticas

La asignación de prioridad está delegada al módulo `clasificador`.
"""
import heapq
from datetime import datetime

from .ticket import Ticket
from .clasificador import clasificar_ticket, detectar_duplicado


class SoporteTecnico:

    def __init__(self):
        # cola principal con heapq para manejar prioridades
        self.cola = []
        # ticket que esta siendo atendido en este momento
        self.ticket_actual = None
        # lista de tickets resueltos, solo para consulta
        self.historial = []
        # lista de tickets cancelados antes de ser atendidos
        self.tickets_cancelados = []
        # tiempo base de atencion en minutos, se actualiza con el promedio real
        self.tiempo_atencion_promedio = 15
        # tiempo maximo en minutos antes de alertar que un ticket fue abandonado
        self.tiempo_limite_atencion = 30
        # contador para asignar ids unicos e incrementales
        self.contador_id = 1

    # ==================== FUNCIONES DEL USUARIO ====================

    def agregar_ticket(self, ticket: Ticket):
        prioridades = {"critica": 1, "alta": 2, "media": 3, "baja": 4}

        # primero clasificar para tener la categoria antes de buscar duplicados
        ticket.categoria, ticket.prioridad = clasificar_ticket(ticket.descripcion)

        # ahora buscar duplicados con IA usando la categoria ya asignada
        tickets_en_espera = [tupla[2] for tupla in self.cola]
        duplicado = detectar_duplicado(ticket.descripcion, ticket.categoria, tickets_en_espera)

        if duplicado:
            print(f"""
        ⚠️  AVISO: Ya existe un ticket similar en la cola
        ================================
        Ticket #{duplicado.id} de {duplicado.nombre}
        Categoría:   {duplicado.categoria}
        Descripción: {duplicado.descripcion}
        ================================
        ¿Desea continuar de todas formas? (s/n): """, end="")
            respuesta = input().strip().lower()
            if respuesta != "s":
                print("Ticket no creado.")
                return

        numero_prioridad = prioridades[ticket.prioridad]
        heapq.heappush(self.cola, (numero_prioridad, ticket.id, ticket))
        print(f"Ticket #{ticket.id} agregado a la cola!")
                

    def posicion_ticket(self):
        if not self.cola:
            print("No hay tickets en la cola")
            return

        try:
            id_buscar = int(input("Ingrese el ID de su ticket: "))
        except ValueError:
            print("ID inválido. Por favor, ingrese un número.")
            return

        cola_ordenada = sorted(self.cola)

        for posicion, tupla in enumerate(cola_ordenada, start=1):
            ticket = tupla[2]
            if ticket.id == id_buscar:
                tickets_adelante = posicion - 1
                print(f"""
                ================================
                POSICIÓN EN LA COLA
                ================================
                Ticket:            #{ticket.id}
                Posición:          {posicion} de {len(cola_ordenada)}
                Tickets adelante:  {tickets_adelante}
                Prioridad:         {ticket.prioridad}
                ================================
                """)
                return

        print(f"No se encontró el ticket #{id_buscar} en la cola")

    def cancelar_ticket(self):
        if not self.cola:
            print("No hay tickets en la cola para cancelar")
            return

        try:
            id_buscar = int(input("Ingrese el ID del ticket a cancelar: "))
        except ValueError:
            print("ID inválido, debe ser un numero")
            return

        if self.ticket_actual and self.ticket_actual.id == id_buscar:
            print(f"El ticket #{id_buscar} ya esta siendo atendido, no se puede cancelar")
            return

        for i, tupla in enumerate(self.cola):
            if tupla[2].id == id_buscar:
                ticket_cancelado = self.cola.pop(i)[2]
                ticket_cancelado.estado = "cancelado"
                self.tickets_cancelados.append(ticket_cancelado)
                heapq.heapify(self.cola)
                print(f"Ticket #{ticket_cancelado.id} de {ticket_cancelado.nombre} cancelado")
                return

        print(f"No se encontro el ticket #{id_buscar} en la cola")

    def tiempo_de_espera(self):
        if not self.cola:
            print("No hay tickets en la cola, la atención sería inmediata")
            return

        try:
            id_buscar = int(input("Ingrese el ID de su ticket: "))
        except ValueError:
            print("ID inválido, debe ser un número")
            return
        cola_ordenada = sorted(self.cola)

        for posicion, tupla in enumerate(cola_ordenada, start=1):
            ticket = tupla[2]
            if ticket.id == id_buscar:
                tickets_adelante = posicion - 1
                tiempo_estimado = tickets_adelante * self.tiempo_atencion_promedio

                # sumar tiempo restante del ticket en atencion si lo hay
                if self.ticket_actual:
                    tiempo_estimado += self.tiempo_atencion_promedio

                print(f"""
            ================================
            TIEMPO ESTIMADO DE ESPERA
            ================================
            Ticket:                    #{ticket.id}
            Posición:                  {posicion}
            Tickets adelante:          {tickets_adelante}
            Tiempo promedio x ticket:  {self.tiempo_atencion_promedio} minutos
            Tiempo estimado total:     ~{tiempo_estimado} minutos
            ================================
                """)
                return

        print(f"No se encontró el ticket #{id_buscar} en la cola")

    # ==================== FUNCIONES DEL AGENTE ====================

    def atender_ticket(self):
        if self.ticket_actual:
            print(f"Ya hay un ticket en atención: #{self.ticket_actual.id} de {self.ticket_actual.nombre}")
            print("Debes resolverlo antes de tomar el siguiente")
        elif self.cola:
            self.ticket_actual = heapq.heappop(self.cola)[2]
            self.ticket_actual.estado = "en atención"
            self.ticket_actual.horaInicioAtencion = datetime.now()
            print(f"Ticket #{self.ticket_actual.id} de {self.ticket_actual.nombre} está siendo atendido")
        else:
            print("No hay tickets en la cola")

    def ver_ticket_en_atencion(self):
        if self.ticket_actual:
            print(f"""
            ================================
            TICKET EN ATENCIÓN
            ================================
            ID:           #{self.ticket_actual.id}
            Nombre:       {self.ticket_actual.nombre}
            Categoría:    {self.ticket_actual.categoria}
            Prioridad:    {self.ticket_actual.prioridad}
            Descripción:  {self.ticket_actual.descripcion}
            Hora llegada: {self.ticket_actual.horaLlegada.strftime("%H:%M:%S")}
            Hora inicio:  {self.ticket_actual.horaInicioAtencion.strftime("%H:%M:%S")}
            Estado:       {self.ticket_actual.estado}
            ================================
            """)
        else:
            print("No hay ningún ticket siendo atendido")

    def ticket_atendido(self):
        if self.ticket_actual:
            self.ticket_actual.solucion = input("Ingrese la solución del ticket: ")
            self.ticket_actual.horaSolucion = datetime.now()
            self.ticket_actual.estado = "resuelto"

            self.historial.append(self.ticket_actual)

            tiempos = [
                (t.horaSolucion - t.horaInicioAtencion).seconds // 60
                for t in self.historial
            ]
            self.tiempo_atencion_promedio = sum(tiempos) // len(tiempos)

            self.ticket_actual = None
            print("Ticket resuelto y movido al historial!")
        else:
            print("No hay ningún ticket en atención en este momento")

    def verificar_tiempo_atencion(self):
        if self.ticket_actual:
            tiempo_transcurrido = (datetime.now() - self.ticket_actual.horaInicioAtencion).seconds // 60

            if tiempo_transcurrido > self.tiempo_limite_atencion:
                print(f"""
            ⚠️  ADVERTENCIA
            ================================
            El ticket #{self.ticket_actual.id} de {self.ticket_actual.nombre}
            lleva {tiempo_transcurrido} minutos en atención
            El límite permitido es {self.tiempo_limite_atencion} minutos
            ================================
                """)
            else:
                tiempo_restante = self.tiempo_limite_atencion - tiempo_transcurrido
                print(f"""
            ✓ Todo en orden
            ================================
            Ticket #{self.ticket_actual.id} lleva {tiempo_transcurrido} minutos en atención
            Tiempo restante antes de alerta: {tiempo_restante} minutos
            ================================
                """)
        else:
            print("No hay ningún ticket en atención en este momento")

    # ==================== HISTORIAL Y CONSULTAS ====================

    def ver_historial_tickets_resueltos(self):
        if not self.historial:
            print("No hay tickets en el historial")
            return

        print(f"""
            ================================
            HISTORIAL DE TICKETS RESUELTOS
            Total: {len(self.historial)}
            ================================""")

        for ticket in self.historial:
            tiempo_atencion = (ticket.horaSolucion - ticket.horaInicioAtencion).seconds // 60
            print(f"""
            ID:              #{ticket.id}
            Nombre:          {ticket.nombre}
            Categoría:       {ticket.categoria}
            Prioridad:       {ticket.prioridad}
            Descripción:     {ticket.descripcion}
            Solución:        {ticket.solucion}
            Hora llegada:    {ticket.horaLlegada.strftime("%H:%M:%S")}
            Hora resolución: {ticket.horaSolucion.strftime("%H:%M:%S")}
            Duración:        {tiempo_atencion} minutos
            --------------------------------""")

    def historial_por_categoria(self):
        if not self.historial:
            print("No hay tickets en el historial")
            return

        menu_categorias = '''
        Categoría a filtrar:
        1. Hardware
        2. Software
        3. Red
        4. Cuenta de usuario
        5. Otro
        '''
        categorias = {1: "hardware", 2: "software", 3: "red",
                      4: "cuenta de usuario", 5: "otro"}

        try:
            opcion = int(input(f"{menu_categorias} Respuesta: "))
            categoria = categorias[opcion]
        except (ValueError, KeyError):
            print("Opción inválida")
            return

        filtrados = [t for t in self.historial if t.categoria == categoria]

        if not filtrados:
            print(f"No hay tickets resueltos de la categoría '{categoria}'")
            return

        print(f"""
            ================================
            HISTORIAL - CATEGORÍA: {categoria.upper()}
            Total: {len(filtrados)}
            ================================""")

        for ticket in filtrados:
            print(f"""
            ID:           #{ticket.id}
            Nombre:       {ticket.nombre}
            Prioridad:    {ticket.prioridad}
            Descripción:  {ticket.descripcion}
            Solución:     {ticket.solucion}
            --------------------------------""")

    def historial_por_prioridad(self):
        if not self.historial:
            print("No hay tickets en el historial")
            return

        menu_prioridades = '''
        Prioridad a filtrar:
        1. Crítica
        2. Alta
        3. Media
        4. Baja
        '''
        prioridades = {1: "critica", 2: "alta", 3: "media", 4: "baja"}

        try:
            opcion = int(input(f"{menu_prioridades} Respuesta: "))
            prioridad = prioridades[opcion]
        except (ValueError, KeyError):
            print("Opción inválida")
            return

        filtrados = [t for t in self.historial if t.prioridad == prioridad]

        if not filtrados:
            print(f"No hay tickets resueltos con prioridad '{prioridad}'")
            return

        print(f"""
            ================================
            HISTORIAL - PRIORIDAD: {prioridad.upper()}
            Total: {len(filtrados)}
            ================================""")

        for ticket in filtrados:
            print(f"""
            ID:           #{ticket.id}
            Nombre:       {ticket.nombre}
            Categoría:    {ticket.categoria}
            Descripción:  {ticket.descripcion}
            Solución:     {ticket.solucion}
            --------------------------------""")

    def ver_tickets_cancelados(self):
        if not self.tickets_cancelados:
            print("No hay tickets cancelados")
            return

        print(f"""
            ================================
            TICKETS CANCELADOS
            Total: {len(self.tickets_cancelados)}
            ================================""")

        for ticket in self.tickets_cancelados:
            print(f"""
            ID:           #{ticket.id}
            Nombre:       {ticket.nombre}
            Categoría:    {ticket.categoria}
            Prioridad:    {ticket.prioridad}
            Descripción:  {ticket.descripcion}
            Hora llegada: {ticket.horaLlegada.strftime("%H:%M:%S")}
            Estado:       {ticket.estado}
            --------------------------------""")

    # ==================== ESTADÍSTICAS Y RESUMEN ====================

    def estadisticas(self):
        if not self.historial and not self.tickets_cancelados:
            print("No hay datos suficientes para mostrar estadísticas")
            return

        total_atendidos = len(self.historial)
        total_cancelados = len(self.tickets_cancelados)

        categorias = {}
        for ticket in self.historial:
            categorias[ticket.categoria] = categorias.get(ticket.categoria, 0) + 1
        categoria_frecuente = max(categorias, key=categorias.get) if categorias else "N/A"

        prioridades = {}
        for ticket in self.historial:
            prioridades[ticket.prioridad] = prioridades.get(ticket.prioridad, 0) + 1
        prioridad_frecuente = max(prioridades, key=prioridades.get) if prioridades else "N/A"

        criticos_por_categoria = {}
        for ticket in self.historial:
            if ticket.prioridad == "critica":
                criticos_por_categoria[ticket.categoria] = criticos_por_categoria.get(ticket.categoria, 0) + 1
        categoria_mas_criticos = max(criticos_por_categoria, key=criticos_por_categoria.get) if criticos_por_categoria else "N/A"

        print(f"""
        ================================
            ESTADÍSTICAS DEL SISTEMA
        ================================
        Tickets atendidos:           {total_atendidos}
        Tickets cancelados:          {total_cancelados}

        Categoría más frecuente:     {categoria_frecuente}
        Prioridad más frecuente:     {prioridad_frecuente}
        Categoría con más críticos:  {categoria_mas_criticos}

        Tiempo promedio de atención: {self.tiempo_atencion_promedio} minutos
        ================================
        """)

    def resumen_sistema(self):
        criticos_en_espera = sum(1 for tupla in self.cola if tupla[2].prioridad == "critica")

        print(f"""
        ================================
            RESUMEN DEL SISTEMA
        ================================
        Tickets en espera:     {len(self.cola)}
        Tickets críticos:      {criticos_en_espera}
        Tiempo promedio:       {self.tiempo_atencion_promedio} minutos

        Ticket en atención:    {"#" + str(self.ticket_actual.id) + " de " + self.ticket_actual.nombre if self.ticket_actual else "Ninguno"}
        ================================
        """)

    def ver_cola(self):
        if not self.cola:
            print("No hay tickets en la cola")
            return

        cola_ordenada = sorted(self.cola)

        print(f"""
        ================================
        COLA DE TICKETS EN ESPERA
        Total: {len(cola_ordenada)}
        ================================""")

        for posicion, tupla in enumerate(cola_ordenada, start=1):
            ticket = tupla[2]
            print(f"""
        {posicion}. Ticket #{ticket.id} - {ticket.nombre}
        Categoría:   {ticket.categoria}
        Prioridad:   {ticket.prioridad}
        Hora llegada:{ticket.horaLlegada.strftime("%H:%M:%S")}
        --------------------------------""")
