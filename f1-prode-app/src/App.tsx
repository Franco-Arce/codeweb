import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Film, Gamepad2, Tv, LayoutDashboard, Settings,
  RefreshCw, MessageSquare, User, Calendar, Clock, MapPin, Zap, ChevronRight
} from 'lucide-react';
import logoCodeflow from './assets/LogoOnly.png';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
    // Check auth
    const token = localStorage.getItem('prode_auth_token');
    if (token === 'f1_pepe_logged_in_token') {
      setIsAuthenticated(true);
    } else {
      // Remove stale tokens to force re-login if needed
      localStorage.removeItem('prode_auth_token');
    }
    setIsLoading(false);
  }, []);

  if (isLoading) return <div className="min-h-screen bg-codeflow-dark flex items-center justify-center">Loading...</div>;

  if (!isAuthenticated) {
    return <LoginView onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-codeflow-dark relative flex overflow-hidden">
      {/* Background Animated Blobs for premium effect */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-codeflow-accent/10 rounded-full mix-blend-lighten filter blur-[140px] animate-blob" />
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[30%] bg-fuchsia-600/10 rounded-full mix-blend-lighten filter blur-[140px] animate-blob animation-delay-2000" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] bg-purple-800/10 rounded-full mix-blend-lighten filter blur-[150px] animate-blob animation-delay-4000" />

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCI+CjxwYXRoIGQ9Ik00MCAwaC0xTDBWMGgxbDM5LS4wMVoiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz4KPC9zdmc+')] opacity-10" />
      </div>

      <aside className="w-64 border-r border-white/5 bg-codeflow-base/80 backdrop-blur-3xl z-10 flex flex-col h-screen">
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <img src={logoCodeflow} alt="CodeWeb" className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
          <h1 className="font-display font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            CodeWeb
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Panel Principal" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-codeflow-muted tracking-wider uppercase">Deportes</div>
          <NavItem icon={<Trophy size={20} />} label="F1" active={activeTab === 'f1'} onClick={() => setActiveTab('f1')} />
          <div className="pt-4 pb-2 px-3 text-xs font-semibold text-codeflow-muted tracking-wider uppercase">Bóveda Multimedia</div>
          <NavItem icon={<Tv size={20} />} label="Series" active={activeTab === 'series'} onClick={() => setActiveTab('series')} />
          <NavItem icon={<Tv size={20} />} label="Animes" active={activeTab === 'animes'} onClick={() => setActiveTab('animes')} />
          <NavItem icon={<Film size={20} />} label="Películas" active={activeTab === 'movies'} onClick={() => setActiveTab('movies')} />
          <NavItem icon={<Gamepad2 size={20} />} label="Juegos de Mesa" active={activeTab === 'games'} onClick={() => setActiveTab('games')} />
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2">
          <button onClick={() => setActiveTab('admin')} className={`flex items-center gap-3 px-3 py-2 w-full rounded-lg transition-colors ${activeTab === 'admin' ? 'text-white bg-white/10' : 'text-codeflow-muted hover:text-white hover:bg-white/5'}`}>
            <Settings size={20} />
            <span className="font-medium">Admin Panel</span>
          </button>
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
            {activeTab === 'admin' && <AdminView />}
            {['series', 'animes', 'movies', 'games'].includes(activeTab) && (
              <MediaVaultView tab={activeTab} />
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
        setError(data.message || 'Bandera negra: Credenciales inválidas');
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

        <h1 className="text-3xl font-display font-bold text-white mb-2">Acceso al Paddock</h1>
        <p className="text-codeflow-muted mb-8 text-center">Sistema Interno F1 Prode</p>

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
  const [countdown, setCountdown] = React.useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

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

    fetchWithAuth('/api/races/next')
      .then(res => res.json())
      .then(data => setNextRace(data))
      .catch(err => console.error("Error cargando próxima carrera:", err));
  }, []);

  // Real-time countdown
  React.useEffect(() => {
    if (!nextRace) return;
    const tick = () => {
      const now = new Date().getTime();
      const target = new Date(nextRace.date).getTime();
      const diff = Math.max(0, target - now);
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [nextRace]);

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <header>
        <h1 className="text-4xl font-display font-bold text-white mb-2">Bienvenido a CodeWeb <span className="text-codeflow-accent">🚀</span></h1>
        <p className="text-codeflow-muted text-lg">Tu plataforma centralizada para deportes, métricas y entretenimiento multimedia.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Next Race Card */}
        <div className="glass-card p-6 md:col-span-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-codeflow-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div>
              <span className="px-3 py-1 rounded-full bg-codeflow-accent/20 text-codeflow-accent text-sm font-semibold border border-codeflow-accent/30 mb-4 inline-block">Siguiente Carrera</span>
              <h2 className="text-2xl font-display font-bold text-white">
                {nextRace ? nextRace.name : 'Cargando...'}
              </h2>
              <p className="text-codeflow-muted mt-1">
                {nextRace ? `${nextRace.circuit}, ${nextRace.city}` : ''}
              </p>
              {nextRace?.sprint && (
                <span className="mt-2 inline-block text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded font-bold uppercase">Fin de Semana Sprint</span>
              )}
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold font-display text-white tabular-nums">
                {pad(countdown.days)} : {pad(countdown.hours)} : {pad(countdown.minutes)} : {pad(countdown.seconds)}
              </div>
              <p className="text-codeflow-muted text-sm">Días : Hrs : Min : Seg</p>
            </div>
          </div>

          <div className="relative z-10">
            <button className="btn-primary w-full md:w-auto">
              Cargar Pronósticos
            </button>
          </div>
        </div>

        {/* Prode Leaderboard Snapshot */}
        <div className="glass-card p-6 relative flex flex-col">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy size={18} className="text-yellow-500" /> Top Analistas
          </h3>
          <div className="space-y-4 flex-1 flex flex-col justify-center">
            {loading ? (
              <div className="text-center text-codeflow-muted text-sm animate-pulse flex flex-col items-center gap-2 py-4">
                <div className="w-6 h-6 border-2 border-codeflow-accent border-t-transparent rounded-full animate-spin"></div>
                Cargando métricas en vivo...
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-sm text-codeflow-muted text-center my-auto">Revisa la pestaña F1 para ver la tabla completa.</p>
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
          <button className="text-sm text-codeflow-muted hover:text-white mt-auto transition-colors pt-4">Ver posiciones completas →</button>
        </div>
      </div>
    </div>
  );
}

function F1ProdeView() {
  const [f1Tab, setF1Tab] = React.useState('prode'); // 'prode', 'leaderboard', 'calendar'

  const [oracleInsight, setOracleInsight] = React.useState<string | null>(null);
  const [loadingOracle, setLoadingOracle] = React.useState(false);
  const [nextRace, setNextRace] = React.useState<any>(null);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState('');

  // Form State
  const [pName, setPName] = React.useState('');
  const [pPole, setPPole] = React.useState('');
  const [p1, setP1] = React.useState('');
  const [p2, setP2] = React.useState('');
  const [p3, setP3] = React.useState('');
  const [p4, setP4] = React.useState('');
  const [p5, setP5] = React.useState('');

  // --- Constantes y Estados Dinámicos ---
  const USERS = ["MrKazter", "Eliana", "NestorMcNestor", "GuilleGb", "Rubiola", "Colorado", "MrFori"];
  const [DRIVERS, setDRIVERS] = React.useState<string[]>([
    "Max Verstappen", "Lando Norris", "Charles Leclerc", "Carlos Sainz", "Oscar Piastri",
    "Lewis Hamilton", "George Russell", "Fernando Alonso", "Lance Stroll", "Yuki Tsunoda",
    "Liam Lawson", "Nico Hülkenberg", "Esteban Ocon", "Pierre Gasly", "Jack Doohan",
    "Alexander Albon", "Franco Colapinto", "Oliver Bearman", "Andrea Kimi Antonelli", "Gabriel Bortoleto"
  ]);

  React.useEffect(() => {
    // Fetch next race info
    fetchWithAuth('/api/races/next')
      .then(res => res.json())
      .then(data => setNextRace(data))
      .catch(err => console.error("Error cargando próxima carrera:", err));

    // Fetch Drivers de la API Oficial Ergast F1 (Fork Jolpi 2026+)
    fetch('https://api.jolpi.ca/ergast/f1/2026/drivers.json')
      .then(res => res.json())
      .then(data => {
        const d = data.MRData.DriverTable.Drivers.map((driver: any) => `${driver.givenName} ${driver.familyName}`);
        setDRIVERS(d.sort());
      })
      .catch(err => {
        console.error("Error trayendo lista oficial de la FIA:", err);
      });

    setLoadingOracle(true);
    fetchWithAuth('/api/oracle/roast')
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falla en el backend del oráculo");
        return data;
      })
      .then(data => {
        setOracleInsight(data.analysis || "No tengo palabras...");
        setLoadingOracle(false);
      })
      .catch(err => {
        console.error("Oráculo caído", err);
        setOracleInsight("El oráculo tuvo una falla en su motor lógico. Volvé a intentarlo en breve.");
        setLoadingOracle(false);
      });
  }, []);

  const handlePredictSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccess('');

    try {
      const res = await fetchWithAuth('/api/predictions', {
        method: 'POST',
        body: JSON.stringify({
          player: pName,
          pole_position: pPole,
          p1, p2, p3, p4, p5
        })
      });
      if (!res.ok) throw new Error("Falla al guardar métricas");

      setSuccess('¡Pronóstico guardado en boxes! 🏎️💨');
      setPName(''); setPPole(''); setP1(''); setP2(''); setP3(''); setP4(''); setP5('');
    } catch (err) {
      console.error(err);
      alert("Error de motor guardando el pronóstico. Intenta verificar la conexión.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header F1 & Nav Tabs */}
      <header className="flex flex-col gap-6 mb-8">
        <div className="flex justify-between items-end">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center p-2 shadow-lg">
              <img src={logoCodeflow} alt="F1 Codeflow" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]" />
            </div>
            <div>
              <h1 className="text-4xl font-display font-bold text-white mb-2">Formula 1 HUB</h1>
              <p className="text-codeflow-muted text-lg">
                {nextRace ? `Próxima parada: ${nextRace.name} — ${nextRace.circuit}` : 'Métricas impulsadas por IA, predicciones del finde y tabla oficial.'}
              </p>
            </div>
          </div>
          <button className="btn-secondary">
            Reglas del Campeonato
          </button>
        </div>

        {/* F1 Sub-Navigation */}
        <div className="flex border-b border-white/10 w-full overflow-x-auto gap-8">
          <button
            onClick={() => setF1Tab('prode')}
            className={`pb-3 font-semibold transition-colors relative whitespace-nowrap ${f1Tab === 'prode' ? 'text-codeflow-accent' : 'text-codeflow-muted hover:text-white'}`}>
            Cargar Predicciones (Prode)
            {f1Tab === 'prode' && <motion.div layoutId="f1ActiveLine" className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-codeflow-accent" />}
          </button>
          <button
            onClick={() => setF1Tab('leaderboard')}
            className={`pb-3 font-semibold transition-colors relative whitespace-nowrap ${f1Tab === 'leaderboard' ? 'text-codeflow-accent' : 'text-codeflow-muted hover:text-white'}`}>
            Tabla de Analistas Oficial
            {f1Tab === 'leaderboard' && <motion.div layoutId="f1ActiveLine" className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-codeflow-accent" />}
          </button>
          <button
            onClick={() => setF1Tab('calendar')}
            className={`pb-3 font-semibold transition-colors relative whitespace-nowrap ${f1Tab === 'calendar' ? 'text-codeflow-accent' : 'text-codeflow-muted hover:text-white'}`}>
            Calendario Oficial (Hora AR)
            {f1Tab === 'calendar' && <motion.div layoutId="f1ActiveLine" className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-codeflow-accent" />}
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

              {/* Prediction Forms and Leaderboard sections will go here */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Prediction Form */}
                <div className="glass-card p-6 flex flex-col">
                  <div className="flex items-center gap-3 mb-6 border-b border-white/5 pb-4">
                    <Trophy size={24} className="text-codeflow-accent" />
                    <h3 className="text-xl font-bold text-white">Enviar Valoraciones</h3>
                  </div>

                  <form onSubmit={handlePredictSubmit} className="space-y-4 flex-1">
                    <div>
                      <label className="block text-xs uppercase font-bold text-codeflow-muted tracking-wider mb-1">Nombre Jugador</label>
                      <select value={pName} onChange={e => setPName(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-codeflow-accent appearance-none cursor-pointer">
                        <option value="" disabled className="bg-codeflow-dark text-codeflow-muted">Seleccioná tu usuario...</option>
                        {USERS.map(u => <option key={u} value={u} className="bg-codeflow-dark text-white">{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs uppercase font-bold text-codeflow-muted tracking-wider mb-1 flex justify-between">
                        <span>Pole Position (Sábado)</span>
                        <span className="text-codeflow-accent/60">+5 pts</span>
                      </label>
                      <select value={pPole} onChange={e => setPPole(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-codeflow-accent appearance-none cursor-pointer">
                        <option value="" disabled className="bg-codeflow-dark text-codeflow-muted">Seleccioná al Poleman...</option>
                        {DRIVERS.map(d => <option key={d} value={d} className="bg-codeflow-dark text-white">{d}</option>)}
                      </select>
                    </div>

                    <div className="pt-2">
                      <label className="block text-xs uppercase font-bold text-codeflow-accent/70 tracking-wider mb-3">Top 5 Domingo (10 pts c/u)</label>
                      <div className="space-y-2">
                        {[
                          { l: '1° (Ganador)', v: p1, s: setP1, c: 'border-yellow-500/30 focus:border-yellow-500 bg-yellow-500/5' },
                          { l: '2° Puesto', v: p2, s: setP2, c: 'border-gray-400/30 focus:border-gray-400 bg-gray-400/5' },
                          { l: '3° Puesto', v: p3, s: setP3, c: 'border-orange-500/30 focus:border-orange-500 bg-orange-500/5' },
                          { l: '4° Puesto', v: p4, s: setP4, c: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
                          { l: '5° Puesto', v: p5, s: setP5, c: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-sm font-bold text-white/50 w-24">{item.l}</span>
                            <select value={item.v} onChange={e => item.s(e.target.value)} required className={`flex-1 rounded-lg px-3 py-2 text-white outline-none border ${item.c} appearance-none cursor-pointer`}>
                              <option value="" disabled className="bg-codeflow-dark text-codeflow-muted">Elegir piloto...</option>
                              {DRIVERS.map(d => <option key={d} value={d} className="bg-codeflow-dark text-white">{d}</option>)}
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4">
                      {success && <p className="text-sm text-green-400 mb-3 text-center">{success}</p>}
                      <button type="submit" disabled={isSubmitting} className="w-full bg-white/10 border border-white/20 hover:bg-white/20 hover:border-codeflow-accent/50 text-white font-bold py-3 rounded-lg transition-colors">
                        {isSubmitting ? 'Enviando telemetría...' : 'Enviar Pronóstico'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {f1Tab === 'leaderboard' && (
            <F1LeaderboardTab />
          )}

          {f1Tab === 'calendar' && (
            <F1CalendarTab />
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

// --- Media Vault Component ---
function MediaVaultView({ tab }: { tab: string }) {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showForm, setShowForm] = React.useState(false);
  const [selectedGenre, setSelectedGenre] = React.useState('All');

  // Form states
  const [formData, setFormData] = React.useState({ recommender: '', name: '', genre: '', description: '', rating: '', game_type: '', players: '', duration: '', difficulty: '', notes: '' });
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const endpointTab = tab === 'games' ? 'boardgames' : tab;

  const fetchMedia = () => {
    setLoading(true);
    fetchWithAuth(`/api/media/${endpointTab}`)
      .then(res => res.json())
      .then(data => { setItems(data); setLoading(false); })
      .catch(err => { console.error('Error fetching media:', err); setLoading(false); });
  };

  const isGame = tab === 'games';

  React.useEffect(() => {
    fetchMedia();
    setShowForm(false);
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
    try {
      const res = await fetchWithAuth(`/api/media/${endpointTab}`, {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setShowForm(false);
        setFormData({ recommender: '', name: '', genre: '', description: '', rating: '', game_type: '', players: '', duration: '', difficulty: '', notes: '' });
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
          <button className="btn-primary w-full sm:w-auto whitespace-nowrap" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : 'Añadir Nuevo'}
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass-card p-6 mb-8 border border-codeflow-accent/40 bg-codeflow-card/95">
              <h3 className="text-xl font-bold text-white mb-4">Añadir a la Bóveda de {translations[tab]}</h3>
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!isGame && (
                  <>
                    <input type="text" placeholder="Recomendado por..." required className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.recommender} onChange={e => setFormData({ ...formData, recommender: e.target.value })} />
                    <input type="text" placeholder="Nombre completo" required className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    <input type="text" placeholder="Género (Ej: Comedia, Acción)" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.genre} onChange={e => setFormData({ ...formData, genre: e.target.value })} />
                    <input type="text" placeholder="Rating (Ej: Obra Maestra, Mediocre)" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.rating} onChange={e => setFormData({ ...formData, rating: e.target.value })} />
                    <textarea placeholder="¿De qué trata? / Sinopsis breve" required className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent md:col-span-2 min-h-[100px]" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                  </>
                )}
                {isGame && (
                  <>
                    <input type="text" placeholder="Nombre del Juego" required className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    <input type="text" placeholder="Tipo (Estrategia, Cartas, etc)" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.game_type} onChange={e => setFormData({ ...formData, game_type: e.target.value })} />
                    <input type="text" placeholder="Jugadores (Ej: 2-5)" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.players} onChange={e => setFormData({ ...formData, players: e.target.value })} />
                    <input type="text" placeholder="Duración (Ej: 60 min)" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} />
                    <input type="text" placeholder="Dificultad (Ej: Media, Familiar)" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: e.target.value })} />
                    <textarea placeholder="Notas / Impresiones" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent md:col-span-2 min-h-[100px]" value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
                  </>
                )}
                <div className="md:col-span-2 flex justify-end mt-2">
                  <button type="submit" disabled={isSubmitting} className="btn-primary w-full md:w-auto">
                    {isSubmitting ? 'Guardando en la bóveda...' : 'Añadir Item'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-48 glass-card animate-pulse bg-white/5 border-white/5" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 text-codeflow-muted text-xl border-2 border-dashed border-white/10 rounded-2xl">
          No hay elementos que coincidan con la búsqueda.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredItems.map((item, i) => (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} key={item.id} className="glass-card p-6 flex flex-col items-start gap-4 hover:border-codeflow-accent/40 group">
              <div className="flex justify-between items-start w-full gap-2">
                <h3 className="text-xl font-bold text-white group-hover:text-codeflow-accent transition-colors leading-tight">{item.name}</h3>
                {!isGame && <span className="text-xs font-bold px-2 py-1 rounded-full bg-white/10 text-white/70 whitespace-nowrap shrink-0">{item.rating || 'Sin nota'}</span>}
              </div>

              {!isGame ? (
                <>
                  {item.genre && (
                    <div className="flex flex-wrap gap-2">
                      {item.genre.split(',').map((g: string) => <span key={g} className={`text-xs font-semibold px-2 py-1 rounded-md ${getGenreColor(g.trim())}`}>{g.trim()}</span>)}
                    </div>
                  )}
                  <p className="text-sm text-codeflow-text/80 italic flex-1">{item.description}</p>
                  <div className="w-full pt-4 mt-auto border-t border-white/5 text-xs text-codeflow-muted flex justify-between items-center">
                    <span>Recomendó: <strong className="text-white">{item.recommender}</strong></span>
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {item.game_type && <span className={`text-xs font-semibold px-2 py-1 rounded-md ${getGenreColor(item.game_type)}`}>{item.game_type}</span>}
                    {item.difficulty && <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md">{item.difficulty}</span>}
                    {item.players && <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-2 py-1 rounded-md">{item.players} Jug.</span>}
                    {item.duration && <span className="text-xs font-semibold text-orange-400 bg-orange-500/10 px-2 py-1 rounded-md">⏱ {item.duration}</span>}
                  </div>
                  {item.notes && <p className="text-sm text-codeflow-text/80 italic flex-1">{item.notes}</p>}
                </>
              )}
            </motion.div>
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

                <div className="mt-auto border-t border-white/10 pt-4 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white/50">Día de Carrera</span>
                    <span className="text-sm font-bold text-white">
                      {dateObj.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs font-semibold text-white/50">Hora ARG</span>
                    <span className="text-sm font-bold text-white">
                      {dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
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
// --- Admin Panel Component ---
function AdminView() {
  const [races, setRaces] = React.useState<any[]>([]);
  const [selectedRound, setSelectedRound] = React.useState('');
  const [pole, setPole] = React.useState('');
  const [p1, setP1] = React.useState('');
  const [p2, setP2] = React.useState('');
  const [p3, setP3] = React.useState('');
  const [p4, setP4] = React.useState('');
  const [p5, setP5] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [resultMessage, setResultMessage] = React.useState<any>(null);

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
        body: JSON.stringify({ race_round: Number(selectedRound), p1, p2, p3, p4, p5, pole_position: pole })
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
              <div className="flex justify-between items-center bg-codeflow-accent/10 border border-codeflow-accent/20 p-4 rounded-xl mb-4">
                <div className="flex flex-col">
                  <p className="text-sm text-codeflow-accent font-semibold">{selectedRaceName}</p>
                  <p className="text-[10px] text-codeflow-muted uppercase tracking-tighter">Sincronización automática disponible</p>
                </div>
                <button
                  type="button"
                  onClick={fetchOfficialResults}
                  className="bg-codeflow-accent/20 hover:bg-codeflow-accent/30 text-codeflow-accent text-xs font-bold px-4 py-2 rounded-lg transition-colors flex items-center gap-2 border border-codeflow-accent/30"
                >
                  <RefreshCw size={14} className={submitting ? 'animate-spin' : ''} />
                  Sincronizar con API OfficiaL
                </button>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-codeflow-muted tracking-wider mb-1">Pole Position</label>
                <select value={pole} onChange={e => setPole(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-codeflow-accent appearance-none cursor-pointer">
                  <option value="" disabled className="bg-codeflow-dark text-codeflow-muted">Poleman oficial...</option>
                  {DRIVERS.map(d => <option key={d} value={d} className="bg-codeflow-dark text-white">{d}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs uppercase font-bold text-codeflow-accent/70 tracking-wider">Top 5 Oficial</label>
                {[
                  { l: '1° Ganador', v: p1, s: setP1, c: 'border-yellow-500/30 focus:border-yellow-500 bg-yellow-500/5' },
                  { l: '2° Puesto', v: p2, s: setP2, c: 'border-gray-400/30 focus:border-gray-400 bg-gray-400/5' },
                  { l: '3° Puesto', v: p3, s: setP3, c: 'border-orange-500/30 focus:border-orange-500 bg-orange-500/5' },
                  { l: '4° Puesto', v: p4, s: setP4, c: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
                  { l: '5° Puesto', v: p5, s: setP5, c: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white/50 w-24">{item.l}</span>
                    <select value={item.v} onChange={e => item.s(e.target.value)} required className={`flex-1 rounded-lg px-3 py-2 text-white outline-none border ${item.c} appearance-none cursor-pointer`}>
                      <option value="" disabled className="bg-codeflow-dark text-codeflow-muted">Elegir piloto...</option>
                      {DRIVERS.map(d => <option key={d} value={d} className="bg-codeflow-dark text-white">{d}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <button type="submit" disabled={submitting} className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all shadow-lg mt-4 disabled:opacity-50">
                {submitting ? 'Procesando resultados y puntajes...' : '🏁 Procesar Resultados y Calcular Puntajes'}
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
