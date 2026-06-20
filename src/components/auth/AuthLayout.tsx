import { Link } from "react-router-dom";
import logo from "@/assets/logo.png";

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 gradient-canvas">
      <div className="absolute inset-x-0 top-0 p-6">
        <Link to="/" className="inline-flex items-center gap-2">
          <img src={logo} alt="TapThatFlyer logo" className="h-9 w-auto" />
        </Link>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant animate-scale-in">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
