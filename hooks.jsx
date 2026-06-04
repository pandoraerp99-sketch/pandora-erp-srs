// === Hooks & helpers ===

// Animated counter using requestAnimationFrame
const useCountUp = (target, { duration = 1400, decimals = 0, delay = 0 } = {}) => {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    let raf;
    const start = performance.now() + delay;
    const tick = (now) => {
      if (now < start) { raf = requestAnimationFrame(tick); return; }
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, delay]);
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
};

// Live ticker — adds tiny random amounts every second
const useLiveTicker = (initial, increment = 0.5) => {
  const [v, setV] = React.useState(initial);
  React.useEffect(() => {
    const id = setInterval(() => {
      setV(prev => prev + Math.random() * increment);
    }, 1800);
    return () => clearInterval(id);
  }, []);
  return v;
};

// 3D tilt on mouse move
const use3DTilt = (max = 6) => {
  const ref = React.useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const rx = (0.5 - py) * max;
    const ry = (px - 0.5) * max;
    el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = 'perspective(900px) rotateX(0) rotateY(0)';
  };
  return { ref, onMouseMove: onMove, onMouseLeave: onLeave };
};

// Card wrapper with tilt + sheen
const TiltCard = ({ children, className = '', style = {}, tilt = 4, ...props }) => {
  const t = use3DTilt(tilt);
  return (
    <div ref={t.ref} onMouseMove={t.onMouseMove} onMouseLeave={t.onMouseLeave}
      className={`glass tiltable ${className}`} style={style} {...props}>
      <div className="sheen"/>
      <div className="tilt-inner">{children}</div>
    </div>
  );
};

// Format currency
const fmt$ = (n, decimals = 2) => '$' + n.toLocaleString('en-US', {
  minimumFractionDigits: decimals,
  maximumFractionDigits: decimals,
});

// === Parallax background ===
const ParallaxSky = () => {
  React.useEffect(() => {
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      const a = document.querySelector('.sky-layer-a');
      const b = document.querySelector('.sky-layer-b');
      if (a) a.style.transform = `translate(${x}px, ${y}px)`;
      if (b) b.style.transform = `translate(${-x*0.5}px, ${-y*0.5}px)`;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);
  return (
    <>
      <div className="sky-layer sky-layer-a" style={{
        background:
          'radial-gradient(ellipse 400px 80px at 25% 65%, rgba(255,255,255,0.55) 0%, transparent 70%),' +
          'radial-gradient(ellipse 500px 100px at 75% 75%, rgba(255,255,255,0.45) 0%, transparent 70%)',
      }}/>
      <div className="sky-layer sky-layer-b" style={{
        background:
          'radial-gradient(ellipse 300px 60px at 50% 40%, rgba(255,255,255,0.4) 0%, transparent 70%),' +
          'radial-gradient(ellipse 350px 80px at 10% 85%, rgba(255,255,255,0.5) 0%, transparent 70%)',
      }}/>
    </>
  );
};

window.useCountUp = useCountUp;
window.useLiveTicker = useLiveTicker;
window.use3DTilt = use3DTilt;
window.TiltCard = TiltCard;
window.fmt$ = fmt$;
window.ParallaxSky = ParallaxSky;
