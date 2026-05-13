/* ============================================================
   HEAP VIEWER — visualización de la cola como árbol binario.
   La raíz es el peek (próximo a atender).
   ============================================================ */

function HeapViewer({ cola, highlight = null, onPick }) {
  const containerRef = React.useRef(null);
  const [w, setW] = React.useState(720);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setW(Math.max(420, e.contentRect.width));
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Ordenamos por prioridad para construir el heap visual
  // (el heap real se reconstruye desde el array sorted)
  const ordered = window.ordenarCola(cola);

  if (ordered.length === 0) {
    return (
      <div className="heap-stage" ref={containerRef} style={{minHeight: 280}}>
        <div className="empty" style={{border: "none", background: "transparent"}}>
          <div className="ico"><Icon name="layers" size={40} /></div>
          <h4>Cola vacía</h4>
          <p>No hay tickets en espera. Cuando lleguen, los vas a ver aquí dispuestos como un heap binario.</p>
        </div>
      </div>
    );
  }

  // Calcular niveles
  const levels = [];
  let lvl = 0, count = 0;
  ordered.forEach((t, i) => {
    if (!levels[lvl]) levels[lvl] = [];
    levels[lvl].push({ ...t, idx: i });
    count++;
    if (count >= Math.pow(2, lvl)) {
      lvl++;
      count = 0;
    }
  });

  const nodeW = 100;
  const nodeH = 64;
  const vSpacing = 90;
  const padTop = 16;
  const padBottom = 16;
  const padX = 30;
  const totalH = padTop + padBottom + levels.length * vSpacing;

  // Calcular posiciones X centradas
  // Cada nodo en el nivel L se posiciona basado en su índice tipo heap
  function getX(idx, level, levelCount) {
    const availableW = w - padX * 2;
    const slots = Math.pow(2, level);
    const slotW = availableW / slots;
    const slotIdxInLevel = idx - (Math.pow(2, level) - 1);
    return padX + slotIdxInLevel * slotW + slotW / 2;
  }

  const positions = ordered.map((t, i) => {
    let level = 0;
    while (i >= Math.pow(2, level + 1) - 1) level++;
    const x = getX(i, level, levels[level].length);
    const y = padTop + level * vSpacing;
    return { ...t, x, y, level, idx: i };
  });

  // Edges
  const edges = [];
  positions.forEach((p, i) => {
    const parentIdx = Math.floor((i - 1) / 2);
    if (parentIdx >= 0 && parentIdx < positions.length && i > 0) {
      const parent = positions[parentIdx];
      edges.push({ x1: parent.x, y1: parent.y + nodeH, x2: p.x, y2: p.y, key: `${parentIdx}-${i}` });
    }
  });

  return (
    <div className="heap-stage" ref={containerRef} style={{minHeight: totalH + 50}}>
      <div className="heap-canvas" style={{height: totalH}}>
        <svg className="heap-line" width={w} height={totalH}>
          {edges.map(e => (
            <line key={e.key} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
          ))}
        </svg>

        {positions.map((p, i) => (
          <div
            key={p.id}
            className={`heap-node ${p.prioridad} ${i === 0 ? "head" : ""}`}
            style={{ left: p.x, top: p.y, width: nodeW }}
            onClick={() => onPick?.(p)}
            title={`${p.nombre} — ${p.descripcion}`}
          >
            <div className="id">#{p.id}</div>
            <div className="nm">{p.nombre.split(" ")[0]}</div>
            <div className="pr">{PRIO_LABEL[p.prioridad]}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        display: "flex",
        gap: 16,
        marginTop: 16,
        flexWrap: "wrap",
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "var(--text-3)"
      }}>
        <span style={{display: "flex", alignItems: "center", gap: 6}}>
          <span style={{width: 8, height: 8, borderRadius: 4, background: "var(--accent)", boxShadow: "0 0 6px var(--accent-glow)"}}></span>
          Próximo a atender
        </span>
        <span style={{display: "flex", alignItems: "center", gap: 6}}>
          <span style={{width: 8, height: 8, borderRadius: 4, background: "var(--p-critica)", boxShadow: "0 0 6px var(--p-critica-glow)"}}></span>
          Crítica
        </span>
        <span style={{display: "flex", alignItems: "center", gap: 6}}>
          <span style={{width: 8, height: 8, borderRadius: 4, background: "var(--p-alta)", boxShadow: "0 0 6px var(--p-alta-glow)"}}></span>
          Alta
        </span>
        <span style={{display: "flex", alignItems: "center", gap: 6}}>
          <span style={{width: 8, height: 8, borderRadius: 4, background: "var(--p-media)", boxShadow: "0 0 6px var(--p-media-glow)"}}></span>
          Media
        </span>
        <span style={{display: "flex", alignItems: "center", gap: 6}}>
          <span style={{width: 8, height: 8, borderRadius: 4, background: "var(--p-baja)", boxShadow: "0 0 6px var(--p-baja-glow)"}}></span>
          Baja
        </span>
      </div>
    </div>
  );
}

window.HeapViewer = HeapViewer;
