# Sistema de Soporte Técnico

Sistema de gestión de tickets con cola de prioridad. La clasificación de
prioridad usa un modelo de OpenAI (con fallback a clasificador local por
palabras clave si la API no está disponible).

## Estructura

```
soporte-tecnico/
├── .env.example              # plantilla de variables de entorno
├── .gitignore
├── README.md
├── requirements.txt          # dependencias del proyecto
├── main.py                   # punto de entrada
└── soporte/
    ├── __init__.py
    ├── ticket.py             # clase Ticket (modelo de datos)
    ├── clasificador.py       # clasificación IA + fallback por palabras clave
    ├── soporte_tecnico.py    # clase SoporteTecnico (cola, atención, historial)
    └── menu.py               # interfaz CLI
```

## Instalación

1. (Recomendado) Crear y activar un entorno virtual:

   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # macOS / Linux
   source venv/bin/activate
   ```

2. Instalar las dependencias:

   ```bash
   pip install -r requirements.txt
   ```

3. Copiar `.env.example` a `.env` y completar con tu API key de OpenAI:

   ```bash
   # Windows
   copy .env.example .env
   # macOS / Linux
   cp .env.example .env
   ```

   Después editá `.env` y reemplazá el placeholder por tu key real.

## Uso

Desde la raíz del proyecto:

```bash
uvicorn soporte.api:app --reload
```

## Cómo funciona la clasificación

Cuando se crea un ticket, el sistema:

1. Llama al modelo `gpt-5.4-nano` de OpenAI con la descripción y categoría
   del ticket, usando *structured outputs* para garantizar que devuelva una
   de las 4 prioridades: `critica`, `alta`, `media` o `baja`.
2. Si la API falla (sin internet, rate limit, etc.), cae automáticamente
   al clasificador local basado en palabras clave.

El clasificador local también funciona como respaldo offline y permite
probar el sistema sin consumir API.

## Notas

- La API key **nunca** se commitea. El archivo `.env` está en `.gitignore`.
- Cada clasificación con IA tarda 1-3 segundos y cuesta fracciones de centavo.
- Para forzar el uso del clasificador local (sin llamar a la API), basta
  con dejar `OPENAI_API_KEY` vacío en `.env`.
