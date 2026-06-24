interface EmptyStateProps {
  title?: string;
  description: string;
}

export default function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="ds-empty-state">
      {title ? <h3>{title}</h3> : null}
      <p>{description}</p>
    </div>
  );
}
