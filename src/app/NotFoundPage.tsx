import { SuiteBrand } from "./SuiteBrand";
import { NotFoundState } from "../shared/ui/StatusStates";

// Unknown addresses (P5). Public: it does not require a session, so it shows only the brand.
export function NotFoundPage() {
  return (
    <div className="fr-suite">
      <header className="fr-suite__header"><SuiteBrand linked /></header>
      <main id="main-content" className="fr-suite__main fr-state-page"><NotFoundState subject="page" /></main>
    </div>
  );
}
