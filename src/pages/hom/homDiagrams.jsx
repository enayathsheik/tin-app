// Small inline-SVG configuration diagrams for the HOM builder — no external
// image assets, just enough line art to disambiguate the two shutter-type
// and shutters-per-cabinet options at a glance.
export function ShutterTypeDiagram({ withHandle }) {
  return (
    <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
      <rect x="4" y="3" width="40" height="30" stroke="#17181c" strokeWidth="1.5" />
      {withHandle ? (
        <>
          <line x1="24" y1="3" x2="24" y2="33" stroke="#17181c" strokeWidth="1" strokeDasharray="2 2" />
          <rect x="18" y="15" width="4" height="6" fill="#e85a2a" />
        </>
      ) : (
        <line x1="24" y1="3" x2="24" y2="33" stroke="#17181c" strokeWidth="1" strokeDasharray="2 2" />
      )}
    </svg>
  );
}

export function ShuttersPerCabDiagram({ count }) {
  return (
    <svg width="48" height="36" viewBox="0 0 48 36" fill="none">
      <rect x="4" y="3" width="40" height="30" stroke="#17181c" strokeWidth="1.5" />
      {count === 2 && <line x1="24" y1="3" x2="24" y2="33" stroke="#17181c" strokeWidth="1.5" />}
    </svg>
  );
}
