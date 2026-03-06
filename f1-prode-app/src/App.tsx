import React, { useState, useCallback, useContext, createContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Film, Gamepad2, Tv, LayoutDashboard, Settings,
  RefreshCw, AlertCircle, CheckCircle, XCircle, Menu, Edit2, Trash2
} from 'lucide-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import logoCodeflow from './assets/LogoOnly.png';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// --- Toast System ---
type Toast = { id: number; type: 'success' | 'error' | 'warning'; message: string };
const ToastContext = createContext<{ addToast: (type: Toast['type'], message: string) => void }>({ addToast: () => { } });
const useToast = () => useContext(ToastContext);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-xl text-sm font-medium ${toast.type === 'success' ? 'bg-green-500/20 border-green-500/40 text-green-300' :
                toast.type === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-300' :
                  'bg-yellow-500/20 border-yellow-500/40 text-yellow-300'
                }`}
            >
              {toast.type === 'success' ? <CheckCircle size={16} /> : toast.type === 'error' ? <XCircle size={16} /> : <AlertCircle size={16} />}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// --- API Helpers ---
const fetchWithAuth = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('prode_auth_token');
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...(options.headers || {})
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('prode_auth_token');
    window.location.reload();
  }
  return res;
};

// --- Main App Component ---
function App() {
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean>(false);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const token = localStorage.getItem('prode_auth_token');
    if (token === 'f1_pepe_logged_in_token') {
      setIsAuthenticated(true);
    } else {
      localStorage.removeItem('prode_auth_token');
    }
    setIsLoading(false);
  }, []);

  if (isLoading) return <div className="min-h-screen bg-codeflow-dark flex items-center justify-center"><div className="w-8 h-8 border-2 border-codeflow-accent border-t-transparent rounded-full animate-spin" /></div>;

  if (!isAuthenticated) {
    return <ToastProvider><LoginView onLogin={() => setIsAuthenticated(true)} /></ToastProvider>;
  }

  return (
    <ToastProvider>
      <AppShell activeTab={activeTab} setActiveTab={setActiveTab} setIsAuthenticated={setIsAuthenticated} />
    </ToastProvider>
  );
}

function AppShell({ activeTab, setActiveTab, setIsAuthenticated }: { activeTab: string; setActiveTab: (t: string) => void; setIsAuthenticated: (v: boolean) => void }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Close menu on navigation for mobile
  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-codeflow-dark relative overflow-hidden">
      {/* Background blobs for depth */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none animate-blob" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none animate-blob [animation-delay:2s]" />

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-codeflow-base/80 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <img src={logoCodeflow} alt="CodeWeb" className="w-8 h-8 object-contain" />
          <span className="font-display font-bold text-lg text-white">CodeWeb</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? <XCircle size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar - Desktop fixed, Mobile hidden/absolute */}
      <aside className={`
        fixed md:sticky top-0 left-0 bottom-0 z-40
        w-64 border-r border-white/5 bg-codeflow-base/80 backdrop-blur-3xl 
        flex flex-col h-screen transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 hidden md:flex items-center gap-3 border-b border-white/5">
          <img src={logoCodeflow} alt="CodeWeb" className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
          <h1 className="font-display font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            CodeWeb
          </h1>
        </div>

        {/* Mobile menu padding top */}
        <div className="md:hidden h-20" />

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <NavItem icon={<LayoutDashboard size={20} />} label="Panel Principal" active={activeTab === 'dashboard'} onClick={() => handleNavClick('dashboard')} />
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-codeflow-muted tracking-wider uppercase">Deportes</div>
          <NavItem icon={<Trophy size={20} />} label="F1" active={activeTab === 'f1'} onClick={() => handleNavClick('f1')} />
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-codeflow-muted tracking-wider uppercase">Bóveda Multimedia</div>
          <NavItem icon={<Tv size={20} />} label="Series" active={activeTab === 'series'} onClick={() => handleNavClick('series')} />
          <NavItem icon={<Tv size={20} />} label="Animes" active={activeTab === 'animes'} onClick={() => handleNavClick('animes')} />
          <NavItem icon={<Film size={20} />} label="Películas" active={activeTab === 'movies'} onClick={() => handleNavClick('movies')} />
          <NavItem icon={<Gamepad2 size={20} />} label="Juegos de Mesa" active={activeTab === 'games'} onClick={() => handleNavClick('games')} />

          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-codeflow-muted tracking-wider uppercase">Admin</div>
          <button onClick={() => handleNavClick('admin')} className={`flex items-center gap-3 px-3 py-2 w-full rounded-lg transition-colors ${activeTab === 'admin' ? 'text-white bg-white/10' : 'text-codeflow-muted hover:text-white hover:bg-white/5'}`}>
            <Settings size={20} />
            <span className="font-medium">Admin Panel</span>
          </button>
        </nav>

        <div className="p-4 border-t border-white/5">
          <button
            onClick={() => {
              localStorage.removeItem('prode_auth_token');
              setIsAuthenticated(false);
            }}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-red-500/70 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <span className="font-medium text-sm">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-codeflow-dark/60 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <main className="flex-1 p-4 md:p-8 relative z-0 overflow-x-hidden md:mt-0 mt-16">
        <ActiveTabContext.Provider value={setActiveTab}>
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
              {activeTab === 'admin' && <AdminView />}
              {['series', 'animes', 'movies', 'games'].includes(activeTab) && (
                <MediaVaultView tab={activeTab} />
              )}
            </motion.div>
          </AnimatePresence>
        </ActiveTabContext.Provider>
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

// --- Login View Component ---
function LoginView({ onLogin }: { onLogin: () => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: user, password: pass })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('prode_auth_token', data.token); // Guardamos JWT o Token real
        onLogin();
      } else {
        setError(data.message || 'Error: Credenciales inválidas');
      }
    } catch (err) {
      console.error(err);
      setError('Error al comunicar con la base central.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-codeflow-dark relative flex items-center justify-center p-4">
      {/* Background Animated Blobs for premium effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-codeflow-accent/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-600/20 rounded-full mix-blend-screen filter blur-[120px] animate-blob" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik00MCAwaC0xTDBWMGgxbDM5LS4wMVoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz4KPC9zdmc+')] opacity-20" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-10 max-w-md w-full relative z-10 flex flex-col items-center border border-white/10 shadow-2xl"
      >
        <img src={logoCodeflow} alt="CodeWeb" className="w-20 h-20 mb-6 object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]" />

        <h1 className="text-3xl font-display font-bold text-white mb-2">Acceso a CodeWeb</h1>
        <p className="text-codeflow-muted mb-8 text-center">Plataforma Central</p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <input
              type="text"
              placeholder="Usuario Maestro"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-codeflow-accent transition-colors"
              value={user}
              onChange={(e) => { setUser(e.target.value); setError(''); }}
              required
            />
          </div>
          <div>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Contraseña"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-codeflow-accent transition-colors"
              value={pass}
              onChange={(e) => { setPass(e.target.value); setError(''); }}
              required
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-red-400 text-sm font-medium text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-codeflow-accent to-fuchsia-600 hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.3)] mt-4 disabled:opacity-50 flex justify-center items-center h-[52px]"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : "Ingresar"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function DashboardView() {
  const [leaderboard, setLeaderboard] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [nextRace, setNextRace] = React.useState<any>(null);
  const [predictions, setPredictions] = React.useState<any[]>([]);
  const [countdown, setCountdown] = React.useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const setActiveTab = React.useContext(ActiveTabContext);

  React.useEffect(() => {
    Promise.all([
      fetchWithAuth('/api/leaderboard').then(r => r.json()),
      fetchWithAuth('/api/races/next').then(r => r.json()),
      fetchWithAuth('/api/predictions').then(r => r.json()),
    ]).then(([lb, race, preds]) => {
      setLeaderboard(lb);
      setNextRace(race);
      setPredictions(preds);
      setLoading(false);
    }).catch(err => { console.error(err); setLoading(false); });
  }, []);

  React.useEffect(() => {
    if (!nextRace) return;
    const tick = () => {
      const diff = Math.max(0, new Date(nextRace.date).getTime() - Date.now());
      setCountdown({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRace]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const leader = leaderboard[0];
  const playersWithPrediction = new Set(predictions.map((p: any) => p.player));

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <header>
        <h1 className="text-4xl font-display font-bold text-white mb-1">Panel Principal <span className="text-codeflow-accent">🚀</span></h1>
        <p className="text-codeflow-muted">Tu plataforma centralizada para deportes, métricas y entretenimiento.</p>
      </header>

      {/* ===== HERO FULL-WIDTH COUNTDOWN ===== */}
      <div className="relative overflow-hidden rounded-2xl border border-codeflow-accent/20 bg-gradient-to-br from-codeflow-accent/10 via-purple-900/10 to-codeflow-dark p-8 shadow-[0_0_80px_rgba(168,85,247,0.08)]">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-red-600/10 to-transparent pointer-events-none" />
        <div className="absolute -bottom-8 -right-8 text-[12rem] leading-none opacity-5 pointer-events-none select-none">🏎️</div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/30 uppercase tracking-wider mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Siguiente Carrera
            </span>
            {loading || !nextRace ? (
              <div className="space-y-2">
                <div className="h-8 w-72 bg-white/5 rounded-lg animate-pulse" />
                <div className="h-4 w-48 bg-white/5 rounded-lg animate-pulse" />
              </div>
            ) : (
              <>
                <h2 className="text-3xl font-display font-bold text-white mb-1">{nextRace.name}</h2>
                <p className="text-codeflow-muted">{nextRace.circuit} · {nextRace.city}</p>
                {nextRace.sprint && (
                  <span className="mt-2 inline-block text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                    🏃 Fin de Semana Sprint
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col items-center md:items-end gap-4">
            {/* Big Countdown */}
            <div className="flex items-end gap-2 md:gap-4">
              {[
                { v: countdown.days, l: 'Días' },
                { v: countdown.hours, l: 'Hrs' },
                { v: countdown.minutes, l: 'Min' },
                { v: countdown.seconds, l: 'Seg' },
              ].map((unit, i) => (
                <React.Fragment key={unit.l}>
                  {i > 0 && <span className="text-2xl text-white/30 font-bold mb-4">:</span>}
                  <div className="flex flex-col items-center">
                    <span className="text-4xl md:text-5xl font-display font-extrabold text-white tabular-nums leading-none">
                      {pad(unit.v)}
                    </span>
                    <span className="text-[10px] text-codeflow-muted uppercase tracking-widest mt-1">{unit.l}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => setActiveTab('f1')}
              className="w-full md:w-auto bg-gradient-to-r from-codeflow-accent to-fuchsia-600 hover:opacity-90 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] text-sm tracking-wide"
            >
              🏁 Cargar mi Pronóstico
            </button>
          </div>
        </div>
      </div>

      {/* ===== FULL LEADERBOARD ===== */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Trophy size={20} className="text-yellow-500" /> Tabla de Analistas
          </h3>
          <span className="text-xs text-codeflow-muted italic">
            {nextRace ? `Pronósticos para ${nextRace.name}` : ''}
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 w-full bg-white/5 rounded-xl border border-white/5 flex items-center px-5 gap-4 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-white/10" />
                <div className="h-4 w-36 bg-white/10 rounded" />
                <div className="ml-auto flex gap-3">
                  <div className="h-6 w-16 bg-white/10 rounded-full" />
                  <div className="h-6 w-20 bg-codeflow-accent/10 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <p className="text-codeflow-muted text-center py-10">Nadie tiene puntos todavía. ¡El campeonato está abierto!</p>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((user: any, i: number) => {
              const gapToLeader = leader && i > 0 ? leader.pts - user.pts : 0;
              const hasSubmitted = playersWithPrediction.has(user.name);
              const medalStyle = i === 0
                ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 shadow-yellow-500/10'
                : i === 1 ? 'bg-gray-400/20 text-gray-300 border-gray-400/50'
                  : i === 2 ? 'bg-orange-600/20 text-orange-400 border-orange-600/50'
                    : 'bg-white/5 text-white/40 border-white/10';

              return (
                <motion.div
                  key={user.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all hover:bg-white/5 ${i === 0 ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-white/[0.02] border-white/5'}`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border shadow-sm ${medalStyle}`}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-white block truncate">{user.name}</span>
                    {i > 0 && (
                      <span className="text-xs text-red-400/70">-{gapToLeader} pts del líder</span>
                    )}
                    {i === 0 && <span className="text-xs text-yellow-400/70">Líder del campeonato</span>}
                  </div>

                  {/* Prediction submitted badge */}
                  <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${hasSubmitted ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-orange-500/10 text-orange-400 border-orange-500/30'}`}>
                    {hasSubmitted ? <><CheckCircle size={10} /> SÍ</> : <><AlertCircle size={10} /> PENDIENTE</>}
                  </div>

                  <span className="font-display font-extrabold text-xl text-white tabular-nums">
                    {user.pts} <span className="text-xs font-normal text-codeflow-muted">PTS</span>
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== SCORE HISTORY CHART ===== */}
      <ScoreHistoryChart />
    </div>
  );
}

// --- Score History Chart ---
const PLAYER_COLORS = [
  '#a855f7', '#f59e0b', '#3b82f6', '#10b981', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16',
];

function ScoreHistoryChart() {
  const [history, setHistory] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchWithAuth('/api/leaderboard/history')
      .then(r => r.json())
      .then(data => { setHistory(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6">
        <div className="h-4 w-48 bg-white/5 rounded animate-pulse mb-6" />
        <div className="h-64 w-full bg-white/5 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-codeflow-muted text-sm">📊 El gráfico de historial aparecerá aquí cuando se procesen los primeros resultados del campeonato.</p>
      </div>
    );
  }

  // Build dataset: collect all players
  const allPlayers = Array.from(new Set(history.flatMap(r => Object.keys(r.scores))));
  const labels = history.map(r => r.race_name);

  const datasets = allPlayers.map((player, i) => ({
    label: player,
    data: history.map(r => r.scores[player] ?? 0),
    borderColor: PLAYER_COLORS[i % PLAYER_COLORS.length],
    backgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length] + '20',
    pointBackgroundColor: PLAYER_COLORS[i % PLAYER_COLORS.length],
    pointRadius: 5,
    pointHoverRadius: 8,
    tension: 0.3,
    fill: false,
  }));

  const chartData = { labels, datasets };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'rgba(255,255,255,0.7)',
          font: { size: 12, family: 'Inter' },
          boxWidth: 12,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15,10,30,0.95)',
        borderColor: 'rgba(168,85,247,0.3)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: 'rgba(255,255,255,0.8)',
        callbacks: {
          label: (ctx: any) => `  ${ctx.dataset.label}: ${ctx.raw} pts`,
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } },
        beginAtZero: true,
        title: { display: true, text: 'Puntos obtenidos', color: 'rgba(255,255,255,0.4)', font: { size: 11 } },
      },
    },
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          📊 Historial de Puntos por Carrera
        </h3>
        <span className="text-xs text-codeflow-muted italic">{history.length} {history.length === 1 ? 'carrera procesada' : 'carreras procesadas'}</span>
      </div>
      <div className="h-72">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}

// Context for navigating from Dashboard CTA
const ActiveTabContext = React.createContext<(tab: string) => void>(() => { });

function F1ProdeView() {
  const [f1Tab, setF1Tab] = React.useState('prode'); // 'prode', 'leaderboard', 'calendar'

  const [oracleInsight, setOracleInsight] = React.useState<string | null>(null);
  const [loadingOracle, setLoadingOracle] = React.useState(false);
  const [nextRace, setNextRace] = React.useState<any>(null);

  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Form State
  const [pName, setPName] = React.useState('');
  const [pPole, setPPole] = React.useState('');
  const [p1, setP1] = React.useState('');
  const [p2, setP2] = React.useState('');
  const [p3, setP3] = React.useState('');
  const [p4, setP4] = React.useState('');
  const [p5, setP5] = React.useState('');

  // --- Session & Schedule ---
  type SessionType = 'qualifying' | 'sprint_qualifying' | 'sprint' | 'race';
  const [schedule, setSchedule] = React.useState<any>(null);
  const [selectedSession, setSelectedSession] = React.useState<SessionType>('race');
  const selectedSessionData = schedule?.sessions?.find((s: any) => s.type === selectedSession);

  // --- Constantes y Estados Dinámicos ---
  const USERS = ["MrKazter", "Eliana", "NestorMcNestor", "GuilleGb", "Rubiola", "Colorado", "MrFori"];
  const [DRIVERS, setDRIVERS] = React.useState<string[]>([
    "Max Verstappen", "Lando Norris", "Charles Leclerc", "Carlos Sainz", "Oscar Piastri",
    "Lewis Hamilton", "George Russell", "Fernando Alonso", "Lance Stroll", "Yuki Tsunoda",
    "Liam Lawson", "Nico Hülkenberg", "Esteban Ocon", "Pierre Gasly", "Jack Doohan",
    "Alexander Albon", "Franco Colapinto", "Oliver Bearman", "Andrea Kimi Antonelli", "Gabriel Bortoleto"
  ]);

  const { addToast } = useToast();
  const [existingPrediction, setExistingPrediction] = React.useState<any>(null);

  React.useEffect(() => {
    fetchWithAuth('/api/races/next')
      .then(res => res.json())
      .then(data => {
        setNextRace(data);
        // Fetch full schedule for this round
        return fetchWithAuth(`/api/races/${data.round}/schedule`);
      })
      .then(res => res.json())
      .then(schedData => setSchedule(schedData))
      .catch(err => console.error("Error cargando horarios:", err));

    fetch('https://api.jolpi.ca/ergast/f1/2026/drivers.json')
      .then(res => res.json())
      .then(data => {
        const d = data.MRData.DriverTable.Drivers.map((driver: any) => `${driver.givenName} ${driver.familyName}`);
        setDRIVERS(d.sort());
      })
      .catch(err => console.error("Error trayendo lista oficial de la FIA:", err));

    setLoadingOracle(true);
    fetchWithAuth('/api/oracle/roast')
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falla en el backend del oráculo");
        return data;
      })
      .then(data => { setOracleInsight(data.analysis || "No tengo palabras..."); setLoadingOracle(false); })
      .catch(() => { setOracleInsight("El oráculo tuvo una falla en su motor lógico."); setLoadingOracle(false); });
  }, []);

  // When player or session changes, pre-fill existing prediction
  React.useEffect(() => {
    if (!pName) return;
    fetchWithAuth(`/api/predictions?session_type=${selectedSession}`)
      .then(r => r.json())
      .then((preds: any[]) => {
        const mine = preds.find(p => p.player === pName);
        if (mine) {
          setExistingPrediction(mine);
          setPPole(mine.pole_position || '');
          setP1(mine.p1 || ''); setP2(mine.p2 || ''); setP3(mine.p3 || '');
          setP4(mine.p4 || ''); setP5(mine.p5 || '');
          addToast('warning', `Cargando tu prognostico de ${selectedSession} para ${pName}`);
        } else {
          setExistingPrediction(null);
          setPPole(''); setP1(''); setP2(''); setP3(''); setP4(''); setP5('');
        }
      })
      .catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pName, selectedSession]);

  // Duplicate driver validation
  const allPicks = [p1, p2, p3, p4, p5].filter(Boolean);
  const hasDuplicates = new Set(allPicks).size !== allPicks.length;
  const isDuplicateField = (v: string) => v && allPicks.filter(p => p === v).length > 1;
  const isSessionClosed = selectedSessionData ? !selectedSessionData.isOpen : false;

  // Dynamic form config per session
  const SESSION_FORM: Record<SessionType, { label: string; fields: { key: string; label: string; pts: string; color: string }[]; hasPole: boolean }> = {
    qualifying: {
      label: '🏎️ Clasificación',
      fields: [
        { key: 'p1', label: 'Pole (1° Qualy)', pts: '10 pts', color: 'border-yellow-500/30 focus:border-yellow-500 bg-yellow-500/5' },
        { key: 'p2', label: '2° Qualy', pts: '10 pts', color: 'border-gray-400/20 focus:border-gray-400 bg-gray-400/5' },
        { key: 'p3', label: '3° Qualy', pts: '10 pts', color: 'border-orange-600/20 focus:border-orange-600 bg-orange-600/5' },
      ],
      hasPole: false,
    },
    sprint_qualifying: {
      label: '⚡ Sprint Qualifying',
      fields: [
        { key: 'p1', label: '1° Sprint Qualifying', pts: '5 pts', color: 'border-yellow-500/30 focus:border-yellow-500 bg-yellow-500/5' },
      ],
      hasPole: false,
    },
    sprint: {
      label: '🏃 Sprint Race',
      fields: [
        { key: 'p1', label: '1° Sprint', pts: '8 pts', color: 'border-yellow-500/30 focus:border-yellow-500 bg-yellow-500/5' },
        { key: 'p2', label: '2° Sprint', pts: '8 pts', color: 'border-gray-400/20 focus:border-gray-400 bg-gray-400/5' },
        { key: 'p3', label: '3° Sprint', pts: '8 pts', color: 'border-orange-600/20 focus:border-orange-600 bg-orange-600/5' },
      ],
      hasPole: false,
    },
    race: {
      label: '🏁 Carrera',
      fields: [
        { key: 'p1', label: '1° Ganador', pts: '10 pts', color: 'border-yellow-500/30 focus:border-yellow-500 bg-yellow-500/5' },
        { key: 'p2', label: '2° Puesto', pts: '10 pts', color: 'border-gray-400/20 focus:border-gray-400 bg-gray-400/5' },
        { key: 'p3', label: '3° Puesto', pts: '10 pts', color: 'border-orange-600/20 focus:border-orange-600 bg-orange-600/5' },
        { key: 'p4', label: '4° Puesto', pts: '10 pts', color: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
        { key: 'p5', label: '5° Puesto', pts: '10 pts', color: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
      ],
      hasPole: true,
    },
  };

  const currentForm = SESSION_FORM[selectedSession];
  const fieldValues: Record<string, string> = { p1, p2, p3, p4, p5, pole_position: pPole };
  const setFieldValue = (key: string, v: string) => {
    if (key === 'p1') setP1(v); else if (key === 'p2') setP2(v);
    else if (key === 'p3') setP3(v); else if (key === 'p4') setP4(v);
    else if (key === 'p5') setP5(v); else if (key === 'pole_position') setPPole(v);
  };

  const handlePredictSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasDuplicates) { addToast('error', '¡Tenés pilotos repetidos!'); return; }
    if (isSessionClosed) { addToast('error', 'Las predicciones ya están cerradas para esta sesión.'); return; }
    if (existingPrediction) {
      const ok = window.confirm(`Ya tenés un pronóstico de ${currentForm.label} para ${pName}. ¿Actualizar?`);
      if (!ok) return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetchWithAuth('/api/predictions', {
        method: 'POST',
        body: JSON.stringify({
          player: pName, session_type: selectedSession,
          pole_position: pPole, p1, p2, p3, p4, p5,
        })
      });
      if (!res.ok) throw new Error("Falla al guardar");
      addToast('success', `✅ Pronóstico de ${currentForm.label} guardado para ${pName}!`);
      setExistingPrediction({ player: pName, session_type: selectedSession, pole_position: pPole, p1, p2, p3, p4, p5 });
    } catch (err) {
      addToast('error', 'Error guardando el pronóstico. Verificá la conexión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header F1 & Nav Tabs */}
      <header className="flex flex-col gap-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center p-2 shadow-lg shrink-0">
              <img src={logoCodeflow} alt="F1 Codeflow" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-white mb-1">Formula 1 HUB</h1>
              <p className="text-codeflow-muted text-sm md:text-lg max-w-xl">
                {nextRace ? `Próxima parada: ${nextRace.name} — ${nextRace.circuit}` : 'Métricas impulsadas por IA, predicciones del finde y tabla oficial.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setF1Tab('rules')}
            className={`w-full md:w-auto btn-secondary transition-all flex items-center justify-center gap-2 ${f1Tab === 'rules' ? 'bg-codeflow-accent/20 border-codeflow-accent/40 text-codeflow-accent' : ''}`}
          >
            <AlertCircle size={18} />
            <span>Reglas del Campeonato</span>
          </button>
        </div>

        {/* F1 Sub-Navigation */}
        <div className="flex items-center gap-1 p-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            onClick={() => setF1Tab('prode')}
            className={`flex-1 flex justify-center items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${f1Tab === 'prode' ? 'text-white bg-white/10 border border-white/10 shadow-lg' : 'text-codeflow-muted hover:text-white hover:bg-white/5'}`}>
            🔮 Prode
          </button>
          <button
            onClick={() => setF1Tab('leaderboard')}
            className={`flex-1 flex justify-center items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${f1Tab === 'leaderboard' ? 'text-white bg-white/10 border border-white/10 shadow-lg' : 'text-codeflow-muted hover:text-white hover:bg-white/5'}`}>
            📊 Tabla
          </button>
          <button
            onClick={() => setF1Tab('calendar')}
            className={`flex-1 flex justify-center items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${f1Tab === 'calendar' ? 'text-white bg-white/10 border border-white/10 shadow-lg' : 'text-codeflow-muted hover:text-white hover:bg-white/5'}`}>
            📅 Calendario
          </button>
          <button
            onClick={() => setF1Tab('grilla')}
            className={`flex-1 flex justify-center items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${f1Tab === 'grilla' ? 'text-white bg-white/10 border border-white/10 shadow-lg' : 'text-codeflow-muted hover:text-white hover:bg-white/5'}`}>
            🏁 Grilla
          </button>
          <button
            onClick={() => setF1Tab('rules')}
            className={`flex-1 flex justify-center items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${f1Tab === 'rules' ? 'text-white bg-white/10 border border-white/10 shadow-lg' : 'text-codeflow-muted hover:text-white hover:bg-white/5'}`}>
            📚 Reglas
          </button>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={f1Tab}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          transition={{ duration: 0.2 }}
        >

          {f1Tab === 'rules' && (
            <F1RulesTab />
          )}

          {f1Tab === 'prode' && (
            <div className="space-y-6">
              {/* Claude Oracle Section */}
              <div className="glass-card p-1 pb-6 relative overflow-hidden min-h-[140px] border border-white/5">
                {/* Fancy border effect atenuado */}
                <div className="absolute inset-0 bg-gradient-to-r from-codeflow-accent via-fuchsia-600 to-purple-800 opacity-5" />
                <div className="m-5 relative z-10">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-800 to-blue-800 p-[1px] shadow-lg shadow-purple-900/20 shrink-0">
                      <div className="w-full h-full bg-codeflow-card rounded-xl flex items-center justify-center">
                        <span className="text-2xl">🤖</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-white">El Oráculo (Groq)</h3>
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold mr-auto">Análisis Sensorial</span>
                      </div>

                      {loadingOracle ? (
                        <div className="text-codeflow-muted text-sm animate-pulse flex items-center gap-3 py-2">
                          <div className="w-4 h-4 border-2 border-codeflow-accent border-t-transparent rounded-full animate-spin"></div>
                          Procesando telemetría de trolls...
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

              {/* ===== SESSION SCHEDULE BAR ===== */}
              <div className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">🗓️ Sesiones del Fin de Semana</h4>
                  <span className="text-xs text-codeflow-muted">{nextRace?.name || ''} · {nextRace?.city || ''}</span>
                </div>
                {!schedule ? (
                  <div className="flex gap-3">
                    {[1, 2, 3].map(i => <div key={i} className="h-16 flex-1 bg-white/5 rounded-xl animate-pulse" />)}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    {schedule.sessions?.map((s: any) => {
                      const isSelected = selectedSession === s.type;
                      const argDate = s.date_arg ? new Date(s.date_arg) : null;
                      const dayStr = argDate ? argDate.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }) : 'TBD';
                      const timeStr = argDate ? argDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' ARG' : 'TBD';
                      return (
                        <button
                          key={s.type}
                          onClick={() => setSelectedSession(s.type as SessionType)}
                          className={`flex-1 min-w-[140px] flex flex-col gap-1 p-3 rounded-xl border transition-all text-left ${isSelected
                            ? 'border-codeflow-accent/60 bg-codeflow-accent/10 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                            : 'border-white/10 bg-white/[0.02] hover:bg-white/5 hover:border-white/20'
                            }`}
                        >
                          <span className="text-sm font-bold text-white">{s.label}</span>
                          <span className="text-[10px] text-codeflow-muted">{dayStr}</span>
                          <span className="text-[10px] font-mono text-codeflow-muted">{timeStr}</span>
                          <div className={`flex items-center gap-1 text-[9px] font-bold mt-1 ${s.isOpen ? 'text-green-400' : 'text-red-400'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${s.isOpen ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                            {s.isOpen ? 'ABIERTO' : 'CERRADO'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ===== PREDICTION FORM ===== */}
              <div className="glass-card p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <Trophy size={24} className="text-codeflow-accent" />
                    <div>
                      <h3 className="text-xl font-bold text-white">Enviar Pronóstico</h3>
                      <p className="text-xs text-codeflow-muted">{currentForm.label}</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${isSessionClosed ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-green-500/10 text-green-400 border-green-500/30'
                    }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isSessionClosed ? 'bg-red-400' : 'bg-green-400 animate-pulse'}`} />
                    {isSessionClosed ? 'CERRADO' : 'ABIERTO'}
                  </div>
                </div>

                <form onSubmit={handlePredictSubmit} className="space-y-4 flex-1">
                  <div>
                    <label className="block text-xs uppercase font-bold text-codeflow-muted tracking-wider mb-1">Nombre Jugador</label>
                    <select value={pName} onChange={e => setPName(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-codeflow-accent appearance-none cursor-pointer">
                      <option value="" disabled className="bg-codeflow-dark text-codeflow-muted">Seleccioná tu usuario...</option>
                      {USERS.map(u => <option key={u} value={u} className="bg-codeflow-dark text-white">{u}</option>)}
                    </select>
                  </div>

                  {/* Pole — only for race session */}
                  {currentForm.hasPole && (
                    <div>
                      <label className="flex justify-between text-xs uppercase font-bold text-codeflow-muted tracking-wider mb-1">
                        <span>Pole Position (Sábado)</span>
                        <span className="text-codeflow-accent/60">+5 pts</span>
                      </label>
                      <select value={pPole} onChange={e => setPPole(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-codeflow-accent appearance-none cursor-pointer">
                        <option value="" disabled className="bg-codeflow-dark text-codeflow-muted">Seleccioná al Poleman...</option>
                        {DRIVERS.map(d => <option key={d} value={d} className="bg-codeflow-dark text-white">{d}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Dynamic position fields */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-xs uppercase font-bold text-codeflow-accent/70 tracking-wider">
                        Posiciones ({currentForm.fields[0]?.pts} c/u)
                      </label>
                      {hasDuplicates && (
                        <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                          <AlertCircle size={10} /> Repetidos
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      {currentForm.fields.map((field) => (
                        <div key={field.key} className="flex items-center gap-3">
                          <span className="text-xs font-bold text-white/50 w-28 shrink-0">{field.label}</span>
                          <select
                            value={fieldValues[field.key] || ''}
                            onChange={e => setFieldValue(field.key, e.target.value)}
                            required
                            className={`flex-1 rounded-lg px-3 py-2 text-white outline-none border appearance-none cursor-pointer transition-colors ${isDuplicateField(fieldValues[field.key]) ? 'border-red-500/60 bg-red-500/10' : field.color
                              }`}
                          >
                            <option value="" disabled className="bg-codeflow-dark text-codeflow-muted">Elegir piloto...</option>
                            {DRIVERS.map(d => <option key={d} value={d} className="bg-codeflow-dark text-white">{d}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 flex flex-col gap-3">
                    {existingPrediction && (
                      <p className="text-[10px] text-yellow-400/70 mb-2 flex items-center gap-1">
                        <AlertCircle size={10} /> Actualizarás tu pronóstico de {currentForm.label} existente
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmitting || hasDuplicates || isSessionClosed}
                      className="w-full bg-gradient-to-r from-codeflow-accent to-fuchsia-600 hover:opacity-90 text-white font-bold py-3 rounded-lg transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Guardando...
                        </span>
                      ) : isSessionClosed ? '🚫 Sesión cerrada' : existingPrediction ? `🔄 Actualizar ${currentForm.label}` : `🏁 Enviar ${currentForm.label}`}
                    </button>

                    <button
                      type="button"
                      onClick={() => setF1Tab('grilla')}
                      className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                    >
                      <LayoutDashboard size={16} /> Ver Pronósticos de los Demás
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {f1Tab === 'leaderboard' && (
            <F1LeaderboardTab />
          )}

          {f1Tab === 'calendar' && (
            <F1CalendarTab />
          )}

          {f1Tab === 'grilla' && (
            <PredictionsGridTab nextRace={nextRace} />
          )}

        </motion.div>
      </AnimatePresence>
    </div >
  );
}

// --- Leaderboard Internal Component ---
function F1LeaderboardTab() {
  const [leaderboard, setLeaderboard] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchWithAuth('/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        setLeaderboard(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("No se pudo cargar el leaderboard", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="glass-card p-8 min-h-[500px] border-t-4 border-t-yellow-500 rounded-t-none">
      <h3 className="text-2xl font-bold text-white mb-2">Posiciones Oficiales del Prode 2026</h3>
      <p className="text-codeflow-muted italic text-sm mb-8">Las posiciones se actualizarán al bajar la bandera a cuadros de cada GP.</p>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 w-full bg-white/5 rounded-xl border border-white/5 flex items-center px-6 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-white/10 mr-4" />
              <div className="h-5 w-48 bg-white/10 rounded mr-auto" />
              <div className="h-5 w-16 bg-codeflow-accent/20 rounded" />
            </div>
          ))}
        </div>
      ) : leaderboard.length === 0 ? (
        <p className="text-codeflow-muted text-center py-10 text-lg">Aún nadie corrió. ¡Sé el primero en hacer la pole!</p>
      ) : (
        <div className="space-y-3">
          {leaderboard.map((user, i) => (
            <div key={user.name} className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-transparent hover:border-white/10 group">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg shadow-sm ${i === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 shadow-yellow-500/20' : i === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/50' : i === 2 ? 'bg-orange-600/20 text-orange-400 border border-orange-600/50' : 'bg-white/5 text-white/50'}`}>
                  {i + 1}
                </div>
                <span className="font-bold text-white text-lg group-hover:text-codeflow-accent transition-colors">{user.name}</span>
              </div>
              <span className="font-display font-extrabold text-2xl text-white">{user.pts} <span className="text-sm font-normal text-codeflow-muted">PTS</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Predictions Grid Tab ---
function PredictionsGridTab({ nextRace }: { nextRace: any }) {
  const [predictions, setPredictions] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sessionFilter, setSessionFilter] = React.useState('race');
  const USERS = ["MrKazter", "Eliana", "NestorMcNestor", "GuilleGb", "Rubiola", "Colorado", "MrFori"];

  React.useEffect(() => {
    setLoading(true);
    fetchWithAuth(`/api/predictions?session_type=${sessionFilter}`)
      .then(r => r.json())
      .then(data => { setPredictions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [sessionFilter]);

  const SESSION_LABELS: Record<string, string> = {
    race: '🏁 Carrera', qualifying: '🏎️ Clasificación',
    sprint: '🏃 Sprint', sprint_qualifying: '⚡ Sprint Qualifying',
  };
  const POSITIONS: Record<string, string[]> = {
    race: ['pole_position', 'p1', 'p2', 'p3', 'p4', 'p5'],
    qualifying: ['p1', 'p2', 'p3'], sprint: ['p1', 'p2', 'p3'], sprint_qualifying: ['p1'],
  };
  const POS_LABELS: Record<string, string> = {
    pole_position: '🏎️ Pole', p1: '🥇 1°', p2: '🥈 2°', p3: '🥉 3°', p4: '4°', p5: '5°',
  };
  const positions = POSITIONS[sessionFilter] || POSITIONS.race;
  const consensus: Record<string, Record<string, number>> = {};
  for (const pos of positions) {
    consensus[pos] = {};
    for (const pred of predictions) {
      const v = pred[pos]; if (v) consensus[pos][v] = (consensus[pos][v] || 0) + 1;
    }
  }
  const submittedPlayers = new Set(predictions.map((p: any) => p.player));
  const missingPlayers = USERS.filter(u => !submittedPlayers.has(u));

  return (
    <div className="space-y-4">
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-white">Grilla de Pronósticos</h3>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(SESSION_LABELS).map(([k, v]) => (
              <button key={k} onClick={() => setSessionFilter(k)}
                className={`px-3 py-1 text-xs rounded-full font-semibold transition-all border ${sessionFilter === k ? 'bg-codeflow-accent/20 text-codeflow-accent border-codeflow-accent/40' : 'text-codeflow-muted border-white/10 hover:border-white/20'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-codeflow-muted mb-4">
          {nextRace ? nextRace.name : ''} · Celdas en <span className="text-green-400 font-semibold">verde</span> = consenso del grupo.
        </p>
        {loading ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-10 w-full bg-white/5 rounded-xl animate-pulse" />)}</div>
        ) : predictions.length === 0 ? (
          <p className="text-codeflow-muted text-center py-10">Nadie cargó pronósticos de {SESSION_LABELS[sessionFilter]} todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-codeflow-muted font-semibold pb-3 pr-4">Posición</th>
                  {predictions.map((pred: any) => (
                    <th key={pred.player} className="text-center text-white font-bold pb-3 px-3">{pred.player}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="text-codeflow-muted text-xs font-semibold py-3 pr-4 whitespace-nowrap">{POS_LABELS[pos]}</td>
                    {predictions.map((pred: any) => {
                      const val = pred[pos];
                      const isConsensus = val && (consensus[pos][val] || 0) > 1;
                      return (
                        <td key={pred.player} className="text-center py-2 px-3">
                          <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${!val ? 'text-codeflow-muted/50 italic' : isConsensus ? 'bg-green-500/15 text-green-300 border border-green-500/30' : 'bg-white/5 text-white/80 border border-white/10'}`}>
                            {val ? val.split(' ').slice(-1)[0] : '—'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {missingPlayers.length > 0 && (
        <div className="glass-card p-4 border border-orange-500/20 bg-orange-500/5">
          <p className="text-orange-400 text-sm font-semibold mb-2 flex items-center gap-2"><AlertCircle size={14} /> Sin pronóstico de {SESSION_LABELS[sessionFilter]}:</p>
          <div className="flex flex-wrap gap-2">
            {missingPlayers.map(p => <span key={p} className="px-2 py-1 rounded-full bg-orange-500/10 text-orange-300/70 text-xs border border-orange-500/20">{p}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Media Vault Component ---

// MediaCard: auto-fetches TMDB poster for series/movies/animes
function MediaCard({ item, i, isGame, getGenreColor, tab, onEdit, onDelete }: {
  item: any; i: number; isGame: boolean; getGenreColor: (g: string) => string; tab: string;
  onEdit: (item: any) => void; onDelete: (id: string) => void;
}) {
  const [poster, setPoster] = React.useState<string | null>(null);
  const [overview, setOverview] = React.useState<string | null>(null);
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    if (isGame) return;
    const type = tab === 'movies' ? 'movie' : 'tv';
    fetchWithAuth(`/api/tmdb/search?query=${encodeURIComponent(item.name)}&type=${type}`)
      .then(r => r.json())
      .then((results: any[]) => {
        if (results && results.length > 0) {
          setPoster(results[0].poster || null);
          setOverview(results[0].overview || null);
        }
      })
      .catch(() => { });
  }, [item.name, isGame, tab]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
      className="glass-card p-5 flex flex-col items-start gap-3 hover:border-codeflow-accent/40 group relative overflow-hidden"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Poster + body layout */}
      <div className="flex gap-4 w-full">
        {/* Poster */}
        {!isGame && (
          <div className="shrink-0 w-16 h-24 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
            {poster
              ? <img src={poster} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
              : <span>{tab === 'movies' ? '🎬' : tab === 'animes' ? '🎌' : '📺'}</span>
            }
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2 mb-1">
            <h3 className="text-base font-bold text-white group-hover:text-codeflow-accent transition-colors leading-tight line-clamp-2">{item.name}</h3>
            {!isGame && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/70 whitespace-nowrap shrink-0">{item.rating || 'Sin nota'}</span>}
          </div>
          {!isGame && item.genre && (
            <div className="flex flex-wrap gap-1 mb-2">
              {item.genre.split(',').slice(0, 2).map((g: string) => (
                <span key={g} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${getGenreColor(g.trim())}`}>{g.trim()}</span>
              ))}
            </div>
          )}
          {isGame && (
            <div className="flex flex-wrap gap-1">
              {item.game_type && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${getGenreColor(item.game_type)}`}>{item.game_type}</span>}
              {item.difficulty && <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded-md">{item.difficulty}</span>}
              {item.players && <span className="text-[10px] font-semibold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-md">{item.players} jug.</span>}
            </div>
          )}
          <p className="text-xs text-codeflow-text/70 italic line-clamp-2 mt-1">{item.description || item.notes}</p>
        </div>
      </div>

      {/* TMDB overview hover overlay */}
      {!isGame && overview && (
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-codeflow-dark/95 backdrop-blur-sm p-4 flex flex-col justify-center z-10"
            >
              <p className="text-xs text-white/80 leading-relaxed line-clamp-6 italic">{overview}</p>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <div className="w-full pt-3 mt-auto border-t border-white/5 text-[10px] text-codeflow-muted flex justify-between items-center group/footer relative z-20">
        <span>Recomendó: <strong className="text-white">{item.recommender || '—'}</strong></span>
        <div className="flex items-center gap-2">
          <span>{new Date(item.created_at).toLocaleDateString('es-AR')}</span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onEdit(item)}
              className="p-1 hover:text-codeflow-accent transition-colors"
              title="Editar"
            >
              <Edit2 size={12} />
            </button>
            <button
              onClick={() => { if (window.confirm('¿Eliminar este item?')) onDelete(item.id); }}
              className="p-1 hover:text-red-400 transition-colors"
              title="Eliminar"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function MediaVaultView({ tab }: { tab: string }) {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [selectedGenre, setSelectedGenre] = React.useState('All');

  // Form states
  const [formData, setFormData] = React.useState({ recommender: '', name: '', genre: '', description: '', rating: '', game_type: '', players: '', duration: '', difficulty: '', notes: '' });
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showCustomGenre, setShowCustomGenre] = React.useState(false);
  const [tempGenre, setTempGenre] = React.useState('');

  const endpointTab = tab === 'games' ? 'boardgames' : tab;

  const fetchMedia = () => {
    setLoading(true);
    fetchWithAuth(`/api/media/${endpointTab}`)
      .then(res => res.json())
      .then(data => { setItems(data); setLoading(false); })
      .catch(err => { console.error('Error fetching media:', err); setLoading(false); });
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/media/${endpointTab}/${id}`, { method: 'DELETE' });
      if (res.ok) fetchMedia();
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const handleEdit = (item: any) => {
    setFormData({
      recommender: item.recommender || '',
      name: item.name || '',
      genre: item.genre || '',
      description: item.description || '',
      rating: item.rating || '',
      game_type: item.game_type || '',
      players: item.players || '',
      duration: item.duration || '',
      difficulty: item.difficulty || '',
      notes: item.notes || ''
    });
    setEditingId(item.id);
    setIsEditing(true);
    setShowForm(true);
    // If it's a genre that doesn't exist in standard dropdown (though they are dynamic), 
    // we might need to show custom input, but for edit we can just set formData and the dropdown will find it or we show custom.
    setShowCustomGenre(false);
  };

  const isGame = tab === 'games';

  React.useEffect(() => {
    fetchMedia();
    setShowForm(false);
    setIsEditing(false);
    setEditingId(null);
    setSelectedGenre('All');
  }, [tab]);

  const genres = React.useMemo(() => {
    const all = items.map(i => isGame ? i.game_type : i.genre).filter(Boolean).flatMap(g => g.split(',').map((s: string) => s.trim()));
    return ['All', ...Array.from(new Set(all))];
  }, [items, isGame]);

  const filteredItems = React.useMemo(() => {
    if (selectedGenre === 'All') return items;
    return items.filter(i => {
      const val = isGame ? i.game_type : i.genre;
      return val && val.includes(selectedGenre);
    });
  }, [items, selectedGenre, isGame]);

  const getGenreColor = (genre: string) => {
    if (!genre) return 'text-codeflow-accent bg-codeflow-accent/10';
    const str = genre.toLowerCase();
    if (str.includes('acción') || str.includes('action') || str.includes('estrategia') || str.includes('shonen')) return 'text-red-400 bg-red-400/10';
    if (str.includes('comedia') || str.includes('comedy') || str.includes('familiar')) return 'text-yellow-400 bg-yellow-400/10';
    if (str.includes('drama') || str.includes('misterio') || str.includes('seinen')) return 'text-blue-400 bg-blue-400/10';
    if (str.includes('sci-fi') || str.includes('ciencia ficción') || str.includes('mecha')) return 'text-cyan-400 bg-cyan-400/10';
    if (str.includes('terror') || str.includes('horror') || str.includes('suspenso')) return 'text-stone-400 bg-stone-400/10';
    if (str.includes('aventura') || str.includes('rol') || str.includes('fantasy') || str.includes('fantasía')) return 'text-green-400 bg-green-400/10';
    if (str.includes('romance') || str.includes('shojo') || str.includes('slice')) return 'text-pink-400 bg-pink-400/10';
    return 'text-codeflow-accent bg-codeflow-accent/10';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const finalGenre = showCustomGenre ? tempGenre : (isGame ? formData.game_type : formData.genre);
    const submissionData = isGame ? { ...formData, game_type: finalGenre } : { ...formData, genre: finalGenre };

    try {
      const url = isEditing ? `/api/media/${endpointTab}/${editingId}` : `/api/media/${endpointTab}`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(submissionData)
      });
      if (res.ok) {
        setShowForm(false);
        setIsEditing(false);
        setEditingId(null);
        setFormData({ recommender: '', name: '', genre: '', description: '', rating: '', game_type: '', players: '', duration: '', difficulty: '', notes: '' });
        setTempGenre('');
        setShowCustomGenre(false);
        fetchMedia();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const translations: Record<string, string> = {
    'series': 'Series de TV',
    'animes': 'Animes de Culto',
    'movies': 'Cine y Películas',
    'games': 'Juegos de Mesa'
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-white mb-2">{translations[tab]}</h1>
          <p className="text-codeflow-muted text-lg">Bóveda de recomendaciones grupales.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
          {items.length > 0 && (
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="bg-codeflow-card border border-white/10 text-white text-sm rounded-xl focus:ring-codeflow-accent focus:border-codeflow-accent block px-4 py-3 outline-none cursor-pointer appearance-none pr-10 relative w-full sm:w-auto"
              style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239CA3AF' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
            >
              {genres.map(g => (
                <option key={g} value={g}>{g === 'All' ? (isGame ? 'Todos los tipos' : 'Todos los géneros') : g}</option>
              ))}
            </select>
          )}
          <button className="btn-primary w-full sm:w-auto whitespace-nowrap" onClick={() => {
            if (showForm && isEditing) {
              setIsEditing(false);
              setEditingId(null);
              setFormData({ recommender: '', name: '', genre: '', description: '', rating: '', game_type: '', players: '', duration: '', difficulty: '', notes: '' });
            }
            setShowForm(!showForm);
          }}>
            {showForm ? 'Cancelar' : 'Añadir Nuevo'}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass-card p-6 mb-8 border border-codeflow-accent/40 bg-codeflow-card/95">
              <h3 className="text-xl font-bold text-white mb-4">
                {isEditing ? `Editar en la Bóveda de ${translations[tab]}` : `Añadir a la Bóveda de ${translations[tab]}`}
              </h3>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!isGame && (
                  <>
                    <input type="text" placeholder="Recomendado por..." required className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.recommender} onChange={e => setFormData({ ...formData, recommender: e.target.value })} />
                    <input type="text" placeholder="Nombre completo" required className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />

                    {/* Genre Dropdown/Input */}
                    <div className="flex flex-col gap-2">
                      {!showCustomGenre ? (
                        <select
                          className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent outline-none appearance-none"
                          value={formData.genre}
                          onChange={e => {
                            if (e.target.value === 'ADD_NEW') {
                              setShowCustomGenre(true);
                              setFormData({ ...formData, genre: '' });
                            } else {
                              setFormData({ ...formData, genre: e.target.value });
                            }
                          }}
                        >
                          <option value="" disabled>Seleccionar Género...</option>
                          {genres.filter(g => g !== 'All').map(g => <option key={g} value={g} className="bg-codeflow-dark">{g}</option>)}
                          <option value="ADD_NEW" className="bg-codeflow-dark text-codeflow-accent">➕ Agregar nuevo...</option>
                        </select>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Nuevo Género..."
                            autoFocus
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent"
                            value={tempGenre}
                            onChange={e => setTempGenre(e.target.value)}
                          />
                          <button type="button" onClick={() => setShowCustomGenre(false)} className="px-3 bg-white/5 rounded-lg text-white/50 hover:text-white"><XCircle size={16} /></button>
                        </div>
                      )}
                    </div>

                    <input type="text" placeholder="Rating (Ej: Obra Maestra, Mediocre)" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.rating} onChange={e => setFormData({ ...formData, rating: e.target.value })} />
                    <textarea placeholder="¿De qué trata? / Sinopsis breve" required className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent md:col-span-2 min-h-[100px]" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                  </>
                )}
                {isGame && (
                  <>
                    <input type="text" placeholder="Nombre del Juego" required className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />

                    {/* Game Type Dropdown/Input */}
                    <div className="flex flex-col gap-2">
                      {!showCustomGenre ? (
                        <select
                          className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent outline-none appearance-none"
                          value={formData.game_type}
                          onChange={e => {
                            if (e.target.value === 'ADD_NEW') {
                              setShowCustomGenre(true);
                              setFormData({ ...formData, game_type: '' });
                            } else {
                              setFormData({ ...formData, game_type: e.target.value });
                            }
                          }}
                        >
                          <option value="" disabled>Seleccionar Tipo...</option>
                          {genres.filter(g => g !== 'All').map(g => <option key={g} value={g} className="bg-codeflow-dark">{g}</option>)}
                          <option value="ADD_NEW" className="bg-codeflow-dark text-codeflow-accent">➕ Agregar nuevo...</option>
                        </select>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Nuevo Tipo..."
                            autoFocus
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent"
                            value={tempGenre}
                            onChange={e => setTempGenre(e.target.value)}
                          />
                          <button type="button" onClick={() => setShowCustomGenre(false)} className="px-3 bg-white/5 rounded-lg text-white/50 hover:text-white"><XCircle size={16} /></button>
                        </div>
                      )}
                    </div>

                    <input type="text" placeholder="Jugadores (Ej: 2-5)" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.players} onChange={e => setFormData({ ...formData, players: e.target.value })} />
                    <input type="text" placeholder="Duración (Ej: 60 min)" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} />
                    <input type="text" placeholder="Dificultad (Ej: Media, Familiar)" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: e.target.value })} />
                    <textarea placeholder="Notas / Impresiones" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent md:col-span-2 min-h-[100px]" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                  </>
                )}
                <div className="md:col-span-2 flex justify-end mt-2">
                  <button type="submit" disabled={isSubmitting} className="btn-primary w-full md:w-auto">
                    {isSubmitting ? 'Guardando en la bóveda...' : isEditing ? 'Guardar Cambios' : 'Añadir Item'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="glass-card p-6 flex items-start gap-4">
              <div className="w-16 h-24 skeleton shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-3/4 skeleton" />
                <div className="h-3 w-1/2 skeleton" />
                <div className="h-10 w-full skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 text-codeflow-muted text-xl border-2 border-dashed border-white/10 rounded-2xl">
          No hay elementos que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredItems.map((item, i) => (
            <MediaCard key={item.id} item={item} i={i} isGame={isGame} getGenreColor={getGenreColor} tab={tab} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
// --- Official 2026 F1 Calendar Component ---
function F1CalendarTab() {
  const [races, setRaces] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchWithAuth('/api/races/calendar')
      .then(res => res.json())
      .then(data => { setRaces(data); setLoading(false); })
      .catch(err => { console.error("Error cargando calendario:", err); setLoading(false); });
  }, []);

  return (
    <div className="glass-card p-8 min-h-[500px] border-t-4 border-t-red-500 rounded-t-none">
      <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
        Calendario Oficial 2026 <span className="text-[10px] uppercase font-bold tracking-wider bg-red-500/20 border border-red-500/30 px-2 py-1 rounded text-red-400">FIA</span>
      </h3>
      <p className="text-codeflow-muted italic text-sm mb-8">24 carreras confirmadas para la temporada 2026.</p>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-44 rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {races.map((race, idx) => {
            const dateObj = new Date(race.date);
            const now = new Date();
            const isCompleted = dateObj < now;
            const isNext = !isCompleted && (idx === 0 || new Date(races[idx - 1]?.date) < now);
            return (
              <div key={race.round} className={`p-5 rounded-2xl border transition-all relative ${isCompleted ? 'bg-codeflow-card/50 border-white/5 opacity-60' : isNext ? 'bg-codeflow-accent/5 border-codeflow-accent/40 ring-1 ring-codeflow-accent/20 group' : 'bg-white/5 border-white/10 hover:border-codeflow-accent/50 group'}`}>
                {isNext && (
                  <span className="absolute -top-3 left-4 text-[10px] bg-codeflow-accent text-white px-2 py-0.5 rounded font-bold uppercase shadow-lg">Próxima</span>
                )}
                <div className="flex justify-between items-start mb-3 gap-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-codeflow-accent">Ronda {race.round} - {race.country}</span>
                      {race.sprint && <span className="text-[9px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded font-bold uppercase">Sprint</span>}
                    </div>
                    <h4 className="font-bold text-lg leading-tight text-white group-hover:text-codeflow-accent transition-colors">{race.name}</h4>
                  </div>
                  {isCompleted && <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-white/50 border border-white/10 shrink-0">FINALIZADA</span>}
                </div>

                <p className="text-xs text-codeflow-muted mb-4">{race.circuit}, {race.city}</p>

                <div className="mt-auto border-t border-white/10 pt-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold tracking-wider text-codeflow-accent uppercase">🏁 Carrera</span>
                      <span className="text-sm font-bold text-white">
                        {dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-white bg-codeflow-accent/10 px-2 py-1 rounded">
                      {dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                    </span>
                  </div>

                  {race.sprint && (
                    <div className="flex items-center justify-between pt-2 border-t border-white/5 opacity-80">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold tracking-wider text-orange-400 uppercase">🏃 Sprint</span>
                        <span className="text-xs font-semibold text-white">
                          {new Date(race.sprint_date || dateObj.getTime() - 86400000).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <span className="text-xs text-white">
                        {new Date(race.sprint_date || dateObj.getTime() - 86400000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 opacity-80">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold tracking-wider text-white/50 uppercase">⏱️ Clasificación</span>
                      <span className="text-xs font-semibold text-white">
                        {new Date(race.qualy_date || dateObj.getTime() - (race.sprint ? 172800000 : 86400000)).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <span className="text-xs text-white">
                      {new Date(race.qualy_date || dateObj.getTime() - (race.sprint ? 172800000 : 86400000)).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  )
}
// --- F1 Rules Tab Component ---
function F1RulesTab() {
  const sections = [
    {
      title: "🏁 ¿Cómo funciona el Prode?",
      icon: <Trophy className="text-yellow-500" />,
      content: "El Prode de CodeWeb es una competencia de predicciones para la temporada 2026 de Formula 1. El objetivo es acumular la mayor cantidad de puntos posible acertando los resultados de cada sesión de GP."
    },
    {
      title: "🕒 Sesiones y Bloqueo",
      icon: <RefreshCw className="text-codeflow-accent" />,
      content: "Podés cargar o editar tus predicciones en cualquier momento hasta que comience oficialmente la sesión correspondiente. Unos minutos antes del inicio (Qualy de viernes/sábado, Sprint o Carrera de domingo), el sistema bloquea automáticamente la carga para ese GP para evitar trampas."
    },
    {
      title: "📊 Sistema de Puntos",
      icon: <CheckCircle className="text-green-500" />,
      isPoints: true,
      points: [
        { label: "Pole Position (Sábado)", pts: "+5 pts", desc: "Acertar quién hace la Pole oficial el sábado." },
        { label: "Carrera (Top 5)", pts: "+10 pts c/u", desc: "Cada posición del Top 5 que aciertes exactamente el domingo." },
        { label: "Sprint Race (Top 3)", pts: "+8 pts c/u", desc: "Acertar los 3 primeros de la carrera corta." },
        { label: "Clasificación (Top 3)", pts: "+10 pts c/u", desc: "Acertar los 3 pilotos más rápidos de la Qualy tradicional." },
        { label: "Sprint Qualy (1°)", pts: "+5 pts", desc: "Acertar quién sale primero en la tanda del viernes." },
      ]
    },
    {
      title: "🔍 Visualización y Transparencia",
      icon: <LayoutDashboard className="text-blue-500" />,
      content: "Una vez que la sesión se bloquea, podés ver los pronósticos de todos en tiempo real en la pestaña 'Grilla de Pronósticos' para comparar estrategias. El Leaderboard se actualiza cuando los comisarios (Admin) cargan los resultados oficiales."
    },
    {
      title: "⚠️ Ausencia de Pronóstico",
      icon: <AlertCircle className="text-red-400" />,
      content: "Si no cargás una predicción antes de que comience la sesión, obtendrás 0 puntos para esa ronda. ¡No te olvides de guardar tus cambios a tiempo!"
    }
  ];

  return (
    <div className="glass-card p-8 min-h-[500px] border-t-4 border-t-purple-500 rounded-t-none">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10 text-center text-balance">
          <h3 className="text-3xl font-display font-bold text-white mb-3 tracking-tight">Manual de Operaciones: CodeWeb F1</h3>
          <p className="text-codeflow-muted text-lg">Todo lo que necesitás saber para dominar el paddock.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {sections.map((sec, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-codeflow-accent/30 transition-all group"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/5 rounded-lg group-hover:bg-codeflow-accent/10 transition-colors">
                  {sec.icon}
                </div>
                <h4 className="font-bold text-lg text-white">{sec.title}</h4>
              </div>

              {sec.isPoints ? (
                <div className="space-y-3">
                  {sec.points?.map((p, i) => (
                    <div key={i} className="flex justify-between items-start border-b border-white/5 pb-2 last:border-0">
                      <div>
                        <p className="text-sm font-semibold text-white">{p.label}</p>
                        <p className="text-[10px] text-codeflow-muted">{p.desc}</p>
                      </div>
                      <span className="text-xs font-bold text-codeflow-accent bg-codeflow-accent/10 px-2 py-1 rounded shrink-0">{p.pts}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-codeflow-text/80 leading-relaxed">
                  {sec.content}
                </p>
              )}
            </motion.div>
          ))}
        </div>

        <div className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-red-600/10 via-purple-600/10 to-transparent border border-white/10 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl rotate-12">🏁</div>
          <p className="text-base text-white/80 italic font-medium relative z-10">
            "Si todo parece estar bajo control, es que no vas lo suficientemente rápido."
          </p>
          <p className="text-xs font-bold text-codeflow-accent mt-3 uppercase tracking-[0.2em] relative z-10">— Mario Andretti</p>
        </div>
      </div>
    </div>
  );
}

// --- Admin Panel Component ---
function AdminView() {
  const [races, setRaces] = React.useState<any[]>([]);
  const [selectedRound, setSelectedRound] = React.useState('');
  const [selectedSession, setSelectedSession] = React.useState<'race' | 'qualifying' | 'sprint' | 'sprint_qualifying'>('race');
  const [pole, setPole] = React.useState('');
  const [p1, setP1] = React.useState('');
  const [p2, setP2] = React.useState('');
  const [p3, setP3] = React.useState('');
  const [p4, setP4] = React.useState('');
  const [p5, setP5] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [resultMessage, setResultMessage] = React.useState<any>(null);

  const SESSION_CONFIG = {
    race: { label: '🏁 Carrera', fields: ['p1', 'p2', 'p3', 'p4', 'p5'], hasPole: true },
    qualifying: { label: '🏎️ Clasificación', fields: ['p1', 'p2', 'p3'], hasPole: false },
    sprint: { label: '🏃 Sprint Race', fields: ['p1', 'p2', 'p3'], hasPole: false },
    sprint_qualifying: { label: '⚡ Sprint Qualifying', fields: ['p1'], hasPole: false },
  } as const;
  const sessionCfg = SESSION_CONFIG[selectedSession];

  const DRIVERS = [
    "Max Verstappen", "Lando Norris", "Charles Leclerc", "Carlos Sainz", "Oscar Piastri",
    "Lewis Hamilton", "George Russell", "Fernando Alonso", "Lance Stroll", "Yuki Tsunoda",
    "Liam Lawson", "Nico Hülkenberg", "Esteban Ocon", "Pierre Gasly", "Jack Doohan",
    "Alexander Albon", "Franco Colapinto", "Oliver Bearman", "Andrea Kimi Antonelli", "Gabriel Bortoleto"
  ].sort();

  React.useEffect(() => {
    fetchWithAuth('/api/races/calendar')
      .then(res => res.json())
      .then(data => setRaces(data))
      .catch(err => console.error(err));
  }, []);

  const fetchOfficialResults = async () => {
    if (!selectedRound) return;
    setSubmitting(true);
    setResultMessage(null);
    try {
      // 1. Fetch Winners (Race Results)
      const resVal = await fetch(`https://api.jolpi.ca/ergast/f1/2026/${selectedRound}/results.json`);
      const dataVal = await resVal.json();
      const results = dataVal.MRData.RaceTable.Races[0]?.Results;

      if (results && results.length >= 5) {
        setP1(`${results[0].Driver.givenName} ${results[0].Driver.familyName}`);
        setP2(`${results[1].Driver.givenName} ${results[1].Driver.familyName}`);
        setP3(`${results[2].Driver.givenName} ${results[2].Driver.familyName}`);
        setP4(`${results[3].Driver.givenName} ${results[3].Driver.familyName}`);
        setP5(`${results[4].Driver.givenName} ${results[4].Driver.familyName}`);
        setResultMessage({ message: "¡Resultados de carrera sincronizados!" });
      }

      // 2. Fetch Pole (Qualifying)
      const resQual = await fetch(`https://api.jolpi.ca/ergast/f1/2026/${selectedRound}/qualifying.json`);
      const dataQual = await resQual.json();
      const qResults = dataQual.MRData.RaceTable.Races[0]?.QualifyingResults;
      if (qResults && qResults[0]) {
        setPole(`${qResults[0].Driver.givenName} ${qResults[0].Driver.familyName}`);
        setResultMessage((prev: any) => ({ ...prev, message: (prev?.message || "") + " ¡Pole position sincronizada!" }));
      }

      if (!results && !qResults) {
        setResultMessage({ error: "No hay datos oficiales todavía para este GP en la API de la FIA." });
      }
    } catch (err) {
      console.error(err);
      setResultMessage({ error: "Error conectando con la API de la FIA." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRound) return;
    setSubmitting(true);
    setResultMessage(null);
    try {
      const res = await fetchWithAuth('/api/admin/results', {
        method: 'POST',
        body: JSON.stringify({ race_round: Number(selectedRound), session_type: selectedSession, p1, p2, p3, p4, p5, pole_position: sessionCfg.hasPole ? pole : undefined })
      });
      const data = await res.json();
      setResultMessage(data);
    } catch (err) {
      console.error(err);
      setResultMessage({ error: 'Error procesando resultados' });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedRaceName = races.find(r => String(r.round) === selectedRound)?.name || '';

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <header>
        <h1 className="text-4xl font-display font-bold text-white mb-2">Panel de Administración <span className="text-codeflow-accent">⚙️</span></h1>
        <p className="text-codeflow-muted text-lg">Cargá los resultados oficiales de cada GP para calcular los puntajes automáticamente.</p>
      </header>

      <div className="glass-card p-8 max-w-2xl">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Settings size={22} className="text-codeflow-accent" /> Cargar Resultados Oficiales
        </h3>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs uppercase font-bold text-codeflow-muted tracking-wider mb-1">Seleccionar Carrera</label>
            <select value={selectedRound} onChange={e => { setSelectedRound(e.target.value); setResultMessage(null); }} required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-codeflow-accent appearance-none cursor-pointer">
              <option value="" disabled className="bg-codeflow-dark text-codeflow-muted">Elegir GP...</option>
              {races.map(r => (
                <option key={r.round} value={r.round} className="bg-codeflow-dark text-white">
                  Ronda {r.round} — {r.name}
                </option>
              ))}
            </select>
          </div>

          {selectedRound && (
            <>
              {/* Session selector */}
              <div>
                <label className="block text-xs uppercase font-bold text-codeflow-muted tracking-wider mb-2">Tipo de Sesión</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(SESSION_CONFIG) as any[]).map(([key, cfg]: any) => (
                    <button key={key} type="button"
                      onClick={() => { setSelectedSession(key as any); setResultMessage(null); setPole(''); setP1(''); setP2(''); setP3(''); setP4(''); setP5(''); }}
                      className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${selectedSession === key ? 'bg-codeflow-accent/20 text-codeflow-accent border-codeflow-accent/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'border-white/10 text-codeflow-muted hover:border-white/20'}`}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center bg-codeflow-accent/10 border border-codeflow-accent/20 p-4 rounded-xl">
                <div className="flex flex-col">
                  <p className="text-sm text-codeflow-accent font-semibold">{selectedRaceName} · {sessionCfg.label}</p>
                  <p className="text-[10px] text-codeflow-muted uppercase tracking-tighter">Sincronización automática disponible</p>
                </div>
                <button
                  type="button"
                  onClick={fetchOfficialResults}
                  className="bg-codeflow-accent/20 hover:bg-codeflow-accent/30 text-codeflow-accent text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 border border-codeflow-accent/30"
                >
                  <RefreshCw size={14} className={submitting ? 'animate-spin' : ''} />
                  Sincronizar con API Oficial
                </button>
              </div>

              {/* Pole - only for race */}
              {sessionCfg.hasPole && (
                <div>
                  <label className="block text-xs uppercase font-bold text-codeflow-muted tracking-wider mb-1">Pole Position</label>
                  <select value={pole} onChange={e => setPole(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-codeflow-accent appearance-none cursor-pointer">
                    <option value="" disabled className="bg-codeflow-dark text-codeflow-muted">Poleman oficial...</option>
                    {DRIVERS.map(d => <option key={d} value={d} className="bg-codeflow-dark text-white">{d}</option>)}
                  </select>
                </div>
              )}

              {/* Dynamic position fields */}
              <div className="space-y-2">
                <label className="block text-xs uppercase font-bold text-codeflow-accent/70 tracking-wider">
                  Posiciones Oficiales — {sessionCfg.label}
                </label>
                {[
                  { key: 'p1', label: '1°', v: p1, s: setP1, c: 'border-yellow-500/30 focus:border-yellow-500 bg-yellow-500/5' },
                  { key: 'p2', label: '2°', v: p2, s: setP2, c: 'border-gray-400/30 focus:border-gray-400 bg-gray-400/5' },
                  { key: 'p3', label: '3°', v: p3, s: setP3, c: 'border-orange-500/30 focus:border-orange-500 bg-orange-500/5' },
                  { key: 'p4', label: '4°', v: p4, s: setP4, c: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
                  { key: 'p5', label: '5°', v: p5, s: setP5, c: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
                ].filter(f => (sessionCfg.fields as readonly string[]).includes(f.key)).map((item) => (
                  <div key={item.key} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white/50 w-8 shrink-0">{item.label}</span>
                    <select value={item.v} onChange={e => item.s(e.target.value)} required className={`flex-1 rounded-lg px-3 py-2 text-white outline-none border ${item.c} appearance-none cursor-pointer`}>
                      <option value="" disabled className="bg-codeflow-dark text-codeflow-muted">Elegir piloto...</option>
                      {DRIVERS.map(d => <option key={d} value={d} className="bg-codeflow-dark text-white">{d}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all shadow-lg mt-4 disabled:opacity-50">
                {submitting ? 'Procesando puntajes...' : `🏁 Procesar ${sessionCfg.label} y Calcular Puntajes`}
              </button>
            </>
          )}
        </form>

        {resultMessage && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30">
            {resultMessage.error ? (
              <p className="text-red-400 font-medium">{resultMessage.error}</p>
            ) : (
              <>
                <p className="text-green-400 font-bold mb-2">✅ {resultMessage.message}</p>
                <p className="text-codeflow-muted text-sm mb-3">Predicciones procesadas: {resultMessage.totalPredictions}</p>
                {resultMessage.scoreUpdates?.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">Puntajes otorgados:</p>
                    {resultMessage.scoreUpdates.map((u: any) => (
                      <p key={u.player} className="text-sm text-codeflow-text">
                        <span className="font-bold text-codeflow-accent">{u.player}</span>: +{u.scored} pts
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-codeflow-muted italic">Nadie acertó esta vez. 😅</p>
                )}
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default App;