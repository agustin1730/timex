import { useAccount } from "@/hooks/use-account";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Timer,
  ListOrdered,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  UserRound,
  PictureInPicture2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { isTauriDesktop, setWidgetPreference, widgetPreference } from "@/lib/desktop-session";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AppNavigation({ children }: { children: ReactNode }) {
  const accountState = useAccount();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [widgetEnabled, setWidgetEnabled] = useState(false);
  const path = useRouterState({ select: (state) => state.location.pathname });
  const sequences = path === "/sequences" || path.startsWith("/sequence-");
  useEffect(() => {
    if (!isTauriDesktop()) return;
    setDesktop(true);
    const enabled = widgetPreference();
    setWidgetEnabled(enabled);
    void setWidgetPreference(enabled).catch(console.error);
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const close = () => {
      if (query.matches) setMobileOpen(false);
    };
    query.addEventListener("change", close);
    return () => query.removeEventListener("change", close);
  }, []);
  const changeWidget = (enabled: boolean) => {
    setWidgetEnabled(enabled);
    void setWidgetPreference(enabled).catch(() => setWidgetEnabled(!enabled));
  };
  const widgetOption = (compact: boolean) =>
    !desktop ? null : compact ? (
      <Button
        variant="ghost"
        size="icon"
        className={`min-h-11 w-full ${widgetEnabled ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
        aria-label="Mostrar mini widget"
        aria-pressed={widgetEnabled}
        title="Mini widget"
        onClick={() => changeWidget(!widgetEnabled)}
      >
        <PictureInPicture2 className="h-5 w-5" />
      </Button>
    ) : (
      <label
        className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground"
        title="Mostrar mini widget al iniciar una sesión"
      >
        <PictureInPicture2 className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">Mini widget</span>
        <Switch
          checked={widgetEnabled}
          aria-label="Mostrar mini widget"
          onCheckedChange={changeWidget}
        />
      </label>
    );
  const links = (compact: boolean, mobile = false) => (
    <nav aria-label="Secciones" className="space-y-2">
      {[
        {
          to: "/" as const,
          name: "Temporizadores",
          Icon: Timer,
          active: !sequences && path !== "/account",
        },
        { to: "/sequences" as const, name: "Secuencias", Icon: ListOrdered, active: sequences },
      ].map(({ to, name, Icon, active }) => (
        <Link
          key={to}
          to={to}
          search={{}}
          onClick={() => {
            if (mobile) setMobileOpen(false);
          }}
          aria-label={name}
          title={compact ? name : undefined}
          aria-current={active ? "page" : undefined}
          className={`flex min-h-11 items-center rounded-lg gap-3 px-3 transition-colors ${compact ? "justify-center" : ""} ${active ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
        >
          <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
          {!compact && <span>{name}</span>}
        </Link>
      ))}
    </nav>
  );
  const account = (compact: boolean) => (
    <div className="mt-auto border-t border-border pt-4">
      <Link
        to="/account"
        onClick={() => setMobileOpen(false)}
        aria-label="Cuenta"
        title="Cuenta"
        aria-current={path === "/account" ? "page" : undefined}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 ${path === "/account" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"} ${compact ? "justify-center" : ""}`}
      >
        <UserRound className="h-5 w-5 shrink-0" aria-hidden="true" />
        {!compact && (
          <span className="min-w-0 text-left">
            <span className="block">Cuenta</span>
            <span className="block truncate text-xs">
              {accountState.user ? accountState.status : "Sin cuenta"}
            </span>
          </span>
        )}
      </Link>
    </div>
  );
  return (
    <div className="min-h-screen">
      <aside
        aria-label="Navegación principal"
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card p-3 md:flex ${collapsed ? "w-20" : "w-60"}`}
      >
        <div
          className={`mb-8 flex items-center gap-2 pt-3 ${collapsed ? "flex-col" : "justify-between px-2"}`}
        >
          {!collapsed && (
            <span className="text-xl font-bold uppercase tracking-wide">
              Intervalos<span className="text-primary">.</span>
            </span>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label={collapsed ? "Expandir barra lateral" : "Plegar barra lateral"}
            aria-expanded={!collapsed}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </Button>
        </div>
        {links(collapsed)}
        {widgetOption(collapsed)}
        {account(collapsed)}
      </aside>
      <div className={`min-w-0 ${collapsed ? "md:pl-20" : "md:pl-60"}`}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background px-4 md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menú">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 max-w-[85vw] flex-col px-3 pb-4 pt-12">
              <SheetTitle className="px-3 text-xl uppercase">
                Intervalos<span className="text-primary">.</span>
              </SheetTitle>
              <SheetDescription className="sr-only">
                Navegación entre temporizadores y secuencias.
              </SheetDescription>
              <div className="mt-5">{links(false, true)}</div>
              {widgetOption(false)}
              {account(false)}
            </SheetContent>
          </Sheet>
          <span className="font-semibold">Intervalos</span>
        </header>
        {children}
      </div>
    </div>
  );
}
