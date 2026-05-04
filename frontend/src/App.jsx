import { useState, useEffect, useMemo, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "/api";

// ===== API HELPERS =====
const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
};

// ===== STATIC CONFIG (mirrors DB) =====
const SERVICES = {
  snow_removal:  { name: "Snow Removal",  icon: "❄️",  unit: "per visit" },
  ice_removal:   { name: "Ice Removal",   icon: "🧊",  unit: "per visit" },
  painting:      { name: "Painting",      icon: "🎨",  unit: "per hour"  },
  fencing:       { name: "Fencing",       icon: "🏗️", unit: "per linear ft" },
  landscaping:   { name: "Landscaping",   icon: "🌿",  unit: "per hour"  },
  roofing:       { name: "Roofing",       icon: "🏠",  unit: "per hour"  },
  gutters:       { name: "Gutters",       icon: "🔧",  unit: "per linear ft" },
  lawn_care:     { name: "Lawn Care",     icon: "🌱",  unit: "per visit" },
};

const STATUSES = {
  pending:     { label: "Pending",     color: "#f59e0b", bg: "#fef3c7" },
  assigned:    { label: "Assigned",    color: "#3b82f6", bg: "#dbeafe" },
  accepted:    { label: "Accepted",    color: "#8b5cf6", bg: "#ede9fe" },
  in_progress: { label: "In Progress", color: "#f97316", bg: "#ffedd5" },
  completed:   { label: "Completed",   color: "#10b981", bg: "#d1fae5" },
  cancelled:   { label: "Cancelled",   color: "#ef4444", bg: "#fee2e2" },
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "";
const fmtMoney = (n) => `$${Number(n || 0).toFixed(2)}`;
const genId = () => Date.now() + Math.random();

// ===== UI COMPONENTS =====
const Badge = ({ children, color, bg }) => (
  <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, color, background: bg }}>{children}</span>
);

const Input = ({ label, ...props }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4, textTransform: "uppercase" }}>{label}</label>}
    <input {...props} style={{ width: "100%", padding: "10px 12px", border: "2px solid #e2e8f0", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box", ...(props.style || {}) }}
      onFocus={e => e.target.style.borderColor = "#2563eb"}
      onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
  </div>
);

const Button = ({ children, variant = "primary", size = "md", ...props }) => {
  const styles = {
    primary:   { background: "linear-gradient(135deg,#1e40af,#2563eb)", color: "#fff", border: "none" },
    secondary: { background: "#f1f5f9", color: "#334155", border: "2px solid #e2e8f0" },
    danger:    { background: "#fef2f2", color: "#dc2626", border: "2px solid #fecaca" },
    success:   { background: "linear-gradient(135deg,#047857,#10b981)", color: "#fff", border: "none" },
    ghost:     { background: "transparent", color: "#2563eb", border: "none" },
  };
  const sizes = { sm: { padding: "6px 14px", fontSize: 12 }, md: { padding: "10px 20px", fontSize: 14 }, lg: { padding: "14px 28px", fontSize: 16 } };
  return <button {...props} style={{ ...styles[variant], ...sizes[size], borderRadius: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", ...(props.style || {}) }}>{children}</button>;
};

const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", cursor: onClick ? "pointer" : "default", ...style }}>
    {children}
  </div>
);

const Modal = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: wide ? 700 : 500, width: "100%", maxHeight: "90vh", overflow: "auto", position: "relative", zIndex: 1, boxShadow: "0 25px 50px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
};

const Spinner = () => (
  <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
    <div style={{ width: 32, height: 32, border: "3px solid #e2e8f0", borderTop: "3px solid #2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
);

// ===== INVOICE =====
const InvoiceView = ({ job, client }) => {
  const svc = SERVICES[job.service_key || job.service_type_key] || {};
  const dueDate = new Date(job.scheduled_date || job.created_at);
  dueDate.setDate(dueDate.getDate() + 15);
  return (
    <div style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)", color: "#fff", padding: 24, borderRadius: 14, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>SPOKO SERVICE CARIBOO</div>
            <div style={{ opacity: 0.8, fontSize: 13 }}>Hixon, BC · cariboo.services</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 800 }}>INVOICE</div>
            <div style={{ opacity: 0.8 }}>#{String(job.id).padStart(4, "0")}</div>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>Bill To</div>
          <div style={{ fontWeight: 600 }}>{client?.name}</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>{client?.address}</div>
          <div style={{ color: "#64748b", fontSize: 13 }}>{client?.phone}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 13 }}>Date: <strong>{fmtDate(job.scheduled_date)}</strong></div>
          <div style={{ fontSize: 13 }}>Due: <strong>{fmtDate(dueDate)}</strong></div>
          <div style={{ fontSize: 13 }}>Worker: <strong>{job.worker_name || "TBA"}</strong></div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 20 }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12, color: "#64748b", borderBottom: "2px solid #e2e8f0" }}>Service</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 12, color: "#64748b", borderBottom: "2px solid #e2e8f0" }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: 12, borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 18, marginRight: 8 }}>{svc.icon}</span>
              <strong>{job.service_name}</strong>
              {job.notes && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{job.notes}</div>}
            </td>
            <td style={{ padding: 12, textAlign: "right", fontWeight: 700, fontSize: 16 }}>{fmtMoney(job.price)}</td>
          </tr>
        </tbody>
      </table>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 24 }}>
        <div style={{ width: 220 }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}><span>Subtotal</span><span>{fmtMoney(job.price)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#64748b" }}><span>GST (5%)</span><span>{fmtMoney(job.price * 0.05)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontSize: 18, fontWeight: 800, borderTop: "2px solid #1e3a5f", marginTop: 6 }}><span>Total</span><span style={{ color: "#1e3a5f" }}>{fmtMoney(job.price * 1.05)}</span></div>
        </div>
      </div>
      <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16, fontSize: 13 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Payment Methods</div>
        <div style={{ color: "#64748b" }}>
          <div>• E-Transfer: payment@cariboo.services</div>
          <div style={{ marginTop: 8, fontStyle: "italic" }}>Payment due within 15 days.</div>
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <Button onClick={() => window.print()}>🖨️ Print Invoice</Button>
      </div>
    </div>
  );
};

// ===== NOTIFICATION PANEL =====
const NotificationPanel = ({ notifications, onRead, onClose }) => (
  <div style={{ position: "absolute", top: 54, right: 0, width: 360, background: "#fff", borderRadius: 16, boxShadow: "0 20px 40px rgba(0,0,0,0.15)", border: "1px solid #e2e8f0", zIndex: 100 }}>
    <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between" }}>
      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Notifications</h3>
      <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>✕</button>
    </div>
    <div style={{ maxHeight: 400, overflow: "auto" }}>
      {notifications.length === 0 && <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}>No notifications</div>}
      {notifications.map(n => (
        <div key={n.id} onClick={() => onRead(n.id)} style={{ padding: "14px 20px", borderBottom: "1px solid #f8fafc", background: n.read ? "#fff" : "#eff6ff", cursor: "pointer" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <span style={{ fontSize: 18 }}>{n.type === "lead" ? "📩" : "📋"}</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>{n.body}</div>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{fmtDate(n.created_at)}</div>
            </div>
            {!n.read && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2563eb", flexShrink: 0, marginTop: 5 }} />}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ===== MAIN APP =====
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [clients, setClients] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [dashboard, setDashboard] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedClient, setSelectedClient] = useState(null);
  const [showNewClient, setShowNewClient] = useState(false);
  const [showNewJob, setShowNewJob] = useState(false);
  const [showInvoice, setShowInvoice] = useState(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState("");

  const [newClient, setNewClient] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const [newJob, setNewJob] = useState({ client_id: "", service_key: "snow_removal", factors: {}, scheduled_date: "", notes: "" });
  const [priceCalc, setPriceCalc] = useState(null);

  // ── Load all data ──
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [c, j, w, l, d] = await Promise.all([
        apiFetch("/clients"),
        apiFetch("/jobs"),
        apiFetch("/workers"),
        apiFetch("/leads"),
        apiFetch("/dashboard"),
      ]);
      setClients(c.clients || []);
      setJobs(j.jobs || []);
      setWorkers(w.workers || []);
      setLeads(l.leads || []);
      setDashboard(d);
      // Load notifications for admin (user 1 = Crazy Memos)
      const n = await apiFetch("/notifications/1");
      setNotifications(n.notifications || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const t = setInterval(loadAll, 30000);
    return () => clearInterval(t);
  }, [loadAll]);

  // ── Actions ──
  const saveClient = async () => {
    if (!newClient.name) return;
    try {
      await apiFetch("/clients", { method: "POST", body: JSON.stringify(newClient) });
      setNewClient({ name: "", phone: "", email: "", address: "", notes: "" });
      setShowNewClient(false);
      loadAll();
    } catch (e) { alert("Error: " + e.message); }
  };

  const saveJob = async () => {
    if (!newJob.client_id || !newJob.service_key) return;
    try {
      // Get service_type_id from workers data
      const svcMap = { snow_removal:1, ice_removal:2, painting:3, fencing:4, landscaping:5, roofing:6, gutters:7, lawn_care:8 };
      const payload = {
        client_id: parseInt(newJob.client_id),
        service_type_id: svcMap[newJob.service_key],
        factors: newJob.factors,
        notes: newJob.notes,
        scheduled_date: newJob.scheduled_date || null,
      };
      await apiFetch("/jobs", { method: "POST", body: JSON.stringify(payload) });
      setNewJob({ client_id: "", service_key: "snow_removal", factors: {}, scheduled_date: "", notes: "" });
      setPriceCalc(null);
      setShowNewJob(false);
      loadAll();
    } catch (e) { alert("Error: " + e.message); }
  };

  const updateJobStatus = async (jobId, status) => {
    try {
      await apiFetch(`/jobs/${jobId}/status`, { method: "PUT", body: JSON.stringify({ status }) });
      loadAll();
    } catch (e) { alert("Error: " + e.message); }
  };

  const markRead = async (id) => {
    try {
      await apiFetch(`/notifications/${id}/read`, { method: "PUT" });
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) {}
  };

  const calcPrice = async (serviceKey, factors) => {
    const svcMap = { snow_removal:1, ice_removal:2, painting:3, fencing:4, landscaping:5, roofing:6, gutters:7, lawn_care:8 };
    try {
      const r = await apiFetch("/calculate-price", {
        method: "POST",
        body: JSON.stringify({ service_type_id: svcMap[serviceKey], factors }),
      });
      setPriceCalc(r);
    } catch (e) { setPriceCalc(null); }
  };

  // ── Computed ──
  const unreadCount = notifications.filter(n => !n.read).length;
  const filteredClients = useMemo(() => {
    if (!search) return clients;
    const s = search.toLowerCase();
    return clients.filter(c =>
      c.name?.toLowerCase().includes(s) ||
      c.address?.toLowerCase().includes(s) ||
      c.phone?.includes(s)
    );
  }, [clients, search]);

  const clientJobs = (clientId) => jobs.filter(j => j.client_id == clientId).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

  const nav = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "clients",   icon: "👥", label: "Clients" },
    { id: "jobs",      icon: "📋", label: "Jobs" },
    { id: "schedule",  icon: "📅", label: "Schedule" },
    { id: "workers",   icon: "👷", label: "Workers" },
    { id: "leads",     icon: "📩", label: "Leads" },
  ];

  if (loading && !clients.length) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 48 }}>🏔️</div>
      <div style={{ fontWeight: 700, fontSize: 18 }}>Spoko Service Cariboo</div>
      <Spinner />
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 48 }}>⚠️</div>
      <div style={{ fontWeight: 700 }}>Cannot connect to API</div>
      <div style={{ color: "#64748b", fontSize: 13 }}>{error}</div>
      <Button onClick={loadAll}>Retry</Button>
    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "'Segoe UI', system-ui, sans-serif", background: "#f8fafc", color: "#0f172a" }}>

      {/* Sidebar */}
      <div style={{ width: sidebarOpen ? 240 : 64, background: "linear-gradient(180deg,#0f172a 0%,#1e293b 100%)", transition: "width 0.3s", overflow: "hidden", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: sidebarOpen ? "20px 18px" : "20px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }} onClick={() => setSidebarOpen(!sidebarOpen)}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#2563eb,#1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🏔️</div>
            {sidebarOpen && <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>SPOKO SERVICE</div>
              <div style={{ color: "#64748b", fontSize: 11 }}>CARIBOO</div>
            </div>}
          </div>
        </div>
        <div style={{ padding: "12px 8px", flex: 1 }}>
          {nav.map(n => (
            <div key={n.id} onClick={() => setPage(n.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: sidebarOpen ? "11px 14px" : "11px 16px", borderRadius: 10, cursor: "pointer", background: page === n.id ? "rgba(37,99,235,0.15)" : "transparent", color: page === n.id ? "#60a5fa" : "#94a3b8", marginBottom: 2, justifyContent: sidebarOpen ? "flex-start" : "center" }}>
              <span style={{ fontSize: 18 }}>{n.icon}</span>
              {sidebarOpen && <span style={{ fontSize: 13, fontWeight: 600 }}>{n.label}</span>}
            </div>
          ))}
        </div>
        {sidebarOpen && (
          <div style={{ padding: "16px 18px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <Button size="sm" onClick={() => setShowNewJob(true)} style={{ flex: 1, fontSize: 11 }}>+ Job</Button>
              <Button size="sm" variant="secondary" onClick={() => setShowNewClient(true)} style={{ flex: 1, fontSize: 11 }}>+ Client</Button>
            </div>
          </div>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Topbar */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
          <input placeholder="Search clients..." value={search} onChange={e => { setSearch(e.target.value); if (e.target.value) setPage("clients"); }}
            style={{ padding: "9px 14px", border: "2px solid #e2e8f0", borderRadius: 10, fontSize: 13, width: 260, outline: "none", fontFamily: "inherit" }}
            onFocus={e => e.target.style.borderColor="#2563eb"} onBlur={e => e.target.style.borderColor="#e2e8f0"} />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowNotifs(!showNotifs)} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, width: 40, height: 40, cursor: "pointer", fontSize: 18, position: "relative" }}>
                🔔
                {unreadCount > 0 && <span style={{ position: "absolute", top: -2, right: -2, background: "#ef4444", color: "#fff", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{unreadCount}</span>}
              </button>
              {showNotifs && <NotificationPanel notifications={notifications} onRead={markRead} onClose={() => setShowNotifs(false)} />}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", background: "#f1f5f9", borderRadius: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#2563eb,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 700 }}>CM</div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Crazy Memos</span>
            </div>
            <button onClick={loadAll} style={{ background: "#f1f5f9", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 16 }} title="Refresh">🔄</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 24 }}>

          {/* DASHBOARD */}
          {page === "dashboard" && (
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Dashboard</h1>
              <p style={{ color: "#64748b", margin: "0 0 24px" }}>Welcome back! Here's your overview.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 16, marginBottom: 28 }}>
                {[
                  { label: "Clients",      value: dashboard.total_clients || 0,   icon: "👥", color: "#2563eb" },
                  { label: "Active Jobs",  value: dashboard.active_jobs || 0,     icon: "⚡", color: "#f59e0b" },
                  { label: "Completed",    value: dashboard.completed_jobs || 0,  icon: "✅", color: "#10b981" },
                  { label: "Revenue",      value: fmtMoney(dashboard.revenue),    icon: "💰", color: "#059669" },
                  { label: "Pending Rev.", value: fmtMoney(dashboard.pending_revenue), icon: "⏳", color: "#8b5cf6" },
                ].map((s,i) => (
                  <Card key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>{s.label}</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
                      </div>
                      <span style={{ fontSize: 28 }}>{s.icon}</span>
                    </div>
                  </Card>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <Card>
                  <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>Recent Jobs</h3>
                  {jobs.slice(0,6).map(j => {
                    const st = STATUSES[j.status] || STATUSES.pending;
                    const svc = SERVICES[j.service_key] || {};
                    return (
                      <div key={j.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 20 }}>{svc.icon || "🔧"}</span>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{j.service_name}</div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>{j.client_name} · {fmtDate(j.scheduled_date)}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <Badge color={st.color} bg={st.bg}>{st.label}</Badge>
                          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 3 }}>{fmtMoney(j.price)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {jobs.length === 0 && <div style={{ color: "#94a3b8", textAlign: "center", padding: 20 }}>No jobs yet</div>}
                </Card>
                <Card>
                  <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>Worker Load</h3>
                  {workers.map(w => (
                    <div key={w.id} style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{w.name}</span>
                        <span style={{ fontSize: 12, color: "#64748b" }}>{w.weekly_load} jobs this week</span>
                      </div>
                      <div style={{ height: 8, background: "#f1f5f9", borderRadius: 10, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, (w.weekly_load/8)*100)}%`, background: "#2563eb", borderRadius: 10 }} />
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          )}

          {/* CLIENTS LIST */}
          {page === "clients" && !selectedClient && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Clients ({filteredClients.length})</h1>
                <Button onClick={() => setShowNewClient(true)}>+ New Client</Button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
                {filteredClients.map(c => {
                  const cj = clientJobs(c.id);
                  return (
                    <Card key={c.id} onClick={() => setSelectedClient(c.id)}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 16 }}>{c.name}</div>
                          <div style={{ fontSize: 13, color: "#64748b" }}>{c.address}</div>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>{c.phone}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 12, color: "#94a3b8" }}>{cj.length} jobs</div>
                        </div>
                      </div>
                      {c.notes && <div style={{ fontSize: 12, color: "#64748b", marginTop: 8, fontStyle: "italic" }}>{c.notes}</div>}
                    </Card>
                  );
                })}
              </div>
              {filteredClients.length === 0 && <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}><div style={{ fontSize: 48 }}>🔍</div><div style={{ fontWeight: 600 }}>No clients found</div></div>}
            </div>
          )}

          {/* CLIENT PROFILE */}
          {page === "clients" && selectedClient && (() => {
            const client = clients.find(c => c.id == selectedClient);
            if (!client) return null;
            const cj = clientJobs(client.id);
            const totalSpent = cj.filter(j => j.status === "completed").reduce((s,j) => s + parseFloat(j.price||0), 0);
            return (
              <div>
                <button onClick={() => setSelectedClient(null)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "#2563eb", fontWeight: 600, padding: 0, marginBottom: 16 }}>← Back to Clients</button>
                <Card style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div>
                      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{client.name}</h1>
                      <div style={{ color: "#64748b", marginTop: 4 }}>{client.address}</div>
                      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 13 }}>
                        <span>📞 {client.phone}</span>
                        <span>✉️ {client.email}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>Total Spent</div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: "#059669" }}>{fmtMoney(totalSpent)}</div>
                      <Button size="sm" style={{ marginTop: 10 }} onClick={() => { setNewJob({...newJob, client_id: client.id}); setShowNewJob(true); }}>+ Add Job</Button>
                    </div>
                  </div>
                </Card>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Jobs ({cj.length})</h3>
                {cj.map(j => {
                  const st = STATUSES[j.status] || STATUSES.pending;
                  return (
                    <Card key={j.id} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{j.service_name}</div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>📅 {fmtDate(j.scheduled_date)} · 👷 {j.worker_name || "Unassigned"}</div>
                          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                            {j.status === "assigned" && <Button size="sm" variant="ghost" onClick={() => updateJobStatus(j.id, "in_progress")}>▶ Start</Button>}
                            {j.status === "in_progress" && <Button size="sm" variant="success" onClick={() => updateJobStatus(j.id, "completed")}>✓ Complete</Button>}
                            {!["completed","cancelled"].includes(j.status) && <Button size="sm" variant="danger" onClick={() => updateJobStatus(j.id, "cancelled")}>✕ Cancel</Button>}
                            <Button size="sm" variant="ghost" onClick={() => setShowInvoice({job: j, client})}>📄 Invoice</Button>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <Badge color={st.color} bg={st.bg}>{st.label}</Badge>
                          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{fmtMoney(j.price)}</div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            );
          })()}

          {/* JOBS */}
          {page === "jobs" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>All Jobs</h1>
                <Button onClick={() => setShowNewJob(true)}>+ New Job</Button>
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {Object.entries(STATUSES).map(([k,v]) => {
                  const count = jobs.filter(j => j.status === k).length;
                  return count > 0 ? <span key={k} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: v.bg, color: v.color }}>{v.label} ({count})</span> : null;
                })}
              </div>
              {[...jobs].sort((a,b) => new Date(b.created_at)-new Date(a.created_at)).map(j => {
                const st = STATUSES[j.status] || STATUSES.pending;
                const svc = SERVICES[j.service_key] || {};
                return (
                  <Card key={j.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 24 }}>{svc.icon || "🔧"}</span>
                        <div>
                          <div style={{ fontWeight: 700 }}>{j.service_name} — <span style={{ color: "#2563eb", cursor: "pointer" }} onClick={() => { setSelectedClient(j.client_id); setPage("clients"); }}>{j.client_name}</span></div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{fmtDate(j.scheduled_date)} · {j.worker_name || "Unassigned"}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Badge color={st.color} bg={st.bg}>{st.label}</Badge>
                        <span style={{ fontWeight: 700 }}>{fmtMoney(j.price)}</span>
                        <Button size="sm" variant="ghost" onClick={() => setShowInvoice({job:j, client: clients.find(c=>c.id==j.client_id)})}>📄</Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* SCHEDULE */}
          {page === "schedule" && (
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 20 }}>Schedule</h1>
              {workers.map(w => {
                const wJobs = jobs.filter(j => j.assigned_worker_id == w.id && ["assigned","accepted","in_progress"].includes(j.status));
                return (
                  <Card key={w.id} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>{w.name.charAt(0)}</div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{w.name}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{(w.skills||[]).join(", ")}</div>
                      </div>
                      <Badge color="#2563eb" bg="#dbeafe">{wJobs.length} upcoming</Badge>
                    </div>
                    {wJobs.length === 0 && <div style={{ color: "#94a3b8", fontSize: 13 }}>No upcoming jobs</div>}
                    {wJobs.map(j => (
                      <div key={j.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderRadius: 8, marginBottom: 6 }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{j.service_name}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{j.client_name} · {j.client_address}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(j.scheduled_date)}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>{fmtMoney(j.price)}</div>
                        </div>
                      </div>
                    ))}
                  </Card>
                );
              })}
            </div>
          )}

          {/* WORKERS */}
          {page === "workers" && (
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 20 }}>Workers</h1>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 16 }}>
                {workers.map(w => {
                  const wJobs = jobs.filter(j => j.assigned_worker_id == w.id);
                  const earned = wJobs.filter(j => j.status==="completed").reduce((s,j) => s+parseFloat(j.price||0), 0);
                  return (
                    <Card key={w.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#2563eb,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 800 }}>{w.name.charAt(0)}</div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 18 }}>{w.name}</div>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{w.role} · {wJobs.length} total jobs</div>
                        </div>
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>Skills</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {(w.skills||[]).map(s => (
                            <span key={s} style={{ padding: "3px 8px", background: "#f1f5f9", borderRadius: 6, fontSize: 11 }}>
                              {SERVICES[s]?.icon} {SERVICES[s]?.name || s}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div style={{ background: "#f8fafc", borderRadius: 10, padding: 12, textAlign: "center" }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "#2563eb" }}>{w.weekly_load}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>This Week</div>
                        </div>
                        <div style={{ background: "#f0fdf4", borderRadius: 10, padding: 12, textAlign: "center" }}>
                          <div style={{ fontSize: 20, fontWeight: 800, color: "#059669" }}>{fmtMoney(earned)}</div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>Earned</div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* LEADS */}
          {page === "leads" && (
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Leads & Funnel</h1>
              <p style={{ color: "#64748b", margin: "0 0 24px" }}>Automated lead capture from all channels</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16, marginBottom: 24 }}>
                {[
                  { ch: "Facebook Messenger", icon: "💬", status: "Bot Active",      color: "#10b981", leads: leads.filter(l=>l.source==="facebook").length },
                  { ch: "Email",              icon: "📧", status: "Bot Active",      color: "#10b981", leads: leads.filter(l=>l.source==="email").length },
                  { ch: "Phone (Twilio)",     icon: "📞", status: "Bot Active",      color: "#10b981", leads: leads.filter(l=>l.source==="phone").length },
                  { ch: "Website",            icon: "🌐", status: "Active",          color: "#10b981", leads: leads.filter(l=>l.source==="website").length },
                ].map((c,i) => (
                  <Card key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 26 }}>{c.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700 }}>{c.ch}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.color }} />
                            <span style={{ fontSize: 11, color: c.color, fontWeight: 600 }}>{c.status}</span>
                          </div>
                        </div>
                      </div>
                      {c.leads > 0 && <Badge color="#2563eb" bg="#dbeafe">{c.leads} leads</Badge>}
                    </div>
                  </Card>
                ))}
              </div>
              <Card>
                <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700 }}>Recent Leads ({leads.length})</h3>
                {leads.slice(0,20).map((l,i) => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: i<leads.length-1 ? "1px solid #f1f5f9" : "none" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
                        {l.source==="facebook"?"💬":l.source==="email"?"📧":l.source==="phone"?"📞":"🌐"}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{l.name || l.phone || l.email || "Unknown"}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{l.service_requested} · via {l.source} · {fmtDate(l.created_at)}</div>
                      </div>
                    </div>
                    <Badge color={l.status==="new"?"#f59e0b":l.status==="converted"?"#10b981":"#3b82f6"} bg={l.status==="new"?"#fef3c7":l.status==="converted"?"#d1fae5":"#dbeafe"}>{l.status}</Badge>
                  </div>
                ))}
                {leads.length === 0 && <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>No leads yet</div>}
              </Card>
            </div>
          )}

        </div>
      </div>

      {/* MODALS */}
      <Modal open={showNewClient} onClose={() => setShowNewClient(false)} title="New Client">
        <Input label="Full Name *" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="John Smith" />
        <Input label="Phone" value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} placeholder="250-555-0000" />
        <Input label="Email" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} placeholder="john@email.com" />
        <Input label="Address" value={newClient.address} onChange={e => setNewClient({...newClient, address: e.target.value})} placeholder="123 Main St, Quesnel" />
        <Input label="Notes" value={newClient.notes} onChange={e => setNewClient({...newClient, notes: e.target.value})} placeholder="How they found us..." />
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <Button onClick={saveClient} style={{ flex: 1 }}>Create Client</Button>
          <Button variant="secondary" onClick={() => setShowNewClient(false)}>Cancel</Button>
        </div>
      </Modal>

      <Modal open={showNewJob} onClose={() => setShowNewJob(false)} title="New Job" wide>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8, textTransform: "uppercase" }}>Client *</label>
          <select value={newJob.client_id} onChange={e => setNewJob({...newJob, client_id: e.target.value})} style={{ width: "100%", padding: "10px 12px", border: "2px solid #e2e8f0", borderRadius: 10, fontSize: 14, fontFamily: "inherit" }}>
            <option value="">Select client...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8, textTransform: "uppercase" }}>Service Type *</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {Object.entries(SERVICES).map(([key,svc]) => (
              <div key={key} onClick={() => { setNewJob({...newJob, service_key: key, factors: {}}); setPriceCalc(null); }}
                style={{ padding: "10px 6px", borderRadius: 10, border: `2px solid ${newJob.service_key===key?"#2563eb":"#e2e8f0"}`, background: newJob.service_key===key?"#eff6ff":"#fff", cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: 22 }}>{svc.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 600, marginTop: 4 }}>{svc.name}</div>
              </div>
            ))}
          </div>
        </div>
        <Input label="Scheduled Date" type="date" value={newJob.scheduled_date} onChange={e => setNewJob({...newJob, scheduled_date: e.target.value})} />
        <Input label="Notes" value={newJob.notes} onChange={e => setNewJob({...newJob, notes: e.target.value})} placeholder="Special instructions..." />
        {priceCalc && (
          <div style={{ background: "linear-gradient(135deg,#f0fdf4,#ecfdf5)", borderRadius: 14, padding: 18, marginBottom: 14, border: "2px solid #bbf7d0" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", textTransform: "uppercase" }}>Estimated Price</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#15803d" }}>{fmtMoney(priceCalc.estimatedPrice || priceCalc.final_price)}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>+ GST: {fmtMoney(priceCalc.gst)} = <strong>{fmtMoney(priceCalc.total)}</strong></div>
          </div>
        )}
        <Button variant="secondary" size="sm" onClick={() => calcPrice(newJob.service_key, newJob.factors)} style={{ marginBottom: 14 }}>🧮 Calculate Price</Button>
        <div style={{ display: "flex", gap: 10 }}>
          <Button onClick={saveJob} style={{ flex: 1 }}>Create Job & Auto-Assign</Button>
          <Button variant="secondary" onClick={() => setShowNewJob(false)}>Cancel</Button>
        </div>
      </Modal>

      <Modal open={!!showInvoice} onClose={() => setShowInvoice(null)} title="Invoice" wide>
        {showInvoice && <InvoiceView job={showInvoice.job} client={showInvoice.client} />}
      </Modal>
    </div>
  );
}
