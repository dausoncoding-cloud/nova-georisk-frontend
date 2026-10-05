import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <main className="full-state">
      <span className="eyebrow">404</span>
      <h1>Page not found</h1>
      <p>The requested NOVA page is not available.</p>
      <Link className="button button--primary" to="/projects">Return to projects</Link>
    </main>
  );
}
