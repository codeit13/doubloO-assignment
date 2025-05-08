import { NavLink } from "react-router-dom";
import { Home, Play, History } from "lucide-react";

const navItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: Home,
  },
  {
    title: "Run Agent",
    href: "/run-agent",
    icon: Play,
  },
  {
    title: "History",
    href: "/history",
    icon: History,
  },
];

export default function Sidebar() {
  return (
    <div className="hidden border-r bg-background lg:block w-64 h-[calc(100vh-4rem)]">
      <div className="space-y-4 py-4">
        <div className="px-4 py-2">
          <h2 className="mb-2 px-2 text-lg font-semibold tracking-tight">
            Navigation
          </h2>
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-accent hover:text-accent-foreground ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "transparent"
                  }`
                }
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.title}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
