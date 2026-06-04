// === Sidebar ===
const Sidebar = ({ active, setActive }) => {
  const items = [
    { id: 'dashboard',   icon: 'dashboard', label: 'Panel' },
    { id: 'insights',    icon: 'insights',  label: 'Análisis' },
    { id: 'accounts',    icon: 'accounts',  label: 'Cuentas' },
    { id: 'projects',    icon: 'projects',  label: 'Pipeline' },
    { id: 'tasks',       icon: 'tasks',     label: 'Tareas' },
    { id: 'time',        icon: 'time',      label: 'Actividad' },
    { id: 'files',       icon: 'files',     label: 'Archivos' },
    { id: 'invoices',    icon: 'invoices',  label: 'Facturas' },
    { id: 'team',        icon: 'team',      label: 'Equipo' },
    { id: 'clients',     icon: 'clients',   label: 'Clientes' },
    { id: 'integrations',icon: 'integrations', label: 'Integraciones' },
    { id: 'reports',     icon: 'reports',   label: 'Reportes' },
    { id: 'settings',    icon: 'settings',  label: 'Configuración' },
  ];
  return (
    <aside className="side glass-strong fade-in">
      <div className="logo-row">
        <LogoMark size={26}/>
        <span className="logo-text">Pandora</span>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
        {items.map(it => (
          <div key={it.id}
            className={`nav-item ${active === it.id ? 'active' : ''}`}
            onClick={() => setActive(it.id)}>
            <div className="nav-icon-box">
              <Icon name={it.icon} size={15}/>
            </div>
            <span>{it.label}</span>
          </div>
        ))}
      </nav>

      <div className="upgrade">
        <div className="upgrade-title">Mejorá a Pro</div>
        <div className="upgrade-sub">Desbloqueá pronósticos con IA, reportes personalizados y usuarios ilimitados.</div>
        <button className="btn-primary">
          Mejorar ahora <Icon name="arrowRight" size={14}/>
        </button>
      </div>
    </aside>
  );
};

// === Topbar ===
const Topbar = ({ period, setPeriod, user }) => {
  return (
    <div className="topbar">
      <div className="search">
        <Icon name="search" size={15}/>
        <input placeholder="Buscar deals, cuentas, contactos…"/>
        <span className="kbd">⌘ K</span>
      </div>

      <div className="seg">
        {[
          { id: 'today',  label: 'Hoy' },
          { id: 'week',   label: 'Semana' },
          { id: 'month',  label: 'Mes' },
          { id: 'reports',label: 'Reportes' },
        ].map(p => (
          <div key={p.id} className={`seg-btn ${period === p.id ? 'active' : ''}`} onClick={() => setPeriod(p.id)}>
            {p.label}
          </div>
        ))}
      </div>

      <div className="top-tools">
        <button className="iconbtn"><Icon name="bell" size={17}/></button>
        <button className="iconbtn">
          <Icon name="inbox" size={17}/>
          <span className="ndot">7</span>
        </button>
        <button className="iconbtn"><Icon name="settings" size={17}/></button>

        <div className="user-chip">
          <div className="avatar-ring">
            <Avatar initials={user.initials} bg="linear-gradient(135deg,#f7984a,#ee6a8e)" size={32}/>
          </div>
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-0)' }}>{user.name}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span className="live-dot" style={{ width: 6, height: 6 }}/>{user.role}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// === Sales hero artwork — single cohesive card with floating accent ===
const SalesArt = () => (
  <div style={{
    position: 'absolute',
    top: 24, right: 30, bottom: 24, width: 380,
    pointerEvents: 'none', zIndex: 1,
  }}>
    {/* Soft sun halo behind */}
    <div style={{
      position: 'absolute',
      top: 0, right: 30, width: 320, height: 320,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(255,210,180,0.55) 0%, rgba(255,180,200,0.25) 40%, transparent 70%)',
      filter: 'blur(20px)',
    }}/>

    {/* Main "Pipeline" card centered in the right zone */}
    <div className="float-card float-2" style={{
      position: 'absolute',
      top: '50%', right: 24,
      transform: 'translateY(-50%) rotate(-2deg)',
      width: 270,
      padding: '18px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: '#7681a0', fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pipeline · mayo</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0d1424', marginTop: 4, letterSpacing: '-0.02em' }}>$324,820</div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#1a8e5a',
          padding: '4px 9px',
          background: 'rgba(52,199,125,0.14)',
          borderRadius: 999,
        }}>↑ 18.4%</span>
      </div>

      {/* Growing bars */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56, marginBottom: 12 }}>
        {[
          {h: 40, c: 'rgba(107,95,255,0.25)'},
          {h: 55, c: 'rgba(107,95,255,0.35)'},
          {h: 35, c: 'rgba(107,95,255,0.30)'},
          {h: 70, c: 'rgba(107,95,255,0.55)'},
          {h: 50, c: 'rgba(107,95,255,0.45)'},
          {h: 88, c: '#6b5fff'},
          {h: 65, c: 'rgba(107,95,255,0.50)'},
        ].map((b, i) => (
          <div key={i} style={{
            flex: 1, height: `${b.h}%`,
            background: b.c,
            borderRadius: 5,
            animation: `growBar 900ms cubic-bezier(.2,.7,.2,1) ${600 + i*90}ms backwards`,
            transformOrigin: 'bottom',
            boxShadow: i === 5 ? '0 4px 12px rgba(107,95,255,0.4)' : 'none',
          }}/>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(13,20,36,0.06)' }}>
        <div className="ava-stack">
          <div className="a" style={{ background: 'linear-gradient(135deg,#6b5fff,#5b8cff)', width: 24, height: 24, fontSize: 9, border: '2px solid #fff' }}>CR</div>
          <div className="a" style={{ background: 'linear-gradient(135deg,#34c77d,#5b8cff)', width: 24, height: 24, fontSize: 9, border: '2px solid #fff' }}>DA</div>
          <div className="a" style={{ background: 'linear-gradient(135deg,#ee6a8e,#f7984a)', width: 24, height: 24, fontSize: 9, border: '2px solid #fff' }}>MC</div>
        </div>
        <span style={{ fontSize: 11, color: '#7681a0', fontFamily: 'JetBrains Mono' }}>34 deals</span>
      </div>
    </div>

    {/* Floating notification chip — top-right accent */}
    <div className="float-card float-1" style={{
      position: 'absolute',
      top: 22, right: 60,
      transform: 'rotate(3deg)',
      padding: '10px 14px 10px 10px',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 9,
        background: 'rgba(52,199,125,0.15)',
        color: '#1a8e5a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7"/></svg>
      </div>
      <div>
        <div style={{ fontSize: 11, color: '#7681a0', fontFamily: 'JetBrains Mono', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>Cerrado</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0d1424', marginTop: 3, letterSpacing: '-0.01em' }}>Velmont · $48.2k</div>
      </div>
    </div>

    {/* AI insight chip — bottom right accent */}
    <div className="float-card float-3" style={{
      position: 'absolute',
      bottom: 14, right: 80,
      transform: 'rotate(-2deg)',
      padding: '8px 12px 8px 8px',
      display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: 7,
        background: 'linear-gradient(135deg, #6b5fff, #9088ff)',
        color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4z"/></svg>
      </div>
      <div style={{ fontSize: 12, color: '#1f2a44', fontWeight: 500 }}>
        Helios al <strong style={{ color: '#6b5fff' }}>94%</strong> de cerrar
      </div>
    </div>
  </div>
);

// === Hero ===
const Hero = ({ user }) => {
  const live = useLiveTicker(73558.42, 0.85);
  return (
    <div className="glass fade-in" style={{
      padding: '34px 36px 36px',
      position: 'relative',
      overflow: 'hidden',
      minHeight: 280,
    }}>
      <SalesArt/>
      <div style={{ position: 'relative', zIndex: 2, maxWidth: 580 }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          Buen día, {user.firstName}<span className="wave" role="img" aria-label="saludo">👋</span>
        </div>
        <h1 className="hero-h1">Cerremos más<br/>ventas hoy.</h1>

        <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', background: 'rgba(255,255,255,0.55)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.85)', maxWidth: 440, backdropFilter: 'blur(20px)' }}>
          <span className="live-dot"/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Facturación en vivo</div>
            <div className="tnum counter-glow" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2 }}>
              {fmt$(live)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: 'var(--ink-3)' }}>vs objetivo</div>
            <div className="delta up" style={{ marginTop: 2 }}>
              <Icon name="triUp" size={10}/>+12.4%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// === Revenue panel with animated count ===
const RevenuePanel = () => {
  const data = [
    { label: 'Jan', v: 42000 }, { label: 'Feb', v: 48000 },
    { label: 'Mar', v: 51000 }, { label: 'Apr', v: 55000 },
    { label: 'May', v: 62000 }, { label: 'Jun', v: 70000 },
    { label: 'Jul', v: 73558 },
  ];
  const count = useCountUp(73558, { duration: 1600 });
  return (
    <TiltCard style={{ padding: 22 }}>
      <div className="card-title">
        <h3>Facturación total</h3>
        <button className="more-btn"><Icon name="more" size={16}/></button>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span className="tnum" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em' }}>${count.toLocaleString()}.00</span>
        <span className="delta up"><Icon name="triUp" size={11}/>12.4%</span>
      </div>
      <div className="label-sm" style={{ marginTop: 2 }}>vs mes anterior</div>

      <div style={{ height: 110, marginTop: 12, position: 'relative' }}>
        <SmoothLine data={data} color="#6b5fff" highlightLast={true}/>
      </div>
    </TiltCard>
  );
};

// === Active Clients ===
const ActiveClientsPanel = () => {
  const data = [
    { label: 'Jan', v: 760 }, { label: 'Feb', v: 880 },
    { label: 'Mar', v: 1020 }, { label: 'Apr', v: 1100 },
    { label: 'May', v: 1248 }, { label: 'Jun', v: 980 },
    { label: 'Jul', v: 1180 },
  ];
  const count = useCountUp(1248, { duration: 1400, delay: 200 });
  const [hover, setHover] = React.useState(-1);

  return (
    <TiltCard style={{ padding: 22 }}>
      <div className="card-title">
        <h3>Clientes activos</h3>
        <button className="more-btn"><Icon name="more" size={16}/></button>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span className="tnum" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.025em' }}>{count.toLocaleString()}</span>
        <span className="delta up"><Icon name="triUp" size={11}/>8.3%</span>
      </div>
      <div className="label-sm" style={{ marginTop: 2 }}>vs mes anterior</div>

      <div style={{ height: 110, marginTop: 12 }}>
        <RoundedBars data={data} highlightIndex={hover < 0 ? 4 : -1} hoverIndex={hover} onHover={setHover} color="#6b5fff" softColor="#bcb0ff"/>
      </div>
    </TiltCard>
  );
};

// === AI Insight / efficiency card ===
const EfficiencyPanel = () => (
  <TiltCard style={{ padding: 22, position: 'relative', overflow: 'hidden' }}>
    <div className="card-title">
      <h3>
        <span style={{ width:22, height:22, borderRadius:6, background:'rgba(107,95,255,0.13)', display:'inline-flex', alignItems:'center', justifyContent:'center', color:'var(--purple)'}}>
          <Icon name="sparkle" size={13}/>
        </span>
        AI · Pronóstico
      </h3>
      <button className="more-btn"><Icon name="arrowUpRight" size={15}/></button>
    </div>
    <p style={{ fontSize: 15.5, lineHeight: 1.5, color: 'var(--ink-1)', fontWeight: 500, margin: '14px 0 0', letterSpacing: '-0.012em' }}>
      <strong style={{ color: 'var(--ink-0)' }}>Este trimestre</strong> vas en camino a superar tu objetivo en un <strong style={{ color: '#6b5fff' }}>27%</strong>.
    </p>

    {/* Decorative wave */}
    <svg viewBox="0 0 300 80" style={{ position: 'absolute', left: 18, right: 18, bottom: 12, width: 'calc(100% - 36px)', height: 60, opacity: 0.7 }}>
      <defs>
        <linearGradient id="wave-grad" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#9088ff" stopOpacity="0"/>
          <stop offset="50%" stopColor="#6b5fff" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#9088ff" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d="M0 70 L40 50 L90 65 L150 35 L200 55 L260 30 L300 50 L300 80 L0 80 Z" fill="rgba(107,95,255,0.18)"/>
      <path d="M0 75 L60 60 L120 70 L180 55 L240 65 L300 50 L300 80 L0 80 Z" fill="rgba(107,95,255,0.10)"/>
      <path d="M0 70 L40 50 L90 65 L150 35 L200 55 L260 30 L300 50"
        fill="none" stroke="url(#wave-grad)" strokeWidth="2"/>
    </svg>
  </TiltCard>
);

// === Income vs Expense (interactive) ===
const IncomeExpensePanel = () => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul'];
  const income  = [12000, 14500, 16000, 18000, 19500, 22000, 24600];
  const expense = [ 9000, 11200, 10000, 13000, 10500, 12200, 13290];
  const [idx, setIdx] = React.useState(6);

  return (
    <TiltCard style={{ padding: 22 }} tilt={3}>
      <div className="card-title">
        <h3>Ingresos vs Gastos</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="more-btn" style={{ width: 30, height: 30, background: 'rgba(13,20,36,0.04)', borderRadius: 8 }}><Icon name="sliders" size={14}/></button>
          <button className="more-btn" style={{ width: 30, height: 30, background: 'rgba(13,20,36,0.04)', borderRadius: 8 }}><Icon name="arrowUpRight" size={14}/></button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 18, fontSize: 12, color: 'var(--ink-2)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, background: '#5b8cff', borderRadius: 999 }}/> Ingresos: <strong style={{ color: 'var(--ink-0)', fontWeight: 600 }}>${income[idx].toLocaleString()}</strong>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, background: '#f7984a', borderRadius: 999 }}/> Gastos: <strong style={{ color: 'var(--ink-0)', fontWeight: 600 }}>${expense[idx].toLocaleString()}</strong>
        </span>
      </div>

      <div style={{ height: 150, marginTop: 14, position: 'relative' }}>
        <DualLineChart labels={months} a={income} b={expense}
          colorA="#5b8cff" colorB="#f7984a" onHover={setIdx}/>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(13,20,36,0.05)' }}>
        <div>
          <div className="label-sm">Ingresos · {months[idx]}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
            <span className="tnum" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>${income[idx].toLocaleString()}</span>
            <span className="delta up"><Icon name="triUp" size={10}/>18.6%</span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="label-sm">Gastos · {months[idx]}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2, justifyContent: 'flex-end' }}>
            <span className="tnum" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>${expense[idx].toLocaleString()}</span>
            <span className="delta down"><Icon name="triDown" size={10}/>8.2%</span>
          </div>
        </div>
      </div>
    </TiltCard>
  );
};

// === Projects Overview ===
const ProjectsOverviewPanel = () => {
  const items = [
    { label: 'En curso',  n: 14, color: '#f7984a' },
    { label: 'Cerrados',  n: 32, color: '#6b5fff' },
    { label: 'Sin iniciar', n: 54, color: '#bcc6e3' },
  ];
  const total = useCountUp(100, { duration: 1200, delay: 400 });
  return (
    <TiltCard style={{ padding: 22 }}>
      <div className="card-title">
        <h3>Etapas del pipeline</h3>
        <button className="more-btn"><Icon name="more" size={16}/></button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div style={{ position: 'relative', width: 150, height: 150, flexShrink: 0 }}>
          <AnimatedDonut items={items}/>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map((it, i) => {
            const n = useCountUp(it.n, { duration: 1200, delay: 300 + i*150 });
            return (
              <div key={it.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: it.color, marginTop: 5 }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>{it.label}</div>
                  <div className="tnum" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-0)', letterSpacing: '-0.02em' }}>{n}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 14, borderTop: '1px solid rgba(13,20,36,0.05)' }}>
        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>Total deals</span>
        <span className="tnum" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{total}</span>
      </div>
    </TiltCard>
  );
};

// === Task Completion ===
const TaskCompletionPanel = () => {
  const pct = useCountUp(68.4, { duration: 1400, decimals: 1, delay: 200 });
  const c1 = useCountUp(1258, { duration: 1300, delay: 400 });
  const c2 = useCountUp(632,  { duration: 1300, delay: 500 });
  const c3 = useCountUp(410,  { duration: 1300, delay: 600 });
  return (
    <TiltCard style={{ padding: 22, display: 'flex', flexDirection: 'column' }}>
      <div className="card-title">
        <h3>Tareas completadas</h3>
        <button className="more-btn"><Icon name="more" size={16}/></button>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span className="tnum" style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em' }}>{pct.toFixed(1)}%</span>
        <span className="delta up"><Icon name="triUp" size={10}/>6.1%</span>
      </div>
      <div className="label-sm" style={{ marginTop: 2 }}>vs mes anterior</div>

      <div style={{ marginTop: 18, height: 12, borderRadius: 999, background: 'rgba(13,20,36,0.05)', overflow: 'hidden', display: 'flex' }}>
        <div style={{ width: '50%', background: 'linear-gradient(90deg, #6b5fff, #9088ff)', animation: 'growBar 1.2s cubic-bezier(.2,.7,.2,1) 200ms backwards', transformOrigin: 'left' }}/>
        <div style={{ width: '25%', background: 'linear-gradient(90deg, #9088ff, #b8a7ff)', animation: 'growBar 1.2s cubic-bezier(.2,.7,.2,1) 400ms backwards', transformOrigin: 'left' }}/>
        <div style={{ width: '16%', background: 'linear-gradient(90deg, #b8a7ff, #d4c8ff)', animation: 'growBar 1.2s cubic-bezier(.2,.7,.2,1) 600ms backwards', transformOrigin: 'left' }}/>
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 22, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-3)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#6b5fff' }}/> Completadas
          </div>
          <div className="tnum" style={{ fontSize: 20, fontWeight: 700, marginTop: 4, letterSpacing: '-0.02em' }}>{c1.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-3)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#9088ff' }}/> En curso
          </div>
          <div className="tnum" style={{ fontSize: 20, fontWeight: 700, marginTop: 4, letterSpacing: '-0.02em' }}>{c2}</div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-3)' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#d4c8ff' }}/> Sin iniciar
          </div>
          <div className="tnum" style={{ fontSize: 20, fontWeight: 700, marginTop: 4, letterSpacing: '-0.02em' }}>{c3}</div>
        </div>
      </div>
    </TiltCard>
  );
};

// === Right column blocks ===
const DateRangeRow = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
    <button className="dropdown-chip">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <Icon name="calendar" size={14} style={{ color: 'var(--ink-2)' }}/>
        1 – 18 de mayo
      </span>
      <Icon name="chevronDown" size={14} style={{ color: 'var(--ink-3)' }}/>
    </button>
    <button className="dropdown-chip">
      <span>Todas las cuentas</span>
      <Icon name="chevronDown" size={14} style={{ color: 'var(--ink-3)' }}/>
    </button>
  </div>
);

const MeetingsPanel = () => {
  const meetings = [
    { title: 'Descubrimiento Velmont', time: '18:45 – 19:30', extra: 3,
      avatars: [
        { initials: 'KL', bg: 'linear-gradient(135deg,#f7984a,#ee6a8e)' },
        { initials: 'TM', bg: 'linear-gradient(135deg,#6b5fff,#5b8cff)' },
        { initials: 'JR', bg: 'linear-gradient(135deg,#34c77d,#5b8cff)' },
      ] },
    { title: 'Revisión Q · Helios', time: '20:00 – 20:45', extra: 2,
      avatars: [
        { initials: 'AS', bg: 'linear-gradient(135deg,#ee6a8e,#9088ff)' },
        { initials: 'LR', bg: 'linear-gradient(135deg,#5b8cff,#8eb0ff)' },
        { initials: 'BD', bg: 'linear-gradient(135deg,#f4c948,#f7984a)' },
      ] },
  ];
  return (
    <TiltCard style={{ padding: 22 }} tilt={3}>
      <div className="card-title">
        <h3>Mis reuniones</h3>
        <a style={{ fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
          Ver todas <Icon name="arrowRight" size={11}/>
        </a>
      </div>
      {meetings.map((m, i) => (
        <div key={i} className="meeting-row">
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-0)' }}>{m.title}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{m.time.split(' – ')[0]}</span>
              <span style={{ color: 'var(--ink-4)' }}>– {m.time.split(' – ')[1]}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div className="ava-stack">
              {m.avatars.map((a, idx) => (
                <div key={idx} className="a" style={{ background: a.bg }}>{a.initials}</div>
              ))}
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>+{m.extra}</span>
          </div>
        </div>
      ))}
    </TiltCard>
  );
};

// === AI Assistant with live typing ===
const AIAssistantPanel = () => {
  const [reply, setReply] = React.useState('');
  const [typing, setTyping] = React.useState(true);

  const fullReply = "El pipeline de Velmont aceleró 340% esta semana. ¿Querés que prepare una propuesta?";

  React.useEffect(() => {
    let cancelled = false;
    // Show typing dots, then type out
    setTimeout(() => {
      if (cancelled) return;
      setTyping(false);
      let i = 0;
      const interval = setInterval(() => {
        if (cancelled) { clearInterval(interval); return; }
        i++;
        setReply(fullReply.slice(0, i));
        if (i >= fullReply.length) clearInterval(interval);
      }, 22);
    }, 2200);
    return () => { cancelled = true; };
  }, []);

  return (
    <TiltCard style={{ padding: 22 }} tilt={3}>
      <div className="card-title">
        <h3><Icon name="sparkle" size={15} style={{ color: 'var(--purple)' }}/> Asistente IA</h3>
        <button className="more-btn"><Icon name="arrowUpRight" size={15}/></button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* User question */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, justifyContent: 'flex-end' }}>
          <div className="chat-bubble user">¿Qué deal debería priorizar hoy?</div>
          <Avatar initials="AF" bg="linear-gradient(135deg,#f7984a,#ee6a8e)" size={28}/>
        </div>

        {/* Bot reply with typing */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #6b5fff, #5b8cff)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
            <Icon name="sparkle" size={14}/>
          </div>
          <div className="chat-bubble bot" style={{ minHeight: 36 }}>
            {typing ? (
              <span className="typing-dots"><span/><span/><span/></span>
            ) : (
              <>
                {reply}
                {reply.length < fullReply.length && <span style={{ display: 'inline-block', width: 1.5, height: 14, marginLeft: 2, background: 'var(--ink-2)', animation: 'liveRing 1s ease-in-out infinite', transform: 'translateY(2px)' }}/>}
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="iconbtn" style={{ width: 38, height: 38, borderRadius: 12 }}><Icon name="plus" size={16}/></button>
        <div style={{ position: 'relative', flex: 1 }}>
          <input placeholder="Preguntá lo que quieras…" style={{
            width: '100%', padding: '10px 46px 10px 14px',
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(255,255,255,0.9)',
            borderRadius: 12, outline: 'none',
            fontSize: 13, fontFamily: 'var(--font)', color: 'var(--ink-0)',
          }}/>
          <button style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer',
            background: '#0d1424', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="send" size={14}/>
          </button>
        </div>
      </div>
    </TiltCard>
  );
};

const QuickActionsPanel = () => {
  const actions = [
    { icon: 'invoiceDoc', label: 'Nuevo deal',    tint: 'rgba(107,95,255,0.13)', color: '#6b5fff' },
    { icon: 'dollar',     label: 'Agregar contacto', tint: 'rgba(247,152,74,0.13)', color: '#f7984a' },
    { icon: 'tasks',      label: 'Nueva tarea',    tint: 'rgba(52,199,125,0.13)', color: '#34c77d' },
    { icon: 'upload',     label: 'Subir archivo',  tint: 'rgba(91,140,255,0.13)', color: '#5b8cff' },
  ];
  return (
    <TiltCard style={{ padding: 22 }} tilt={3}>
      <div className="card-title">
        <h3>Acciones rápidas</h3>
        <button className="more-btn"><Icon name="edit" size={14}/></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {actions.map(a => (
          <button key={a.label} className="quick-btn">
            <div className="quick-icon" style={{ background: a.tint, color: a.color }}>
              <Icon name={a.icon} size={17}/>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-0)' }}>{a.label}</div>
          </button>
        ))}
      </div>
    </TiltCard>
  );
};

const RecentTransactionsPanel = () => {
  const rows = [
    { name: 'Velmont SA',        date: '17 may', amount: +48200, positive: true,  icon: 'V', bg: 'linear-gradient(135deg,#34c77d,#5b8cff)' },
    { name: 'Helios Industries', date: '16 may', amount: +24800, positive: true,  icon: 'H', bg: 'linear-gradient(135deg,#6b5fff,#9088ff)' },
    { name: 'NorthBridge',       date: '15 may', amount: -1200,  positive: false, icon: 'N', bg: '#ef5d6a' },
    { name: 'Tessera Group',     date: '14 may', amount: +18750, positive: true,  icon: 'T', bg: 'linear-gradient(135deg,#5b8cff,#8eb0ff)' },
    { name: 'Polaris Cloud',     date: '12 may', amount: -350,   positive: false, icon: 'P', bg: '#f7984a' },
  ];
  const fmt = n => (n >= 0 ? '+ ' : '- ') + '$' + Math.abs(n).toLocaleString();
  return (
    <TiltCard style={{ padding: 22 }} tilt={3}>
      <div className="card-title">
        <h3>Deals recientes</h3>
        <a style={{ fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
          Ver todos <Icon name="arrowRight" size={11}/>
        </a>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="tx-row">
          <div className="tx-icon" style={{ background: r.bg }}>{r.icon}</div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink-0)' }}>{r.name}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.date}</div>
          <div className="tnum" style={{ fontSize: 13.5, fontWeight: 600, color: r.positive ? '#1a8e5a' : 'var(--ink-1)' }}>{fmt(r.amount)}</div>
        </div>
      ))}
    </TiltCard>
  );
};

const InvoiceOverviewPanel = () => {
  const rows = [
    { label: 'Vencidas',  color: '#6b5fff', pct: 30, count: 5,  amount: '$183.005' },
    { label: 'Sin pagar', color: '#ef5d6a', pct: 30, count: 5,  amount: '$183.005' },
    { label: 'Parciales', color: '#f7984a', pct: 25, count: 8,  amount: '$96.430'  },
    { label: 'Pagadas',   color: '#34c77d', pct: 60, count: 32, amount: '$420.250' },
  ];
  return (
    <TiltCard style={{ padding: 22 }} tilt={3}>
      <div className="card-title">
        <h3>Estado de facturas</h3>
        <a style={{ fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
          Ver todo <Icon name="arrowRight" size={11}/>
        </a>
      </div>
      {rows.map((r, i) => (
        <div key={r.label} className="inv-row">
          <div style={{ fontSize: 13, color: 'var(--ink-1)', fontWeight: 500 }}>{r.label}</div>
          <div className="inv-bar">
            <div style={{
              width: `${r.pct*1.6}%`, background: r.color,
              animation: `growBar 1.2s cubic-bezier(.2,.7,.2,1) ${300 + i*100}ms backwards`,
              transformOrigin: 'left',
            }}/>
          </div>
          <div className="tnum mono" style={{ fontSize: 12, color: 'var(--ink-2)', textAlign: 'right' }}>{r.count}</div>
          <div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-0)', textAlign: 'right' }}>{r.amount}</div>
        </div>
      ))}
    </TiltCard>
  );
};

Object.assign(window, {
  Sidebar, Topbar, Hero,
  RevenuePanel, ActiveClientsPanel, EfficiencyPanel,
  IncomeExpensePanel, ProjectsOverviewPanel, TaskCompletionPanel,
  RecentTransactionsPanel, InvoiceOverviewPanel,
  DateRangeRow, MeetingsPanel, AIAssistantPanel, QuickActionsPanel,
});
