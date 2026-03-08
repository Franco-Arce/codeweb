import React, { useState, useCallback, useContext, createContext } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Film, Gamepad2, Tv, LayoutDashboard, Settings,
  RefreshCw, AlertCircle, CheckCircle, XCircle, Edit2, Trash2,
  Star, Info, Dices, Sparkles, Lock, ShieldAlert, Ghost, ChevronDown
} from 'lucide-react';
const Diced = Gamepad2; // Fallback or Alias if needed
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import logoCodeflow from './assets/LogoOnly.png';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// --- Countdown Hook ---
function useCountdown(targetUtc: string | null): string {
  const [display, setDisplay] = React.useState('');
  React.useEffect(() => {
    if (!targetUtc) { setDisplay(''); return; }
    const update = () => {
      const diff = new Date(targetUtc).getTime() - Date.now();
      if (diff <= 0) { setDisplay('CERRADO'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setDisplay(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetUtc]);
  return display;
}

// --- Toast System ---
type Toast = { id: number; type: 'success' | 'error' | 'warning'; message: string };
const ToastContext = createContext<{ addToast: (type: Toast['type'], message: string) => void }>({ addToast: () => { } });
const useToast = () => useContext(ToastContext);

// --- Profiles Context ---
type UserProfile = { username: string; avatar_seed: string };
const ProfilesContext = createContext<{
  profiles: Record<string, string>;
  updateAvatar: (username: string, seed: string) => Promise<void>;
  refreshProfiles: () => void;
}>({ profiles: {}, updateAvatar: async () => { }, refreshProfiles: () => { } });
const useProfiles = () => useContext(ProfilesContext);

// --- Navigation Context ---
const ActiveTabContext = createContext<(tab: string) => void>(() => { });

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
      <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-50 flex flex-col gap-2 pointer-events-none">
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

function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const { addToast } = useToast();

  const fetchProfiles = useCallback(() => {
    fetchWithAuth('/api/profiles')
      .then(r => r.json())
      .then((data: UserProfile[]) => {
        const map: Record<string, string> = {};
        data.forEach(p => { map[p.username] = p.avatar_seed; });
        setProfiles(map);
      })
      .catch(err => console.error("Error fetching profiles:", err));
  }, []);

  const updateAvatar = async (username: string, seed: string) => {
    try {
      const res = await fetchWithAuth('/api/profiles', {
        method: 'POST',
        body: JSON.stringify({ username, avatar_seed: seed })
      });
      if (res.ok) {
        setProfiles(prev => ({ ...prev, [username]: seed }));
        addToast('success', `Avatar actualizado para ${username}`);
      }
    } catch (err) {
      addToast('error', 'Falla al guardar avatar');
    }
  };

  React.useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return (
    <ProfilesContext.Provider value={{ profiles, updateAvatar, refreshProfiles: fetchProfiles }}>
      {children}
    </ProfilesContext.Provider>
  );
}

// --- Avatar Picker Component ---
function AvatarPicker({ isOpen, onClose, username, currentSeed }: { isOpen: boolean, onClose: () => void, username: string, currentSeed?: string }) {
  const { updateAvatar } = useProfiles();
  const [selected, setSelected] = useState(currentSeed || username);
  const [randomSeeds, setRandomSeeds] = useState<Record<string, string>>({});

  const STYLES = [
    { id: 'adventurer', label: 'Aventurero' },
    { id: 'avataaars', label: 'Persona' },
    { id: 'fun-emoji', label: 'Emoji' },
    { id: 'pixel-art', label: 'Pixel' },
    { id: 'lorelei', label: 'Anime' },
    { id: 'notionists', label: 'Notion' },
    { id: 'open-peeps', label: 'Doodley' },
    { id: 'bottts', label: 'Robot' },
    { id: 'croodles', label: 'Garabato' },
    { id: 'micah', label: 'Micah' },
    { id: 'personas', label: 'Persona 3D' },
    { id: 'rings', label: 'Rings' },
  ];

  const shuffleOne = (styleId: string) => {
    setRandomSeeds(prev => ({ ...prev, [styleId]: Math.random().toString(36).substring(7) }));
  };

  const handleShuffleAll = () => {
    const newSeeds: Record<string, string> = {};
    STYLES.forEach(s => { newSeeds[s.id] = Math.random().toString(36).substring(7); });
    setRandomSeeds(newSeeds);
  };

  const currentOptions = STYLES.map(s => {
    const seedValue = randomSeeds[s.id] || username;
    return { seed: `${s.id}:${seedValue}`, label: s.label, styleId: s.id };
  });

  const selectedStyle = selected.includes(':') ? selected.split(':')[0] : 'notionists';
  const selectedSeedVal = selected.includes(':') ? selected.split(':')[1] : selected;
  const previewUrl = `https://api.dicebear.com/7.x/${selectedStyle}/svg?seed=${selectedSeedVal}`;

  const handleSave = () => {
    updateAvatar(username, selected);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-codeflow-dark/80 backdrop-blur-md" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
            className="relative bg-codeflow-card border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '90vh' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Sparkles size={20} className="text-codeflow-accent" /> Elige tu Identidad
              </h3>
              <button onClick={handleShuffleAll} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-codeflow-accent border border-codeflow-accent/20 transition-all">
                <Dices size={16} /> Mezclar Todo
              </button>
            </div>

            <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
              {/* Preview panel */}
              <div className="sm:w-48 flex flex-col items-center justify-center p-6 bg-white/[0.02] border-b sm:border-b-0 sm:border-r border-white/5 gap-3 shrink-0">
                <div className="w-28 h-28 rounded-full overflow-hidden bg-codeflow-base border-4 border-codeflow-accent/30 shadow-lg shadow-codeflow-accent/10">
                  <img key={selected} src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <p className="text-white font-bold text-sm text-center">{username}</p>
                <span className="text-codeflow-accent text-xs font-bold uppercase tracking-wider bg-codeflow-accent/10 px-2 py-0.5 rounded-full border border-codeflow-accent/20">
                  {STYLES.find(s => s.id === selectedStyle)?.label ?? selectedStyle}
                </span>
              </div>

              {/* Style grid */}
              <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {currentOptions.map(item => {
                    const [style, name] = item.seed.split(':');
                    const url = `https://api.dicebear.com/7.x/${style}/svg?seed=${name}`;
                    const isActive = selected === item.seed;
                    return (
                      <div key={item.styleId} className="relative group">
                        <button
                          onClick={() => setSelected(item.seed)}
                          className={`w-full p-2.5 rounded-xl transition-all border-2 flex flex-col items-center gap-1.5 ${isActive ? 'border-codeflow-accent bg-codeflow-accent/10' : 'border-transparent bg-white/5 hover:bg-white/10'}`}
                        >
                          <img src={url} alt={item.label} className="w-14 h-14" />
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-codeflow-accent' : 'text-codeflow-muted'}`}>{item.label}</span>
                        </button>
                        {/* Per-style shuffle button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); shuffleOne(item.styleId); if (isActive) setSelected(`${item.styleId}:${Math.random().toString(36).substring(7)}`); }}
                          className="absolute top-1.5 right-1.5 p-1 rounded-md bg-black/40 text-white/60 hover:text-codeflow-accent hover:bg-codeflow-accent/10 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Dices size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-white/5">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-colors text-sm">Cancelar</button>
              <button onClick={handleSave} className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-codeflow-accent to-fuchsia-600 text-white font-bold shadow-lg hover:opacity-90 transition-all text-sm">Guardar</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// --- Confirm Modal ---
function ConfirmModal({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', danger = false }: {
  isOpen: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string; confirmLabel?: string; danger?: boolean;
}) {
  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 bg-codeflow-dark/85 backdrop-blur-md" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative bg-codeflow-card border border-white/10 p-6 rounded-2xl w-full max-w-sm shadow-2xl"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${danger ? 'bg-red-500/15' : 'bg-codeflow-accent/15'}`}>
              {danger
                ? <AlertCircle size={20} className="text-red-400" />
                : <Info size={20} className="text-codeflow-accent" />}
            </div>
            <h3 className="text-base font-bold text-white mb-1">{title}</h3>
            <p className="text-codeflow-muted text-sm mb-6 leading-relaxed">{message}</p>
            <div className="flex gap-3">
              <button onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 text-white font-semibold hover:bg-white/10 transition-colors text-sm">
                Cancelar
              </button>
              <button onClick={() => { onConfirm(); onClose(); }}
                className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-white transition-all text-sm ${danger
                  ? 'bg-gradient-to-r from-red-600 to-red-700 hover:opacity-90'
                  : 'bg-gradient-to-r from-codeflow-accent to-fuchsia-600 hover:opacity-90'}`}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}

// --- Animated Number ---
function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = React.useState(0);
  React.useEffect(() => {
    let start = 0;
    const duration = 900;
    const step = value / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else { setDisplay(Math.floor(start)); }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display}{suffix}</span>;
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
  const [activeTab, setActiveTabInternal] = useState<string>(() => localStorage.getItem('prode_active_tab') || 'dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('prode_auth_token'));

  const [currentUser, setCurrentUser] = useState<string>(localStorage.getItem('prode_username') || '');
  const [isLoading, setIsLoading] = React.useState(true);

  const setActiveTab = (tab: string) => {
    setActiveTabInternal(tab);
    localStorage.setItem('prode_active_tab', tab);
  };

  React.useEffect(() => {
    // This useEffect is now primarily for initial loading state,
    // isAuthenticated is derived directly from localStorage on mount.
    setIsLoading(false);
  }, []);

  const handleLogin = (username: string) => {
    setIsAuthenticated(true);
    setCurrentUser(username);
    localStorage.setItem('prode_username', username);
  };

  const handleLogout = () => {
    localStorage.removeItem('prode_auth_token');
    localStorage.removeItem('prode_username');
    localStorage.removeItem('prode_active_tab');
    setIsAuthenticated(false);
    setCurrentUser('');
    setActiveTabInternal('dashboard'); // Reset active tab on logout
  };

  if (isLoading) return <div className="min-h-screen bg-codeflow-dark flex items-center justify-center"><div className="w-8 h-8 border-2 border-codeflow-accent border-t-transparent rounded-full animate-spin" /></div>;

  if (!isAuthenticated) {
    return <ToastProvider><LoginView onLogin={handleLogin} /></ToastProvider>;
  }

  const handleUsernameChange = (newUsername: string, newToken: string) => {
    setCurrentUser(newUsername);
    localStorage.setItem('prode_username', newUsername);
    localStorage.setItem('prode_auth_token', newToken);
  };

  return (
    <ToastProvider>
      <ProfilesProvider>
        <AppShell
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          setIsAuthenticated={setIsAuthenticated}
          currentUser={currentUser}
          handleLogout={handleLogout}
          onUsernameChange={handleUsernameChange}
        />
      </ProfilesProvider>
    </ToastProvider>
  );
}

// --- Mobile Bottom Navigation ---
function MobileBottomNav({ activeTab, onNavigate }: { activeTab: string; onNavigate: (tab: string) => void }) {
  const mediaActive = ['series', 'animes', 'movies', 'games'].includes(activeTab);
  const mainItems = [
    { icon: <LayoutDashboard size={22} />, label: 'Inicio', tab: 'dashboard' },
    { icon: <Trophy size={22} />, label: 'F1', tab: 'f1' },
    { icon: <Film size={22} />, label: 'Bóveda', tab: 'series', isMedia: true },
    { icon: <Settings size={22} />, label: 'Config.', tab: 'settings' },
  ];
  const mediaItems = [
    { icon: <Tv size={18} />, label: 'Series', tab: 'series' },
    { icon: <Ghost size={18} />, label: 'Animes', tab: 'animes' },
    { icon: <Film size={18} />, label: 'Películas', tab: 'movies' },
    { icon: <Diced size={18} />, label: 'Juegos', tab: 'games' },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/8"
      style={{ background: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(24px)', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}>
      {/* Media sub-nav: shown when in any media tab */}
      {mediaActive && (
        <div className="flex items-center justify-around px-2 pt-2 pb-1 border-b border-white/5">
          {mediaItems.map(item => (
            <button key={item.tab} onClick={() => onNavigate(item.tab)}
              className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-lg transition-all">
              <span className={`transition-colors ${activeTab === item.tab ? 'text-codeflow-accent' : 'text-codeflow-muted/50'}`}>
                {item.icon}
              </span>
              <span className={`text-[9px] font-bold uppercase tracking-wide ${activeTab === item.tab ? 'text-codeflow-accent' : 'text-codeflow-muted/40'}`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      )}
      {/* Main nav */}
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {mainItems.map(item => {
          const isActive = item.isMedia ? mediaActive : activeTab === item.tab;
          return (
            <button key={item.tab} onClick={() => onNavigate(item.tab)}
              className="flex flex-col items-center gap-1 px-5 py-1.5 rounded-xl transition-all relative">
              <span className={`transition-all duration-200 ${isActive ? 'text-codeflow-accent drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'text-codeflow-muted'}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wide transition-colors ${isActive ? 'text-codeflow-accent' : 'text-codeflow-muted/60'}`}>
                {item.label}
              </span>
              {isActive && (
                <motion.div layoutId="mobileNavDot"
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-codeflow-accent"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function AppShell({ activeTab, setActiveTab, setIsAuthenticated, currentUser, handleLogout, onUsernameChange }: {
  activeTab: string;
  setActiveTab: (t: string) => void;
  setIsAuthenticated: (v: boolean) => void;
  currentUser: string;
  handleLogout: () => void;
  onUsernameChange: (newUsername: string, newToken: string) => void;
}) {
  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
  };

  const logout = () => {
    setIsAuthenticated(false);
    handleLogout();
  };

  return (
    <div className="flex min-h-screen bg-codeflow-dark relative overflow-hidden">
      {/* Sidebar - Desktop only */}
      <aside className="hidden md:flex md:sticky top-0 left-0 bottom-0 z-40 w-64 border-r border-white/5 bg-codeflow-base/80 backdrop-blur-3xl flex-col h-screen">
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <img src={logoCodeflow} alt="CodeWeb" className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
          <h1 className="font-display font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
            CodeWeb
          </h1>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto no-scrollbar">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => handleNavClick('dashboard')} />
          <NavItem icon={<Trophy size={20} />} label="F1 Prode" active={activeTab === 'f1'} onClick={() => handleNavClick('f1')} />
          <NavItem icon={<Tv size={20} />} label="Series" active={activeTab === 'series'} onClick={() => handleNavClick('series')} />
          <NavItem icon={<Ghost size={20} />} label="Animes" active={activeTab === 'animes'} onClick={() => handleNavClick('animes')} />
          <NavItem icon={<Film size={20} />} label="Películas" active={activeTab === 'movies'} onClick={() => handleNavClick('movies')} />
          <NavItem icon={<Diced size={20} />} label="Juegos de Mesa" active={activeTab === 'games'} onClick={() => handleNavClick('games')} />
          <NavItem icon={<Settings size={20} />} label="Configuración" active={activeTab === 'settings'} onClick={() => handleNavClick('settings')} />

          {/* Admin link — hide if not needed or restrict */}
          <button
            onClick={() => handleNavClick('admin')}
            className={`flex items-center gap-3 px-3 py-3 w-full rounded-xl transition-all duration-300 ${activeTab === 'admin' ? 'text-white bg-white/5 shadow-inner' : 'text-codeflow-muted hover:text-white'}`}
          >
            <ShieldAlert size={20} />
            <span className="font-medium">Admin</span>
          </button>
        </nav>

        <div className="p-4 border-t border-white/5 space-y-3">
          <MyProfileCard username={currentUser} onClick={() => handleNavClick('settings')} active={activeTab === 'settings'} />
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-red-500/70 hover:text-red-400 hover:bg-red-500/10 transition-colors">
            <span className="font-medium text-sm">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Avatar Picker Modal */}
      <AvatarTrigger username={currentUser} />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav activeTab={activeTab} onNavigate={handleNavClick} />

      <main className={`flex-1 p-4 md:p-8 relative z-0 overflow-x-hidden md:pb-8 ${['series','animes','movies','games'].includes(activeTab) ? 'pb-36' : 'pb-24'}`}>
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
              {activeTab === 'settings' && <SettingsView username={currentUser} onUsernameChange={onUsernameChange} onDeleted={handleLogout} />}
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

// --- Settings View Component ---
function SettingsView({ username, onUsernameChange, onDeleted }: { username: string; onUsernameChange: (newUsername: string, newToken: string) => void; onDeleted: () => void }) {
  const { profiles, refreshProfiles } = useProfiles();
  const { addToast } = useToast();
  const [showPicker, setShowPicker] = useState(false);
  const [newPass, setNewPass] = useState('');
  const [loadingPass, setLoadingPass] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [loadingUser, setLoadingUser] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'password'>('confirm');
  const [stats, setStats] = useState<any>(null);

  React.useEffect(() => {
    if (!username) return;
    fetchWithAuth(`/api/stats/${username}`)
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => {});
  }, [username]);

  const currentSeed = profiles[username] || username || '';
  const avatarUrl = (currentSeed && typeof currentSeed === 'string' && currentSeed.includes(':'))
    ? `https://api.dicebear.com/7.x/${currentSeed.split(':')[0]}/svg?seed=${currentSeed.split(':')[1]}`
    : `https://api.dicebear.com/7.x/notionists/svg?seed=${currentSeed || 'default'}&backgroundColor=transparent`;

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass) return;
    setLoadingPass(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/update-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('prode_auth_token')}`
        },
        body: JSON.stringify({ password: newPass })
      });
      if (res.ok) {
        addToast('success', 'Contraseña actualizada correctamente');
        setNewPass('');
      } else {
        addToast('error', 'Falla al actualizar contraseña');
      }
    } catch {
      addToast('error', 'Error de red');
    } finally {
      setLoadingPass(false);
    }
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameError('');
    const trimmed = newUsername.trim().toLowerCase();
    if (!trimmed) return;
    if (trimmed.length < 3 || trimmed.length > 30) {
      setUsernameError('Debe tener entre 3 y 30 caracteres');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(trimmed)) {
      setUsernameError('Solo letras minúsculas, números y guión bajo');
      return;
    }
    setLoadingUser(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/update-username`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('prode_auth_token')}`
        },
        body: JSON.stringify({ newUsername: trimmed })
      });
      const data = await res.json();
      if (res.ok) {
        addToast('success', `Nombre actualizado a "${data.username}"`);
        setNewUsername('');
        onUsernameChange(data.username, data.token);
        refreshProfiles();
      } else {
        setUsernameError(data.error || 'Error al cambiar nombre');
      }
    } catch {
      setUsernameError('Error de red');
    } finally {
      setLoadingUser(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError('');
    setLoadingDelete(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('prode_auth_token')}`
        },
        body: JSON.stringify({ password: deletePassword })
      });
      const data = await res.json();
      if (res.ok) {
        onDeleted();
      } else {
        setDeleteError(data.error || 'Error al eliminar cuenta');
      }
    } catch {
      setDeleteError('Error de red');
    } finally {
      setLoadingDelete(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto py-6">
      <header>
        <h1 className="text-2xl md:text-4xl font-display font-bold text-white mb-2 flex items-center gap-3">
          <Settings size={26} className="text-codeflow-accent shrink-0" />
          Configuración
        </h1>
        <p className="text-codeflow-muted text-sm px-1">Gestiona tu identidad y seguridad.</p>
      </header>

      {/* Avatar + Username */}
      <section className="glass-card p-5 md:p-8 border border-white/5">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Sparkles size={20} className="text-codeflow-accent" /> Identidad</h3>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-28 h-28 rounded-full overflow-hidden bg-codeflow-base border-4 border-codeflow-accent/20">
              <img src={avatarUrl} alt="Your Avatar" className="w-full h-full object-cover" />
            </div>
            <button onClick={() => setShowPicker(true)} className="absolute bottom-0 right-0 p-2.5 bg-codeflow-accent rounded-full text-white shadow-lg hover:opacity-90 transition-opacity">
              <Edit2 size={16} />
            </button>
          </div>
          {/* Username form */}
          <div className="flex-1 w-full">
            <p className="text-codeflow-muted text-xs mb-1 font-medium uppercase tracking-wider">Nombre actual</p>
            <p className="text-white font-bold text-xl mb-4">{username}</p>
            <form onSubmit={handleUpdateUsername} className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Nuevo nombre de usuario"
                  autoComplete="username"
                  className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white focus:outline-none transition-all ${usernameError ? 'border-red-500/60 focus:border-red-500' : 'border-white/10 focus:border-codeflow-accent'}`}
                  value={newUsername}
                  onChange={e => { setNewUsername(e.target.value); setUsernameError(''); }}
                />
                {usernameError && <p className="text-red-400 text-xs mt-1.5 px-1">{usernameError}</p>}
                <p className="text-codeflow-muted/60 text-xs mt-1.5 px-1">Solo letras minúsculas, números y _ (3–30 caracteres)</p>
              </div>
              <button type="submit" disabled={loadingUser || !newUsername.trim()} className="px-6 py-2.5 bg-codeflow-accent text-white font-bold rounded-xl hover:opacity-90 transition-all disabled:opacity-40 text-sm">
                {loadingUser ? 'Actualizando...' : 'Cambiar Nombre'}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="glass-card p-5 md:p-8 border border-white/5">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Lock size={20} className="text-codeflow-accent" /> Seguridad</h3>
        <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-sm">
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Nueva Contraseña"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-codeflow-accent outline-none"
            value={newPass}
            onChange={e => setNewPass(e.target.value)}
          />
          <button type="submit" disabled={loadingPass || !newPass} className="px-6 py-2.5 bg-white/10 border border-white/10 text-white font-bold rounded-xl hover:bg-white/15 transition-all disabled:opacity-40 text-sm">
            {loadingPass ? 'Actualizando...' : 'Actualizar Contraseña'}
          </button>
        </form>
      </section>

      {/* Personal Stats */}
      {stats && (
        <section className="glass-card p-5 md:p-8">
          <h3 className="text-xl font-bold text-white mb-5 flex items-center gap-2"><Trophy size={20} className="text-yellow-400" /> Tus Estadísticas</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="flat-card p-4 text-center">
              <div className="text-2xl font-display font-bold text-codeflow-accent">{stats.totalPts ?? 0}</div>
              <div className="text-xs text-codeflow-muted mt-1">Puntos totales</div>
            </div>
            <div className="flat-card p-4 text-center">
              <div className="text-2xl font-display font-bold text-green-400">{stats.totalHits ?? 0}</div>
              <div className="text-xs text-codeflow-muted mt-1">Aciertos</div>
            </div>
            <div className="flat-card p-4 text-center">
              <div className="text-2xl font-display font-bold text-white">{stats.accuracy != null ? `${Math.round(stats.accuracy)}%` : '—'}</div>
              <div className="text-xs text-codeflow-muted mt-1">Precisión</div>
            </div>
            <div className="flat-card p-4 text-center">
              <div className="text-2xl font-display font-bold text-yellow-400">{stats.totalPredictions ?? 0}</div>
              <div className="text-xs text-codeflow-muted mt-1">Predicciones</div>
            </div>
          </div>
          {stats.favoriteDriver && (
            <p className="text-sm text-codeflow-muted mt-4 text-center">Piloto más elegido: <strong className="text-white">{stats.favoriteDriver}</strong></p>
          )}
        </section>
      )}

      {/* Danger Zone */}
      <section className="border border-red-500/20 rounded-2xl p-5 md:p-8 bg-red-500/[0.03]">
        <h3 className="text-xl font-bold text-red-400 mb-2 flex items-center gap-2">
          <Trash2 size={20} /> Zona Peligrosa
        </h3>
        <p className="text-codeflow-muted text-sm mb-5">
          Eliminar tu cuenta borrará permanentemente todos tus datos: pronósticos, puntajes, valoraciones y perfil. Esta acción no se puede deshacer.
        </p>
        <button
          onClick={() => { setShowDeleteModal(true); setDeleteStep('confirm'); setDeletePassword(''); setDeleteError(''); }}
          className="px-5 py-2.5 rounded-xl border border-red-500/40 text-red-400 font-bold text-sm hover:bg-red-500/10 transition-all"
        >
          Eliminar mi cuenta
        </button>
      </section>

      <AvatarPicker isOpen={showPicker} onClose={() => setShowPicker(false)} username={username} currentSeed={currentSeed} />

      {/* Delete Account Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-codeflow-dark/85 backdrop-blur-md"
              onClick={() => !loadingDelete && setShowDeleteModal(false)} />
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="relative bg-codeflow-card border border-red-500/20 p-6 rounded-2xl w-full max-w-sm shadow-2xl"
            >
              <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center mb-4">
                <Trash2 size={24} className="text-red-400" />
              </div>

              {deleteStep === 'confirm' ? (
                <>
                  <h3 className="text-xl font-bold text-white mb-2">¿Eliminar tu cuenta?</h3>
                  <p className="text-codeflow-muted text-sm mb-6">
                    Se eliminarán todos tus datos permanentemente. No hay vuelta atrás.
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-colors text-sm">Cancelar</button>
                    <button onClick={() => setDeleteStep('password')} className="flex-1 py-2.5 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 font-bold hover:bg-red-500/30 transition-colors text-sm">Continuar</button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="text-xl font-bold text-white mb-2">Confirma tu contraseña</h3>
                  <p className="text-codeflow-muted text-sm mb-5">Ingresá tu contraseña para confirmar que querés eliminar la cuenta de <span className="text-white font-bold">{username}</span>.</p>
                  <div className="space-y-3">
                    <input
                      type="password"
                      autoComplete="current-password"
                      placeholder="Tu contraseña actual"
                      autoFocus
                      className={`w-full bg-white/5 border rounded-xl px-4 py-3 text-white focus:outline-none transition-all ${deleteError ? 'border-red-500/60' : 'border-white/10 focus:border-red-500/50'}`}
                      value={deletePassword}
                      onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                      onKeyDown={e => { if (e.key === 'Enter' && deletePassword) handleDeleteAccount(); }}
                    />
                    {deleteError && <p className="text-red-400 text-xs px-1">{deleteError}</p>}
                    <div className="flex gap-3 pt-1">
                      <button onClick={() => setDeleteStep('confirm')} disabled={loadingDelete} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-colors text-sm disabled:opacity-40">Atrás</button>
                      <button
                        onClick={handleDeleteAccount}
                        disabled={loadingDelete || !deletePassword}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-colors text-sm disabled:opacity-40"
                      >
                        {loadingDelete ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AvatarTrigger({ username }: { username: string }) {
  const [showPicker, setShowPicker] = useState(false);
  const { profiles } = useProfiles();
  const currentSeed = profiles[username];
  React.useEffect(() => {
    const handleOpen = () => setShowPicker(true);
    window.addEventListener('openAvatarPicker', handleOpen);
    return () => window.removeEventListener('openAvatarPicker', handleOpen);
  }, []);
  return <AvatarPicker isOpen={showPicker} onClose={() => setShowPicker(false)} username={username} currentSeed={currentSeed} />;
}

function MyProfileCard({ username, onClick, active }: { username: string, onClick?: () => void, active?: boolean }) {
  const { profiles } = useProfiles();
  const seed = profiles[username] || username || '';
  const url = (seed && typeof seed === 'string' && seed.includes(':'))
    ? `https://api.dicebear.com/7.x/${seed.split(':')[0]}/svg?seed=${seed.split(':')[1]}`
    : `https://api.dicebear.com/7.x/notionists/svg?seed=${seed || 'default'}&backgroundColor=transparent`;
  return (
    <div onClick={onClick} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${active ? 'bg-codeflow-accent/10 border-codeflow-accent' : 'bg-white/5 border-white/5 hover:border-codeflow-accent/40 cursor-pointer group'}`}>
      <img src={url} alt="Profile" className="w-10 h-10 rounded-full border border-white/10" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{username}</p>
        <p className="text-[10px] text-codeflow-muted font-bold uppercase tracking-wider">Configuración</p>
      </div>
      <Settings size={14} className={active ? 'text-codeflow-accent' : 'text-codeflow-muted group-hover:text-codeflow-accent'} />
    </div>
  );
}

// --- Login View Component ---
function LoginView({ onLogin }: { onLogin: (username: string) => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (isRegister) {
          setIsRegister(false);
          setError('Registro exitoso! Por favor inicia sesión.');
        } else {
          localStorage.setItem('prode_auth_token', data.token);
          localStorage.setItem('prode_username', data.username);
          onLogin(data.username);
        }
      } else {
        setError(data.error || data.message || 'Error: Credenciales inválidas');
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
        className="glass-card p-6 md:p-10 max-w-md w-full relative z-10 flex flex-col items-center border border-white/10 shadow-2xl"
      >
        <img src={logoCodeflow} alt="CodeWeb" className="w-20 h-20 mb-6 object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]" />

        <h1 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">{isRegister ? 'Crear Cuenta' : 'Acceso a CodeWeb'}</h1>
        <p className="text-codeflow-muted mb-6 md:mb-8 text-center text-sm">{isRegister ? 'Súmate a la comunidad' : 'Plataforma Central'}</p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <input
              type="text"
              autoComplete="username"
              placeholder="Usuario"
              className="input-base"
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
              className="input-base"
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
                className={`${error.includes('exitoso') ? 'text-green-400' : 'text-red-400'} text-sm font-medium text-center`}
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
            ) : isRegister ? "Registrarme" : "Ingresar"}
          </button>

          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="w-full text-codeflow-muted hover:text-white text-sm mt-4 transition-colors"
          >
            {isRegister ? "¿Ya tienes cuenta? Ingresa" : "¿No tienes cuenta? Regístrate aquí"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}



function DashboardView() {
  const { profiles } = useProfiles();
  const [leaderboard, setLeaderboard] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [nextRace, setNextRace] = React.useState<any>(null);
  const [predictions, setPredictions] = React.useState<any[]>([]);
  const [history, setHistory] = React.useState<any[]>([]);
  const [countdown, setCountdown] = React.useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const setActiveTab = React.useContext(ActiveTabContext);

  React.useEffect(() => {
    Promise.all([
      fetchWithAuth('/api/leaderboard').then(r => r.json()),
      fetchWithAuth('/api/races/next').then(r => r.json()),
      fetchWithAuth('/api/predictions').then(r => r.json()),
      fetchWithAuth('/api/leaderboard/history').then(r => r.json()),
    ]).then(([lb, race, preds, hist]) => {
      setLeaderboard(lb);
      setNextRace(race);
      setPredictions(preds);
      setHistory(hist);
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

  const getStreak = (playerName: string) => {
    if (!history || history.length === 0) return 0;
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const raceScores = history[i].scores;
      if (raceScores && raceScores[playerName] > 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <header>
        <h1 className="text-2xl md:text-4xl font-display font-bold text-white mb-1 flex items-center gap-3">
          <LayoutDashboard size={28} className="text-codeflow-accent shrink-0" />
          Panel Principal
        </h1>
        <p className="text-codeflow-muted text-sm md:text-base">Tu plataforma centralizada para deportes, métricas y entretenimiento.</p>
      </header>

      {/* ===== HERO FULL-WIDTH COUNTDOWN ===== */}
      <div className="relative overflow-hidden rounded-2xl border border-codeflow-accent/20 bg-gradient-to-br from-codeflow-accent/10 via-purple-900/10 to-codeflow-dark p-5 md:p-8 shadow-[0_0_80px_rgba(168,85,247,0.08)]">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-red-600/10 to-transparent pointer-events-none" />
        <div className="absolute -bottom-8 -right-8 text-[12rem] leading-none opacity-5 pointer-events-none select-none">🏎️</div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8">
          <div className="flex-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-f1-redSoft text-f1-red text-xs font-bold border border-f1-red/30 uppercase tracking-wider mb-4 shadow-[0_0_12px_rgba(225,6,0,0.2)]">
              <span className="w-1.5 h-1.5 rounded-full bg-f1-red animate-pulse" />
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
                    <span className="font-racing text-3xl md:text-6xl text-white tabular-nums leading-none" style={{ letterSpacing: '-0.03em' }}>
                      {pad(unit.v)}
                    </span>
                    <span className="text-[10px] text-codeflow-muted uppercase tracking-widest mt-1.5 font-bold">{unit.l}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => setActiveTab('f1')}
              className="btn-f1 w-full md:w-auto text-sm tracking-wide px-8 py-3"
            >
              Cargar mi Pronóstico
            </button>
          </div>
        </div>
      </div>

      {/* ===== TWO-COLUMN LAYOUT: LEADERBOARD & TRENDS ===== */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* FULL LEADERBOARD */}
        <div className="glass-card p-6 xl:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy size={20} className="text-yellow-500" /> Tabla de Analistas
            </h3>
            <span className="text-xs text-codeflow-muted italic">
              {nextRace ? `Se actualiza tras cada sesión de ${nextRace.name}` : ''}
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
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 gap-3">
              <div className="text-5xl opacity-30">🏁</div>
              <p className="text-white font-semibold">El campeonato está por comenzar</p>
              <p className="text-codeflow-muted text-sm">Nadie tiene puntos todavía. Cargá tu primer pronóstico.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboard.map((user: any, i: number) => {
                const gapToLeader = leader && i > 0 ? leader.pts - user.pts : 0;
                const hasSubmitted = playersWithPrediction.has(user.name);
                const streak = getStreak(user.name);
                const medalStyle = i === 0
                  ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50 shadow-yellow-500/10'
                  : i === 1 ? 'bg-gray-400/20 text-gray-300 border-gray-400/50'
                    : i === 2 ? 'bg-orange-600/20 text-orange-400 border-orange-600/50'
                      : 'bg-white/5 text-white/40 border-white/10';

                const isLeader = i === 0;
                const avatarSeed = profiles[user.name] || user.name || '';
                const avatarUrl = (avatarSeed && typeof avatarSeed === 'string' && avatarSeed.includes(':'))
                  ? `https://api.dicebear.com/7.x/${avatarSeed.split(':')[0]}/svg?seed=${avatarSeed.split(':')[1]}`
                  : `https://api.dicebear.com/7.x/notionists/svg?seed=${avatarSeed || 'default'}&backgroundColor=transparent`;

                return (
                  <motion.div
                    key={user.name}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 28 }}
                    className={`flex items-center gap-4 rounded-xl border transition-all ${
                      isLeader
                        ? 'p-5 bg-gradient-to-r from-f1-gold/10 via-yellow-500/5 to-transparent border-f1-gold/30 shadow-[0_0_24px_rgba(245,197,24,0.08)]'
                        : i === 1 ? 'p-4 bg-white/[0.02] border-white/8 hover:bg-white/5'
                        : i === 2 ? 'p-4 bg-white/[0.02] border-white/5 hover:bg-white/5'
                        : 'p-3.5 bg-transparent border-white/[0.04] hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* Avatar + medal badge */}
                    <div className="relative shrink-0">
                      <div className={`rounded-full overflow-hidden bg-codeflow-base border-2 ${
                        isLeader ? 'w-14 h-14 border-f1-gold/60 shadow-[0_0_12px_rgba(245,197,24,0.3)]'
                        : i === 1 ? 'w-12 h-12 border-f1-silver/50'
                        : i === 2 ? 'w-12 h-12 border-f1-bronze/40'
                        : 'w-10 h-10 border-white/10'
                      }`}>
                        <img src={avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                      </div>
                      <div className={`absolute -bottom-1.5 -right-1.5 rounded-full flex items-center justify-center font-bold border-2 border-codeflow-dark z-10 ${
                        isLeader ? 'w-7 h-7 text-sm' : 'w-5 h-5 text-[10px]'
                      } ${medalStyle}`}>
                        {i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : i + 1}
                      </div>
                    </div>

                    {/* Name + info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold text-white truncate ${isLeader ? 'text-xl' : 'text-base'}`}>{user.name}</span>
                        {streak >= 2 && (
                          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                            className="text-xs text-orange-400 font-bold bg-orange-500/15 px-1.5 py-0.5 rounded-full border border-orange-500/25 flex items-center gap-1"
                            title={`Racha de ${streak} carreras con puntos`}>
                            🔥 {streak}
                          </motion.span>
                        )}
                        {isLeader && <span className="text-[10px] font-bold text-f1-gold bg-f1-gold/10 border border-f1-gold/25 px-2 py-0.5 rounded-full uppercase tracking-wider">Líder</span>}
                      </div>
                      {i > 0 && <span className="text-xs text-red-400/60">-{gapToLeader} del líder</span>}
                    </div>

                    {/* Submitted badge */}
                    <div className={`hidden sm:flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${hasSubmitted ? 'bg-green-500/10 text-green-400 border-green-500/25' : 'bg-orange-500/10 text-orange-400 border-orange-500/25'}`}>
                      {hasSubmitted ? <><CheckCircle size={9} /> OK</> : <><AlertCircle size={9} /> —</>}
                    </div>

                    {/* Points */}
                    <div className={`text-right tabular-nums shrink-0 ${isLeader ? 'text-2xl' : 'text-lg'} font-display font-extrabold text-white`}>
                      <AnimatedNumber value={user.pts} />
                      <span className="text-xs font-normal text-codeflow-muted ml-1">PTS</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* TRENDS WIDGET */}
        <div className="glass-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Tendencias <span className="text-codeflow-accent">👀</span>
            </h3>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-[44px] bg-white/5 rounded-lg animate-pulse" />)}
            </div>
          ) : predictions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 gap-2">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center mb-1">
                <Trophy size={22} className="text-codeflow-muted/40" />
              </div>
              <p className="text-white/70 font-semibold text-sm">Sin pronósticos aún</p>
              <p className="text-codeflow-muted text-xs">Los picks del grupo aparecerán aquí.</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {(() => {
                const tallies: Record<string, number> = {};
                let totalVotes = 0;
                predictions.forEach((p: any) => {
                  // Direct fallback parsing:
                  const drivers = [p.p1, p.p2, p.p3, p.p4, p.p5].filter(Boolean);
                  drivers.forEach(d => {
                    tallies[d] = (tallies[d] || 0) + 1;
                    totalVotes++;
                  });
                });

                const sorted = Object.entries(tallies).sort((a, b) => b[1] - a[1]).slice(0, 5);

                if (sorted.length === 0) {
                  return (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-codeflow-muted py-8">
                      <span className="text-3xl mb-2 opacity-50">🏎️</span>
                      <p className="text-sm">Aún no hay votos registrados.</p>
                    </div>
                  );
                }

                return sorted.map(([driver, count], i) => {
                  const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  return (
                    <motion.div
                      key={driver}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="relative bg-white/5 border border-white/5 rounded-lg overflow-hidden flex items-center p-3 h-[44px]"
                    >
                      <div
                        className="absolute top-0 left-0 bottom-0 bg-codeflow-accent/20 z-0 transition-all duration-1000 ease-out"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative z-10 flex justify-between items-center w-full">
                        <span className="font-bold text-sm text-white flex items-center gap-2 drop-shadow-md">
                          <span className="text-codeflow-muted text-xs">#{i + 1}</span> {driver}
                        </span>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-bold text-fuchsia-300 drop-shadow-md">{count} votos</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                });
              })()}
              <div className="pt-4 border-t border-white/5 mt-4">
                <p className="text-[10px] text-codeflow-muted text-center tracking-wide uppercase">
                  Pilotos más elegidos en total (Pole y Top 5)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== SCORE HISTORY CHART ===== */}
      <ScoreHistoryChart history={history} loading={loading} />
    </div>
  );
}

// --- Score History Chart ---
const PLAYER_COLORS = [
  '#a855f7', '#f59e0b', '#3b82f6', '#10b981', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16',
];

function ScoreHistoryChart({ history, loading }: { history: any[], loading: boolean }) {
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

// --- Driver Select Modal Component ---
function DriverSelect({ value, onChange, drivers, label, color, hasError }: { value: string, onChange: (v: string) => void, drivers: string[], label: string, color: string, hasError?: boolean }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const searchRef = React.useRef<HTMLInputElement>(null);

  const filteredDrivers = search.trim()
    ? drivers.filter(d => d.toLowerCase().includes(search.toLowerCase()))
    : drivers;

  React.useEffect(() => {
    if (isOpen) { setSearch(''); setTimeout(() => searchRef.current?.focus(), 80); }
  }, [isOpen]);

  const renderDriverName = (d: string) => {
    const parts = d.split(' ');
    const lastName = parts.pop();
    return <><span className="text-xs text-white/50 block mb-0.5">{parts.join(' ')}</span><strong className="text-white text-sm">{lastName}</strong></>;
  };

  return (
    <div className="flex-1 w-full">
      <div onClick={() => setIsOpen(true)}
        className={`w-full rounded-xl px-4 py-3 text-white border transition-colors cursor-pointer flex justify-between items-center ${hasError ? 'border-red-500/60 bg-red-500/10' : color}`}>
        <div className="flex flex-col text-left">
          {value ? renderDriverName(value) : <span className="text-codeflow-muted text-sm font-medium">Elegir piloto...</span>}
        </div>
        <span className="text-codeflow-muted text-[10px]">▼</span>
      </div>

      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-codeflow-dark/85 backdrop-blur-md" onClick={() => setIsOpen(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0, y: 16 }} animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 16 }} transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="relative bg-codeflow-card border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
              {/* Header */}
              <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
                <h3 className="font-bold text-base text-white">
                  <span className="text-codeflow-muted font-normal">Posición: </span>
                  <span className="text-codeflow-accent">{label}</span>
                </h3>
                <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-white transition-colors">
                  <XCircle size={18} />
                </button>
              </div>
              {/* Search */}
              <div className="px-4 py-3 border-b border-white/5 shrink-0">
                <input ref={searchRef} type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar piloto..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-codeflow-muted/50 focus:border-codeflow-accent focus:outline-none transition-colors" />
              </div>
              {/* Grid */}
              <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredDrivers.length === 0
                  ? <div className="col-span-3 py-8 text-center text-codeflow-muted text-sm">Sin resultados para "{search}"</div>
                  : filteredDrivers.map(d => (
                    <button key={d} type="button" onClick={() => { onChange(d); setIsOpen(false); }}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col ${value === d
                        ? 'border-codeflow-accent bg-codeflow-accent/20 shadow-[0_0_12px_rgba(168,85,247,0.2)]'
                        : 'border-white/5 bg-white/[0.02] hover:bg-white/8 hover:border-white/20'}`}>
                      {renderDriverName(d)}
                    </button>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}



function F1ProdeView() {
  const [f1Tab, setF1Tab] = React.useState('prode'); // 'prode', 'leaderboard', 'calendar'

  const [oracleInsight, setOracleInsight] = React.useState<string | null>(null);
  const [loadingOracle, setLoadingOracle] = React.useState(false);
  const [oracleRemaining, setOracleRemaining] = React.useState<number | null>(null);
  const [oracleGeneratedAt, setOracleGeneratedAt] = React.useState<string | null>(null);
  const [oracleCached, setOracleCached] = React.useState(false);
  const [nextRace, setNextRace] = React.useState<any>(null);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pendingSubmit, setPendingSubmit] = React.useState<(() => void) | null>(null);

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
  const [USERS, setUSERS] = React.useState<string[]>([]);
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

    fetchWithAuth('/api/users/list')
      .then(res => res.json())
      .then(data => setUSERS(data || []))
      .catch(err => console.error("Error fetching users:", err));

    setLoadingOracle(true);
    fetchWithAuth('/api/oracle/roast')
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Falla en el backend del oráculo");
        return data;
      })
      .then(data => {
        setOracleInsight(data.analysis || "No tengo palabras...");
        setOracleRemaining(data.remaining ?? null);
        setOracleGeneratedAt(data.generated_at ?? null);
        setOracleCached(!!data.cached);
        setLoadingOracle(false);
      })
      .catch(() => { setOracleInsight("El oráculo tuvo una falla en su motor lógico."); setLoadingOracle(false); });
  }, []);

  const handleOracleRefresh = async () => {
    if (loadingOracle) return;
    if (oracleRemaining !== null && oracleRemaining <= 0) {
      addToast('error', 'El Oráculo agotó sus tokens por hoy. Volvé mañana.');
      return;
    }
    setLoadingOracle(true);
    try {
      const res = await fetchWithAuth('/api/oracle/roast/refresh', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        addToast('error', data.error || 'Error al actualizar el Oráculo');
        // If stale analysis came back with the error, still show it
        if (data.analysis) {
          setOracleInsight(data.analysis);
          setOracleRemaining(0);
          setOracleGeneratedAt(data.generated_at ?? null);
          setOracleCached(true);
        }
        setLoadingOracle(false);
        return;
      }
      setOracleInsight(data.analysis || "No tengo palabras...");
      setOracleRemaining(data.remaining ?? null);
      setOracleGeneratedAt(data.generated_at ?? null);
      setOracleCached(false);
      if (data.remaining !== null && data.remaining <= 3 && data.remaining > 0) {
        addToast('warning', `⚠️ Al Oráculo le quedan solo ${data.remaining} análisis disponibles hoy`);
      }
    } catch {
      addToast('error', 'Error de conexión con el Oráculo');
    }
    setLoadingOracle(false);
  };

  // Poll for new race results every 3 minutes and notify
  React.useEffect(() => {
    if (!nextRace?.round) return;
    const knownResultsKey = `known_results_${nextRace.round}`;
    const knownSessions = new Set<string>(JSON.parse(localStorage.getItem(knownResultsKey) || '[]'));

    const checkResults = async () => {
      try {
        const sessions = ['qualifying', 'sprint_qualifying', 'sprint', 'race'];
        for (const sType of sessions) {
          if (knownSessions.has(sType)) continue;
          const res = await fetchWithAuth(`/api/races/${nextRace.round}/results?session_type=${sType}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (data && data.p1) {
            knownSessions.add(sType);
            localStorage.setItem(knownResultsKey, JSON.stringify([...knownSessions]));
            const label = sType === 'qualifying' ? 'Clasificación' : sType === 'race' ? 'Carrera' : sType === 'sprint' ? 'Sprint' : 'Sprint Qualy';
            addToast('success', `Resultados oficiales de ${label} disponibles`);
          }
        }
      } catch {}
    };

    checkResults();
    const interval = setInterval(checkResults, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [nextRace?.round]);

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
        { key: 'p4', label: '4° Qualy', pts: '10 pts', color: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
        { key: 'p5', label: '5° Qualy', pts: '10 pts', color: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
      ],
      hasPole: false,
    },
    sprint_qualifying: {
      label: '⚡ Sprint Qualifying',
      fields: [
        { key: 'p1', label: '1° Sprint Qualifying', pts: '5 pts', color: 'border-yellow-500/30 focus:border-yellow-500 bg-yellow-500/5' },
        { key: 'p2', label: '2° Sprint Qualifying', pts: '5 pts', color: 'border-gray-400/20 focus:border-gray-400 bg-gray-400/5' },
        { key: 'p3', label: '3° Sprint Qualifying', pts: '5 pts', color: 'border-orange-600/20 focus:border-orange-600 bg-orange-600/5' },
        { key: 'p4', label: '4° Sprint Qualifying', pts: '5 pts', color: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
        { key: 'p5', label: '5° Sprint Qualifying', pts: '5 pts', color: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
      ],
      hasPole: false,
    },
    sprint: {
      label: '🏃 Sprint Race',
      fields: [
        { key: 'p1', label: '1° Sprint', pts: '8 pts', color: 'border-yellow-500/30 focus:border-yellow-500 bg-yellow-500/5' },
        { key: 'p2', label: '2° Sprint', pts: '8 pts', color: 'border-gray-400/20 focus:border-gray-400 bg-gray-400/5' },
        { key: 'p3', label: '3° Sprint', pts: '8 pts', color: 'border-orange-600/20 focus:border-orange-600 bg-orange-600/5' },
        { key: 'p4', label: '4° Sprint', pts: '8 pts', color: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
        { key: 'p5', label: '5° Sprint', pts: '8 pts', color: 'border-white/10 focus:border-codeflow-accent bg-white/5' },
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
      hasPole: false,
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
      setPendingSubmit(() => () => doSubmit());
      setConfirmOpen(true);
      return;
    }
    doSubmit();
  };

  const doSubmit = async () => {
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
      addToast('success', `Pronóstico de ${currentForm.label} guardado para ${pName}`);
      setExistingPrediction({ player: pName, session_type: selectedSession, pole_position: pPole, p1, p2, p3, p4, p5 });
    } catch (err) {
      addToast('error', 'Error guardando el pronóstico. Verificá la conexión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => pendingSubmit && pendingSubmit()}
        title="Actualizar pronóstico"
        message={`Ya cargaste un pronóstico de ${currentForm?.label} para ${pName}. ¿Querés actualizarlo?`}
        confirmLabel="Actualizar"
      />
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
            <Info size={18} />
            <span>Reglas</span>
          </button>
        </div>

        {/* F1 Sub-Navigation - sticky */}
        <div className="sticky-subnav">
        <div className="flex items-center gap-1 p-1 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            onClick={() => setF1Tab('prode')}
            className={`flex-1 flex justify-center items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${f1Tab === 'prode' ? 'text-white bg-white/10 border border-white/10 shadow-lg' : 'text-codeflow-muted hover:text-white hover:bg-white/5'}`}>
            Prode
          </button>
          <button
            onClick={() => setF1Tab('leaderboard')}
            className={`flex-1 flex justify-center items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${f1Tab === 'leaderboard' ? 'text-white bg-white/10 border border-white/10 shadow-lg' : 'text-codeflow-muted hover:text-white hover:bg-white/5'}`}>
            Tabla
          </button>
          <button
            onClick={() => setF1Tab('calendar')}
            className={`flex-1 flex justify-center items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${f1Tab === 'calendar' ? 'text-white bg-white/10 border border-white/10 shadow-lg' : 'text-codeflow-muted hover:text-white hover:bg-white/5'}`}>
            Calendario
          </button>
          <button
            onClick={() => setF1Tab('grilla')}
            className={`flex-1 flex justify-center items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${f1Tab === 'grilla' ? 'text-white bg-white/10 border border-white/10 shadow-lg' : 'text-codeflow-muted hover:text-white hover:bg-white/5'}`}>
            Grilla
          </button>
          <button
            onClick={() => setF1Tab('historial')}
            className={`flex-1 flex justify-center items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${f1Tab === 'historial' ? 'text-white bg-white/10 border border-white/10 shadow-lg' : 'text-codeflow-muted hover:text-white hover:bg-white/5'}`}>
            Historial
          </button>
          <button
            onClick={() => setF1Tab('rules')}
            className={`flex-1 flex justify-center items-center px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${f1Tab === 'rules' ? 'text-white bg-white/10 border border-white/10 shadow-lg' : 'text-codeflow-muted hover:text-white hover:bg-white/5'}`}>
            Reglas
          </button>
        </div>
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
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-bold text-lg text-white">El Oráculo (Groq)</h3>
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-semibold">Análisis Sensorial</span>
                        {oracleCached && oracleGeneratedAt && (
                          <span className="text-xs text-codeflow-muted ml-auto">
                            Actualizado {new Date(oracleGeneratedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {oracleRemaining !== null && oracleRemaining <= 10 && oracleRemaining > 0 && (
                        <div className="mb-2 flex items-center gap-1.5 text-amber-400/90 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                          Solo quedan <strong>{oracleRemaining}</strong> análisis hoy
                        </div>
                      )}
                      {oracleRemaining === 0 && (
                        <div className="mb-2 flex items-center gap-1.5 text-red-400/80 text-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                          Sin tokens disponibles hoy
                        </div>
                      )}

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

                      <button
                        onClick={handleOracleRefresh}
                        disabled={loadingOracle || oracleRemaining === 0}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-codeflow-muted hover:border-codeflow-accent/40 hover:text-codeflow-accent hover:bg-codeflow-accent/5 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        {loadingOracle
                          ? <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                          : <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                        }
                        Actualizar contexto
                        {oracleRemaining !== null && oracleRemaining <= 10 && (
                          <span className="opacity-50">{oracleRemaining}</span>
                        )}
                      </button>
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
                          <SessionCountdownBadge dateUtc={s.date_utc} isOpen={s.isOpen} />
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
                    <div className="mb-4">
                      <label className="flex justify-between items-center text-xs uppercase font-bold text-codeflow-muted tracking-wider mb-2 mt-4 border-t border-white/5 pt-4">
                        <span>Pole Position (Sábado)</span>
                        <span className="text-codeflow-accent/80 bg-codeflow-accent/10 px-2 py-0.5 rounded text-[10px]">+5 pts</span>
                      </label>
                      <DriverSelect
                        value={pPole}
                        onChange={v => setPPole(v)}
                        drivers={DRIVERS}
                        label="Pole (Sábado)"
                        color="border-codeflow-accent/40 bg-codeflow-accent/10 hover:border-codeflow-accent/60"
                        hasError={false}
                      />
                    </div>
                  )}

                  {/* Dynamic position fields */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-4 border-t border-white/5 pt-4">
                      <label className="text-xs uppercase font-bold text-codeflow-accent/70 tracking-wider">
                        Posiciones ({currentForm.fields[0]?.pts} c/u)
                      </label>
                      {hasDuplicates && (
                        <span className="text-[10px] text-red-400 font-bold flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded-md border border-red-500/20 shadow-sm">
                          <AlertCircle size={12} /> Pilotos repetidos
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      {currentForm.fields.map((field) => (
                        <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <span className="text-xs font-bold text-white/50 w-28 shrink-0 flex items-center gap-2">
                            <span className="w-1 h-3 rounded-full bg-white/20" />
                            {field.label}
                          </span>
                          <DriverSelect
                            value={fieldValues[field.key] || ''}
                            onChange={v => setFieldValue(field.key, v)}
                            drivers={DRIVERS}
                            label={field.label}
                            color={`hover:border-white/20 ${field.color}`}
                            hasError={!!isDuplicateField(fieldValues[field.key])}
                          />
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

          {f1Tab === 'historial' && (
            <PredictionHistoryTab username={localStorage.getItem('prode_username') || ''} />
          )}

        </motion.div>
      </AnimatePresence>
    </div >
  );
}

// --- Session Countdown Badge ---
function SessionCountdownBadge({ dateUtc, isOpen }: { dateUtc: string | null; isOpen: boolean }) {
  const countdown = useCountdown(isOpen ? dateUtc : null);
  if (!isOpen) return (
    <div className="flex items-center gap-1 text-[9px] font-bold mt-1 text-red-400">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> CERRADO
    </div>
  );
  return (
    <div className="flex flex-col gap-0.5 mt-1">
      <div className="flex items-center gap-1 text-[9px] font-bold text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> ABIERTO
      </div>
      {countdown && <span className="text-[9px] font-mono text-codeflow-accent">⏱ {countdown}</span>}
    </div>
  );
}

// --- Prediction History Tab ---
function PredictionHistoryTab({ username }: { username: string }) {
  const [history, setHistory] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedRace, setExpandedRace] = React.useState<string | null>(null);
  const SESSION_LABELS: Record<string, string> = { race: '🏁 Carrera', qualifying: '🏎️ Clasificación', sprint: '🏃 Sprint', sprint_qualifying: '⚡ Sprint Q' };
  const SESSION_PTS: Record<string, number> = { race: 10, qualifying: 10, sprint: 8, sprint_qualifying: 5 };

  React.useEffect(() => {
    if (!username) return;
    fetchWithAuth(`/api/predictions/history/${username}`)
      .then(r => r.json())
      .then(data => { setHistory(Array.isArray(data) ? data.reverse() : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [username]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-codeflow-accent border-t-transparent rounded-full animate-spin" /></div>;
  if (history.length === 0) return (
    <div className="glass-card p-10 text-center">
      <p className="text-codeflow-muted">No hay predicciones anteriores aún.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-codeflow-muted text-sm px-1">Tu historial de pronósticos — <span className="text-white font-semibold">{username}</span></p>
      {history.map(race => {
        const isExpanded = expandedRace === race.race_id;
        return (
          <div key={race.race_id} className="glass-card overflow-hidden">
            <button onClick={() => setExpandedRace(isExpanded ? null : race.race_id)}
              className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors text-left">
              <div>
                <p className="text-white font-bold text-sm">{race.race_name}</p>
                <p className="text-codeflow-muted text-xs mt-0.5">{race.predictions.length} sesión{race.predictions.length !== 1 ? 'es' : ''} predichas</p>
              </div>
              <div className="flex items-center gap-3">
                {race.official_results.length > 0 && (() => {
                  let pts = 0;
                  for (const pred of race.predictions) {
                    const official = race.official_results.find((r: any) => r.session_type === pred.session_type);
                    if (!official) continue;
                    const ptsPerPick = SESSION_PTS[pred.session_type] || 10;
                    for (const pos of ['p1', 'p2', 'p3', 'p4', 'p5']) {
                      if (pred[pos] && pred[pos] === official[pos]) pts += ptsPerPick;
                    }
                  }
                  return <span className="text-green-400 font-bold text-sm bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/20">+{pts} pts</span>;
                })()}
                <span className={`text-codeflow-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
              </div>
            </button>
            {isExpanded && (
              <div className="border-t border-white/5 divide-y divide-white/5">
                {race.predictions.map((pred: any) => {
                  const official = race.official_results.find((r: any) => r.session_type === pred.session_type);
                  return (
                    <div key={pred.session_type} className="p-4">
                      <p className="text-xs font-bold text-codeflow-accent mb-3">{SESSION_LABELS[pred.session_type] || pred.session_type}</p>
                      <div className="flex flex-wrap gap-2">
                        {['p1', 'p2', 'p3', 'p4', 'p5'].filter(pos => pred[pos]).map((pos, i) => {
                          const isCorrect = official && pred[pos] === official[pos];
                          const isWrong = official && pred[pos] !== official[pos];
                          return (
                            <div key={pos} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium ${isCorrect ? 'bg-green-500/15 border-green-500/30 text-green-300' : isWrong ? 'bg-red-500/10 border-red-500/20 text-red-300/70' : 'bg-white/5 border-white/10 text-white/70'}`}>
                              <span className="text-[10px] text-codeflow-muted font-bold">P{i + 1}</span>
                              {pred[pos].split(' ').slice(-1)[0]}
                              {isCorrect && <CheckCircle size={10} className="text-green-400" />}
                            </div>
                          );
                        })}
                        {!official && <span className="text-[10px] text-codeflow-muted italic self-center">Sin resultados oficiales aún</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Leaderboard Internal Component ---
function F1LeaderboardTab() {
  const { profiles } = useProfiles();
  const [leaderboard, setLeaderboard] = React.useState<any[]>([]);
  const [history, setHistory] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showBreakdown, setShowBreakdown] = React.useState(false);

  React.useEffect(() => {
    Promise.all([
      fetchWithAuth('/api/leaderboard').then(res => res.json()),
      fetchWithAuth('/api/leaderboard/history').then(res => res.json()),
    ])
      .then(([lbData, histData]) => {
        setLeaderboard(lbData);
        setHistory(histData);
        setLoading(false);
      })
      .catch(err => {
        console.error("No se pudo cargar el leaderboard", err);
        setLoading(false);
      });
  }, []);

  const getStreak = (playerName: string) => {
    if (!history || history.length === 0) return 0;
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const raceScores = history[i].scores;
      if (raceScores && raceScores[playerName] > 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  };

  return (
    <div className="glass-card p-5 md:p-8 min-h-[500px] border-t-4 border-t-yellow-500 rounded-t-none">
      <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Posiciones Oficiales del Prode 2026</h3>
      <p className="text-codeflow-muted italic text-sm mb-8">Las posiciones se actualizan tras cada sesión: Qualy, Sprint o Carrera.</p>

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
          {leaderboard.map((user, i) => {
            const streak = getStreak(user.name);
            const medalStyle = i === 0
              ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 shadow-yellow-500/20'
              : i === 1 ? 'bg-gray-400/20 text-gray-300 border border-gray-400/50'
                : i === 2 ? 'bg-orange-600/20 text-orange-400 border border-orange-600/50'
                  : 'bg-white/5 text-white/50 border border-white/10';

            const isLeader2 = i === 0;
            const seed2 = profiles[user.name] || user.name;
            const avatarUrl2 = seed2.includes(':')
              ? `https://api.dicebear.com/7.x/${seed2.split(':')[0]}/svg?seed=${seed2.split(':')[1]}`
              : `https://api.dicebear.com/7.x/notionists/svg?seed=${seed2}&backgroundColor=transparent`;

            return (
              <motion.div
                key={user.name}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 28 }}
                className={`flex items-center justify-between rounded-xl border transition-all group ${
                  isLeader2
                    ? 'p-5 bg-gradient-to-r from-f1-gold/10 via-yellow-500/5 to-transparent border-f1-gold/30 shadow-[0_0_24px_rgba(245,197,24,0.07)]'
                    : i === 1 ? 'p-4 bg-white/[0.025] border-white/8 hover:bg-white/5'
                    : i === 2 ? 'p-4 bg-white/[0.015] border-white/5 hover:bg-white/5'
                    : 'p-3.5 bg-transparent border-white/[0.04] hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <div className={`rounded-full overflow-hidden bg-codeflow-base border-2 ${
                      isLeader2 ? 'w-14 h-14 border-f1-gold/60 shadow-[0_0_12px_rgba(245,197,24,0.25)]'
                      : i === 1 ? 'w-12 h-12 border-f1-silver/40'
                      : i === 2 ? 'w-12 h-12 border-f1-bronze/35'
                      : 'w-10 h-10 border-white/10'
                    }`}>
                      <img src={avatarUrl2} alt={user.name} className="w-full h-full object-cover" />
                    </div>
                    <div className={`absolute -bottom-1.5 -right-1.5 rounded-full flex items-center justify-center font-bold border-2 border-codeflow-dark z-10 ${
                      isLeader2 ? 'w-7 h-7 text-sm' : 'w-5 h-5 text-[10px]'
                    } ${medalStyle}`}>
                      {i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : i + 1}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-bold text-white transition-colors ${isLeader2 ? 'text-xl' : 'text-base'} group-hover:text-codeflow-accent`}>{user.name}</span>
                      {streak >= 2 && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="text-xs text-orange-400 font-bold bg-orange-500/15 px-1.5 py-0.5 rounded-full border border-orange-500/25 flex items-center gap-1">
                          🔥 {streak}
                        </motion.span>
                      )}
                      {isLeader2 && <span className="text-[10px] font-bold text-f1-gold bg-f1-gold/10 border border-f1-gold/25 px-2 py-0.5 rounded-full uppercase tracking-wider">Líder</span>}
                    </div>
                  </div>
                </div>
                <div className={`font-display font-extrabold text-white tabular-nums ${isLeader2 ? 'text-3xl' : 'text-xl'}`}>
                  <AnimatedNumber value={user.pts} />
                  <span className="text-sm font-normal text-codeflow-muted ml-1">PTS</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* GP Breakdown Toggle */}
      {!loading && history && history.length > 0 && (
        <div className="mt-8">
          <button
            onClick={() => setShowBreakdown(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-codeflow-muted hover:text-white transition-colors mb-4"
          >
            <ChevronDown size={16} className={`transition-transform ${showBreakdown ? 'rotate-180' : ''}`} />
            {showBreakdown ? 'Ocultar' : 'Ver'} desglose por GP
          </button>

          {showBreakdown && (
            <div className="overflow-x-auto rounded-xl border border-white/8">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-codeflow-muted font-semibold whitespace-nowrap sticky left-0 bg-codeflow-card">Piloto</th>
                    {history.map((race: any) => (
                      <th key={race.race_id} className="text-center py-3 px-3 text-codeflow-muted font-semibold whitespace-nowrap">
                        {race.race_name?.split(' ').slice(-1)[0] || race.race_id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((user, i) => (
                    <tr key={user.name} className={`border-b border-white/5 ${i % 2 === 0 ? 'bg-white/[0.01]' : ''}`}>
                      <td className="py-3 px-4 font-semibold text-white whitespace-nowrap sticky left-0 bg-codeflow-card">{user.name}</td>
                      {history.map((race: any) => {
                        const pts = race.scores?.[user.name] ?? null;
                        return (
                          <td key={race.race_id} className="text-center py-3 px-3">
                            {pts !== null ? (
                              <span className={`inline-block px-2 py-0.5 rounded-full font-bold ${pts > 0 ? 'bg-codeflow-accent/15 text-codeflow-accent' : 'text-codeflow-muted/50'}`}>
                                {pts > 0 ? `+${pts}` : '0'}
                              </span>
                            ) : (
                              <span className="text-codeflow-muted/30">—</span>
                            )}
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
      )}
    </div>
  )
}

// --- Predictions Grid Tab ---
function PredictionsGridTab({ nextRace }: { nextRace: any }) {
  const [predictions, setPredictions] = React.useState<any[]>([]);
  const [activePlayers, setActivePlayers] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sessionFilter, setSessionFilter] = React.useState('qualifying');
  const [officialResult, setOfficialResult] = React.useState<any>(null);

  // Load active players once: union of all players who predicted for any session of this race
  React.useEffect(() => {
    if (!nextRace?.round) return;
    const raceId = `round_${nextRace.round}`;
    fetchWithAuth(`/api/predictions?race_id=${raceId}`)
      .then(r => r.json())
      .then((all: any[]) => {
        const unique = [...new Set(all.map((p: any) => p.player))];
        setActivePlayers(unique);
      })
      .catch(() => {});
  }, [nextRace?.round]);

  React.useEffect(() => {
    setLoading(true);
    fetchWithAuth(`/api/predictions?session_type=${sessionFilter}`)
      .then(r => r.json())
      .then(data => { setPredictions(data); setLoading(false); })
      .catch(() => setLoading(false));
    // Fetch official results for this session to show comparison
    if (nextRace?.round) {
      fetchWithAuth(`/api/races/${nextRace.round}/results?session_type=${sessionFilter}`)
        .then(r => r.json())
        .then(data => setOfficialResult(Array.isArray(data) && data.length > 0 ? data[0] : null))
        .catch(() => setOfficialResult(null));
    }
  }, [sessionFilter, nextRace?.round]);

  const SESSION_LABELS: Record<string, string> = {
    race: '🏁 Carrera', qualifying: '🏎️ Clasificación',
    sprint: '🏃 Sprint', sprint_qualifying: '⚡ Sprint Qualifying',
  };
  const POSITIONS: Record<string, string[]> = {
    race: ['p1', 'p2', 'p3', 'p4', 'p5'],
    qualifying: ['p1', 'p2', 'p3', 'p4', 'p5'],
    sprint: ['p1', 'p2', 'p3', 'p4', 'p5'],
    sprint_qualifying: ['p1', 'p2', 'p3', 'p4', 'p5'],
  };
  const POS_LABELS: Record<string, string> = {
    p1: '🥇 1°', p2: '🥈 2°', p3: '🥉 3°', p4: '4°', p5: '5°',
  };
  const positions = POSITIONS[sessionFilter] || POSITIONS.race;
  const consensus: Record<string, Record<string, number>> = {};
  for (const pos of positions) {
    consensus[pos] = {};
    for (const pred of predictions) {
      const v = pred[pos]; if (v) consensus[pos][v] = (consensus[pos][v] || 0) + 1;
    }
  }
  const submittedPlayers = new Set(predictions.map((p: any) => p.player.toLowerCase()));
  const missingPlayers = activePlayers.filter(u => !submittedPlayers.has(u.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
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
          {nextRace ? nextRace.name : ''} ·{' '}
          {officialResult
            ? <><span className="text-green-400 font-semibold">Verde</span> = acertó · <span className="text-red-400 font-semibold">Rojo</span> = falló</>
            : <><span className="text-green-400 font-semibold">Verde</span> = consenso del grupo</>}
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
                      const isCorrect = officialResult && val && val === officialResult[pos];
                      const isWrong = officialResult && val && val !== officialResult[pos];
                      const isConsensus = !officialResult && val && (consensus[pos][val] || 0) > 1;
                      return (
                        <td key={pred.player} className="text-center py-2 px-3">
                          <span className={`inline-block px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${
                            !val ? 'text-codeflow-muted/50 italic' :
                            isCorrect ? 'bg-green-500/15 text-green-300 border border-green-500/30' :
                            isWrong ? 'bg-red-500/10 text-red-300/70 border border-red-500/20' :
                            isConsensus ? 'bg-green-500/10 text-green-400/70 border border-green-500/20' :
                            'bg-white/5 text-white/80 border border-white/10'
                          }`}>
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

// --- Star Rating Component ---
function StarRating({ rating, onRate, disabled, label, size = 12 }: { rating: number, onRate?: (n: number) => void, disabled?: boolean, label?: string, size?: number }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {label && <span className="text-[9px] text-codeflow-muted font-bold uppercase tracking-widest">{label}</span>}
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            type="button"
            disabled={disabled || !onRate}
            onClick={(e) => { e.stopPropagation(); onRate?.(star); }}
            className={`transition-all ${star <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-white/10 hover:text-white/40'} ${!disabled && onRate ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
          >
            <Star size={size} className={star <= Math.round(rating) ? 'fill-current' : ''} />
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Media Detail Modal ---
function MediaDetailModal({ item, tab, isGame, getGenreColor, poster, onClose, onEdit, onDelete, onUpdateRating }: {
  item: any; tab: string; isGame: boolean; getGenreColor: (g: string) => string;
  poster: string | null; onClose: () => void;
  onEdit: (item: any) => void; onDelete: (id: string) => void; onUpdateRating: (id: string, r: number) => void;
}) {
  const [overview, setOverview] = React.useState<string | null>(null);
  const [userRatings, setUserRatings] = React.useState<{ username: string; rating: number }[]>([]);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [localRating, setLocalRating] = React.useState(Number(item.user_rating) || 0);
  const [comments, setComments] = React.useState<any[]>([]);
  const [newComment, setNewComment] = React.useState('');
  const [submittingComment, setSubmittingComment] = React.useState(false);
  const [allStatuses, setAllStatuses] = React.useState<{ username: string; status: string }[]>([]);
  const currentUser = localStorage.getItem('prode_username') || '';
  const { profiles } = useProfiles();
  const endpointTab = tab === 'games' ? 'boardgames' : tab;

  const fetchComments = () => {
    fetchWithAuth(`/api/media/${endpointTab}/${item.id}/comments`)
      .then(r => r.json())
      .then(data => setComments(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  React.useEffect(() => {
    if (!isGame) {
      const tmdbType = tab === 'movies' ? 'movie' : 'tv';
      fetchWithAuth(`/api/tmdb/search?query=${encodeURIComponent(item.name)}&type=${tmdbType}`)
        .then(r => r.json())
        .then((results: any[]) => { if (results?.length > 0) setOverview(results[0].overview || null); })
        .catch(() => { });
    }
    fetchWithAuth(`/api/media/${endpointTab}/${item.id}/ratings`)
      .then(r => r.json())
      .then(data => setUserRatings(Array.isArray(data) ? data : []))
      .catch(() => { });
    fetchWithAuth(`/api/media/${endpointTab}/${item.id}/all-statuses`)
      .then(r => r.json())
      .then(data => setAllStatuses(Array.isArray(data) ? data : []))
      .catch(() => { });
    fetchComments();
  }, [item.id]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await fetchWithAuth(`/api/media/${endpointTab}/${item.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ comment: newComment.trim() })
      });
      setNewComment('');
      fetchComments();
    } catch {} finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    await fetchWithAuth(`/api/media/comments/${commentId}`, { method: 'DELETE' });
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  const handleRate = (r: number) => {
    setLocalRating(r);
    onUpdateRating(item.id, r);
    setUserRatings(prev => {
      const idx = prev.findIndex(u => u.username === currentUser);
      if (idx >= 0) return prev.map((u, i) => i === idx ? { ...u, rating: r } : u);
      return [...prev, { username: currentUser, rating: r }];
    });
  };

  const avgRating = userRatings.length > 0
    ? userRatings.reduce((s, r) => s + r.rating, 0) / userRatings.length
    : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-codeflow-dark/85 backdrop-blur-md" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="relative bg-codeflow-card border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col"
      >
        {/* Handle bar mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white line-clamp-1">{item.name}</h2>
            {item.recommender && <p className="text-[10px] text-codeflow-muted">Recomendó: <strong className="text-white/70">{item.recommender}</strong></p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => { onClose(); onEdit(item); }} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-codeflow-accent transition-colors" title="Editar"><Edit2 size={15} /></button>
            <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg bg-white/5 hover:bg-red-500/15 text-white/50 hover:text-red-400 transition-colors" title="Eliminar"><Trash2 size={15} /></button>
            <button onClick={onClose} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"><XCircle size={15} /></button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 no-scrollbar">
          {/* Poster + info */}
          <div className="flex gap-4 p-5">
            {!isGame && (
              <div className="shrink-0 w-28 sm:w-36 rounded-xl overflow-hidden bg-codeflow-base border border-white/10 self-start">
                {poster
                  ? <img src={poster} alt={item.name} className="w-full object-cover" />
                  : <div className="w-full aspect-[2/3] flex items-center justify-center text-4xl opacity-20">
                      {tab === 'movies' ? '🎬' : tab === 'animes' ? '🎌' : '📺'}
                    </div>
                }
              </div>
            )}
            <div className="flex-1 space-y-3 min-w-0">
              <div className="flex flex-wrap gap-1">
                {!isGame && item.genre && item.genre.split(',').map((g: string) => (
                  <span key={g} className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${getGenreColor(g.trim())}`}>{g.trim()}</span>
                ))}
                {isGame && <>
                  {item.game_type && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${getGenreColor(item.game_type)}`}>{item.game_type}</span>}
                  {item.difficulty && <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md font-semibold">{item.difficulty}</span>}
                  {item.players && <span className="text-[10px] text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md font-semibold">{item.players} jug.</span>}
                  {item.duration && <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md font-semibold">{item.duration}</span>}
                </>}
              </div>
              <p className="text-sm text-white/70 leading-relaxed">
                {overview || item.description || item.notes || <span className="italic text-white/30 text-xs">Sin descripción disponible.</span>}
              </p>
              <p className="text-[10px] text-codeflow-muted">
                {new Date(item.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Group watch status */}
          {allStatuses.length > 0 && (
            <div className="px-5 pb-3 border-t border-white/5 pt-4">
              <h4 className="text-xs font-bold text-codeflow-muted uppercase tracking-wider mb-3">Estado del grupo</h4>
              <div className="flex flex-wrap gap-2">
                {allStatuses.map(s => {
                  const seed = profiles[s.username] || s.username;
                  const av = seed.includes(':')
                    ? `https://api.dicebear.com/7.x/${seed.split(':')[0]}/svg?seed=${seed.split(':')[1]}`
                    : `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=transparent`;
                  const badge = s.status === 'watched'
                    ? { label: 'Vista ✓', cls: 'border-green-500/40 text-green-400 bg-green-500/10' }
                    : s.status === 'in_progress'
                    ? { label: 'En progreso', cls: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10' }
                    : { label: 'Pendiente', cls: 'border-blue-500/40 text-blue-400 bg-blue-500/10' };
                  return (
                    <div key={s.username} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold ${badge.cls}`}>
                      <img src={av} alt={s.username} className="w-5 h-5 rounded-full bg-codeflow-base border border-white/10" />
                      <span className="text-white/80">{s.username}</span>
                      <span className="opacity-70">{badge.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comments section */}
          <div className="px-5 pb-4 border-t border-white/5 pt-4 space-y-3">
            <h4 className="text-xs font-bold text-codeflow-muted uppercase tracking-wider">Comentarios</h4>
            <form onSubmit={handleSubmitComment} className="flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Escribí un comentario..."
                className="input-base text-sm py-2 flex-1"
                maxLength={500}
              />
              <button type="submit" disabled={submittingComment || !newComment.trim()} className="btn-primary px-4 py-2 text-sm">
                {submittingComment ? '...' : 'Enviar'}
              </button>
            </form>
            {comments.length === 0 ? (
              <p className="text-codeflow-muted/50 text-xs italic text-center py-2">Nadie comentó todavía.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                {comments.map((c: any) => {
                  const seed = profiles[c.username] || c.username;
                  const av = seed.includes(':')
                    ? `https://api.dicebear.com/7.x/${seed.split(':')[0]}/svg?seed=${seed.split(':')[1]}`
                    : `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=transparent`;
                  return (
                    <div key={c.id} className="flex gap-2 items-start bg-white/[0.02] rounded-xl px-3 py-2 border border-white/5">
                      <img src={av} alt={c.username} className="w-6 h-6 rounded-full bg-codeflow-base border border-white/10 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[11px] font-bold text-white">{c.username}</span>
                          <span className="text-[10px] text-codeflow-muted/50">{new Date(c.created_at).toLocaleDateString('es-AR')}</span>
                        </div>
                        <p className="text-xs text-white/70 leading-relaxed">{c.comment}</p>
                      </div>
                      {c.username === currentUser && (
                        <button onClick={() => handleDeleteComment(c.id)} className="text-white/20 hover:text-red-400 transition-colors shrink-0 mt-0.5">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ratings section */}
          {!isGame && (
            <div className="px-5 pb-6 space-y-4 border-t border-white/5 pt-4">
              {/* Your rating */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-codeflow-accent/5 border border-codeflow-accent/15">
                <span className="text-sm font-bold text-white">Tu Calificación</span>
                <StarRating rating={localRating} onRate={handleRate} size={24} />
              </div>
              {/* Group average */}
              {userRatings.length > 0 && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-codeflow-muted font-bold uppercase tracking-wider">Promedio del grupo</span>
                  <div className="flex items-center gap-2">
                    <StarRating rating={avgRating} disabled size={14} />
                    <span className="text-sm font-bold text-white">{avgRating.toFixed(1)}</span>
                    <span className="text-[10px] text-codeflow-muted">({userRatings.length} voto{userRatings.length !== 1 ? 's' : ''})</span>
                  </div>
                </div>
              )}
              {/* Per-user ratings */}
              {userRatings.length > 0 ? (
                <div className="rounded-xl border border-white/5 overflow-hidden">
                  {userRatings.map(ur => {
                    const seed = profiles[ur.username] || ur.username;
                    const avatarUrl = (seed && seed.includes(':'))
                      ? `https://api.dicebear.com/7.x/${seed.split(':')[0]}/svg?seed=${seed.split(':')[1]}`
                      : `https://api.dicebear.com/7.x/notionists/svg?seed=${seed}&backgroundColor=transparent`;
                    const isMe = ur.username === currentUser;
                    return (
                      <div key={ur.username} className={`flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0 ${isMe ? 'bg-codeflow-accent/5' : 'bg-white/[0.02]'}`}>
                        <div className="flex items-center gap-2.5">
                          <img src={avatarUrl} alt={ur.username} className="w-7 h-7 rounded-full bg-codeflow-base border border-white/10" />
                          <span className="text-sm text-white font-medium">{ur.username}</span>
                          {isMe && <span className="text-[9px] text-codeflow-accent bg-codeflow-accent/15 px-1.5 py-0.5 rounded-full font-bold border border-codeflow-accent/20">Tú</span>}
                        </div>
                        <StarRating rating={ur.rating} disabled size={14} />
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-codeflow-muted/60 text-sm py-3 italic">¡Sé el primero en calificar!</p>
              )}
            </div>
          )}
        </div>
      </motion.div>
      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { onDelete(item.id); onClose(); }}
        title="Eliminar item"
        message={`¿Seguro que querés eliminar "${item.name}" de la bóveda?`}
        confirmLabel="Eliminar"
        danger
      />
    </div>
  );
}

// MediaCard: poster-centric, opens detail modal on click

function MediaCard({ item, i, isGame, getGenreColor, tab, onEdit, onDelete, onUpdateRating, myStatus, onStatusChange }: {
  item: any; i: number; isGame: boolean; getGenreColor: (g: string) => string; tab: string;
  onEdit: (item: any) => void; onDelete: (id: string) => void; onUpdateRating: (id: string, r: number) => void;
  myStatus?: string; onStatusChange?: (id: string, status: string) => void;
}) {
  const [poster, setPoster] = React.useState<string | null>(null);
  const [showDetail, setShowDetail] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const avgRating = Number(item.avg_rating) || 0;

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const newStatus = e.target.value;
    const endpointTab2 = tab === 'games' ? 'boardgames' : tab;
    try {
      await fetchWithAuth(`/api/media/${endpointTab2}/${item.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus || null })
      });
      onStatusChange?.(item.id, newStatus);
    } catch {}
  };

  React.useEffect(() => {
    if (isGame) return;
    const type = tab === 'movies' ? 'movie' : 'tv';
    fetchWithAuth(`/api/tmdb/search?query=${encodeURIComponent(item.name)}&type=${type}`)
      .then(r => r.json())
      .then((results: any[]) => { if (results?.length > 0) setPoster(results[0].poster || null); })
      .catch(() => { });
  }, [item.name, isGame, tab]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
        className="glass-card flex flex-col group relative overflow-hidden cursor-pointer hover:border-codeflow-accent/50 transition-all duration-300 h-full"
        onClick={() => setShowDetail(true)}
      >
        {/* Visual area */}
        {!isGame ? (
          <div className="relative w-full aspect-[2/3] overflow-hidden rounded-t-2xl bg-codeflow-base">
            {poster
              ? <img src={poster} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              : <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-15">
                  {tab === 'movies' ? '🎬' : tab === 'animes' ? '🎌' : '📺'}
                </div>
            }
            <div className="absolute inset-0 bg-gradient-to-t from-codeflow-dark/90 via-codeflow-dark/20 to-transparent" />
            {avgRating > 0 && (
              <div className="absolute top-2 left-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                <Star size={8} className="fill-yellow-400 text-yellow-400" />
                <span className="text-[10px] font-bold text-white">{avgRating.toFixed(1)}</span>
              </div>
            )}
            {Number(item.user_rating) > 0 && (
              <div className="absolute top-2 right-8 flex items-center gap-0.5 bg-codeflow-accent/80 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                <Star size={8} className="fill-white text-white" />
                <span className="text-[10px] font-bold text-white">{item.user_rating}</span>
              </div>
            )}
            {item.genre && (
              <div className="absolute bottom-2 left-2 right-8 flex flex-wrap gap-1">
                {item.genre.split(',').slice(0, 2).map((g: string) => (
                  <span key={g} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white/80">{g.trim()}</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full aspect-[4/3] overflow-hidden rounded-t-2xl bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center">
            <span className="text-5xl opacity-20">🎲</span>
            <div className="absolute inset-0 bg-gradient-to-t from-codeflow-dark/80 to-transparent" />
            <div className="absolute bottom-2 left-2 flex flex-wrap gap-1">
              {item.game_type && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm ${getGenreColor(item.game_type)}`}>{item.game_type}</span>}
              {item.difficulty && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-purple-300">{item.difficulty}</span>}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="p-3 flex flex-col gap-1 flex-1">
          <h3 className="text-xs font-bold text-white group-hover:text-codeflow-accent transition-colors leading-snug line-clamp-2">{item.name}</h3>
          {(item.description || item.notes) && (
            <p className="text-[10px] text-codeflow-text/50 leading-relaxed line-clamp-2">{item.description || item.notes}</p>
          )}
          <div className="flex items-center justify-between mt-auto pt-1">
            <span className="text-[9px] text-codeflow-muted truncate">{item.recommender || '—'}</span>
            {Number(item.total_votes) > 0 && (
              <span className="text-[9px] text-codeflow-muted">{item.total_votes}★</span>
            )}
          </div>
          {/* Status selector */}
          <select
            value={myStatus || ''}
            onChange={handleStatusChange}
            onClick={e => e.stopPropagation()}
            className="mt-1 w-full text-[10px] font-semibold rounded-lg px-2 py-1 outline-none cursor-pointer appearance-none text-center bg-codeflow-base text-white border border-white/10"
            style={{
              borderColor: myStatus === 'watched' ? 'rgba(74,222,128,0.5)' : myStatus === 'in_progress' ? 'rgba(250,204,21,0.5)' : myStatus === 'pending' ? 'rgba(96,165,250,0.5)' : undefined,
              color: myStatus === 'watched' ? '#4ade80' : myStatus === 'in_progress' ? '#facc15' : myStatus === 'pending' ? '#60a5fa' : undefined,
            }}
          >
            <option value="">— Mi estado —</option>
            <option value="watched">Vista ✓</option>
            <option value="in_progress">En progreso</option>
            <option value="pending">Pendiente</option>
          </select>
        </div>

        {/* Edit / Delete on hover */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20" onClick={e => e.stopPropagation()}>
          <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="p-1.5 rounded-lg bg-black/70 backdrop-blur-sm text-white/70 hover:text-codeflow-accent transition-colors"><Edit2 size={11} /></button>
          <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }} className="p-1.5 rounded-lg bg-black/70 backdrop-blur-sm text-white/70 hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
        </div>
      </motion.div>

      {createPortal(
        <AnimatePresence>
          {showDetail && (
            <MediaDetailModal
              item={item} tab={tab} isGame={isGame} getGenreColor={getGenreColor}
              poster={poster}
              onClose={() => setShowDetail(false)}
              onEdit={(it) => { setShowDetail(false); onEdit(it); }}
              onDelete={(id) => { setShowDetail(false); onDelete(id); }}
              onUpdateRating={onUpdateRating}
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => onDelete(item.id)}
        title="Eliminar item"
        message={`¿Seguro que querés eliminar "${item.name}" de la bóveda?`}
        confirmLabel="Eliminar"
        danger
      />
    </>
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
  const [initialStarRating, setInitialStarRating] = React.useState(0);
  const [searchSuggestions, setSearchSuggestions] = React.useState<any[]>([]);
  const [searchingTmdb, setSearchingTmdb] = React.useState(false);
  const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNameInput = (value: string) => {
    setFormData(prev => ({ ...prev, name: value }));
    setSearchSuggestions([]);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (value.length < 2) return;
    searchTimeout.current = setTimeout(async () => {
      setSearchingTmdb(true);
      try {
        if (isGame) {
          const res = await fetchWithAuth(`/api/bgg/search?query=${encodeURIComponent(value)}`);
          const data = await res.json();
          setSearchSuggestions(Array.isArray(data) ? data : []);
        } else {
          const type = tab === 'movies' ? 'movie' : 'tv';
          const res = await fetchWithAuth(`/api/tmdb/search?query=${encodeURIComponent(value)}&type=${type}`);
          const data = await res.json();
          setSearchSuggestions(Array.isArray(data) ? data : []);
        }
      } catch {} finally { setSearchingTmdb(false); }
    }, 400);
  };

  const applySearchSuggestion = (s: any) => {
    if (isGame) {
      setFormData(prev => ({ ...prev, name: s.name, notes: s.description || prev.notes, game_type: s.categories || prev.game_type }));
    } else {
      setFormData(prev => ({ ...prev, name: s.title || s.name, description: s.overview || prev.description, genre: s.genres || prev.genre }));
    }
    setSearchSuggestions([]);
  };
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [myStatuses, setMyStatuses] = React.useState<Record<string, string>>({});

  const endpointTab = tab === 'games' ? 'boardgames' : tab;

  const fetchMedia = () => {
    setLoading(true);
    Promise.all([
      fetchWithAuth(`/api/media/${endpointTab}`).then(r => r.json()),
      fetchWithAuth(`/api/media/${endpointTab}/my-statuses`).then(r => r.json()).catch(() => []),
    ])
      .then(([data, statuses]) => {
        setItems(Array.isArray(data) ? data : []);
        if (statuses && typeof statuses === 'object' && !Array.isArray(statuses)) {
          setMyStatuses(statuses);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching media:', err);
        setItems([]);
        setLoading(false);
      });
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetchWithAuth(`/api/media/${endpointTab}/${id}`, { method: 'DELETE' });
      if (res.ok) fetchMedia();
    } catch (err) {
      console.error('Error deleting:', err);
    }
  };

  const handleUpdateRating = async (id: string, rating: number) => {
    try {
      const res = await fetchWithAuth(`/api/media/${endpointTab}/${id}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating })
      });
      if (res.ok) fetchMedia(); // Refresh to get new avg_rating and total_votes
    } catch (err) {
      console.error('Error updating rating:', err);
    }
  };

  const [userList, setUserList] = React.useState<string[]>([]);

  const fetchUsers = () => {
    fetchWithAuth('/api/users/list')
      .then(res => res.json())
      .then(data => setUserList(Array.isArray(data) ? data : []))
      .catch(err => console.error('Error fetching users:', err));
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
    setShowCustomGenre(false);
  };

  const isGame = tab === 'games';

  React.useEffect(() => {
    fetchMedia();
    fetchUsers();
    setShowForm(false);
    setIsEditing(false);
    setEditingId(null);
    setSelectedGenre('All');
    setSearchQuery('');
    setStatusFilter('all');
    setSearchSuggestions([]);
  }, [tab]);

  const genres = React.useMemo(() => {
    const all = items.map(i => isGame ? i.game_type : i.genre).filter(Boolean).flatMap(g => g.split(',').map((s: string) => s.trim()));
    return ['All', ...Array.from(new Set(all))];
  }, [items, isGame]);

  const filteredItems = React.useMemo(() => {
    return items.filter(i => {
      const genreVal = isGame ? i.game_type : i.genre;
      if (selectedGenre !== 'All' && !(genreVal && genreVal.includes(selectedGenre))) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!(i.name?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q) || i.recommender?.toLowerCase().includes(q))) return false;
      }
      if (statusFilter !== 'all') {
        const s = myStatuses[i.id];
        if (statusFilter === 'none' && s) return false;
        if (statusFilter !== 'none' && s !== statusFilter) return false;
      }
      return true;
    });
  }, [items, selectedGenre, isGame, searchQuery, statusFilter, myStatuses]);

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
        const savedData = await res.json();
        // Auto-rate on new item creation if user selected an initial rating
        if (!isEditing && initialStarRating > 0 && savedData.item?.id) {
          await fetchWithAuth(`/api/media/${endpointTab}/${savedData.item.id}/rate`, {
            method: 'POST',
            body: JSON.stringify({ rating: initialStarRating })
          }).catch(() => { });
        }
        setShowForm(false);
        setIsEditing(false);
        setEditingId(null);
        setInitialStarRating(0);
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
          <h1 className="text-2xl md:text-4xl font-display font-bold text-white mb-2">{translations[tab]}</h1>
          <p className="text-codeflow-muted text-sm md:text-lg">Bóveda de recomendaciones grupales.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="input-base w-full sm:w-48 py-2.5 text-sm"
          />
          {items.length > 0 && (
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              className="bg-codeflow-card border border-white/10 text-white text-sm rounded-xl focus:ring-codeflow-accent focus:border-codeflow-accent block px-4 py-2.5 outline-none cursor-pointer appearance-none pr-10 relative w-full sm:w-auto"
              style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239CA3AF' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
            >
              {genres.map(g => (
                <option key={g} value={g}>{g === 'All' ? (isGame ? 'Todos los tipos' : 'Todos los géneros') : g}</option>
              ))}
            </select>
          )}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-codeflow-card border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 outline-none cursor-pointer appearance-none pr-10 w-full sm:w-auto"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239CA3AF' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
          >
            <option value="all">Todos</option>
            <option value="watched">Vista ✓</option>
            <option value="in_progress">En progreso</option>
            <option value="pending">Pendiente</option>
            <option value="none">Sin estado</option>
          </select>
          <button className="btn-primary w-full sm:w-auto whitespace-nowrap" onClick={() => {
            if (showForm && isEditing) {
              setIsEditing(false);
              setEditingId(null);
              setFormData({ recommender: '', name: '', genre: '', description: '', rating: '', game_type: '', players: '', duration: '', difficulty: '', notes: '' });
            }
            setInitialStarRating(0);
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
                    <div className="flex flex-col gap-2">
                      <select
                        required
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent outline-none appearance-none"
                        value={formData.recommender}
                        onChange={e => setFormData({ ...formData, recommender: e.target.value })}
                      >
                        <option value="" disabled>Recomendado por...</option>
                        {userList.map(u => <option key={u} value={u} className="bg-codeflow-dark">{u}</option>)}
                      </select>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={searchingTmdb ? 'Buscando...' : 'Nombre (busca automáticamente)'}
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent outline-none"
                        value={formData.name}
                        onChange={e => handleNameInput(e.target.value)}
                        autoComplete="off"
                      />
                      {searchSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-codeflow-card border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                          {searchSuggestions.map((s: any, i: number) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => applySearchSuggestion(s)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left border-b border-white/5 last:border-0 transition-colors"
                            >
                              {(s.poster || s.thumbnail) && (
                                <img src={s.poster || s.thumbnail} alt="" className="w-10 h-14 object-cover rounded-md shrink-0 border border-white/10" />
                              )}
                              <div className="min-w-0">
                                <p className="text-white text-sm font-semibold truncate">{s.title || s.name}</p>
                                {(s.year || s.genres || s.categories) && (
                                  <p className="text-codeflow-muted text-xs truncate">{[s.year, s.genres || s.categories].filter(Boolean).join(' · ')}</p>
                                )}
                                {s.overview && <p className="text-white/40 text-[10px] line-clamp-1 mt-0.5">{s.overview}</p>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

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
                    {!isEditing && (
                      <div className="md:col-span-2 flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                        <div>
                          <span className="text-sm text-white font-medium">Tu nota inicial</span>
                          <span className="text-[10px] text-codeflow-muted ml-2">(opcional)</span>
                        </div>
                        <StarRating rating={initialStarRating} onRate={setInitialStarRating} size={20} />
                      </div>
                    )}
                  </>
                )}
                {isGame && (
                  <>
                    <div className="flex flex-col gap-2">
                      <select
                        required
                        className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent outline-none appearance-none"
                        value={formData.recommender}
                        onChange={e => setFormData({ ...formData, recommender: e.target.value })}
                      >
                        <option value="" disabled>Recomendado por...</option>
                        {userList.map(u => <option key={u} value={u} className="bg-codeflow-dark">{u}</option>)}
                      </select>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={searchingTmdb ? 'Buscando en BGG...' : 'Nombre del juego (busca en BGG)'}
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent outline-none"
                        value={formData.name}
                        onChange={e => handleNameInput(e.target.value)}
                        autoComplete="off"
                      />
                      {searchSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-codeflow-card border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                          {searchSuggestions.map((s: any, i: number) => (
                            <button key={i} type="button" onClick={() => applySearchSuggestion(s)}
                              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-left border-b border-white/5 last:border-0 transition-colors">
                              {s.thumbnail && <img src={s.thumbnail} alt="" className="w-10 h-10 object-cover rounded-md shrink-0 border border-white/10" />}
                              <div className="min-w-0">
                                <p className="text-white text-sm font-semibold truncate">{s.name}</p>
                                {s.categories && <p className="text-codeflow-muted text-xs truncate">{s.categories}</p>}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

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

                    <input type="text" placeholder="Rating (Ej: Muy Divertido, Complejo)" className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-codeflow-accent" value={formData.rating} onChange={e => setFormData({ ...formData, rating: e.target.value })} />
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
        <div className="text-center py-20 border-2 border-dashed border-white/8 rounded-2xl flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center">
            <Film size={24} className="text-codeflow-muted/40" />
          </div>
          <p className="text-white/60 font-semibold">Sin resultados</p>
          <p className="text-codeflow-muted text-sm">Probá con otro filtro de género.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredItems.map((item, i) => (
            <MediaCard
              key={item.id}
              item={item}
              i={i}
              isGame={isGame}
              getGenreColor={getGenreColor}
              tab={tab}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onUpdateRating={handleUpdateRating}
              myStatus={myStatuses[item.id]}
              onStatusChange={(id, status) => setMyStatuses(prev => ({ ...prev, [id]: status }))}
            />
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
    <div className="glass-card p-5 md:p-8 min-h-[500px] border-t-4 border-t-red-500 rounded-t-none">
      <h3 className="text-xl md:text-2xl font-bold text-white mb-2 flex items-center gap-3">
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
        { label: "Carrera (Top 5)", pts: "+10 pts c/u", desc: "Acertá las 5 primeras posiciones exactas del domingo. Máximo 50 pts por carrera." },
        { label: "Clasificación (Top 5)", pts: "+10 pts c/u", desc: "Acertá los 5 pilotos más rápidos de la Qualy tradicional en orden exacto. Máximo 50 pts." },
        { label: "Sprint Race (Top 5)", pts: "+8 pts c/u", desc: "Acertá los 5 primeros de la carrera corta en orden exacto. Máximo 40 pts." },
        { label: "Sprint Qualifying (Top 5)", pts: "+5 pts c/u", desc: "Acertá los 5 primeros de la tanda del viernes en orden exacto. Máximo 25 pts." },
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
    <div className="glass-card p-5 md:p-8 min-h-[500px] border-t-4 border-t-purple-500 rounded-t-none">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 md:mb-10 text-center text-balance">
          <h3 className="text-xl md:text-3xl font-display font-bold text-white mb-3 tracking-tight">Manual de Operaciones: CodeWeb F1</h3>
          <p className="text-codeflow-muted text-sm md:text-lg">Todo lo que necesitás saber para dominar el paddock.</p>
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
  const [sendingReminder, setSendingReminder] = React.useState(false);
  const [reminderMsg, setReminderMsg] = React.useState<string | null>(null);

  const SESSION_CONFIG = {
    race: { label: '🏁 Carrera', fields: ['p1', 'p2', 'p3', 'p4', 'p5'], hasPole: false },
    qualifying: { label: '🏎️ Clasificación', fields: ['p1', 'p2', 'p3', 'p4', 'p5'], hasPole: false },
    sprint: { label: '🏃 Sprint Race', fields: ['p1', 'p2', 'p3', 'p4', 'p5'], hasPole: false },
    sprint_qualifying: { label: '⚡ Sprint Qualifying', fields: ['p1', 'p2', 'p3', 'p4', 'p5'], hasPole: false },
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
    const driverName = (d: any) => `${d.givenName} ${d.familyName}`;
    try {
      if (selectedSession === 'race') {
        const [resRace, resQual] = await Promise.all([
          fetch(`https://api.jolpi.ca/ergast/f1/2026/${selectedRound}/results.json`),
          fetch(`https://api.jolpi.ca/ergast/f1/2026/${selectedRound}/qualifying.json`),
        ]);
        const raceData = await resRace.json();
        const qualData = await resQual.json();
        const results = raceData.MRData.RaceTable.Races[0]?.Results;
        const qResults = qualData.MRData.RaceTable.Races[0]?.QualifyingResults;
        if (results && results.length >= 5) {
          setP1(driverName(results[0].Driver)); setP2(driverName(results[1].Driver));
          setP3(driverName(results[2].Driver)); setP4(driverName(results[3].Driver));
          setP5(driverName(results[4].Driver));
          setResultMessage({ message: "¡Resultados de carrera sincronizados!" });
        }
        if (qResults?.[0]) {
          setPole(driverName(qResults[0].Driver));
          setResultMessage((prev: any) => ({ ...prev, message: (prev?.message || '') + ' ¡Pole sincronizada!' }));
        }
        if (!results && !qResults) setResultMessage({ error: "No hay datos oficiales todavía para este GP." });

      } else if (selectedSession === 'qualifying') {
        const res = await fetch(`https://api.jolpi.ca/ergast/f1/2026/${selectedRound}/qualifying.json`);
        const data = await res.json();
        const qResults = data.MRData.RaceTable.Races[0]?.QualifyingResults;
        if (qResults && qResults.length >= 5) {
          setP1(driverName(qResults[0].Driver));
          setP2(driverName(qResults[1].Driver));
          setP3(driverName(qResults[2].Driver));
          setP4(driverName(qResults[3].Driver));
          setP5(driverName(qResults[4].Driver));
          setResultMessage({ message: "¡Top 5 de Clasificación sincronizados!" });
        } else {
          setResultMessage({ error: "No hay datos de Clasificación todavía para este GP." });
        }

      } else if (selectedSession === 'sprint') {
        const res = await fetch(`https://api.jolpi.ca/ergast/f1/2026/${selectedRound}/sprint.json`);
        const data = await res.json();
        const sprintResults = data.MRData.RaceTable.Races[0]?.SprintResults;
        if (sprintResults && sprintResults.length >= 5) {
          setP1(driverName(sprintResults[0].Driver));
          setP2(driverName(sprintResults[1].Driver));
          setP3(driverName(sprintResults[2].Driver));
          setP4(driverName(sprintResults[3].Driver));
          setP5(driverName(sprintResults[4].Driver));
          setResultMessage({ message: "¡Top 5 de Sprint sincronizados!" });
        } else {
          setResultMessage({ error: "No hay datos de Sprint todavía para este GP." });
        }

      } else if (selectedSession === 'sprint_qualifying') {
        const res = await fetch(`https://api.jolpi.ca/ergast/f1/2026/${selectedRound}/qualifying.json`);
        const data = await res.json();
        const sqResults = data.MRData.RaceTable.Races[0]?.QualifyingResults;
        if (sqResults && sqResults.length >= 5) {
          setP1(driverName(sqResults[0].Driver));
          setP2(driverName(sqResults[1].Driver));
          setP3(driverName(sqResults[2].Driver));
          setP4(driverName(sqResults[3].Driver));
          setP5(driverName(sqResults[4].Driver));
          setResultMessage({ message: "¡Top 5 de Sprint Qualifying sincronizados!" });
        } else {
          setResultMessage({ error: "No hay datos de Sprint Qualifying todavía para este GP." });
        }
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

  const handleSendReminder = async (sessionType: string) => {
    setSendingReminder(true);
    setReminderMsg(null);
    try {
      const res = await fetchWithAuth('/api/admin/whatsapp/remind', {
        method: 'POST',
        body: JSON.stringify({ session_type: sessionType }),
      });
      const data = await res.json();
      setReminderMsg(data.message || (data.sent ? 'Mensaje enviado.' : 'Sin cambios.'));
    } catch {
      setReminderMsg('Error al enviar el mensaje.');
    } finally {
      setSendingReminder(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <header>
        <h1 className="text-2xl md:text-4xl font-display font-bold text-white mb-2 flex items-center gap-3">
          <ShieldAlert size={26} className="text-codeflow-accent shrink-0" />
          Panel de Administración
        </h1>
        <p className="text-codeflow-muted text-sm md:text-lg">Cargá los resultados oficiales de cada GP para calcular los puntajes automáticamente.</p>
      </header>

      <div className="glass-card p-5 md:p-8 max-w-2xl">
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/30 ">
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

      {/* WhatsApp Reminders */}
      <div className="glass-card p-5 md:p-8 max-w-2xl">
        <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
          <span className="text-green-400">💬</span> Recordatorios WhatsApp
        </h3>
        <p className="text-codeflow-muted text-sm mb-6">Envía un mensaje al grupo indicando quién falta cargar pronóstico para la próxima sesión.</p>
        <div className="flex flex-wrap gap-3">
          {(['race', 'qualifying', 'sprint', 'sprint_qualifying'] as const).map(s => {
            const labels: Record<string, string> = { race: '🏁 Carrera', qualifying: '🏎️ Clasificación', sprint: '🏃 Sprint', sprint_qualifying: '⚡ Sprint Q' };
            return (
              <button
                key={s}
                onClick={() => handleSendReminder(s)}
                disabled={sendingReminder}
                className="px-4 py-2.5 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40 flex items-center gap-2"
              >
                {sendingReminder ? <RefreshCw size={14} className="animate-spin" /> : null}
                {labels[s]}
              </button>
            );
          })}
        </div>
        {reminderMsg && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 text-sm text-green-300 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3">
            {reminderMsg}
          </motion.p>
        )}
      </div>
    </div>
  );
}

export default App;