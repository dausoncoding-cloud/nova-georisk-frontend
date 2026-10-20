import { useDialog } from "../shared/ui/useDialog";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../features/auth/authQueries";
import { LogoutButton } from "../features/auth/LogoutButton";
import { OrganizationMenu } from "../features/organization/OrganizationMenu";
import { fetchTasks } from "../features/tasks/tasksApi";
import { queryKeys } from "../shared/api/queryKeys";
import { Icon } from "../shared/ui/Icon";

const nav = [
  ["/", "overview", "Overview"], ["/projects", "projects", "Projects"], ["/aois", "aoi", "AOIs"],
  ["/analyses", "analysis", "Analyses"], ["/tasks", "tasks", "Tasks"], ["/results", "results", "Results"],
  ["/maps", "map", "Maps"], ["/reports", "reports", "Reports"], ["/exports", "exports", "Exports"],
  ["/data", "data", "Data"], ["/settings", "settings", "Settings"],
] as const;

function titleize(segment: string) { return segment.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase()); }

export function AuthenticatedLayout() {
  const session = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("nova.sidebar") === "collapsed");
  const [mobileViewport, setMobileViewport] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => { const query = window.matchMedia("(max-width: 767px)"); const update = () => { setMobileViewport(query.matches); if (!query.matches) setMobileOpen(false); }; query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => { if (!accountOpen) return; const dismiss = (event: KeyboardEvent) => { if (event.key === "Escape") setAccountOpen(false); }; document.addEventListener("keydown", dismiss); return () => document.removeEventListener("keydown", dismiss); }, [accountOpen]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchDialog = useDialog(searchOpen, () => setSearchOpen(false));
  const navigationDialog = useDialog(mobileOpen, () => setMobileOpen(false));
  const displayName = session.data?.user?.displayName ?? session.data?.user?.email ?? "NOVA user";
  const tasks = useQuery({ queryKey: queryKeys.tasks.list({ status: "running", limit: 20 }), queryFn: () => fetchTasks({ status: "running", limit: 20 }), refetchInterval: 10_000 });
  const crumbs = useMemo(() => location.pathname.split("/").filter(Boolean).map((segment, index, all) => ({ label: index === 1 && all[0] === "projects" && /^[0-9a-f-]{36}$/i.test(segment) ? "Project" : titleize(segment), href: `/${all.slice(0, index + 1).join("/")}` })), [location.pathname]);

  useEffect(() => { setMobileOpen(false); setAccountOpen(false); setSearchOpen(false); }, [location.pathname]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setMobileOpen(false); setSearchOpen(true); } };
    window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener);
  }, []);

  function toggleSidebar() { setCollapsed((current) => { localStorage.setItem("nova.sidebar", current ? "expanded" : "collapsed"); return !current; }); }

  return (
    <div className={`app-shell${collapsed ? " sidebar-is-collapsed" : ""}${mobileOpen ? " mobile-nav-open" : ""}`}>
      <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside ref={navigationDialog} id="primary-sidebar" className="sidebar" role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen || undefined} aria-label={mobileOpen ? "Navigation" : undefined} tabIndex={-1} inert={mobileViewport && !mobileOpen}>
        <button className="mobile-nav-close button button--quiet" onClick={() => setMobileOpen(false)}>Close navigation</button><div className="sidebar-brand"><div className="brand-mark brand-mark--small" aria-hidden="true">N</div><div className="brand-copy"><strong>NOVA</strong><span>GeoRisk intelligence</span></div><button className="sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}><Icon name="chevron" /></button></div>
        <nav aria-label="Primary navigation">{nav.map(([to, icon, label]) => <NavLink end={to === "/"} to={to} key={to} className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`} title={label} aria-label={label}><Icon name={icon} /><span>{label}</span>{label === "Tasks" && (tasks.data?.total ?? 0) > 0 ? <em>{tasks.data?.total}</em> : null}</NavLink>)}</nav>
        <div className="sidebar-help"><span>Reference engine</span><strong>FIRRIS</strong><small>Flood Risk & Resilience Intelligence System</small></div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-start"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="primary-sidebar"><Icon name="menu" /></button><OrganizationMenu /><div className="breadcrumbs" aria-label="Breadcrumb">{crumbs.length === 0 ? <span>Overview</span> : crumbs.map((crumb, index) => <span key={crumb.href}>{index ? <i>/</i> : null}{index === crumbs.length - 1 ? crumb.label : <Link to={crumb.href}>{crumb.label}</Link>}</span>)}</div></div>
          <div className="topbar-actions"><button className="search-trigger" aria-label="Find workspace page" onClick={() => { setMobileOpen(false); setSearchOpen(true); }}><Icon name="search" /><span>Search workspace</span><kbd>⌘ K</kbd></button><Link className="icon-button notification-button" to="/tasks?status=running" aria-label="Running tasks"><Icon name="tasks" /></Link><div className="account-menu"><button className="account-trigger" aria-label="Account menu" onClick={() => setAccountOpen((value) => !value)} aria-expanded={accountOpen}><span className="avatar">{displayName.slice(0, 2).toUpperCase()}</span><span><strong>{displayName}</strong><small>{session.data?.user?.email ?? "Authenticated"}</small></span><span>⌄</span></button>{accountOpen ? <div className="account-popover"><Link to="/settings">Account & workspace</Link><LogoutButton /></div> : null}</div></div>
        </header>
        <main id="main-content" tabIndex={-1} className="content"><Outlet /></main>
      </div>
      {searchOpen ? <div className="modal-backdrop command-backdrop" onClick={() => setSearchOpen(false)}><section ref={searchDialog} role="dialog" aria-modal="true" aria-label="Workspace navigation" tabIndex={-1} className="command-palette" onClick={(event) => event.stopPropagation()}><div><Icon name="search" /><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} aria-label="Find a workspace page" placeholder="Find a page…" /><button type="button" className="icon-button" aria-label="Close workspace navigation" onClick={() => setSearchOpen(false)}><Icon name="close" /></button></div><p>Workspace pages</p>{nav.filter(([, , label]) => label.toLowerCase().includes(searchQuery.trim().toLowerCase())).map(([to, icon, label]) => <button type="button" key={to} onClick={() => { navigate(to); setSearchOpen(false); }}><Icon name={icon} />{label}</button>)}{!nav.some(([, , label]) => label.toLowerCase().includes(searchQuery.trim().toLowerCase())) ? <p role="status">No matching pages.</p> : null}</section></div> : null}
    </div>
  );
}
