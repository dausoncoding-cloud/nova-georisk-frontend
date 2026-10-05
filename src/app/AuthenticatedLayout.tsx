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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const displayName = session.data?.user?.displayName ?? session.data?.user?.email ?? "NOVA user";
  const tasks = useQuery({ queryKey: queryKeys.tasks.list({ status: "running", limit: 20 }), queryFn: () => fetchTasks({ status: "running", limit: 20 }), refetchInterval: 10_000 });
  const crumbs = useMemo(() => location.pathname.split("/").filter(Boolean).map((segment, index, all) => ({ label: index === 1 && all[0] === "projects" && /^[0-9a-f-]{36}$/i.test(segment) ? "Project" : titleize(segment), href: `/${all.slice(0, index + 1).join("/")}` })), [location.pathname]);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); } };
    window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener);
  }, []);

  function toggleSidebar() { setCollapsed((current) => { localStorage.setItem("nova.sidebar", current ? "expanded" : "collapsed"); return !current; }); }

  return (
    <div className={`app-shell${collapsed ? " sidebar-is-collapsed" : ""}${mobileOpen ? " mobile-nav-open" : ""}`}>
      <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />
      <aside className="sidebar">
        <div className="sidebar-brand"><div className="brand-mark brand-mark--small" aria-hidden="true">N</div><div className="brand-copy"><strong>NOVA</strong><span>GeoRisk intelligence</span></div><button className="sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}><Icon name="chevron" /></button></div>
        <nav aria-label="Primary navigation">{nav.map(([to, icon, label]) => <NavLink end={to === "/"} to={to} key={to} className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`} title={collapsed ? label : undefined}><Icon name={icon} /><span>{label}</span>{label === "Tasks" && (tasks.data?.total ?? 0) > 0 ? <em>{tasks.data?.total}</em> : null}</NavLink>)}</nav>
        <div className="sidebar-help"><span>Reference engine</span><strong>FIRRIS</strong><small>Flood Risk & Resilience Intelligence System</small></div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-start"><button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button><OrganizationMenu /><div className="breadcrumbs" aria-label="Breadcrumb">{crumbs.length === 0 ? <span>Overview</span> : crumbs.map((crumb, index) => <span key={crumb.href}>{index ? <i>/</i> : null}{index === crumbs.length - 1 ? crumb.label : <Link to={crumb.href}>{crumb.label}</Link>}</span>)}</div></div>
          <div className="topbar-actions"><button className="search-trigger" onClick={() => setSearchOpen(true)}><Icon name="search" /><span>Search workspace</span><kbd>⌘ K</kbd></button><button className="icon-button notification-button" aria-label="Notifications"><Icon name="bell" />{(tasks.data?.total ?? 0) > 0 ? <i /> : null}</button><div className="account-menu"><button className="account-trigger" onClick={() => setAccountOpen((value) => !value)} aria-expanded={accountOpen}><span className="avatar">{displayName.slice(0, 2).toUpperCase()}</span><span><strong>{displayName}</strong><small>{session.data?.user?.email ?? "Authenticated"}</small></span><span>⌄</span></button>{accountOpen ? <div className="account-popover"><Link to="/settings">Account & workspace</Link><LogoutButton /></div> : null}</div></div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
      {searchOpen ? <div className="modal-backdrop command-backdrop" onClick={() => setSearchOpen(false)}><form className="command-palette" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); const target = new FormData(event.currentTarget).get("target")?.toString(); if (target) navigate(target); setSearchOpen(false); }}><div><Icon name="search" /><input autoFocus name="query" aria-label="Search workspace" placeholder="Search projects, tasks and results…" /></div><p>Quick navigation</p>{nav.slice(0, 5).map(([to, icon, label]) => <button name="target" value={to} key={to}><Icon name={icon} />{label}<span>↵</span></button>)}</form></div> : null}
    </div>
  );
}
