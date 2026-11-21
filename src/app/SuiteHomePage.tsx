import { Link } from "react-router-dom";
import { useSession } from "../features/auth/authQueries";
import { LogoutButton } from "../features/auth/LogoutButton";
import { AdminConsoleLink } from "../features/platformAdmin/AdminConsoleLink";
import { useAvailableEngines } from "../features/engines/engineQueries";
import { useOrganizationContext } from "../features/organization/OrganizationContext";
import { Icon } from "../shared/ui/Icon";
import { SuiteBrand } from "./SuiteBrand";
import { SUITE_SYSTEMS, systemAvailability, type SuiteSystem, type SystemAvailability } from "./suiteSystems";

const PILL: Record<SystemAvailability, [string, string] | null> = {
  active: ["Active", "fr-pill--success"],
  "not-enabled": ["Not enabled", "fr-pill--neutral"],
  "in-development": ["In development", "fr-pill--neutral"],
  unknown: null,
};

function SystemCard({ system, availability }: { system: SuiteSystem; availability: SystemAvailability }) {
  const pill = PILL[availability];
  const headingId = `system-${system.key}`;
  return (
    <article className={`fr-system-card fr-system-card--${system.key}`} aria-labelledby={headingId}>
      <div className="fr-system-card__top">
        <span className="fr-system-card__icon" aria-hidden="true"><Icon name={system.icon} width={22} height={22} strokeWidth={2} /></span>
        {pill ? <span className={`fr-pill ${pill[1]}`}>{pill[0]}</span> : null}
      </div>
      <div className="fr-system-card__body">
        <h2 id={headingId}>{system.name}</h2>
        <span className="fr-system-card__domain">{system.title ?? system.domain}</span>
        {system.description ? <p>{system.description}</p> : null}
      </div>
      {(availability === "active" || availability === "unknown") && system.route
        ? <Link className="fr-button fr-button--primary fr-system-card__action" to={system.route}>Open {system.name}</Link>
        : <span className="fr-system-card__action fr-system-card__action--inert">
            {availability === "not-enabled" ? "Not enabled for your organization" : "Available soon"}
          </span>}
    </article>
  );
}

export function SuiteHomePage() {
  const session = useSession();
  const organization = useOrganizationContext();
  const engines = useAvailableEngines();
  const userName = session.data?.user?.displayName || session.data?.user?.email || organization.user.display_name || organization.user.email || null;

  return (
    <div className="fr-suite">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="fr-suite__header">
        <SuiteBrand />
        <div className="fr-suite__account">
          <span>{userName ? `${userName} · ` : ""}{organization.current_organization.name}</span>
          <AdminConsoleLink />
          <LogoutButton />
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="fr-suite__main">
        <div className="fr-page-intro">
          <h1>Your systems</h1>
          <p>Choose a system to work in. Each system has its own analyses, results and downloads; your account and organization are shared.</p>
        </div>
        <section aria-label="Systems" className="fr-system-grid">
          {SUITE_SYSTEMS.map((system) => <SystemCard key={system.key} system={system} availability={systemAvailability(system, engines.data)} />)}
        </section>
      </main>
    </div>
  );
}
