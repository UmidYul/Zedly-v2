import { Bell, ChevronDown, Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Breadcrumbs } from "./Breadcrumbs";
import { useAuth } from "../../state/auth-context";

interface TopbarProps {
  onToggleSidebar: () => void;
}

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const { session, signOut, signOutAll } = useAuth();
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onWindowClick(event: MouseEvent) {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setOpenMenu(false);
      }
    }

    window.addEventListener("click", onWindowClick);
    return () => {
      window.removeEventListener("click", onWindowClick);
    };
  }, []);

  return (
    <header className="app-topbar-academic">
      <div className="topbar-start">
        <button type="button" className="topbar-menu-btn" onClick={onToggleSidebar} aria-label="Toggle menu">
          <Menu size={18} />
        </button>
        <Breadcrumbs />
      </div>

      <div className="topbar-end">
        <button type="button" className="topbar-notification-btn" aria-label="Notifications">
          <Bell size={16} />
          <Badge variant="info" size="sm">
            0
          </Badge>
        </button>
        <div className="topbar-user-menu" ref={menuRef}>
          <button type="button" className="topbar-user-trigger" onClick={() => setOpenMenu((prev) => !prev)}>
            <Avatar name={session?.me.full_name || "Unknown"} src={session?.me.avatar_url} size="md" />
            <span className="topbar-user-name">{session?.me.full_name || "Guest"}</span>
            <ChevronDown size={14} />
          </button>
          {openMenu ? (
            <div className="topbar-user-dropdown">
              <Link to="/profile" onClick={() => setOpenMenu(false)}>
                Профиль
              </Link>
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(false);
                  navigate("/dashboard");
                }}
              >
                Настройки
              </button>
              <hr />
              <Button
                variant="ghost"
                size="sm"
                aria-label="Logout"
                onClick={() => {
                  setOpenMenu(false);
                  void signOut();
                }}
              >
                Выйти
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Logout All"
                onClick={() => {
                  setOpenMenu(false);
                  void signOutAll();
                }}
              >
                Выйти со всех
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
