interface VersionBadgeProps {
  version: number;
  versionGroupId: string | null;
  totalVersions: number;
}

export function VersionBadge({ version, totalVersions }: VersionBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700" data-testid="version-badge">
      Version {version} of {totalVersions}
    </span>
  );
}
