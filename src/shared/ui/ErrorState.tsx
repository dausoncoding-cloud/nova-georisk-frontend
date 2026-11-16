import { ApiError, getErrorMessage } from "../api/errors";
import { AccessDeniedState, NotFoundState } from "./StatusStates";

export function ErrorState({
  title,
  error,
  onRetry,
  subject = "item",
}: {
  title: string;
  error: unknown;
  onRetry?: () => void;
  /** What the page is about; used for the wording of the access-denied and not-found states. */
  subject?: "analysis" | "item";
}) {
  // 403 and 404 from the API get the design's dedicated states (P5); every other error keeps the retry card.
  if (error instanceof ApiError && error.status === 403) return <div className="fr-state-page"><AccessDeniedState subject={subject} reference={error.requestId} /></div>;
  if (error instanceof ApiError && error.status === 404) return <div className="fr-state-page"><NotFoundState subject={subject} reference={error.requestId} /></div>;
  return (
    <div className="full-state full-state--error" role="alert">
      <span className="eyebrow">Unable to continue</span>
      <h1>{title}</h1>
      <p>{getErrorMessage(error)}</p>
      {onRetry ? (
        <button className="button button--primary" type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}
