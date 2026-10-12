import { Link } from "react-router-dom";
import { Wordmark } from "./bits";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { label: "Career Twin", href: "#platform" },
      { label: "Opportunity Mirror", href: "#platform" },
      { label: "Skill Sprint", href: "#platform" },
      { label: "Career Passport", href: "#platform" },
    ],
  },
  {
    title: "Learn more",
    links: [
      { label: "How it works", href: "#journey" },
      { label: "Progress and evidence", href: "#evidence" },
      { label: "For placement cells", href: "#recruiters" },
    ],
  },
  {
    title: "Workspace",
    links: [
      { label: "Overview", to: "/app" },
      { label: "Placement Tower", to: "/tower" },
      { label: "Get started", to: "/app" },
    ],
  },
] as const;

export default function LandingFooter() {
  return (
    <footer className="cl-foot">
      <div className="cl-shell">
        <div className="cl-foot-grid">
          <div>
            <Wordmark />
            <p className="cl-body" style={{ marginTop: "1rem" }}>
              A career record built from what you have done, scored by rules you can read.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2>{column.title}</h2>
              <ul>
                {column.links.map((link) => (
                  <li key={link.label}>
                    {"to" in link ? (
                      <Link to={link.to}>{link.label}</Link>
                    ) : (
                      <a href={link.href}>{link.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="cl-foot-bottom">
          <span>CAMPUSLINK / Career Intelligence</span>
        </div>
      </div>
    </footer>
  );
}
