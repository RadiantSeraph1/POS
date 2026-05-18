export function RolePlaceholderPanel(props: {
  roleName: string;
  summary: string;
  pages: string[];
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{props.roleName}</h2>
          <p className="muted">{props.summary}</p>
        </div>
      </div>
      <div className="placeholder-list">
        {props.pages.map((page) => (
          <div key={page} className="placeholder-row">
            <span className="strong">{page}</span>
            <span className="muted">Planned UI page</span>
          </div>
        ))}
      </div>
    </section>
  );
}
