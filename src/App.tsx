const mockups = [
  ["M 001", "IPHONE", "phone"],
  ["M 002", "HOODIE", "hoodie"],
  ["M 003", "WATCH", "watch"],
  ["M 004", "CAP", "cap"],
  ["M 005", "DISPLAY", "display"],
];

const components = [
  ["C 001", "THEME TOGGLE", "toggle"],
  ["C 002", "LOADER RING", "loader"],
  ["C 003", "COUNTER", "counter"],
  ["C 004", "CHECKBOX", "checkbox"],
  ["C 005", "BROWSER", "browser"],
];

function ObjectPreview({ type }: { type: string }) {
  return <div className={`object-preview object-${type}`} aria-hidden="true" />;
}

function Tile({ item }: { item: string[] }) {
  return (
    <article className="tile">
      <div className="tile-art">
        {item[2] === "counter" ? <span className="counter-art">099</span> : <ObjectPreview type={item[2]} />}
      </div>
      <footer className="tile-meta">
        <span>{item[0]}</span>
        <span>{item[1]}</span>
      </footer>
    </article>
  );
}

function App() {
  return (
    <main className="page-shell">
      <header className="site-header">
        <span>MELODIES MERCH</span>
        <nav aria-label="Primary navigation">
          <a href="#mockups">MOCKUPS</a>
          <a href="#components">COMPONENTS</a>
          <a href="#about">ABOUT</a>
        </nav>
      </header>

      <section className="hero" id="about">
        <span className="hero-kicker">MEL / 099</span>
        <h1>099</h1>
        <p>OBJECTS FOR EVERYDAY LISTENING</p>
      </section>

      <section className="catalog-section" id="mockups">
        <h2>3D MOCKUPS</h2>
        <div className="tile-grid">{mockups.map((item) => <Tile key={item[0]} item={item} />)}</div>
      </section>

      <section className="catalog-section" id="components">
        <h2>FRAMER COMPONENTS</h2>
        <div className="tile-grid">{components.map((item) => <Tile key={item[0]} item={item} />)}</div>
      </section>

      <footer className="site-footer">
        <span>© 2026 MELODIES</span>
        <span>EST. 099</span>
      </footer>
    </main>
  );
}

export default App;
