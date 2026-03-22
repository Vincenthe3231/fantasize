type WorkspacePyramidLoaderProps = {
  caption?: string;
};

export function WorkspacePyramidLoader({ caption }: WorkspacePyramidLoaderProps) {
  return (
    <div className="flex flex-col items-center gap-6">
      <div className="workspace-pyramid-loader" aria-hidden>
        <div className="workspace-pyramid-loader__wrapper">
          <span className="workspace-pyramid-loader__side workspace-pyramid-loader__side1" />
          <span className="workspace-pyramid-loader__side workspace-pyramid-loader__side2" />
          <span className="workspace-pyramid-loader__side workspace-pyramid-loader__side3" />
          <span className="workspace-pyramid-loader__side workspace-pyramid-loader__side4" />
          <span className="workspace-pyramid-loader__shadow" />
        </div>
      </div>
      {caption ? (
        <p className="text-sm text-muted-foreground" role="status">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
