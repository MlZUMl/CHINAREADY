// Petits motifs de l'ambiance « rose pêche » : pièce dorée, fleur, étincelle. SVG sans dépendance.
export function Coin({ size = 18 }: { size?: number }) {
  return (
    <svg className="coin" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="10.5" fill="#F6DFA3" stroke="#D9A441" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="#D9A441" strokeWidth="1" strokeDasharray="1.6 1.6" />
      <path d="M12 7.2l1.3 3.2 3.4.3-2.6 2.2.8 3.3-2.9-1.8-2.9 1.8.8-3.3-2.6-2.2 3.4-.3z" fill="#D9A441" />
    </svg>
  )
}

export function Fleur({ size = 28 }: { size?: number }) {
  return (
    <svg className="orn-fleur" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <g fill="#F4A3B8">
        <circle cx="20" cy="8.5" r="8" /><circle cx="31" cy="16.5" r="8" /><circle cx="26.8" cy="29.5" r="8" />
        <circle cx="13.2" cy="29.5" r="8" /><circle cx="9" cy="16.5" r="8" />
      </g>
      <circle cx="20" cy="20" r="5" fill="#FFF3C9" stroke="#D9A441" strokeWidth="1.2" />
    </svg>
  )
}
