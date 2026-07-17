export function EmptyReportsState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
      <p className="text-sm text-muted-foreground">
        No reports yet — use &quot;Generate Report&quot; above to create your
        first weekly report
      </p>
    </div>
  );
}
