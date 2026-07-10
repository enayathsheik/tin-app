export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">T<em>I</em>N</div>
        <div className="site-footer-links">
          <a href="mailto:enayathsheik@gmail.com">Contact</a>
          <span className="site-footer-sep">·</span>
          <a href="#" onClick={(e) => e.preventDefault()}>Privacy</a>
          <span className="site-footer-sep">·</span>
          <a href="#" onClick={(e) => e.preventDefault()}>Terms</a>
        </div>
        <div className="site-footer-copy">© {new Date().getFullYear()} TIN — Trade Interface Network</div>
      </div>
    </footer>
  );
}
