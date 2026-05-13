/* ============================================================
   USER VIEW — Crear ticket, ver mi cola, cancelar
   ============================================================ */

function UserView({ state, dispatch, session, onLogout, density, onToggleDensity }) {
  const [tab, setTab] = React.useState("nuevo"); // nuevo | mis | info
  const [toasts, setToasts] = React.useState([]);

  const pushToast = React.useCallback((kind, text, sub) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, kind, text, sub }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);

  // Mis tickets = filtrados por el nombre actual del usuario (si está)
  const misEnCola = state.cola.filter(t => session.nombre && t.nombre === session.nombre);
  const misResueltos = state.historial.filter(t => session.nombre && t.nombre === session.nombre);
  const misCancelados = state.cancelados.filter(t => session.nombre && t.nombre === session.nombre);
  const misEnAtencion = state.ticketActual && state.ticketActual.nombre === session.nombre ? state.ticketActual : null;

  const totalMis = misEnCola.length + misResueltos.length + misCancelados.length + (misEnAtencion ? 1 : 0);

  return (
    <div className="app-root" data-screen-label={`02 Usuario · ${tab}`}>
      <TopBar session={session} onLogout={onLogout} />

      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-label">Tickets</div>
            <button className={`nav-item ${tab === "nuevo" ? "active" : ""}`} onClick={() => setTab("nuevo")}>
              <Icon name="plus" className="ico" />
              <span>Nuevo ticket</span>
            </button>
            <button className={`nav-item ${tab === "mis" ? "active" : ""}`} onClick={() => setTab("mis")}>
              <Icon name="ticket" className="ico" />
              <span>Mis tickets</span>
              {totalMis > 0 && <span className="badge">{totalMis}</span>}
            </button>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">Info</div>
            <button className={`nav-item ${tab === "info" ? "active" : ""}`} onClick={() => setTab("info")}>
              <Icon name="info" className="ico" />
              <span>Cómo funciona</span>
            </button>
          </div>

          <div className="sidebar-footer">
            <span className="dot"></span>
            <span>Sistema operativo · cola activa</span>
          </div>
        </aside>

        <main className="main">
          {tab === "nuevo" && (
            <NuevoTicketTab
              state={state}
              dispatch={dispatch}
              session={session}
              pushToast={pushToast}
              onSwitchToMis={() => setTab("mis")}
            />
          )}
          {tab === "mis" && (
            <MisTicketsTab
              state={state}
              dispatch={dispatch}
              session={session}
              pushToast={pushToast}
              misEnCola={misEnCola}
              misEnAtencion={misEnAtencion}
              misResueltos={misResueltos}
              misCancelados={misCancelados}
            />
          )}
          {tab === "info" && <InfoTab />}
        </main>
      </div>

      <Toasts toasts={toasts} />
    </div>
  );
}

// ============================================================
// NUEVO TICKET — form + preview en vivo + flujo de duplicados
// ============================================================
function NuevoTicketTab({ state, dispatch, session, pushToast, onSwitchToMis }) {
  const [nombre, setNombre] = React.useState(session.nombre || localStorage.getItem("st_user_name") || "");
  const [descripcion, setDescripcion] = React.useState("");
  const [duplicados, setDuplicados] = React.useState(null); // null | { ticket, dups }
  const [submitting, setSubmitting] = React.useState(false);
  const [lastCreatedId, setLastCreatedId] = React.useState(null);

  // Clasificación: solo aparece despues de que la IA del backend analice el ticket.
  // No se hace preview en vivo en el cliente.
  const [preview, setPreview] = React.useState(null);

  // Si el usuario escribe una nueva descripcion, limpiar el preview del ticket anterior.
  // No limpia cuando descripcion queda vacia (es el reset que hacemos despues de crear).
  React.useEffect(() => {
    if (preview && descripcion.length > 0) setPreview(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [descripcion]);

  const canSubmit = nombre.trim().length >= 2 && descripcion.trim().length >= 8 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    localStorage.setItem("st_user_name", nombre.trim());

    try {
      const resultado = await dispatch({
        type: "CREATE",
        payload: { nombre: nombre.trim(), descripcion: descripcion.trim() }
      });

      if (resultado.estado === "duplicados") {
        // backend detecto duplicados: mostrar modal con los que encontro
        setDuplicados({
          nombre: nombre.trim(),
          descripcion: descripcion.trim(),
          preview: {
            categoria: resultado.ticket.categoria,
            prioridad: resultado.ticket.prioridad
          },
          dups: resultado.duplicados
        });
        setSubmitting(false);
        return;
      }

      // creado directamente
      const t = resultado.ticket;
      pushToast("success", `Ticket #${t.id} agregado a la cola`, `${PRIO_LABEL[t.prioridad]} · ${CAT_LABEL[t.categoria]}`);
      setLastCreatedId(t.id);
      // mostrar la clasificacion que asigno la IA al ticket recien creado
      setPreview({ categoria: t.categoria, prioridad: t.prioridad, razon: t.razon, ticketId: t.id });
      setDescripcion("");
      setSubmitting(false);
      dispatch({ type: "SET_SESSION_NAME", payload: nombre.trim() });
    } catch (e) {
      setSubmitting(false);
      pushToast("warn", "Error al crear ticket", e.message || "Algo salio mal");
    }
  }

  async function confirmarDuplicado() {
    try {
      const t = await dispatch({ type: "CONFIRM_PENDING" });
      pushToast("success", `Ticket #${t.id} agregado a la cola`, `${PRIO_LABEL[t.prioridad]} · ${CAT_LABEL[t.categoria]}`);
      setLastCreatedId(t.id);
      setPreview({ categoria: t.categoria, prioridad: t.prioridad, razon: t.razon, ticketId: t.id });
      setDescripcion("");
      dispatch({ type: "SET_SESSION_NAME", payload: duplicados.nombre });
    } catch (e) {
      pushToast("warn", "Error al confirmar ticket", e.message || "Algo salio mal");
    } finally {
      setDuplicados(null);
      setSubmitting(false);
    }
  }

  async function descartarDuplicado() {
    try { await dispatch({ type: "DISCARD_PENDING" }); } catch (_) {}
    setDuplicados(null);
    setSubmitting(false);
    pushToast("warn", "Ticket no creado", "Se mantuvo el ticket existente que ya estaba en la cola.");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Sistema de Soporte · Crear ticket</div>
          <h1 className="page-title">Reporte tu incidencia</h1>
          <p className="page-sub">
            Describí el problema con tus palabras. El sistema lo clasificará automáticamente,
            chequeará duplicados en la cola y le asignará una prioridad.
          </p>
        </div>
      </div>

      <div style={{display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--gap-lg)", alignItems: "flex-start"}}>
        {/* FORM */}
        <div className="card glow fade-up">
          <div className="card-head">
            <div className="card-title"><Icon name="ticket" className="ico" /> Nuevo ticket</div>
            <div className="card-sub">Form 01 / 01</div>
          </div>

          <div className="col" style={{gap: 14}}>
            <div className="field">
              <label className="field-label">Tu nombre</label>
              <input
                className="input"
                placeholder="Ej. María González"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                maxLength={40}
              />
            </div>

            <div className="field">
              <label className="field-label">Descripción del problema</label>
              <textarea
                className="textarea"
                placeholder='Ej. "No carga el Outlook, da error al abrir el programa."'
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                rows={5}
              />
              <div className="row between" style={{marginTop: 4}}>
                <span style={{fontSize: 11, color: "var(--text-4)", fontFamily: "var(--font-mono)"}}>
                  {descripcion.length < 8
                    ? `Faltan ${8 - descripcion.length} caracteres para clasificar`
                    : `${descripcion.length} caracteres`}
                </span>
                <span style={{fontSize: 11, color: "var(--text-4)", fontFamily: "var(--font-mono)"}}>
                  Detección por palabras clave (offline)
                </span>
              </div>
            </div>

            <div className="row" style={{marginTop: 8, gap: 10}}>
              <button className="btn primary lg" onClick={submit} disabled={!canSubmit}>
                <Icon name="zap" size={15} /> Enviar a la cola
              </button>
              {lastCreatedId && (
                <button className="btn ghost" onClick={onSwitchToMis}>
                  Ver ticket #{lastCreatedId} <Icon name="arrow" size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* PREVIEW */}
        <div className="col" style={{gap: "var(--gap-md)"}}>
          <ClassificationPreview preview={preview} desc={descripcion} />
          <QueueGlance state={state} />
        </div>
      </div>

      {/* DUPLICATES MODAL */}
      {duplicados && (
        <DuplicadosModal
          payload={duplicados}
          onConfirm={confirmarDuplicado}
          onCancel={descartarDuplicado}
        />
      )}
    </>
  );
}

function ClassificationPreview({ preview, desc }) {
  if (!preview) {
    return (
      <div className="card fade-up d1">
        <div className="card-head">
          <div className="card-title"><Icon name="cpu" className="ico" /> Clasificación</div>
          <div className="card-sub">Esperando envío</div>
        </div>
        <div style={{padding: "16px 0", textAlign: "center", color: "var(--text-4)", fontSize: 13, lineHeight: 1.5}}>
          <div style={{marginBottom: 8, opacity: 0.6}}>
            <Icon name="cpu" size={28} />
          </div>
          La categoría y prioridad se determinan<br/>con IA al enviar el ticket.
        </div>
      </div>
    );
  }

  return (
    <div className="card glow fade-up d1" key={preview.categoria + preview.prioridad}>
      <div className="card-head">
        <div className="card-title"><Icon name="cpu" className="ico" /> Clasificación</div>
        <div className="card-sub">Por IA</div>
      </div>

      <div className="col" style={{gap: 14}}>
        {preview.ticketId && (
          <div style={{fontSize: 12.5, color: "var(--text-3)", fontFamily: "var(--font-mono)"}}>
            Ticket <span style={{color: "var(--accent)"}}>#{preview.ticketId}</span> clasificado:
          </div>
        )}

        <div>
          <div className="upper faint" style={{marginBottom: 6}}>Categoría</div>
          <div className="row" style={{gap: 8, alignItems: "center"}}>
            <span className={`badge-cat ${CAT_KEY[preview.categoria]}`}>
              <Icon name={iconForCategory(preview.categoria)} size={11} />
              {CAT_LABEL[preview.categoria]}
            </span>
          </div>
        </div>

        <div>
          <div className="upper faint" style={{marginBottom: 6}}>Prioridad</div>
          <span className={`badge-prio ${preview.prioridad}`}>
            <span className="dot"></span> {PRIO_LABEL[preview.prioridad]}
          </span>
        </div>

        {preview.razon && (
          <div>
            <div className="upper faint" style={{marginBottom: 6}}>Razón</div>
            <div style={{fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.5, fontFamily: "var(--font-mono)"}}>
              {preview.razon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function iconForCategory(cat) {
  return {
    "hardware": "monitor",
    "software": "cpu",
    "red": "wifi",
    "cuenta de usuario": "user",
    "otro": "info"
  }[cat] || "info";
}

function QueueGlance({ state }) {
  const total = state.cola.length;
  const critica = state.cola.filter(t => t.prioridad === "critica").length;
  const alta = state.cola.filter(t => t.prioridad === "alta").length;
  const espera = total * state.tiempoAtencionPromedio;
  return (
    <div className="card fade-up d2">
      <div className="card-head">
        <div className="card-title"><Icon name="layers" className="ico" /> Estado actual</div>
        <div className="card-sub">Live</div>
      </div>
      <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12}}>
        <Mini label="En cola" value={total} />
        <Mini label="Críticos" value={critica} accent="critica" />
        <Mini label="En atención" value={state.ticketActual ? 1 : 0} accent="accent" />
        <Mini label="Espera est." value={`~${espera}m`} />
      </div>
    </div>
  );
}

function Mini({ label, value, accent }) {
  const cls = accent === "critica" ? "danger" : accent === "accent" ? "accent" : "";
  return (
    <div className="stat" style={{padding: "10px 12px"}}>
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${cls}`} style={{fontSize: 22, color: accent === "critica" ? "var(--p-critica)" : accent === "accent" ? "var(--accent-strong)" : ""}}>{value}</div>
    </div>
  );
}

// ============================================================
// DUPLICADOS MODAL
// ============================================================
function DuplicadosModal({ payload, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="row" style={{gap: 10, marginBottom: 10}}>
          <div style={{width: 36, height: 36, borderRadius: 8, background: "oklch(0.30 0.08 70 / 0.18)", display: "grid", placeItems: "center", color: "var(--p-alta)"}}>
            <Icon name="alert" size={18} />
          </div>
          <div>
            <h3>Posibles duplicados en cola</h3>
            <div className="sub">
              Se encontró {payload.dups.length} ticket{payload.dups.length > 1 ? "s" : ""} similar{payload.dups.length > 1 ? "es" : ""} en espera. ¿Querés crear el tuyo igual?
            </div>
          </div>
        </div>

        <div style={{
          background: "oklch(0.165 0.012 195)",
          border: "1px solid var(--border-faint)",
          borderRadius: 8,
          padding: 12,
          marginBottom: 14
        }}>
          <div className="upper faint" style={{marginBottom: 6}}>Tu descripción</div>
          <div style={{fontSize: 13.5, color: "var(--text-1)"}}>"{payload.descripcion}"</div>
        </div>

        <div className="upper faint mb-md">Tickets similares ya en cola</div>
        <div className="col" style={{gap: 8, maxHeight: 240, overflowY: "auto"}}>
          {payload.dups.map(d => (
            <div key={d.id} style={{
              padding: 10,
              border: "1px solid var(--border-faint)",
              borderRadius: 8,
              background: "oklch(0.22 0.014 195)"
            }}>
              <div className="row between">
                <div className="row" style={{gap: 8}}>
                  <span className="mono dim" style={{fontSize: 12}}>#{d.id}</span>
                  <span style={{fontSize: 13, fontWeight: 500}}>{d.nombre}</span>
                </div>
                <span className={`badge-prio ${d.prioridad}`} style={{padding: "2px 7px", fontSize: 9.5}}>
                  <span className="dot"></span> {PRIO_LABEL[d.prioridad]}
                </span>
              </div>
              <div className="dim" style={{fontSize: 12.5, marginTop: 4}}>{d.descripcion}</div>
              <div style={{fontSize: 11, color: "var(--text-4)", fontFamily: "var(--font-mono)", marginTop: 4}}>
                {fmtMinAgo(d.horaLlegada)} · {CAT_LABEL[d.categoria]}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn ghost" onClick={onCancel}>No crear, mantener el existente</button>
          <button className="btn primary" onClick={onConfirm}>
            <Icon name="check" size={14} /> Crear de todas formas
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MIS TICKETS
// ============================================================
function MisTicketsTab({ state, session, dispatch, pushToast, misEnCola, misEnAtencion, misResueltos, misCancelados }) {
  const colaOrdenada = window.ordenarCola(state.cola);

  function posicionEn(t) {
    return colaOrdenada.findIndex(x => x.id === t.id) + 1;
  }
  function tiempoEspera(t) {
    const adelante = posicionEn(t) - 1;
    return adelante * state.tiempoAtencionPromedio + (state.ticketActual ? state.tiempoAtencionPromedio : 0);
  }

  function cancelar(t) {
    dispatch({ type: "CANCEL", payload: t.id });
    pushToast("warn", `Ticket #${t.id} cancelado`, "Movido a la lista de cancelados.");
  }

  if (!session.nombre) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="page-eyebrow">Mis tickets</div>
            <h1 className="page-title">Aún no creaste ningún ticket</h1>
            <p className="page-sub">En cuanto crees tu primer ticket vas a poder consultar acá su posición en la cola, tiempo estimado y cancelarlo si querés.</p>
          </div>
        </div>
        <div className="empty" style={{padding: "40px 24px"}}>
          <div className="ico"><Icon name="ticket" size={32} /></div>
          <h4>Cola vacía para vos</h4>
          <p>Vamos a la sección "Nuevo ticket" para reportar tu primera incidencia.</p>
        </div>
      </>
    );
  }

  const total = misEnCola.length + misResueltos.length + misCancelados.length + (misEnAtencion ? 1 : 0);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Mis tickets · {session.nombre}</div>
          <h1 className="page-title">{total} en total</h1>
          <p className="page-sub">
            Acá ves todos tus reportes: en cola, en atención por un agente, resueltos y los que cancelaste.
          </p>
        </div>
      </div>

      {misEnAtencion && (
        <div className="card glow mb-lg fade-up">
          <div className="card-head">
            <div className="card-title">
              <Icon name="zap" className="ico" /> En atención ahora
            </div>
            <div className="status en-atencion"><span className="pulse"></span> En atención</div>
          </div>
          <TicketDetail t={misEnAtencion} />
        </div>
      )}

      {misEnCola.length > 0 && (
        <section className="mb-lg fade-up d1">
          <div className="row between mb-md">
            <h3 style={{margin: 0, fontSize: 16, fontWeight: 500}}>En cola · {misEnCola.length}</h3>
            <span className="upper dim">Avanzan según prioridad</span>
          </div>
          <div className="col" style={{gap: 10}}>
            {misEnCola.map(t => {
              const pos = posicionEn(t);
              const espera = tiempoEspera(t);
              return (
                <div key={t.id} className="card" style={{padding: "var(--pad-md)"}}>
                  <div className="row between" style={{gap: 16}}>
                    <div style={{flex: 1}}>
                      <div className="row" style={{gap: 8, marginBottom: 4}}>
                        <span className="mono dim" style={{fontSize: 12}}>#{t.id}</span>
                        <span style={{fontSize: 14, fontWeight: 500}}>{t.nombre}</span>
                        <span className={`badge-prio ${t.prioridad}`}>
                          <span className="dot"></span> {PRIO_LABEL[t.prioridad]}
                        </span>
                        <span className={`badge-cat ${CAT_KEY[t.categoria]}`}>{CAT_LABEL[t.categoria]}</span>
                      </div>
                      <div className="dim" style={{fontSize: 13}}>{t.descripcion}</div>
                    </div>
                    <div style={{textAlign: "right", minWidth: 140}}>
                      <div className="upper faint" style={{marginBottom: 3}}>Posición</div>
                      <div style={{fontSize: 24, fontFamily: "var(--font-mono)", color: "var(--accent-strong)", textShadow: "0 0 14px var(--accent-glow)", letterSpacing: "-0.02em"}}>
                        {pos} <span style={{fontSize: 14, color: "var(--text-4)"}}>/ {state.cola.length}</span>
                      </div>
                      <div className="mono" style={{fontSize: 11, color: "var(--text-3)", marginTop: 2}}>
                        ~{espera} min de espera
                      </div>
                    </div>
                  </div>
                  <div className="row" style={{marginTop: 12, gap: 8, justifyContent: "flex-end"}}>
                    <span className="mono" style={{fontSize: 11, color: "var(--text-4)", marginRight: "auto"}}>
                      Llegada: {fmtHora(t.horaLlegada)} · {fmtMinAgo(t.horaLlegada)}
                    </span>
                    <button className="btn danger sm" onClick={() => cancelar(t)}>
                      <Icon name="ban" size={12} /> Cancelar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {misResueltos.length > 0 && (
        <section className="mb-lg fade-up d2">
          <div className="row between mb-md">
            <h3 style={{margin: 0, fontSize: 16, fontWeight: 500}}>Resueltos · {misResueltos.length}</h3>
          </div>
          <div className="col" style={{gap: 10}}>
            {misResueltos.map(t => <ResueltoCard key={t.id} t={t} />)}
          </div>
        </section>
      )}

      {misCancelados.length > 0 && (
        <section className="mb-lg fade-up d3">
          <div className="row between mb-md">
            <h3 style={{margin: 0, fontSize: 16, fontWeight: 500}}>Cancelados · {misCancelados.length}</h3>
          </div>
          <div className="col" style={{gap: 10}}>
            {misCancelados.map(t => (
              <div key={t.id} className="card" style={{opacity: 0.6, padding: "var(--pad-md)"}}>
                <div className="row" style={{gap: 8}}>
                  <span className="mono dim" style={{fontSize: 12}}>#{t.id}</span>
                  <span style={{fontSize: 13.5, fontWeight: 500}}>{t.nombre}</span>
                  <span className="status cancelado"><span className="pulse"></span> Cancelado</span>
                </div>
                <div className="dim" style={{fontSize: 13, marginTop: 4}}>{t.descripcion}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {total === 0 && (
        <div className="empty" style={{padding: "40px 24px"}}>
          <div className="ico"><Icon name="ticket" size={32} /></div>
          <h4>No hay tickets a tu nombre</h4>
          <p>Creá uno desde "Nuevo ticket".</p>
        </div>
      )}
    </>
  );
}

function ResueltoCard({ t }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="card" style={{padding: "var(--pad-md)"}}>
      <div className="row between" onClick={() => setOpen(o => !o)} style={{cursor: "pointer"}}>
        <div style={{flex: 1}}>
          <div className="row" style={{gap: 8, marginBottom: 4}}>
            <span className="mono dim" style={{fontSize: 12}}>#{t.id}</span>
            <span style={{fontSize: 14, fontWeight: 500}}>{t.nombre}</span>
            <span className={`badge-prio ${t.prioridad}`}><span className="dot"></span> {PRIO_LABEL[t.prioridad]}</span>
            <span className={`badge-cat ${CAT_KEY[t.categoria]}`}>{CAT_LABEL[t.categoria]}</span>
            <span className="status resuelto" style={{marginLeft: 6}}><span className="pulse"></span> Resuelto</span>
          </div>
          <div className="dim" style={{fontSize: 13}}>{t.descripcion}</div>
        </div>
        <div style={{textAlign: "right", minWidth: 100}}>
          <div className="upper faint" style={{marginBottom: 3}}>Duración</div>
          <div style={{fontSize: 18, fontFamily: "var(--font-mono)", color: "var(--accent-strong)"}}>
            {fmtDur(t.horaInicioAtencion, t.horaSolucion)}
          </div>
        </div>
      </div>
      {open && (
        <div style={{
          marginTop: 12, padding: 12,
          background: "oklch(0.17 0.012 195)",
          border: "1px solid var(--border-faint)",
          borderRadius: 8
        }}>
          <div className="upper faint" style={{marginBottom: 6}}>Solución</div>
          <div style={{fontSize: 13.5, color: "var(--text-1)", lineHeight: 1.5}}>{t.solucion}</div>
          <div className="row" style={{gap: 14, marginTop: 10, fontSize: 11, color: "var(--text-4)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em"}}>
            <span>Llegada · {fmtHora(t.horaLlegada)}</span>
            <span>Inicio · {fmtHora(t.horaInicioAtencion)}</span>
            <span>Cierre · {fmtHora(t.horaSolucion)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function TicketDetail({ t }) {
  return (
    <div>
      <div className="row" style={{gap: 8, flexWrap: "wrap"}}>
        <span className="mono dim" style={{fontSize: 12}}>#{t.id}</span>
        <span style={{fontSize: 15, fontWeight: 500}}>{t.nombre}</span>
        <span className={`badge-prio ${t.prioridad}`}><span className="dot"></span> {PRIO_LABEL[t.prioridad]}</span>
        <span className={`badge-cat ${CAT_KEY[t.categoria]}`}>{CAT_LABEL[t.categoria]}</span>
      </div>
      <div style={{fontSize: 14, color: "var(--text-1)", marginTop: 10, lineHeight: 1.55}}>{t.descripcion}</div>
      <div className="row" style={{gap: 14, marginTop: 12, fontSize: 11, color: "var(--text-4)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em"}}>
        <span>Llegada · {fmtHora(t.horaLlegada)}</span>
        {t.horaInicioAtencion && <span>Inicio atención · {fmtHora(t.horaInicioAtencion)}</span>}
      </div>
    </div>
  );
}

// ============================================================
// INFO TAB
// ============================================================
function InfoTab() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Documentación</div>
          <h1 className="page-title">¿Cómo funciona el sistema?</h1>
          <p className="page-sub">
            Una mirada honesta a las tres piezas que hacen funcionar la cola: el clasificador,
            el heap de prioridad y el detector de duplicados.
          </p>
        </div>
      </div>

      <div className="grid-2 mb-lg">
        <div className="card fade-up">
          <div className="card-head">
            <div className="card-title"><Icon name="cpu" className="ico" /> 1 · Clasificador</div>
            <div className="card-sub">IA + fallback local</div>
          </div>
          <p className="dim" style={{fontSize: 13.5, lineHeight: 1.6}}>
            Cuando creás un ticket, el sistema intenta clasificarlo con un modelo de OpenAI.
            Si la API no responde, cae a un clasificador local basado en palabras clave que
            funciona offline. Devuelve <strong style={{color: "var(--text-1)"}}>categoría</strong>{" "}
            (hardware, software, red, cuenta, otro) y <strong style={{color: "var(--text-1)"}}>prioridad</strong>{" "}
            (crítica, alta, media, baja).
          </p>
        </div>

        <div className="card fade-up d1">
          <div className="card-head">
            <div className="card-title"><Icon name="layers" className="ico" /> 2 · Cola heap</div>
            <div className="card-sub">heapq</div>
          </div>
          <p className="dim" style={{fontSize: 13.5, lineHeight: 1.6}}>
            La cola está implementada como un <strong style={{color: "var(--text-1)"}}>heap binario</strong>{" "}
            (módulo <span className="mono" style={{color: "var(--accent)"}}>heapq</span> de Python).
            La raíz siempre es el ticket con mayor prioridad: las críticas pasan adelante de las altas,
            estas adelante de las medias y así. En empate manda el orden de llegada.
          </p>
        </div>

        <div className="card fade-up d2">
          <div className="card-head">
            <div className="card-title"><Icon name="search" className="ico" /> 3 · Detector de duplicados</div>
            <div className="card-sub">Similaridad de texto</div>
          </div>
          <p className="dim" style={{fontSize: 13.5, lineHeight: 1.6}}>
            Antes de encolar un ticket, el sistema busca tickets <em>en espera</em> de la misma
            categoría con descripción similar. Si encuentra coincidencias te avisa, y vos decidís
            si querés crear el tuyo igual o quedarte con el que ya está.
          </p>
        </div>

        <div className="card fade-up d3">
          <div className="card-head">
            <div className="card-title"><Icon name="clock" className="ico" /> 4 · Tiempos</div>
            <div className="card-sub">Promedio adaptativo</div>
          </div>
          <p className="dim" style={{fontSize: 13.5, lineHeight: 1.6}}>
            El tiempo estimado de espera se calcula multiplicando la cantidad de tickets que tenés
            adelante por el <strong style={{color: "var(--text-1)"}}>tiempo promedio</strong>{" "}
            de atención. Ese promedio se va recalculando con cada ticket resuelto, así que la
            estimación mejora con el uso.
          </p>
        </div>
      </div>

      <div className="card fade-up d4">
        <div className="card-head">
          <div className="card-title"><Icon name="info" className="ico" /> Mapa de prioridades</div>
        </div>
        <div className="col" style={{gap: 10}}>
          {[
            { p: "critica", txt: "Caídas totales, pérdida de datos, múltiples usuarios afectados. Va al frente de todo." },
            { p: "alta",    txt: "Errores que impiden trabajar a un usuario individual." },
            { p: "media",   txt: "Problemas que ralentizan pero no bloquean. Intermitencia." },
            { p: "baja",    txt: "Consultas, cambios cosméticos, mejoras opcionales." }
          ].map(r => (
            <div key={r.p} className="row" style={{gap: 14}}>
              <span className={`badge-prio ${r.p}`} style={{minWidth: 90, justifyContent: "center"}}>
                <span className="dot"></span>{PRIO_LABEL[r.p]}
              </span>
              <span className="dim" style={{fontSize: 13}}>{r.txt}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ============================================================
// TOPBAR & TOASTS (shared)
// ============================================================
function TopBar({ session, onLogout }) {
  return (
    <div className="app-topbar">
      <div className="brand">
        <span className="brand-dot"></span>
        <span>Soporte Técnico</span>
        <span className="brand-sub">Sistema de tickets con prioridad</span>
      </div>

      <div className="topbar-spacer"></div>

      <button className="icon-btn" onClick={onLogout} title="Salir">
        <Icon name="logout" size={14} />
      </button>
    </div>
  );
}

function Toasts({ toasts }) {
  return (
    <div className="toasts">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <div className="ico">
            <Icon name={t.kind === "success" ? "check" : t.kind === "warn" ? "alert" : t.kind === "error" ? "alert" : "info"} size={16} />
          </div>
          <div className="body">
            <div>{t.text}</div>
            {t.sub && <small>{t.sub}</small>}
          </div>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { UserView, TopBar, Toasts, TicketDetail });
