import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Film, Gamepad2, Tv, LayoutDashboard, Settings } from 'lucide-react';
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
          <button className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-codeflow-muted hover:text-white hover:bg-white/5 transition-colors">
            <Settings size={20} />
            <span className="font-medium">Configuración</span>
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
        <div className="w-20 h-20 mb-6 bg-gradient-to-br from-codeflow-accent to-fuchsia-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.5)] p-2">
          <img src={logoCodeflow} alt="Logo" className="w-full h-full object-contain filter drop-shadow-md" />
        </div>

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
    <div className="space-y-8 animate-fade-in pb-12">
      <header>
        <h1 className="text-4xl font-display font-bold text-white mb-2">¡Eje Central de la Tribuna! <span className="text-codeflow-accent">🏎️</span></h1>
        <p className="text-codeflow-muted text-lg">Tu centro de métricas unificado para pronósticos F1 y recomendaciones grupales.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Next Race Card */}
        <div className="glass-card p-6 md:col-span-2 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-codeflow-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="flex justify-between items-start mb-8 relative z-10">
            <div>
              <span className="px-3 py-1 rounded-full bg-codeflow-accent/20 text-codeflow-accent text-sm font-semibold border border-codeflow-accent/30 mb-4 inline-block">Siguiente Carrera</span>
              <h2 className="text-2xl font-display font-bold text-white">Gran Premio de Australia</h2>
              <p className="text-codeflow-muted mt-1">Circuito de Albert Park, Melbourne</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold font-display text-white">04 : 12 : 35</div>
              <p className="text-codeflow-muted text-sm">Días : Hrs : Min</p>
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

  React.useEffect(() => {
    setLoadingOracle(true);
    fetchWithAuth('/api/oracle/roast')
      .then(res => res.json())
      .then(data => {
        setOracleInsight(data.analysis);
        setLoadingOracle(false);
      })
      .catch(err => {
        console.error("Oráculo caído", err);
        setOracleInsight("El oráculo tuvo una falla en el motor (Servidor Caído). Probablemente sea culpa de Sargeant.");
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
              <p className="text-codeflow-muted text-lg">Métricas impulsadas por IA, predicciones del finde y tabla oficial.</p>
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
                      <label className="block text-xs uppercase font-bold text-codeflow-muted tracking-wider mb-1">Nombre Jugador (Debe ser exacto)</label>
                      <input type="text" value={pName} onChange={e => setPName(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-codeflow-accent" placeholder="Ej: MrKazter" />
                    </div>
                    <div>
                      <label className="block text-xs uppercase font-bold text-codeflow-muted tracking-wider mb-1 flex justify-between">
                        <span>Pole Position (Sábado)</span>
                        <span className="text-codeflow-accent/60">+5 pts</span>
                      </label>
                      <input type="text" value={pPole} onChange={e => setPPole(e.target.value)} required className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-codeflow-accent" placeholder="Piloto" />
                    </div>

                    <div className="pt-2">
                      <label className="block text-xs uppercase font-bold text-purple-400 tracking-wider mb-3">Top 5 Domingo (10 pts c/u)</label>
                      <div className="space-y-2">
                        {[
                          { l: '1° (Ganador)', v: p1, s: setP1, c: 'border-yellow-500/50 focus:border-yellow-500 bg-yellow-500/5' },
                          { l: '2° Puesto', v: p2, s: setP2, c: 'border-gray-400/50 focus:border-gray-400 bg-gray-400/5' },
                          { l: '3° Puesto', v: p3, s: setP3, c: 'border-orange-500/50 focus:border-orange-500 bg-orange-500/5' },
                          { l: '4° Puesto', v: p4, s: setP4, c: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
                          { l: '5° Puesto', v: p5, s: setP5, c: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-sm font-bold text-white/50 w-24">{item.l}</span>
                            <input type="text" value={item.v} onChange={e => item.s(e.target.value)} required className={`flex-1 rounded-lg px-3 py-1.5 text-white outline-none border ${item.c}`} placeholder="Piloto" />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4">
                      {success && <p className="text-sm text-green-400 mb-3 text-center">{success}</p>}
                      <button type="submit" disabled={isSubmitting} className="w-full bg-codeflow-accent hover:bg-codeflow-accent/80 text-white font-bold py-3 rounded-lg transition-colors">
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
            <div className="glass-card p-10 flex flex-col items-center justify-center min-h-[400px]">
              <span className="text-6xl mb-4 grayscale opacity-50">🏁</span>
              <h3 className="text-2xl font-bold text-white mb-2">Calendario en boxes...</h3>
              <p className="text-codeflow-muted max-w-md text-center">Estamos sincronizando la telemetría con la FIA para descargar el calendario oficial con los horarios de Argentina.</p>
            </div>
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

export default App;
