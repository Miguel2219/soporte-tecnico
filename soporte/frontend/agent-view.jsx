/* ============================================================
   AGENT VIEW — Gestión completa de la cola
   ============================================================ */

function AgentView({ state, dispatch, session, onLogout, density, onToggleDensity }) {
  const [tab, setTab] = React.useState("cola"); // cola | atencion | historial | cancelados | resumen | stats
  const [toasts, setToasts] = React.useState([]);

  const pushToast = React.useCallback((kind, text, sub) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, kind, text, sub }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200);
  }, []);

  const criticosCount = state.cola.filter(t => t.prioridad === "critica").length;

  return (
    <div className="app-root" data-screen-label={`03 Agente · ${tab}`}>
      <TopBar session={session} onLogout={onLogout} />

      <div className="app-body">
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-label">Operación</div>
            <button className={`nav-item ${tab === "cola" ? "active" : ""}`} onClick={() => setTab("cola")}>
              <Icon name="layers" className="ico" />
              <span>Cola en espera</span>
              <span className="badge">{state.cola.length}</span>
            </button>
            <button className={`nav-item ${tab === "atencion" ? "active" : ""}`} onClick={() => setTab("atencion")}>
              <Icon name="zap" className="ico" />
              <span>En atención</span>
              {state.ticketActual && <span className="badge" style={{background: "var(--accent-mute)", color: "var(--accent)"}}>1</span>}
            </button>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">Archivo</div>
            <button className={`nav-item ${tab === "historial" ? "active" : ""}`} onClick={() => setTab("historial")}>
              <Icon name="history" className="ico" />
              <span>Historial</span>
              <span className="badge">{state.historial.length}</span>
            </button>
            <button className={`nav-item ${tab === "cancelados" ? "active" : ""}`} onClick={() => setTab("cancelados")}>
              <Icon name="ban" className="ico" />
              <span>Cancelados</span>
              <span className="badge">{state.cancelados.length}</span>
            </button>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">Análisis</div>
            <button className={`nav-item ${tab === "resumen" ? "active" : ""}`} onClick={() => setTab("resumen")}>
              <Icon name="panel" className="ico" />
              <span>Resumen</span>
            </button>
            <button className={`nav-item ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>
              <Icon name="stats" className="ico" />
              <span>Estadísticas</span>
            </button>
          </div>

          <div className="sidebar-footer">
            <span className="dot" style={{background: criticosCount > 0 ? "var(--p-critica)" : "var(--accent)", boxShadow: criticosCount > 0 ? "0 0 6px var(--p-critica-glow)" : "0 0 6px var(--accent-glow)"}}></span>
            <span>{criticosCount > 0 ? `${criticosCount} crítico${criticosCount > 1 ? "s" : ""} en cola` : "Sin críticos pendientes"}</span>
          </div>
        </aside>

        <main className="main">
          {tab === "cola"       && <ColaTab state={state} dispatch={dispatch} pushToast={pushToast} switchTo={setTab} />}
          {tab === "atencion"   && <AtencionTab state={state} dispatch={dispatch} pushToast={pushToast} switchTo={setTab} />}
          {tab === "historial"  && <HistorialTab state={state} />}
          {tab === "cancelados" && <CanceladosTab state={state} />}
          {tab === "resumen"    && <ResumenTab state={state} switchTo={setTab} />}
          {tab === "stats"      && <StatsTab state={state} />}
        </main>
      </div>

      <Toasts toasts={toasts} />
    </div>
  );
}

// ============================================================
// TAB: COLA
// ============================================================
function ColaTab({ state, dispatch, pushToast, switchTo }) {
  const ordenada = window.ordenarCola(state.cola);
  const next = ordenada[0];
  const [view, setView] = React.useState("heap"); // heap | list

  function atender() {
    if (state.ticketActual) {
      pushToast("warn", "Ya hay un ticket en atención", "Resolvé el actual antes de tomar el siguiente.");
      return;
    }
    if (!next) {
      pushToast("error", "No hay tickets en cola", "Esperá a que lleguen reportes.");
      return;
    }
    dispatch({ type: "ATTEND_NEXT" });
    pushToast("success", `Atendiendo ticket #${next.id}`, `${next.nombre} · ${PRIO_LABEL[next.prioridad]}`);
    switchTo("atencion");
  }

  const counts = {
    critica: state.cola.filter(t => t.prioridad === "critica").length,
    alta:    state.cola.filter(t => t.prioridad === "alta").length,
    media:   state.cola.filter(t => t.prioridad === "media").length,
    baja:    state.cola.filter(t => t.prioridad === "baja").length,
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Operación · Cola de prioridad</div>
          <h1 className="page-title">{state.cola.length} ticket{state.cola.length !== 1 ? "s" : ""} en espera</h1>
          <p className="page-sub">
            La cola se ordena por prioridad y luego por orden de llegada. La raíz del heap
            es el próximo ticket a tomar.
          </p>
        </div>

        {next && (
          <button className="btn primary lg" onClick={atender} disabled={!!state.ticketActual}>
            <Icon name="play" size={15} /> Atender siguiente · #{next.id}
          </button>
        )}
      </div>

      <div className="stat-grid mb-lg">
        <PrioStat label="Críticas" val={counts.critica} cls="critica" />
        <PrioStat label="Altas" val={counts.alta} cls="alta" />
        <PrioStat label="Medias" val={counts.media} cls="media" />
        <PrioStat label="Bajas" val={counts.baja} cls="baja" />
        <div className="stat accent">
          <div className="stat-label"><Icon name="clock" size={11} /> Promedio atención</div>
          <div className="stat-value">{state.tiempoAtencionPromedio}<span style={{fontSize: 16, color: "var(--text-3)", marginLeft: 4}}>min</span></div>
          <div className="stat-foot">Se recalcula con cada resolución</div>
        </div>
      </div>

      <div className="card glow mb-lg fade-up">
        <div className="card-head">
          <div className="card-title">
            <Icon name="layers" className="ico" /> Heap binario
          </div>
          <div className="row" style={{gap: 8}}>
            <div className="tabs">
              <button className={`tab ${view === "heap" ? "active" : ""}`} onClick={() => setView("heap")}>Árbol</button>
              <button className={`tab ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>Lista</button>
            </div>
          </div>
        </div>

        {view === "heap" && <HeapViewer cola={state.cola} />}
        {view === "list" && (
          <div className="col" style={{gap: 8}}>
            {ordenada.length === 0 && <div className="empty"><div className="ico"><Icon name="layers" size={28} /></div><h4>Cola vacía</h4><p>Sin tickets en espera.</p></div>}
            {ordenada.map((t, idx) => (
              <ColaRow key={t.id} t={t} position={idx + 1} isNext={idx === 0} dispatch={dispatch} pushToast={pushToast} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function PrioStat({ label, val, cls }) {
  const colors = {
    critica: { color: "var(--p-critica)", glow: "var(--p-critica-glow)" },
    alta:    { color: "var(--p-alta)",    glow: "var(--p-alta-glow)" },
    media:   { color: "var(--p-media)",   glow: "var(--p-media-glow)" },
    baja:    { color: "var(--p-baja)",    glow: "var(--p-baja-glow)" },
  };
  return (
    <div className="stat">
      <div className="stat-label">
        <span style={{width: 7, height: 7, borderRadius: 4, background: colors[cls].color, boxShadow: `0 0 6px ${colors[cls].glow}`, display: "inline-block"}}></span>
        {label}
      </div>
      <div className="stat-value" style={{color: val > 0 ? colors[cls].color : "var(--text-2)"}}>{val}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${Math.min(100, val * 14)}%`, background: `linear-gradient(90deg, ${colors[cls].color}, ${colors[cls].color})`, boxShadow: `0 0 6px ${colors[cls].glow}` }}></div>
      </div>
    </div>
  );
}

function ColaRow({ t, position, isNext, dispatch, pushToast }) {
  function cancel() {
    if (confirm(`¿Cancelar el ticket #${t.id} de ${t.nombre}?`)) {
      dispatch({ type: "CANCEL", payload: t.id });
      pushToast("warn", `Ticket #${t.id} cancelado`);
    }
  }
  return (
    <div className={`ticket-row ${isNext ? "glow-pulse" : ""}`} style={isNext ? {borderColor: "oklch(0.42 0.10 175 / 0.55)"} : {}}>
      <div style={{textAlign: "center"}}>
        <div className="upper faint">Pos</div>
        <div className="mono" style={{fontSize: 18, color: isNext ? "var(--accent-strong)" : "var(--text-2)", textShadow: isNext ? "0 0 10px var(--accent-glow)" : "none"}}>
          {String(position).padStart(2, "0")}
        </div>
      </div>
      <div style={{minWidth: 0}}>
        <div className="row" style={{gap: 8, alignItems: "center", marginBottom: 2}}>
          <span className="mono dim" style={{fontSize: 12}}>#{t.id}</span>
          <span className="name">{t.nombre}</span>
        </div>
        <div className="desc">{t.descripcion}</div>
      </div>
      <div className="meta">
        <span className={`badge-prio ${t.prioridad}`}><span className="dot"></span>{PRIO_LABEL[t.prioridad]}</span>
        <span className={`badge-cat ${CAT_KEY[t.categoria]}`}>{CAT_LABEL[t.categoria]}</span>
      </div>
      <div className="meta">
        <span className="mono dim" style={{fontSize: 11, minWidth: 80, textAlign: "right"}}>{fmtMinAgo(t.horaLlegada)}</span>
        <button className="btn danger sm" onClick={cancel} title="Cancelar"><Icon name="ban" size={12} /></button>
      </div>
    </div>
  );
}

// ============================================================
// TAB: ATENCIÓN
// ============================================================
function AtencionTab({ state, dispatch, pushToast, switchTo }) {
  const t = state.ticketActual;
  const [solucion, setSolucion] = React.useState("");
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);

  React.useEffect(() => {
    setSolucion("");
  }, [t?.id]);

  if (!t) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="page-eyebrow">Operación · En atención</div>
            <h1 className="page-title">Sin ticket activo</h1>
            <p className="page-sub">Ningún ticket está siendo atendido en este momento. Vamos a la cola para tomar el siguiente.</p>
          </div>
        </div>
        <div className="empty" style={{padding: "60px 24px"}}>
          <div className="ico"><Icon name="zap" size={40} /></div>
          <h4>Nada en atención</h4>
          <p>Cuando tomes un ticket de la cola, vas a ver acá todos los detalles y el formulario para registrar la solución.</p>
          <button className="btn primary mt-md" onClick={() => switchTo("cola")}>
            <Icon name="layers" size={14} /> Ir a la cola
          </button>
        </div>
      </>
    );
  }

  const transcurrido = Math.floor((now - new Date(t.horaInicioAtencion).getTime()) / 60000);
  const limite = state.tiempoLimiteAtencion;
  const restante = Math.max(0, limite - transcurrido);
  const alerta = transcurrido > limite;
  const ratio = Math.min(1, transcurrido / limite);

  function resolver() {
    if (solucion.trim().length < 5) {
      pushToast("error", "Solución muy corta", "Necesitamos al menos 5 caracteres.");
      return;
    }
    dispatch({ type: "RESOLVE", payload: { solucion: solucion.trim() } });
    pushToast("success", `Ticket #${t.id} resuelto`, "Movido al historial.");
    setSolucion("");
  }

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Operación · En atención</div>
          <h1 className="page-title">Ticket #{t.id} · {t.nombre}</h1>
          <p className="page-sub">
            {t.descripcion}
          </p>
        </div>
        <div className="status en-atencion"><span className="pulse"></span> En atención</div>
      </div>

      <div style={{display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--gap-lg)"}}>
        {/* MAIN: ticket info + solution */}
        <div className="col" style={{gap: "var(--gap-lg)"}}>
          <div className="card glow fade-up">
            <div className="card-head">
              <div className="card-title"><Icon name="ticket" className="ico" /> Detalle</div>
              <div className="row" style={{gap: 6}}>
                <span className={`badge-prio ${t.prioridad}`}><span className="dot"></span>{PRIO_LABEL[t.prioridad]}</span>
                <span className={`badge-cat ${CAT_KEY[t.categoria]}`}>{CAT_LABEL[t.categoria]}</span>
              </div>
            </div>

            <div style={{
              background: "oklch(0.165 0.012 195)",
              borderRadius: 8,
              border: "1px solid var(--border-faint)",
              padding: 14,
              fontSize: 14.5,
              color: "var(--text-1)",
              lineHeight: 1.55
            }}>
              {t.descripcion}
            </div>

            <div className="grid-3 mt-md">
              <div>
                <div className="upper faint" style={{marginBottom: 4}}>Llegó</div>
                <div className="mono" style={{color: "var(--text-1)"}}>{fmtHora(t.horaLlegada)}</div>
                <div className="mono dim" style={{fontSize: 11, marginTop: 2}}>{fmtMinAgo(t.horaLlegada)}</div>
              </div>
              <div>
                <div className="upper faint" style={{marginBottom: 4}}>Inicio atención</div>
                <div className="mono" style={{color: "var(--text-1)"}}>{fmtHora(t.horaInicioAtencion)}</div>
                <div className="mono dim" style={{fontSize: 11, marginTop: 2}}>{fmtMinAgo(t.horaInicioAtencion)}</div>
              </div>
              <div>
                <div className="upper faint" style={{marginBottom: 4}}>Reportante</div>
                <div style={{color: "var(--text-1)"}}>{t.nombre}</div>
                <div className="mono dim" style={{fontSize: 11, marginTop: 2}}>Usuario</div>
              </div>
            </div>
          </div>

          <div className="card fade-up d1">
            <div className="card-head">
              <div className="card-title"><Icon name="check" className="ico" /> Registrar solución</div>
              <div className="card-sub">Al guardar, cierra el ticket</div>
            </div>

            <div className="field">
              <label className="field-label">¿Cómo lo resolviste?</label>
              <textarea
                className="textarea"
                value={solucion}
                onChange={e => setSolucion(e.target.value)}
                placeholder='Ej. "Reinicié el servicio de Outlook y limpié caché de credenciales. Operativo."'
                rows={4}
              />
            </div>

            <div className="row mt-md" style={{justifyContent: "flex-end", gap: 10}}>
              <button className="btn primary" onClick={resolver} disabled={solucion.trim().length < 5}>
                <Icon name="check" size={14} /> Marcar como resuelto
              </button>
            </div>
          </div>
        </div>

        {/* SIDE: timer */}
        <div className="col" style={{gap: "var(--gap-lg)"}}>
          <div className={`card fade-up d1 ${alerta ? "" : "glow"}`} style={alerta ? {borderColor: "oklch(0.55 0.18 22 / 0.55)", boxShadow: "0 0 30px oklch(0.55 0.18 22 / 0.25)"} : {}}>
            <div className="card-head">
              <div className="card-title">
                <Icon name={alerta ? "alert" : "clock"} className="ico" style={alerta ? {color: "var(--p-critica)"} : {}} />
                Tiempo
              </div>
              <div className="card-sub">{alerta ? "Excedido" : "Dentro del límite"}</div>
            </div>

            <div style={{textAlign: "center", padding: "16px 0"}}>
              <div style={{
                fontSize: 64,
                fontFamily: "var(--font-mono)",
                fontWeight: 500,
                letterSpacing: "-0.04em",
                color: alerta ? "var(--p-critica)" : "var(--accent-strong)",
                textShadow: alerta ? "0 0 24px var(--p-critica-glow)" : "0 0 24px var(--accent-glow)",
                lineHeight: 1
              }}>
                {String(transcurrido).padStart(2, "0")}
              </div>
              <div className="mono dim" style={{fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 6}}>
                minutos en atención
              </div>
            </div>

            <div style={{
              height: 6,
              background: "var(--bg-3)",
              borderRadius: 999,
              overflow: "hidden",
              marginTop: 8
            }}>
              <div style={{
                height: "100%",
                width: `${ratio * 100}%`,
                background: alerta ? "var(--p-critica)" : "linear-gradient(90deg, var(--accent-dim), var(--accent))",
                boxShadow: alerta ? "0 0 8px var(--p-critica-glow)" : "0 0 8px var(--accent-glow)",
                transition: "width 1s linear"
              }}></div>
            </div>
            <div className="row between mt-sm" style={{fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em"}}>
              <span>0 min</span>
              <span>Límite · {limite} min</span>
            </div>

            {alerta ? (
              <div className="mt-md" style={{
                padding: 10,
                borderRadius: 8,
                background: "oklch(0.30 0.10 22 / 0.18)",
                border: "1px solid oklch(0.45 0.16 22 / 0.45)",
                color: "var(--p-critica)",
                fontSize: 12.5,
                lineHeight: 1.5
              }}>
                <Icon name="alert" size={12} /> Excedió el tiempo límite de {limite} min. Considerar escalamiento.
              </div>
            ) : (
              <div className="mt-md" style={{
                padding: 10,
                borderRadius: 8,
                background: "oklch(0.30 0.06 175 / 0.18)",
                border: "1px solid oklch(0.45 0.10 175 / 0.30)",
                color: "var(--accent)",
                fontSize: 12.5,
                lineHeight: 1.5
              }}>
                <Icon name="check" size={12} /> Quedan {restante} min antes de alerta.
              </div>
            )}
          </div>

          <div className="card fade-up d2">
            <div className="card-head">
              <div className="card-title"><Icon name="hash" className="ico" /> Datos del ticket</div>
            </div>
            <KVList items={[
              ["ID", `#${t.id}`],
              ["Estado", "en atención"],
              ["Prioridad", PRIO_LABEL[t.prioridad]],
              ["Categoría", CAT_LABEL[t.categoria]],
              ["Hora llegada", fmtHora(t.horaLlegada)],
              ["Hora inicio", fmtHora(t.horaInicioAtencion)],
            ]} />
          </div>
        </div>
      </div>
    </>
  );
}

function KVList({ items }) {
  return (
    <div className="col" style={{gap: 0}}>
      {items.map(([k, v], i) => (
        <div key={k} style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          padding: "9px 0",
          borderTop: i === 0 ? "none" : "1px solid var(--border-faint)",
          fontFamily: "var(--font-mono)",
          fontSize: 12.5
        }}>
          <span className="dim" style={{textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10.5}}>{k}</span>
          <span style={{color: "var(--text-1)"}}>{v}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// TAB: HISTORIAL
// ============================================================
function HistorialTab({ state }) {
  const [filterCat, setFilterCat] = React.useState("all");
  const [filterPrio, setFilterPrio] = React.useState("all");

  const filtered = state.historial.filter(t =>
    (filterCat === "all" || t.categoria === filterCat) &&
    (filterPrio === "all" || t.prioridad === filterPrio)
  );

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Archivo · Historial</div>
          <h1 className="page-title">Tickets resueltos</h1>
          <p className="page-sub">{state.historial.length} tickets resueltos. Filtrá por categoría o prioridad.</p>
        </div>
      </div>

      <div className="row mb-lg" style={{gap: 12, flexWrap: "wrap"}}>
        <FilterGroup label="Categoría" value={filterCat} onChange={setFilterCat} options={[
          ["all", "Todas"],
          ["hardware", "Hardware"],
          ["software", "Software"],
          ["red", "Red"],
          ["cuenta de usuario", "Cuenta"],
          ["otro", "Otro"]
        ]} />
        <FilterGroup label="Prioridad" value={filterPrio} onChange={setFilterPrio} options={[
          ["all", "Todas"],
          ["critica", "Crítica"],
          ["alta", "Alta"],
          ["media", "Media"],
          ["baja", "Baja"]
        ]} />
        <div style={{marginLeft: "auto"}} className="mono dim">
          {filtered.length} de {state.historial.length}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <div className="ico"><Icon name="history" size={28} /></div>
          <h4>Sin resultados</h4>
          <p>No hay tickets resueltos con esos filtros.</p>
        </div>
      ) : (
        <div className="col" style={{gap: 10}}>
          {filtered.map((t, i) => <HistRow key={t.id} t={t} delay={i} />)}
        </div>
      )}
    </>
  );
}

function FilterGroup({ label, value, onChange, options }) {
  return (
    <div>
      <div className="upper faint mb-sm" style={{marginBottom: 6}}>{label}</div>
      <div className="tabs">
        {options.map(([k, lbl]) => (
          <button key={k} className={`tab ${value === k ? "active" : ""}`} onClick={() => onChange(k)}>
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

function HistRow({ t, delay }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={`card fade-up ${delay < 5 ? "d" + delay : ""}`} style={{padding: "var(--pad-md)"}}>
      <div className="row between" style={{cursor: "pointer", gap: 12}} onClick={() => setOpen(o => !o)}>
        <div style={{minWidth: 0, flex: 1}}>
          <div className="row" style={{gap: 8, marginBottom: 3, flexWrap: "wrap"}}>
            <span className="mono dim" style={{fontSize: 12}}>#{t.id}</span>
            <span style={{fontSize: 14, fontWeight: 500}}>{t.nombre}</span>
            <span className={`badge-prio ${t.prioridad}`}><span className="dot"></span>{PRIO_LABEL[t.prioridad]}</span>
            <span className={`badge-cat ${CAT_KEY[t.categoria]}`}>{CAT_LABEL[t.categoria]}</span>
          </div>
          <div className="desc">{t.descripcion}</div>
        </div>
        <div style={{textAlign: "right", minWidth: 100}}>
          <div className="upper faint">Duración</div>
          <div className="mono" style={{fontSize: 16, color: "var(--accent-strong)"}}>
            {fmtDur(t.horaInicioAtencion, t.horaSolucion)}
          </div>
        </div>
      </div>
      {open && (
        <div style={{
          marginTop: 12,
          padding: 12,
          background: "oklch(0.17 0.012 195)",
          border: "1px solid var(--border-faint)",
          borderRadius: 8
        }}>
          <div className="upper faint" style={{marginBottom: 6}}>Solución</div>
          <div style={{fontSize: 13.5, color: "var(--text-1)", lineHeight: 1.5}}>{t.solucion}</div>
          <div className="row" style={{gap: 14, marginTop: 10, fontSize: 11, color: "var(--text-4)", fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em", flexWrap: "wrap"}}>
            <span>Llegada · {fmtHora(t.horaLlegada)}</span>
            <span>Inicio · {fmtHora(t.horaInicioAtencion)}</span>
            <span>Cierre · {fmtHora(t.horaSolucion)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TAB: CANCELADOS
// ============================================================
function CanceladosTab({ state }) {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Archivo · Cancelados</div>
          <h1 className="page-title">{state.cancelados.length} ticket{state.cancelados.length !== 1 ? "s" : ""} cancelados</h1>
          <p className="page-sub">Reportes que se cancelaron antes de ser atendidos.</p>
        </div>
      </div>

      {state.cancelados.length === 0 ? (
        <div className="empty">
          <div className="ico"><Icon name="ban" size={28} /></div>
          <h4>Sin cancelados</h4>
          <p>Cuando un usuario cancela un ticket en cola, lo vas a ver acá.</p>
        </div>
      ) : (
        <div className="col" style={{gap: 10}}>
          {state.cancelados.map(t => (
            <div key={t.id} className="card" style={{padding: "var(--pad-md)", opacity: 0.75}}>
              <div className="row between" style={{gap: 12}}>
                <div style={{flex: 1, minWidth: 0}}>
                  <div className="row" style={{gap: 8, marginBottom: 3, flexWrap: "wrap"}}>
                    <span className="mono dim" style={{fontSize: 12}}>#{t.id}</span>
                    <span style={{fontSize: 14, fontWeight: 500}}>{t.nombre}</span>
                    <span className={`badge-prio ${t.prioridad}`}><span className="dot"></span>{PRIO_LABEL[t.prioridad]}</span>
                    <span className={`badge-cat ${CAT_KEY[t.categoria]}`}>{CAT_LABEL[t.categoria]}</span>
                    <span className="status cancelado"><span className="pulse"></span>Cancelado</span>
                  </div>
                  <div className="desc">{t.descripcion}</div>
                </div>
                <div className="mono dim" style={{fontSize: 11, minWidth: 100, textAlign: "right"}}>
                  {fmtHora(t.horaLlegada)}<br/>
                  <span style={{fontSize: 10, color: "var(--text-4)"}}>{fmtMinAgo(t.horaLlegada)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ============================================================
// TAB: RESUMEN
// ============================================================
function ResumenTab({ state, switchTo }) {
  const criticos = state.cola.filter(t => t.prioridad === "critica").length;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Análisis · Resumen</div>
          <h1 className="page-title">Estado del sistema</h1>
          <p className="page-sub">Vista rápida de qué está pasando ahora mismo.</p>
        </div>
      </div>

      <div className="stat-grid mb-lg">
        <div className="stat accent fade-up">
          <div className="stat-label"><Icon name="layers" size={11} /> En espera</div>
          <div className="stat-value">{state.cola.length}</div>
          <div className="stat-foot">{criticos > 0 ? `${criticos} crítico${criticos > 1 ? "s" : ""} pendiente${criticos > 1 ? "s" : ""}` : "Sin críticos"}</div>
        </div>
        <div className={`stat ${criticos > 0 ? "danger" : ""} fade-up d1`}>
          <div className="stat-label"><Icon name="flame" size={11} /> Críticos</div>
          <div className="stat-value">{criticos}</div>
          <div className="stat-foot">{criticos > 0 ? "Tomar prioridad" : "Estable"}</div>
        </div>
        <div className="stat fade-up d2">
          <div className="stat-label"><Icon name="clock" size={11} /> Promedio</div>
          <div className="stat-value">{state.tiempoAtencionPromedio}<span style={{fontSize: 16, color: "var(--text-3)", marginLeft: 4}}>min</span></div>
          <div className="stat-foot">Por ticket atendido</div>
        </div>
        <div className="stat fade-up d3">
          <div className="stat-label"><Icon name="history" size={11} /> Resueltos hoy</div>
          <div className="stat-value">{state.historial.length}</div>
          <div className="stat-foot">Cerrados en el archivo</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card glow fade-up d1">
          <div className="card-head">
            <div className="card-title"><Icon name="zap" className="ico" /> Ticket en atención</div>
            {state.ticketActual && <div className="status en-atencion"><span className="pulse"></span> Activo</div>}
          </div>
          {state.ticketActual ? (
            <>
              <TicketDetail t={state.ticketActual} />
              <button className="btn primary mt-md" onClick={() => switchTo("atencion")}>
                Ir a la atención <Icon name="arrow" size={13} />
              </button>
            </>
          ) : (
            <div className="empty" style={{padding: "30px 16px"}}>
              <div className="ico"><Icon name="zap" size={26} /></div>
              <h4>Sin ticket activo</h4>
              <p>Tomá el próximo de la cola.</p>
              <button className="btn mt-md" onClick={() => switchTo("cola")}>
                Ir a la cola
              </button>
            </div>
          )}
        </div>

        <div className="card fade-up d2">
          <div className="card-head">
            <div className="card-title"><Icon name="layers" className="ico" /> Próximos en cola</div>
            <div className="card-sub">Top 5</div>
          </div>
          {state.cola.length === 0 ? (
            <div className="empty" style={{padding: "30px 16px"}}>
              <div className="ico"><Icon name="layers" size={26} /></div>
              <h4>Cola vacía</h4>
              <p>Sin pendientes.</p>
            </div>
          ) : (
            <div className="col" style={{gap: 6}}>
              {window.ordenarCola(state.cola).slice(0, 5).map((t, i) => (
                <div key={t.id} style={{
                  display: "grid",
                  gridTemplateColumns: "28px 1fr auto",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: i === 0 ? "oklch(0.30 0.10 175 / 0.10)" : "transparent",
                  border: i === 0 ? "1px solid oklch(0.42 0.10 175 / 0.35)" : "1px solid transparent",
                  gap: 10
                }}>
                  <span className="mono" style={{fontSize: 11, color: "var(--text-3)"}}>{String(i + 1).padStart(2, "0")}</span>
                  <div style={{minWidth: 0}}>
                    <div style={{fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{t.nombre}</div>
                    <div className="dim" style={{fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>{t.descripcion}</div>
                  </div>
                  <span className={`badge-prio ${t.prioridad}`} style={{padding: "2px 8px", fontSize: 9.5}}>
                    <span className="dot"></span>{PRIO_LABEL[t.prioridad]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================
// TAB: STATS
// ============================================================
function StatsTab({ state }) {
  if (state.historial.length === 0 && state.cancelados.length === 0) {
    return (
      <>
        <div className="page-head">
          <div>
            <div className="page-eyebrow">Análisis · Estadísticas</div>
            <h1 className="page-title">Sin datos suficientes</h1>
            <p className="page-sub">Resolvé algunos tickets para empezar a ver estadísticas.</p>
          </div>
        </div>
        <div className="empty">
          <div className="ico"><Icon name="stats" size={28} /></div>
          <h4>Esperando datos</h4>
          <p>Las estadísticas se construyen del historial.</p>
        </div>
      </>
    );
  }

  const byCat = {};
  const byPrio = {};
  state.historial.forEach(t => {
    byCat[t.categoria] = (byCat[t.categoria] || 0) + 1;
    byPrio[t.prioridad] = (byPrio[t.prioridad] || 0) + 1;
  });
  const catMax = Math.max(1, ...Object.values(byCat));
  const prioMax = Math.max(1, ...Object.values(byPrio));

  const catFrecuente = Object.keys(byCat).reduce((a, b) => byCat[a] > byCat[b] ? a : b, Object.keys(byCat)[0]);
  const prioFrecuente = Object.keys(byPrio).reduce((a, b) => byPrio[a] > byPrio[b] ? a : b, Object.keys(byPrio)[0]);

  const criticosByCategoria = {};
  state.historial.filter(t => t.prioridad === "critica").forEach(t => {
    criticosByCategoria[t.categoria] = (criticosByCategoria[t.categoria] || 0) + 1;
  });
  const catMasCriticos = Object.keys(criticosByCategoria).length
    ? Object.keys(criticosByCategoria).reduce((a, b) => criticosByCategoria[a] > criticosByCategoria[b] ? a : b)
    : "—";

  const tiempos = state.historial
    .map(t => (new Date(t.horaSolucion) - new Date(t.horaInicioAtencion)) / 60000)
    .filter(n => !isNaN(n));
  const promedio = tiempos.length ? Math.round(tiempos.reduce((s, n) => s + n, 0) / tiempos.length) : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-eyebrow">Análisis · Estadísticas</div>
          <h1 className="page-title">Estadísticas del sistema</h1>
          <p className="page-sub">Vista del rendimiento desde que arrancó la sesión.</p>
        </div>
      </div>

      <div className="stat-grid mb-lg">
        <div className="stat fade-up">
          <div className="stat-label">Atendidos</div>
          <div className="stat-value">{state.historial.length}</div>
        </div>
        <div className="stat fade-up d1">
          <div className="stat-label">Cancelados</div>
          <div className="stat-value">{state.cancelados.length}</div>
        </div>
        <div className="stat accent fade-up d2">
          <div className="stat-label">Tiempo promedio</div>
          <div className="stat-value">{promedio}<span style={{fontSize: 16, color: "var(--text-3)", marginLeft: 4}}>min</span></div>
        </div>
        <div className="stat fade-up d3">
          <div className="stat-label">Tasa cancelación</div>
          <div className="stat-value">{Math.round(state.cancelados.length / (state.historial.length + state.cancelados.length) * 100) || 0}<span style={{fontSize: 16, color: "var(--text-3)", marginLeft: 4}}>%</span></div>
        </div>
      </div>

      <div className="grid-2 mb-lg">
        <div className="card fade-up">
          <div className="card-head">
            <div className="card-title"><Icon name="filter" className="ico" /> Por categoría</div>
            <div className="card-sub">Resueltos</div>
          </div>
          <div className="bar-chart">
            {["hardware", "software", "red", "cuenta de usuario", "otro"].map(cat => {
              const v = byCat[cat] || 0;
              return (
                <div key={cat} className="bar-row">
                  <span className="l">{CAT_LABEL[cat]}</span>
                  <div className="track">
                    <div className="fill" style={{ width: `${(v / catMax) * 100}%` }}></div>
                  </div>
                  <span className="v">{v}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card fade-up d1">
          <div className="card-head">
            <div className="card-title"><Icon name="filter" className="ico" /> Por prioridad</div>
            <div className="card-sub">Resueltos</div>
          </div>
          <div className="bar-chart">
            {["critica", "alta", "media", "baja"].map(p => {
              const v = byPrio[p] || 0;
              return (
                <div key={p} className={`bar-row ${p}`}>
                  <span className="l">{PRIO_LABEL[p]}</span>
                  <div className="track">
                    <div className="fill" style={{ width: `${(v / prioMax) * 100}%` }}></div>
                  </div>
                  <span className="v">{v}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card fade-up d2">
        <div className="card-head">
          <div className="card-title"><Icon name="info" className="ico" /> Resumen rápido</div>
        </div>
        <div className="grid-3">
          <SummaryStat label="Categoría más frecuente" value={CAT_LABEL[catFrecuente] || "—"} />
          <SummaryStat label="Prioridad más frecuente" value={PRIO_LABEL[prioFrecuente] || "—"} />
          <SummaryStat label="Categoría con más críticos" value={CAT_LABEL[catMasCriticos] || "—"} />
        </div>
      </div>
    </>
  );
}

function SummaryStat({ label, value }) {
  return (
    <div style={{padding: "12px 0"}}>
      <div className="upper faint" style={{marginBottom: 6}}>{label}</div>
      <div style={{fontSize: 18, color: "var(--text-1)", fontWeight: 500}}>{value}</div>
    </div>
  );
}

window.AgentView = AgentView;
