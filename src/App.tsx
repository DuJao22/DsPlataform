import React, { createContext, useContext, useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, Link } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut, 
  Menu, 
  X, 
  Plus, 
  Search, 
  TrendingUp, 
  DollarSign, 
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  Zap,
  ChevronRight,
  Eye,
  Download,
  UserCog,
  Edit
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { cn } from "./lib/utils";
import { extractLeads, ExtractedLead } from "./services/geminiService";

// --- Types ---
interface User {
  id: number;
  name: string;
  email: string;
  role: 'superadmin' | 'gerente' | 'vendas';
  token: string;
  gemini_api_key?: string;
  external_lp_endpoint?: string;
}

interface Lead {
  id: number;
  nome_cliente: string;
  niche: string;
  telefone: string;
  cidade: string;
  dados_json: string;
  status: 'novo' | 'atribuido' | 'em_producao' | 'produzido' | 'enviado_vendas' | 'contatado' | 'negociacao' | 'fechado' | 'recusado';
  link_landing_page?: string;
  gerente_id?: number;
  gerente_nome?: string;
  criado_por: number;
  data_criacao: string;
}

// --- Auth Context ---
const AuthContext = createContext<{
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  updateUserSettings: (settings: { gemini_api_key?: string, external_lp_endpoint?: string }) => void;
}>({
  user: null,
  login: () => {},
  logout: () => {},
  updateUserSettings: () => {},
});

const useAuth = () => useContext(AuthContext);

// --- API Service ---
const API_URL = "/api";

const api = {
  async get(endpoint: string, token?: string) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    });
    const contentType = res.headers.get("content-type");
    if (res.ok && contentType && contentType.includes("application/json")) {
      return res.json();
    }
    if (res.status === 401) {
      localStorage.removeItem("ds_company_user");
      window.location.href = "/";
    }
    const err = await res.json().catch(() => ({ error: "Erro desconhecido no servidor" }));
    throw new Error(err.error || `Erro ${res.status}`);
  },
  async post(endpoint: string, data: any, token?: string) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify(data),
    });
    const contentType = res.headers.get("content-type");
    if (res.ok && contentType && contentType.includes("application/json")) {
      return res.json();
    }
    if (res.status === 401) {
      localStorage.removeItem("ds_company_user");
      window.location.href = "/";
    }
    const err = await res.json().catch(() => ({ error: "Falha na requisição POST" }));
    throw new Error(err.error || `Erro ${res.status}`);
  },
  async patch(endpoint: string, data: any, token?: string) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: token ? `Bearer ${token}` : "",
      },
      body: JSON.stringify(data),
    });
    const contentType = res.headers.get("content-type");
    if (res.ok && contentType && contentType.includes("application/json")) {
      return res.json();
    }
    if (res.status === 401) {
      localStorage.removeItem("ds_company_user");
      window.location.href = "/";
    }
    const err = await res.json().catch(() => ({ error: "Falha na requisição PATCH" }));
    throw new Error(err.error || `Erro ${res.status}`);
  },
  async delete(endpoint: string, token?: string) {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: "DELETE",
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    });
    const contentType = res.headers.get("content-type");
    if (res.ok) {
      if (contentType && contentType.includes("application/json")) return res.json();
      return { success: true };
    }
    if (res.status === 401) {
      localStorage.removeItem("ds_company_user");
      window.location.href = "/";
    }
    throw new Error("Falha ao deletar recurso");
  }
};

// --- Components ---

const Sidebar = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const { user, logout } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ 
    gemini_api_key: user?.gemini_api_key || "", 
    external_lp_endpoint: user?.external_lp_endpoint || "" 
  });
  const { updateUserSettings } = useAuth();
  const location = useLocation();

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch("/auth/settings", profileForm, user?.token);
      updateUserSettings(profileForm);
      setShowProfileModal(false);
      alert("Configurações salvas!");
    } catch (err) {
      alert("Falha ao salvar configurações.");
    }
  };

  const menuItems = [
    { name: "Painel Central", path: "/", icon: LayoutDashboard },
    { name: "Fluxo de Leads", path: "/leads", icon: Users },
  ];

  if (user?.role === 'gerente') {
    menuItems.push({ name: "Templates de Produção", path: "/templates", icon: Zap });
  }

  if (user?.role === 'superadmin') {
    menuItems.push({ name: "Monitor de IA", path: "/analytics", icon: TrendingUp });
    menuItems.push({ name: "Gestão de Time", path: "/billing", icon: Settings });
  }

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 w-72 bg-background border-r border-border flex flex-col z-50 transition-transform duration-300 lg:relative lg:translate-x-0 lg:flex",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg shrink-0 flex items-center justify-center font-bold text-black border-2 border-black/10 shadow-[0_0_15px_rgba(0,255,136,0.5)]">DS</div>
            <span className="text-xl font-bold tracking-tight uppercase">DS <span className="text-primary italic">COMPANY</span></span>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-muted hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <div className="mb-4 px-4 text-[10px] uppercase tracking-[0.2em] text-dim font-bold">Menu Principal</div>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => onClose()}
                className={cn(
                  "nav-link text-sm h-12",
                  isActive && "nav-link-active"
                )}
              >
                <item.icon size={18} />
                <span className="font-semibold">{item.name}</span>
                {isActive && (
                  <motion.div 
                    layoutId="active-pill"
                    className="ml-auto w-1 h-3 rounded-full bg-primary"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-6">
          <div 
            onClick={() => {
              setProfileForm({ 
                gemini_api_key: user?.gemini_api_key || "", 
                external_lp_endpoint: user?.external_lp_endpoint || "" 
              });
              setShowProfileModal(true);
            }}
            className="bg-surface border border-border p-4 rounded-3xl relative overflow-hidden group cursor-pointer hover:border-primary/50 transition-all"
          >
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="flex items-center gap-3 mb-3 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-emerald-400 flex items-center justify-center font-black text-black text-xs">
                {user?.name[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate text-white">{user?.name || "User Name"}</p>
                <p className="text-[10px] text-primary uppercase tracking-widest font-bold">{user?.role || "Acesso"}</p>
              </div>
            </div>
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="w-[100%] h-full bg-primary shadow-[0_0_10px_#00FF88]"></div>
            </div>
            <p className="text-[8px] text-muted mt-2 font-bold uppercase tracking-widest text-center group-hover:text-white transition-colors">Configurações de Perfil</p>
          </div>
        </div>

        <button 
          onClick={logout}
          className="nav-link mx-4 mb-6 text-red-500/70 hover:bg-red-500/10 hover:text-red-500"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </aside>

      {/* Profile Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card w-full max-w-sm p-10 border-primary/20">
               <div className="flex items-center justify-between mb-8">
                 <h3 className="text-2xl font-bold italic tracking-tighter uppercase underline decoration-primary decoration-4 underline-offset-8">SEU <span className="text-primary italic">PERFIL</span></h3>
                 <button onClick={() => setShowProfileModal(false)}><X size={20} className="text-white hover:text-primary transition-colors" /></button>
               </div>
               <form onSubmit={handleUpdateProfile} className="space-y-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-white uppercase tracking-widest block font-mono flex items-center gap-2">
                      <Zap size={10} className="text-primary fill-current" /> Sincronia Gemini (Chave API)
                   </label>
                   <input 
                     type="password"
                     className="input-field w-full border-primary/10" 
                     placeholder="Cole sua GEMINI_API_KEY aqui"
                     value={profileForm.gemini_api_key}
                     onChange={e => setProfileForm({...profileForm, gemini_api_key: e.target.value})}
                   />
                   <p className="text-[8px] text-muted font-bold leading-relaxed px-1 text-center italic opacity-80">Use sua própria chave para evitar limites globais.</p>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-white uppercase tracking-widest block font-mono flex items-center gap-2">
                      <ArrowUpRight size={10} className="text-primary" /> Gateway de Produção (Endpoint)
                   </label>
                   <input 
                     type="url"
                     className="input-field w-full border-primary/10" 
                     placeholder="https://seu-sistema.com/api/create-lp"
                     value={profileForm.external_lp_endpoint}
                     onChange={e => setProfileForm({...profileForm, external_lp_endpoint: e.target.value})}
                   />
                   <p className="text-[8px] text-muted font-bold leading-relaxed px-1 text-center italic opacity-80">URL para onde enviaremos o JSON do Lead para automação.</p>
                 </div>
                 <button type="submit" className="btn-primary w-full py-4 mt-4 shadow-[0_10px_25px_rgba(0,255,136,0.2)]">Salvar Alterações</button>
               </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex bg-background min-h-screen relative overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-20 border-b border-border flex items-center justify-between px-6 md:px-10 shrink-0 bg-background/50 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 -ml-2 lg:hidden text-muted hover:text-white transition-colors"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg md:text-xl font-bold tracking-tighter uppercase italic">
              DS <span className="text-primary">OS</span>
            </h1>
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <div className="relative hidden md:block">
              <Search className="w-3.5 h-3.5 text-dim absolute left-4 top-2.5" />
              <input 
                type="text" 
                placeholder="Pesquisar no sistema..." 
                className="input-field w-48 lg:w-64 pl-10 py-2 h-9 text-[10px]"
              />
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-border rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest text-dim">Cloud Sync</span>
            </div>
          </div>
        </header>

        <div className="p-5 md:p-10 flex-1 custom-scrollbar">
          {children}
        </div>

        <footer className="px-6 md:px-10 py-5 flex flex-col md:flex-row items-center justify-between border-t border-border text-[9px] text-dim font-bold tracking-[0.2em] uppercase shrink-0 gap-4">
          <div className="flex gap-6">
            <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-primary" /> API: OK</span>
            <span className="flex items-center gap-1.5"><div className="w-1 h-1 rounded-full bg-primary" /> DB: OS</span>
          </div>
          <div className="text-center md:text-right opacity-50">V3.1.2-STABLE • DS OS SYSTEM</div>
        </footer>
      </main>
    </div>
  );
};

// --- Pages ---

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const data = isLogin ? { email, password } : { name, email, password };
      const res = await api.post(endpoint, data);
      
      if (res.token) {
        login({ ...res.user, token: res.token });
      } else if (!isLogin && res.id) {
        setIsLogin(true);
        alert("Conta criada! Por favor, faça login.");
      } else {
        alert(res.error || "Algo deu errado na autenticação.");
      }
    } catch (err) {
      alert("Erro de conexão com a DS Cloud.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-[#050505]">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-md p-12 z-10 border-white/5 border-[1px] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      >
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(0,255,136,0.3)]">
            <Zap className="text-black w-8 h-8 fill-current" />
          </div>
          <h2 className="text-3xl font-black mb-2 tracking-tighter italic uppercase underline decoration-primary decoration-4 underline-offset-8">DS <span className="text-primary italic">OS</span></h2>
          <p className="text-muted text-xs font-bold uppercase tracking-[0.2em] mt-4">Gestor de Operações DS Company</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Nome Completo</label>
              <input 
                type="text" 
                required 
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full bg-white/5 border border-border rounded-2xl px-4 py-3.5 outline-none focus:border-primary/50 transition-all font-bold text-sm"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Usuário ou E-mail</label>
            <input 
              type="text" 
              required 
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Digite seu acesso"
              className="w-full bg-white/5 border border-border rounded-2xl px-4 py-3.5 outline-none focus:border-primary/50 transition-all font-bold text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Chave de Acesso</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-border rounded-2xl px-4 py-3.5 outline-none focus:border-primary/50 transition-all font-bold text-sm"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="bg-primary hover:bg-emerald-400 text-black w-full h-14 mt-4 flex items-center justify-center gap-2 rounded-2xl font-black uppercase tracking-[0.2em] transition-all shadow-[0_0_20px_rgba(0,255,136,0.2)]"
          >
            {loading ? "Processando..." : "Acessar Sistema"}
          </button>
        </form>

        <p className="mt-10 text-center text-dim text-[10px] font-bold uppercase tracking-widest opacity-50">
          Acesso restrito a membros autorizados.<br/>Contate o administrador para novas credenciais.
        </p>
      </motion.div>
    </div>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const { user } = useAuth();

  useEffect(() => {
    api.get("/stats", user?.token).then(setStats);
  }, [user]);

  const statusColors: any = {
    novo: "bg-blue-500",
    atribuido: "bg-purple-500",
    em_producao: "bg-orange-500",
    produzido: "bg-primary",
    enviado_vendas: "bg-indigo-500",
    contatado: "bg-cyan-500",
    negociacao: "bg-yellow-500",
    fechado: "bg-primary shadow-[0_0_10px_#00FF88]",
    recusado: "bg-red-500"
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">DS <span className="text-primary italic">OPERATIONS</span></h1>
          <p className="text-muted text-[10px] sm:text-sm uppercase tracking-widest font-bold">Acesso Nível: <span className="text-white">{user?.role}</span></p>
        </div>
        <div className="flex items-center gap-2 bg-surface px-4 py-2 border border-border rounded-2xl self-start md:self-auto">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Sincronizado com Nexus Cloud</span>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[
          { label: "Total Gerenciado", value: stats?.totalLeads || '0', icon: Users, sub: "Leads em fluxo" },
          { label: "Taxa de Fechamento", value: "24%", icon: TrendingUp, sub: "Média do time" },
          { label: "Eficiência Operacional", value: "98%", icon: ShieldCheck, sub: "Sistema Nexus V2" },
          { label: "Carga do Sistema", value: "Normal", icon: Zap, sub: "Latência 12ms" }
        ].map((item, id) => (
          <div key={id} className="bg-surface border border-border p-5 md:p-6 rounded-[32px] hover:border-primary/30 transition-colors">
            <p className="text-muted text-[9px] md:text-[10px] uppercase tracking-widest font-bold mb-4">{item.label}</p>
            <div className="flex items-end justify-between">
              <h3 className="text-3xl md:text-4xl font-bold tracking-tighter">{item.value}</h3>
              <item.icon size={18} className="text-primary mb-1" />
            </div>
            <p className="text-[9px] md:text-[10px] text-dim mt-2 uppercase font-medium">{item.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-surface border border-border p-8 rounded-[40px] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold tracking-tight">Status da Operação</h2>
            <div className="flex gap-1">
               {['#00FF88', '#3b82f6', '#ef4444'].map(c => <div key={c} className="w-1 h-1 rounded-full" style={{backgroundColor: c}} />)}
            </div>
          </div>
          <div className="space-y-4 flex-1">
            {stats?.leadsByStatus?.map((s: any) => (
              <div key={s.status} className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                  <span>{s.status}</span>
                  <span className="text-white">{s.count}</span>
                </div>
                <div className="h-1.5 bg-background border border-border rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full transition-all duration-1000", statusColors[s.status] || 'bg-white')} 
                    style={{ width: `${Math.min(100, (s.count / stats.totalLeads) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border p-8 rounded-[40px]">
           <h2 className="text-xl font-bold mb-6">Últimas Movimentações</h2>
           <div className="space-y-6">
             {stats?.recentLeads?.length > 0 ? stats.recentLeads.map((lead: Lead) => (
               <div key={lead.id} className="flex items-center gap-4 group">
                 <div className={cn("w-2 h-2 rounded-full", statusColors[lead.status] || 'bg-white')} />
                 <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate group-hover:text-primary transition-colors cursor-default">{lead.nome_cliente}</p>
                    <p className="text-[10px] text-muted uppercase tracking-widest font-bold">{lead.status} • {lead.cidade}</p>
                 </div>
                 <ArrowUpRight size={14} className="text-dim group-hover:text-white transition-colors" />
               </div>
             )) : <p className="text-dim text-xs font-mono lowercase">sem logs recentes...</p>}
           </div>
        </div>
      </div>
    </motion.div>
  );
};

const LeadsPage = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [gerentes, setGerentes] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [extracting, setExtracting] = useState(false);
  
  // Create / Assign Modal states
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [targetGerente, setTargetGerente] = useState("");

  // Lead Form
  const [form, setForm] = useState({ nome_cliente: "", niche: "", telefone: "", cidade: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");

  // Production
  const [showProduceModal, setShowProduceModal] = useState(false);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [lpLink, setLpLink] = useState("");
  const [showDataModal, setShowDataModal] = useState(false);
  const [automating, setAutomating] = useState(false);

  const filteredLeads = leads.filter(l => {
    const matchesSearch = 
      l.nome_cliente.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.cidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.niche.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (l.gerente_nome || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "todos" || l.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleAutomateLP = async (lead: Lead) => {
    if (!user?.external_lp_endpoint) {
      alert("Por favor, configure sua URL de Endpoint no seu Perfil antes de automatizar.");
      return;
    }
    setAutomating(true);
    try {
      const res = await fetch(user.external_lp_endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: lead.dados_json
      });
      const data = await res.json();
      if (data.url || data.link) {
        setLpLink(data.url || data.link);
        alert("LP Gerada automaticamente pelo endpoint!");
      } else {
        alert("Endpoint executado, mas não retornou um link de LP.");
      }
    } catch (err) {
      alert("Falha ao conectar com o endpoint de automação.");
    } finally {
      setAutomating(false);
    }
  };

  const downloadJSON = (data: any, fileName: string) => {
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      const jsonString = JSON.stringify(parsed, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName.replace(/\s+/g, '_')}_data.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Erro ao gerar arquivo para download.");
    }
  };

  const [showAIScanModal, setShowAIScanModal] = useState(false);
  const [aiNiche, setAiNiche] = useState("");
  const [aiTargetGerente, setAiTargetGerente] = useState("");

  const fetchLeads = () => api.get("/leads", user?.token).then(setLeads);
  const fetchGerentes = () => api.get("/users/gerentes", user?.token).then(setGerentes);

  useEffect(() => {
    fetchLeads();
    if (user?.role === 'superadmin') fetchGerentes();
  }, [user]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/leads", form, user?.token);
    setForm({ nome_cliente: "", niche: "", telefone: "", cidade: "" });
    setShowModal(false);
    fetchLeads();
  };

  const handleAISearch = async (nicheQuery: string, gerenteId?: number) => {
    setExtracting(true);
    setShowAIScanModal(false);
    try {
      const results = await extractLeads(nicheQuery, user?.gemini_api_key);
      for (const lead of results) {
        await api.post("/leads", {
          nome_cliente: lead.name,
          niche: nicheQuery,
          telefone: lead.phone,
          cidade: lead.address,
          dados_json: lead,
          gerente_id: gerenteId
        }, user?.token);
      }
      fetchLeads();
      setAiNiche("");
      setAiTargetGerente("");
    } catch (err: any) {
      alert(err.message || "Falha na extração de leads.");
    } finally {
      setExtracting(false);
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const leadsToImport = Array.isArray(json) ? json : [json];
        
        for (const lead of leadsToImport) {
          await api.post("/leads", {
            nome_cliente: lead.nome_cliente || lead.name || "Inominado",
            niche: lead.niche || "Importado",
            telefone: lead.telefone || lead.phone || "",
            cidade: lead.cidade || lead.address || "",
            dados_json: lead
          }, user?.token);
        }
        fetchLeads();
        alert(`${leadsToImport.length} leads importados com sucesso.`);
      } catch (err) {
        alert("Erro ao ler arquivo JSON. Verifique o formato.");
      }
    };
    reader.readAsText(file);
  };

  const handleAssign = async () => {
    if (!targetGerente) return;
    await api.post("/leads/assign", { leadIds: selectedLeadIds, gerenteId: Number(targetGerente) }, user?.token);
    setSelectedLeadIds([]);
    setShowAssignModal(false);
    fetchLeads();
  };

  const handleProduce = async () => {
    if (!activeLead || !lpLink) return;
    await api.post(`/leads/${activeLead.id}/produce`, { link_landing_page: lpLink }, user?.token);
    setShowProduceModal(false);
    setActiveLead(null);
    setLpLink("");
    fetchLeads();
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`${API_URL}/leads/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user?.token}`
      },
      body: JSON.stringify({ status })
    });
    fetchLeads();
  };

  const statusColors: any = {
    novo: "text-blue-500 bg-blue-500/10 border-blue-500/20",
    atribuido: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    em_producao: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    produzido: "text-primary bg-primary/10 border-primary/20",
    fechado: "text-primary bg-primary/20 border-primary/40",
    recusado: "text-red-500 bg-red-500/10 border-red-500/20"
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-8 gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Gestão de <span className="text-primary italic">Leads</span></h1>
          <p className="text-muted text-[9px] md:text-sm font-medium uppercase tracking-[0.2em] mt-1">Status Operacional do Fluxo DS</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <div className="relative group w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-dim group-focus-within:text-primary transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="Pesquisar loja..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-surface border border-border rounded-full pl-12 pr-6 py-2.5 outline-none focus:border-primary/50 text-xs font-bold transition-all"
            />
          </div>
          <select 
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-surface border border-border rounded-full px-4 py-2.5 outline-none focus:border-primary/50 text-[10px] font-black uppercase tracking-widest cursor-pointer appearance-none min-w-[120px]"
          >
            <option value="todos">Todos Status</option>
            <option value="novo">Novo</option>
            <option value="atribuido">Atribuído</option>
            <option value="em_producao">Em Produção</option>
            <option value="produzido">Produzido</option>
            <option value="fechado">Fechado</option>
            <option value="recusado">Recusado</option>
          </select>

          {user?.role === 'superadmin' && (
            <>
              <label className="btn-secondary rounded-full flex-1 sm:flex-none cursor-pointer flex items-center justify-center">
                <span>Importar JSON</span>
                <input type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
              </label>
              <button 
                onClick={() => setShowAIScanModal(true)}
                disabled={extracting}
                className="btn-secondary rounded-full flex-1 sm:flex-none"
              >
                {extracting ? "Extraindo..." : "IA Scan + Destino"}
              </button>
              <button onClick={() => setShowModal(true)} className="btn-primary rounded-full px-8 flex-1 sm:flex-none">Novo Lead</button>
            </>
          )}
          {user?.role === 'superadmin' && selectedLeadIds.length > 0 && (
            <button 
              onClick={() => setShowAssignModal(true)}
              className="bg-primary text-black font-black text-[10px] uppercase tracking-widest px-6 py-3 rounded-full shadow-[0_0_15px_#00FF88] flex-1 sm:flex-none"
            >
              Atribuir ({selectedLeadIds.length})
            </button>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-[40px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-border bg-white/[0.03]">
                {user?.role === 'superadmin' && <th className="px-6 py-5"></th>}
                <th className="px-6 py-5 text-[10px] font-bold text-white uppercase tracking-widest">Estabelecimento</th>
                <th className="px-6 py-5 text-[10px] font-bold text-white uppercase tracking-widest">Cidade/Nicho</th>
                <th className="px-6 py-5 text-[10px] font-bold text-white uppercase tracking-widest text-center">Status</th>
                {user?.role === 'superadmin' && <th className="px-6 py-5 text-[10px] font-bold text-white uppercase tracking-widest">Responsável</th>}
                <th className="px-6 py-5 text-[10px] font-bold text-white uppercase tracking-widest text-right">Ações Operacionais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLeads.map(lead => (
                <tr key={lead.id} className="hover:bg-white/[0.01] transition-colors group">
                  {user?.role === 'superadmin' && (
                    <td className="px-6 py-5">
                      <input 
                        type="checkbox" 
                        checked={selectedLeadIds.includes(lead.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedLeadIds([...selectedLeadIds, lead.id]);
                          else setSelectedLeadIds(selectedLeadIds.filter(id => id !== lead.id));
                        }}
                        className="accent-primary w-4 h-4"
                      />
                    </td>
                  )}
                  <td className="px-6 py-5">
                    <p className="text-sm font-bold text-white mb-0.5">{lead.nome_cliente}</p>
                    <p className="text-[10px] text-muted uppercase tracking-widest">{lead.telefone}</p>
                  </td>
                  <td className="px-6 py-5">
                    <p className="text-[10px] font-mono text-dim">{lead.cidade}</p>
                    <p className="text-[10px] font-bold text-primary/70 uppercase">{lead.niche}</p>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border",
                      statusColors[lead.status] || "text-dim bg-white/5 border-border"
                    )}>
                      {lead.status}
                    </span>
                  </td>
                  {user?.role === 'superadmin' && (
                    <td className="px-6 py-5">
                      <span className="text-[10px] uppercase font-bold text-dim tracking-widest">
                        {lead.gerente_nome || "— Não Atribuído"}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                      {user?.role === 'gerente' && lead.status === 'atribuido' && (
                        <button 
                          onClick={() => { setActiveLead(lead); setShowProduceModal(true); }}
                          className="px-4 py-1.5 bg-primary text-black text-[10px] font-bold uppercase tracking-widest rounded-full"
                        >
                          Produzir LP
                        </button>
                      )}
                      {user?.role === 'vendas' && lead.status === 'produzido' && (
                        <select 
                          onChange={(e) => updateStatus(lead.id, e.target.value)}
                          className="bg-surface border border-border text-[10px] font-bold p-1 rounded-lg outline-none"
                        >
                          <option value="">Ação Vendas</option>
                          <option value="contatado">Contatado</option>
                          <option value="negociacao">Negociação</option>
                          <option value="fechado">Fechado</option>
                          <option value="recusado">Recusado</option>
                        </select>
                      )}
                      {lead.link_landing_page && (
                        <a href={lead.link_landing_page} target="_blank" className="p-2 bg-white/5 border border-border rounded-full hover:bg-white/10 text-dim hover:text-primary transition-colors">
                          <ArrowUpRight size={14} />
                        </a>
                      )}
                      {(user?.role === 'superadmin' || user?.role === 'gerente' || user?.role === 'vendas') && (
                        <button 
                          onClick={() => { setActiveLead(lead); setShowDataModal(true); }}
                          className="p-2 bg-white/5 border border-border rounded-full hover:bg-white/10 text-dim hover:text-primary transition-colors"
                          title="Visualizar Dados"
                        >
                          <Eye size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Scan Modal */}
      <AnimatePresence>
        {showAIScanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card w-full max-w-md p-10">
              <h3 className="text-2xl font-bold mb-6 italic">IA OS <span className="text-primary italic">Scanner</span></h3>
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-bold text-dim uppercase tracking-widest block mb-2 font-mono">Nicho / Query de Prospecção</label>
                  <input 
                    className="input-field w-full" 
                    placeholder="Ex: Clínicas Odontológicas em Barueri"
                    value={aiNiche}
                    onChange={e => setAiNiche(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-dim uppercase tracking-widest block mb-2 font-mono">Destino Direto (Gerente)</label>
                  <select 
                    className="input-field w-full appearance-none"
                    value={aiTargetGerente}
                    onChange={e => setAiTargetGerente(e.target.value)}
                  >
                    <option value="">Apenas Salvar (Sem Atribuição)</option>
                    {gerentes.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-4 pt-4">
                  <button onClick={() => setShowAIScanModal(false)} className="btn-secondary flex-1">Voltar</button>
                  <button 
                    onClick={() => handleAISearch(aiNiche, aiTargetGerente ? Number(aiTargetGerente) : undefined)}
                    disabled={!aiNiche}
                    className="flex-1 btn-primary"
                  >
                    Iniciar Varredura
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Assignment Modal */}
      <AnimatePresence>
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-surface border border-border p-10 rounded-[40px] w-full max-w-sm">
              <h3 className="text-xl font-bold mb-6">Atribuir a Gerente</h3>
              <select 
                value={targetGerente} 
                onChange={e => setTargetGerente(e.target.value)}
                className="w-full bg-background border border-border px-4 py-3 rounded-2xl outline-none focus:border-primary"
              >
                <option value="">Selecione um Gerente</option>
                {gerentes.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-4 mt-8">
                <button onClick={() => setShowAssignModal(false)} className="btn-secondary py-2">Cancelar</button>
                <button onClick={handleAssign} className="btn-primary py-2 rounded-2xl font-bold">Atribuir</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Lead Create Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-surface border border-border p-10 rounded-[40px] w-full max-w-md">
               <h3 className="text-2xl font-bold mb-8 italic">Configurar Novo <span className="text-primary italic">Lead</span></h3>
               <form onSubmit={handleAdd} className="space-y-4">
                 <input 
                  placeholder="Nome do Cliente" 
                  value={form.nome_cliente} 
                  onChange={e => setForm({...form, nome_cliente: e.target.value})} 
                  className="w-full bg-background border border-border px-4 py-3 rounded-2xl outline-none"
                 />
                 <div className="grid grid-cols-2 gap-4">
                   <input placeholder="Nicho" value={form.niche} onChange={e => setForm({...form, niche: e.target.value})} className="bg-background border border-border px-4 py-3 rounded-2xl outline-none" />
                   <input placeholder="Cidade" value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})} className="bg-background border border-border px-4 py-3 rounded-2xl outline-none" />
                 </div>
                 <input placeholder="Telefone" value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})}  className="w-full bg-background border border-border px-4 py-3 rounded-2xl outline-none" />
                 <button type="submit" className="btn-primary w-full py-4 rounded-2xl mt-4 font-bold uppercase tracking-widest">Registrar na Base</button>
               </form>
               <button onClick={() => setShowModal(false)} className="btn-secondary mt-6 w-full">Cancelar</button>
            </motion.div>
          </div>
        )}

        {/* Produce Modal */}
        {showProduceModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-surface border border-border p-10 rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-y-auto">
               <div className="mb-8">
                 <h3 className="text-xl font-bold italic mb-2 tracking-tight">Finalizar Produção <span className="text-primary italic">#OS</span></h3>
                 <p className="text-muted text-[10px] uppercase tracking-widest font-bold">Cliente: <span className="text-white">{activeLead?.nome_cliente}</span></p>
               </div>
               <div className="space-y-6">
                 <div className="p-6 bg-background border border-border rounded-[24px]">
                    <p className="text-[10px] text-dim uppercase font-black tracking-widest mb-4 flex items-center gap-2">
                       <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                       Dados Brutos do Lead (JSON)
                    </p>
                    <div className="bg-black/40 p-4 rounded-xl border border-white/5 max-h-60 overflow-y-auto custom-scrollbar">
                       <pre className="text-[11px] font-mono text-primary/80 whitespace-pre-wrap leading-relaxed">
                          {activeLead?.dados_json ? JSON.stringify(JSON.parse(activeLead.dados_json), null, 2) : "Nenhum dado disponível."}
                       </pre>
                    </div>
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] uppercase tracking-widest font-black text-dim ml-1">Link da Landing Page Finalizada</label>
                    <input 
                      type="url" 
                      placeholder="https://lp.dscompany.com/cliente-x" 
                      value={lpLink}
                      onChange={e => setLpLink(e.target.value)}
                      className="w-full bg-background border border-border px-6 py-4 rounded-2xl outline-none focus:border-primary shadow-[0_10px_30px_rgba(0,0,0,0.3)] transition-all font-bold text-sm"
                    />
                 </div>
                 {user?.external_lp_endpoint && (
                   <button 
                     onClick={() => activeLead && handleAutomateLP(activeLead)}
                     disabled={automating}
                     className="w-full bg-white/10 text-primary border border-primary/30 font-black uppercase text-[10px] tracking-[0.2em] py-3 rounded-2xl hover:bg-primary/20 transition-all flex items-center justify-center gap-2"
                   >
                     {automating ? "Processando..." : "Gerar via Endpoint Externo"}
                   </button>
                 )}
                 <div className="grid grid-cols-2 gap-4 pt-6">
                   <button onClick={() => setShowProduceModal(false)} className="btn-secondary">Cancelar</button>
                   <button onClick={handleProduce} className="bg-primary text-black font-black uppercase text-[10px] tracking-[0.2em] py-4 rounded-2xl shadow-[0_10px_20px_-5px_rgba(0,255,136,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all">Concluir Entrega</button>
                 </div>
               </div>
            </motion.div>
          </div>
        )}

        {/* Data Details Modal */}
        {showDataModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-surface border border-border p-10 rounded-[40px] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.8)]">
               <div className="flex items-center justify-between mb-8">
                 <div>
                   <h3 className="text-2xl font-bold italic tracking-tighter uppercase underline decoration-primary decoration-2 underline-offset-4">DADOS DO <span className="text-primary italic">STAKEHOLDER</span></h3>
                   <p className="text-muted text-[10px] font-bold uppercase tracking-[0.2em] mt-3">Identificação: <span className="text-white">{activeLead?.nome_cliente}</span></p>
                 </div>
                 <button onClick={() => setShowDataModal(false)} className="p-2 hover:bg-white/5 rounded-full text-dim">
                   <X size={24} />
                 </button>
               </div>
               
               <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/40 rounded-3xl border border-white/5 p-6 mb-8">
                 <pre className="text-xs font-mono text-primary/90 leading-relaxed whitespace-pre-wrap">
                   {activeLead?.dados_json ? JSON.stringify(JSON.parse(activeLead.dados_json), null, 2) : "// Nenhum metadado encontrado."}
                 </pre>
               </div>

               <div className="flex items-center gap-4">
                 <button 
                   onClick={() => downloadJSON(activeLead?.dados_json, activeLead?.nome_cliente || "lead")}
                   className="btn-secondary flex-1 flex items-center justify-center gap-2"
                 >
                   <Download size={14} />
                   Baixar JSON
                 </button>
                 {user?.external_lp_endpoint && (
                   <button 
                     onClick={() => activeLead && handleAutomateLP(activeLead)}
                     disabled={automating}
                     className="flex-1 bg-primary text-black font-black uppercase text-[10px] tracking-[0.2em] py-4 rounded-2xl shadow-[0_10px_20px_-5px_rgba(0,255,136,0.2)] hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                   >
                     {automating ? "Automatizando..." : "Criar LP via Endpoint"}
                   </button>
                 )}
                 <button 
                   onClick={() => setShowDataModal(false)}
                   className="btn-secondary px-8"
                 >
                   Fechar
                 </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const TemplatesPage = () => (
  <div className="flex flex-col items-center justify-center p-20 text-center">
    <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
      <Zap className="text-primary w-10 h-10" />
    </div>
    <h2 className="text-2xl font-bold uppercase italic tracking-tighter">Central de <span className="text-primary italic">Templates</span></h2>
    <p className="text-dim text-sm max-w-md mt-4 font-medium uppercase tracking-widest leading-relaxed">Área reservada para o setor de produção gerenciar e criar modelos de Landing Pages.</p>
  </div>
);

const SettingsPage = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "gerente" });
  const [editForm, setEditForm] = useState({ id: 0, name: "", email: "", role: "gerente" });

  const fetchUsers = () => api.get("/users", user?.token).then(setUsers).catch(console.error);

  useEffect(() => {
    if (user?.role === 'superadmin') fetchUsers();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/auth/register", form, user?.token);
      setForm({ name: "", email: "", password: "", role: "gerente" });
      setShowModal(false);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.patch(`/users/${editForm.id}`, editForm, user?.token);
      setShowEditModal(false);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja remover este usuário?")) return;
    try {
      await api.delete(`/users/${id}`, user?.token);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const openEdit = (u: any) => {
    setEditForm({ id: u.id, name: u.name, email: u.email, role: u.role });
    setShowEditModal(true);
  };

  if (user?.role !== 'superadmin') return <div className="p-10 font-bold text-red-500">Acesso Restrito ao Superadmin.</div>;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight italic uppercase">Painel de <span className="text-primary italic">Controles</span></h1>
          <p className="text-muted text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Gerenciamento de Time e Segurança</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary rounded-full px-8">Adicionar Usuário</button>
      </div>

      <div className="bg-surface border border-border rounded-[40px] overflow-hidden">
        <div className="p-8 border-b border-border flex items-center justify-between bg-white/[0.01]">
          <h3 className="text-xs font-black uppercase tracking-widest text-dim italic">Membros da Operação</h3>
          <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-[9px] font-bold text-primary uppercase">Time Ativo: {users.length}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-border bg-white/[0.03]">
                <th className="px-8 py-5 text-[10px] font-bold text-dim uppercase tracking-widest">Identificação</th>
                <th className="px-8 py-5 text-[10px] font-bold text-dim uppercase tracking-widest">Nível de Acesso</th>
                <th className="px-8 py-5 text-[10px] font-bold text-dim uppercase tracking-widest text-center">Lojas</th>
                <th className="px-8 py-5 text-[10px] font-bold text-dim uppercase tracking-widest">Cadastro</th>
                <th className="px-8 py-5 text-[10px] font-bold text-dim uppercase tracking-widest text-right">Controle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-white/5 border border-border flex items-center justify-center font-black text-xs text-primary group-hover:bg-primary/20 transition-colors">
                        {u.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{u.name}</p>
                        <p className="text-[10px] text-muted tracking-widest font-medium uppercase">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      u.role === 'superadmin' ? "text-primary border-primary/20 bg-primary/5" : 
                      u.role === 'gerente' ? "text-purple-400 border-purple-400/20 bg-purple-400/5" :
                      "text-blue-400 border-blue-400/20 bg-blue-400/5"
                    )}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className="flex flex-col items-center">
                      <p className="text-sm font-black text-primary italic">{u.lead_count || 0}</p>
                      <p className="text-[8px] text-muted uppercase font-bold tracking-tighter">Ativas</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-[10px] font-bold text-dim uppercase tracking-tighter">{new Date(u.created_at).toLocaleDateString('pt-BR')}</p>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.id !== user?.id && (
                        <>
                          <button 
                            onClick={() => openEdit(u)}
                            className="p-2.5 text-dim hover:text-primary hover:bg-primary/10 rounded-xl transition-all"
                            title="Editar Usuário"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleDelete(u.id)}
                            className="p-2.5 text-dim hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                            title="Remover Acesso"
                          >
                            <LogOut size={16} className="rotate-180" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register User Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card w-full max-w-sm p-10">
              <h3 className="text-2xl font-bold mb-8 italic uppercase">Novo <span className="text-primary">Operador</span></h3>
              <form onSubmit={handleCreate} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Nome de Exibição</label>
                  <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field w-full" placeholder="Ex: Felipe Gerente" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Usuário / E-mail</label>
                  <input required value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field w-full" placeholder="Acesso corporativo" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Nível de Permissão</label>
                  <select value={form.role} onChange={e => setForm({...form, role: e.target.value as any})} className="input-field w-full appearance-none">
                    <option value="vendas">Vendedor (Closing)</option>
                    <option value="gerente">Gerente (Gestor)</option>
                    <option value="superadmin">Superadmin (Diretor)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Chave Temporária</label>
                  <input type="password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="input-field w-full" placeholder="••••••••" />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Voltar</button>
                  <button type="submit" className="btn-primary">Criar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card w-full max-w-sm p-10">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-primary/10 rounded-xl text-primary">
                  <UserCog size={24} />
                </div>
                <h3 className="text-2xl font-bold italic uppercase">Editar <span className="text-primary italic">Operador</span></h3>
              </div>
              <form onSubmit={handleUpdate} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Nome</label>
                  <input required value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} className="input-field w-full" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Usuário / E-mail</label>
                  <input required value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="input-field w-full" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">Mudar Setor / Nível</label>
                  <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value as any})} className="input-field w-full appearance-none">
                    <option value="vendas">Setor de Vendas</option>
                    <option value="gerente">Setor de Produção</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <button type="button" onClick={() => setShowEditModal(false)} className="btn-secondary">Cancelar</button>
                  <button type="submit" className="btn-primary">Atualizar</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ds_company_user");
    if (saved) {
      const userData = JSON.parse(saved);
      setUser(userData);
      // Verify token immediately
      api.get("/auth/verify", userData.token).catch(() => {
        // Error is handled in api.get (clears storage and redirects if 401)
      });
    }
    setIsReady(true);
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem("ds_company_user", JSON.stringify(userData));
  };

  const updateUserSettings = (settings: { gemini_api_key?: string, external_lp_endpoint?: string }) => {
    if (user) {
      const updated = { ...user, ...settings };
      setUser(updated);
      localStorage.setItem("ds_company_user", JSON.stringify(updated));
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("ds_company_user");
  };

  if (!isReady) return null;

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUserSettings }}>
      <BrowserRouter>
        <Routes>
          {!user ? (
            <Route path="*" element={<AuthPage />} />
          ) : (
            <Route path="/" element={<Layout><Dashboard /></Layout>} />
          )}
          {user && (
            <>
              <Route path="/leads" element={<Layout><LeadsPage /></Layout>} />
              <Route path="/templates" element={<Layout><TemplatesPage /></Layout>} />
              <Route path="/analytics" element={<Layout><div className="text-3xl font-bold">Analytics Module Coming Soon...</div></Layout>} />
              <Route path="/billing" element={<Layout><SettingsPage /></Layout>} />
            </>
          )}
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
