import { NavLink } from "react-router-dom";
import { Home, History } from "lucide-react";

export const navItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: Home,
  },
  {
    title: "Candidates",
    href: "/history",
    icon: History,
  },
];

interface NavigationProps {
  className?: string;
}

export function Navigation({ className = "" }: NavigationProps) {
  return (
    <nav className={className}>
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
    </nav>
  );
}
