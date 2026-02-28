import { Link } from "react-router-dom";
import { useBreadcrumbs } from "./useBreadcrumbs";

export function Breadcrumbs() {
  const items = useBreadcrumbs();

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="breadcrumb-item">
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
          {!item.current ? <span className="breadcrumb-separator">/</span> : null}
        </span>
      ))}
    </nav>
  );
}
