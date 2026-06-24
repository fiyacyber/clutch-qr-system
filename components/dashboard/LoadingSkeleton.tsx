interface LoadingSkeletonProps {
  height?: number;
}

export default function LoadingSkeleton({ height = 120 }: LoadingSkeletonProps) {
  return <div className="ds-loading-skeleton" style={{ height }} aria-hidden="true" />;
}
