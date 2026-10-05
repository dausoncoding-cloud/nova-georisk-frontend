import { getErrorMessage } from "../api/errors";

export function ErrorState({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: unknown;
  onRetry?: () => void;
}) {
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
