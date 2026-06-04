// Chart primitives — light theme, animated

// Smooth area + line chart for Revenue card
const SmoothLine = ({ data, color = '#6b5fff', highlightLast = false, showDots = false, width = 320, height = 110, animate = true }) => {
  const W = width - 16, H = height - 28;
  const min = Math.min(...data.map(d => d.v));
  const max = Math.max(...data.map(d => d.v));
  const range = max - min || 1;
  const pts = data.map((d, i) => ({
    x: 8 + (i / (data.length - 1)) * W,
    y: 4 + H - ((d.v - min) / range) * H,
    v: d.v, label: d.label,
  }));
  const smooth = (points) => {
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] || points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };
  const path = smooth(pts);
  const area = `${path} L ${pts[pts.length-1].x} ${height-22} L ${pts[0].x} ${height-22} Z`;
  const last = pts[pts.length - 1];
  const id = 'g_' + React.useId().replace(/:/g,'');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={color} stopOpacity="0.32"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
        <filter id={`glow-${id}`}>
          <feGaussianBlur stdDeviation="3"/>
        </filter>
      </defs>
      <path d={area} fill={`url(#${id})`} className={animate ? 'reveal-area' : ''}/>
      <path d={path} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={animate ? 'draw-line' : ''}/>

      {pts.map((p, i) => (
        <text key={'l'+i} x={p.x} y={height-6} textAnchor="middle"
          fontSize="10" fill="rgba(13,20,36,0.45)" fontFamily="Inter">{p.label}</text>
      ))}

      {highlightLast && (
        <g style={{ animation: 'fadeUp 600ms 1.6s backwards' }}>
          {/* glow halo */}
          <circle cx={last.x} cy={last.y} r="10" fill={color} opacity="0.18">
            <animate attributeName="r" values="6;14;6" dur="2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite"/>
          </circle>
          <rect x={last.x - 38} y={last.y - 32} width="76" height="22" rx="6" fill="#0d1424"/>
          <text x={last.x} y={last.y - 17} textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff" fontFamily="Inter">
            ${last.v.toLocaleString()}
          </text>
          <circle cx={last.x} cy={last.y} r="5" fill="#fff" stroke={color} strokeWidth="2.5"/>
        </g>
      )}
    </svg>
  );
};

// Rounded vertical bars — with hover
const RoundedBars = ({ data, highlightIndex = -1, color = '#6b5fff', softColor = '#bcb0ff', width = 320, height = 110, onHover, hoverIndex = -1 }) => {
  const W = width - 16, H = height - 28;
  const max = Math.max(...data.map(d => d.v));
  const bw = W / data.length * 0.55;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      {data.map((d, i) => {
        const cx = 8 + (i + 0.5) * (W / data.length);
        const x = cx - bw/2;
        const h = Math.max(2, (d.v / max) * (H - 4));
        const y = 4 + (H - h);
        const isMax = i === highlightIndex;
        const isHover = i === hoverIndex;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={h} rx={bw/2}
              fill={isMax || isHover ? color : softColor}
              opacity={isMax || isHover ? 1 : 0.55}
              className="grow-bar"
              style={{ animationDelay: `${i*80}ms`, cursor: 'pointer', transition: 'fill 200ms, opacity 200ms' }}
              onMouseEnter={() => onHover && onHover(i)}
              onMouseLeave={() => onHover && onHover(-1)}/>
            {(isMax || isHover) && (
              <g style={{ animation: 'fadeUp 240ms backwards' }}>
                <rect x={cx - 22} y={y - 26} width="44" height="20" rx="6" fill="#0d1424"/>
                <text x={cx} y={y - 12} textAnchor="middle" fontSize="11" fontWeight="600" fill="#fff" fontFamily="Inter">{d.v.toLocaleString()}</text>
              </g>
            )}
            <text x={cx} y={height-6} textAnchor="middle" fontSize="10" fill="rgba(13,20,36,0.45)" fontFamily="Inter">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
};

// Dual line chart with interactive crosshair
const DualLineChart = ({ labels, a, b, colorA = '#5b8cff', colorB = '#f7984a', width = 480, height = 150, onHover }) => {
  const ref = React.useRef(null);
  const [hoverI, setHoverI] = React.useState(3);
  const W = width - 16, H = height - 28;
  const all = [...a, ...b];
  const min = Math.min(...all) * 0.85;
  const max = Math.max(...all) * 1.05;
  const range = max - min || 1;
  const toPts = arr => arr.map((v, i) => ({
    x: 8 + (i / (arr.length - 1)) * W,
    y: 4 + H - ((v - min) / range) * H,
    v,
  }));
  const smooth = (pts) => {
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };
  const ptsA = toPts(a), ptsB = toPts(b);

  const handleMove = (e) => {
    const r = ref.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * width;
    let nearest = 0, best = Infinity;
    ptsA.forEach((p, i) => {
      const d = Math.abs(p.x - x);
      if (d < best) { best = d; nearest = i; }
    });
    setHoverI(nearest);
    if (onHover) onHover(nearest);
  };

  const fx = hoverI >= 0 ? ptsA[hoverI].x : -1;

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%' }}
      onMouseMove={handleMove}
      onMouseLeave={() => { setHoverI(3); if (onHover) onHover(3); }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" preserveAspectRatio="none"
        style={{ display: 'block', overflow: 'visible' }}>
        {/* dashed grid */}
        {[0,1,2,3].map(i => (
          <line key={i} x1="8" x2={width-8} y1={4 + (i*H/3)} y2={4 + (i*H/3)}
            stroke="rgba(13,20,36,0.05)" strokeDasharray="3 4"/>
        ))}
        {fx >= 0 && <line x1={fx} x2={fx} y1="4" y2={height-22} stroke="rgba(13,20,36,0.18)" strokeDasharray="3 3"/>}

        <path d={smooth(ptsA)} fill="none" stroke={colorA} strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round" className="draw-line"/>
        <path d={smooth(ptsB)} fill="none" stroke={colorB} strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round" className="draw-line" style={{ animationDelay: '400ms' }}/>

        {hoverI >= 0 && (
          <>
            <circle cx={ptsA[hoverI].x} cy={ptsA[hoverI].y} r="6" fill="#fff" stroke={colorA} strokeWidth="2.5"/>
            <circle cx={ptsB[hoverI].x} cy={ptsB[hoverI].y} r="6" fill="#fff" stroke={colorB} strokeWidth="2.5"/>
          </>
        )}

        {labels.map((l, i) => (
          <text key={i} x={ptsA[i].x} y={height-6} textAnchor="middle"
            fontSize="10.5" fontWeight={i === hoverI ? 700 : 400}
            fill={i === hoverI ? 'rgba(13,20,36,0.85)' : 'rgba(13,20,36,0.45)'} fontFamily="Inter">{l}</text>
        ))}
      </svg>

      {hoverI >= 0 && (
        <div className="chart-tooltip show" style={{
          left: `${(ptsA[hoverI].x / width) * 100}%`,
          top: `${(Math.min(ptsA[hoverI].y, ptsB[hoverI].y) / height) * 100}%`,
        }}>
          <div className="row"><span style={{ width:8, height:8, borderRadius: 999, background: colorA }}/> Income: <strong>${a[hoverI].toLocaleString()}</strong></div>
          <div className="row"><span style={{ width:8, height:8, borderRadius: 999, background: colorB }}/> Expense: <strong>${b[hoverI].toLocaleString()}</strong></div>
        </div>
      )}
    </div>
  );
};

// Animated donut with sequential fill
const AnimatedDonut = ({ items, size = 150, stroke = 16 }) => {
  const total = items.reduce((s,x) => s + x.n, 0);
  const R = (size - stroke) / 2;
  const C = 2 * Math.PI * R;

  // animated progress per segment
  const [progress, setProgress] = React.useState(items.map(() => 0));
  React.useEffect(() => {
    let cancelled = false;
    let acc = 0;
    items.forEach((it, idx) => {
      const delay = acc;
      acc += 380;
      setTimeout(() => {
        if (cancelled) return;
        const start = performance.now();
        const dur = 700;
        const tick = (now) => {
          const p = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setProgress(prev => {
            const next = [...prev];
            next[idx] = eased;
            return next;
          });
          if (p < 1 && !cancelled) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, delay);
    });
    return () => { cancelled = true; };
  }, []);

  let acc = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={R} fill="none" stroke="rgba(13,20,36,0.05)" strokeWidth={stroke}/>
      {items.map((it, i) => {
        const fullLen = (it.n / total) * C;
        const len = fullLen * progress[i];
        const offset = -acc;
        acc += fullLen;
        return (
          <circle key={i} cx={size/2} cy={size/2} r={R} fill="none"
            stroke={it.color} strokeWidth={stroke}
            strokeDasharray={`${Math.max(len - 4, 0)} ${C}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`}/>
        );
      })}
    </svg>
  );
};

window.SmoothLine = SmoothLine;
window.RoundedBars = RoundedBars;
window.DualLineChart = DualLineChart;
window.AnimatedDonut = AnimatedDonut;
