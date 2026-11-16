import { useCallback, useEffect, useId, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../features/auth/authQueries";
import { LogoutButton } from "../features/auth/LogoutButton";
import { useOrganizationContext } from "../features/organization/OrganizationContext";
import { OrganizationMenu } from "../features/organization/OrganizationMenu";
import { fetchTasks } from "../features/tasks/tasksApi";
import { queryKeys } from "../shared/api/queryKeys";
import { Icon } from "../shared/ui/Icon";
import { useDialog } from "../shared/ui/useDialog";
import { FRRIS_ROUTES } from "./routes";
import { roleLabel, SuiteBrand } from "./SuiteBrand";
import { FRRIS_SYSTEM, SUITE_SYSTEMS } from "./suiteSystems";

type NavItem = { to: string; icon: Parameters<typeof Icon>[0]["name"]; label: string; end?: boolean; adminOnly?: boolean };

// Primary FRRIS navigation, as in the design.
export const PRIMARY_NAV: readonly NavItem[] = [
  { to: FRRIS_ROUTES.analyses, icon: "overview", label: "Analyses", end: true },
  { to: FRRIS_ROUTES.newAnalysis, icon: "plus", label: "New analysis", end: true },
  { to: FRRIS_ROUTES.playground, icon: "aoi", label: "Area playground" },
  { to: "/data", icon: "data", label: "Data catalog" },
  { to: "/exports", icon: "exports", label: "Exports" },
];

// Every other existing workspace page stays reachable.
export const WORKSPACE_NAV: readonly NavItem[] = [
  { to: FRRIS_ROUTES.overview, icon: "home", label: "Overview" },
  { to: "/projects", icon: "projects", label: "Projects" },
  { to: "/aois", icon: "aoi", label: "AOIs" },
  { to: "/results", icon: "results", label: "Results" },
  { to: "/maps", icon: "map", label: "Maps" },
  { to: "/reports", icon: "reports", label: "Reports" },
  { to: "/external-data", icon: "externalData", label: "External data" },
  { to: "/administration", icon: "shield", label: "Administration", adminOnly: true },
  { to: "/settings", icon: "settings", label: "Settings" },
];

// Below 900 px the sidebar becomes a drawer behind a compact top bar.
export const COMPACT_QUERY = "(max-width: 899px)";

function useCompactViewport() {
  const read = () => typeof window.matchMedia === "function" && window.matchMedia(COMPACT_QUERY).matches;
  const [compact, setCompact] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(COMPACT_QUERY);
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return compact;
}

function SystemSwitcher() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={`fr-switcher${open ? " is-open" : ""}`}>
      <button ref={triggerRef} type="button" className="fr-switcher__trigger" aria-expanded={open} aria-controls={listId}
        aria-label={`Switch system. Current system: ${FRRIS_SYSTEM.name}, ${FRRIS_SYSTEM.domain.toLowerCase()}`} onClick={() => setOpen((value) => !value)}>
        <span className="fr-switcher__swatch fr-switcher__swatch--frris" aria-hidden="true" />
        <span className="fr-switcher__name"><strong>{FRRIS_SYSTEM.name}</strong><span>{FRRIS_SYSTEM.domain}</span></span>
        <Icon name="updown" width={16} height={16} />
      </button>
      <div id={listId} className="fr-switcher__panel" hidden={!open}>
        <ul aria-label="Systems">
          {SUITE_SYSTEMS.map((system) => system.route
            ? <li key={system.key}><Link className="fr-switcher__option" to={system.route} aria-current="true">
                <span className={`fr-switcher__swatch fr-switcher__swatch--${system.key}`} aria-hidden="true" />
                <span className="fr-switcher__name"><strong>{system.name}</strong><span>{system.domain} · <span className="fr-switcher__state">Current</span></span></span></Link></li>
            : <li key={system.key}><span className="fr-switcher__option fr-switcher__option--inert">
                <span className={`fr-switcher__swatch fr-switcher__swatch--${system.key}`} aria-hidden="true" />
                <span className="fr-switcher__name"><strong>{system.name}</strong><span>{system.domain} · <span className="fr-switcher__state">In development</span></span></span></span></li>)}
        </ul>
        <Link className="fr-switcher__all" to="/">All systems</Link>
      </div>
    </div>
  );
}

function NavList({ items, runningTasks }: { items: readonly NavItem[]; runningTasks: number }) {
  return (
    <ul className="fr-nav__list">
      {items.map((item) => (
        <li key={item.to}>
          <NavLink end={item.end} to={item.to} className={({ isActive }) => `fr-nav__link${isActive ? " is-active" : ""}`}>
            <Icon name={item.icon} width={18} height={18} strokeWidth={2} />
            <span>{item.label}</span>
            {item.to === FRRIS_ROUTES.analyses && runningTasks > 0 ? <em aria-label={`${runningTasks} running`}>{runningTasks}</em> : null}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export function AuthenticatedLayout() {
  const session = useSession();
  const organization = useOrganizationContext();
  const location = useLocation();
  const navigate = useNavigate();
  const compact = useCompactViewport();
  const isAdmin = ["admin", "owner"].includes(organization.current_role);
  const workspaceNav = WORKSPACE_NAV.filter((item) => !item.adminOnly || isAdmin);
  const allNav = [...PRIMARY_NAV, ...workspaceNav];
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeDrawer = useCallback(() => { setDrawerOpen(false); menuButtonRef.current?.focus(); }, []);
  const drawerRef = useDialog(compact && drawerOpen, closeDrawer);
  const searchDialog = useDialog(searchOpen, () => setSearchOpen(false));
  const sidebarId = useId();
  const workspaceListId = useId();
  const userName = session.data?.user?.displayName || session.data?.user?.email || organization.user.display_name || organization.user.email || null;
  const tasks = useQuery({ queryKey: queryKeys.tasks.list({ status: "running", limit: 20 }), queryFn: () => fetchTasks({ status: "running", limit: 20 }), refetchInterval: 10_000 });
  const matches = allNav.filter((item) => item.label.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  const onWorkspacePage = workspaceNav.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

  // The drawer closes on navigation. On desktop the Workspace group opens when one of its pages is current;
  // in the drawer it starts closed so the primary pages stay at the top.
  useEffect(() => { setSearchOpen(false); setDrawerOpen(false); }, [location.pathname]);
  useEffect(() => { setWorkspaceOpen(onWorkspacePage && !compact); }, [location.pathname, onWorkspacePage, compact]);
  useEffect(() => { if (!compact) setDrawerOpen(false); }, [compact]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setDrawerOpen(false); setSearchOpen(true); } };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  // Desktop: a plain sidebar. Compact: a modal drawer while open, inert while closed (it is also hidden by CSS).
  const drawerProps = compact
    ? drawerOpen ? { role: "dialog", "aria-modal": true, "aria-label": "Menu" } as const : { inert: true }
    : {};

  return (
    <div className={`fr-shell${compact && drawerOpen ? " is-drawer-open" : ""}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="fr-topbar">
        <SuiteBrand linked compact />
        <span className="fr-topbar__system"><span className="fr-switcher__swatch fr-switcher__swatch--frris" aria-hidden="true" />{FRRIS_SYSTEM.name}</span>
        <button ref={menuButtonRef} type="button" className="fr-topbar__menu" aria-label="Open menu" aria-haspopup="dialog"
          aria-expanded={compact && drawerOpen} aria-controls={sidebarId} onClick={() => setDrawerOpen(true)}>
          <Icon name="menu" width={22} height={22} strokeWidth={2} />
        </button>
      </header>
      {compact && drawerOpen ? <div className="fr-drawer-backdrop" data-testid="drawer-backdrop" aria-hidden="true" onClick={closeDrawer} /> : null}
      <div id={sidebarId} ref={drawerRef as RefObject<HTMLDivElement>} className="fr-sidebar" tabIndex={-1} {...drawerProps}>
        <div className="fr-sidebar__head">
          <SuiteBrand linked />
          <button type="button" className="fr-sidebar__close" aria-label="Close menu" onClick={closeDrawer}><Icon name="close" width={20} height={20} strokeWidth={2} /></button>
        </div>
        <nav aria-label="Main" className="fr-sidebar__scroll">
          <SystemSwitcher />
          <div className="fr-nav">
            <NavList items={PRIMARY_NAV} runningTasks={tasks.data?.total ?? 0} />
          </div>
          <div className={`fr-nav fr-nav--workspace${workspaceOpen ? " is-open" : ""}`}>
            <button type="button" className="fr-nav__toggle" aria-expanded={workspaceOpen} aria-controls={workspaceListId} onClick={() => setWorkspaceOpen((value) => !value)}>
              Workspace<Icon name="chevron" width={16} height={16} />
            </button>
            <div id={workspaceListId} className="fr-nav__collapsible" hidden={!workspaceOpen}><NavList items={workspaceNav} runningTasks={0} /></div>
          </div>
          <button type="button" className="fr-nav__find" onClick={() => { setDrawerOpen(false); setSearchOpen(true); }}>
            <Icon name="search" width={16} height={16} /><span>Find a page</span><kbd aria-hidden="true">Ctrl K</kbd>
          </button>
        </nav>
        <div className="fr-sidebar__account">
          {userName ? <span className="fr-sidebar__user">{userName}</span> : null}
          <span className="fr-sidebar__org">{organization.current_organization.name} · {roleLabel(organization.current_role)}</span>
          {organization.memberships.length > 1 ? <OrganizationMenu /> : null}
          <LogoutButton />
        </div>
      </div>
      <main id="main-content" tabIndex={-1} className="fr-main content"><Outlet /></main>
      {searchOpen ? <div className="modal-backdrop command-backdrop" onClick={() => setSearchOpen(false)}><section ref={searchDialog} role="dialog" aria-modal="true" aria-label="Workspace navigation" tabIndex={-1} className="command-palette" onClick={(event) => event.stopPropagation()}><div><Icon name="search" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Find a workspace page" placeholder="Find a page…" /><button type="button" className="icon-button" aria-label="Close workspace navigation" onClick={() => setSearchOpen(false)}><Icon name="close" /></button></div><p>Workspace pages</p>{matches.map((item) => <button type="button" key={item.to} onClick={() => { navigate(item.to); setSearchOpen(false); }}><Icon name={item.icon} />{item.label}</button>)}{matches.length === 0 ? <p role="status">No matching pages.</p> : null}</section></div> : null}
    </div>
  );
}
