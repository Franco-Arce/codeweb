import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Film, Gamepad2, Tv, LayoutDashboard, Settings } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = React.useState('dashboard');

  return (
    <div className="min-h-screen bg-codeflow-dark relative flex overflow-hidden">
      {/* Background Animated Blobs for premium effect */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-codeflow-accent/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] bg-fuchsia-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] bg-purple-800/20 rounded-full mix-blend-screen filter blur-[120px] animate-blob animation-delay-4000" />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik00MCAwaC0xTDBWMGgxbDM5LS4wMVoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz4KPC9zdmc+')] opacity-20" />
      </div>

      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-white/5 bg-codeflow-base/80 backdrop-blur-3xl z-10 flex flex-col h-screen">
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-codeflow-accent to-fuchsia-600 flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)]">
            <span className="font-display font-bold text-xl text-white">CF</span>
          </div>
          <h1 className="font-display font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            F1 Friends
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-codeflow-muted tracking-wider uppercase">Prode</div>
          <NavItem icon={<Trophy size={20} />} label="F1 Oracle & Prode" active={activeTab === 'f1'} onClick={() => setActiveTab('f1')} />
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-codeflow-muted tracking-wider uppercase">Media Vault</div>
          <NavItem icon={<Tv size={20} />} label="Series" active={activeTab === 'series'} onClick={() => setActiveTab('series')} />
          <NavItem icon={<Film size={20} />} label="Movies" active={activeTab === 'movies'} onClick={() => setActiveTab('movies')} />
          <NavItem icon={<Gamepad2 size={20} />} label="Board Games" active={activeTab === 'games'} onClick={() => setActiveTab('games')} />
        </nav>

        <div className="p-4 border-t border-white/5">
          <button className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-codeflow-muted hover:text-white hover:bg-white/5 transition-colors">
            <Settings size={20} />
            <span className="font-medium">Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-screen overflow-y-auto relative z-10 p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'f1' && <F1ProdeView />}
            {['series', 'movies', 'games'].includes(activeTab) && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <h2 className="text-3xl font-display font-bold text-white mb-2 capitalize">{activeTab} Vault</h2>
                  <p className="text-codeflow-muted">Content module under construction...</p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-3 w-full rounded-xl transition-all duration-300 relative group overflow-hidden ${active ? 'text-white' : 'text-codeflow-muted hover:text-white'
        }`}
    >
      {active && (
        <motion.div
          layoutId="activeTab"
          className="absolute inset-0 bg-codeflow-accent/10 border border-codeflow-accent/20 rounded-xl"
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      <div className="relative z-10 flex items-center gap-3">
        <span className={`${active ? 'text-codeflow-accent drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'group-hover:text-white transition-colors'}`}>
          {icon}
        </span>
        <span className="font-medium">{label}</span>
      </div>
    </button>
  );
}

function DashboardView() {
  const [leaderboard, setLeaderboard] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch('http://localhost:3001/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        setLeaderboard(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load leaderboard", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <header>
        <h1 className="text-4xl font-display font-bold text-white mb-2">Welcome Back! <span className="text-codeflow-accent">🏎️</span></h1>
        <p className="text-codeflow-muted text-lg">Your combined hub for F1 predictions and shared recommendations.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Next Race Card */}
        <div className="glass-card p-6 md:col-span-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-codeflow-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div>
              <span className="px-3 py-1 rounded-full bg-codeflow-accent/20 text-codeflow-accent text-sm font-semibold border border-codeflow-accent/30 mb-4 inline-block">Next Race</span>
              <h2 className="text-2xl font-display font-bold text-white">Australian Grand Prix</h2>
              <p className="text-codeflow-muted mt-1">Albert Park Circuit, Melbourne</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold font-display text-white">04 : 12 : 35</div>
              <p className="text-codeflow-muted text-sm">Days : Hrs : Mins</p>
            </div>
          </div>

          <div className="relative z-10">
            <button className="btn-primary w-full md:w-auto">
              Submit Predictions
            </button>
          </div>
        </div>

        {/* Prode Leaderboard Snapshot */}
        <div className="glass-card p-6 relative flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy size={18} className="text-yellow-500" /> Top Analysts
          </h3>
          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {loading ? (
              <div className="text-center text-codeflow-muted text-sm animate-pulse flex flex-col items-center gap-2 py-4">
                <div className="w-6 h-6 border-2 border-codeflow-accent border-t-transparent rounded-full animate-spin"></div>
                Loading Live Scores...
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-sm text-codeflow-muted text-center my-auto">No scores available yet.</p>
            ) : (
              leaderboard.slice(0, 3).map((user: any, i: number) => (
                <div key={user.name} className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border border-transparent hover:border-white/10">
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${i === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-white/10 text-white/70'}`}>
                      {i + 1}
                    </div>
                    <span className="font-medium text-white">{user.name}</span>
                  </div>
                  <span className="font-display font-bold text-codeflow-accent">{user.pts} pts</span>
                </div>
              ))
            )}
          </div>
          <button className="text-sm text-codeflow-muted hover:text-white mt-auto transition-colors pt-4">View full standings →</button>
        </div>
      </div>
    </div>
  );
}

function F1ProdeView() {
  const [oracleInsight, setOracleInsight] = React.useState<string | null>(null);
  const [loadingOracle, setLoadingOracle] = React.useState(false);

  React.useEffect(() => {
    setLoadingOracle(true);
    fetch('http://localhost:3001/api/oracle/roast')
      .then(res => res.json())
      .then(data => {
        setOracleInsight(data.analysis);
        setLoadingOracle(false);
      })
      .catch(err => {
        console.error("Failed to load Oracle roast", err);
        setOracleInsight("El oráculo tuvo una falla en el motor. Intenta recargar la página.");
        setLoadingOracle(false);
      });
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">F1 Oracle & Prode</h1>
          <p className="text-codeflow-muted text-lg">AI-powered insights, predictions, and real-time standings.</p>
        </div>
        <button className="btn-secondary">
          Rules & Scoring
        </button>
      </header>

      {/* Claude Oracle Section */}
      <div className="glass-card p-1 pb-6 relative overflow-hidden min-h-[140px]">
        {/* Fancy border effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-codeflow-accent via-fuchsia-600 to-purple-800 opacity-20" />
        <div className="m-5 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-blue-600 p-[1px] shadow-lg shadow-purple-500/20 shrink-0">
              <div className="w-full h-full bg-codeflow-card rounded-xl flex items-center justify-center">
                <span className="text-2xl">🤖</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-lg text-white">The Oracle (Groq)</h3>
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold mr-auto">AI Analysis</span>
              </div>

              {loadingOracle ? (
                <div className="text-codeflow-muted text-sm animate-pulse flex items-center gap-3 py-2">
                  <div className="w-4 h-4 border-2 border-codeflow-accent border-t-transparent rounded-full animate-spin"></div>
                  Generating roasting parameters...
                </div>
              ) : (
                <p className="text-codeflow-text/90 leading-relaxed italic border-l-2 border-codeflow-accent/40 pl-4 py-1 whitespace-pre-wrap">
                  "{oracleInsight}"
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Prediction Forms and Leaderboard sections will go here */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6 min-h-[400px] flex items-center justify-center">
          <div className="text-center">
            <Trophy size={48} className="mx-auto text-codeflow-muted mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-white mb-2">Submit Your Predictions</h3>
            <p className="text-codeflow-muted mb-6">Select Winner, Best Team, and your Top 5 drivers.</p>
            <button className="btn-primary">Open Prediction Form</button>
          </div>
        </div>
        <div className="glass-card p-6 min-h-[400px]">
          <h3 className="text-xl font-bold text-white mb-4">Live Prode Standings</h3>
          <p className="text-codeflow-muted italic text-sm mb-6">Positions will update automatically after the checkered flag.</p>
          {/* Mockup empty state */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 w-full bg-white/5 rounded-lg border border-white/5 flex items-center px-4 animate-pulse">
                <div className="w-6 h-6 rounded bg-white/10 mr-4" />
                <div className="h-4 w-32 bg-white/10 rounded mr-auto" />
                <div className="h-4 w-12 bg-codeflow-accent/20 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
