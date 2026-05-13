/* ============================================================
   APP — punto de entrada React.
   Maneja sesión, estado global y elige vista.

   El estado vive en el backend FastAPI (soporte/api.py).
   Cada `dispatch` hace un fetch a la API y actualiza el state local
   con la respuesta. La forma del state es la misma que en el prototipo,
   asi que los componentes hijos no se enteran del cambio.
   ============================================================ */

const { useState, useEffect } = React;

const API_BASE = "/api";

// ============================================================
// HELPERS HTTP
// ============================================================
async function apiJson(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const r = await fetch(API_BASE + path, opts);
  if (!r.ok) {
    let msg = `${r.status} ${r.statusText}`;
    try { const j = await r.json(); if (j.detail) msg = j.detail; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

// ============================================================
// STORE — wrapper async sobre el backend
// ============================================================
function useStore() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);

  // Carga inicial
  useEffect(() => {
    apiJson("GET", "/state")
      .then(setState)
      .catch(e => setError(e.message));
  }, []);

  async function dispatch(action) {
    try {
      switch (action.type) {
        case "CREATE": {
          const { nombre, descripcion } = action.payload;
          const { resultado, state: newState } = await apiJson("POST", "/tickets", { nombre, descripcion });
          setState(newState);
          return resultado; // {estado, ticket, duplicados?}
        }
        case "CONFIRM_PENDING": {
          const { ticket, state: newState } = await apiJson("POST", "/tickets/pendiente/confirmar");
          setState(newState);
          return ticket;
        }
        case "DISCARD_PENDING": {
          const { state: newState } = await apiJson("POST", "/tickets/pendiente/descartar");
          setState(newState);
          return;
        }
        case "CANCEL": {
          const { state: newState } = await apiJson("DELETE", `/tickets/${action.payload}`);
          setState(newState);
          return;
        }
        case "ATTEND_NEXT": {
          const { ticket, state: newState } = await apiJson("POST", "/atender");
          setState(newState);
          return ticket;
        }
        case "RESOLVE": {
          const { state: newState } = await apiJson("POST", "/resolver", { solucion: action.payload.solucion });
          setState(newState);
          return;
        }
        case "RESET": {
          const { state: newState } = await apiJson("POST", "/reset");
          setState(newState);
          return;
        }
        case "SET_SESSION_NAME": {
          // solo UI, no toca el backend
          setState(s => s ? { ...s, _userName: action.payload } : s);
          return;
        }
        default:
          console.warn("Action desconocida:", action.type);
      }
    } catch (e) {
      console.error("dispatch error:", action.type, e);
      setError(e.message);
      throw e;
    }
  }

  return [state, dispatch, error];
}

// ============================================================
// MAIN APP
// ============================================================
function App() {
  const [state, dispatch, error] = useStore();
  const [session, setSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem("st_session");
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Tweaks state
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "density": "comfortable"
  }/*EDITMODE-END*/;

  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);

  useEffect(() => {
    if (session) sessionStorage.setItem("st_session", JSON.stringify(session));
    else sessionStorage.removeItem("st_session");
  }, [session]);

  // Apply density to html
  useEffect(() => {
    document.documentElement.setAttribute("data-density", tweaks.density);
  }, [tweaks.density]);

  // Si el nombre del usuario viene de un CREATE, sincronizar a la sesion
  useEffect(() => {
    if (state?._userName && session?.rol === "usuario" && !session.nombre) {
      setSession(s => ({ ...s, nombre: state._userName }));
    }
  }, [state?._userName, session]);

  function onLogin(info) {
    setSession(info);
  }
  function onLogout() {
    setSession(null);
  }
  function toggleDensity() {
    setTweak("density", tweaks.density === "comfortable" ? "compact" : "comfortable");
  }

  // Pantalla de error (servidor caido, network, etc.)
  if (error && !state) {
    return (
      <>
        <div className="bg-atmos"></div>
        <div className="bg-grain"></div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: "100vh", padding: "2rem", textAlign: "center"
        }}>
          <div style={{ maxWidth: 480 }}>
            <h1 style={{ color: "var(--prio-critica, #ff6b6b)", marginBottom: "1rem" }}>
              No se pudo conectar al servidor
            </h1>
            <p style={{ color: "var(--text-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
              {error}
            </p>
            <p style={{ color: "var(--text-3)", marginTop: "1.5rem", fontSize: 13 }}>
              Asegurate de tener corriendo:<br/>
              <code style={{ color: "var(--accent)" }}>uvicorn soporte.api:app --reload</code>
            </p>
          </div>
        </div>
      </>
    );
  }

  // Pantalla de carga inicial
  if (!state) {
    return (
      <>
        <div className="bg-atmos"></div>
        <div className="bg-grain"></div>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: "100vh"
        }}>
          <div style={{ color: "var(--text-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
            Cargando…
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="bg-atmos"></div>
      <div className="bg-grain"></div>

      {!session && <LoginScreen onLogin={onLogin} />}
      {session?.rol === "usuario" && (
        <UserView
          state={state}
          dispatch={dispatch}
          session={session}
          onLogout={onLogout}
          density={tweaks.density}
          onToggleDensity={toggleDensity}
        />
      )}
      {session?.rol === "agente" && (
        <AgentView
          state={state}
          dispatch={dispatch}
          session={session}
          onLogout={onLogout}
          density={tweaks.density}
          onToggleDensity={toggleDensity}
        />
      )}

      {/* Tweaks panel */}
      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks" defaultOpen={false}>
          <window.TweakSection title="Densidad">
            <window.TweakRadio
              label="Espaciado de la UI"
              value={tweaks.density}
              onChange={(v) => setTweak("density", v)}
              options={[
                { value: "comfortable", label: "Cómoda" },
                { value: "compact", label: "Compacta" }
              ]}
            />
            <div style={{fontSize: 11, color: "var(--text-3)", lineHeight: 1.5, marginTop: 6, fontFamily: "var(--font-mono)"}}>
              Cambia el padding, el tamaño de tipografía y la altura de filas en toda la app.
            </div>
          </window.TweakSection>

          <window.TweakSection title="Estado">
            <window.TweakButton onClick={() => dispatch({ type: "RESET" })}>
              Reiniciar estado
            </window.TweakButton>
            <div style={{fontSize: 11, color: "var(--text-3)", lineHeight: 1.5, marginTop: 6, fontFamily: "var(--font-mono)"}}>
              Borra todos los tickets de la cola, historial y cancelados.
            </div>
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
