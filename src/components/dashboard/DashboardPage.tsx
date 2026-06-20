import { cn } from "@/lib/utils";

type DashboardPageProps = {
  children: React.ReactNode;
  className?: string;
  maxWidth?: "3xl" | "4xl" | "6xl";
};

const maxWidthClass = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "6xl": "max-w-6xl",
};

export function DashboardPage({ children, className, maxWidth = "4xl" }: DashboardPageProps) {
  return (
    <main className={cn("mx-auto w-full min-w-0 px-4 py-6 sm:px-6 sm:py-10", maxWidthClass[maxWidth], className)}>
      {children}
    </main>
  );
}
