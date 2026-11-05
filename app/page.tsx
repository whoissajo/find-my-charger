import ChargerMap from "./components/charger-map";

function BoltMark() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <rect x="1" y="1" width="38" height="38" rx="13" fill="#b9f36b" />
      <path d="M22.4 7.5 11.5 22h7.1l-1.1 10.5L28.5 18h-7.2l1.1-10.5Z" fill="#102018" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="app-frame">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Lahore EV Finder home">
          <span className="brand-mark"><BoltMark /></span>
          <span className="brand-name">lahore<span>ev</span></span>
          <span className="brand-divider" />
          <span className="brand-descriptor">CHARGING NETWORK</span>
        </a>
        <nav className="topbar-nav" aria-label="Main navigation">
          <a className="nav-link nav-link-active" href="#explore">Explore map</a>
          <a className="nav-link" href="#data-notes">Data & sources</a>
          <a className="nav-link nav-link-cta" href="https://www.openstreetmap.org/" target="_blank" rel="noreferrer">
            Contribute <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <section className="workspace" id="explore">
        <ChargerMap />
      </section>

      <footer className="site-footer" id="data-notes">
        <div>
          <span className="footer-brand">lahore<span>ev</span></span>
          <span className="footer-copy">Built for the next mile.</span>
        </div>
        <div className="footer-sources">
          <span>Map © OpenStreetMap contributors · CARTO</span>
          <a href="https://github.com/whoissajo/find-my-charger" target="_blank" rel="noreferrer">Open source ↗</a>
          <a href="https://web.rustgis.app/" target="_blank" rel="noreferrer">RustGIS ↗</a>
        </div>
      </footer>
    </main>
  );
}
