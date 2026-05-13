/* ============================================================
   LOGIN — Selección de rol + (opcional) contraseña de agente
   Replica el flujo de soporte/sesion.py
   ============================================================ */

function LoginScreen({ onLogin }) {
  const [step, setStep] = React.useState("role"); // role | password
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [intentos, setIntentos] = React.useState(3);

  async function pickUsuario() {
    try {
      await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rol: "usuario", password: "" })
      });
    } catch (_) { /* el backend no es obligatorio para usuario */ }
    onLogin({ rol: "usuario", nombre: "" });
  }

  function pickAgente() {
    setStep("password");
    setError("");
  }

  async function submitPassword(e) {
    e.preventDefault();
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rol: "agente", password })
      });
      if (r.ok) {
        onLogin({ rol: "agente", nombre: "Operador #1" });
        return;
      }
    } catch (_) { /* network error: lo manejamos como fallo de auth */ }

    const rest = intentos - 1;
    setIntentos(rest);
    setPassword("");
    if (rest <= 0) {
      setError("Demasiados intentos fallidos. Volviendo al inicio.");
      setTimeout(() => {
        setStep("role");
        setIntentos(3);
        setError("");
      }, 1400);
    } else {
      setError(`Contraseña incorrecta. Intentos restantes: ${rest}`);
    }
  }

  return (
    <div className="login-stage" data-screen-label="01 Login">
      <div className="login-card fade-up">
        {/* LEFT — brand / hero */}
        <div className="login-left">
          <div>
            <div className="login-mark">
              <span className="brand-dot"></span>
              <span>SOPORTE TÉCNICO
</span>
            </div>
            <h1 className="login-title">
              Cola de tickets con<br />
              <em>prioridad inteligente</em>
            </h1>
            <p className="login-blurb">
              Sistema de gestión con cola heap, clasificación por IA y
              fallback local por palabras clave. Atiende lo crítico primero,
              sin discusión.
            </p>
          </div>

          <div className="login-stats">
            <div className="login-stat">
              <div className="v mono">04</div>
              <div className="l">Categorías</div>
            </div>
            <div className="login-stat">
              <div className="v mono">04</div>
              <div className="l">Prioridades</div>
            </div>
            <div className="login-stat">
              <div className="v mono">∞</div>
              <div className="l">Capacidad de cola</div>
            </div>
          </div>
        </div>

        {/* RIGHT — role selection / password */}
        <div className="login-right">
          {step === "role" && <>
              <div>
                <div className="upper dim" style={{ marginBottom: 6 }}>Inicio de sesión</div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>
                  ¿Con qué rol vas a ingresar?
                </h2>
              </div>

              <div className="role-choice">
                <button className="role-option" onClick={pickUsuario}>
                  <div className="ro-ico"><Icon name="user2" size={18} /></div>
                  <div>
                    <div className="ro-name">Usuario</div>
                    <div className="ro-desc">Crear tickets, consultar mi posición, cancelar.</div>
                  </div>
                  <div className="ro-arrow"><Icon name="arrow" size={16} /></div>
                </button>

                <button className="role-option" onClick={pickAgente}>
                  <div className="ro-ico" style={{ color: "var(--p-alta)" }}>
                    <Icon name="shield" size={18} />
                  </div>
                  <div>
                    <div className="ro-name">Agente</div>
                    <div className="ro-desc">Atender la cola, resolver tickets, ver estadísticas.</div>
                  </div>
                  <div className="ro-arrow"><Icon name="arrow" size={16} /></div>
                </button>
              </div>

              <div style={{ fontSize: 11, color: "var(--text-4)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 8 }}>

            </div>
            </>
          }

          {step === "password" &&
          <form className="password-stage" onSubmit={submitPassword}>
              <button
              type="button"
              className="btn ghost sm"
              style={{ width: "fit-content", padding: "4px 8px" }}
              onClick={() => {setStep("role");setPassword("");setError("");}}>
              
                <Icon name="arrowLeft" size={14} /> Volver
              </button>

              <div>
                <div className="upper dim" style={{ marginBottom: 6 }}>Acceso de agente</div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: "-0.02em" }}>
                  Ingresá la contraseña
                </h2>
                <p className="dim" style={{ fontSize: 13, marginTop: 6, marginBottom: 0 }}>
                  Contraseña: <span className="mono" style={{ color: "var(--accent)" }}>agente456</span>
                </p>
              </div>

              <div className="field">
                <label className="field-label">Contraseña de agente</label>
                <input
                type="password"
                className="input"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" />
              
              </div>

              {error &&
            <div style={{
              fontSize: 12, padding: "10px 12px", borderRadius: 6,
              border: "1px solid oklch(0.45 0.16 22 / 0.45)",
              background: "oklch(0.30 0.10 22 / 0.18)",
              color: "oklch(0.85 0.16 22)",
              fontFamily: "var(--font-mono)"
            }}>{error}</div>
            }

              <button type="submit" className="btn primary lg block">
                <Icon name="lock" size={16} /> Ingresar como agente
              </button>
            </form>
          }
        </div>
      </div>
    </div>);

}

window.LoginScreen = LoginScreen;