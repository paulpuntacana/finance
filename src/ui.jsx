// Gedeelde UI-bouwstenen (designsysteem). Tokens staan in src/index.css.
// Gebruik deze in elk scherm i.p.v. eigen knop-/kaart-/modalvarianten.
import { useEffect } from 'react'

export const Button = ({ variant = 'primary', size = 'md', className = '', style, children, ...props }) => {
  const base = 'inline-flex items-center justify-center gap-1.5 font-medium transition-[background,border-color,color,box-shadow,transform] duration-150 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap active:translate-y-px select-none';
  const sizes = {
    sm: 'h-8 px-3 text-[12.5px] rounded-[8px]',
    md: 'h-9 px-3.5 text-[13.5px] rounded-[9px]',
    lg: 'h-11 px-5 text-[14.5px] rounded-[10px]',
  };
  const styles = {
    primary: { background: 'var(--accent)', color: '#fff', boxShadow: '0 1px 0 rgba(255,255,255,0.18) inset, 0 1px 2px rgba(0,0,0,0.25)' },
    secondary: { background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border-2)' },
    ghost: { background: 'transparent', color: 'var(--text-2)' },
    danger: { background: 'var(--danger-soft)', color: 'var(--danger)', border: '1px solid transparent' },
    outline: { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border-2)' },
  };
  const hover = {
    primary: 'hover:brightness-110',
    secondary: 'hover:border-[color:var(--border-3)]',
    ghost: 'hover:bg-[color:var(--surface-2)] hover:text-[color:var(--text)]',
    danger: 'hover:border-[color:var(--danger)]',
    outline: 'hover:bg-[color:var(--surface-2)]',
  };
  return (
    <button
      style={{ ...styles[variant], ...style }}
      className={`${base} ${sizes[size]} ${hover[variant] || ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const fieldLabel = 'block text-[12.5px] font-medium mb-1.5';
const fieldBase = 'w-full h-9 px-3 text-[13.5px] rounded-[9px] border transition-[border-color,box-shadow]';

export const Input = ({ label, hint, error, className = '', ...props }) => (
  <div className={className}>
    {label && <label className={fieldLabel} style={{ color: 'var(--text-2)' }}>{label}</label>}
    <input
      {...props}
      aria-invalid={!!error}
      className={fieldBase}
      style={{ borderColor: error ? 'var(--danger)' : 'var(--border-2)', background: 'var(--surface)', color: 'var(--text)' }}
    />
    {hint && <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>{hint}</p>}
    {error && <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>{error}</p>}
  </div>
);

export const Textarea = ({ label, hint, className = '', rows = 3, ...props }) => (
  <div className={className}>
    {label && <label className={fieldLabel} style={{ color: 'var(--text-2)' }}>{label}</label>}
    <textarea
      rows={rows}
      {...props}
      className="w-full px-3 py-2 text-[13.5px] rounded-[9px] border transition-[border-color,box-shadow] resize-y"
      style={{ borderColor: 'var(--border-2)', background: 'var(--surface)', color: 'var(--text)', minHeight: 64 }}
    />
    {hint && <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>{hint}</p>}
  </div>
);

export const Select = ({ label, children, className = '', ...props }) => (
  <div className={className}>
    {label && <label className={fieldLabel} style={{ color: 'var(--text-2)' }}>{label}</label>}
    <select
      {...props}
      className={`${fieldBase} cursor-pointer`}
      style={{ borderColor: 'var(--border-2)', background: 'var(--surface)', color: 'var(--text)' }}
    >
      {children}
    </select>
  </div>
);

// Status-badge: kleur + stip + woord (nooit alleen kleur)
export const Badge = ({ status, children }) => {
  const tone = {
    draft: ['var(--surface-3)', 'var(--text-2)'],
    sent: ['var(--info-soft)', 'var(--info)'],
    paid: ['var(--success-soft)', 'var(--success)'],
    overdue: ['var(--danger-soft)', 'var(--danger)'],
    open: ['var(--warning-soft)', 'var(--warning)'],
    processed: ['var(--success-soft)', 'var(--success)'],
    partial: ['var(--accent-soft)', 'var(--accent)'],
    credit_note: ['var(--surface-3)', 'var(--danger)'],
  }[status] || ['var(--surface-3)', 'var(--text-2)'];
  const labels = {
    draft: 'Concept', sent: 'Verstuurd', paid: 'Betaald', overdue: 'Te laat', open: 'Open',
    processed: 'Verwerkt', partial: 'Deels betaald', credit_note: 'Creditnota',
  };
  return (
    <span style={{ background: tone[0], color: tone[1] }} className="inline-flex items-center gap-1.5 h-[22px] px-2 rounded-full text-[11.5px] font-medium whitespace-nowrap">
      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'currentColor', opacity: status === 'draft' ? 0.5 : 1 }} />
      {children || labels[status] || status}
    </span>
  );
};

export const Modal = ({ open, onClose, children, size = 'md' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl', full: 'max-w-7xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(5,9,13,0.55)', backdropFilter: 'blur(3px)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        role="dialog" aria-modal="true"
        className={`${sizes[size]} w-full my-8 animate-slide`}
        style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-pop)' }}
      >
        {children}
      </div>
    </div>
  );
};

export const Card = ({ children, className = '', hover = false, style, ...props }) => (
  <div
    className={`${hover ? 'card-hover' : ''} ${className}`}
    style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', ...style }}
    {...props}
  >
    {children}
  </div>
);

export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="text-center py-14 px-6">
    <div className="inline-flex items-center justify-center w-11 h-11 rounded-[12px] mb-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
      <Icon size={18} style={{ color: 'var(--text-2)' }} />
    </div>
    <h3 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--text)' }}>{title}</h3>
    <p className="text-[13px] mb-5 max-w-sm mx-auto" style={{ color: 'var(--text-3)' }}>{description}</p>
    {action}
  </div>
);

// Bedrag in kasboekstijl: klein €-teken, centen lichter. Gebruik voor elk zichtbaar geldbedrag.
export const Money = ({ value, currency = 'EUR', className = '', signed = false, style }) => {
  const n = Number(value) || 0;
  const abs = Math.abs(n);
  const [whole, cents] = abs.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(',');
  const sym = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency;
  return (
    <span className={`money ${n < 0 ? 'neg' : ''} ${className}`} style={style}>
      {n < 0 ? '−' : signed && n > 0 ? '+' : ''}<span className="cur">{sym}</span>{whole}<span className="cents">,{cents}</span>
    </span>
  );
};

// Vaste paginakop: titel, korte uitleg, acties rechts
export const PageHeader = ({ title, sub, actions, children }) => (
  <div className="flex items-end justify-between gap-4 flex-wrap">
    <div className="min-w-0">
      <h1 className="page-title">{title}</h1>
      {sub && <div className="page-sub">{sub}</div>}
      {children}
    </div>
    {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
  </div>
);

// Segmented filter: [{ id, label, count? }]
export const Segmented = ({ options, value, onChange }) => (
  <div className="seg" role="group">
    {options.map(o => (
      <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
        {o.label}{o.count !== undefined && <span className="count">{o.count}</span>}
      </button>
    ))}
  </div>
);

