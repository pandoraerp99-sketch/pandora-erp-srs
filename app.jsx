const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "purple",
  "sky": "dawn"
}/*EDITMODE-END*/;

const ACCENTS = {
  purple: { a: '#6b5fff', b: '#9088ff' },
  blue:   { a: '#5b8cff', b: '#8eb0ff' },
  teal:   { a: '#1ea8a0', b: '#5fd5cc' },
};

const SKIES = {
  dawn: [
    'radial-gradient(ellipse 60% 50% at 20% 90%, rgba(238, 200, 220, 0.55) 0%, transparent 60%)',
    'radial-gradient(ellipse 70% 60% at 85% 80%, rgba(240, 210, 180, 0.40) 0%, transparent 60%)',
    'radial-gradient(ellipse 50% 40% at 60% 30%, rgba(255, 255, 255, 0.6) 0%, transparent 50%)',
    'radial-gradient(ellipse 50% 40% at 15% 30%, rgba(195, 215, 245, 0.6) 0%, transparent 60%)',
    'linear-gradient(180deg, #b8c8e8 0%, #c8d4ea 25%, #e0d4e0 60%, #f0d8d2 100%)',
  ].join(', '),
  noon: [
    'radial-gradient(ellipse 50% 40% at 50% 30%, rgba(255, 255, 255, 0.7) 0%, transparent 50%)',
    'radial-gradient(ellipse 60% 50% at 20% 90%, rgba(220, 240, 255, 0.55) 0%, transparent 60%)',
    'linear-gradient(180deg, #a8c0e8 0%, #c4d8ef 60%, #e8eef8 100%)',
  ].join(', '),
  dusk: [
    'radial-gradient(ellipse 60% 50% at 80% 90%, rgba(255, 180, 130, 0.55) 0%, transparent 60%)',
    'radial-gradient(ellipse 70% 60% at 20% 70%, rgba(220, 140, 180, 0.45) 0%, transparent 60%)',
    'linear-gradient(180deg, #9aa8d0 0%, #b8a8c8 40%, #e0b8a8 80%, #f0c8a8 100%)',
  ].join(', '),
};

const App = () => {
  const [active, setActive] = React.useState('dashboard');
  const [period, setPeriod] = React.useState('month');
  const [t, setTweak] = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];

  React.useEffect(() => {
    const acc = ACCENTS[t.accent] || ACCENTS.purple;
    document.documentElement.style.setProperty('--purple', acc.a);
    document.documentElement.style.setProperty('--purple-2', acc.b);
    document.documentElement.style.setProperty('--purple-soft', `${acc.a}1a`);

    // Sky background
    document.body.style.background = SKIES[t.sky] || SKIES.dawn;
  }, [t.accent, t.sky]);

  const user = { firstName: 'Alberto', name: 'Alberto Flores', role: 'Gerente', initials: 'AF' };

  return (
    <div>
      <ParallaxSky/>
      <Sidebar active={active} setActive={setActive}/>
      <main style={{ marginLeft: 240, marginRight: 16, padding: '16px 0 24px', minWidth: 1180 }}>
        <Topbar period={period} setPeriod={setPeriod} user={user}/>

        <div style={{ display: 'flex', gap: 16 }} className="stagger">
          {/* LEFT — main content */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Hero user={user}/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <RevenuePanel/>
              <ActiveClientsPanel/>
              <EfficiencyPanel/>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 16 }}>
              <IncomeExpensePanel/>
              <ProjectsOverviewPanel/>
              <TaskCompletionPanel/>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16 }}>
              <RecentTransactionsPanel/>
              <InvoiceOverviewPanel/>
            </div>
          </div>

          {/* RIGHT — sidebar widgets */}
          <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <DateRangeRow/>
            <MeetingsPanel/>
            <AIAssistantPanel/>
            <QuickActionsPanel/>
          </div>
        </div>
      </main>

      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Accent">
            <window.TweakRadio
              label="Color"
              value={t.accent}
              options={['purple','blue','teal']}
              onChange={v => setTweak('accent', v)}
            />
          </window.TweakSection>
          <window.TweakSection label="Sky">
            <window.TweakRadio
              label="Mood"
              value={t.sky}
              options={['dawn','noon','dusk']}
              onChange={v => setTweak('sky', v)}
            />
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
