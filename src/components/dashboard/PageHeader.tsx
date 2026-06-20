type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-2xl font-bold sm:text-3xl md:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-2 text-pretty text-sm text-muted-foreground sm:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
