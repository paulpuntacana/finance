import React, { useState, useEffect, useRef, useMemo, createContext, useContext } from 'react';
import {
  LayoutDashboard, Users, FileText, Receipt as ReceiptIcon, Settings as SettingsIcon,
  Plus, Search, Trash2, Edit3, Eye, Send, Check, Camera, Upload,
  Download, X, ChevronRight, AlertCircle, Clock, TrendingUp,
  Euro, Mail, Bell, Image as ImageIcon, Save, ArrowLeft,
  Copy, Filter, Calendar, Building2, Printer, ChevronDown,
  CheckCircle2, CircleDashed, FileWarning, Wallet, Inbox,
  BookOpen, Sparkles, RefreshCw, Globe, Hash, ArrowRight, Zap, FileBarChart,
  Network, Briefcase, Percent, Tag, Lightbulb, Wand2, Brain, MessageSquare, Star,
  FileCheck2, ShieldCheck, ScanSearch, CloudOff, Compass, LogOut, Moon, Sun, Paperclip, ShoppingCart, Calculator,
  AlignLeft, AlignCenter, AlignRight, Key, Link2, Landmark,
} from 'lucide-react';
import { useAuth, useCloudStorage, useSyncStatus } from './src/AuthProvider';
import { computeInvoice, lineNet, todayISO, isRevenueInvoice, invoiceDate, invoiceOpenAmount, expenseNet, expenseVatTreatment, expenseReverseVat, buildVatReturn, buildProfitLoss, monthlySeries, suggestVatTreatment, VAT_TREATMENTS, yearOf } from './src/finance';
import { supabase } from './src/supabase';
import { roundMoney, invoiceEurRate, deriveInvoiceVatTreatment, isZeroRatedTreatment } from './src/finance';
import { useLang } from './src/LangContext';
import OrgUsersView from './src/OrgUsersView';
import QuotesView from './src/QuotesView';
import HorizonPlanner from './src/HorizonPlanner';
import CreditManagementView from './src/CreditManagementView';
import BoekhoudenView from './src/BoekhoudenView';
import BankView from './src/BankView';
import CommandPalette from './src/CommandPalette';
import { Button, Input, Textarea, Select, Badge, Modal, Card, EmptyState, Money, PageHeader, Segmented } from './src/ui';
import DataCheckView from './src/DataCheckView';
import StructuurView from './src/StructuurView';
import { findDataIssues } from './src/finance';
import { VizStyles, KpiTile, YearChart, CostDonut, VatPot, AgingBar, TopClients } from './src/DashboardCharts';
import ImportView from './src/ImportView';
import PurchaseInvoicesView from './src/PurchaseInvoicesView';
import { useReceiptOrgId, storageAvailable, isDataUrl, uploadReceipt, receiptUrl, downloadReceiptDataUrl, removeReceipts } from './src/receipts';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Area, AreaChart } from 'recharts';

// ============================================================================
// INVOICE INLINE EDIT CONTEXT
// ============================================================================
const InvoiceEditContext = createContext({ editMode: false, editValues: {}, onEdit: null });

// Contenteditable field for Word-like inline editing
const EditableField = ({ value, onChange, className, style }) => {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const committedRef = useRef(value);

  useEffect(() => {
    if (ref.current && !focused && ref.current.textContent !== value) {
      ref.current.textContent = value;
      committedRef.current = value;
    }
  }, [value, focused]);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={e => {
        setFocused(false);
        const newVal = e.currentTarget.textContent;
        if (newVal !== committedRef.current) {
          committedRef.current = newVal;
          onChange(newVal);
        }
      }}
      className={className}
      style={{
        ...style,
        outline: 'none',
        cursor: 'text',
        borderRadius: 3,
        background: focused ? 'rgba(0,0,0,0.04)' : hovered ? 'rgba(0,0,0,0.02)' : 'transparent',
        boxShadow: focused
          ? '0 0 0 1.5px rgba(0,0,0,0.25)'
          : hovered
          ? '0 0 0 1px rgba(0,0,0,0.12)'
          : 'none',
        padding: '2px 4px',
        margin: '-2px -4px',
        transition: 'box-shadow 0.15s, background 0.15s',
        minHeight: 18,
      }}
    />
  );
};

// ============================================================================
// THEME & STYLES
// ============================================================================
const ThemeStyles = () => (
  <style>{`

    /* Tokens staan in src/index.css */
    *, *::before, *::after { box-sizing: border-box; }
    body, html { background: var(--bg); color: var(--text); margin: 0; padding: 0; }
    .num { font-family: var(--font-num); font-feature-settings: 'tnum' 1, 'zero' 1; letter-spacing: -0.01em; }
    .font-display { font-family: var(--font-ui); letter-spacing: -0.025em; font-weight: 600; }
    .font-body { font-family: var(--font-ui); }
    .font-mono { font-family: var(--font-num); }

    /* ── Bedragen: €-teken klein/gedempt, centen lichter — leest als een kasboek ── */
    /* Money, page-title, ledger, seg, kbd: zie src/index.css */

    input, textarea, select {
      background: var(--surface) !important;
      color: var(--text) !important;
      border-color: var(--border-2) !important;
    }
    input::placeholder, textarea::placeholder { color: var(--text-3) !important; }
    select option { background: var(--surface); color: var(--text); }
    input:focus, textarea:focus, select:focus {
      outline: none !important;
      border-color: var(--accent) !important;
      box-shadow: 0 0 0 3px var(--accent-soft) !important;
    }

    .scrollable::-webkit-scrollbar { width: 4px; height: 4px; }
    .scrollable::-webkit-scrollbar-thumb { background: var(--border-3); border-radius: 4px; }
    .scrollable::-webkit-scrollbar-track { background: transparent; }

    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    .animate-in { animation: fadeIn 0.2s ease-out; }
    .animate-slide { animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes dotWave {
      0%, 60%, 100% { transform: scale(1); opacity: 0.7; }
      30% { transform: scale(1.55); opacity: 1; }
    }

    .card-hover { transition: border-color 0.15s, box-shadow 0.15s; }
    .card-hover:hover { border-color: var(--border-2) !important; box-shadow: 0 2px 16px rgba(0,0,0,0.2); }

    @media print {
      body * { visibility: hidden !important; }
      .invoice-printable, .invoice-printable *, .quote-printable, .quote-printable * { visibility: visible !important; }
      .invoice-printable, .quote-printable { position: absolute !important; left: 0; top: 0; width: 100%; background: white !important; padding: 40px !important; color: #000 !important; }
      .no-print { display: none !important; }
      @page { size: A4; margin: 10mm; }
    }
  `}</style>
);

// ============================================================================
// UTILITIES
// ============================================================================
const fmtEUR = (n) => {
  const num = Number(n || 0);
  return '€ ' + num.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const CURRENCIES = {
  EUR: { symbol: '€', locale: 'nl-NL', label: 'Euro (€)' },
  USD: { symbol: '$', locale: 'en-US', label: 'US Dollar ($)' },
  GBP: { symbol: '£', locale: 'en-GB', label: 'Pond (£)' },
  CHF: { symbol: 'Fr.', locale: 'de-CH', label: 'Zwitserse Frank (Fr.)' },
  DOP: { symbol: 'RD$', locale: 'es-DO', label: 'Dominicaanse Peso (RD$)' },
};


const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtDateLong = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
};


// Converteert ISO-timestamp naar YYYY-MM-DD in de LOKALE tijdzone (niet UTC).
// Voorkomt dat een datum als "10 jun 00:00 CEST" (= "9 jun 22:00 UTC") als "9 jun" wordt weergegeven.
const isoToLocalDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const addDays = (iso, days) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().split('T')[0];
};

const daysBetween = (a, b) => {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
};

const generateId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Volgend factuurnummer voor een entiteit. Kijkt naar de teller ÉN naar de hoogste bestaande
// nummers met hetzelfde prefix, zodat een achterlopende teller nooit een dubbel nummer oplevert.
const nextInvoiceNumberFor = (entity, allInvoices = []) => {
  const currentYear = new Date().getFullYear();
  const prefix = entity?.invoicePrefix ?? `${currentYear}-`;
  let counter = Number(entity?.nextInvoiceNumber) || 1;
  if (entity?.yearlyReset && entity?.lastInvoiceYear && entity.lastInvoiceYear < currentYear) counter = 1;
  let highest = 0;
  allInvoices.forEach(i => {
    if (entity?.id && i.entityId && i.entityId !== entity.id) return;
    const num = String(i.number || '');
    if (!num.startsWith(prefix)) return;
    const rest = num.slice(prefix.length);
    if (/^\d+$/.test(rest)) highest = Math.max(highest, parseInt(rest, 10));
  });
  const seq = Math.max(counter, highest + 1);
  return { number: `${prefix}${String(seq).padStart(4, '0')}`, seq, year: currentYear };
};

const isDuplicateInvoiceNumber = (allInvoices, number, entityId, ownId) =>
  !!number && allInvoices.some(i => i.id !== ownId && i.number === number && (i.entityId || null) === (entityId || null));

// computeInvoice / lineNet komen uit src/finance.js (ook correct voor creditnota's)
const computeLine = (item) => lineNet(item);

const computeInvoiceStatus = (invoice) => {
  if (invoice.status === 'paid' || invoice.status === 'draft' || invoice.status === 'credit_note') return invoice.status;
  if (invoice.status === 'partial') return 'partial';
  if (invoice.status === 'sent' && invoice.dueDate) {
    // Compare at noon to avoid timezone-induced day-off issues
    const due = new Date(invoice.dueDate + 'T12:00:00');
    const today = new Date(todayISO() + 'T12:00:00');
    if (due < today) return 'overdue';
  }
  return invoice.status;
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => resolve(e.target.result);
  reader.onerror = () => reject(new Error('Bestand kon niet worden gelezen'));
  reader.readAsDataURL(file);
});

const UNREADABLE_IMAGE_MSG = "Dit fotoformaat kan de browser niet lezen — kies 'Meest compatibel' in je camera-instellingen of upload een JPG/PDF";

// Laadt een File/Blob of data-URL als <img>; HEIC e.d. faalt hier in de meeste browsers
const loadImage = (src) => new Promise((resolve, reject) => {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  const done = () => { if (url !== src) URL.revokeObjectURL(url); };
  const img = new Image();
  img.onload = () => { done(); img.naturalWidth ? resolve(img) : reject(new Error(UNREADABLE_IMAGE_MSG)); };
  img.onerror = () => { done(); reject(new Error(UNREADABLE_IMAGE_MSG)); };
  img.src = url;
});

const drawScaled = (img, maxEdge) => {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
};

// Verkleint een foto: lange zijde max `maxEdge`, altijd JPEG — behalve als het beeld echt
// transparant is (logo's), want JPEG maakt transparantie zwart.
const resizeImage = async (file, maxEdge = 2000, quality = 0.85) => {
  const img = await loadImage(file);
  const canvas = drawScaled(img, maxEdge);
  if (/image\/(png|webp|gif)/.test(file.type || '')) {
    try {
      const px = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < px.length; i += 4) if (px[i] < 250) return canvas.toDataURL('image/png');
    } catch { /* geen pixeltoegang: gewoon JPEG */ }
  }
  return canvas.toDataURL('image/jpeg', quality);
};

// Klein JPEG-voorbeeld (±10 KB) voor de lijst; de volledige bon staat in Storage
const makeThumb = async (src, maxEdge = 240) => {
  try { return drawScaled(await loadImage(src), maxEdge).toDataURL('image/jpeg', 0.7); } catch { return null; }
};

// ============================================================================
// STORAGE HOOK
// ============================================================================
const useStorage = (key, defaultValue) => {
  const [value, setValue] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setValue(JSON.parse(raw));
    } catch (e) {
      // Key doesn't exist yet, use default
    } finally {
      setLoaded(true);
    }
  }, [key]);

  const save = async (newValue) => {
    const resolved = typeof newValue === 'function' ? newValue(value) : newValue;
    setValue(resolved);
    try {
      localStorage.setItem(key, JSON.stringify(resolved));
    } catch (e) {
      console.error('Storage save failed:', e);
    }
  };

  return [value, save, loaded];
};

// ============================================================================
// DEFAULT DATA
// ============================================================================
const DEFAULT_SETTINGS = {
  jurisdiction: 'NL', // 'NL' or 'DR'
  baseCurrency: 'EUR',
  enabledCurrencies: ['EUR', 'USD', 'DOP'],
  exchangeRates: { fetched: null, base: 'EUR', rates: {} }, // cached rates
  company: {
    name: '',
    address: '',
    postal: '',
    city: '',
    country: 'Nederland',
    kvk: '',
    btw: '',
    iban: '',
    bicCode: '',
    email: '',
    phone: '',
    website: '',
    logo: null,
  },
  invoice: {
    prefix: new Date().getFullYear() + '-',
    nextNumber: 1,
    paymentTerms: 14,
    defaultBtwRate: 21,
    footerText: 'Betaling binnen 14 dagen na factuurdatum.',
    accentColor: '#7C2D2D',
    currency: 'EUR',
    language: 'nl',
  },
  reminders: {
    enabled: true,
    schedule: [7, 14, 21],
    templates: [
      { name: 'Vriendelijke herinnering', subject: 'Vriendelijke herinnering: factuur {{number}}', body: 'Beste {{contact}},\n\nMisschien is het je ontschoten, maar factuur {{number}} van {{date}} staat nog open. Het bedrag van {{amount}} verwacht ik graag op rekening {{iban}}.\n\nMet vriendelijke groet,\n{{senderName}}' },
      { name: 'Tweede herinnering', subject: 'Tweede herinnering: factuur {{number}}', body: 'Beste {{contact}},\n\nIk merk dat factuur {{number}} van {{date}} nog niet is voldaan. Het bedrag van {{amount}} verwacht ik graag binnen 7 dagen op rekening {{iban}}.\n\nMet vriendelijke groet,\n{{senderName}}' },
      { name: 'Laatste herinnering', subject: 'LAATSTE herinnering: factuur {{number}}', body: 'Beste {{contact}},\n\nFactuur {{number}} ({{amount}}) staat al geruime tijd open. Graag binnen 7 dagen voldoen om verdere stappen te voorkomen.\n\nMet vriendelijke groet,\n{{senderName}}' },
    ],
  },
  email: {
    fromName: 'Paul den Hartogh',
    fromEmail: '',
    invoiceSubject: 'Factuur {{number}} van {{company}}',
    invoiceBody: 'Beste {{contact}},\n\nBijgevoegd vind je factuur {{number}}.\n\nBedrag: {{amount}}\nVervaldatum: {{dueDate}}\n\nMet vriendelijke groet,\n{{senderName}}',
    resendApiKey: '',
    whatsappNumber: '',
    whatsappMessage: 'Hallo {{contact}}, hierbij stuur ik je factuur {{number}} voor een bedrag van {{amount}} (vervaldatum {{dueDate}}). Graag op rekening {{iban}} onder vermelding van {{number}}. Bedankt! 🙏',
  },
  categories: ['Software/SaaS', 'Hosting & Infra', 'Kantoorartikelen', 'Reiskosten', 'Eten & Drinken', 'Marketing', 'Professionele diensten', 'Hardware', 'Overig'],
  apiKey: '',          // Anthropic API key (sk-ant-...)
  openaiApiKey: '',   // OpenAI API key (sk-...)
  creditManagement: {
    enabled: true,
    latePaymentThreshold: 3,
    highValueThreshold: 5000,
    autoCreateCase: true,
    debtCollector: {
      name: '',
      company: '',
      email: '',
      phone: '',
      website: '',
      notes: '',
    },
    graydonApiKey: '',
  },
};

// ============================================================================
// DEDUCTIBILITY GUIDE — NL / DR / EE
// status: 'safe' | 'borderline' | 'risky' | 'no'
// ============================================================================
const DEDUCTIBILITY_GUIDE = {
  NL: [
    { category: 'Software & Abonnementen', icon: '💻', items: [
      { name: 'Zakelijke software (Adobe, Figma, GitHub, etc.)', status: 'safe', pct: 100, tip: '"Software licentie [naam] — zakelijk gebruik [bedrijfsnaam]"', doc: 'Factuur op bedrijfsnaam/KvK' },
      { name: 'AI API-kosten (Claude, ChatGPT, etc.)', status: 'safe', pct: 100, tip: '"AI API-kosten [provider] — zakelijk gebruik voor [dienst]"' },
      { name: 'Hosting, VPS, CDN (Vercel, AWS, Cloudflare)', status: 'safe', pct: 100, tip: '"Hosting/infrastructuur [naam] — zakelijke applicatie"' },
      { name: 'Domeinregistratie & SSL', status: 'safe', pct: 100, tip: '"Domeinregistratie [domeinnaam] — zakelijk"' },
      { name: 'Communicatietools (Slack, Zoom, Loom)', status: 'safe', pct: 100, tip: '"Zakelijke communicatietool [naam]"' },
    ]},
    { category: 'Hardware & Apparatuur', icon: '🖥️', items: [
      { name: 'Laptop / computer (< €450)', status: 'safe', pct: 100, tip: '"Laptop [merk/model] — kantoorbenodigdheid zakelijk gebruik"', doc: 'Aankoopbewijs; bij voorkeur zakelijke rekening' },
      { name: 'Laptop / computer (> €450)', status: 'safe', pct: 100, tip: '"Bedrijfsmiddel: laptop [merk] — afschrijven 3 jaar"', doc: 'Serienummer noteren; op balans activeren', risk: 'Niet direct als kosten — afschrijven over minimaal 3 jaar (bijv. €600 = €200/jaar).' },
      { name: 'Externe monitor, toetsenbord, muis', status: 'safe', pct: 100, tip: '"Kantoorbenodigdheid: [apparaat] — zakelijk gebruik"' },
      { name: 'Telefoon (>90% zakelijk)', status: 'borderline', pct: 90, tip: '"Zakelijke telefoon — 90% zakelijk gebruik"', doc: 'Geen privéabonnement op zelfde nummer', risk: 'Belastingdienst kan privégebruik aanvechten. 75-80% is veiliger als je ook privé gebruikt. Bij twee toestellen: 100% verdedigbaar.' },
      { name: 'Telefoon (gemengd gebruik)', status: 'borderline', pct: 75, tip: '"Telefoon — 75% zakelijk gebruik (gedocumenteerd)"', risk: 'Stel zakelijk gebruik vast. Wees consistent elk jaar.' },
      { name: 'Camera / microfoon / headset (zakelijk)', status: 'safe', pct: 100, tip: '"Audio/videoapparatuur — zakelijke content/calls"' },
    ]},
    { category: 'Reiskosten', icon: '✈️', items: [
      { name: 'Vliegticket zakelijke reis', status: 'safe', pct: 100, tip: '"Vliegticket [bestemming] — zakelijke reis voor [klant/project/event]"', doc: 'Bewaar agenda-afspraak of e-mail ter onderbouwing' },
      { name: 'Hotel (zakelijke reis)', status: 'safe', pct: 100, tip: '"Hotelverblijf [stad] — zakelijke reis [datum]"', doc: 'Factuur op bedrijfsnaam; noteer doel reis' },
      { name: 'Trein / OV / taxi (zakelijk)', status: 'safe', pct: 100, tip: '"OV/taxi [traject] — zakelijk bezoek [klant/locatie]"' },
      { name: 'Vliegticket combi vakantie+werk', status: 'borderline', pct: 50, tip: '"Vliegticket [bestemming] — [X] dagen zakelijk van [Y] totaal; zakelijk aandeel X/Y × ticketprijs"', risk: 'Alleen zakelijke dagen aftrekbaar. Documenteer met agenda: meetings, klanten, events.' },
      { name: 'Auto eigen (zakelijk km)', status: 'safe', pct: 100, tip: '"Kilometerverg. zakelijk — [traject]: X km × €0,23"', doc: 'Rittenadministratie: datum, doel, km' },
      { name: 'Airbnb (deels zakelijk)', status: 'borderline', pct: 50, tip: '"Verblijfskosten [bestemming] — X van Y nachten zakelijk"', risk: 'Pro-rata: zakelijke nachten/totaal. Documenteer zakelijke activiteiten.' },
    ]},
    { category: 'Eten & Representatie', icon: '🍽️', items: [
      { name: 'Zakelijk diner/lunch met klant', status: 'safe', pct: 80, tip: '"Zakelijk diner — [naam klant] re. [project], [datum]"', doc: 'Noteer op de bon wie erbij waren en het zakelijke doel. 80% aftrekbaar.' },
      { name: 'Zakelijk event / netwerkevent', status: 'safe', pct: 80, tip: '"Netwerkevent [naam event] — zakelijke representatie"' },
      { name: 'Koffie/lunch tijdens zakelijke werkdag', status: 'borderline', pct: 80, tip: '"Zakelijke maaltijd tijdens werkdag — representatiekosten"', risk: 'Alleen echte zakelijke maaltijden (niet gewone thuislunch). 80% aftrekbaar. BD is kritisch.' },
      { name: 'Cadeau klant (< €227/persoon/jaar)', status: 'borderline', pct: 80, tip: '"Relatiegeschenk [naam klant] — zakelijke relatie onderhoud"', risk: 'Max €227 per persoon per jaar voor 80% aftrek. Daarboven: nihil.' },
      { name: 'Eigen maaltijden (geen klant erbij)', status: 'risky', pct: 0, tip: 'In principe niet aftrekbaar. Uitzondering: ver van huis/zakelijke locatie.', risk: 'BD beschouwt dit als privé. Niet aanraden tenzij je aantoonbaar ver van huis werkt.' },
    ]},
    { category: 'Kleding', icon: '👔', items: [
      { name: 'Kleding MET zichtbaar bedrijfslogo', status: 'safe', pct: 100, tip: '"Werkkleding met bedrijfslogo [bedrijfsnaam] — zakelijk representatiemateriaal"', doc: 'Logo moet duidelijk zichtbaar zijn; bewaar productfoto' },
      { name: 'Pak / zakelijke kleding (geen logo)', status: 'no', pct: 0, tip: 'Niet aftrekbaar in NL, ook niet als je het "alleen voor werk" draagt.', risk: 'Harde NL-regel: kleding aftrekbaar als ongeschikt voor privé OF logo draagt. Een pak is privé draagbaar → niet aftrekbaar.' },
      { name: 'Beschermkleding / veiligheidsschoenen', status: 'safe', pct: 100, tip: '"Beschermende werkkleding — verplicht voor beroepsuitoefening"' },
    ]},
    { category: 'Kantoor & Thuiskantoor', icon: '🏠', items: [
      { name: 'Externe kantoorruimte / coworking', status: 'safe', pct: 100, tip: '"Huur kantoorruimte / coworking [naam] — zakelijke werkplek"', doc: 'Huurcontract op bedrijfsnaam' },
      { name: 'Thuiskantoor (aparte kamer, exclusief zakelijk)', status: 'borderline', pct: 100, tip: '"Thuiskantoor — X% van woonoppervlak (Y m²), exclusief zakelijk gebruik"', doc: 'Kamer moet ECHT exclusief zakelijk zijn', risk: 'Heel streng in NL: kamer mag NIET gemengd zijn. Slaapcombinatie? Telt niet. Bewijs: plattegrond + foto.' },
      { name: 'Thuiskantoor (hoek van woonkamer)', status: 'risky', pct: 0, tip: 'Vrijwel nooit aftrekbaar in NL.', risk: 'Hoge kans op afwijzing bij controle. Niet aanraden.' },
      { name: 'Kantoorbenodigdheden / bureaumeubilair', status: 'safe', pct: 100, tip: '"Kantoorbenodigdheden/meubilair — zakelijk gebruik"' },
    ]},
    { category: 'Opleiding & Marketing', icon: '📚', items: [
      { name: 'Online cursus / bootcamp (vakgerelateerd)', status: 'safe', pct: 100, tip: '"Online cursus [naam] — vakinhoudelijke opleiding voor [vak]"' },
      { name: 'Vakliteratuur / boeken', status: 'safe', pct: 100, tip: '"Vakliteratuur: [titel] — zakelijk relevante kennis"' },
      { name: 'Conferentie / congres', status: 'safe', pct: 100, tip: '"Congresticket [naam event] — vakinhoudelijke bijscholing"' },
      { name: 'Google/Meta/LinkedIn Ads', status: 'safe', pct: 100, tip: '"Online advertentiekosten [platform] — zakelijke leadgeneratie"' },
      { name: 'Website (bouw, design, hosting)', status: 'safe', pct: 100, tip: '"Website ontwikkeling/onderhoud — zakelijke online aanwezigheid"' },
    ]},
    { category: 'Bankkosten & Verzekeringen', icon: '💳', items: [
      { name: 'Zakelijke rekening kosten', status: 'safe', pct: 100, tip: '"Bankkosten zakelijke rekening [bank]"' },
      { name: 'Stripe / PayPal / Wise / Revolut fees', status: 'safe', pct: 100, tip: '"Betaaldienst transactiekosten [platform] — zakelijke betalingsverwerking"' },
      { name: 'AOV / beroepsaansprakelijkheidsverzekering', status: 'safe', pct: 100, tip: '"AOV-premie / beroepsaansprakelijkheid — zakelijke verzekering"' },
      { name: 'Internet thuis (gemengd)', status: 'borderline', pct: 50, tip: '"Internetabonnement — 50% zakelijk gebruik"', risk: '50% is gangbaar. Tot 80% verdedigbaar als je freelancer bent die thuis werkt.' },
    ]},
  ],

  DR: [
    { category: 'Software & Tecnología', icon: '💻', items: [
      { name: 'Software / SaaS (Adobe, Figma, etc.)', status: 'safe', pct: 100, tip: '"Licencia de software [nombre] — uso empresarial"', doc: 'Factuur met NCF-nummer (B01 of B14)' },
      { name: 'AI API costs', status: 'safe', pct: 100, tip: '"Costos API de IA [proveedor] — uso empresarial"' },
      { name: 'Hosting / Cloud / Domein', status: 'safe', pct: 100, tip: '"Servicios de hosting/nube [proveedor] — infraestructura empresarial"' },
    ]},
    { category: 'Kleding / Vestimenta', icon: '👔', items: [
      { name: 'Zakelijke kleding (meetings, presentaties)', status: 'safe', pct: 100, tip: '"Vestimenta profesional para presentaciones y reuniones de negocios — gasto necesario para producir renta"', doc: 'DR-regel: gastos necesarios para producir renta. Kleding zonder logo gewoon aftrekbaar!' },
      { name: 'Pak, jurk, zakelijke schoenen', status: 'safe', pct: 100, tip: '"Ropa de trabajo — representación empresarial [RNC bedrijf]"' },
      { name: 'Casual kleding (ook privé)', status: 'borderline', pct: 70, tip: '"Ropa de uso mixto — estimado 70% uso profesional"', risk: 'Verdedigbaar maar wees voorzichtig bij volledig privé-uitziende aankopen.' },
    ]},
    { category: 'Eten & Representatie', icon: '🍽️', items: [
      { name: 'Restaurant (zakelijk diner/lunch met klant)', status: 'safe', pct: 100, tip: '"Gastos de representación — almuerzo/cena con [cliente] re. [proyecto], [fecha]"', doc: 'NCF-factuur van restaurant. Noteer namen en doel.' },
      { name: 'Eigen maaltijden tijdens werkdag', status: 'safe', pct: 80, tip: '"Alimentación durante jornada laboral — gastos necesarios para producir renta"', doc: 'DR is veel soepeler dan NL — eigen maaltijden grotendeels aftrekbaar.' },
      { name: 'Supermarkt (kantoor/thuiswerk)', status: 'borderline', pct: 50, tip: '"Alimentación y suministros de trabajo — 50% uso empresarial"' },
    ]},
    { category: 'Transport & Reizen', icon: '✈️', items: [
      { name: 'Benzine / brandstof', status: 'safe', pct: 100, tip: '"Combustible — uso empresarial, visita a [cliente/lugar]"', doc: 'Simpel bon. DGII accepteert benzinebonnen.' },
      { name: 'Vliegticket zakelijke reis', status: 'safe', pct: 100, tip: '"Boleto aéreo — viaje de negocios a [destino] para [propósito]"' },
      { name: 'Hotel zakelijke reis', status: 'safe', pct: 100, tip: '"Alojamiento — viaje de negocios [ciudad], [fechas]"' },
      { name: 'Auto (huur, onderhoud, benzine)', status: 'safe', pct: 100, tip: '"Alquiler/mantenimiento/combustible vehículo — uso empresarial"' },
    ]},
    { category: 'Kantoor & Thuiswerk', icon: '🏠', items: [
      { name: 'Huur woning (pro-rata thuiskantoor)', status: 'safe', pct: 30, tip: '"Arrendamiento — 30% uso empresarial (home office)"', doc: 'DR staat pro-rata thuiskantoor toe. 25-35% is gangbaar.' },
      { name: 'Elektriciteit / internet (zakelijk deel)', status: 'safe', pct: 30, tip: '"Electricidad/internet — 30% uso empresarial"' },
      { name: 'Kantoorbenodigdheden', status: 'safe', pct: 100, tip: '"Útiles de oficina — uso empresarial"' },
    ]},
    { category: 'ITBIS-tip (BTW terughalen)', icon: '🔄', items: [
      { name: 'ITBIS op zakelijke aankopen', status: 'safe', pct: 100, tip: 'Vraag ALTIJD om NCF-factuur (B01 voor bedrijven). Zonder NCF geen ITBIS-teruggave.', doc: 'NCF B01 of B14 vereist. Bewaar alle facturen 10 jaar.' },
      { name: 'Aankopen zonder NCF', status: 'risky', pct: 0, tip: 'Geen ITBIS terugvordering mogelijk. Vraag altijd om NCF.', risk: 'Veelgemaakte fout: informele aankopen zonder NCF kunnen niet worden teruggevorderd.' },
    ]},
  ],

  EE: [
    { category: 'Software & Technology', icon: '💻', items: [
      { name: 'Software / SaaS licenses', status: 'safe', pct: 100, tip: '"Software license [name] — business use, [OÜ name]"', doc: 'Invoice to OÜ name + registration code (registrikood)' },
      { name: 'AI API costs', status: 'safe', pct: 100, tip: '"AI API costs [provider] — business operations"' },
      { name: 'Hosting / cloud / domain', status: 'safe', pct: 100, tip: '"Cloud hosting [provider] — business infrastructure"' },
    ]},
    { category: 'Hardware', icon: '🖥️', items: [
      { name: 'Laptop / computer', status: 'safe', pct: 100, tip: '"Business equipment: laptop [brand/model] — company asset, [OÜ name]"', doc: 'Invoice to OÜ. Book as company asset.' },
      { name: 'Mixed-use equipment', status: 'borderline', pct: 75, tip: '"Equipment [name] — 75% business use, documented"', risk: 'Document business use %. Tax board may question high % if clearly also personal.' },
    ]},
    { category: 'Kleding / Clothing', icon: '👔', items: [
      { name: 'Business clothing (meetings, client visits)', status: 'borderline', pct: 75, tip: '"Professional attire for client meetings — [OÜ name] business representation"', risk: 'EE is more lenient than NL. No logo required, but document the business context clearly.' },
      { name: 'Company branded clothing', status: 'safe', pct: 100, tip: '"Company branded clothing — [OÜ name] marketing"' },
      { name: 'Casual clothing without business purpose', status: 'risky', pct: 0, tip: 'General clothing not deductible in EE without clear business purpose.' },
    ]},
    { category: 'Travel', icon: '✈️', items: [
      { name: 'Business travel (flights, hotel)', status: 'safe', pct: 100, tip: '"Business travel: [destination] — client meeting/conference [name]"', doc: 'Keep calendar invite, email confirmation of meeting.' },
      { name: 'Combined business+leisure', status: 'borderline', pct: 50, tip: '"Travel [destination] — [X] business days of [Y] total days, X/Y ratio applied"', risk: 'Split strictly by day ratio. Document business activities.' },
      { name: 'Client visits (transport)', status: 'safe', pct: 100, tip: '"Transport to client [name] — business meeting"' },
    ]},
    { category: 'Food & Entertainment', icon: '🍽️', items: [
      { name: 'Business dinner with client', status: 'safe', pct: 100, tip: '"Business entertainment — dinner with [client] re. [project], [date]"', doc: 'Note attendees and purpose.' },
      { name: 'Own meals while working', status: 'borderline', pct: 50, tip: '"Working meal — remote work day [date]"', risk: 'Allowed with documentation but scrutinized by tax board.' },
    ]},
    { category: 'Home Office', icon: '🏠', items: [
      { name: 'Rent (home office portion)', status: 'safe', pct: 30, tip: '"Home office — [X]% of flat used for business, [OÜ name]"', doc: 'Rental contract. Document which room/m². 25-35% common.' },
      { name: 'Internet (business)', status: 'safe', pct: 100, tip: '"Internet connection — business operations"' },
      { name: 'Office furniture', status: 'safe', pct: 100, tip: '"Office furniture [item] — home office business use"' },
    ]},
    { category: 'OÜ Strategy', icon: '💰', items: [
      { name: 'Retain profits in OÜ (geen uitkering)', status: 'safe', pct: 0, tip: 'Winst in OÜ laten staan = 0% belasting. Ideaal als je het geld niet privé nodig hebt.', doc: 'Geen actie nodig. Winst blijft automatisch belastingvrij in OÜ.' },
      { name: 'Dividend uitkeren (22%)', status: 'safe', pct: 0, tip: '"Dividend payment [amount] — 22% CIT applies at OÜ level"', doc: 'Simpelste manier om geld op te nemen. 22% corporate tax, geen extra privébelasting in EE.' },
      { name: 'Salaris uitkeren aan directeur', status: 'borderline', pct: 0, tip: '"Director salary [amount]/month"', risk: 'Salaris kost 33% social tax (werkgeversdeel) bovenop het salaris zelf. Vaak duurder dan dividend. Alleen nodig als je pensioenopbouw wilt of sociale zekerheid wil activeren.' },
    ]},
  ],
  UAE: [
    { category: 'Software & Technology', icon: '💻', items: [
      { name: 'Software / SaaS (Adobe, Figma, GitHub)', status: 'safe', pct: 100, tip: '"Software license [name] — business use, [LLC/FZ name], TRN [number]"', doc: 'Invoice to company name + TRN number.' },
      { name: 'AI API costs', status: 'safe', pct: 100, tip: '"AI API costs [provider] — business operations"' },
      { name: 'Hosting / cloud / domain', status: 'safe', pct: 100, tip: '"Cloud hosting [provider] — business infrastructure"' },
    ]},
    { category: 'Hardware & Equipment', icon: '🖥️', items: [
      { name: 'Laptop / computer', status: 'safe', pct: 100, tip: '"Business equipment: laptop [brand] — company asset, [company name]"', doc: 'Invoice to company. Can be expensed or depreciated.' },
      { name: 'Phone (business use)', status: 'safe', pct: 100, tip: '"Business phone — company expense"' },
    ]},
    { category: 'Clothing', icon: '👔', items: [
      { name: 'Business attire (meetings, presentations)', status: 'safe', pct: 100, tip: '"Professional attire for business meetings — company representation"', doc: 'UAE: geen logo-eis. Zakelijke kleding volledig aftrekbaar.' },
      { name: 'Casual clothing (mixed use)', status: 'borderline', pct: 70, tip: '"Business casual — professional use [X]%"', risk: 'Documenteer zakelijk doel. UAE is liberaal maar houdt bonnen bij.' },
    ]},
    { category: 'Meals & Entertainment', icon: '🍽️', items: [
      { name: 'Business dinner/lunch with client', status: 'safe', pct: 100, tip: '"Business entertainment — dinner with [client] re. [project], [date]"', doc: 'Receipt + note attendees and business purpose.' },
      { name: 'Own meals during business day', status: 'safe', pct: 100, tip: '"Meal during business operations — [date]"', doc: 'UAE is very liberal on business meal deductions.' },
    ]},
    { category: 'Travel', icon: '✈️', items: [
      { name: 'Business flights', status: 'safe', pct: 100, tip: '"Business travel: flights to [destination] — client/project [name]"' },
      { name: 'Hotel (business trip)', status: 'safe', pct: 100, tip: '"Accommodation [city] — business trip [dates]"' },
      { name: 'Car (company vehicle)', status: 'safe', pct: 100, tip: '"Vehicle expense — business use [company name]"' },
    ]},
    { category: 'Home Office / Kantoor', icon: '🏠', items: [
      { name: 'Office rent / coworking', status: 'safe', pct: 100, tip: '"Office rent/coworking [name] — business premises"' },
      { name: 'Home office (pro-rata)', status: 'borderline', pct: 30, tip: '"Home office — [X]% of rent, [company name]"', risk: 'Free zone companies may require a registered office address. Check your licence terms.' },
      { name: 'Internet / utilities (business portion)', status: 'safe', pct: 100, tip: '"Internet/utility — business operations"' },
    ]},
    { category: 'VAT & Tax Tips', icon: '💡', items: [
      { name: 'VAT (5%) on business purchases', status: 'safe', pct: 100, tip: 'Claim input VAT back via quarterly VAT201 return. Only if VAT registered (> AED 375k turnover).', doc: 'Tax invoice with your TRN number required.' },
      { name: 'Corporate Tax: profit under AED 375k (~€102k)', status: 'safe', pct: 0, tip: '0% corporate tax under Small Business Relief (turnover < AED 3 million). No filing needed under threshold.', doc: 'Check eligibility annually at Federal Tax Authority portal.' },
      { name: 'Free Zone: 0% corporate tax', status: 'safe', pct: 0, tip: '0% VPB in designated Free Zones zolang je geen mainland UAE activiteiten hebt.', doc: 'Check specifieke FZ-regels (DMCC, IFZA, etc.). Sommige vereisen fysiek kantoor.' },
    ]},
  ],

  ES: [
    { category: 'Software & Tecnología', icon: '💻', items: [
      { name: 'Software / SaaS (Adobe, Figma, GitHub)', status: 'safe', pct: 100, tip: '"Licencia software [nombre] — actividad económica, NIF [número]"', doc: 'Factura con NIF/CIF. IVA (21%) recuperable en declaración trimestral.' },
      { name: 'AI API costs', status: 'safe', pct: 100, tip: '"Costos API IA [proveedor] — uso profesional"' },
      { name: 'Hosting / cloud / dominio', status: 'safe', pct: 100, tip: '"Hosting/infraestructura cloud [proveedor] — actividad profesional"' },
    ]},
    { category: 'Hardware & Equipo', icon: '🖥️', items: [
      { name: 'Ordenador / portátil (100% profesional)', status: 'safe', pct: 100, tip: '"Equipo informático — amortización 3-5 años, uso profesional exclusivo"', doc: 'Factura con NIF. Amortizar al 25-33% anual (coeficiente tabla amortización).' },
      { name: 'Teléfono (uso mixto)', status: 'borderline', pct: 50, tip: '"Teléfono móvil — 50% uso profesional documentado"', risk: 'Hacienda acepta 50% para uso mixto. Documenta el porcentaje de uso profesional.' },
    ]},
    { category: 'Ropa', icon: '👔', items: [
      { name: 'Ropa de trabajo con logo empresarial', status: 'safe', pct: 100, tip: '"Ropa de trabajo — logo empresa visible, uso exclusivo profesional"', doc: 'Logo obligatorio. Idéntico al criterio holandés.' },
      { name: 'Traje / ropa profesional sin logo', status: 'risky', pct: 0, tip: 'Hacienda NO admite ropa convencional aunque sea "solo para trabajar".', risk: 'DGT: si es apta para uso particular, no es deducible. Solo uniforme con logo.' },
    ]},
    { category: 'Comidas & Representación', icon: '🍽️', items: [
      { name: 'Comida de negocios con cliente', status: 'safe', pct: 100, tip: '"Gastos de representación — comida con [cliente] re. [proyecto], [fecha]"', doc: 'Factura restaurante con NIF + nota de asistentes y motivo.', risk: 'Límite: gastos de atención a clientes no pueden superar el 1% del importe neto de la cifra de negocios.' },
      { name: 'Manutención en desplazamiento (fuera municipio)', status: 'safe', pct: 100, tip: '"Manutención — desplazamiento profesional a [ciudad/país], [fecha]"', doc: 'Límite: €53,34/día sin pernocta en España; €91,35 en extranjero. Con pernocta: el doble.' },
      { name: 'Comida propia (sin desplazamiento)', status: 'risky', pct: 0, tip: 'Solo deducible si estás desplazado fuera de tu municipio habitual. En tu ciudad: no deducible.', risk: 'Criterio estricto de Hacienda. No arriesgues comidas habituales en tu localidad.' },
    ]},
    { category: 'Viajes & Transporte', icon: '✈️', items: [
      { name: 'Vuelo de negocios', status: 'safe', pct: 100, tip: '"Viaje de negocios — vuelo a [destino] para [cliente/evento]"', doc: 'Conservar confirmación de reunión/congreso/cliente.' },
      { name: 'Hotel (viaje profesional)', status: 'safe', pct: 100, tip: '"Alojamiento — viaje de negocios [ciudad], [fechas]"' },
      { name: 'Vehículo autónomo (uso mixto)', status: 'borderline', pct: 50, tip: '"Gastos vehículo — 50% uso profesional (criterio Hacienda)"', risk: 'Hacienda solo acepta 50% para uso mixto. 100% solo si demuestras uso exclusivo profesional (muy difícil para autónomos).' },
      { name: 'Transporte público / taxi (profesional)', status: 'safe', pct: 100, tip: '"Transporte — [trayecto], visita a [cliente/reunión]"' },
    ]},
    { category: 'Oficina & Despacho en Casa', icon: '🏠', items: [
      { name: 'Oficina / coworking', status: 'safe', pct: 100, tip: '"Alquiler oficina/coworking [nombre] — sede profesional"', doc: 'Contrato a nombre del autónomo o empresa.' },
      { name: 'Despacho en casa (habitación exclusiva)', status: 'borderline', pct: 30, tip: '"Afectación vivienda habitual — [X]% superficie a actividad económica"', doc: 'Solo % de suministros (luz, agua, gas). NO el alquiler entero. Actividad debe estar en IAE con domicilio en casa.', risk: 'Hacienda es muy restrictiva. Solo IBI, comunidad, basura, amortización y suministros proporcionales.' },
      { name: 'Internet (uso mixto)', status: 'borderline', pct: 50, tip: '"Internet — 50% uso profesional"', risk: 'Criterio habitual del 50%. Documenta el porcentaje profesional.' },
    ]},
    { category: 'Cuotas & Seguros', icon: '💳', items: [
      { name: 'Cuota autónomos (Seguridad Social)', status: 'safe', pct: 100, tip: '"Cuota autónomos SS — [mes/año]"', doc: 'Gasto deducible 100%. Sistema de cotización por ingresos reales desde 2023.' },
      { name: 'Seguro RC / responsabilidad civil profesional', status: 'safe', pct: 100, tip: '"Seguro RC profesional — [aseguradora], actividad [epígrafe IAE]"' },
    ]},
  ],

  PT: [
    { category: 'Software & Tecnologia', icon: '💻', items: [
      { name: 'Software / SaaS (Adobe, Figma, GitHub)', status: 'safe', pct: 100, tip: '"Licença software [nome] — atividade profissional, NIF [número]"', doc: 'Fatura com NIF. In Regime Simplificado: inbegrepen in 25% forfaitaire aftrek.' },
      { name: 'AI API costs', status: 'safe', pct: 100, tip: '"Custos API IA [fornecedor] — uso profissional"' },
      { name: 'Hosting / cloud / domínio', status: 'safe', pct: 100, tip: '"Hosting/cloud [fornecedor] — infraestrutura profissional"' },
    ]},
    { category: 'Regime Simplificado vs. Contabilidade Organizada', icon: '📊', items: [
      { name: 'Regime Simplificado (< €200k omzet)', status: 'safe', pct: 25, tip: 'AT past automatisch 75%-coëfficiënt toe op omzet voor diensten. 25% is forfaitaire aftrek — GEEN bonnen nodig voor dit voordeel.', doc: 'Geen actie nodig. Automatisch bij IRS-aangifte via Portal das Finanças.' },
      { name: 'Contabilidade Organizada', status: 'borderline', pct: 100, tip: 'Alle werkelijke kosten aftrekbaar. Vereist certified accountant (TOC/contabilista certificado). Interessant bij > €25k-30k jaarkosten.', doc: 'Verplicht een TOC in te schakelen. Kan gunstiger zijn bij hoge kosten of lage marges.' },
    ]},
    { category: 'Kleding', icon: '👔', items: [
      { name: 'Fardamento / uniform met logo', status: 'safe', pct: 100, tip: '"Fardamento profissional com logótipo — [nome empresa/NIF]"', doc: 'Logo of vereist uniform. Zonder logo: zelfde strenge lijn als NL en ES.' },
      { name: 'Zakelijke kleding zonder logo', status: 'risky', pct: 0, tip: 'AT accepteert gewone kleding niet als beroepskosten, ook niet als je het "alleen voor werk" draagt.', risk: 'Beschouwd als privékosten. Alleen uniform of kleding met logo is veilig.' },
    ]},
    { category: 'Refeições & Representação', icon: '🍽️', items: [
      { name: 'Zakelijk diner/lunch met klant', status: 'safe', pct: 100, tip: '"Despesas de representação — jantar com [cliente] re. [projeto], [data]"', doc: 'Fatura restaurante met NIF. Noteer aanwezigen en zakelijk doel.', risk: 'Let op: despesas de representação boven 2% van omzet zijn onderhevig aan 35% aanvullende belasting (Tributação Autónoma).' },
      { name: 'Subsídio de refeição (eigen maaltijden)', status: 'borderline', pct: 50, tip: '"Subsídio de refeição — deslocação profissional, [data]"', risk: 'Alleen bij aantoonbare zakelijke verplaatsing. Thuis werken: niet aftrekbaar.' },
    ]},
    { category: 'Viagens & Transporte', icon: '✈️', items: [
      { name: 'Vlucht zakelijke reis', status: 'safe', pct: 100, tip: '"Viagem de negócios — voo para [destino], reunião com [cliente/evento]"' },
      { name: 'Hotel zakelijke reis', status: 'safe', pct: 100, tip: '"Alojamento — viagem profissional, [cidade], [datas]"' },
      { name: 'Veiculo (auto, gemengd gebruik)', status: 'borderline', pct: 50, tip: '"Viaturas — 50% uso profissional documentado"', risk: 'AT accepteert typisch 50% voor gemengd gebruik. Tributação Autónoma van 10-35% op voertuigkosten van toepassing.' },
      { name: 'Openbaar vervoer / taxi (zakelijk)', status: 'safe', pct: 100, tip: '"Transporte profissional — [trajeto], visita a [cliente]"' },
    ]},
    { category: 'Escritório & Home Office', icon: '🏠', items: [
      { name: 'Kantoor / coworking', status: 'safe', pct: 100, tip: '"Arrendamento escritório/cowork [nome] — instalações profissionais"', doc: 'Contrato op naam van de onderneming/ENI.' },
      { name: 'Home office (pro-rata, Contab. Organizada)', status: 'borderline', pct: 25, tip: '"Home office — [X]% do imóvel dedicado à atividade profissional"', risk: 'In Regime Simplificado: al inbegrepen in 25% forfaitaire aftrek. In Contabilidade Organizada: expliciet documenteren.' },
      { name: 'Internet / telefone', status: 'safe', pct: 50, tip: '"Internet/telefone — 50% uso profissional"', doc: 'Fatura op naam. 50% gangbaar bij gemengd gebruik.' },
    ]},
    { category: 'NHR — Non-Habitual Resident (IFICI)', icon: '🌟', items: [
      { name: 'NHR 2.0 (IFICI) — kwalificerende activiteiten', status: 'safe', pct: 0, tip: '20% flat rate IRS voor tech, R&D, industrie en andere gekwalificeerde activiteiten. Geldig 10 jaar.', doc: 'Aanvragen via Portal das Finanças als nieuwe fiscale inwoner. Goedgekeurde activiteitenlijst controleren.' },
      { name: 'Dividenden buitenland onder NHR', status: 'borderline', pct: 0, tip: 'Onder oud NHR: mogelijk 0%. Onder NHR 2.0 strenger — afhankelijk van belastingverdrag met oorsprongsland.', risk: 'Controleer per inkomenssoort en oorsprongsland met een fiscalist.' },
    ]},
  ],

  TH: [
    { category: 'Software & Technology', icon: '💻', items: [
      { name: 'Software / SaaS (Adobe, Figma, GitHub)', status: 'safe', pct: 100, tip: '"Software license [name] — business expense, [company registration no.]"', doc: 'Thai receipt/invoice. VAT (7%) reclaimable if VAT registered (turnover > ฿1.8M).' },
      { name: 'AI API costs', status: 'safe', pct: 100, tip: '"AI API — business operations"' },
      { name: 'Hosting / cloud / domain', status: 'safe', pct: 100, tip: '"Cloud/hosting [provider] — business infrastructure"' },
    ]},
    { category: 'Hardware & Equipment', icon: '🖥️', items: [
      { name: 'Laptop / computer', status: 'safe', pct: 100, tip: '"Business equipment: laptop [brand] — company asset"', doc: 'Invoice to company name. Depreciate 3-5 years or expense directly for SMEs.' },
      { name: 'Phone (business use)', status: 'borderline', pct: 75, tip: '"Business phone — 75% professional use documented"', risk: 'Document business use percentage.' },
    ]},
    { category: 'Clothing', icon: '👔', items: [
      { name: 'Uniform / company branded clothing', status: 'safe', pct: 100, tip: '"Uniform/branded clothing — company expense, [company name]"', doc: 'Company logo required or specific work uniform.' },
      { name: 'Business attire (meetings)', status: 'borderline', pct: 60, tip: '"Professional attire for client meetings — [X]% business use"', risk: 'Thailand Revenue Dept: deductible if required for work. Document the business context.' },
    ]},
    { category: 'Meals & Entertainment', icon: '🍽️', items: [
      { name: 'Business entertainment with client', status: 'safe', pct: 100, tip: '"Entertainment expense — dinner with [client] re. [project], [date]"', doc: 'Thai receipt + note business purpose. Keep for 5 years.', risk: 'Entertainment deductions for listed companies capped at 0.3% of revenue. Much more flexible for SMEs.' },
      { name: 'Per diem / meals on business trip', status: 'safe', pct: 100, tip: '"Per diem — business trip to [city], [date]"', doc: 'Revenue Dept allows ฿270/day per diem (general rate). Higher for overseas.' },
    ]},
    { category: 'Travel', icon: '✈️', items: [
      { name: 'Business flights', status: 'safe', pct: 100, tip: '"Business travel: flights to [destination] — client/event [name]"', doc: 'Keep boarding pass + evidence of business purpose.' },
      { name: 'Hotel (business trip)', status: 'safe', pct: 100, tip: '"Hotel [city] — business trip [dates]"' },
      { name: 'Car / taxi (business use)', status: 'safe', pct: 100, tip: '"Business transport — [destination], client visit"' },
    ]},
    { category: 'Home Office / Office', icon: '🏠', items: [
      { name: 'Office rent / coworking', status: 'safe', pct: 100, tip: '"Office rent [name] — business premises"', doc: 'Rental contract in company name.' },
      { name: 'Home office (pro-rata)', status: 'borderline', pct: 30, tip: '"Home office — [X]% of residence used for business"', risk: 'Revenue Dept allows home office deductions with documentation. Pro-rata by area.' },
      { name: 'Internet / utilities', status: 'safe', pct: 100, tip: '"Internet — business operations"', doc: 'Bill in company name preferred.' },
    ]},
    { category: 'BOI & Tax Incentives', icon: '🌟', items: [
      { name: 'BOI-vrijstelling (BOI-registered company)', status: 'safe', pct: 0, tip: 'BOI geeft 0% CIT voor 3-8 jaar voor goedgekeurde activiteiten (tech, export, R&D). Aanvragen via BOI Thailand.', doc: 'Vereist specifieke activiteiten en investeringen. Machtiging vóór start activiteiten aanvragen.' },
      { name: 'Long Term Resident (LTR) Visa', status: 'safe', pct: 0, tip: 'LTR Visa voor high-income remote workers: 10-jaar verblijf + belastingvoordeel op buitenlands inkomen.', doc: 'Vereist inkomen > $80k/jaar of $1M belegde assets. Aanvragen via BOI.' },
    ]},
  ],

  ID: [
    { category: 'Software & Teknologi', icon: '💻', items: [
      { name: 'Software / SaaS (Adobe, Figma, GitHub)', status: 'safe', pct: 100, tip: '"Biaya lisensi perangkat lunak [nama] — operasional bisnis, NPWP [nomor]"', doc: 'Faktur dengan NPWP. PPN 11% terug te vorderen als BTW-plichtig.' },
      { name: 'AI API costs', status: 'safe', pct: 100, tip: '"Biaya API AI [penyedia] — keperluan bisnis"' },
      { name: 'Hosting / cloud / domain', status: 'safe', pct: 100, tip: '"Hosting/cloud [penyedia] — infrastruktur bisnis"' },
    ]},
    { category: 'UMKM & Regime Keuze', icon: '📊', items: [
      { name: 'UMKM: 0,5% PPh Final over bruto-omzet', status: 'safe', pct: 100, tip: 'Voor omzet tot IDR 4,8 miljard/jaar: 0,5% belasting over bruto-omzet. Geen verdere aftrekken nodig.', doc: 'Betaal maandelijks via SIMBARA/DJP Online. NPWP verplicht.' },
      { name: 'UMKM: 0% belasting eerste jaar', status: 'safe', pct: 0, tip: 'Nieuwe ondernemers in het eerste belastingjaar: 0% PPh Final (bepaalde voorwaarden van toepassing).', doc: 'Vrijstelling aanvragen bij KPP Pratama.' },
    ]},
    { category: 'Kleding', icon: '👔', items: [
      { name: 'Seragam / uniform met bedrijfslogo', status: 'safe', pct: 100, tip: '"Seragam/pakaian dinas — keperluan operasional perusahaan"', doc: 'Faktur op bedrijfsnaam (NPWP). Bewaar als biaya jabatan.' },
      { name: 'Zakelijke representatiekleding', status: 'borderline', pct: 50, tip: '"Pakaian representasi bisnis — 50% keperluan profesional"', risk: 'Dirjen Pajak: kleding zonder bedrijfskarakter is grotendeels privé. Documenteer zakelijk doel.' },
    ]},
    { category: 'Makan & Representasi', icon: '🍽️', items: [
      { name: 'Business lunch/dinner met klant', status: 'safe', pct: 100, tip: '"Biaya representasi — makan dengan [klien] re. [proyek], [tanggal]"', doc: 'Kwitansi/nota met NPWP verkoper. In UMKM-regime: niet relevant (plat tarief).', risk: 'In Lucro Real/PPh Badan: entertainment expenses zijn aftrekbaar maar kunnen worden betwist bij excessieve bedragen.' },
      { name: 'Eigen maaltijden (werkdag)', status: 'borderline', pct: 50, tip: '"Biaya makan selama tugas — hari kerja [tanggal]"', risk: 'Bij UMKM-regime: niet relevant. In PPh Badan: acceptabel met onderbouwing.' },
    ]},
    { category: 'Perjalanan Bisnis', icon: '✈️', items: [
      { name: 'Vliegticket zakelijke reis', status: 'safe', pct: 100, tip: '"Tiket penerbangan — perjalanan dinas ke [kota], tujuan: [doel]"', doc: 'Surat tugas (opdracht memo) aanbevolen bij bedrijfsonkostenvergoeding.' },
      { name: 'Hotel zakelijke reis', status: 'safe', pct: 100, tip: '"Akomodasi — perjalanan dinas, [kota], [tanggal]"' },
      { name: 'BBM / brandstof (zakelijk voertuig)', status: 'safe', pct: 100, tip: '"BBM kendaraan dinas — operasional bisnis"', doc: 'Bon brandstof. Zakelijk voertuig: 100% aftrekbaar.' },
    ]},
    { category: 'Kantor & Home Office', icon: '🏠', items: [
      { name: 'Kantoor / coworking', status: 'safe', pct: 100, tip: '"Sewa kantor/coworking [nama] — operasional bisnis"', doc: 'Kwitansi sewa. Verhuurder verplicht PPh Pasal 4(2) te betalen.' },
      { name: 'Internet (zakelijk)', status: 'safe', pct: 100, tip: '"Internet — operasional bisnis"', doc: 'Tagihan op naam van bedrijf.' },
      { name: 'Listrik / nutstarieven (pro-rata)', status: 'borderline', pct: 30, tip: '"Listrik — 30% operasional home office"', risk: 'Alleen relevant bij PPh Badan (lucro real). In UMKM-regime: niet nodig.' },
    ]},
  ],

  US: [
    { category: 'Software & Technology', icon: '💻', items: [
      { name: 'Business software / SaaS', status: 'safe', pct: 100, tip: '"Software subscription [name] — business expense, [business name]"', doc: 'Invoice or bank statement. 100% deductible if exclusively used for business.' },
      { name: 'AI API costs', status: 'safe', pct: 100, tip: '"AI API — business operations expense"' },
      { name: 'Hosting / cloud / domain', status: 'safe', pct: 100, tip: '"Business hosting [provider] — infrastructure"' },
    ]},
    { category: 'Hardware (Section 179)', icon: '🖥️', items: [
      { name: 'Laptop / computer (>50% business)', status: 'safe', pct: 100, tip: '"Business equipment: [item] — Section 179 immediate expensing"', doc: 'Must be >50% business use. Section 179: full deduction in year of purchase (up to $1.16M limit).' },
      { name: 'Mixed-use equipment', status: 'borderline', pct: 60, tip: '"Business equipment [item] — [X]% business use, documented mileage/log"', risk: 'Must document business use %. IRS may require depreciation over 5 years if mixed-use <100%.' },
    ]},
    { category: 'Clothing', icon: '👔', items: [
      { name: 'Required uniform / safety gear', status: 'safe', pct: 100, tip: '"Required uniform — not suitable for everyday wear, [business name]"', doc: 'Must NOT be suitable for everyday wear. Specific uniform required by employer/profession.' },
      { name: 'Business suit / professional clothing', status: 'no', pct: 0, tip: 'NOT deductible. IRS rule: if suitable for everyday wear, it is a personal expense — even if worn only for work.', risk: 'Strict IRS position upheld in court cases. Do not deduct suits, dresses, or shoes without required uniform status.' },
    ]},
    { category: 'Meals & Entertainment', icon: '🍽️', items: [
      { name: 'Business meals with client (documented)', status: 'safe', pct: 50, tip: '"Business meal — [client name] re. [business topic], [date], [restaurant]"', doc: 'Note: who attended, business discussed. 50% deductible post-TCJA 2017.', risk: 'Entertainment (events, sports, shows) = 0% deductible since TCJA. Only meals at 50%.' },
      { name: 'Meals while traveling overnight', status: 'safe', pct: 50, tip: '"Meal during overnight business travel — [city], [date]"', doc: '50% deductible when traveling away from home for business.' },
      { name: 'Office meals / snacks for employees', status: 'borderline', pct: 50, tip: '"Employee meals — provided at the employer convenience"', risk: 'Was 100%, now 50% post-TCJA. Scheduled to drop to 0% after 2025 unless renewed by Congress.' },
    ]},
    { category: 'Travel', icon: '✈️', items: [
      { name: 'Business flights (100% business trip)', status: 'safe', pct: 100, tip: '"Business travel — flights to [city] for [client/conference]"', doc: 'Keep itinerary, conference registration, or client emails as evidence.' },
      { name: 'Hotel (business trip)', status: 'safe', pct: 100, tip: '"Business lodging [city] — [dates], [purpose]"' },
      { name: 'Mileage (personal vehicle)', status: 'safe', pct: 100, tip: '"Business mileage — [X] miles × $0.67/mile (2024 IRS standard rate)"', doc: 'Mileage log required: date, destination, business purpose, miles driven.' },
      { name: 'Mixed vacation + business trip', status: 'borderline', pct: 50, tip: '"Travel [destination] — primarily business (>50% business days)"', risk: 'If >50% of days are business: transport 100% deductible, hotel/meals only for business days.' },
    ]},
    { category: 'Home Office (Form 8829)', icon: '🏠', items: [
      { name: 'Home office — exclusive use (dedicated room)', status: 'safe', pct: 100, tip: '"Home office — exclusive and regular business use: [X] sq ft / [Y] total sq ft"', doc: 'IRS: must be EXCLUSIVE use. No personal use at all. Calculate: home office sq ft ÷ total sq ft × home expenses.' },
      { name: 'Home office — simplified method', status: 'safe', pct: 100, tip: '"Home office simplified: [X] sq ft × $5/sq ft (max 300 sq ft = $1,500 deduction)"', doc: 'Simpler alternative. Max $1,500 deduction per year.' },
      { name: 'Home office — shared/dual-use room', status: 'no', pct: 0, tip: 'NOT deductible. IRS requires EXCLUSIVE business use. A bedroom with a desk at night does NOT qualify.', risk: 'Very strict IRS rule. One personal use voids the entire deduction for that space.' },
    ]},
    { category: 'Self-Employment Tax Deductions', icon: '💰', items: [
      { name: 'Self-employment tax (50% deduction)', status: 'safe', pct: 50, tip: 'Automatically deduct 50% of SE tax on Schedule 1. Reduces adjusted gross income.', doc: 'Computed on Schedule SE. No tracking needed — automatic calculation.' },
      { name: 'Self-employed health insurance premiums', status: 'safe', pct: 100, tip: '"Health insurance premiums — self-employed deduction, Schedule 1 Line 17"', doc: 'Cannot exceed net self-employment income.' },
      { name: 'QBI Deduction (Section 199A)', status: 'safe', pct: 20, tip: '20% deduction on qualified business income for most pass-through entities (LLC, sole prop, S-Corp).', doc: 'Auto-calculated on Form 8995. Subject to income thresholds ($182k single / $364k MFJ for 2024).' },
      { name: 'SEP-IRA / Solo 401(k) contributions', status: 'safe', pct: 100, tip: '"Retirement contribution — SEP-IRA/Solo 401(k) [year]"', doc: 'SEP-IRA: up to 25% of net SE income, max $69k (2024). Powerful tax reducer — consider annually.' },
    ]},
  ],

  BR: [
    { category: 'Software & Tecnologia', icon: '💻', items: [
      { name: 'Software / SaaS (Adobe, Figma, GitHub)', status: 'safe', pct: 100, tip: '"Licença de software [nome] — despesa operacional, CNPJ [número]"', doc: 'Nota fiscal com CNPJ. In Simples Nacional: al inbegrepen in DAS. In Lucro Real: volledig aftrekbaar.' },
      { name: 'AI API costs', status: 'safe', pct: 100, tip: '"Custos API IA [fornecedor] — despesa operacional"' },
      { name: 'Hosting / cloud / domínio', status: 'safe', pct: 100, tip: '"Serviços cloud [fornecedor] — infraestrutura empresarial"' },
    ]},
    { category: 'Regime Tributário — Keuze is alles', icon: '📊', items: [
      { name: 'MEI (Microempreendedor Individual)', status: 'safe', pct: 0, tip: 'MEI: vaste maandbedragen DAS omvat INSS + ISS/ICMS. Omzetlimiet: R$81.000/jaar. Simpelste systeem.', doc: 'Betaling DAS via PGMEI. Geen aftrekposten nodig — forfaitair systeem.' },
      { name: 'Simples Nacional (omzet tot R$4.8M)', status: 'safe', pct: 0, tip: 'Alles-in-één tarief: 4-19,5% op bruto-omzet (Anexo III/V voor diensten). Omvat IR, CSLL, PIS, COFINS, ISS.', doc: 'DAS berekend via Pgdas-D. Geen losse aftrekken — simpel maar niet altijd goedkoopst.' },
      { name: 'Lucro Presumido (omzet < R$78M)', status: 'borderline', pct: 32, tip: 'AT gaat er van uit dat 32% van de omzet winst is (servicebedrijven). Hierover: 15% IRPJ + 9% CSLL + PIS/COFINS.', doc: 'Interessant bij hoge marges. Meer administratie vereist.' },
      { name: 'Lucro Real', status: 'borderline', pct: 100, tip: 'Alle werkelijke kosten aftrekbaar. Vereist volledige boekhouding. Interessant bij lage marges of hoge kosten.', doc: 'Verplicht boven R$78M omzet. Optioneel voor kleinere bedrijven met hoge kostenstructuur.' },
    ]},
    { category: 'Kleding', icon: '👔', items: [
      { name: 'Uniforme / EPI (beschermende uitrusting)', status: 'safe', pct: 100, tip: '"Uniforme/EPI — despesa necessária para atividade"', doc: 'Nota fiscal op CNPJ.' },
      { name: 'Zakelijke kleding (representatie)', status: 'borderline', pct: 50, tip: '"Vestuário representação — 50% uso profissional"', risk: 'Receita Federal: kleding aftrekbaar als noodzakelijk voor activiteit. Gewone kleding is moeilijker te verdedigen.' },
    ]},
    { category: 'Alimentação & Representação', icon: '🍽️', items: [
      { name: 'Business dinner/lunch met klant', status: 'safe', pct: 100, tip: '"Despesas de representação — jantar com [cliente] re. [projeto], [data]"', doc: 'Nota fiscal met CNPJ. In Simples Nacional: niet relevant (plat tarief).', risk: 'In Lucro Real: representatiekosten aftrekbaar maar houd bedragen realistisch.' },
      { name: 'PAT — Maaltijdvergoeding werknemers', status: 'safe', pct: 100, tip: 'PAT (Programa de Alimentação do Trabalhador): maaltijdvergoeding voor werknemers is aftrekbaar en geeft fiscaal voordeel.', doc: 'Aanmelden bij Ministério do Trabalho voor PAT-certificering.' },
    ]},
    { category: 'Viagens & Transporte', icon: '✈️', items: [
      { name: 'Vliegticket zakelijke reis', status: 'safe', pct: 100, tip: '"Passagem aérea — viagem a negócios, [destino], [propósito]"', doc: 'Nota fiscal of recibo. In Simples Nacional: niet relevant (plat tarief).' },
      { name: 'Hotel zakelijke reis', status: 'safe', pct: 100, tip: '"Hospedagem — viagem a negócios, [cidade], [datas]"' },
      { name: 'Combustível (zakelijk voertuig)', status: 'safe', pct: 100, tip: '"Combustível — veículo empresa/profissional"', doc: 'Cupom fiscal op CNPJ.' },
    ]},
    { category: 'Escritório & Home Office', icon: '🏠', items: [
      { name: 'Kantoor / coworking', status: 'safe', pct: 100, tip: '"Aluguel escritório/coworking [nome] — despesa operacional"', doc: 'Recibo/nota fiscal met CNPJ.' },
      { name: 'Home office (pro-rata, Lucro Real)', status: 'borderline', pct: 25, tip: '"Home office — [X]% do imóvel em uso profissional"', risk: 'In Simples Nacional: niet relevant (plat tarief). In Lucro Real: proportioneel aftrekbaar met onderbouwing.' },
      { name: 'Internet / telefone', status: 'safe', pct: 100, tip: '"Internet/telefone — uso profissional"', doc: 'Fatura op CNPJ.' },
    ]},
    { category: 'INSS & Contribuições', icon: '💳', items: [
      { name: 'INSS Contribuinte Individual (freelancer)', status: 'safe', pct: 100, tip: '"Contribuição INSS — previdência social"', doc: 'INSS bijdrage: 20% over maandinkomen (max teto). Aftrekbaar als bedrijfskosten.' },
      { name: 'DAS / Simples Nacional betaling', status: 'safe', pct: 0, tip: 'DAS is de all-in belasting voor Simples/MEI. Geen verdere aftrekken nodig in dit regime.', doc: 'Betaling via Pgdas-D op site Receita Federal.' },
    ]},
  ],


};

// Helper: get deductibility guide for a jurisdiction, with flat search
const getDeductGuide = (jurCode) => DEDUCTIBILITY_GUIDE[jurCode] || DEDUCTIBILITY_GUIDE.NL;

// ============================================================================
// JURISDICTIONS (NL + DR)
// ============================================================================
const JURISDICTIONS = {
  NL: {
    code: 'NL',
    name: 'Nederland',
    flag: '🇳🇱',
    baseCurrency: 'EUR',
    salesTax: { name: 'BTW', rates: [0, 9, 21], standard: 21 },
    filingPeriod: 'quarterly', // kwartaal
    filingDeadlines: [
      { period: 'Q1', deadline: '30 april', months: [0, 1, 2] },
      { period: 'Q2', deadline: '31 juli', months: [3, 4, 5] },
      { period: 'Q3', deadline: '31 oktober', months: [6, 7, 8] },
      { period: 'Q4', deadline: '31 januari', months: [9, 10, 11] },
    ],
    rules: [
      { label: 'BTW-tarieven', value: '0% / 9% / 21%' },
      { label: 'Standaard tarief', value: '21%' },
      { label: 'Aangiftefrequentie', value: 'Per kwartaal' },
      { label: 'KOR-grens', value: '€ 20.000 omzet/jaar' },
      { label: 'Indientermijn', value: 'Binnen 1 maand na kwartaaleinde' },
      { label: 'Wet bewaarplicht', value: '7 jaar administratie' },
    ],
    rubrieken: {
      '1a': 'Leveringen/diensten 21%',
      '1b': 'Leveringen/diensten 9%',
      '1c': 'Leveringen/diensten 0%',
      '3a': 'Buiten EU (export)',
      '3b': 'Binnen EU (ICP)',
      '5a': 'Verschuldigde BTW',
      '5b': 'Voorbelasting (input)',
      '5c': 'Saldo (af te dragen)',
    },
  },
  DR: {
    code: 'DR',
    name: 'República Dominicana',
    flag: '🇩🇴',
    baseCurrency: 'DOP',
    salesTax: { name: 'ITBIS', rates: [0, 16, 18], standard: 18 },
    filingPeriod: 'monthly', // mensual
    filingDeadlines: [
      { period: 'Mensual', deadline: 'Voor de 20e van de volgende maand', months: 'all' },
    ],
    rules: [
      { label: 'ITBIS tarief', value: '18% (standaard)' },
      { label: 'Verlaagd tarief', value: '16% (bepaalde goederen)' },
      { label: 'Aangiftefrequentie', value: 'Maandelijks (Form IT-1)' },
      { label: 'ISR (vennootschap)', value: '27% over winst' },
      { label: 'Anticipos ISR', value: 'Maandelijks 1,5% omzet' },
      { label: 'Bewaarplicht', value: '10 jaar (DGII)' },
      { label: 'RNC verplicht', value: 'Op iedere factuur' },
      { label: 'NCF (factuurnummer)', value: 'Voorafgaande autorisatie DGII' },
    ],
    rubrieken: {
      'ventas_18': 'Ventas gravadas 18%',
      'ventas_16': 'Ventas gravadas 16%',
      'ventas_0': 'Ventas exentas 0%',
      'itbis_facturado': 'ITBIS facturado',
      'itbis_adelantado': 'ITBIS adelantado',
      'saldo': 'Saldo a pagar/favor',
    },
  },
  UAE: {
    code: 'UAE',
    name: 'Dubai / VAE',
    flag: '🇦🇪',
    baseCurrency: 'AED',
    salesTax: { name: 'VAT', rates: [0, 5], standard: 5 },
    filingPeriod: 'quarterly',
    filingDeadlines: [
      { period: 'Q1', deadline: '28 april', months: [0, 1, 2] },
      { period: 'Q2', deadline: '28 juli', months: [3, 4, 5] },
      { period: 'Q3', deadline: '28 oktober', months: [6, 7, 8] },
      { period: 'Q4', deadline: '28 januari', months: [9, 10, 11] },
    ],
    rules: [
      { label: 'VAT tarief', value: '5% (standaard)' },
      { label: 'Vrije zone', value: '0% voor aangewezen vrije zones' },
      { label: 'Aangiftefrequentie', value: 'Per kwartaal' },
      { label: 'Registratiegrens', value: 'AED 375.000 omzet/jaar' },
      { label: 'Indientermijn', value: '28 dagen na kwartaaleinde' },
      { label: 'Bewaarplicht', value: '5 jaar' },
    ],
    rubrieken: {
      'std_5': 'Belastbare leveringen 5%',
      'zero_rated': 'Nultarief leveringen 0%',
      'exempt': 'Vrijgestelde leveringen',
      'input_vat': 'Voorbelasting (input VAT)',
      'output_vat': 'Verschuldigde VAT',
      'saldo': 'Saldo te betalen/terug',
    },
  },
  ID: {
    code: 'ID',
    name: 'Indonesië',
    flag: '🇮🇩',
    baseCurrency: 'IDR',
    salesTax: { name: 'PPN', rates: [0, 11], standard: 11 },
    filingPeriod: 'monthly',
    filingDeadlines: [
      { period: 'Maandelijks', deadline: 'Voor de 31e van de volgende maand', months: 'all' },
    ],
    rules: [
      { label: 'PPN tarief', value: '11% (standaard)' },
      { label: 'Vrijgesteld', value: '0% voor export, bepaalde goederen' },
      { label: 'Aangiftefrequentie', value: 'Maandelijks (SPT Masa PPN)' },
      { label: 'PPh (vennootschap)', value: '22% over winst' },
      { label: 'Registratiegrens', value: 'IDR 4,8 miljard omzet/jaar' },
      { label: 'Bewaarplicht', value: '10 jaar' },
      { label: 'NPWP', value: 'Belastingnummer verplicht op factuur' },
    ],
    rubrieken: {
      'ppn_11': 'PPN belastbaar 11%',
      'ppn_0': 'PPN 0% (export)',
      'ppn_bebas': 'Vrijgesteld PPN',
      'ppn_keluaran': 'PPN keluaran (output)',
      'ppn_masukan': 'PPN masukan (input)',
      'saldo': 'Saldo kurang/lebih bayar',
    },
  },
  TH: {
    code: 'TH',
    name: 'Thailand',
    flag: '🇹🇭',
    baseCurrency: 'THB',
    salesTax: { name: 'VAT', rates: [0, 7], standard: 7 },
    filingPeriod: 'monthly',
    filingDeadlines: [
      { period: 'Maandelijks', deadline: 'Voor de 15e van de volgende maand (PP.30)', months: 'all' },
    ],
    rules: [
      { label: 'VAT tarief', value: '7% (verlaagd tarief, verlengd)' },
      { label: 'Normaal tarief', value: '10% (geldt bij afloop verlenging)' },
      { label: 'Aangiftefrequentie', value: 'Maandelijks (Form PP.30)' },
      { label: 'Registratiegrens', value: 'THB 1,8 miljoen omzet/jaar' },
      { label: 'CIT (vennootschap)', value: '20% over winst' },
      { label: 'Bewaarplicht', value: '5 jaar' },
    ],
    rubrieken: {
      'vat_7': 'Belastbare omzet 7%',
      'vat_0': 'Nultarief (export/diensten)',
      'vat_exempt': 'Vrijgesteld',
      'output_vat': 'Output VAT',
      'input_vat': 'Input VAT',
      'saldo': 'Saldo te betalen/terug',
    },
  },
  US: {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    baseCurrency: 'USD',
    salesTax: { name: 'Sales Tax', rates: [0], standard: 0 },
    filingPeriod: 'quarterly',
    filingDeadlines: [
      { period: 'Q1', deadline: '15 april', months: [0, 1, 2] },
      { period: 'Q2', deadline: '15 juni', months: [3, 4, 5] },
      { period: 'Q3', deadline: '15 september', months: [6, 7, 8] },
      { period: 'Q4', deadline: '15 januari', months: [9, 10, 11] },
    ],
    rules: [
      { label: 'Sales Tax', value: 'Verschilt per staat (0–13%)' },
      { label: 'Federal CIT', value: '21% (vennootschapsbelasting)' },
      { label: 'Aangiftefrequentie', value: 'Kwartaal geschat / jaarlijks' },
      { label: 'Self-employment tax', value: '15,3% (zzp/eenmanszaak)' },
      { label: 'Fiscaal jaar', value: 'Kalender- of boekjaar' },
      { label: 'Bewaarplicht', value: '7 jaar (IRS)' },
      { label: 'EIN', value: 'Verplicht op zakelijke documenten' },
    ],
    rubrieken: {
      'gross_revenue': 'Gross Revenue',
      'cogs': 'Cost of Goods Sold',
      'gross_profit': 'Gross Profit',
      'operating_expenses': 'Operating Expenses',
      'net_income': 'Net Income',
      'estimated_tax': 'Estimated Tax (quarterly)',
    },
  },
  ES: {
    code: 'ES',
    name: 'Spanje',
    flag: '🇪🇸',
    baseCurrency: 'EUR',
    salesTax: { name: 'IVA', rates: [0, 4, 10, 21], standard: 21 },
    filingPeriod: 'quarterly',
    filingDeadlines: [
      { period: 'Q1', deadline: '20 april', months: [0, 1, 2] },
      { period: 'Q2', deadline: '20 juli', months: [3, 4, 5] },
      { period: 'Q3', deadline: '20 oktober', months: [6, 7, 8] },
      { period: 'Q4', deadline: '30 januari', months: [9, 10, 11] },
    ],
    rules: [
      { label: 'IVA standaard', value: '21%' },
      { label: 'IVA verlaagd', value: '10% (voeding, toerisme, bouw)' },
      { label: 'IVA superverlaagd', value: '4% (basisvoedsel, boeken)' },
      { label: 'Aangiftefrequentie', value: 'Kwartaal (Modelo 303)' },
      { label: 'IS (vennootschap)', value: '25% (algemeen)' },
      { label: 'Bewaarplicht', value: '4 jaar' },
      { label: 'NIF/CIF', value: 'Verplicht op iedere factuur' },
    ],
    rubrieken: {
      'ventas_21': 'Ventas IVA 21%',
      'ventas_10': 'Ventas IVA 10%',
      'ventas_4': 'Ventas IVA 4%',
      'ventas_0': 'Ventas exentas / intracomunit.',
      'iva_repercutido': 'IVA repercutido (output)',
      'iva_soportado': 'IVA soportado (input)',
      'saldo': 'Resultado a ingresar/devolver',
    },
  },
  PT: {
    code: 'PT',
    name: 'Portugal',
    flag: '🇵🇹',
    baseCurrency: 'EUR',
    salesTax: { name: 'IVA', rates: [0, 6, 13, 23], standard: 23 },
    filingPeriod: 'quarterly',
    filingDeadlines: [
      { period: 'Q1', deadline: '15 mei', months: [0, 1, 2] },
      { period: 'Q2', deadline: '15 augustus', months: [3, 4, 5] },
      { period: 'Q3', deadline: '15 november', months: [6, 7, 8] },
      { period: 'Q4', deadline: '15 februari', months: [9, 10, 11] },
    ],
    rules: [
      { label: 'IVA standaard', value: '23% (21% Azoren/Madeira)' },
      { label: 'IVA intermediair', value: '13% (bepaalde goederen)' },
      { label: 'IVA verlaagd', value: '6% (voeding, medicijnen)' },
      { label: 'Aangiftefrequentie', value: 'Kwartaal (Declaração Periódica)' },
      { label: 'IRC (vennootschap)', value: '21% + gemeentelijke opslag' },
      { label: 'Bewaarplicht', value: '10 jaar' },
      { label: 'NIF', value: 'Verplicht op iedere factuur' },
    ],
    rubrieken: {
      'vendas_23': 'Vendas IVA 23%',
      'vendas_13': 'Vendas IVA 13%',
      'vendas_6': 'Vendas IVA 6%',
      'vendas_0': 'Isentas / intracomunit.',
      'iva_liquidado': 'IVA liquidado (output)',
      'iva_dedutivel': 'IVA dedutível (input)',
      'saldo': 'IVA a pagar/recuperar',
    },
  },
  BR: {
    code: 'BR',
    name: 'Brazilië',
    flag: '🇧🇷',
    baseCurrency: 'BRL',
    salesTax: { name: 'IVA/CBS', rates: [0, 12, 25], standard: 25 },
    filingPeriod: 'monthly',
    filingDeadlines: [
      { period: 'Maandelijks', deadline: 'Verschilt per belastingsoort', months: 'all' },
    ],
    rules: [
      { label: 'IVA Federal (CBS)', value: 'Nieuw stelsel 2026+' },
      { label: 'IVA Staats (IBS)', value: 'Vervangt ICMS/ISS' },
      { label: 'PIS/COFINS', value: '3,65% (Simples) – 9,25% (Lucro Real)' },
      { label: 'IRPJ (vennootschap)', value: '15% + 10% sur (> R$240k/jaar)' },
      { label: 'CSLL', value: '9% over winst' },
      { label: 'Aangiftefrequentie', value: 'Maandelijks (ECD/SPED)' },
      { label: 'Bewaarplicht', value: '5–10 jaar (per belasting)' },
      { label: 'CNPJ', value: 'Verplicht op iedere nota fiscal' },
    ],
    rubrieken: {
      'receita_bruta': 'Receita bruta',
      'pis_cofins': 'PIS/COFINS afdracht',
      'icms': 'ICMS (staats omzetbel.)',
      'iss': 'ISS (gemeentelijke belasting)',
      'irpj_csll': 'IRPJ + CSLL',
      'saldo': 'Saldo te betalen',
    },
  },
  EE: {
    code: 'EE',
    name: 'Estland',
    flag: '🇪🇪',
    baseCurrency: 'EUR',
    salesTax: { name: 'KM', rates: [0, 9, 22], standard: 22 },
    filingPeriod: 'monthly',
    filingDeadlines: [
      { period: 'Maandelijks', deadline: 'Voor de 20e van de volgende maand', months: 'all' },
    ],
    rules: [
      { label: 'KM standaard', value: '22% (per 1 jan 2024)' },
      { label: 'KM verlaagd', value: '9% (accommodatie, pers, medicijnen)' },
      { label: 'KM vrijgesteld', value: '0% (export, intracommunautair)' },
      { label: 'Aangiftefrequentie', value: 'Maandelijks (Form KMD)' },
      { label: 'Vennootschapsbelasting', value: '0% op ingehouden winst; 22% bij uitkering' },
      { label: 'Registratiegrens', value: '€ 40.000 omzet/jaar' },
      { label: 'Bewaarplicht', value: '7 jaar' },
      { label: 'Registrikood', value: 'Verplicht op iedere factuur' },
    ],
    rubrieken: {
      'myyk_22': 'Belastbare omzet 22%',
      'myyk_9': 'Belastbare omzet 9%',
      'myyk_0': 'Vrijgesteld / export 0%',
      'km_sisend': 'Sisendkäibemaks (input KM)',
      'km_valja': 'Väljundkäibemaks (output KM)',
      'saldo': 'KM saldo te betalen/terug',
    },
  },
  CUSTOM: {
    code: 'CUSTOM',
    name: 'Handmatig instellen',
    flag: '⚙️',
    baseCurrency: 'EUR',
    salesTax: { name: 'Belasting', rates: [0, 21], standard: 21 },
    filingPeriod: 'quarterly',
    filingDeadlines: [
      { period: 'Handmatig', deadline: 'Zelf in te stellen', months: 'all' },
    ],
    rules: [
      { label: 'Ingesteld door', value: 'Gebruiker' },
    ],
    rubrieken: {
      'omzet': 'Omzet',
      'belasting': 'Belasting',
      'saldo': 'Saldo',
    },
  },
};

// ============================================================================
// CHART OF ACCOUNTS (Grootboekrekeningen / Cuentas)
// ============================================================================
const LEDGER_ACCOUNTS_NL = [
  { code: '4000', name: 'Inkoopkosten / kostprijs', group: 'Inkoop' },
  { code: '4100', name: 'Personeelskosten', group: 'Personeel' },
  { code: '4200', name: 'Huisvestingskosten', group: 'Huisvesting' },
  { code: '4400', name: 'Software & abonnementen', group: 'Automatisering', highlight: true },
  { code: '4410', name: 'Hosting & infrastructuur', group: 'Automatisering', highlight: true },
  { code: '4420', name: 'Data, AI & API-diensten', group: 'Automatisering', highlight: true },
  { code: '4430', name: 'Domeinen & SSL', group: 'Automatisering' },
  { code: '4500', name: 'Kantoorbenodigdheden', group: 'Kantoor' },
  { code: '4510', name: 'Hardware (< €450)', group: 'Kantoor' },
  { code: '4600', name: 'Reis- & verblijfkosten', group: 'Reizen' },
  { code: '4630', name: 'Representatiekosten', group: 'Relatie' },
  { code: '4640', name: 'Studie & opleiding', group: 'Ontwikkeling' },
  { code: '4700', name: 'Bankkosten & financieel', group: 'Financieel' },
  { code: '4710', name: 'Valutaverschillen', group: 'Financieel' },
  { code: '4800', name: 'Marketing & advertenties', group: 'Marketing' },
  { code: '4810', name: 'Uitbesteed werk / freelancers', group: 'Diensten' },
  { code: '4820', name: 'Accountant & advies', group: 'Diensten' },
  { code: '4900', name: 'Algemene kosten / overig', group: 'Overig' },
];

const LEDGER_ACCOUNTS_DR = [
  { code: '6001', name: 'Servicios tecnológicos (SaaS, software)', group: 'Tecnología', highlight: true },
  { code: '6002', name: 'Hosting e infraestructura', group: 'Tecnología', highlight: true },
  { code: '6003', name: 'Servicios de datos y AI', group: 'Tecnología', highlight: true },
  { code: '6010', name: 'Suministros de oficina', group: 'Oficina' },
  { code: '6011', name: 'Equipos y hardware', group: 'Oficina' },
  { code: '6020', name: 'Transporte y viajes', group: 'Viajes' },
  { code: '6021', name: 'Alojamiento', group: 'Viajes' },
  { code: '6030', name: 'Representación y atenciones', group: 'Relaciones' },
  { code: '6040', name: 'Capacitación', group: 'Desarrollo' },
  { code: '6050', name: 'Comisiones bancarias', group: 'Financiero' },
  { code: '6051', name: 'Diferencias de cambio', group: 'Financiero' },
  { code: '6060', name: 'Mercadeo y publicidad', group: 'Marketing' },
  { code: '6070', name: 'Servicios profesionales (freelance)', group: 'Servicios' },
  { code: '6071', name: 'Contador y asesoría legal', group: 'Servicios' },
  { code: '6090', name: 'Gastos generales / otros', group: 'Otros' },
];

// ============================================================================
// VENDOR → LEDGER ACCOUNT AUTO-SUGGESTION
// Patterns are lowercase, matched as "contains". First match wins.
// ============================================================================
const VENDOR_RULES = [
  // AI / API services
  { patterns: ['anthropic', 'claude'], nl: '4420', dr: '6003', category: 'Software/SaaS', note: 'Claude API / Claude Code' },
  { patterns: ['openai', 'chatgpt'], nl: '4420', dr: '6003', category: 'Software/SaaS', note: 'OpenAI API' },
  { patterns: ['perplexity'], nl: '4420', dr: '6003', category: 'Software/SaaS' },
  { patterns: ['replicate', 'huggingface', 'hugging face'], nl: '4420', dr: '6003', category: 'Software/SaaS' },

  // Dev tools
  { patterns: ['cursor.com', 'cursor ai', 'cursor sh'], nl: '4400', dr: '6001', category: 'Software/SaaS', note: 'Cursor IDE' },
  { patterns: ['github', 'gitlab', 'bitbucket'], nl: '4400', dr: '6001', category: 'Software/SaaS' },
  { patterns: ['vercel'], nl: '4410', dr: '6002', category: 'Hosting & Infra' },
  { patterns: ['netlify'], nl: '4410', dr: '6002', category: 'Hosting & Infra' },
  { patterns: ['supabase'], nl: '4410', dr: '6002', category: 'Hosting & Infra' },
  { patterns: ['cloudflare'], nl: '4410', dr: '6002', category: 'Hosting & Infra' },
  { patterns: ['aws', 'amazon web', 'lambda'], nl: '4410', dr: '6002', category: 'Hosting & Infra' },
  { patterns: ['digitalocean', 'digital ocean'], nl: '4410', dr: '6002', category: 'Hosting & Infra' },
  { patterns: ['render.com', 'fly.io', 'railway'], nl: '4410', dr: '6002', category: 'Hosting & Infra' },

  // Automation
  { patterns: ['make.com', 'integromat'], nl: '4400', dr: '6001', category: 'Software/SaaS' },
  { patterns: ['zapier'], nl: '4400', dr: '6001', category: 'Software/SaaS' },
  { patterns: ['n8n'], nl: '4400', dr: '6001', category: 'Software/SaaS' },

  // Scraping / data
  { patterns: ['apify'], nl: '4420', dr: '6003', category: 'Software/SaaS', note: 'Scraping diensten' },
  { patterns: ['scrapingbee', 'scraperapi', 'bright data', 'oxylabs', 'smartproxy'], nl: '4420', dr: '6003', category: 'Software/SaaS' },
  { patterns: ['clay.com', 'clay run'], nl: '4420', dr: '6003', category: 'Software/SaaS' },

  // Email infra
  { patterns: ['ahasend', 'mailgun', 'sendgrid', 'postmark', 'resend.com', 'amazon ses'], nl: '4410', dr: '6002', category: 'Hosting & Infra' },
  { patterns: ['smartlead'], nl: '4400', dr: '6001', category: 'Software/SaaS' },

  // Productivity
  { patterns: ['notion'], nl: '4400', dr: '6001', category: 'Software/SaaS' },
  { patterns: ['linear.app', 'linear'], nl: '4400', dr: '6001', category: 'Software/SaaS' },
  { patterns: ['slack'], nl: '4400', dr: '6001', category: 'Software/SaaS' },
  { patterns: ['discord'], nl: '4400', dr: '6001', category: 'Software/SaaS' },
  { patterns: ['zoom'], nl: '4400', dr: '6001', category: 'Software/SaaS' },
  { patterns: ['loom'], nl: '4400', dr: '6001', category: 'Software/SaaS' },
  { patterns: ['google workspace', 'gsuite', 'google.com'], nl: '4400', dr: '6001', category: 'Software/SaaS' },
  { patterns: ['microsoft 365', 'office 365', 'microsoft'], nl: '4400', dr: '6001', category: 'Software/SaaS' },

  // Design
  { patterns: ['figma'], nl: '4400', dr: '6001', category: 'Software/SaaS' },
  { patterns: ['adobe', 'creative cloud'], nl: '4400', dr: '6001', category: 'Software/SaaS' },

  // Domains
  { patterns: ['namecheap', 'godaddy', 'porkbun', 'gandi'], nl: '4430', dr: '6002', category: 'Hosting & Infra' },

  // Travel
  { patterns: ['uber', 'lyft', 'bolt.eu', 'taxi'], nl: '4600', dr: '6020', category: 'Reiskosten' },
  { patterns: ['booking.com', 'airbnb', 'expedia', 'agoda'], nl: '4600', dr: '6021', category: 'Reiskosten' },
  { patterns: ['klm', 'transavia', 'tui fly', 'ryanair', 'easyjet', 'lufthansa', 'air europa', 'jetblue', 'arajet'], nl: '4600', dr: '6020', category: 'Reiskosten' },

  // Banking
  { patterns: ['revolut'], nl: '4700', dr: '6050', category: 'Professionele diensten' },
  { patterns: ['wise.com', 'wise transfer'], nl: '4700', dr: '6050', category: 'Professionele diensten' },
  { patterns: ['payoneer'], nl: '4700', dr: '6050', category: 'Professionele diensten' },
  { patterns: ['stripe'], nl: '4700', dr: '6050', category: 'Professionele diensten' },
  { patterns: ['paypal'], nl: '4700', dr: '6050', category: 'Professionele diensten' },

  // Marketing
  { patterns: ['google ads', 'meta ads', 'facebook ads', 'linkedin ads', 'twitter ads'], nl: '4800', dr: '6060', category: 'Marketing' },

  // Food / representation
  { patterns: ['restaurant', 'café', 'cafe ', 'lunchroom', 'starbucks', 'mcdonald'], nl: '4630', dr: '6030', category: 'Eten & Drinken' },

  // Office / hardware
  { patterns: ['mediamarkt', 'coolblue', 'bol.com', 'amazon.', 'apple.com', 'apple store'], nl: '4510', dr: '6011', category: 'Hardware' },

  // Accountant
  { patterns: ['accountant', 'boekhouder', 'contador'], nl: '4820', dr: '6071', category: 'Professionele diensten' },
];

const getLedgerAccounts = (jurisdiction) => jurisdiction === 'DR' ? LEDGER_ACCOUNTS_DR : LEDGER_ACCOUNTS_NL;

const suggestLedgerAccount = (vendorName, jurisdiction) => {
  if (!vendorName) return null;
  const name = vendorName.toLowerCase();
  for (const rule of VENDOR_RULES) {
    if (rule.patterns.some(p => name.includes(p))) {
      return {
        code: jurisdiction === 'DR' ? rule.dr : rule.nl,
        category: rule.category,
        note: rule.note,
        matched: rule.patterns.find(p => name.includes(p)),
      };
    }
  }
  return null;
};

// ============================================================================
// CURRENCY CONVERSION
// Uses open.er-api.com — free, no API key, daily ECB-based rates.
// ============================================================================
const SUPPORTED_CURRENCIES = [
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'DOP', symbol: 'RD$', name: 'Peso Dominicano' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'Dirham (UAE)' },
  { code: 'IDR', symbol: 'Rp', name: 'Rupiah (Indonesië)' },
  { code: 'THB', symbol: '฿', name: 'Baht (Thailand)' },
  { code: 'BRL', symbol: 'R$', name: 'Real (Brazilië)' },
  { code: 'CHF', symbol: 'Fr.', name: 'Zwitserse Frank' },
];

const fetchExchangeRates = async (base = 'EUR') => {
  const response = await fetch(`https://open.er-api.com/v6/latest/${base}`);
  if (!response.ok) throw new Error(`Rate fetch failed: ${response.status}`);
  const data = await response.json();
  if (data.result !== 'success') throw new Error('Rate API returned error');
  return { base: data.base_code, rates: data.rates, fetched: new Date().toISOString() };
};

const convertCurrency = (amount, fromCurrency, toCurrency, ratesObj) => {
  if (!ratesObj || !ratesObj.rates) return null;
  if (fromCurrency === toCurrency) return { amount: Number(amount), rate: 1 };
  const baseCode = ratesObj.base;
  let rate;
  if (fromCurrency === baseCode) {
    rate = ratesObj.rates[toCurrency];
  } else if (toCurrency === baseCode) {
    const fromRate = ratesObj.rates[fromCurrency];
    if (!fromRate) return null;
    rate = 1 / fromRate;
  } else {
    const fromRate = ratesObj.rates[fromCurrency];
    const toRate = ratesObj.rates[toCurrency];
    if (!fromRate || !toRate) return null;
    rate = toRate / fromRate;
  }
  if (!rate) return null;
  return { amount: +(Number(amount) * rate).toFixed(2), rate: +rate.toFixed(6) };
};

const fmtCurrency = (amount, currency = 'EUR') => {
  const meta = SUPPORTED_CURRENCIES.find(c => c.code === currency) || { symbol: currency };
  const num = Number(amount || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${meta.symbol} ${num}`;
};

// ── Invoice translations (NL / EN / ES / DE) ─────────────────────────────────
const INVOICE_TRANSLATIONS = {
  nl: {
    invoice: 'Factuur', invoiceTo: 'Factuur aan', invoiceDetails: 'Factuurdetails',
    details: 'Gegevens', date: 'Datum', due: 'Vervalt',
    invoiceDate: 'Factuurdatum', dueDate: 'Vervaldatum', reference: 'Referentie',
    ref: 'Ref', total: 'Totaal', invoiceNumber: 'Factuurnummer',
    inclTax: (tax) => `incl. ${tax}`,
    description: 'Omschrijving', qty: 'Aantal', unitPrice: 'Stukprijs', amount: 'Bedrag',
    discount: 'korting', subtotalBeforeDiscount: 'Subtotaal (voor korting)',
    totalDiscount: 'Totale korting', subtotalExcl: (tax) => `Subtotaal (excl. ${tax})`,
    totalDue: 'Totaal te betalen', notes: 'Opmerkingen',
    bankDetails: 'Bankgegevens', payableTo: 't.n.v.',
    companyDetails: 'Bedrijfsgegevens', regNumber: (jur) => jur === 'NL' ? 'KvK' : 'RNC',
    signature: 'Handtekening', scanQr: 'Scan met uw bank-app\nom direct te betalen',
    tradingNameOf: (a, b) => `${a} is een handelsnaam van ${b}.`, attn: 'T.a.v.',
    creditNote: 'Creditnota', creditNoteNumber: 'Creditnotanummer',
    creditNoteFor: (nr, date) => `Creditnota voor factuur ${nr}${date ? ` d.d. ${date}` : ''}`,
    deliveryDate: 'Leverdatum', period: 'Periode',
    reverseCharge: 'BTW verlegd — art. 196 BTW-richtlijn / VAT reverse charged',
    outsideEu: 'Niet belast in Nederland (dienst buiten de EU)',
    clientVatId: 'BTW-id afnemer', vatInEur: (tax) => `${tax} in EUR`, exchangeRate: 'Koers',
  },
  en: {
    invoice: 'Invoice', invoiceTo: 'Invoice to', invoiceDetails: 'Invoice details',
    details: 'Details', date: 'Date', due: 'Due',
    invoiceDate: 'Invoice date', dueDate: 'Due date', reference: 'Reference',
    ref: 'Ref', total: 'Total', invoiceNumber: 'Invoice number',
    inclTax: (tax) => `incl. ${tax}`,
    description: 'Description', qty: 'Qty', unitPrice: 'Unit price', amount: 'Amount',
    discount: 'discount', subtotalBeforeDiscount: 'Subtotal (before discount)',
    totalDiscount: 'Total discount', subtotalExcl: (tax) => `Subtotal (excl. ${tax})`,
    totalDue: 'Total due', notes: 'Notes',
    bankDetails: 'Bank details', payableTo: 'payable to',
    companyDetails: 'Company details', regNumber: (jur) => jur === 'DR' ? 'RNC' : 'Chamber of Commerce',
    signature: 'Signature', scanQr: 'Scan with your banking app\nto pay directly',
    tradingNameOf: (a, b) => `${a} is a trading name of ${b}.`, attn: 'Attn:',
    creditNote: 'Credit note', creditNoteNumber: 'Credit note number',
    creditNoteFor: (nr, date) => `Credit note for invoice ${nr}${date ? ` dated ${date}` : ''}`,
    deliveryDate: 'Delivery date', period: 'Period',
    reverseCharge: 'VAT reverse charged — Art. 196 VAT Directive 2006/112/EC',
    outsideEu: 'Not subject to Dutch VAT (service outside the EU)',
    clientVatId: 'Customer VAT ID', vatInEur: (tax) => `${tax} in EUR`, exchangeRate: 'Rate',
  },
  es: {
    invoice: 'Factura', invoiceTo: 'Factura a', invoiceDetails: 'Detalles de factura',
    details: 'Detalles', date: 'Fecha', due: 'Vence',
    invoiceDate: 'Fecha de emisión', dueDate: 'Fecha de vencimiento', reference: 'Referencia',
    ref: 'Ref', total: 'Total', invoiceNumber: 'Número de factura',
    inclTax: (tax) => `incl. ${tax}`,
    description: 'Descripción', qty: 'Cant.', unitPrice: 'Precio unit.', amount: 'Importe',
    discount: 'descuento', subtotalBeforeDiscount: 'Subtotal (antes del dto.)',
    totalDiscount: 'Descuento total', subtotalExcl: (tax) => `Subtotal (excl. ${tax})`,
    totalDue: 'Total a pagar', notes: 'Notas',
    bankDetails: 'Datos bancarios', payableTo: 'a nombre de',
    companyDetails: 'Datos de la empresa', regNumber: (jur) => jur === 'DR' ? 'RNC' : 'Registro Mercantil',
    signature: 'Firma', scanQr: 'Escanee con su app bancaria\npara pagar directamente',
    tradingNameOf: (a, b) => `${a} es nombre comercial de ${b}.`, attn: 'A/A:',
    creditNote: 'Factura rectificativa', creditNoteNumber: 'Número de rectificativa',
    creditNoteFor: (nr, date) => `Rectificativa de la factura ${nr}${date ? ` de fecha ${date}` : ''}`,
    deliveryDate: 'Fecha de entrega', period: 'Periodo',
    reverseCharge: 'Inversión del sujeto pasivo — art. 196 Directiva IVA / VAT reverse charged',
    outsideEu: 'No sujeto a IVA neerlandés (servicio fuera de la UE)',
    clientVatId: 'NIF-IVA cliente', vatInEur: (tax) => `${tax} en EUR`, exchangeRate: 'Tipo de cambio',
  },
  de: {
    invoice: 'Rechnung', invoiceTo: 'Rechnung an', invoiceDetails: 'Rechnungsdetails',
    details: 'Details', date: 'Datum', due: 'Fällig',
    invoiceDate: 'Rechnungsdatum', dueDate: 'Fälligkeitsdatum', reference: 'Referenz',
    ref: 'Ref', total: 'Gesamt', invoiceNumber: 'Rechnungsnummer',
    inclTax: (tax) => `inkl. ${tax}`,
    description: 'Beschreibung', qty: 'Anz.', unitPrice: 'Stückpreis', amount: 'Betrag',
    discount: 'Rabatt', subtotalBeforeDiscount: 'Zwischensumme (vor Rabatt)',
    totalDiscount: 'Gesamtrabatt', subtotalExcl: (tax) => `Zwischensumme (excl. ${tax})`,
    totalDue: 'Gesamtbetrag', notes: 'Hinweise',
    bankDetails: 'Bankverbindung', payableTo: 'für',
    companyDetails: 'Firmendaten', regNumber: () => 'Handelsregister',
    signature: 'Unterschrift', scanQr: 'Scannen Sie mit Ihrer Banking-App\num direkt zu bezahlen',
    tradingNameOf: (a, b) => `${a} ist ein Handelsname von ${b}.`, attn: 'z.H.',
    creditNote: 'Gutschrift', creditNoteNumber: 'Gutschriftnummer',
    creditNoteFor: (nr, date) => `Gutschrift zur Rechnung ${nr}${date ? ` vom ${date}` : ''}`,
    deliveryDate: 'Leistungsdatum', period: 'Leistungszeitraum',
    reverseCharge: 'Steuerschuldnerschaft des Leistungsempfängers — Art. 196 MwSt-Richtlinie / VAT reverse charged',
    outsideEu: 'Nicht in den Niederlanden steuerbar (Leistung außerhalb der EU)',
    clientVatId: 'USt-IdNr. Kunde', vatInEur: (tax) => `${tax} in EUR`, exchangeRate: 'Kurs',
  },
};
// Met `invoice` erbij krijgt een creditnota automatisch de titel "Creditnota" i.p.v. "Factuur".
const getInvoiceT = (lang, invoice) => {
  const base = INVOICE_TRANSLATIONS[lang] || INVOICE_TRANSLATIONS.nl;
  if (!isCreditNote(invoice)) return base;
  return { ...base, invoice: base.creditNote, invoiceNumber: base.creditNoteNumber };
};
const isCreditNote = (inv) => !!inv && (inv.status === 'credit_note' || !!inv.creditNoteFor);
// Nummer zoals de klant het kreeg (intern achtervoegsel bij oude dubbele nummers)
const displayInvoiceNumber = (inv) => inv?.numberAsSent || inv?.number || '';
// BTW-behandeling van deze factuur: opgeslagen waarde, anders afgeleid uit de klant
const invoiceVatTreatment = (invoice, client) => invoice?.vatTreatment || deriveInvoiceVatTreatment(client);
const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Bedrag-invoer: accepteert komma als decimaalteken ("12,50" → 12.5)
const parseDecimal = (v) => {
  if (typeof v === 'number') return v;
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// ============================================================================
// ENTITY TYPES (Bedrijfsvormen)
// ============================================================================
const ENTITY_TYPES = [
  { id: 'holding', label: 'Holding', icon: '🏛️', description: 'Houdstermaatschappij — bezit aandelen in dochters' },
  { id: 'operating', label: 'Werkmaatschappij', icon: '⚙️', description: 'Operationeel bedrijf — facturen, klanten, omzet' },
  { id: 'subsidiary', label: 'Dochteronderneming', icon: '🌿', description: 'Dochterbedrijf onder een holding' },
  { id: 'personal', label: 'Eenmanszaak', icon: '👤', description: 'ZZP / sole proprietor' },
  { id: 'label', label: 'Label / Handelsnaam', icon: '🏷️', description: 'Sub-brand — eigen naam en logo, erft KVK/BTW/IBAN van parent bedrijf. Verschijnt op facturen als "X is een handelsnaam van Y".' },
];

const getEntityType = (id) => ENTITY_TYPES.find(t => t.id === id) || ENTITY_TYPES[1];

// ============================================================================
// INVOICE TEMPLATES (4 stijlen)
// ============================================================================
const INVOICE_TEMPLATES = [
  {
    id: 'classic',
    name: 'Executive',
    description: 'Letterhead stijl — klassiek zakelijk, hairline rules, precisie typografie',
    preview: { logoPos: 'top-left', accent: 'subtle' },
  },
  {
    id: 'modern',
    name: 'Studio',
    description: 'Full-bleed header — modern, agency/SaaS, krachtig merkgevoel',
    preview: { logoPos: 'header', accent: 'bold-header' },
  },
  {
    id: 'minimal',
    name: 'Atelier',
    description: 'Luxe minimalistisch — maximale witruimte, elegant, consultant stijl',
    preview: { logoPos: 'centered', accent: 'minimal' },
  },
  {
    id: 'statement',
    name: 'Signature',
    description: 'Gekleurde zijbalk — luxury consultancy, hoge merkidentiteit',
    preview: { logoPos: 'sidebar', accent: 'left-bar' },
  },
  {
    id: 'nordic',
    name: 'Nomad',
    description: 'Minimalistisch & luchtig — lijn rechts, info-strip, voor freelancers',
    preview: { logoPos: 'top-left', accent: 'stripe-right' },
  },
  {
    id: 'bold',
    name: 'Canvas',
    description: 'Creatieve studio — brede naam als masthead, dikte-accent lijn',
    preview: { logoPos: 'top-left', accent: 'underline' },
  },
  {
    id: 'horizon',
    name: 'Dusk',
    description: 'Gespleten header — bedrijf links wit, factuurdetails rechts in kleur',
    preview: { logoPos: 'split', accent: 'half-header' },
  },
  {
    id: 'split',
    name: 'Folio',
    description: 'Warm tweedelig — linker paneel met accentrand, portfolio-gevoel',
    preview: { logoPos: 'left-panel', accent: 'left-border' },
  },
  {
    id: 'bloom',
    name: 'Bloom',
    description: 'Romantisch & elegant — bruiloft, beauty & événement stijl',
    preview: { logoPos: 'centered', accent: 'thin-top' },
  },
  {
    id: 'velvet',
    name: 'Velvet',
    description: 'Luxe donkere kop — high-end makeup & beauty studio stijl',
    preview: { logoPos: 'header-left', accent: 'dark-header' },
  },
];

// ============================================================================
// AI HELPER — supports both Anthropic (sk-ant-...) and OpenAI (sk-...)
// Priority: VITE_ANTHROPIC_API_KEY / VITE_OPENAI_API_KEY env var → settings key (fallback)
// ============================================================================

// Detect provider from key format
const detectProvider = (key) => {
  if (!key) return null;
  if (key.startsWith('sk-ant-') || key.startsWith('sk-ant_')) return 'anthropic';
  if (key.startsWith('sk-')) return 'openai';
  return 'anthropic'; // default
};

// Resolve best available key: env vars first, then settings
const resolveApiKey = (settingsAnthropicKey, settingsOpenAIKey) => {
  // Env vars take priority
  if (import.meta.env.VITE_ANTHROPIC_API_KEY) return import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (import.meta.env.VITE_OPENAI_API_KEY) return import.meta.env.VITE_OPENAI_API_KEY;
  // Settings keys: Anthropic preferred over OpenAI
  if (settingsAnthropicKey) return settingsAnthropicKey;
  if (settingsOpenAIKey) return settingsOpenAIKey;
  return null;
};

// Universal AI text call — routes to Anthropic or OpenAI based on key prefix
const callAI = async ({ system, prompt, messages, apiKey, openaiApiKey, maxTokens = 2000 }) => {
  const key = resolveApiKey(apiKey, openaiApiKey);
  if (!key) throw new Error('Geen AI API key ingesteld. Vul een Anthropic of OpenAI key in via Instellingen → AI.');
  const provider = detectProvider(key);

  if (provider === 'openai') {
    const msgs = [];
    if (system) msgs.push({ role: 'system', content: system });
    if (messages) msgs.push(...messages);
    else msgs.push({ role: 'user', content: prompt });
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: maxTokens, messages: msgs }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errText.slice(0, 200)}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  // Anthropic
  const anthropicMessages = messages || [{ role: 'user', content: prompt }];
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: maxTokens,
      system,
      messages: anthropicMessages,
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.content?.find(b => b.type === 'text')?.text || '';
};

// Backward compat alias
const callClaude = ({ system, prompt, apiKey, maxTokens = 2000 }) =>
  callAI({ system, prompt, apiKey, maxTokens });

// Vision API — scant bon/factuur (foto of PDF) en retourneert gestructureerde data
const callClaudeVision = async ({ imageDataUrl, apiKey, openaiApiKey, jurisdiction = 'NL', ledgerAccounts = [] }) => {
  const resolvedKey = resolveApiKey(apiKey, openaiApiKey);
  if (!resolvedKey) throw new Error('Geen AI-sleutel gevonden. Stel je AI-sleutel in via Instellingen → AI (wordt dan op al je apparaten gebruikt).');
  if (!imageDataUrl || !imageDataUrl.startsWith('data:')) throw new Error('Geen bon gevonden om te scannen.');
  const base64 = imageDataUrl.split(',')[1];
  const mediaType = imageDataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
  const isPdf = mediaType === 'application/pdf';
  const provider = detectProvider(resolvedKey);
  if (isPdf && provider === 'openai') {
    throw new Error('PDF scannen kan alleen met een Anthropic-sleutel (sk-ant-…). Voeg die toe via Instellingen → AI, of upload een foto/JPG van de bon.');
  }
  const taxRates = jurisdiction === 'NL' ? '0, 9 or 21' : jurisdiction === 'EE' ? '0, 9 or 22' : '0, 16 or 18';
  const taxName = jurisdiction === 'NL' ? 'BTW/VAT' : jurisdiction === 'EE' ? 'KM/VAT' : 'ITBIS';
  const deductibilityContext = jurisdiction === 'NL'
    ? `NL deductibility rules: Software/SaaS always deductible. Hardware >€450 must be depreciated. Clothing only if it has a company logo. Meals/entertainment: max 80% deductible. Home office: complex, usually not. Travel: fully deductible. Training: fully deductible.`
    : jurisdiction === 'DR'
    ? `DR (Dominican Republic) deductibility rules: Very lenient. Clothing deductible even without logo (if used for work). Meals and restaurant visits largely deductible. Fuel/transport fully deductible. Software/subscriptions fully deductible. Generally: if it helps the business, it is deductible (Gastos necesarios para producir renta).`
    : jurisdiction === 'EE'
    ? `Estonia OÜ deductibility rules: Business expenses fully deductible. Mixed personal/business expenses need documentation. Meals deductible with business purpose. Travel fully deductible. Home office deductible with proper documentation. No clothing rule — if for business use, deductible.`
    : `General: business expenses necessary for generating revenue are deductible.`;
  // Grootboekrekeningen meesturen zodat de AI er één kiest die in de app bestaat
  const ledgerList = ledgerAccounts.map(a => `${a.code} ${a.name}`).join('\n');

  const prompt = `You are an expert receipt/invoice data extractor AND tax advisor for ${jurisdiction}. Analyze this receipt or invoice ${isPdf ? 'document' : 'image'} carefully.

Return ONLY a valid JSON object with exactly these fields (no markdown, no explanation):
{
  "vendor": "company or store name as printed",
  "vendor_country": "ISO 3166 alpha-2 country of the vendor, or empty string",
  "date": "YYYY-MM-DD format, or empty string if unclear",
  "total_incl_tax": 0.00,
  "tax_amount": 0.00,
  "tax_rate": 0,
  "vat_country": "ISO 3166 alpha-2 country whose VAT is charged on this receipt, or empty string if no VAT is charged",
  "currency": "ISO 4217 code",
  "ledger_code": "code from the ledger list below",
  "deductible": true,
  "deductible_pct": 100,
  "deductible_risk": "safe",
  "deductible_note": "one sentence in Dutch explaining if/why this is deductible",
  "deductible_description": "exact Dutch bookkeeping description to write on this expense"
}

Rules:
- "total_incl_tax": final amount INCLUDING tax. If only excl shown, add the tax.
- "tax_amount": the tax/VAT/${taxName} amount exactly as printed. If only a rate is shown, calculate it. If NO tax is charged (e.g. reverse charge, "VAT 0%", US/non-EU invoice without VAT), use 0 — never invent tax.
- "tax_rate": choose closest from ${taxRates}. If no tax is charged, use 0.
- "vat_country": e.g. "NL" for Dutch BTW, "DE" for German MwSt, "IE" for Irish VAT. Empty string when tax_amount is 0.
- "currency": detect from symbol (€=EUR, $=USD, £=GBP, RD$=DOP, ¥=JPY). Default EUR only if truly unclear.
- "ledger_code": pick the single best matching code from this list (only codes from the list):
${ledgerList || '(no list — use empty string)'}
- All amounts as decimals with period (not comma). Unreadable values: 0 or empty string.
- "deductible": true/false for freelancer/ZZP in ${jurisdiction}.
- "deductible_pct": percentage deductible (100, 80, 75, 50, 30, 0).
- "deductible_risk": "safe" (clear yes), "borderline" (grey area, document well), "risky" (likely rejected), "no" (not deductible).
- "deductible_note": short Dutch explanation of deductibility + any conditions.
- "deductible_description": the EXACT Dutch description to write in bookkeeping, e.g. "Zakelijk diner met [klant] re. [project]" or "Software licentie Figma — zakelijk gebruik". Make it specific, professional, and optimized for tax purposes.

${deductibilityContext}`;

  // Leesbare foutmelding uit de API-respons halen
  const apiError = async (response, label) => {
    const errText = await response.text().catch(() => '');
    let msg = errText.slice(0, 300);
    try { msg = JSON.parse(errText)?.error?.message || msg; } catch { /* geen JSON */ }
    if (response.status === 401) msg = 'AI-sleutel ongeldig of verlopen — controleer hem via Instellingen → AI.';
    return new Error(`${label} (${response.status}): ${msg}`);
  };

  let text = '';
  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resolvedKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 1024,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: imageDataUrl } },
          { type: 'text', text: prompt },
        ]}],
      }),
    });
    if (!response.ok) throw await apiError(response, 'OpenAI-fout');
    const data = await response.json();
    text = data.choices?.[0]?.message?.content || '';
  } else {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': resolvedKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            isPdf
              ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
              : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
    if (!response.ok) throw await apiError(response, 'Anthropic-fout');
    const data = await response.json();
    text = data.content?.find(b => b.type === 'text')?.text || '';
  }

  // Robuuste JSON-extractie: buitenste {...}-blok
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Geen gegevens gevonden in de AI-respons. Probeer een scherpere foto.');
  try {
    return JSON.parse(match[0]);
  } catch {
    throw new Error('AI-respons kon niet worden verwerkt. Probeer opnieuw.');
  }
};

// AI — klantinfo opzoeken via website URL
const callClaudeForClientFromWebsite = async ({ url, apiKey, openaiApiKey }) => {
  if (!resolveApiKey(apiKey, openaiApiKey)) throw new Error('Geen AI API key ingesteld. Vul een key in via Instellingen → AI.');
  let pageText = '';
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
    const json = await res.json();
    pageText = (json.contents || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000);
  } catch {
    pageText = '';
  }
  const system = 'Je bent een expert in het extraheren van bedrijfsinformatie. Retourneer ALLEEN geldig JSON, geen uitleg of markdown.';
  const prompt = `Extraheer bedrijfsinformatie voor: ${url}
${pageText ? `Pagina-inhoud:\n${pageText}` : ''}

Retourneer ALLEEN dit JSON object:
{"name":"","contactName":"","email":"","phone":"","address":"","postal":"","city":"","country":"Nederland","btw":"","kvk":""}

Gebruik lege string "" als een veld niet bekend is.`;
  const raw = await callAI({ system, prompt, apiKey, maxTokens: 400 });
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Geen geldige JSON teruggegeven');
  return JSON.parse(match[0]);
};

// AI — klantinfo uit visitekaartje foto
const callClaudeVisionForCard = async ({ imageDataUrl, apiKey, openaiApiKey }) => {
  const resolvedKey = resolveApiKey(apiKey, openaiApiKey);
  if (!resolvedKey) throw new Error('Geen AI API key ingesteld. Vul een key in via Instellingen → AI.');
  const base64 = imageDataUrl.split(',')[1];
  const mediaType = imageDataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
  const prompt = `Extraheer alle contactinformatie van dit visitekaartje.
Retourneer ALLEEN dit JSON object (geen uitleg):
{"name":"bedrijfsnaam","contactName":"naam persoon","email":"","phone":"","address":"","postal":"","city":"","country":"Nederland","btw":"","kvk":""}
Gebruik lege string "" als een veld niet zichtbaar is.`;
  const provider = detectProvider(resolvedKey);
  let raw = '';
  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resolvedKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini', max_tokens: 400,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: imageDataUrl } },
          { type: 'text', text: prompt },
        ]}],
      }),
    });
    if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);
    const data = await response.json();
    raw = data.choices?.[0]?.message?.content || '';
  } else {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': resolvedKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 400,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt },
        ]}],
      }),
    });
    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    raw = data.content?.find(b => b.type === 'text')?.text || '';
  }
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Geen geldige JSON teruggegeven');
  return JSON.parse(match[0]);
};

// AI — factuurregels uit screenshot (bv. Excel-overzicht van uren/opdrachten)
const callClaudeVisionForInvoiceLines = async ({ imageDataUrl, apiKey, openaiApiKey, clientNames = [] }) => {
  const resolvedKey = resolveApiKey(apiKey, openaiApiKey);
  if (!resolvedKey) throw new Error('Geen AI API key ingesteld. Vul een Anthropic of OpenAI key in via Instellingen → AI.');
  const base64 = imageDataUrl.split(',')[1];
  const mediaType = imageDataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
  const prompt = `Dit is een screenshot van een urenoverzicht/werkstaat (bv. uit Excel), met kolommen zoals Datum, Opdracht/omschrijving, Client, Aantal uren, Uurtarief en/of Prijs.

Extraheer elke rij als een factuurregel. Retourneer ALLEEN dit JSON object, geen uitleg of markdown:
{
  "client": "meest voorkomende klantnaam in het overzicht, of leeg string",
  "items": [
    { "description": "korte omschrijving incl. datum, bv. '01-06-2026 — CP2 campagne verbeteringen'", "quantity": 2, "price": 35 }
  ]
}

Regels:
- Negeer lege rijen, kopregels en totaalregels.
- "quantity" = aantal uren (of aantal stuks als er geen uren zijn).
- "price" = prijs PER EENHEID (bv. uurtarief), NIET de regeltotaal. Als alleen een totaalbedrag zichtbaar is en géén uurtarief, bereken price = totaal / aantal.
- Gebruik punt als decimaalteken, geen duizendtalscheiding.
- Als er meerdere klanten in het overzicht staan, vul "client" met de klant die het vaakst voorkomt.
${clientNames.length ? `- Bekende klantnamen in het systeem: ${clientNames.join(', ')}. Gebruik exact zo'n naam in "client" als die overeenkomt.` : ''}`;

  const provider = detectProvider(resolvedKey);
  let raw = '';
  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resolvedKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini', max_tokens: 1500,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: imageDataUrl } },
          { type: 'text', text: prompt },
        ]}],
      }),
    });
    if (!response.ok) throw new Error(`OpenAI API error ${response.status}`);
    const data = await response.json();
    raw = data.choices?.[0]?.message?.content || '';
  } else {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': resolvedKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 1500,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt },
        ]}],
      }),
    });
    if (!response.ok) throw new Error(`API error ${response.status}`);
    const data = await response.json();
    raw = data.content?.find(b => b.type === 'text')?.text || '';
  }
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Geen geldige JSON teruggegeven');
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) throw new Error('Geen regels herkend');
  return parsed;
};

// ============================================================================
// DEFAULT ENTITY (gebruikt bij eerste opstart / migratie)
// ============================================================================
const createDefaultEntity = (settings) => ({
  id: 'ent_main',
  name: settings?.company?.name || 'Mijn bedrijf',
  legalName: settings?.company?.name || '',
  type: 'operating',
  parentId: null,
  jurisdiction: settings?.jurisdiction || 'NL',
  registrationNumber: settings?.company?.kvk || '',
  taxNumber: settings?.company?.btw || '',
  address: settings?.company?.address || '',
  postal: settings?.company?.postal || '',
  city: settings?.company?.city || '',
  country: settings?.company?.country || '',
  iban: settings?.company?.iban || '',
  bicCode: settings?.company?.bicCode || '',
  email: settings?.company?.email || '',
  phone: settings?.company?.phone || '',
  website: settings?.company?.website || '',
  logo: settings?.company?.logo || null,
  accentColor: settings?.invoice?.accentColor || '#7C2D2D',
  templateId: 'classic',
  invoicePrefix: settings?.invoice?.prefix || new Date().getFullYear() + '-',
  nextInvoiceNumber: settings?.invoice?.nextNumber || 1,
  paymentTerms: settings?.invoice?.paymentTerms || 14,
  footerText: settings?.invoice?.footerText || 'Betaling binnen 14 dagen na factuurdatum.',
  createdAt: new Date().toISOString(),
});

// ============================================================================
// UI PRIMITIVES
// ============================================================================
// 9-dot Grok-style icon with diagonal wave animation
const NineDotsIcon = ({ size = 16, color = 'white', animated = false }) => {
  const positions = [
    [4, 4], [12, 4], [20, 4],
    [4, 12], [12, 12], [20, 12],
    [4, 20], [12, 20], [20, 20],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
      {positions.map(([cx, cy], i) => {
        const diagonal = Math.floor(cx / 8) + Math.floor(cy / 8);
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={2.4}
            fill={color}
            style={animated ? {
              animation: `dotWave 1.8s ease-in-out infinite`,
              animationDelay: `${diagonal * 0.18}s`,
              transformOrigin: `${cx}px ${cy}px`,
            } : { opacity: 0.9 }}
          />
        );
      })}
    </svg>
  );
};

// Basiscomponenten staan in src/ui.jsx

// ============================================================================
// ENTITY SWITCHER (sidebar dropdown)
// ============================================================================
const EntitySwitcher = ({ activeEntity, entities, onSwitch, onManage }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!activeEntity) return null;
  const typ = getEntityType(activeEntity.type);
  const jur = JURISDICTIONS[activeEntity.jurisdiction || 'NL'];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-colors text-left"
        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}
      >
        {activeEntity.logo
          ? <img src={activeEntity.logo} alt="" style={{ width: 28, height: 28, objectFit: 'contain', borderRadius: 4, flexShrink: 0 }} />
          : <span className="text-lg">{typ.icon}</span>
        }
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{activeEntity.name}</div>
          <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {jur.flag} {typ.label}
          </div>
        </div>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--muted)' }} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-xl border z-50 animate-in py-1" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          <div className="text-[11.5px] font-medium px-3 pt-2 pb-1" style={{ color: 'var(--muted)' }}>Actief bedrijf</div>
          {entities.map(e => {
            const t = getEntityType(e.type);
            const j = JURISDICTIONS[e.jurisdiction || 'NL'];
            return (
              <button
                key={e.id}
                onClick={() => { onSwitch(e.id); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:opacity-80 transition-opacity"
              >
                {e.logo
                  ? <img src={e.logo} alt="" style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }} />
                  : <span className="text-base">{t.icon}</span>
                }
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate" style={{ color: 'var(--ink)' }}>{e.name}</div>
                  <div className="text-[10px]" style={{ color: 'var(--muted)' }}>{j.flag} {t.label}</div>
                </div>
                {e.id === activeEntity.id && <Check size={14} style={{ color: 'var(--success)' }} />}
              </button>
            );
          })}
          <div className="border-t mt-1 pt-1" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => { onManage(); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[color:var(--surface-2)] text-left text-sm"
              style={{ color: 'var(--accent)' }}
            >
              <Plus size={14} /> Bedrijven beheren
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// SIDEBAR / NAV
// ============================================================================
const Sidebar = ({ activeTab, setActiveTab, onOpenSearch, openCount, issueCount = 0, activeEntity, entities, onSwitchEntity, user, profile, onSignOut, theme, onToggleTheme, onGoToProfile }) => {
  const { t } = useLang();
  const mainItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'invoices', label: t('nav.invoices'), icon: FileText },
    { id: 'clients', label: t('nav.clients'), icon: Users },
    { id: 'expenses', label: t('nav.expenses'), icon: ReceiptIcon, badge: openCount },
    { id: 'inkoop', label: t('nav.purchase'), icon: ShoppingCart },
    { id: 'quotes', label: t('nav.quotes'), icon: FileCheck2 },
    { id: 'import', label: t('nav.import'), icon: Upload },
  ];
  const finItems = [
    { id: 'entities', label: t('nav.entities'), icon: Network },
    { id: 'tax', label: t('nav.tax'), icon: FileBarChart },
    { id: 'boekhouding', label: t('nav.accounting'), icon: BookOpen },
    { id: 'controle', label: 'Data-controle', icon: ScanSearch, badge: issueCount },
    { id: 'structuur', label: 'Structuur & plan', icon: Compass },
    { id: 'bank', label: t('nav.bank'), icon: Landmark },
    { id: 'horizonplanner', label: t('nav.horizon'), icon: TrendingUp },
    { id: 'ai', label: t('nav.ai'), icon: Brain },
    { id: 'credit', label: t('nav.credit'), icon: ShieldCheck },
    { id: 'links', label: t('nav.links'), icon: Globe },
  ];
  const accountItems = [
    { id: 'settings', label: t('nav.settings'), icon: SettingsIcon },
    ...(profile?.role === 'org_owner' ? [{ id: 'admin', label: t('nav.users'), icon: Users }] : []),
  ];
  const mobileItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'invoices', label: t('nav.invoices'), icon: FileText },
    { id: 'expenses', label: t('nav.expenses'), icon: ReceiptIcon, badge: openCount },
    { id: 'quotes', label: t('nav.quotes'), icon: FileCheck2 },
    { id: 'settings', label: t('nav.more'), icon: SettingsIcon },
  ];
  // Mobile nav: use shorter labels for space-constrained items
  mobileItems[3].label = t('nav.quotesMobile');

  const NavItem = ({ item }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        onClick={() => setActiveTab(item.id)}
        aria-current={isActive ? 'page' : undefined}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', height: '32px', padding: '0 10px', borderRadius: '8px', marginBottom: '1px',
          background: isActive ? 'var(--surface-3)' : 'transparent',
          boxShadow: isActive ? 'inset 0 0 0 1px var(--border-2)' : 'none',
          border: 'none', cursor: 'pointer',
          transition: 'background 0.12s ease',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface-2)'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon size={15} strokeWidth={isActive ? 2.2 : 1.8} style={{ color: isActive ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0 }} />
          <span style={{ fontSize: '13.5px', fontWeight: isActive ? 600 : 450, color: isActive ? 'var(--text)' : 'var(--text-2)' }}>
            {item.label}
          </span>
        </span>
        {item.badge > 0 && (
          <span className="num" style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '999px', background: item.id === 'controle' ? 'var(--warning-soft)' : 'var(--danger-soft)', color: item.id === 'controle' ? 'var(--warning)' : 'var(--danger)', minWidth: '20px', textAlign: 'center' }}>
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const Section = ({ label }) => (
    <div style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-3)', padding: '16px 10px 6px' }}>
      {label}
    </div>
  );

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Lokaal';
  const roleLabel = profile?.role === 'platform_admin' ? 'Platform Admin' : profile?.role === 'org_owner' ? t('nav.roleOwner') : 'Starter';

  const allNavItems = [...mainItems, ...finItems, ...accountItems];
  const activeLabel = allNavItems.find(i => i.id === activeTab)?.label || 'Dashboard';

  return (
    <>
      {/* Mobile top header — fixed boven content, vervangt de notch */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between border-b"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          paddingTop: 'env(safe-area-inset-top)',
          paddingLeft: '16px',
          paddingRight: '12px',
          height: 'calc(44px + env(safe-area-inset-top))',
        }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <img src="/logo.png" alt="DHS Finance" style={{ height: '26px', width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text)', letterSpacing: '-0.02em' }}>DHS Finance</span>
        </div>
        {/* Huidige sectie */}
        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-2)', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {activeLabel}
        </span>
        {/* Zoeken + theme toggle */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
        {onOpenSearch && (
          <button onClick={onOpenSearch} aria-label="Zoeken" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', color: 'var(--text-2)', display: 'flex' }}>
            <Search size={18} />
          </button>
        )}
        {onToggleTheme && (
          <button onClick={onToggleTheme}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', borderRadius: '8px', color: 'var(--text-2)', display: 'flex', alignItems: 'center' }}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col h-screen sticky top-0"
        style={{ width: '224px', flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src="/logo.png" alt="DHS Finance" style={{ height: '30px', width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text)', letterSpacing: '-0.02em' }}>DHS Finance</div>
              <div style={{ fontSize: '10px', color: 'var(--text-3)', marginTop: '1px' }}>Finance Intelligence</div>
            </div>
          </div>
        </div>

        {/* Entity switcher */}
        {activeEntity && (
          <div style={{ padding: '8px 8px', borderBottom: '1px solid var(--border)' }}>
            <EntitySwitcher activeEntity={activeEntity} entities={entities} onSwitch={onSwitchEntity} onManage={() => setActiveTab('entities')} />
          </div>
        )}

        {/* Zoeken / ⌘K */}
        {onOpenSearch && (
          <div style={{ padding: '10px 8px 0' }}>
            <button onClick={onOpenSearch} style={{ width: '100%', height: '34px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 10px', borderRadius: '9px', border: '1px solid var(--border-2)', background: 'var(--bg)', color: 'var(--text-3)', cursor: 'pointer', fontSize: '13px' }}>
              <Search size={14} /> <span style={{ flex: 1, textAlign: 'left' }}>Zoeken of snel naar…</span> <kbd>⌘K</kbd>
            </button>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }} className="scrollable">
          <Section label={t('nav.sectionManage')} />
          {mainItems.map(item => <NavItem key={item.id} item={item} />)}
          <Section label={t('nav.sectionFinance')} />
          {finItems.map(item => <NavItem key={item.id} item={item} />)}
          <Section label={t('nav.sectionAccount')} />
          {accountItems.map(item => <NavItem key={item.id} item={item} />)}
        </nav>

        {/* User footer */}
        <div style={{ padding: '10px', borderTop: '1px solid var(--border)' }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 10px', borderRadius: '10px',
              background: 'var(--surface-2)', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--surface-2)'}
          >
            {/* Clickable profile area */}
            <div
              onClick={onGoToProfile}
              title="Profiel bewerken"
              style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0, cursor: 'pointer' }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                // Accent-tokens i.p.v. vaste indigo, zodat de avatar meekleurt met licht/donker thema
                background: profile?.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: '700', color: 'var(--btn-primary-text)',
                boxShadow: '0 2px 6px var(--accent-glow)',
              }}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : displayName[0].toUpperCase()
                }
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>{displayName}</div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-3)', marginTop: '1px' }}>{roleLabel}</div>
              </div>
            </div>
            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
              {onToggleTheme && (
                <button onClick={onToggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', borderRadius: '6px', color: 'var(--text-3)', display: 'flex' }}>
                  {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                </button>
              )}
              {onSignOut && (
                <button onClick={onSignOut} title="Uitloggen" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '5px', borderRadius: '6px', color: 'var(--text-3)', display: 'flex' }}>
                  <LogOut size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t flex items-center justify-around px-1"
        style={{
          background: 'var(--surface)',
          borderColor: 'var(--border)',
          paddingTop: '6px',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 6px)',
        }}>
        {mobileItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg relative"
              style={{ color: isActive ? 'var(--accent)' : 'var(--text-3)', background: isActive ? 'var(--accent-soft)' : 'none', border: 'none', cursor: 'pointer' }}
            >
              <Icon size={18} />
              <span style={{ fontSize: '10px', fontWeight: '500' }}>{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute top-0.5 right-1" style={{ fontSize: '9px', fontWeight: '700', padding: '1px 4px', borderRadius: '8px', background: 'var(--danger)', color: 'var(--btn-primary-text)', minWidth: 14, textAlign: 'center' }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};

// ============================================================================
// DASHBOARD
// ============================================================================
const Dashboard = ({ invoices, expenses, clients, settings, activeEntity, setActiveTab, onSendReminder, dataIssueCount = 0 }) => {
  const { t } = useLang();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const aiBottomRef = useRef(null);
  const msgContainerRef = useRef(null);
  const autoAnalyzed = useRef(false);

  const [year, setYear] = useState(now.getFullYear());
  const isCurrentYear = year === now.getFullYear();

  // Alle bedragen excl. BTW (omzet én kosten), via src/finance.js — zelfde regels als W&V en aangifte
  const series = useMemo(() => monthlySeries({ invoices, expenses, year }), [invoices, expenses, year]);
  const stats = useMemo(() => {
    const thisMonth = series[now.getMonth()] || { revenue: 0, costs: 0 };
    const ytd = series.reduce((a, m) => ({ revenue: a.revenue + m.revenue, costs: a.costs + m.costs }), { revenue: 0, costs: 0 });
    const outstanding = invoices.reduce((s, i) => s + invoiceOpenAmount(i), 0);
    const overdue = invoices.filter(i => computeInvoiceStatus(i) === 'overdue').reduce((s, i) => s + invoiceOpenAmount(i), 0);
    const openExpenses = expenses.filter(e => e.status === 'open').length;
    const prevYearRevenue = monthlySeries({ invoices, expenses, year: year - 1 })
      .slice(0, isCurrentYear ? now.getMonth() + 1 : 12).reduce((s, m) => s + m.revenue, 0);
    return {
      omzet: thisMonth.revenue, costs: thisMonth.costs, profit: thisMonth.revenue - thisMonth.costs,
      ytdRevenue: ytd.revenue, ytdCosts: ytd.costs, ytdProfit: ytd.revenue - ytd.costs,
      revenueGrowth: prevYearRevenue > 0 ? (ytd.revenue - prevYearRevenue) / prevYearRevenue : null,
      outstanding, overdue, openExpenses,
      btwNet: series.reduce((s, m) => s + m.vat, 0),
    };
  }, [series, invoices, expenses, year]);

  const yearOptions = useMemo(() => {
    const set = new Set([now.getFullYear()]);
    invoices.forEach(i => { const y = yearOf(invoiceDate(i)); if (y) set.add(y); });
    return [...set].sort((a, b) => b - a).slice(0, 5);
  }, [invoices]);

  const dueReminders = useMemo(() => {
    if (!settings.reminders?.enabled) return [];
    const due = [];
    invoices.forEach(inv => {
      if (inv.status !== 'sent' || !inv.dueDate) return;
      const overdueDays = daysBetween(inv.dueDate, todayISO());
      if (overdueDays <= 0) return;
      const sentReminders = inv.remindersSent || [];
      settings.reminders.schedule.forEach((dayThreshold, idx) => {
        if (overdueDays >= dayThreshold && !sentReminders.find(r => r.level === idx)) {
          due.push({ invoice: inv, level: idx, daysOverdue: overdueDays });
        }
      });
    });
    return due.filter((d, i, arr) => arr.findIndex(x => x.invoice.id === d.invoice.id) === i);
  }, [invoices, settings]);

  // Auto-insights: slimme observaties zonder API-call
  const insights = useMemo(() => {
    const list = [];
    const overdueInvs = invoices.filter(i => computeInvoiceStatus(i) === 'overdue');
    const overdueTotal = overdueInvs.reduce((s, i) => s + computeInvoice(i.items).total - (i.paidAmount || 0), 0);
    if (overdueInvs.length > 0) {
      list.push({
        level: 'danger',
        icon: AlertCircle,
        title: `${overdueInvs.length} ${overdueInvs.length !== 1 ? t('dash.invoicesOverdue') : t('dash.invoiceOverdue')}`,
        text: `${fmtEUR(overdueTotal)} ${t('dash.insightOverdueText')}`,
        action: t('dash.insightOverdueAction'),
        tab: 'invoices',
      });
    }
    if (stats.openExpenses > 0) {
      list.push({
        level: 'warning',
        icon: ReceiptIcon,
        title: `${stats.openExpenses} ${stats.openExpenses !== 1 ? t('dash.receiptPlural') : t('dash.receiptSingle')} ${t('dash.insightExpensesTitle')}`,
        text: t('dash.insightExpensesText'),
        action: t('dash.insightExpensesAction'),
        tab: 'expenses',
      });
    }
    if (dueReminders.length > 0) {
      list.push({
        level: 'warning',
        icon: Bell,
        title: `${dueReminders.length} ${dueReminders.length !== 1 ? t('dash.reminderPlural') : t('dash.reminderSingle')} ${t('dash.insightRemindersTitle')}`,
        text: t('dash.insightRemindersText'),
        action: t('dash.insightRemindersAction'),
        onAction: () => onSendReminder(dueReminders[0].invoice, dueReminders[0].level),
      });
    }
    if (dataIssueCount > 0) {
      list.unshift({
        level: 'warning',
        icon: AlertCircle,
        title: `${dataIssueCount} ${dataIssueCount === 1 ? 'mogelijk probleem' : 'mogelijke problemen'} in je administratie`,
        text: 'Dubbele factuurnummers, dubbel geboekte omzet of verkeerd berekende BTW. Controleer en herstel met één klik.',
        action: 'Data-controle',
        tab: 'controle',
      });
    }
    if (stats.profit < 0 && stats.omzet > 0) {
      list.push({
        level: 'danger',
        icon: TrendingUp,
        title: t('dash.insightLossTitle'),
        text: t('dash.insightLossText').replace('{amount}', fmtEUR(Math.abs(stats.profit))),
        action: null,
      });
    }
    if (list.length === 0 && stats.omzet > 0) {
      list.push({
        level: 'ok',
        icon: CheckCircle2,
        title: t('dash.insightOkTitle'),
        text: `${fmtEUR(stats.omzet)} ${t('dash.insightOkText')}`,
        action: null,
      });
    }
    return list;
  }, [invoices, expenses, stats, dueReminders, dataIssueCount]);

  const recentInvoices = [...invoices]
    .sort((a, b) => new Date(b.issueDate || b.date || 0) - new Date(a.issueDate || a.date || 0))
    .slice(0, 5);

  const hasApiKey = !!(settings.apiKey || settings.openaiApiKey);

  // Scroll alleen binnen het chat-venster, niet de hele pagina
  useEffect(() => {
    if (msgContainerRef.current) {
      msgContainerRef.current.scrollTop = msgContainerRef.current.scrollHeight;
    }
  }, [aiMessages, aiLoading]);

  // Volgende NL kwartaal-BTW deadline
  const nextBTWDeadline = useMemo(() => {
    const y = now.getFullYear();
    const candidates = [
      new Date(y, 0, 31), new Date(y, 3, 30),
      new Date(y, 6, 31), new Date(y, 9, 31),
      new Date(y + 1, 0, 31),
    ];
    return candidates.find(d => d > now);
  }, []);
  const daysToBTW = nextBTWDeadline
    ? Math.ceil((nextBTWDeadline - now) / 86400000)
    : null;

  const buildFinancialContext = () => {
    const topClients = [...clients]
      .map(c => {
        const inv = invoices.filter(i => i.clientId === c.id);
        const total = inv.reduce((s, i) => s + computeInvoice(i.items).total, 0);
        return { name: c.name, total, count: inv.length };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map(c => `${c.name}: ${fmtEUR(c.total)} (${c.count} facturen)`)
      .join(', ');
    const monthName = now.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
    const btwDeadlineStr = nextBTWDeadline
      ? `${nextBTWDeadline.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })} (over ${daysToBTW} dagen)`
      : 'onbekend';
    return `Financieel overzicht ${activeEntity?.name || 'Den Hartogh Solutions'} — ${monthName}:
• Omzet deze maand (excl. BTW): ${fmtEUR(stats.omzet)}
• Kosten deze maand (excl. BTW): ${fmtEUR(stats.costs)}
• Resultaat deze maand: ${fmtEUR(stats.profit)}
• Omzet ${year} t/m nu: ${fmtEUR(stats.ytdRevenue)} | Kosten: ${fmtEUR(stats.ytdCosts)} | Resultaat: ${fmtEUR(stats.ytdProfit)}
• BTW saldo: ${fmtEUR(Math.abs(stats.btwNet))} (${stats.btwNet > 0 ? 'af te dragen' : 'terug te vorderen'})
• Volgende BTW-aangifte deadline: ${btwDeadlineStr}
• Openstaand: ${fmtEUR(stats.outstanding)} | Achterstallig: ${fmtEUR(stats.overdue)}
• Open bonnen: ${stats.openExpenses}
• Totaal facturen: ${invoices.length} | Klanten: ${clients.length}
• Top klanten: ${topClients || 'geen data'}`;
  };

  const AI_SYSTEM = (context) =>
    `Je bent een proactieve, slimme financiële assistent voor Nederlandse ondernemers. Je denkt ACTIEF mee en attendeert op kansen, risico's en aankomende verplichtingen. Antwoord altijd in het Nederlands.

Actuele data:
${context}

Wanneer je antwoordt:
- Wees concreet en gebruik de echte bedragen uit de data
- Wijs proactief op aankomende deadlines of risico's
- Geef 1-2 concrete actiepunten als dat relevant is
- Houd antwoorden beknopt (max 150 woorden)`;

  const sendAiMessage = async (question) => {
    const q = (question || aiInput).trim();
    if (!q || aiLoading) return;
    if (!hasApiKey) {
      setAiMessages(prev => [...prev,
        { role: 'user', content: q },
        { role: 'assistant', content: t('dash.aiNoKeyMsg') },
      ]);
      setAiInput('');
      return;
    }
    const userMsg = { role: 'user', content: q };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput('');
    setAiLoading(true);
    try {
      const context = buildFinancialContext();
      const history = [...aiMessages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const reply = await callAI({
        system: AI_SYSTEM(context),
        messages: history,
        apiKey: settings.apiKey,
        openaiApiKey: settings.openaiApiKey,
        maxTokens: 700,
      });
      setAiMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (e) {
      setAiMessages(prev => [...prev, { role: 'assistant', content: `Fout: ${e.message}` }]);
    } finally {
      setAiLoading(false);
    }
  };

  const quickQuestions = [
    t('dash.q1'),
    t('dash.q2'),
    t('dash.q3'),
    t('dash.q4'),
  ];

  const INSIGHT_STYLE = {
    danger: { iconColor: 'var(--danger)', soft: 'var(--danger-soft)' },
    warning: { iconColor: 'var(--warning)', soft: 'var(--warning-soft)' },
    ok: { iconColor: 'var(--success)', soft: 'var(--success-soft)' },
    info: { iconColor: 'var(--info)', soft: 'var(--info-soft)' },
  };

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title truncate">
            {activeEntity?.name || 'Overzicht'}
          </h1>
          <p className="page-sub">
            {activeEntity && (
              <>{JURISDICTIONS[activeEntity.jurisdiction || 'NL'].flag} {getEntityType(activeEntity.type).label} · </>
            )}
            {now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {/* Grote touch-targets op mobiel */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => setActiveTab('expenses')}
            className="w-10 h-10 md:w-auto md:h-auto md:px-3 md:py-2 rounded-xl flex items-center justify-center gap-1.5 text-sm font-medium border transition-colors active:scale-95"
            style={{ borderColor: 'var(--border-2)', background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            <ReceiptIcon size={16} />
            <span className="hidden md:inline">{t('dash.receipt')}</span>
          </button>
          <button
            onClick={() => setActiveTab('invoices')}
            className="w-10 h-10 md:w-auto md:h-auto md:px-3 md:py-2 rounded-xl flex items-center justify-center gap-1.5 text-sm font-medium transition-colors active:scale-95"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <Plus size={16} />
            <span className="hidden md:inline">{t('dash.invoice')}</span>
          </button>
        </div>
      </div>

      <VizStyles />
      {/* ── Jaar-keuze ── */}
      <div className="flex items-center gap-1 viz">
        {yearOptions.map(y => (
          <button key={y} onClick={() => setYear(y)} className="px-3 py-1 text-xs rounded-lg font-semibold transition-colors"
            style={{ background: year === y ? 'var(--accent)' : 'transparent', color: year === y ? '#fff' : 'var(--text-3)' }}>{y}</button>
        ))}
      </div>

      {/* ── KPI-tegels met sparkline — 2×2 mobiel, 4 desktop ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 viz">
        <KpiTile delay={0} label={`Omzet ${year}`} value={stats.ytdRevenue} color="var(--viz-1)" spark={series} sparkKey="revenue"
          sub={stats.revenueGrowth === null ? 'excl. BTW' : `${stats.revenueGrowth >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(stats.revenueGrowth * 100))}% t.o.v. ${year - 1}`}
          subTone={stats.revenueGrowth === null ? undefined : stats.revenueGrowth >= 0 ? 'var(--success)' : 'var(--danger)'}
          onClick={() => setActiveTab('boekhouding')} />
        <KpiTile delay={60} label={`Kosten ${year}`} value={stats.ytdCosts} color="var(--viz-2)" spark={series} sparkKey="costs" sub="excl. aftrekbare BTW" onClick={() => setActiveTab('expenses')} />
        <KpiTile delay={120} label="Resultaat" value={stats.ytdProfit} color="var(--viz-3)" spark={series} sparkKey="profit"
          sub={stats.ytdRevenue > 0 ? `marge ${Math.round(stats.ytdProfit / stats.ytdRevenue * 100)}%` : 'omzet − kosten'}
          subTone={stats.ytdProfit < 0 ? 'var(--danger)' : undefined} onClick={() => setActiveTab('boekhouding')} />
        <KpiTile delay={180} label={t('dash.statOutstanding')} value={stats.outstanding}
          sub={stats.overdue > 0 ? `${fmtEUR(stats.overdue)} ${t('dash.statLate')}` : t('dash.statAllOnTime')}
          subTone={stats.overdue > 0 ? 'var(--danger)' : 'var(--success)'} onClick={() => setActiveTab('invoices')} />
      </div>

      {/* ── Insights / Actiepunten ── */}
      <div className="space-y-2">
        {insights.map((ins, i) => {
          const s = INSIGHT_STYLE[ins.level] || INSIGHT_STYLE.info;
          return (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-[12px]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: `inset 3px 0 0 ${s.iconColor}` }}
            >
              <span className="w-8 h-8 rounded-[9px] flex items-center justify-center flex-shrink-0" style={{ background: s.soft }}>
                <ins.icon size={15} style={{ color: s.iconColor }} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>{ins.title}</div>
                <div className="text-[12px] mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>{ins.text}</div>
              </div>
              {ins.action && (
                <Button size="sm" variant="secondary" onClick={ins.onAction ? ins.onAction : () => setActiveTab(ins.tab)}>
                  {ins.action}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Jaargrafiek + BTW-pot ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="viz-rise rounded-xl border p-5 lg:col-span-2" style={{ background: 'var(--surface)', borderColor: 'var(--border)', animationDelay: '200ms' }}>
          <div className="mb-2">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Omzet, kosten en resultaat per maand — {year}</h2>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>Factuurdatum, excl. BTW, creditnota's verrekend</p>
          </div>
          <YearChart series={series} year={year} />
        </div>
        <div className="flex flex-col gap-4">
          <div className="viz-rise rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)', animationDelay: '260ms' }}>
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>BTW dit kwartaal</h3>
            <VatPot invoices={invoices} expenses={expenses} clients={clients} />
            <button onClick={() => setActiveTab('tax')} className="mt-3 text-xs font-medium flex items-center gap-1 hover:underline" style={{ color: 'var(--accent)' }}>
              Naar aangifte <ChevronRight size={12} />
            </button>
          </div>
          <div className="viz-rise rounded-xl border p-5 flex-1" style={{ background: 'var(--surface)', borderColor: 'var(--border)', animationDelay: '320ms' }}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>Te ontvangen</h3>
            <AgingBar invoices={invoices} />
          </div>
        </div>
      </div>

      {/* ── Kostenverdeling + topklanten ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="viz-rise rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)', animationDelay: '380ms' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>Waar gaat het geld naartoe — {year}</h3>
          <CostDonut expenses={expenses} year={year} />
        </div>
        <div className="viz-rise rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)', animationDelay: '440ms' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ink)' }}>Topklanten — {year}</h3>
          <TopClients invoices={invoices} clients={clients} year={year} />
        </div>
      </div>

      {/* ── AI Assistent — full width, prominent ── */}
      <Card className="flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--accent)' }}
          >
            <NineDotsIcon size={16} color="white" animated={true} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>{t('dash.aiTitle')}</h3>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
              {hasApiKey ? t('dash.aiSubtitleActive') : t('dash.aiSubtitleNoKey')}
            </p>
          </div>
          {aiMessages.length > 0 && (
            <button
              onClick={() => setAiMessages([])}
              className="text-[11px] px-2 py-1 rounded-lg transition-colors hover:opacity-70"
              style={{ color: 'var(--muted)' }}
            >
              {t('dash.aiClear')}
            </button>
          )}
          {!hasApiKey && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
              {t('dash.aiNoKey')}
            </span>
          )}
        </div>

        {/* Berichten */}
        <div ref={msgContainerRef} className="px-4 py-3 overflow-y-auto space-y-2.5" style={{ minHeight: 72, maxHeight: 240 }}>
          {aiMessages.length === 0 ? (
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendAiMessage(q)}
                  disabled={aiLoading}
                  className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-[color:var(--surface-2)] active:scale-95 disabled:opacity-50"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-2)' }}
                >
                  {q}
                </button>
              ))}
            </div>
          ) : (
            aiMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="rounded-2xl px-3 py-2 text-sm max-w-[88%] leading-relaxed"
                  style={m.role === 'user'
                    ? { background: 'var(--accent)', color: 'white' }
                    : { background: 'var(--surface-2)', color: 'var(--ink)', border: '1px solid var(--border)' }
                  }
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {aiLoading && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-2.5 flex gap-1.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span className="animate-bounce inline-block font-bold text-lg leading-none" style={{ animationDelay: '0ms', color: 'var(--muted)' }}>·</span>
                <span className="animate-bounce inline-block font-bold text-lg leading-none" style={{ animationDelay: '150ms', color: 'var(--muted)' }}>·</span>
                <span className="animate-bounce inline-block font-bold text-lg leading-none" style={{ animationDelay: '300ms', color: 'var(--muted)' }}>·</span>
              </div>
            </div>
          )}
          <div ref={aiBottomRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendAiMessage()}
              placeholder={t('dash.aiPlaceholder')}
              disabled={aiLoading}
              className="flex-1 text-sm rounded-xl border px-3 py-2.5 outline-none"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--ink)' }}
            />
            <button
              onClick={() => sendAiMessage()}
              disabled={!aiInput.trim() || aiLoading}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-30 transition-all active:scale-95"
              style={{ background: 'var(--accent)' }}
            >
              <Send size={14} color="white" />
            </button>
          </div>
        </div>
      </Card>

      {/* ── Recente facturen ── */}
      <Card>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-display text-base font-semibold" style={{ color: 'var(--ink)' }}>{t('dash.recentTitle')}</h3>
          <button onClick={() => setActiveTab('invoices')} className="text-xs font-medium hover:underline flex items-center gap-1" style={{ color: 'var(--accent)' }}>
            {t('dash.viewAll')} <ChevronRight size={12} />
          </button>
        </div>
        {recentInvoices.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>{t('dash.noInvoices')}</div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {recentInvoices.map(inv => {
              const c = clients.find(x => x.id === inv.clientId);
              const total = computeInvoice(inv.items).total;
              const status = computeInvoiceStatus(inv);
              return (
                <div key={inv.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono font-medium">{inv.number}</span>
                      <Badge status={status} />
                    </div>
                    <div className="text-sm truncate" style={{ color: 'var(--ink-2)' }}>{c?.name || '—'}</div>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <div className="font-display text-sm num font-semibold">{fmtEUR(total)}</div>
                    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{fmtDate(inv.issueDate)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

// ============================================================================
// CLIENTS VIEW
// ============================================================================
const ClientsView = ({ clients, setClients, invoices, settings }) => {
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const filtered = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  // Alleen echte omzet telt (geen concepten/geannuleerd); creditnota's verlagen het totaal.
  const clientStats = (clientId) => {
    const inv = invoices.filter(i => i.clientId === clientId && isRevenueInvoice(i));
    const total = inv.reduce((s, i) => s + computeInvoice(i.items).total, 0);
    const open = inv.reduce((s, i) => s + invoiceOpenAmount(i), 0);
    const last = inv.map(invoiceDate).filter(Boolean).sort().pop() || null;
    return { count: inv.length, total, open, last };
  };

  const handleSave = (data) => {
    if (data.id) {
      setClients(prev => prev.map(c => c.id === data.id ? data : c));
    } else {
      const newClient = { ...data, id: generateId('cli'), createdAt: new Date().toISOString() };
      setClients(prev => [...prev, newClient]);
    }
    setEditing(null);
  };

  const handleDelete = (id) => {
    if (invoices.some(i => i.clientId === id)) {
      alert('Kan deze klant niet verwijderen: er zijn nog facturen aan gekoppeld.');
      return;
    }
    if (window.confirm('Klant verwijderen?')) {
      setClients(prev => prev.filter(c => c.id !== id));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Klanten"
        sub={`${clients.length} klant${clients.length !== 1 ? 'en' : ''}`}
        actions={<Button onClick={() => setEditing({})}><Plus size={16} /> Nieuwe klant</Button>}
      />

      <Card className="p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
          <input
            type="text"
            placeholder="Zoeken op naam of email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-transparent rounded border-0"
            style={{ color: 'var(--ink)' }}
          />
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users}
            title={search ? 'Geen klanten gevonden' : 'Nog geen klanten'}
            description={search ? 'Probeer een andere zoekterm' : 'Voeg je eerste klant toe om facturen te kunnen versturen.'}
            action={!search && <Button onClick={() => setEditing({})}><Plus size={14} /> Eerste klant toevoegen</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Kasboek-tabel: totaal gefactureerd (incl. BTW), openstaand en laatste factuurdatum per klant */}
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th>Klant</th>
                  <th className="hidden md:table-cell" style={{ width: 90 }}>Facturen</th>
                  <th className="hidden md:table-cell" style={{ width: 120 }}>Laatste factuur</th>
                  <th className="r hidden sm:table-cell" style={{ width: 130 }}>Openstaand</th>
                  <th className="r" style={{ width: 140 }}>Gefactureerd</th>
                  <th style={{ width: 80 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const stats = clientStats(c.id);
                  return (
                    <tr key={c.id}>
                      <td className="max-w-0" style={{ width: '40%' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{c.name}</span>
                          {c.btw && <span className="text-xs font-mono px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>{c.btw}</span>}
                        </div>
                        <div className="truncate text-[11.5px]" style={{ color: 'var(--text-3)' }}>
                          {c.contactName && <span>{c.contactName} · </span>}
                          <span>{c.email || 'Geen email'}</span>
                          {c.city && <span> · {c.city}</span>}
                        </div>
                      </td>
                      <td className="hidden md:table-cell num" style={{ color: 'var(--text-2)' }}>{stats.count}</td>
                      <td className="hidden md:table-cell num" style={{ color: 'var(--text-2)' }}>{stats.last ? fmtDate(stats.last) : '—'}</td>
                      <td className="r hidden sm:table-cell">
                        {stats.open > 0.005
                          ? <Money value={stats.open} style={{ color: 'var(--warning)' }} />
                          : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </td>
                      <td className="r"><Money value={stats.total} /></td>
                      <td className="r">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => setEditing(c)} className="p-2 rounded hover:bg-[color:var(--surface-3)]" title="Bewerken">
                            <Edit3 size={14} style={{ color: 'var(--text-3)' }} />
                          </button>
                          <button onClick={() => handleDelete(c.id)} className="p-2 rounded hover:bg-[color:var(--danger-soft)]" title="Verwijderen">
                            <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing !== null && (
        <ClientForm client={editing} onSave={handleSave} onClose={() => setEditing(null)} settings={settings} />
      )}
    </div>
  );
};

const ClientForm = ({ client, onSave, onClose, settings }) => {
  const [form, setForm] = useState({
    name: '', contactName: '', email: '', address: '', postal: '', city: '', country: 'Nederland',
    btw: '', kvk: '', notes: '', ...client,
  });
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const applyAiData = (data) => {
    setForm(f => ({
      ...f,
      name: data.name || f.name,
      contactName: data.contactName || f.contactName,
      email: data.email || f.email,
      phone: data.phone || f.phone || '',
      address: data.address || f.address,
      postal: data.postal || f.postal,
      city: data.city || f.city,
      country: data.country || f.country,
      btw: data.btw || f.btw,
      kvk: data.kvk || f.kvk,
    }));
  };

  const lookupWebsite = async () => {
    if (!websiteUrl) return;
    setAiLoading(true); setAiError('');
    try {
      const url = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
      const data = await callClaudeForClientFromWebsite({ url, apiKey: settings?.apiKey });
      applyAiData(data);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const scanCard = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiLoading(true); setAiError('');
    try {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = await callClaudeVisionForCard({ imageDataUrl: ev.target.result, apiKey: settings?.apiKey });
          applyAiData(data);
        } catch (err) {
          setAiError(err.message);
        } finally {
          setAiLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setAiError(e.message);
      setAiLoading(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg">
      <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-display text-2xl">{form.id ? 'Klant bewerken' : 'Nieuwe klant'}</h2>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-[color:var(--surface-2)]"><X size={16} /></button>
      </div>
      <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto scrollable">
        {/* AI-assisted lookup */}
        {!form.id && (
          <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2">
              <Wand2 size={14} style={{ color: 'var(--accent)' }} />
              <span className="text-[12.5px] font-semibold" style={{ color: 'var(--accent)' }}>Automatisch invullen met AI</span>
            </div>
            <div className="flex gap-2">
              <input
                value={websiteUrl}
                onChange={e => setWebsiteUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookupWebsite()}
                placeholder="Website bijv. acme.nl"
                className="flex-1 px-3 py-2 text-sm rounded border"
                style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }}
              />
              <Button size="sm" onClick={lookupWebsite} disabled={aiLoading || !websiteUrl}>
                {aiLoading ? <RefreshCw size={13} className="animate-spin" /> : <Globe size={13} />}
                {aiLoading ? 'Zoeken...' : 'Ophalen'}
              </Button>
              <label className="cursor-pointer">
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={scanCard} disabled={aiLoading} />
                <span className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded font-medium" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', cursor: aiLoading ? 'not-allowed' : 'pointer' }}>
                  <Paperclip size={13} /> Visitekaartje
                </span>
              </label>
            </div>
            {aiError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{aiError}</p>}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Bedrijfsnaam *" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Acme B.V." />
          <Input label="Contactpersoon" value={form.contactName} onChange={e => update('contactName', e.target.value)} placeholder="Jan Jansen" />
          <Input label="Email" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="jan@acme.nl" />
          <Input label="Telefoon" value={form.phone || ''} onChange={e => update('phone', e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input label="Adres" className="md:col-span-2" value={form.address} onChange={e => update('address', e.target.value)} placeholder="Straat 123" />
          <Input label="Postcode" value={form.postal} onChange={e => update('postal', e.target.value)} />
          <Input label="Plaats" className="md:col-span-2" value={form.city} onChange={e => update('city', e.target.value)} />
          <Input label="Land" value={form.country} onChange={e => update('country', e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="BTW-nummer" value={form.btw} onChange={e => update('btw', e.target.value)} placeholder="NL123456789B01" />
          <Input label="KvK-nummer" value={form.kvk} onChange={e => update('kvk', e.target.value)} />
        </div>
        <Textarea label="Notities" rows={3} value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Interne notities (niet zichtbaar op factuur)" />
      </div>
      <div className="px-6 py-4 border-t flex justify-end gap-2" style={{ borderColor: 'var(--border)' }}>
        <Button variant="secondary" onClick={onClose}>Annuleren</Button>
        <Button onClick={() => form.name && onSave(form)} disabled={!form.name}>
          <Save size={14} /> Opslaan
        </Button>
      </div>
    </Modal>
  );
};

// ============================================================================
// SYNC-INDICATOR — laat zien of wijzigingen in Supabase staan (voorheen faalde sync onzichtbaar)
// ============================================================================
const SyncIndicator = () => {
  const { pending, error } = useSyncStatus();
  const [showSaved, setShowSaved] = useState(false);
  const wasPending = useRef(false);
  useEffect(() => {
    if (pending > 0) { wasPending.current = true; return; }
    if (wasPending.current && !error) {
      wasPending.current = false;
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 1600);
      return () => clearTimeout(t);
    }
  }, [pending, error]);
  if (!pending && !error && !showSaved) return null;
  const state = error && !pending ? 'error' : pending ? 'saving' : 'saved';
  const cfg = {
    saving: { icon: RefreshCw, text: 'Opslaan…', color: 'var(--text-2)', spin: true },
    saved: { icon: CheckCircle2, text: 'Opgeslagen', color: 'var(--success)' },
    error: { icon: CloudOff, text: 'Opslaan mislukt — wordt bij de volgende wijziging opnieuw geprobeerd', color: 'var(--danger)' },
  }[state];
  const Icon = cfg.icon;
  return (
    <div className="no-print" title={error || ''} style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 200, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: 'var(--surface)', border: `1px solid ${state === 'error' ? 'var(--danger)' : 'var(--border-2)'}`, boxShadow: '0 6px 20px rgba(0,0,0,0.18)', fontSize: 12, fontWeight: 600, color: cfg.color, maxWidth: 'calc(100vw - 32px)' }}>
      <Icon size={13} className={cfg.spin ? 'animate-spin' : ''} />
      <span>{cfg.text}</span>
    </div>
  );
};

// ============================================================================
// INVOICES VIEW
// ============================================================================
const InvoicesView = ({ intent, invoices, setInvoices, allInvoices, clients, setClients, settings, setSettings, activeEntity, setEntities, entities, onSendReminder }) => {
  const { t } = useLang();
  const [view, setView] = useState({ mode: 'list' });
  const [statusFilter, setStatusFilter] = useState('all');
  const [listEdit, setListEdit] = useState(null); // { invId, field: 'client' }
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('all');

  const [showAging, setShowAging] = useState(false);

  // Vanuit ⌘K: factuur direct openen of nieuwe factuur starten
  useEffect(() => {
    if (!intent) return;
    if (intent.type === 'open') {
      const inv = (allInvoices || invoices).find(i => i.id === intent.id);
      if (inv) setView({ mode: 'view', invoice: inv });
    } else if (intent.type === 'new') {
      const terms = activeEntity?.paymentTerms || settings.invoice?.paymentTerms || 14;
      setView({ mode: 'edit', invoice: { issueDate: todayISO(), dueDate: addDays(todayISO(), terms), items: [{ description: '', quantity: 1, price: 0, btwRate: JURISDICTIONS[activeEntity?.jurisdiction || 'NL'].salesTax.standard }] } });
    }
  }, [intent?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = invoices
    .filter(i => statusFilter === 'all' || computeInvoiceStatus(i) === statusFilter)
    .sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));

  // Aging report: open/overdue invoices grouped by overdue days
  const agingBuckets = useMemo(() => {
    const open = invoices.filter(i => ['sent','overdue','partial'].includes(computeInvoiceStatus(i)));
    const buckets = { '0-30': [], '31-60': [], '61-90': [], '90+': [] };
    open.forEach(inv => {
      const days = inv.dueDate ? daysBetween(inv.dueDate, todayISO()) : 0;
      const total = computeInvoice(inv.items).total - (inv.paidAmount || 0);
      const entry = { inv, days, total };
      if (days <= 0) buckets['0-30'].push(entry);
      else if (days <= 30) buckets['0-30'].push(entry);
      else if (days <= 60) buckets['31-60'].push(entry);
      else if (days <= 90) buckets['61-90'].push(entry);
      else buckets['90+'].push(entry);
    });
    return buckets;
  }, [invoices]);

  const handleSave = async (invoice) => {
    const allInv = allInvoices || invoices;
    if (invoice.id && allInv.find(i => i.id === invoice.id)) {
      // Dubbele nummers zijn niet toegestaan (wettelijk verplicht doorlopende, unieke reeks)
      if (isDuplicateInvoiceNumber(allInv, invoice.number, invoice.entityId, invoice.id)) {
        window.alert(`Factuurnummer ${invoice.number} bestaat al. Kies een ander nummer.`);
        return;
      }
      const saved = { ...invoice, invoiceNumber: invoice.number };
      setInvoices(prev => prev.map(i => i.id === invoice.id ? saved : i));
      setView({ mode: 'view', invoice: saved });
      return;
    }
    const next = nextInvoiceNumberFor(activeEntity, allInv);
    const number = invoice.number || next.number;
    if (isDuplicateInvoiceNumber(allInv, number, activeEntity?.id)) {
      window.alert(`Factuurnummer ${number} bestaat al. Kies een ander nummer.`);
      return;
    }
    const newInv = {
      ...invoice,
      id: generateId('inv'),
      entityId: activeEntity?.id,
      number,
      invoiceNumber: number,
      status: invoice.status || 'draft',
      remindersSent: [],
      payments: [],
      createdAt: new Date().toISOString(),
    };
    setInvoices(prev => [...prev, newInv]);
    if (!invoice.number && activeEntity) {
      setEntities(prev => prev.map(e => e.id === activeEntity.id
        ? { ...e, nextInvoiceNumber: next.seq + 1, lastInvoiceYear: next.year }
        : e));
    }
    setView({ mode: 'view', invoice: newInv });
  };

  const handleDelete = async (id) => {
    const inv = (allInvoices || invoices).find(i => i.id === id);
    const isSent = inv && inv.status !== 'draft';
    const msg = !isSent
      ? 'Concept verwijderen? Dit kan niet ongedaan worden gemaakt.'
      : `Let op: ${isCreditNote(inv) ? 'creditnota' : 'factuur'} ${displayInvoiceNumber(inv)} is al verstuurd.\n\n` +
        'Een verstuurde factuur mag je wettelijk niet verwijderen: je bent verplicht hem 7 jaar te bewaren en de nummerreeks moet doorlopend blijven. ' +
        'Verwijderen haalt hem ook uit je omzet en BTW-aangifte.\n\n' +
        (isCreditNote(inv) ? '' : 'Klopt de factuur niet? Maak dan een creditnota (knop "Creditnota") en stuur zo nodig een nieuwe factuur.\n\n') +
        'Alleen verwijderen als dit een fout of dubbele invoer is die nooit naar de klant is gegaan. Toch verwijderen?';
    if (!window.confirm(msg)) return;
    setInvoices(prev => {
      let next = prev.filter(i => i.id !== id);
      // Creditnota weg → bijbehorend gecrediteerd bedrag op de originele factuur terugdraaien
      if (inv?.creditNoteFor) {
        const amount = Math.abs(computeInvoice(inv.items).total);
        next = next.map(i => i.id === inv.creditNoteFor
          ? { ...i, creditedAmount: Math.max(0, roundMoney(Number(i.creditedAmount || 0) - amount)) || undefined }
          : i);
      }
      return next;
    });
    setView({ mode: 'list' });
  };

  // Werkt zowel de lijst als de open detailweergave direct bij (voorheen bleef de detailweergave
  // op de oude status staan tot je terugging naar de lijst — "er gebeurt niets").
  const handleUpdateInvoice = async (id, fields) => {
    const existing = (allInvoices || invoices).find(i => i.id === id);
    // Nummer of klant wijzigen van een verstuurde factuur: wettelijk is dat een ander document
    if (existing && existing.status !== 'draft') {
      const changes = [];
      if (fields.number !== undefined && existing.number && fields.number !== existing.number) changes.push(`het nummer (${existing.number} → ${fields.number})`);
      if (fields.clientId !== undefined && existing.clientId && fields.clientId !== existing.clientId) changes.push('de klant');
      if (changes.length && !window.confirm(
        `Je wijzigt ${changes.join(' en ')} van een verstuurde factuur.\n\n` +
        'De klant heeft de factuur al met de oude gegevens ontvangen. Wettelijk mag je een verstuurde factuur niet aanpassen; ' +
        'de juiste weg is een creditnota op deze factuur en daarna een nieuwe factuur met de juiste gegevens.\n\n' +
        'Alleen doorgaan om een invoerfout in je administratie te herstellen die niet naar de klant is gegaan. Doorgaan?'
      )) return;
    }
    if (fields.number !== undefined) {
      const current = existing;
      if (isDuplicateInvoiceNumber(allInvoices || invoices, fields.number, current?.entityId, id)) {
        window.alert(`Factuurnummer ${fields.number} bestaat al. Kies een ander nummer.`);
        return;
      }
      fields = { ...fields, invoiceNumber: fields.number };
    }
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, ...fields } : i));
    setView(v => (v.invoice?.id === id ? { ...v, invoice: { ...v.invoice, ...fields } } : v));
  };

  const handleStatusChange = async (id, newStatus, extra = {}) => handleUpdateInvoice(id, { status: newStatus, ...extra });

  const handleDuplicate = (inv) => {
    const dupEntity = (entities || []).find(e => e.id === inv.entityId) || activeEntity;
    const terms = dupEntity?.paymentTerms || settings.invoice?.paymentTerms || 14;
    const newInv = {
      ...inv,
      id: undefined,
      number: undefined,
      invoiceNumber: undefined,
      numberAsSent: undefined,
      creditedAmount: undefined,
      creditNoteForNumber: undefined,
      creditNoteForDate: undefined,
      deliveryDate: undefined,
      periodFrom: undefined,
      periodTo: undefined,
      exchangeRate: undefined,
      // Een kopie van een creditnota wordt een gewone factuur met positieve bedragen
      items: inv.status === 'credit_note' ? (inv.items || []).map(it => ({ ...it, price: Math.abs(Number(it.price) || 0) })) : inv.items,
      status: 'draft',
      sentAt: null,
      paidAt: null,
      paidAmount: 0,
      payments: [],
      creditNoteFor: undefined,
      signToken: null, signedAt: null, signedByName: null, signedByIp: null,
      createdAt: undefined,
      remindersSent: [],
      issueDate: todayISO(),
      dueDate: addDays(todayISO(), terms),
    };
    setView({ mode: 'edit', invoice: newInv });
  };

  // Creditnota: een nieuw, negatief document dat naar de originele factuur verwijst. De originele
  // factuur blijft ongewijzigd bestaan (status blijft staan); alleen `creditedAmount` wordt opgehoogd,
  // zodat invoiceOpenAmount() het gecrediteerde deel niet meer als openstaand telt.
  const handleCreateCreditNote = async (origInv) => {
    const allInv = allInvoices || invoices;
    const origNr = displayInvoiceNumber(origInv);
    if (allInv.some(i => i.creditNoteFor === origInv.id) && !window.confirm(`Er bestaat al een creditnota voor ${origNr}. Nog een maken?`)) return;
    const cnBase = `CN-${origInv.number}`;
    let cnNumber = cnBase;
    for (let n = 2; allInv.some(i => i.number === cnNumber); n++) cnNumber = `${cnBase}-${n}`;
    const items = (origInv.items || []).map(it => ({ ...it, price: -Math.abs(Number(it.price)) }));
    const creditNote = {
      ...origInv,
      id: generateId('inv'),
      number: cnNumber,
      invoiceNumber: cnNumber,
      numberAsSent: undefined,
      status: 'credit_note',
      creditNoteFor: origInv.id,
      creditNoteForNumber: origNr,
      creditNoteForDate: origInv.issueDate || null,
      creditedAmount: undefined,
      issueDate: todayISO(),
      dueDate: todayISO(),
      sentAt: null,
      paidAt: null,
      paidAmount: 0,
      remindersSent: [],
      payments: [],
      signToken: null, signedAt: null, signedByName: null, signedByIp: null,
      qrEnabled: undefined,
      createdAt: new Date().toISOString(),
      items,
      // Verwijzing naar de originele factuur wordt door de template zelf geprint (creditNoteForNumber);
      // de opmerkingen blijven vrij voor de gebruiker.
      notes: '',
    };
    const creditAmount = Math.abs(computeInvoice(items).total);
    setInvoices(prev => [
      ...prev.map(i => i.id === origInv.id ? { ...i, creditedAmount: roundMoney(Number(i.creditedAmount || 0) + creditAmount) } : i),
      creditNote,
    ]);
    setView({ mode: 'view', invoice: creditNote });
  };

  const handleRegisterPayment = async (inv, payment) => {
    const allInv = allInvoices || invoices;
    const payments = [...(inv.payments || []), payment];
    const totals = computeInvoice(inv.items);
    const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    // Gecrediteerd deel hoeft niet meer betaald te worden
    const isFullyPaid = totalPaid >= totals.total - Number(inv.creditedAmount || 0) - 0.005;
    const updated = {
      ...inv,
      payments,
      status: isFullyPaid ? 'paid' : 'partial',
      paidAmount: totalPaid,
      // Betaaldatum = datum van de (laatste) betaling, niet het moment van invoeren
      paidAt: isFullyPaid ? `${payment.date || todayISO()}T12:00:00.000Z` : null,
    };
    setInvoices(prev => prev.map(i => i.id === inv.id ? updated : i));
    setView({ mode: 'view', invoice: updated });
  };

  if (view.mode === 'edit') {
    return <InvoiceEditor invoice={view.invoice} clients={clients} setClients={setClients} settings={settings} activeEntity={activeEntity} nextNumberPreview={nextInvoiceNumberFor(activeEntity, allInvoices || invoices).number} onSave={handleSave} onCancel={() => setView(view.invoice?.id ? { mode: 'view', invoice: view.invoice } : { mode: 'list' })} />;
  }

  if (view.mode === 'view') {
    return <InvoiceDetail
      invoice={(allInvoices || invoices).find(i => i.id === view.invoice?.id) || view.invoice}
      clients={clients}
      settings={settings}
      activeEntity={activeEntity}
      entities={entities}
      onClose={() => setView({ mode: 'list' })}
      onEdit={(inv) => setView({ mode: 'edit', invoice: inv })}
      onDelete={handleDelete}
      onStatusChange={handleStatusChange}
      onDuplicate={handleDuplicate}
      onSendReminder={onSendReminder}
      onCreateCreditNote={handleCreateCreditNote}
      onRegisterPayment={handleRegisterPayment}
      onUpdateInvoice={handleUpdateInvoice}
    />;
  }

  const paymentTermsForEntity = activeEntity?.paymentTerms || settings.invoice?.paymentTerms || 14;
  const defaultBtw = JURISDICTIONS[activeEntity?.jurisdiction || 'NL'].salesTax.standard;
  const nextNumberPreview = nextInvoiceNumberFor(activeEntity, allInvoices || invoices).number;
  const startNew = () => setView({ mode: 'edit', invoice: { issueDate: todayISO(), dueDate: addDays(todayISO(), paymentTermsForEntity), items: [{ description: '', quantity: 1, price: 0, btwRate: defaultBtw }] } });
  const clientName = (id) => clients.find(x => x.id === id)?.name || '';
  const counts = invoices.reduce((acc, i) => { const st = computeInvoiceStatus(i); acc[st] = (acc[st] || 0) + 1; return acc; }, {});
  const yearsAvailable = [...new Set(invoices.map(i => yearOf(invoiceDate(i))).filter(Boolean))].sort((a, b) => b - a);
  const listed = filtered
    .filter(i => yearFilter === 'all' || yearOf(invoiceDate(i)) === Number(yearFilter))
    .filter(i => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return String(i.number || '').toLowerCase().includes(q) || String(i.numberAsSent || '').toLowerCase().includes(q) ||
        clientName(i.clientId).toLowerCase().includes(q) || (i.items || []).some(it => String(it.description || '').toLowerCase().includes(q));
    });
  const listedTotal = listed.reduce((s, i) => s + computeInvoice(i.items).total, 0);
  const summary = [
    { id: 'open', label: 'Openstaand', value: invoices.reduce((s, i) => s + invoiceOpenAmount(i), 0), filter: 'sent', tone: 'var(--text)' },
    { id: 'overdue', label: 'Te laat', value: invoices.filter(i => computeInvoiceStatus(i) === 'overdue').reduce((s, i) => s + invoiceOpenAmount(i), 0), filter: 'overdue', tone: 'var(--danger)' },
    { id: 'paid', label: `Betaald ${new Date().getFullYear()}`, value: invoices.filter(i => i.status === 'paid' && yearOf(invoiceDate(i)) === new Date().getFullYear()).reduce((s, i) => s + computeInvoice(i.items).total, 0), filter: 'paid', tone: 'var(--success)' },
    { id: 'draft', label: 'Concepten', value: invoices.filter(i => i.status === 'draft').reduce((s, i) => s + computeInvoice(i.items).total, 0), filter: 'draft', tone: 'var(--text-2)' },
  ];
  const dateCell = (inv, field, label, color) => {
    if (listEdit?.invId === inv.id && listEdit?.field === field) {
      const value = field === 'paidAt' ? isoToLocalDate(inv.paidAt) : (inv[field] || '');
      return (
        <input type="date" defaultValue={value} autoFocus onClick={e => e.stopPropagation()}
          className="h-7 px-1.5 text-[12px] rounded border" style={{ borderColor: 'var(--border-2)' }}
          onKeyDown={e => { if (e.key === 'Escape') setListEdit(null); }}
          onBlur={e => { const v = e.target.value; setTimeout(() => { if (v) handleUpdateInvoice(inv.id, { [field]: field === 'paidAt' ? v + 'T12:00:00.000Z' : v }); setListEdit(null); }, 150); }} />
      );
    }
    return (
      <span className="num text-[12.5px] cursor-text hover:underline" style={{ color: color || 'var(--text-2)' }} title={`Klik om ${label} te wijzigen`}
        onClick={e => { e.stopPropagation(); setListEdit({ invId: inv.id, field }); }}>
        {inv[field] ? fmtDate(inv[field]) : '—'}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('inv.title')}
        sub={<>Volgend nummer <span className="num" style={{ color: 'var(--text-2)' }}>{nextNumberPreview}</span> · {activeEntity?.name}</>}
        actions={<>
          <Button variant="secondary" size="md" onClick={() => setShowAging(a => !a)} aria-pressed={showAging}>
            <FileBarChart size={14} /> {t('inv.aging')}
          </Button>
          <Button onClick={startNew}><Plus size={15} /> {t('inv.new')}</Button>
        </>}
      />

      {/* Samenvatting = snelfilters */}
      <div className="grid grid-cols-2 md:grid-cols-4 rounded-[14px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--border)', gap: 1 }}>
        {summary.map(sm => (
          <button key={sm.id} onClick={() => setStatusFilter(statusFilter === sm.filter ? 'all' : sm.filter)}
            className="text-left px-4 py-3.5 transition-colors"
            style={{ background: statusFilter === sm.filter ? 'var(--surface-2)' : 'var(--surface)', border: 'none', cursor: 'pointer' }}>
            <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>{sm.label}</div>
            <div className="text-[19px] font-semibold mt-0.5" style={{ color: sm.value ? sm.tone : 'var(--text-3)' }}><Money value={sm.value} /></div>
          </button>
        ))}
      </div>

      {showAging && (
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold mb-4">{t('inv.agingTitle')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[['0-30', '0–30 dagen', 'var(--info)'], ['31-60', '31–60 dagen', 'var(--warning)'], ['61-90', '61–90 dagen', 'var(--danger)'], ['90+', 'Meer dan 90 dagen', 'var(--danger)']].map(([key, label, color]) => {
              const entries = agingBuckets[key] || [];
              const total = entries.reduce((s, e) => s + e.total, 0);
              return (
                <div key={key} className="rounded-[10px] p-3" style={{ background: 'var(--surface-2)' }}>
                  <div className="text-[12px] mb-1" style={{ color: 'var(--text-3)' }}>{label}</div>
                  <div className="text-[17px] font-semibold" style={{ color: total ? color : 'var(--text-3)' }}><Money value={total} /></div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{entries.length} factu{entries.length === 1 ? 'ur' : 'ren'}</div>
                  {entries.slice(0, 3).map(({ inv }) => (
                    <div key={inv.id} className="text-xs mt-1 truncate" style={{ color: 'var(--text-2)' }}>{clientName(inv.clientId) || inv.number}</div>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Segmented value={statusFilter} onChange={setStatusFilter} options={[
          { id: 'all', label: t('inv.filterAll'), count: invoices.length },
          { id: 'draft', label: t('inv.filterDraft'), count: counts.draft || 0 },
          { id: 'sent', label: t('inv.filterSent'), count: counts.sent || 0 },
          { id: 'overdue', label: t('inv.filterOverdue'), count: counts.overdue || 0 },
          { id: 'partial', label: t('inv.filterPartial'), count: counts.partial || 0 },
          { id: 'paid', label: t('inv.filterPaid'), count: counts.paid || 0 },
          { id: 'credit_note', label: t('inv.filterCreditNote'), count: counts.credit_note || 0 },
        ].filter(o => o.id === 'all' || o.count > 0 || o.id === statusFilter)} />
        <div className="flex items-center gap-2 ml-auto">
          <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="h-9 px-2.5 text-[13px] rounded-[9px] border" aria-label="Jaar">
            <option value="all">Alle jaren</option>
            {yearsAvailable.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek nummer, klant of regel"
              className="h-9 pl-8 pr-3 text-[13px] rounded-[9px] border w-[220px]" />
          </div>
        </div>
      </div>

      {listed.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title={statusFilter !== 'all' || search || yearFilter !== 'all' ? t('inv.emptyFilterTitle') : t('inv.emptyTitle')}
            description={statusFilter !== 'all' || search || yearFilter !== 'all' ? t('inv.emptyFilterDesc') : t('inv.emptyDesc')}
            action={statusFilter === 'all' && !search && clients.length > 0 && (
              <Button onClick={startNew}><Plus size={14} /> {t('inv.first')}</Button>
            )}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop: kasboek-tabel */}
          <div className="hidden md:block overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Nummer</th>
                  <th>Klant</th>
                  <th style={{ width: 110 }}>Datum</th>
                  <th style={{ width: 110 }}>Vervalt</th>
                  <th style={{ width: 140 }}>Status</th>
                  <th className="r" style={{ width: 140 }}>Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {listed.map(inv => {
                  const status = computeInvoiceStatus(inv);
                  const total = computeInvoice(inv.items).total;
                  const open = invoiceOpenAmount(inv);
                  const overdueDays = inv.dueDate ? daysBetween(inv.dueDate, todayISO()) : 0;
                  const editingClient = listEdit?.invId === inv.id && listEdit?.field === 'client';
                  return (
                    <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => { if (!listEdit) setView({ mode: 'view', invoice: inv }); }}>
                      <td>
                        <span className="num text-[13px] font-medium cursor-text hover:underline" title="Klik om factuurnummer te wijzigen"
                          onClick={e => { e.stopPropagation(); const nr = window.prompt('Factuurnummer:', inv.number || ''); if (nr !== null && nr.trim() !== '') handleUpdateInvoice(inv.id, { number: nr.trim() }); }}>
                          {inv.number || <span style={{ color: 'var(--warning)' }}>geen nr.</span>}
                        </span>
                        {inv.numberAsSent && <div className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-3)' }} title="Intern achtervoegsel; de klant kreeg dit nummer">klant: {inv.numberAsSent}</div>}
                      </td>
                      <td className="max-w-0" style={{ width: '40%' }}>
                        {editingClient ? (
                          <select defaultValue={inv.clientId || ''} autoFocus onClick={e => e.stopPropagation()}
                            className="h-7 px-1.5 text-[12.5px] rounded border w-full"
                            onChange={e => { handleUpdateInvoice(inv.id, { clientId: e.target.value || null }); setListEdit(null); }}
                            onBlur={() => setListEdit(null)}>
                            <option value="">Geen klant</option>
                            {clients.map(cl => <option key={cl.id} value={cl.id}>{cl.name || cl.email || cl.id}</option>)}
                          </select>
                        ) : (
                          <div className="truncate cursor-text hover:underline" title="Klik om klant te wijzigen" style={{ color: inv.clientId ? 'var(--text)' : 'var(--text-3)' }}
                            onClick={e => { e.stopPropagation(); setListEdit({ invId: inv.id, field: 'client' }); }}>
                            {clientName(inv.clientId) || 'Geen klant'}
                          </div>
                        )}
                        <div className="truncate text-[11.5px]" style={{ color: 'var(--text-3)' }}>{(inv.items || [])[0]?.description}</div>
                      </td>
                      <td>{dateCell(inv, 'issueDate', 'factuurdatum')}</td>
                      <td>{status === 'paid' ? dateCell(inv, 'paidAt', 'betaaldatum', 'var(--success)') : dateCell(inv, 'dueDate', 'vervaldatum', status === 'overdue' ? 'var(--danger)' : undefined)}</td>
                      <td>
                        <Badge status={status} />
                        {status === 'overdue' && overdueDays > 0 && <div className="text-[11px] mt-0.5" style={{ color: 'var(--danger)' }}>{overdueDays} dagen te laat</div>}
                      </td>
                      <td className="r">
                        <div className="text-[14px] font-medium"><Money value={total} currency={inv.currency || 'EUR'} /></div>
                        {status === 'partial' && <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>nog <Money value={open} /></div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ color: 'var(--text-3)', fontWeight: 500 }}>{listed.length} {listed.length === 1 ? 'factuur' : 'facturen'}</td>
                  <td className="r"><Money value={listedTotal} /></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobiel: compacte rijen */}
          <div className="md:hidden">
            {listed.map(inv => {
              const status = computeInvoiceStatus(inv);
              return (
                <button key={inv.id} onClick={() => setView({ mode: 'view', invoice: inv })}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left" style={{ borderBottom: '1px solid var(--border)', background: 'none', cursor: 'pointer' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="num text-[12.5px]" style={{ color: 'var(--text-2)' }}>{inv.number || 'geen nr.'}</span><Badge status={status} /></div>
                    <div className="truncate text-[14px] mt-0.5" style={{ color: 'var(--text)' }}>{clientName(inv.clientId) || 'Geen klant'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-medium"><Money value={computeInvoice(inv.items).total} currency={inv.currency || 'EUR'} /></div>
                    <div className="num text-[11.5px]" style={{ color: 'var(--text-3)' }}>{fmtDate(inv.issueDate)}</div>
                  </div>
                </button>
              );
            })}
            <div className="flex justify-between px-4 py-3 text-[13px] font-semibold"><span style={{ color: 'var(--text-3)' }}>{listed.length} facturen</span><Money value={listedTotal} /></div>
          </div>
        </Card>
      )}
    </div>
  );
};

// ============================================================================
// INVOICE EDITOR
// ============================================================================
const InvoiceEditor = ({ invoice, clients, setClients, settings, activeEntity, nextNumberPreview, onSave, onCancel }) => {
  const { t } = useLang();
  const paymentTerms = activeEntity?.paymentTerms || settings.invoice?.paymentTerms || 14;
  const jurisdiction = JURISDICTIONS[activeEntity?.jurisdiction || 'NL'] || JURISDICTIONS.NL;
  const defaultBtw = jurisdiction.salesTax.standard;
  const taxName = jurisdiction.salesTax.name; // 'BTW', 'VAT', 'ITBIS', etc.
  const taxRates = jurisdiction.salesTax.rates; // e.g. [0,9,21]
  const isNL = jurisdiction.code === 'NL';
  const [form, setForm] = useState({
    clientId: '', issueDate: todayISO(), dueDate: addDays(todayISO(), paymentTerms),
    items: [{ description: '', quantity: 1, price: 0, btwRate: defaultBtw, discount: null }],
    notes: '', reference: '',
    currency: settings.invoice?.currency || 'EUR',
    language: settings.invoice?.language || 'nl',
    vatTreatment: deriveInvoiceVatTreatment(clients.find(c => c.id === invoice?.clientId)),
    ...invoice,
  });
  const [deliveryMode, setDeliveryMode] = useState(invoice?.periodFrom || invoice?.periodTo ? 'period' : invoice?.deliveryDate ? 'date' : 'none');
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState('');
  const [addingClient, setAddingClient] = useState(false);
  const [aiLinesLoading, setAiLinesLoading] = useState(false);
  const [aiLinesError, setAiLinesError] = useState('');
  const aiLinesInputRef = useRef(null);

  const update = (key, val) => setForm({ ...form, [key]: val });
  const zeroRated = isNL && isZeroRatedTreatment(form.vatTreatment);
  const lineDefaultBtw = zeroRated ? 0 : defaultBtw;

  // BTW-behandeling toepassen: verlegd / buiten EU → alle regels 0%; terug naar NL → standaardtarief
  const applyTreatment = (treatment, f) => ({
    ...f,
    vatTreatment: treatment,
    items: f.items.map(it => ({
      ...it,
      btwRate: isZeroRatedTreatment(treatment) ? 0 : (isZeroRatedTreatment(f.vatTreatment) ? defaultBtw : it.btwRate),
    })),
  });
  const handleClientChange = (clientId, clientObj) => {
    const c = clientObj || clients.find(x => x.id === clientId);
    setForm(f => {
      const next = { ...f, clientId };
      return isNL && c ? applyTreatment(deriveInvoiceVatTreatment(c), next) : next;
    });
  };

  // Koers op factuurdatum (EUR per 1 eenheid vreemde valuta). Voorinvullen, altijd aanpasbaar.
  const prefillRate = async (cur) => {
    if (!cur || cur === 'EUR') return;
    setRateLoading(true);
    setRateError('');
    try {
      let data;
      try { data = await fetchExchangeRates('EUR'); }
      catch (err) { if (settings.exchangeRates?.base === 'EUR' && settings.exchangeRates?.rates?.[cur]) data = settings.exchangeRates; else throw err; }
      const perEur = Number(data?.rates?.[cur]);
      if (!perEur) throw new Error('Geen koers gevonden');
      setForm(f => (f.currency === cur ? { ...f, exchangeRate: +(1 / perEur).toFixed(6) } : f));
    } catch (_) {
      setRateError('Koers ophalen lukte niet — vul hem zelf in.');
    } finally {
      setRateLoading(false);
    }
  };
  const handleCurrencyChange = (cur) => {
    setForm(f => ({ ...f, currency: cur, exchangeRate: cur === 'EUR' ? undefined : f.exchangeRate }));
    if (cur !== 'EUR') prefillRate(cur);
  };
  const setDelivery = (mode) => {
    setDeliveryMode(mode);
    setForm(f => ({
      ...f,
      deliveryDate: mode === 'date' ? (f.deliveryDate || f.issueDate) : undefined,
      periodFrom: mode === 'period' ? f.periodFrom : undefined,
      periodTo: mode === 'period' ? f.periodTo : undefined,
    }));
  };
  const updateItem = (idx, key, val) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [key]: val };
    setForm({ ...form, items });
  };
  const updateItemDiscount = (idx, key, val) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], discount: { type: 'percent', value: 0, name: '', ...items[idx].discount, [key]: val } };
    setForm({ ...form, items });
  };
  const toggleDiscount = (idx) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], discount: items[idx].discount ? null : { type: 'percent', value: 0, name: '' } };
    setForm({ ...form, items });
  };
  const addItem = () => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, price: 0, btwRate: lineDefaultBtw, discount: null }] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const handleAiFillLines = async (e) => {
    const file = e.target.files?.[0];
    if (aiLinesInputRef.current) aiLinesInputRef.current.value = '';
    if (!file) return;
    setAiLinesLoading(true);
    setAiLinesError('');
    try {
      const dataUrl = await resizeImage(file, 1800, 0.85);
      const result = await callClaudeVisionForInvoiceLines({
        imageDataUrl: dataUrl,
        apiKey: settings.apiKey,
        openaiApiKey: settings.openaiApiKey,
        clientNames: clients.map(c => c.name),
      });
      const newItems = result.items.map(it => ({
        description: it.description || '',
        quantity: Number(it.quantity) || 1,
        price: Number(it.price) || 0,
        btwRate: lineDefaultBtw,
        discount: null,
      }));
      setForm(f => {
        const existingIsEmpty = f.items.length === 1 && !f.items[0].description && !f.items[0].price;
        const items = existingIsEmpty ? newItems : [...f.items, ...newItems];
        const match = result.client && clients.find(c => c.name.toLowerCase() === result.client.toLowerCase());
        return { ...f, items, clientId: f.clientId || (match ? match.id : f.clientId) };
      });
    } catch (err) {
      setAiLinesError(err.message || t('editor.aiFillError'));
    } finally {
      setAiLinesLoading(false);
    }
  };

  // Aantallen/prijzen mogen als tekst met komma worden ingevoerd; rekenen gebeurt op de genormaliseerde regels
  const normItems = form.items.map(it => ({ ...it, quantity: parseDecimal(it.quantity), price: parseDecimal(it.price) }));
  const totals = computeInvoice(normItems);
  const selectedClient = clients.find(c => c.id === form.clientId);
  const isForeign = (form.currency || 'EUR') !== 'EUR';
  const rateNum = parseDecimal(form.exchangeRate);
  const allZeroRate = Object.keys(totals.btwByRate).length > 0 && Object.keys(totals.btwByRate).every(r => Number(r) === 0);

  const isValid = form.clientId && form.items.length > 0 && form.items.every(i => i.description) && form.issueDate;
  const handleSubmit = () => {
    if (!isValid) return;
    if (isForeign && !(rateNum > 0) && !window.confirm(`Er is geen koers ingevuld voor ${form.currency}. Zonder koers telt deze factuur 1-op-1 mee in je BTW-aangifte. Toch opslaan?`)) return;
    onSave({
      ...form,
      items: normItems,
      vatTreatment: isNL ? form.vatTreatment : undefined,
      exchangeRate: isForeign && rateNum > 0 ? rateNum : undefined,
      deliveryDate: deliveryMode === 'date' ? form.deliveryDate || undefined : undefined,
      periodFrom: deliveryMode === 'period' ? form.periodFrom || undefined : undefined,
      periodTo: deliveryMode === 'period' ? form.periodTo || undefined : undefined,
    });
  };
  return (
    <div className="space-y-5 invoice-editor">
      {/* iOS zoomt in op velden < 16px — op mobiel daarom 16px */}
      <style>{`@media (max-width: 767px) { .invoice-editor input, .invoice-editor select, .invoice-editor textarea { font-size: 16px !important; } }`}</style>
      <div className="flex items-center justify-between gap-4">
        <button onClick={onCancel} className="flex items-center gap-2 text-sm hover:underline" style={{ color: 'var(--ink-2)' }}>
          <ArrowLeft size={14} /> {t('editor.back')}
        </button>
      </div>

      <div>
        <h1 className="page-title">{form.id ? `${t('editor.titleEdit')} ${form.number}` : t('editor.titleNew')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {form.id ? t('editor.subtitleEdit') : `${t('editor.subtitleNew')}: ${nextNumberPreview} · ${activeEntity?.name}`}
        </p>
      </div>

      {addingClient && (
        <ClientForm
          client={{}}
          settings={settings}
          onSave={(data) => {
            const newClient = { ...data, id: generateId('cli'), createdAt: new Date().toISOString() };
            if (setClients) setClients(prev => [...prev, newClient]);
            handleClientChange(newClient.id, newClient);
            setAddingClient(false);
          }}
          onClose={() => setAddingClient(false)}
        />
      )}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="md:col-span-2 space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('editor.client')} *</label>
              <button onClick={() => setAddingClient(true)} className="flex items-center gap-1 text-xs hover:underline" style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <Plus size={11} /> {t('editor.newClient')}
              </button>
            </div>
            {clients.length === 0 ? (
              <div className="px-3 py-2 text-sm rounded border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                {t('editor.noClients')}
              </div>
            ) : (
              <select value={form.clientId} onChange={e => handleClientChange(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded border"
                style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }}>
                <option value="">{t('editor.selectClient')}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>{t('editor.currency')}</label>
            <select value={form.currency || 'EUR'} onChange={e => handleCurrencyChange(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border"
              style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }}>
              {Object.entries(CURRENCIES).map(([code, cfg]) => (
                <option key={code} value={code}>{cfg.label}</option>
              ))}
            </select>
          </div>
          {isForeign && (
            <div>
              <Input
                label={`Koers op factuurdatum (EUR per 1 ${form.currency})`}
                type="text" inputMode="decimal"
                value={form.exchangeRate ?? ''}
                onChange={e => update('exchangeRate', e.target.value)}
                placeholder="bv. 0,92"
                error={rateError || undefined}
                hint={rateLoading ? 'Koers ophalen…' : rateNum > 0 ? `BTW in EUR: ${fmtCurrency(roundMoney(totals.btwTotal * rateNum), 'EUR')}` : 'Nodig voor je BTW-aangifte (bedragen in EUR).'}
              />
              <button type="button" onClick={() => prefillRate(form.currency)} className="text-xs mt-1 hover:underline" style={{ color: 'var(--accent)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                Actuele koers ophalen
              </button>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>{t('editor.invoiceLang')}</label>
            <select value={form.language || 'nl'} onChange={e => update('language', e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border"
              style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }}>
              <option value="nl">🇳🇱 Nederlands</option>
              <option value="en">🇬🇧 English</option>
              <option value="es">🇪🇸 Español</option>
              <option value="de">🇩🇪 Deutsch</option>
            </select>
          </div>
          <Input label={t('editor.reference')} value={form.reference || ''} onChange={e => update('reference', e.target.value)} placeholder={t('editor.referencePlaceholder')} />
          {jurisdiction.code === 'DR' && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>NCF (DGII) *</label>
              <input value={form.ncf || ''} onChange={e => update('ncf', e.target.value)}
                placeholder="B01-00000001" maxLength={13}
                className="w-full px-3 py-2 text-sm rounded border font-mono"
                style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border)' }} />
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Número de Comprobante Fiscal · B01 crédito fiscal · B02 consumidor final · B14 especial</p>
            </div>
          )}
          <Input label={`${t('editor.issueDate')} *`} type="date" value={form.issueDate} onChange={e => {
            update('issueDate', e.target.value);
            if (!form.dueDate || daysBetween(form.issueDate, form.dueDate) === paymentTerms) {
              setForm(f => ({ ...f, issueDate: e.target.value, dueDate: addDays(e.target.value, paymentTerms) }));
            }
          }} />
          <Input label={`${t('editor.dueDate')} *`} type="date" value={form.dueDate} onChange={e => update('dueDate', e.target.value)} />
          <div>
            <Select label="Levering" value={deliveryMode} onChange={e => setDelivery(e.target.value)}>
              <option value="none">Zelfde als factuurdatum</option>
              <option value="date">Andere leverdatum</option>
              <option value="period">Periode (bv. maand)</option>
            </Select>
          </div>
          {deliveryMode === 'date' && (
            <Input label="Leverdatum" type="date" value={form.deliveryDate || ''} onChange={e => update('deliveryDate', e.target.value)} />
          )}
          {deliveryMode === 'period' && (
            <div className="grid grid-cols-2 gap-2">
              <Input label="Periode van" type="date" value={form.periodFrom || ''} onChange={e => update('periodFrom', e.target.value)} />
              <Input label="t/m" type="date" value={form.periodTo || ''} onChange={e => update('periodTo', e.target.value)} />
            </div>
          )}
          {isNL && (
            <div>
              <Select label="BTW-behandeling" value={form.vatTreatment === 'eu_no_vatid' ? 'domestic' : (form.vatTreatment || 'domestic')}
                onChange={e => setForm(f => applyTreatment(e.target.value, f))}>
                <option value="domestic">Nederlandse BTW</option>
                <option value="reverse_eu">BTW verlegd (ondernemer in EU)</option>
                <option value="outside_eu">Buiten de EU (niet belast in NL)</option>
              </Select>
            </div>
          )}
          {isNL && form.clientId && (form.vatTreatment === 'reverse_eu' || form.vatTreatment === 'outside_eu' || form.vatTreatment === 'eu_no_vatid') && (
            <div className="md:col-span-3 rounded-[9px] px-3 py-2.5 text-[12.5px] flex items-start gap-2"
              style={form.vatTreatment === 'eu_no_vatid' || (form.vatTreatment === 'reverse_eu' && !selectedClient?.btw)
                ? { background: 'var(--warning-soft)', color: 'var(--warning)' }
                : { background: 'var(--info-soft)', color: 'var(--info)' }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <div>
                {form.vatTreatment === 'reverse_eu' && (selectedClient?.btw
                  ? <>BTW verlegd: klant is ondernemer in {selectedClient.country} ({selectedClient.btw}). Alle regels staan op 0% en de factuur vermeldt "BTW verlegd". Telt mee in rubriek 3b en je ICP-opgave.</>
                  : <>BTW verlegd gekozen, maar deze klant heeft geen BTW-id. Vul het BTW-id in bij de klant — zonder geldig BTW-id mag je de BTW niet verleggen.</>)}
                {form.vatTreatment === 'outside_eu' && <>Klant buiten de EU: alle regels staan op 0% en de factuur vermeldt "Niet belast in Nederland". Telt mee in rubriek 1e.</>}
                {form.vatTreatment === 'eu_no_vatid' && <>Klant in {selectedClient?.country} zonder BTW-id: er wordt Nederlandse BTW gerekend (particulier). Is het een bedrijf? Vul dan het BTW-id in bij de klant om de BTW te verleggen.</>}
              </div>
            </div>
          )}
          <div className="flex items-end">
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              {t('editor.paymentTerms')}: <strong className="num" style={{ color: 'var(--ink)' }}>{form.dueDate && form.issueDate ? daysBetween(form.issueDate, form.dueDate) : 0}</strong> {t('editor.paymentTermsDays')}
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">{t('editor.lines')}</h3>
            <div className="flex items-center gap-2">
              <input ref={aiLinesInputRef} type="file" accept="image/*" className="hidden" onChange={handleAiFillLines} />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => aiLinesInputRef.current?.click()}
                disabled={aiLinesLoading}
                title={t('editor.aiFillHint')}
              >
                {aiLinesLoading ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {t('editor.aiFill')}
              </Button>
              <Button size="sm" variant="secondary" onClick={addItem}><Plus size={12} /> {t('editor.addLine')}</Button>
            </div>
          </div>
          {aiLinesError && (
            <div className="mb-3 px-3 py-2 text-xs rounded border flex items-center gap-2" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
              <AlertCircle size={13} /> {aiLinesError}
            </div>
          )}
          {/* Desktop tabel — verborgen op mobiel */}
          <div className="hidden md:block overflow-x-auto scrollable">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                  <th className="text-left py-2 font-medium">{t('editor.colDescription')}</th>
                  <th className="text-right py-2 font-medium w-20">{t('editor.colQty')}</th>
                  <th className="text-right py-2 font-medium w-28">{t('editor.colPrice')}</th>
                  <th className="text-right py-2 font-medium w-20">{taxName}</th>
                  <th className="text-right py-2 font-medium w-28">{t('editor.colTotal')}</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {form.items.map((item, idx) => {
                  const line = computeLine(normItems[idx]);
                  const hasDiscount = !!item.discount;
                  return (
                    <React.Fragment key={idx}>
                      <tr>
                        <td className="py-2 pr-2">
                          <input
                            value={item.description}
                            onChange={e => updateItem(idx, 'description', e.target.value)}
                            placeholder={t('editor.descPlaceholder')}
                            className="w-full px-2 py-1.5 text-sm bg-transparent rounded border"
                            style={{ borderColor: 'var(--border)' }}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.quantity}
                            onChange={e => updateItem(idx, 'quantity', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm text-right bg-transparent rounded border num"
                            style={{ borderColor: 'var(--border)' }}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.price}
                            onChange={e => updateItem(idx, 'price', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm text-right bg-transparent rounded border num"
                            style={{ borderColor: 'var(--border)' }}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            value={item.btwRate}
                            onChange={e => updateItem(idx, 'btwRate', Number(e.target.value))}
                            className="w-full px-1 py-1.5 text-xs bg-transparent rounded border"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            {taxRates.map(r => <option key={r} value={r}>{r}%</option>)}
                          </select>
                        </td>
                        <td className="py-2 text-right num font-medium">
                          {fmtCurrency(line.net, form.currency)}
                          {line.discount > 0 && <div className="text-[10px] line-through" style={{ color: 'var(--muted)' }}>{fmtCurrency(line.base, form.currency)}</div>}
                        </td>
                        <td className="py-2 pl-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleDiscount(idx)}
                              className={`text-[11px] font-medium rounded px-1.5 py-0.5 whitespace-nowrap transition-colors ${hasDiscount ? 'hover:bg-red-50' : 'hover:bg-[color:var(--surface-2)]'}`}
                              style={{ color: hasDiscount ? 'var(--accent)' : 'var(--muted)' }}
                              title={hasDiscount ? 'Korting verwijderen' : 'Korting toevoegen'}
                            >
                              {hasDiscount ? t('editor.discountRemove') : t('editor.discountAdd')}
                            </button>
                            {form.items.length > 1 && (
                              <button onClick={() => removeItem(idx)} className="p-1 rounded hover:bg-red-50">
                                <X size={14} style={{ color: 'var(--danger)' }} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {hasDiscount && (
                        <tr style={{ background: 'var(--accent-soft)' }}>
                          <td colSpan={6} className="px-2 py-2">
                            <div className="flex items-center gap-2 text-xs flex-wrap">
                              <Tag size={12} style={{ color: 'var(--accent)' }} />
                              <span className="font-medium" style={{ color: 'var(--accent)' }}>Korting:</span>
                              <input
                                value={item.discount.name || ''}
                                onChange={e => updateItemDiscount(idx, 'name', e.target.value)}
                                placeholder="Naam (bv. 'Vroege betaler')"
                                className="flex-1 min-w-[120px] px-2 py-1 rounded border text-xs"
                                style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--ink)' }}
                              />
                              <select
                                value={item.discount.type}
                                onChange={e => updateItemDiscount(idx, 'type', e.target.value)}
                                className="px-2 py-1 bg-white rounded border text-xs"
                                style={{ borderColor: 'var(--border)' }}
                              >
                                <option value="percent">%</option>
                                <option value="amount">€</option>
                              </select>
                              <input
                                type="number"
                                step="0.01"
                                value={item.discount.value}
                                onChange={e => updateItemDiscount(idx, 'value', parseDecimal(e.target.value))}
                                className="w-20 px-2 py-1 bg-white rounded border text-xs text-right num"
                                style={{ borderColor: 'var(--border)' }}
                              />
                              <span className="num text-xs" style={{ color: 'var(--accent)' }}>−{fmtCurrency(line.discount, form.currency)}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobiele kaartweergave per lijnregel — verborgen op desktop */}
          <div className="md:hidden space-y-3">
            {form.items.map((item, idx) => {
              const line = computeLine(normItems[idx]);
              const hasDiscount = !!item.discount;
              return (
                <div key={idx} className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <input
                      value={item.description}
                      onChange={e => updateItem(idx, 'description', e.target.value)}
                      placeholder="Omschrijving werk/product..."
                      className="flex-1 px-2 py-1.5 text-sm bg-transparent rounded border"
                      style={{ borderColor: 'var(--border)' }}
                    />
                    {form.items.length > 1 && (
                      <button onClick={() => removeItem(idx)} className="p-1.5 rounded flex-shrink-0" style={{ color: 'var(--danger)' }}>
                        <X size={15} />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[10px] font-medium mb-1" style={{ color: 'var(--muted)' }}>{t('editor.colQty')}</div>
                      <input
                        type="text" inputMode="decimal" value={item.quantity}
                        onChange={e => updateItem(idx, 'quantity', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-right bg-transparent rounded border num"
                        style={{ borderColor: 'var(--border)' }}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-medium mb-1" style={{ color: 'var(--muted)' }}>{t('editor.colPrice')}</div>
                      <input
                        type="text" inputMode="decimal" value={item.price}
                        onChange={e => updateItem(idx, 'price', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm text-right bg-transparent rounded border num"
                        style={{ borderColor: 'var(--border)' }}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] font-medium mb-1" style={{ color: 'var(--muted)' }}>{taxName}</div>
                      <select
                        value={item.btwRate}
                        onChange={e => updateItem(idx, 'btwRate', Number(e.target.value))}
                        className="w-full px-1 py-1.5 text-xs bg-transparent rounded border"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        {taxRates.map(r => <option key={r} value={r}>{r}%</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <button
                      onClick={() => toggleDiscount(idx)}
                      className="text-[11px] font-medium"
                      style={{ color: hasDiscount ? 'var(--accent)' : 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {hasDiscount ? t('editor.discountRemoveMobile') : t('editor.discountAdd')}
                    </button>
                    <span className="text-sm num font-semibold" style={{ color: 'var(--text)' }}>
                      {fmtCurrency(line.net, form.currency)}
                      {line.discount > 0 && <span className="text-[10px] line-through ml-1" style={{ color: 'var(--muted)' }}>{fmtCurrency(line.base, form.currency)}</span>}
                    </span>
                  </div>
                  {hasDiscount && (
                    <div className="rounded p-2 space-y-1.5" style={{ background: 'var(--accent-soft)' }}>
                      <div className="text-[10px] font-medium" style={{ color: 'var(--accent)' }}>{t('editor.discountLabel')}</div>
                      <div className="flex gap-2">
                        <input
                          value={item.discount.name || ''}
                          onChange={e => updateItemDiscount(idx, 'name', e.target.value)}
                          placeholder="Naam korting"
                          className="flex-1 px-2 py-1 rounded border text-xs"
                          style={{ borderColor: 'var(--border)' }}
                        />
                        <select
                          value={item.discount.type}
                          onChange={e => updateItemDiscount(idx, 'type', e.target.value)}
                          className="px-2 py-1 rounded border text-xs w-14"
                          style={{ borderColor: 'var(--border)' }}
                        >
                          <option value="percent">%</option>
                          <option value="amount">€</option>
                        </select>
                        <input
                          type="number" step="0.01" value={item.discount.value}
                          onChange={e => updateItemDiscount(idx, 'value', parseDecimal(e.target.value))}
                          className="w-20 px-2 py-1 rounded border text-xs text-right num"
                          style={{ borderColor: 'var(--border)' }}
                        />
                      </div>
                      <div className="text-xs num text-right" style={{ color: 'var(--accent)' }}>−{fmtCurrency(line.discount, form.currency)}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Textarea label={t('editor.notes')} rows={4} value={form.notes} onChange={e => update('notes', e.target.value)} placeholder={t('editor.notesPlaceholder')} />
          </div>
          <div className="space-y-2 text-sm">
            {totals.totalDiscount > 0 && (
              <>
                <div className="flex justify-between py-1 text-xs" style={{ color: 'var(--muted)' }}>
                  <span>Bruto subtotaal</span>
                  <span className="num">{fmtCurrency(totals.subtotal + totals.totalDiscount, form.currency)}</span>
                </div>
                <div className="flex justify-between py-1" style={{ color: 'var(--accent)' }}>
                  <span>{t('editor.totalDiscount')}</span>
                  <span className="num">−{fmtCurrency(totals.totalDiscount, form.currency)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between py-1.5">
              <span style={{ color: 'var(--muted)' }}>{t('editor.subtotal')}</span>
              <span className="num font-medium">{fmtCurrency(totals.subtotal, form.currency)}</span>
            </div>
            {Object.entries(totals.btwByRate).map(([rate, amt]) => (Number(rate) > 0 || allZeroRate) && (
              <div key={rate} className="flex justify-between py-1.5">
                <span style={{ color: 'var(--muted)' }}>{taxName} {rate}%{Number(rate) === 0 && zeroRated ? (form.vatTreatment === 'reverse_eu' ? ' (verlegd)' : ' (niet belast in NL)') : ''}</span>
                <span className="num font-medium">{fmtCurrency(amt, form.currency)}</span>
              </div>
            ))}
            <div className="flex justify-between py-2.5 border-t-2 mt-2" style={{ borderColor: 'var(--ink)' }}>
              <span className="font-display text-lg">{t('editor.total')}</span>
              <span className="font-display text-xl num font-medium">{fmtCurrency(totals.total, form.currency)}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>{t('editor.cancel')}</Button>
        <Button onClick={handleSubmit} disabled={!isValid}>
          <Save size={14} /> {t('editor.save')}
        </Button>
      </div>
    </div>
  );
};

// ============================================================================
// INVOICE DETAIL VIEW (with PDF preview)
// ============================================================================
// Papierkleuren voor de factuur-preview: de templates gebruiken var(--ink)/var(--muted)/var(--border),
// die in de app (dark mode) licht zijn. Op de witte "papier"-kaart zetten we ze vast op printkleuren.
const PAPER_VARS = {
  '--text': '#1a1a1a', '--text-2': '#4a4a4a', '--text-3': '#888888',
  '--ink': '#1a1a1a', '--ink-2': '#4a4a4a', '--muted': '#888888',
  '--surface': '#ffffff', '--surface-2': '#f9fafb', '--surface-3': '#f3f4f6',
  '--border': '#e5e7eb', '--border-2': '#d1d5db', '--border-3': '#9ca3af',
  background: '#fff', color: '#1a1a1a',
};

const InvoiceDetail = ({ invoice, clients, settings, activeEntity, entities, onClose, onEdit, onDelete, onStatusChange, onDuplicate, onSendReminder, onCreateCreditNote, onRegisterPayment, onUpdateInvoice }) => {
  const { t } = useLang();
  const [showSendModal, setShowSendModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(null); // null | 'partial' | 'full'
  const [changingClient, setChangingClient] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const client = clients.find(c => c.id === invoice.clientId);
  const totals = computeInvoice(invoice.items);
  const creditNote = isCreditNote(invoice);
  const shownNumber = displayInvoiceNumber(invoice);

  // Partial payment state
  const payments = invoice.payments || [];
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const credited = Number(invoice.creditedAmount || 0);
  const remaining = Math.max(0, roundMoney(totals.total - totalPaid - credited));
  const status = computeInvoiceStatus(invoice);
  // Pick the entity this invoice belongs to (or fall back to active)
  const invoiceEntity = entities?.find(e => e.id === invoice.entityId) || activeEntity;
  // If the entity is a label, resolve its parent for legal/financial data on the invoice
  const invoiceParentEntity = invoiceEntity?.parentId
    ? entities?.find(e => e.id === invoiceEntity.parentId)
    : null;
  // Legal entity (same logic as InvoiceFooter) used to check IBAN for QR
  const qrLegalEntity = (invoiceEntity?.type === 'label' && invoiceParentEntity) ? invoiceParentEntity : invoiceEntity;
  const qrMissingIban = !qrLegalEntity?.iban;

  // Preview schaalt mee met de schermbreedte (geen horizontaal scrollen op mobiel)
  const previewWrapRef = useRef(null);
  const previewInnerRef = useRef(null);
  const [preview, setPreview] = useState({ scale: 1, height: null });
  useEffect(() => {
    const wrap = previewWrapRef.current;
    const inner = previewInnerRef.current;
    if (!wrap || !inner) return;
    const measure = () => {
      const scale = Math.min(1, wrap.clientWidth / 800);
      setPreview({ scale, height: scale < 1 ? inner.offsetHeight * scale : null });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const handlePrint = async () => {
    const el = document.querySelector('.invoice-printable');
    if (!el) { window.print(); return; }

    // Venster direct openen, vóór elke await — anders blokkeren Safari/iOS de pop-up
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) {
      window.alert('Je browser blokkeert het printvenster. Sta pop-ups toe voor deze site en probeer het opnieuw.');
      return;
    }
    const title = escapeHtml(`${creditNote ? 'Creditnota' : 'Factuur'} ${shownNumber}`.trim());
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:-apple-system,sans-serif;padding:40px;color:#888">PDF voorbereiden…</body></html>`);

    // De gecompileerde CSS van de app meenemen (geen CDN nodig bij het printen)
    let appCss = '';
    for (const sheet of Array.from(document.styleSheets)) {
      try { appCss += Array.from(sheet.cssRules).map(r => r.cssText).join('\n') + '\n'; }
      catch (_) { /* cross-origin sheet (bv. Google Fonts) — fonts laden we hieronder zelf */ }
    }

    // Externe afbeeldingen (QR, logo) omzetten naar data-URLs zodat ze betrouwbaar printen
    const clone = el.cloneNode(true);
    await Promise.all(Array.from(clone.querySelectorAll('img[src^="http"]')).map(img => new Promise(resolve => {
      const proxy = new Image();
      proxy.crossOrigin = 'anonymous';
      proxy.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = proxy.naturalWidth; c.height = proxy.naturalHeight;
          c.getContext('2d').drawImage(proxy, 0, 0);
          img.src = c.toDataURL('image/png');
        } catch (_) { /* tainted canvas: originele URL houden */ }
        resolve();
      };
      proxy.onerror = resolve;
      proxy.src = img.src;
    })));

    if (w.closed) return;
    const fontsHref = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600&display=swap';
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <link id="print-fonts" rel="stylesheet" href="${fontsHref}">
  <style>${appCss.replace(/<\/style/gi, '<\\/style')}</style>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; color: #1a1a1a !important; }
    body { font-family: 'Inter', -apple-system, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    @page { size: A4; margin: 12mm; }
    html body .invoice-printable {
      position: static !important; visibility: visible !important; padding: 0 !important; margin: 0 auto !important;
      max-width: 800px !important; min-width: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
    }
    html body .invoice-printable * { visibility: visible !important; }
    html body .invoice-printable > div { min-height: 0 !important; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    .invoice-footer { break-inside: avoid; }
  </style>
</head>
<body>
${clone.outerHTML}
</body>
</html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();

    const wd = w.document;
    const timeout = (ms) => new Promise(r => setTimeout(r, ms));
    const fontsLink = wd.getElementById('print-fonts');
    const linkLoaded = new Promise(r => {
      if (!fontsLink || fontsLink.sheet) return r();
      fontsLink.addEventListener('load', r); fontsLink.addEventListener('error', r);
    });
    const imagesLoaded = Promise.all(Array.from(wd.images).map(img => img.complete ? null : new Promise(r => {
      img.addEventListener('load', r); img.addEventListener('error', r);
    })));
    await Promise.race([Promise.all([linkLoaded, imagesLoaded]), timeout(5000)]);
    try { await Promise.race([wd.fonts?.ready, timeout(3000)]); } catch (_) { /* geen FontFaceSet */ }
    if (w.closed) return;
    w.focus();
    w.print();
  };

  // ── Acties ─────────────────────────────────────────────────────────────────
  const isOpen = status === 'sent' || status === 'overdue' || status === 'partial';
  const primary = [];
  const more = [];
  if (status === 'draft') primary.push({ key: 'edit', label: t('detail.edit'), icon: Edit3, variant: 'secondary', onClick: () => onEdit(invoice) });
  primary.push({ key: 'pdf', label: t('detail.downloadPdf'), icon: Download, variant: 'secondary', onClick: handlePrint });
  if (status === 'draft') primary.push({ key: 'send', label: 'Versturen', icon: Send, onClick: () => setShowSendModal(true) });
  if (isOpen && onRegisterPayment) {
    primary.push({ key: 'payment', label: t('detail.registerPayment'), icon: Wallet, variant: 'secondary', onClick: () => setPaymentModal('partial') });
    primary.push({ key: 'paid', label: t('detail.markPaid'), icon: Check, onClick: () => setPaymentModal('full') });
  }
  if (isOpen) more.push({ key: 'resend', label: 'Opnieuw versturen', icon: Send, onClick: () => setShowSendModal(true) });
  if (status === 'draft') more.push({
    key: 'markSent', label: 'Markeer als verstuurd', icon: CheckCircle2,
    onClick: () => { if (window.confirm(t('detail.markSentConfirm'))) onStatusChange(invoice.id, 'sent', { sentAt: new Date().toISOString() }); },
  });
  more.push({ key: 'dup', label: t('detail.duplicate'), icon: Copy, onClick: () => onDuplicate(invoice) });
  if (!creditNote && status !== 'draft' && onCreateCreditNote) {
    more.push({ key: 'cn', label: 'Creditnota maken', icon: FileCheck2, onClick: () => onCreateCreditNote(invoice) });
  }
  if (status === 'paid') more.push({ key: 'unpaid', label: t('detail.markUnpaid'), icon: X, onClick: () => onStatusChange(invoice.id, 'sent', { paidAt: null, paidAmount: 0, payments: [] }) });
  if (onUpdateInvoice) {
    more.push({
      key: 'nr', label: invoice.number ? t('detail.changeNr') : t('detail.enterNr'), icon: Edit3,
      tone: !invoice.number ? 'var(--warning)' : undefined,
      onClick: () => {
        const nr = window.prompt('Factuurnummer:', invoice.number || '');
        if (nr !== null && nr.trim() !== '') onUpdateInvoice(invoice.id, { number: nr.trim() });
      },
    });
    more.push({ key: 'client', label: t('detail.changeClient'), icon: Edit3, onClick: () => setChangingClient(true) });
    if (!creditNote) more.push({
      key: 'qr', icon: Hash,
      label: invoice.qrEnabled === false ? t('detail.qrOff') : invoice.qrEnabled ? (qrMissingIban ? t('detail.qrNoIban') : t('detail.qrOn')) : t('detail.qrDefault'),
      title: invoice.qrEnabled && qrMissingIban
        ? 'QR aan maar geen IBAN ingesteld — ga naar Instellingen › Entiteiten en voeg IBAN toe'
        : invoice.currency && invoice.currency !== 'EUR'
          ? `QR uitgeschakeld — SEPA QR werkt alleen voor EUR (deze factuur is in ${invoice.currency})`
          : invoice.qrEnabled === false ? 'QR code verborgen' : invoice.qrEnabled ? 'QR code aan — klik om te verwijderen' : 'QR code volgt template instelling',
      tone: invoice.qrEnabled ? (qrMissingIban ? 'var(--warning)' : 'var(--success)') : invoice.qrEnabled === false ? 'var(--danger)' : undefined,
      onClick: () => onUpdateInvoice(invoice.id, { qrEnabled: invoice.qrEnabled === false ? undefined : invoice.qrEnabled ? false : true }),
    });
  }
  more.push({ key: 'delete', label: 'Verwijderen', icon: Trash2, danger: true, onClick: () => onDelete(invoice.id) });

  return (
    <div className="space-y-5">
      <div className="no-print flex items-center justify-between gap-3 flex-wrap">
        <button onClick={onClose} className="flex items-center gap-2 text-sm hover:underline" style={{ color: 'var(--ink-2)' }}>
          <ArrowLeft size={14} /> {t('detail.backToList')}
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {changingClient && onUpdateInvoice && (
            <div className="flex items-center gap-1">
              <select
                defaultValue={invoice.clientId || ''}
                autoFocus
                aria-label="Klant"
                className="h-8 px-2 text-[13px] rounded-[8px] border"
                onChange={e => {
                  onUpdateInvoice(invoice.id, { clientId: e.target.value || null });
                  setChangingClient(false);
                }}
              >
                <option value="">{t('detail.noClient')}</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.company || c.email || c.id}</option>)}
              </select>
              <Button size="sm" variant="ghost" onClick={() => setChangingClient(false)} aria-label="Annuleren"><X size={13} /></Button>
            </div>
          )}
          {/* Secundaire acties: inline op desktop */}
          <div className="hidden lg:flex flex-wrap items-center gap-2">
            {more.map(a => (
              <Button key={a.key} size="sm" variant={a.danger ? 'danger' : 'secondary'} onClick={a.onClick} title={a.title || a.label}
                aria-label={a.label} style={a.tone ? { borderColor: a.tone, color: a.tone } : undefined}>
                <a.icon size={13} /> {a.danger ? null : a.label}
              </Button>
            ))}
          </div>
          {/* …en in een "Meer"-menu op kleinere schermen */}
          <div className="relative lg:hidden">
            <Button size="sm" variant="secondary" onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen} aria-haspopup="menu">
              Meer <ChevronDown size={13} />
            </Button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                <div role="menu" className="absolute right-0 mt-1 z-50 min-w-[220px] py-1 rounded-[10px]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', boxShadow: 'var(--shadow-pop)' }}>
                  {more.map(a => (
                    <button key={a.key} role="menuitem" title={a.title}
                      onClick={() => { setMoreOpen(false); a.onClick(); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-[14px] hover:bg-[color:var(--surface-2)]"
                      style={{ color: a.danger ? 'var(--danger)' : a.tone || 'var(--text)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      <a.icon size={14} /> {a.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {primary.map(a => (
            <Button key={a.key} size="sm" variant={a.variant || 'primary'} onClick={a.onClick}>
              <a.icon size={13} /> {a.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="no-print flex items-center gap-3 flex-wrap">
        <h1 className="page-title">{creditNote ? 'Creditnota' : 'Factuur'} {invoice.number}</h1>
        {invoice.numberAsSent && invoice.numberAsSent !== invoice.number && (!creditNote || /^CN/i.test(invoice.numberAsSent)) && (
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }} title="Intern achtervoegsel; de klant kreeg dit nummer">
            verstuurd als {invoice.numberAsSent}
          </span>
        )}
        <Badge status={status} />
        {invoice.sentAt && <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('detail.sentOn')} {fmtDate(invoice.sentAt)}</span>}
        {invoice.paidAt && <span className="text-xs" style={{ color: 'var(--success)' }}>{t('detail.paidOn')} {fmtDate(invoice.paidAt)}</span>}
        {credited > 0 && !creditNote && (
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>Gecrediteerd: <Money value={credited} currency={invoice.currency || 'EUR'} /></span>
        )}
        {creditNote && invoice.creditNoteForNumber && (
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>voor factuur {invoice.creditNoteForNumber}</span>
        )}
      </div>

      {invoice.remindersSent && invoice.remindersSent.length > 0 && (
        <Card className="p-4 no-print">
          <h3 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>{t('detail.remindersTitle')}</h3>
          <div className="space-y-1.5">
            {invoice.remindersSent.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                <span>{settings.reminders.templates[r.level]?.name || `${t('detail.reminderFallback')} ${r.level + 1}`}</span>
                <span style={{ color: 'var(--muted)' }}>· {fmtDate(r.date)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Partial payments panel */}
      {payments.length > 0 && (
        <Card className="p-4 no-print">
          <h3 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: 'var(--muted)' }}>{t('detail.paymentsTitle')}</h3>
          <div className="space-y-1.5 mb-3">
            {payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                  <span>{fmtDate(p.date)}</span>
                  {p.note && <span style={{ color: 'var(--muted)' }}>— {p.note}</span>}
                </div>
                <span className="num font-medium" style={{ color: 'var(--success)' }}>{fmtCurrency(p.amount, invoice.currency)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-medium pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
            <span>{t('detail.paymentOutstanding')}</span>
            <span className="num" style={{ color: remaining > 0 ? 'var(--warning)' : 'var(--success)' }}>{fmtCurrency(remaining, invoice.currency)}</span>
          </div>
          {remaining > 0 && totals.total > 0 && (
            <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
              <div className="h-full rounded-full" style={{ background: 'var(--success)', width: `${Math.min(100, (totalPaid / totals.total) * 100)}%`, transition: 'width 0.4s' }} />
            </div>
          )}
        </Card>
      )}

      {/* Factuur-preview: schaalt mee op smalle schermen i.p.v. horizontaal te scrollen */}
      <div ref={previewWrapRef} style={{ width: '100%', overflow: 'hidden', height: preview.height ?? undefined }}>
        <div ref={previewInnerRef} style={preview.scale < 1 ? { width: 800, transform: `scale(${preview.scale})`, transformOrigin: 'top left' } : undefined}>
          <Card className="invoice-printable" style={{ maxWidth: 800, margin: '0 auto', overflow: 'hidden', ...PAPER_VARS }}>
            {renderTemplate(invoiceEntity?.templateId || 'classic', { invoice, entity: invoiceEntity, client, totals, parentEntity: invoiceParentEntity })}
          </Card>
        </div>
      </div>

      {showSendModal && (
        <SendInvoiceModal
          invoice={invoice}
          client={client}
          settings={settings}
          entity={invoiceEntity}
          legalEntity={qrLegalEntity}
          onDownloadPdf={handlePrint}
          onSend={(reminderLevel) => {
            if (reminderLevel !== undefined) {
              onSendReminder(invoice, reminderLevel);
            } else {
              onStatusChange(invoice.id, status === 'draft' ? 'sent' : invoice.status, { sentAt: new Date().toISOString() });
            }
            setShowSendModal(false);
          }}
          onClose={() => setShowSendModal(false)}
          mode="send"
        />
      )}

      {paymentModal && (
        <RegisterPaymentModal
          invoice={invoice}
          remaining={remaining}
          totals={totals}
          fullOnly={paymentModal === 'full'}
          onSave={(payment) => {
            onRegisterPayment(invoice, payment);
            setPaymentModal(null);
          }}
          onClose={() => setPaymentModal(null)}
        />
      )}
    </div>
  );
};

// ============================================================================
// REGISTER PAYMENT MODAL
// ============================================================================
// fullOnly: "Markeer betaald" — bedrag staat vast op het restant, alleen de betaaldatum kiezen
const RegisterPaymentModal = ({ invoice, remaining, totals, onSave, onClose, fullOnly = false }) => {
  const { t } = useLang();
  const [amount, setAmount] = useState(remaining.toFixed(2).replace('.', ','));
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');
  const amountNum = fullOnly ? remaining : Math.max(0, parseDecimal(amount));
  const isFullPayment = amountNum >= remaining - 0.005;

  return (
    <Modal open onClose={onClose} size="sm">
      <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="font-display text-xl">{fullOnly ? 'Markeer als betaald' : t('payment.title')}</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Factuur {displayInvoiceNumber(invoice)} · {t('payment.subtitle')} {fmtCurrency(remaining, invoice.currency)}</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-[color:var(--surface-2)]" aria-label="Sluiten"><X size={16} /></button>
      </div>
      <div className="p-6 space-y-4">
        {!fullOnly && <Input label={t('payment.amountLabel')} type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />}
        <Input label={t('payment.dateLabel')} type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)}
          hint={fullOnly ? 'De datum waarop het geld op je rekening stond.' : undefined} />
        <Input label={t('payment.noteLabel')} value={note} onChange={e => setNote(e.target.value)} placeholder={t('payment.notePlaceholder')} />
        {isFullPayment && amountNum > 0 && (
          <div className="rounded p-2 text-xs" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
            {t('payment.fullPayment')}
          </div>
        )}
        {!isFullPayment && amountNum > 0 && (
          <div className="rounded p-2 text-xs" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
            {t('payment.partialRemaining')} {fmtCurrency(remaining - amountNum, invoice.currency)}
          </div>
        )}
      </div>
      <div className="px-6 pb-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>{t('editor.cancel')}</Button>
        <Button disabled={amountNum <= 0 || !date} onClick={() => onSave({ amount: roundMoney(amountNum), date, note: note || (fullOnly ? 'Volledig betaald' : '') })}>
          <Check size={14} /> {fullOnly ? 'Markeer betaald' : t('payment.save')}
        </Button>
      </div>
    </Modal>
  );
};

// ============================================================================
// SEND INVOICE / REMINDER MODAL
// ============================================================================
// De app verstuurt zelf (nog) geen e-mail. Eerlijke flow: PDF downloaden → mailprogramma openen met
// onderwerp/bericht ingevuld (PDF zelf bijvoegen) → markeren als verstuurd.
// `entity` = entiteit van de factuur (afzender), `legalEntity` = juridische entiteit (IBAN). Zonder
// deze props (bv. herinnering vanuit App) valt het terug op settings.company.
const SendInvoiceModal = ({ invoice, client, settings, entity, legalEntity, onDownloadPdf, onSend, onClose, mode = 'send', reminderLevel = null }) => {
  const { t } = useLang();
  const totals = computeInvoice(invoice.items);
  const isReminder = mode === 'reminder';
  const template = isReminder
    ? settings.reminders.templates[reminderLevel] || settings.reminders.templates[0]
    : { subject: settings.email.invoiceSubject, body: settings.email.invoiceBody };
  const sender = entity || settings.company || {};
  const payee = legalEntity || entity || settings.company || {};
  const number = displayInvoiceNumber(invoice);
  // Herinnering: alleen wat nog openstaat (na deelbetalingen en creditnota's)
  const amount = isReminder ? invoiceOpenAmount(invoice) : totals.total;
  const docName = `${isCreditNote(invoice) ? 'Creditnota' : 'Factuur'} ${number}`;

  const replaceVars = (str) => (str || '')
    .replace(/{{number}}/g, number)
    .replace(/{{contact}}/g, client?.contactName || client?.name || '')
    .replace(/{{company}}/g, sender.name || settings.company?.name || '')
    .replace(/{{amount}}/g, fmtCurrency(amount, invoice.currency))
    .replace(/{{date}}/g, fmtDate(invoice.issueDate))
    .replace(/{{dueDate}}/g, fmtDate(invoice.dueDate))
    .replace(/{{senderName}}/g, settings.email?.fromName || sender.name || '')
    .replace(/{{iban}}/g, payee.iban || '');

  const [channel, setChannel] = useState('email');
  const [to, setTo] = useState(client?.email || '');
  const [subject, setSubject] = useState(replaceVars(template.subject));
  const [body, setBody] = useState(replaceVars(template.body));
  const [waBody, setWaBody] = useState(replaceVars(settings.email?.whatsappMessage || 'Hallo {{contact}}, factuur {{number}} — {{amount}} — vervalt {{dueDate}}.'));
  const [pdfDone, setPdfDone] = useState(false);
  const [mailOpened, setMailOpened] = useState(false);

  const whatsappNumber = (client?.phone || settings.email?.whatsappNumber || '').replace(/\D/g, '');

  const openMail = () => {
    const url = `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    setMailOpened(true);
  };

  const sendWhatsApp = () => {
    if (!whatsappNumber) {
      alert('Geen WhatsApp-nummer bekend bij deze klant. Vul het in bij klantgegevens.');
      return;
    }
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(waBody)}`;
    window.open(url, '_blank');
    onSend(isReminder ? reminderLevel : undefined);
  };

  const markLabel = isReminder ? 'Markeer herinnering als verstuurd' : 'Markeer als verstuurd';

  return (
    <Modal open onClose={onClose} size="lg">
      <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="font-display text-2xl">{isReminder ? t('send.titleReminder') : t('send.titleInvoice')}</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {isReminder ? template.name : docName} → {client?.email || client?.name}
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-[color:var(--surface-2)]" aria-label="Sluiten"><X size={16} /></button>
      </div>

      {/* Channel selector */}
      <div className="px-6 pt-4 flex gap-2">
        {[
          { id: 'email', label: 'E-mail', icon: Mail },
          { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
        ].map(ch => (
          <button key={ch.id} onClick={() => setChannel(ch.id)} aria-pressed={channel === ch.id}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: channel === ch.id ? (ch.id === 'whatsapp' ? 'rgba(37,211,102,0.13)' : 'var(--accent-soft)') : 'transparent',
              color: channel === ch.id ? (ch.id === 'whatsapp' ? '#16a34a' : 'var(--accent)') : 'var(--ink-2)',
              border: `1px solid ${channel === ch.id ? (ch.id === 'whatsapp' ? 'rgba(37,211,102,0.3)' : 'var(--border-2)') : 'var(--border)'}`,
            }}>
            <ch.icon size={14} /> {ch.label}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-4">
        {channel === 'email' && (
          <>
            <div className="rounded-md p-3 text-xs flex items-start gap-2" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <div>
                De app verstuurt de e-mail niet zelf. {onDownloadPdf ? 'Download de PDF, open' : 'Open'} je mailprogramma met het bericht al ingevuld{onDownloadPdf ? ', voeg de PDF als bijlage toe' : ''} en verstuur. Markeer daarna als verstuurd.
              </div>
            </div>
            {onDownloadPdf && (
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-[9px]" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2 min-w-0 text-[13px]">
                  <FileText size={14} style={{ color: 'var(--text-3)' }} />
                  <span className="truncate" style={{ color: 'var(--text-2)' }}>1. Sla {docName} op als PDF (kies "Opslaan als PDF" in het printvenster)</span>
                </div>
                <Button size="sm" variant={pdfDone ? 'secondary' : 'primary'} onClick={() => { onDownloadPdf(); setPdfDone(true); }}>
                  <Download size={13} /> Download PDF
                </Button>
              </div>
            )}
            <Input label={t('send.to')} type="email" value={to} onChange={e => setTo(e.target.value)} placeholder={t('send.noClientEmail')} />
            <Input label={t('send.subject')} value={subject} onChange={e => setSubject(e.target.value)} />
            <Textarea label={t('send.message')} rows={8} value={body} onChange={e => setBody(e.target.value)} />
          </>
        )}

        {channel === 'whatsapp' && (
          <>
            <div className="rounded-md p-3 text-xs flex items-start gap-2" style={{ background: 'rgba(37,211,102,0.08)', color: '#16a34a' }}>
              <MessageSquare size={14} className="mt-0.5 shrink-0" />
              <div>
                {t('send.waInfo')}
                {!whatsappNumber && <strong> {t('send.waNoPhone')}</strong>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>{t('send.waSendTo')}</label>
              <div className="text-sm px-3 py-2 rounded" style={{ background: 'var(--surface-2)', color: whatsappNumber ? 'var(--ink)' : 'var(--danger)' }}>
                {whatsappNumber ? `+${whatsappNumber}` : t('send.waNoNumber')}
              </div>
            </div>
            <Textarea label={t('send.waMessage')} rows={6} value={waBody} onChange={e => setWaBody(e.target.value)} />
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              {t('send.waTip')}
            </div>
          </>
        )}
      </div>

      <div className="px-6 py-4 border-t flex items-center justify-end gap-2 flex-wrap" style={{ borderColor: 'var(--border)' }}>
        <Button variant="secondary" onClick={onClose}>Annuleren</Button>
        {channel === 'email' && (
          <>
            <Button variant={mailOpened ? 'secondary' : 'primary'} onClick={openMail} disabled={!to}>
              <Mail size={14} /> Open in mailprogramma
            </Button>
            <Button variant={mailOpened ? 'primary' : 'secondary'} onClick={() => onSend(isReminder ? reminderLevel : undefined)}>
              <CheckCircle2 size={14} /> {markLabel}
            </Button>
          </>
        )}
        {channel === 'whatsapp' && (
          <button onClick={sendWhatsApp} disabled={!whatsappNumber}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#25d366', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: whatsappNumber ? 'pointer' : 'not-allowed', opacity: whatsappNumber ? 1 : 0.5 }}>
            <MessageSquare size={14} /> Open WhatsApp en markeer als verstuurd
          </button>
        )}
      </div>
    </Modal>
  );
};

// ============================================================================
// BONNEN — gedeelde helpers voor upload, AI-scan en BTW-berekening
// ============================================================================
const parseAmount = (v) => {
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// Jurisdictie van de actieve entiteit (lijst én modal gebruiken dezelfde bron)
const expenseJur = (activeEntity, settings) => {
  const code = activeEntity?.jurisdiction || settings.jurisdiction || 'NL';
  const jur = JURISDICTIONS[code] || JURISDICTIONS.NL;
  const baseCurr = activeEntity ? jur.baseCurrency : (settings.baseCurrency || 'EUR');
  return { jurCode: jur.code, jur, baseCurr };
};

// Bedrag in basisvaluta + BTW. Een gescande of handmatig ingevulde BTW (btwManual) blijft staan;
// bij verlegd/geen BTW is er per definitie niets aftrekbaars in het bedrag.
const recalcExpense = (next) => {
  const amount = +(parseAmount(next.originalAmount) * (parseAmount(next.exchangeRate) || 1)).toFixed(2);
  if (next.vatTreatment && next.vatTreatment !== 'standard') return { ...next, amount, btwAmount: 0, btwRate: 0, btwManual: false };
  if (next.btwManual) return { ...next, amount };
  const rate = Number(next.btwRate || 0);
  return { ...next, amount, btwAmount: +(amount - amount / (1 + rate / 100)).toFixed(2) };
};

const receiptIsPdf = (e) => e.receiptType
  ? e.receiptType === 'application/pdf'
  : !e.image && (e.attachmentType === 'application/pdf' || String(e.attachment || '').startsWith('data:application/pdf') || /\.pdf$/i.test(e.attachmentName || ''));
const receiptThumb = (e) => e.thumb || (isDataUrl(e.image) ? e.image : null);
const hasReceipt = (e) => !!(e.receiptPath || e.image || e.attachment || e.attachmentPath || e.thumb || e.receiptStripped?.length);

// Volledige bon als data-URL voor de scan: net gemaakt (lokaal) → oude base64 → Storage
const receiptDataUrl = async (e, local) => {
  if (local) return local;
  if (isDataUrl(e.image)) return e.image;
  if (e.receiptPath) return downloadReceiptDataUrl(e.receiptPath);
  if (isDataUrl(e.attachment)) return e.attachment;
  if (e.attachmentPath) return downloadReceiptDataUrl(e.attachmentPath);
  if (e.receiptStripped?.length) throw new Error('De bon wordt nog geladen — probeer het over een paar seconden opnieuw.');
  throw new Error('Geen bon gevonden om te scannen.');
};

const SCAN_KEYS = ['vendor', 'date', 'currency', 'originalAmount', 'exchangeRate', 'btwRate', 'btwAmount', 'btwManual', 'vatTreatment', 'ledgerAccount', 'category', 'amount', 'scanInfo'];

// Scant een bon en geeft alleen de velden terug die de scan invult (de rest van de
// kostenpost kan intussen veranderd zijn, bv. doordat de upload klaar is).
const scanExpense = async ({ dataUrl, settings, jurCode, baseCurr, current, onRates }) => {
  const ledgerAccounts = getLedgerAccounts(jurCode);
  const r = await callClaudeVision({ imageDataUrl: dataUrl, apiKey: settings.apiKey, openaiApiKey: settings.openaiApiKey, jurisdiction: jurCode, ledgerAccounts });
  const totalIncl = Number(r.total_incl_tax) || 0;
  const btwAmt = Math.max(0, Number(r.tax_amount) || 0);
  const btwRate = Math.max(0, Number(r.tax_rate) || 0);
  const currency = String(r.currency || current.currency || baseCurr).toUpperCase().slice(0, 3);
  const vendor = r.vendor || current.vendor || '';
  const vatCountry = String(r.vat_country || '').toUpperCase();

  // BTW-soort: NL BTW op een euro-bon = standaard; anders het leveranciers-/valutavoorstel,
  // en "standaard" zonder gevonden BTW wordt "geen BTW" (buitenlandse BTW is niet aftrekbaar).
  let vatTreatment = current.vatTreatment || 'standard';
  if (jurCode === 'NL') {
    const hasNlVat = currency === 'EUR' && btwAmt > 0 && (!vatCountry || vatCountry === 'NL');
    vatTreatment = hasNlVat ? 'standard' : suggestVatTreatment({ vendor, currency });
    if (vatTreatment === 'standard' && !hasNlVat) vatTreatment = 'none';
  }

  const aiLedger = ledgerAccounts.find(a => a.code === String(r.ledger_code || '').trim());
  const rule = suggestLedgerAccount(vendor, jurCode);
  const fields = {
    vendor,
    date: /^\d{4}-\d{2}-\d{2}$/.test(r.date || '') ? r.date : current.date,
    currency,
    originalAmount: totalIncl || current.originalAmount,
    exchangeRate: currency === baseCurr ? 1 : (current.currency === currency && parseAmount(current.exchangeRate) !== 1 ? current.exchangeRate : 1),
    btwRate,
    // BTW van de bon overnemen (ook 0%); bij vreemde valuta rekent recalc via de koers
    ...(currency === baseCurr ? { btwAmount: btwAmt, btwManual: true } : { btwManual: false }),
    vatTreatment,
    ledgerAccount: aiLedger?.code || current.ledgerAccount || rule?.code || '',
    category: current.category || rule?.category || '',
    scanInfo: {
      vendor: r.vendor, date: r.date, totalIncl, btwAmt, btwRate, currency,
      deductible: r.deductible, deductiblePct: r.deductible_pct, deductibleRisk: r.deductible_risk,
      deductibleNote: r.deductible_note, deductibleDescription: r.deductible_description,
      at: new Date().toISOString(),
    },
  };
  if (currency !== baseCurr) {
    try {
      const rates = await fetchExchangeRates(baseCurr);
      const conv = convertCurrency(1, currency, baseCurr, rates);
      if (conv) { fields.exchangeRate = conv.rate; onRates?.(rates); }
    } catch { /* koers ophalen mislukt — gebruiker kan in de modal verversen */ }
  }
  const merged = recalcExpense({ ...current, ...fields });
  return Object.fromEntries(SCAN_KEYS.map(k => [k, merged[k]]));
};

// ============================================================================
// EXPENSES VIEW
// ============================================================================
const ExpensesView = ({ expenses, setExpenses, allExpenses, settings, setSettings, activeEntity }) => {
  const orgId = useReceiptOrgId();
  const [processing, setProcessing] = useState(null); // { id, autoScan }
  const [filter, setFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const [captureError, setCaptureError] = useState(null);
  const [scanQueue, setScanQueue] = useState([]); // ids die op de achtergrond gescand worden
  const [scanState, setScanState] = useState({}); // id → 'queued' | 'scanning' | 'done' | foutmelding
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  // Net gemaakte bonnen (data-URL) in geheugen: scan en preview hoeven niet op de upload te wachten
  const localData = useRef(new Map());
  const all = allExpenses || expenses;
  const allRef = useRef(all);
  allRef.current = all;
  const processingRef = useRef(null);
  processingRef.current = processing;

  const filtered = expenses
    .filter(e => filter === 'all' || e.status === filter)
    .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));

  const openCount = expenses.filter(e => e.status === 'open').length;
  const { jurCode, jur, baseCurr } = expenseJur(activeEntity, settings);
  const defaultBtw = jur.salesTax.standard;
  const hasAiKey = !!resolveApiKey(settings.apiKey, settings.openaiApiKey);

  const patchExpense = (id, patch) => setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));

  // Upload naar Storage op de achtergrond; lukt dat niet (offline, migratie v8 nog niet
  // gedraaid) dan blijft de bon als base64 in de kostenpost, zoals vroeger.
  const storeReceipt = async (id, dataUrl, type, name) => {
    try {
      if (!storageAvailable(orgId)) throw new Error('Storage niet beschikbaar');
      const path = await uploadReceipt(orgId, id, dataUrl, type);
      patchExpense(id, { receiptPath: path, receiptType: type });
    } catch (err) {
      console.warn('Bon-upload mislukt, bewaard in kostenpost:', err.message);
      patchExpense(id, type === 'application/pdf' ? { attachment: dataUrl, attachmentName: name || 'bon.pdf' } : { image: dataUrl });
    }
  };

  const prepareFile = async (file, source) => {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
    const dataUrl = isPdf ? await readFileAsDataUrl(file) : await resizeImage(file);
    const type = isPdf ? 'application/pdf' : dataUrl.slice(5, dataUrl.indexOf(';')) || 'image/jpeg';
    const id = generateId('exp');
    localData.current.set(id, dataUrl);
    const newExpense = {
      id,
      entityId: activeEntity?.id,
      thumb: isPdf ? null : await makeThumb(dataUrl),
      receiptType: type,
      receiptName: file.name || null,
      capturedAt: new Date().toISOString(),
      status: 'open',
      source,
      vendor: '',
      date: '',
      currency: baseCurr,
      originalAmount: 0,
      exchangeRate: 1,
      amount: 0,
      btwAmount: 0,
      btwRate: defaultBtw,
      category: '',
      ledgerAccount: '',
      notes: '',
    };
    setExpenses(prev => [newExpense, ...prev]);
    storeReceipt(id, dataUrl, type, file.name);
    return id;
  };

  // Eén bon → meteen de modal open en scannen (één tik op mobiel). Meerdere → wachtrij op de achtergrond.
  const handleFiles = async (fileList, source = 'upload') => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (!files.length) return;
    setUploading(true);
    setCaptureError(null);
    const ids = [];
    const errors = [];
    for (const f of files) {
      try { ids.push(await prepareFile(f, source)); }
      catch (err) { errors.push(files.length > 1 ? `${f.name || 'Foto'}: ${err.message}` : err.message); }
    }
    setUploading(false);
    if (errors.length) setCaptureError(errors.join(' · '));
    if (ids.length === 1) setProcessing({ id: ids[0], autoScan: hasAiKey });
    else if (ids.length > 1 && hasAiKey) {
      setScanState(s => ({ ...s, ...Object.fromEntries(ids.map(id => [id, 'queued'])) }));
      setScanQueue(q => [...q, ...ids]);
    }
  };

  // Achtergrond-scan: één tegelijk, resultaat als voorinvulling op de (nog open) bon
  const scanBusy = useRef(false);
  useEffect(() => {
    if (scanBusy.current || scanQueue.length === 0) return;
    const id = scanQueue[0];
    scanBusy.current = true;
    (async () => {
      const e = allRef.current.find(x => x.id === id);
      try {
        // Staat de bon al open in de modal, dan scant de gebruiker daar zelf
        if (e && e.status === 'open' && processingRef.current?.id !== id) {
          setScanState(s => ({ ...s, [id]: 'scanning' }));
          const dataUrl = await receiptDataUrl(e, localData.current.get(id));
          const delta = await scanExpense({ dataUrl, settings, jurCode, baseCurr, current: e, onRates: handleUpdateRates });
          setExpenses(prev => prev.map(x => x.id === id && x.status === 'open' ? { ...x, ...delta } : x));
          setScanState(s => ({ ...s, [id]: 'done' }));
        } else {
          setScanState(s => { const n = { ...s }; delete n[id]; return n; });
        }
      } catch (err) {
        setScanState(s => ({ ...s, [id]: err.message || 'Scan mislukt' }));
      } finally {
        scanBusy.current = false;
        setScanQueue(q => q.filter(x => x !== id));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanQueue]);

  // Oude bonnen (base64 in de kostenpost) eenmalig naar Storage verhuizen: kleinere sync en
  // geen localStorage-overloop meer. Stopt bij de eerste fout (bv. migratie v8 nog niet gedraaid).
  const migrateRef = useRef({ running: false, failed: false, tried: new Set() });
  useEffect(() => {
    const m = migrateRef.current;
    if (m.running || m.failed || !storageAvailable(orgId)) return;
    const todo = all.filter(e => !m.tried.has(e.id) && !localData.current.has(e.id) &&
      ((isDataUrl(e.image) && !e.receiptPath) || (isDataUrl(e.attachment) && !e.attachmentPath)));
    if (!todo.length) return;
    m.running = true;
    (async () => {
      for (const e of todo) {
        m.tried.add(e.id);
        try {
          const patch = {};
          const drop = [];
          if (isDataUrl(e.image) && !e.receiptPath) {
            const type = e.image.slice(5, e.image.indexOf(';')) || 'image/jpeg';
            patch.receiptPath = await uploadReceipt(orgId, e.id, e.image, type);
            patch.receiptType = type;
            patch.thumb = e.thumb || await makeThumb(e.image);
            drop.push('image');
          }
          if (isDataUrl(e.attachment) && !e.attachmentPath) {
            const type = e.attachment.slice(5, e.attachment.indexOf(';')) || 'application/octet-stream';
            patch.attachmentPath = await uploadReceipt(orgId, e.id, e.attachment, type, 'bijlage');
            patch.attachmentType = type;
            drop.push('attachment');
          }
          setExpenses(prev => prev.map(x => {
            if (x.id !== e.id) return x;
            const next = { ...x, ...patch };
            // Alleen weghalen als het nog dezelfde base64 is (niet intussen vervangen)
            drop.forEach(f => { if (x[f] === e[f]) delete next[f]; });
            return next;
          }));
        } catch (err) {
          console.warn('Bonnen verhuizen naar Storage gestopt:', err.message);
          m.failed = true;
          break;
        }
      }
      m.running = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, all]);

  const handleUpdateRates = async (rates) => {
    if (setSettings) await setSettings({ ...settings, exchangeRates: rates });
  };

  const handleProcess = (out) => {
    const id = processing?.id;
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...out, status: 'processed' } : e));
    setProcessing(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Bon verwijderen?')) {
      const e = all.find(x => x.id === id);
      setExpenses(prev => prev.filter(x => x.id !== id));
      setProcessing(null);
      localData.current.delete(id);
      if (e) removeReceipts([e.receiptPath, e.attachmentPath]);
    }
  };

  const [search, setSearch] = useState('');
  const [vatFilter, setVatFilter] = useState('all');
  const [dragOver, setDragOver] = useState(false);
  const thisYear = new Date().getFullYear();
  const openOnes = expenses.filter(e => e.status === 'open');
  const processedRows = expenses
    .filter(e => e.status === 'processed')
    .filter(e => vatFilter === 'all' || expenseVatTreatment(e) === vatFilter)
    .filter(e => {
      const q = search.trim().toLowerCase();
      return !q || String(e.vendor || '').toLowerCase().includes(q) || String(e.category || '').toLowerCase().includes(q) || String(e.notes || '').toLowerCase().includes(q) || String(e.amount || '').includes(q);
    })
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const yearRows = expenses.filter(e => e.status === 'processed' && yearOf(e.date) === thisYear);
  const yearNet = yearRows.reduce((s, e) => s + expenseNet(e), 0);
  const yearVat = yearRows.filter(e => expenseVatTreatment(e) === 'standard').reduce((s, e) => s + Number(e.btwAmount || 0), 0);
  const yearReverse = yearRows.reduce((s, e) => s + expenseReverseVat(e), 0);
  const tableTotals = processedRows.reduce((a, e) => ({ net: a.net + expenseNet(e), vat: a.vat + (expenseVatTreatment(e) === 'standard' ? Number(e.btwAmount || 0) : 0), total: a.total + Number(e.amount || 0) }), { net: 0, vat: 0, total: 0 });
  const vatChip = (e) => {
    const tr = expenseVatTreatment(e);
    const label = VAT_TREATMENTS.find(v => v.id === tr)?.short || tr;
    const tone = tr === 'standard' ? ['var(--success-soft)', 'var(--success)'] : tr === 'none' ? ['var(--surface-3)', 'var(--text-3)'] : ['var(--accent-soft)', 'var(--accent)'];
    return <span className="inline-flex h-[22px] items-center px-2 rounded-full text-[11.5px] font-medium whitespace-nowrap" style={{ background: tone[0], color: tone[1] }}>{label}</span>;
  };
  const queuedCount = Object.values(scanState).filter(s => s === 'queued' || s === 'scanning').length;
  const processingExpense = processing ? all.find(e => e.id === processing.id) : null;

  return (
    <div className="space-y-5 pb-24 lg:pb-0"
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files, 'upload'); }}>
      {/* Waarde na elke keuze leegmaken, anders werkt dezelfde foto/het volgende kiekje niet opnieuw */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ''; handleFiles(files, 'camera'); }} />
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); e.target.value = ''; handleFiles(files, 'upload'); }} />

      <PageHeader
        title="Bonnen en kosten"
        sub={openCount > 0 ? `${openCount} ${openCount === 1 ? 'bon wacht' : 'bonnen wachten'} op verwerking · ${expenses.length} totaal` : `${expenses.length} bonnen, alles verwerkt`}
        actions={<>
          <Button variant="secondary" onClick={() => cameraInputRef.current?.click()} disabled={uploading}><Camera size={14} /> Foto maken</Button>
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}><Upload size={14} /> {uploading ? 'Bezig…' : 'Bonnen uploaden'}</Button>
        </>}
      />

      {captureError && (
        <div className="px-3 py-2.5 rounded-[10px] text-[13px] flex items-start gap-2" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span className="flex-1">{captureError}</span>
          <button onClick={() => setCaptureError(null)} aria-label="Sluiten" style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}><X size={14} /></button>
        </div>
      )}
      {queuedCount > 0 && (
        <div className="px-3 py-2.5 rounded-[10px] text-[13px] flex items-center gap-2" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
          <Wand2 size={14} className="animate-spin shrink-0" />
          <span>AI leest {queuedCount} {queuedCount === 1 ? 'bon' : 'bonnen'} uit — je kunt gewoon doorwerken.</span>
        </div>
      )}

      {/* Samenvatting dit jaar */}
      <div className="grid grid-cols-2 md:grid-cols-4 rounded-[14px] overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--border)', gap: 1 }}>
        {[
          { label: `Kosten ${thisYear}`, sub: 'excl. BTW', value: <Money value={yearNet} /> },
          { label: 'Voorbelasting', sub: 'NL BTW, aftrekbaar (5b)', value: <Money value={yearVat} /> },
          { label: 'Verlegde BTW', sub: '4a/4b, netto € 0', value: <Money value={yearReverse} /> },
          { label: 'Te verwerken', sub: openCount ? 'klik een bon om te verwerken' : 'niets open', value: <span className="money">{openCount}</span>, tone: openCount ? 'var(--warning)' : undefined },
        ].map(c => (
          <div key={c.label} className="px-4 py-3.5" style={{ background: 'var(--surface)' }}>
            <div className="text-[12px]" style={{ color: 'var(--text-3)' }}>{c.label}</div>
            <div className="text-[19px] font-semibold mt-0.5" style={{ color: c.tone || 'var(--text)' }}>{c.value}</div>
            <div className="text-[11.5px]" style={{ color: 'var(--text-3)' }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Te verwerken: bonnen met foto/bestand die nog wachten */}
      {openOnes.length > 0 && (
        <div>
          <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--text)' }}>Te verwerken</div>
          <div className="flex gap-3 overflow-x-auto scrollable pb-1">
            {openOnes.map(e => {
              const st = scanState[e.id];
              const thumb = receiptThumb(e);
              const label = st === 'queued' ? 'In wachtrij' : st === 'scanning' ? 'AI leest…' : st && st !== 'done' ? 'Scan mislukt' : e.vendor || 'Verwerken';
              return (
                <button key={e.id} onClick={() => setProcessing({ id: e.id, autoScan: false })} title={st && !['queued', 'scanning', 'done'].includes(st) ? st : undefined}
                  className="flex-shrink-0 w-36 text-left rounded-[12px] overflow-hidden transition-[border-color]"
                  style={{ border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer' }}>
                  <div className="h-24 flex items-center justify-center" style={{ background: 'var(--surface-2)' }}>
                    {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                      : receiptIsPdf(e) ? <FileText size={20} style={{ color: 'var(--text-3)' }} />
                      : hasReceipt(e) ? <Paperclip size={20} style={{ color: 'var(--text-3)' }} /> : <ImageIcon size={20} style={{ color: 'var(--text-3)' }} />}
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="text-[12.5px] font-medium truncate" style={{ color: st && !['queued', 'scanning', 'done'].includes(st) ? 'var(--danger)' : e.vendor ? 'var(--text)' : 'var(--warning)' }}>{label}</div>
                    <div className="text-[11.5px] num truncate" style={{ color: 'var(--text-3)' }}>
                      {Number(e.amount) > 0 ? <Money value={e.amount} currency={baseCurr} /> : fmtDate(e.capturedAt)}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Uploadzone (ook slepen en loslaten op de hele pagina) */}
      <button onClick={() => fileInputRef.current?.click()} className="w-full rounded-[12px] py-4 text-[13px] flex items-center justify-center gap-2 transition-colors"
        style={{ border: `1.5px dashed ${dragOver ? 'var(--accent)' : 'var(--border-2)'}`, background: dragOver ? 'var(--accent-soft)' : 'transparent', color: dragOver ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer' }}>
        <Upload size={14} /> {dragOver ? 'Laat los om te uploaden' : 'Sleep bonnen of PDF-facturen hierheen, of klik om te kiezen'}
      </button>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Segmented value={vatFilter} onChange={setVatFilter} options={[
          { id: 'all', label: 'Alle BTW-soorten' },
          ...VAT_TREATMENTS.map(v => ({ id: v.id, label: v.short, count: expenses.filter(e => e.status === 'processed' && expenseVatTreatment(e) === v.id).length })).filter(o => o.count > 0),
        ]} />
        <div className="relative ml-auto w-full sm:w-auto">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Zoek leverancier, categorie of bedrag" className="h-9 pl-8 pr-3 text-[13px] rounded-[9px] border w-full sm:w-[260px]" />
        </div>
      </div>

      {processedRows.length === 0 ? (
        <Card>
          <EmptyState icon={ReceiptIcon}
            title={search || vatFilter !== 'all' ? 'Geen kosten gevonden' : 'Nog geen verwerkte kosten'}
            description={search || vatFilter !== 'all' ? 'Pas je zoekopdracht of filter aan.' : 'Upload een bon of boek een uitgave vanuit Bank.'} />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ledger">
              <thead>
                <tr>
                  <th style={{ width: 100 }}>Datum</th>
                  <th>Leverancier</th>
                  <th style={{ width: 120 }}>BTW-soort</th>
                  <th className="r" style={{ width: 120 }}>Excl. BTW</th>
                  <th className="r hidden md:table-cell" style={{ width: 100 }}>BTW</th>
                  <th className="r" style={{ width: 120 }}>Totaal</th>
                </tr>
              </thead>
              <tbody>
                {processedRows.map(e => {
                  const thumb = receiptThumb(e);
                  return (
                    <tr key={e.id} onClick={() => setProcessing({ id: e.id, autoScan: false })} style={{ cursor: 'pointer' }}>
                      <td><span className="num text-[12.5px]" style={{ color: 'var(--text-2)' }}>{fmtDate(e.date)}</span></td>
                      <td className="max-w-0" style={{ width: '45%' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          {thumb ? <img src={thumb} alt="" loading="lazy" className="w-7 h-7 rounded-[6px] object-cover flex-shrink-0" />
                            : <span className="w-7 h-7 rounded-[6px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)' }} title={e.source === 'bank' ? 'Uit bankafschrift' : receiptIsPdf(e) ? 'PDF' : hasReceipt(e) ? 'Bijlage' : 'Geen bijlage'}>
                                {e.source === 'bank' ? <Landmark size={13} style={{ color: 'var(--text-3)' }} /> : receiptIsPdf(e) ? <FileText size={13} style={{ color: 'var(--text-3)' }} /> : <Paperclip size={13} style={{ color: 'var(--text-3)' }} />}
                              </span>}
                          <div className="min-w-0">
                            <div className="truncate" style={{ color: 'var(--text)' }}>{e.vendor || 'Onbekende leverancier'}</div>
                            <div className="truncate text-[11.5px]" style={{ color: 'var(--text-3)' }}>{[e.category, e.ledgerAccount].filter(Boolean).join(' · ') || 'Geen categorie'}</div>
                          </div>
                        </div>
                      </td>
                      <td>{vatChip(e)}</td>
                      <td className="r"><Money value={expenseNet(e)} /></td>
                      <td className="r hidden md:table-cell" style={{ color: 'var(--text-2)' }}>
                        {expenseVatTreatment(e) === 'standard' ? <Money value={e.btwAmount} /> : expenseReverseVat(e) ? <span title="Verlegd: aangegeven én afgetrokken" style={{ color: 'var(--text-3)' }}><Money value={expenseReverseVat(e)} /></span> : <span style={{ color: 'var(--text-3)' }}>—</span>}
                      </td>
                      <td className="r font-medium"><Money value={e.amount} /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ color: 'var(--text-3)', fontWeight: 500 }}>{processedRows.length} kostenposten</td>
                  <td className="r"><Money value={tableTotals.net} /></td>
                  <td className="r hidden md:table-cell"><Money value={tableTotals.vat} /></td>
                  <td className="r"><Money value={tableTotals.total} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {processingExpense && (
        <ExpenseProcessModal
          key={processingExpense.id}
          expense={processingExpense}
          settings={settings}
          activeEntity={activeEntity}
          localDataUrl={localData.current.get(processingExpense.id)}
          autoScan={processing.autoScan}
          onSave={handleProcess}
          onDelete={handleDelete}
          onClose={() => setProcessing(null)}
          onUpdateRates={handleUpdateRates}
          onScanned={(delta) => setExpenses(prev => prev.map(x => x.id === processingExpense.id && x.status === 'open' ? { ...x, ...delta } : x))}
        />
      )}
    </div>
  );
};

// Bon-velden komen uit de actuele kostenpost (upload kan intussen klaar zijn), niet uit het formulier
const RECEIPT_KEYS = ['image', 'attachment', 'attachmentName', 'attachmentPath', 'attachmentType', 'receiptPath', 'receiptType', 'receiptName', 'thumb', 'receiptStripped'];
const RECALC_KEYS = ['originalAmount', 'currency', 'exchangeRate', 'btwRate'];

const ExpenseProcessModal = ({ expense, settings, activeEntity, localDataUrl, autoScan, onSave, onDelete, onClose, onUpdateRates, onScanned }) => {
  const orgId = useReceiptOrgId();
  const { jurCode, jur, baseCurr } = expenseJur(activeEntity, settings);
  const ledgerAccounts = getLedgerAccounts(jurCode);
  const hasAiKey = !!resolveApiKey(settings.apiKey, settings.openaiApiKey);

  const [form, setForm] = useState(() => ({
    vendor: '', date: todayISO(),
    currency: baseCurr,
    originalAmount: 0,
    exchangeRate: 1,
    amount: 0, // always in base currency
    btwRate: jur.salesTax.standard,
    btwAmount: 0,
    category: '', ledgerAccount: '', notes: '',
    source: 'manual',
    ...expense,
    vatTreatment: expense.vatTreatment || (jur.code === 'NL'
      ? (Number(expense.btwAmount) > 0 ? 'standard' : suggestVatTreatment({ vendor: expense.vendor, currency: expense.currency }))
      : 'standard'),
  }));
  const vatSuggestion = jur.code === 'NL' ? suggestVatTreatment({ vendor: form.vendor, currency: form.currency }) : 'standard';

  const [fetchingRate, setFetchingRate] = useState(false);
  const [rateError, setRateError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanResult, setScanResult] = useState(expense.scanInfo || null); // wat de AI vond
  const attachInputRef = useRef(null);
  const [attachUploading, setAttachUploading] = useState(false);
  const [attachTouched, setAttachTouched] = useState(false);
  // Op mobiel klapt de bon in tot een klein voorbeeld, zodat het formulier direct in beeld is
  const [previewOpen, setPreviewOpen] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches);

  const isPdf = receiptIsPdf(expense);
  const [previewSrc, setPreviewSrc] = useState(null);
  useEffect(() => {
    let off = false;
    if (isPdf) { setPreviewSrc(null); return undefined; }
    if (localDataUrl) { setPreviewSrc(localDataUrl); return undefined; }
    if (isDataUrl(expense.image)) { setPreviewSrc(expense.image); return undefined; }
    setPreviewSrc(expense.thumb || null);
    if (expense.receiptPath) receiptUrl(expense.receiptPath).then(u => { if (!off && u) setPreviewSrc(u); }).catch(() => {});
    return () => { off = true; };
  }, [expense.receiptPath, expense.image, expense.thumb, localDataUrl, isPdf]);

  // Opent een bestand uit Storage in een nieuw tabblad (venster eerst openen i.v.m. popup-blokkers op iOS)
  const openStored = async (path) => {
    const w = window.open('', '_blank');
    try {
      const url = await receiptUrl(path);
      if (w) w.location.href = url; else window.location.href = url;
    } catch (e) {
      w?.close();
      setScanError(e.message);
    }
  };

  const handleAIScan = async () => {
    setScanning(true);
    setScanError(null);
    try {
      const dataUrl = await receiptDataUrl(expense, localDataUrl);
      const delta = await scanExpense({ dataUrl, settings, jurCode, baseCurr, current: form, onRates: onUpdateRates });
      setForm(f => ({ ...f, ...delta }));
      setScanResult(delta.scanInfo);
      onScanned?.(delta);
    } catch (e) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  };

  // Net gefotografeerde bon: meteen scannen (ref voorkomt dubbele scan in StrictMode)
  const autoScanned = useRef(false);
  useEffect(() => {
    if (autoScan && hasAiKey && !autoScanned.current) { autoScanned.current = true; handleAIScan(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-suggest ledger account on vendor change (only if user hasn't picked one yet)
  const suggestion = useMemo(
    () => suggestLedgerAccount(form.vendor, jurCode),
    [form.vendor, jurCode]
  );

  useEffect(() => {
    if (suggestion && !form.ledgerAccount) {
      setForm(f => ({
        ...f,
        ledgerAccount: suggestion.code,
        category: f.category || suggestion.category || '',
      }));
    }
  }, [suggestion?.code]);

  const update = (key, val) => {
    setForm(f => {
      const next = { ...f, [key]: val };
      // Bedrag/tarief gewijzigd → BTW opnieuw berekenen; BTW-bedrag zelf ingevuld → laten staan
      if (RECALC_KEYS.includes(key)) next.btwManual = false;
      if (key === 'btwAmount') next.btwManual = true;
      if (key === 'vatTreatment' && val === 'standard' && !Number(f.btwRate)) next.btwRate = jur.salesTax.standard;
      return recalcExpense(next);
    });
  };

  const handleFetchRate = async () => {
    if (form.currency === baseCurr) return;
    setFetchingRate(true);
    setRateError(null);
    try {
      const rates = await fetchExchangeRates(baseCurr);
      const conv = convertCurrency(1, form.currency, baseCurr, rates);
      if (conv) {
        setForm(f => recalcExpense({ ...f, exchangeRate: conv.rate }));
        if (onUpdateRates) onUpdateRates(rates);
      } else {
        setRateError('Valuta niet ondersteund');
      }
    } catch (e) {
      setRateError(e.message || 'Kon koers niet ophalen');
    } finally {
      setFetchingRate(false);
    }
  };

  // Auto-fetch on first open if non-base currency and no rate yet
  useEffect(() => {
    if (form.currency !== baseCurr && (!form.exchangeRate || Number(form.exchangeRate) === 1) && !expense.exchangeRate) {
      handleFetchRate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.currency]);

  const handleAttach = async (f) => {
    if (!f) return;
    setAttachUploading(true);
    try {
      const type = f.type || (/\.pdf$/i.test(f.name || '') ? 'application/pdf' : 'application/octet-stream');
      let patch;
      try {
        if (!storageAvailable(orgId)) throw new Error('Storage niet beschikbaar');
        patch = { attachmentPath: await uploadReceipt(orgId, expense.id, f, type, 'bijlage'), attachment: null };
      } catch {
        patch = { attachment: await readFileAsDataUrl(f), attachmentPath: null };
      }
      setForm(prev => ({ ...prev, ...patch, attachmentType: type, attachmentName: f.name }));
      setAttachTouched(true);
    } catch (e) {
      setScanError(e.message);
    } finally {
      setAttachUploading(false);
    }
  };

  const handleSave = () => {
    if (!isValid) return;
    const out = { ...form, originalAmount: parseAmount(form.originalAmount), exchangeRate: parseAmount(form.exchangeRate) || 1, btwAmount: parseAmount(form.btwAmount) };
    RECEIPT_KEYS.forEach(k => delete out[k]);
    if (attachTouched) {
      ['attachment', 'attachmentName', 'attachmentPath', 'attachmentType'].forEach(k => { out[k] = form[k] ?? null; });
      // Bewust gewijzigd: de server-trigger mag de oude bijlage niet terugzetten
      if (expense.receiptStripped) out.receiptStripped = expense.receiptStripped.filter(f => f !== 'attachment');
    }
    onSave(out);
  };

  const isValid = form.vendor && form.date && parseAmount(form.originalAmount) > 0 && form.ledgerAccount;
  const selectedAccount = ledgerAccounts.find(a => a.code === form.ledgerAccount);
  const rateOptions = [...new Set([...jur.salesTax.rates, Number(form.btwRate) || 0])].sort((a, b) => a - b);
  const amountInputStyle = { borderColor: 'var(--border-2)', background: 'var(--surface)', color: 'var(--text)' };
  const pdfLocal = localDataUrl || (isDataUrl(expense.attachment) ? expense.attachment : null);

  const preview = isPdf ? (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <FileText size={34} style={{ color: 'var(--text-3)' }} />
      <div className="text-[13px] truncate max-w-full" style={{ color: 'var(--text-2)' }}>{expense.receiptName || expense.attachmentName || 'PDF-bon'}</div>
      {expense.receiptPath || expense.attachmentPath ? (
        <Button size="sm" variant="secondary" onClick={() => openStored(expense.receiptPath || expense.attachmentPath)}><Eye size={13} /> PDF openen</Button>
      ) : pdfLocal ? (
        <a href={pdfLocal} download={expense.receiptName || expense.attachmentName || 'bon.pdf'} className="text-[13px] font-medium" style={{ color: 'var(--accent)' }}>PDF downloaden</a>
      ) : null}
    </div>
  ) : previewSrc ? (
    <img src={previewSrc} alt="Bon" className="max-w-full max-h-[45vh] md:max-h-[60vh] rounded-[8px] shadow-md mx-auto" />
  ) : (
    <div className="text-[13px] py-6 text-center" style={{ color: 'var(--text-3)' }}>
      {expense.receiptStripped?.length ? 'Bon wordt geladen…' : 'Geen afbeelding'}
    </div>
  );

  return (
    <Modal open onClose={onClose} size="lg">
      {/* iOS zoomt in op velden < 16px: op mobiel alle velden in deze modal op 16px */}
      <style>{'@media (max-width: 767px) { .exp-modal input, .exp-modal select, .exp-modal textarea { font-size: 16px !important; } }'}</style>
      <div className="exp-modal flex flex-col max-h-[calc(100dvh-6rem)]">
        <div className="px-4 md:px-6 py-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
          <div className="min-w-0">
            <h2 className="text-[18px] md:text-[20px] font-semibold" style={{ color: 'var(--text)' }}>Bon verwerken</h2>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>
              Vastgelegd op {fmtDate(expense.capturedAt)} · {jur.flag} {jur.name}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasReceipt(expense) && (
              <Button size="sm" variant="secondary" onClick={handleAIScan} disabled={scanning}>
                <Wand2 size={13} className={scanning ? 'animate-spin' : ''} />
                {scanning ? 'Scannen…' : scanResult ? 'Opnieuw scannen' : 'Scan met AI'}
              </Button>
            )}
            <button onClick={onClose} aria-label="Sluiten" className="p-1.5 rounded hover:bg-[color:var(--surface-2)]"><X size={16} /></button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollable">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="md:p-4" style={{ background: 'var(--surface-2)' }}>
              {/* Mobiel: inklapbaar voorbeeld */}
              <button type="button" onClick={() => setPreviewOpen(o => !o)} className="md:hidden w-full flex items-center gap-3 px-4 py-2.5 text-left"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)' }}>
                {previewSrc && !isPdf ? <img src={previewSrc} alt="" className="w-10 h-10 rounded-[6px] object-cover" />
                  : <span className="w-10 h-10 rounded-[6px] flex items-center justify-center" style={{ background: 'var(--surface-3)' }}>{isPdf ? <FileText size={16} /> : <ImageIcon size={16} />}</span>}
                <span className="flex-1 text-[13px] font-medium">{previewOpen ? 'Bon verbergen' : 'Bon bekijken'}</span>
                <ChevronDown size={16} style={{ transform: previewOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} />
              </button>
              <div className={`${previewOpen ? 'block' : 'hidden'} md:block px-4 pb-4 md:p-0 md:sticky md:top-0`}>
                {preview}
                {!isPdf && expense.receiptPath && (
                  <div className="text-center mt-2">
                    <button type="button" onClick={() => openStored(expense.receiptPath)} className="text-[12.5px] font-medium hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)' }}>
                      Volledige bon openen
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              {!hasAiKey && hasReceipt(expense) && (
                <div className="px-3 py-2 rounded-md text-xs flex items-start gap-2" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                  <Key size={13} className="mt-0.5 shrink-0" />
                  <span>Bonnen automatisch laten uitlezen? Stel je AI-sleutel in via Instellingen → AI (wordt dan op al je apparaten gebruikt).</span>
                </div>
              )}
              {scanning && (
                <div className="px-3 py-2 rounded-md text-xs flex items-center gap-2" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  <Wand2 size={13} className="animate-spin shrink-0" />
                  <span>AI leest de bon uit…</span>
                </div>
              )}
              {scanResult && !scanError && !scanning && (
                <div className="space-y-1.5 animate-in">
                  <div className="px-3 py-2 rounded-md text-xs flex items-start gap-2" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
                    <span>
                      <strong>AI gevonden:</strong> {scanResult.vendor || '?'} · {scanResult.date || '?'} ·{' '}
                      {fmtCurrency(scanResult.totalIncl, scanResult.currency)}
                      {scanResult.btwAmt > 0 ? ` (incl. ${scanResult.currency === 'EUR' ? 'BTW' : 'belasting'} ${fmtCurrency(scanResult.btwAmt, scanResult.currency)})` : ' · geen BTW op de bon'}
                      . Controleer en klik op verwerken.
                    </span>
                  </div>
                  {scanResult.deductibleNote && (
                    <div className="px-3 py-2 rounded-md text-xs" style={{
                      background: scanResult.deductibleRisk === 'safe' ? 'var(--success-soft)' : scanResult.deductibleRisk === 'no' ? 'var(--surface-3)' : 'var(--warning-soft)',
                      color: scanResult.deductibleRisk === 'safe' ? 'var(--success)' : scanResult.deductibleRisk === 'no' ? 'var(--text-3)' : 'var(--warning)',
                    }}>
                      <strong>Aftrekbaar{scanResult.deductiblePct && scanResult.deductiblePct < 100 ? ` (${scanResult.deductiblePct}%)` : ''}:</strong> {scanResult.deductibleNote}
                    </div>
                  )}
                  {scanResult.deductibleDescription && (
                    <div className="px-3 py-2 rounded-md text-xs flex items-start gap-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                      <span className="flex-1"><strong>Omschrijf als:</strong> {scanResult.deductibleDescription}</span>
                      {!form.notes && (
                        <button type="button" onClick={() => update('notes', scanResult.deductibleDescription)} className="font-medium shrink-0 hover:underline" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', padding: 0 }}>Overnemen</button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {scanError && (
                <div className="px-3 py-2 rounded-md text-xs flex items-start gap-2" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <span className="break-words min-w-0">{scanError}</span>
                </div>
              )}

              <Input
                label="Leverancier *"
                value={form.vendor}
                onChange={e => update('vendor', e.target.value)}
                placeholder="Bijv. Anthropic, Make.com, Vercel..."
              />

              {suggestion && (
                <div className="rounded-md p-3 text-xs flex items-start gap-2 animate-in" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                  <Sparkles size={14} className="mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <div><strong>Suggestie:</strong> grootboek <span className="font-mono">{suggestion.code}</span> {suggestion.note && <span>· {suggestion.note}</span>}</div>
                    <div className="opacity-75 mt-0.5">Match op "{suggestion.matched}" · je kunt het hieronder aanpassen</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Input label="Datum bon *" type="date" value={form.date} onChange={e => update('date', e.target.value)} />
                <Select label="Categorie" value={form.category} onChange={e => update('category', e.target.value)}>
                  <option value="">Kies...</option>
                  {(settings.categories || []).map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </div>

              <Select label={`Grootboekrekening * (${jur.code})`} value={form.ledgerAccount} onChange={e => update('ledgerAccount', e.target.value)}>
                <option value="">Kies rekening...</option>
                {ledgerAccounts.map(a => (
                  <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                ))}
              </Select>
              {selectedAccount && (
                <div className="rounded-md p-3 text-xs space-y-1" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <div className="font-medium flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
                    <BookOpen size={11} /> Journaalpost
                  </div>
                  <div className="font-mono break-words" style={{ color: 'var(--text)' }}>
                    Debet &nbsp;: {selectedAccount.code} {selectedAccount.name}
                  </div>
                  <div className="font-mono" style={{ color: 'var(--text)' }}>
                    Credit: 1100 Bank / Creditcard
                  </div>
                  <div style={{ color: 'var(--text-3)' }}>{selectedAccount.group} · {jur.salesTax.name} voorbelasting apart verwerken</div>
                </div>
              )}

              {/* Valuta + bedrag (tekstveld met decimaal-toetsenbord: komma én punt werken) */}
              <div className="space-y-1.5">
                <label className="block text-[12.5px] font-medium" style={{ color: 'var(--text-2)' }}>Bedrag op bon *</label>
                <div className="grid grid-cols-5 gap-2">
                  <input
                    type="text" inputMode="decimal" autoComplete="off"
                    value={form.originalAmount === 0 ? '' : form.originalAmount}
                    onChange={e => update('originalAmount', e.target.value)}
                    className="col-span-3 h-9 px-3 text-[13.5px] rounded-[9px] border num"
                    style={amountInputStyle}
                    placeholder="0,00"
                  />
                  <select
                    value={form.currency}
                    onChange={e => update('currency', e.target.value)}
                    className="col-span-2 h-9 px-2 text-[13.5px] rounded-[9px] border cursor-pointer"
                    style={amountInputStyle}
                  >
                    {SUPPORTED_CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.currency !== baseCurr && (
                <div className="p-3 rounded-md space-y-2" style={{ background: 'var(--info-soft)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-medium" style={{ color: 'var(--info)' }}>Wisselkoers</div>
                    <button
                      onClick={handleFetchRate}
                      disabled={fetchingRate}
                      className="text-xs font-medium flex items-center gap-1 px-2 py-1 rounded disabled:opacity-50"
                      style={{ color: 'var(--info)', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      <RefreshCw size={11} className={fetchingRate ? 'animate-spin' : ''} />
                      {fetchingRate ? 'Ophalen...' : 'Huidige koers'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="num shrink-0">1 {form.currency}</span>
                    <ArrowRight size={12} style={{ color: 'var(--text-3)' }} className="shrink-0" />
                    <input
                      type="text" inputMode="decimal" autoComplete="off"
                      value={form.exchangeRate}
                      onChange={e => update('exchangeRate', e.target.value)}
                      className="flex-1 min-w-0 h-8 px-2 text-[13.5px] rounded-[8px] border num"
                      style={amountInputStyle}
                    />
                    <span className="num shrink-0">{baseCurr}</span>
                  </div>
                  {rateError && <div className="text-xs" style={{ color: 'var(--danger)' }}>{rateError}</div>}
                  <div className="text-xs flex justify-between pt-1 border-t" style={{ borderColor: 'rgba(30,64,175,0.15)', color: 'var(--info)' }}>
                    <span>{fmtCurrency(parseAmount(form.originalAmount), form.currency)}</span>
                    <span className="num font-semibold">≈ {fmtCurrency(form.amount, baseCurr)}</span>
                  </div>
                </div>
              )}

              {jur.code === 'NL' && (
                <div className="space-y-1">
                  <Select label="BTW-behandeling" value={form.vatTreatment} onChange={e => update('vatTreatment', e.target.value)}>
                    {VAT_TREATMENTS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </Select>
                  {vatSuggestion !== form.vatTreatment && (
                    <button type="button" onClick={() => update('vatTreatment', vatSuggestion)} className="text-xs hover:underline text-left" style={{ color: 'var(--warning)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                      Voorstel voor {form.vendor || 'deze leverancier'}: {VAT_TREATMENTS.find(v => v.id === vatSuggestion)?.label} — toepassen
                    </button>
                  )}
                </div>
              )}
              {form.vatTreatment === 'standard' ? (
                <div className="space-y-1">
                  <div className="grid grid-cols-2 gap-3">
                    <Select label={`${jur.salesTax.name} %`} value={Number(form.btwRate) || 0} onChange={e => update('btwRate', Number(e.target.value))}>
                      {rateOptions.map(r => <option key={r} value={r}>{r}%</option>)}
                    </Select>
                    <div>
                      <label className="block text-[12.5px] font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>{jur.salesTax.name}-bedrag ({baseCurr})</label>
                      <input
                        type="text" inputMode="decimal" autoComplete="off"
                        value={form.btwAmount}
                        onChange={e => update('btwAmount', e.target.value)}
                        className="w-full h-9 px-3 text-[13.5px] rounded-[9px] border num"
                        style={amountInputStyle}
                      />
                    </div>
                  </div>
                  {form.btwManual && (
                    <div className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {scanResult ? 'Overgenomen van de bon' : 'Zelf ingevuld'} ·{' '}
                      <button type="button" onClick={() => update('btwRate', Number(form.btwRate) || 0)} className="hover:underline" style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--accent)' }}>berekenen uit tarief</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs p-2 rounded" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>
                  {form.vatTreatment === 'none' ? 'Geen BTW — telt alleen als kosten.' : `Verlegd: ${fmtCurrency(+(Number(form.amount) * 0.21).toFixed(2), baseCurr)} in rubriek ${form.vatTreatment === 'reverse_eu' ? '4b' : '4a'} én aftrekbaar in 5b.`}
                </div>
              )}

              <div className="p-3 rounded-md text-sm space-y-1" style={{ background: 'var(--surface-2)' }}>
                <div className="flex justify-between text-xs" style={{ color: 'var(--text-3)' }}>
                  <span>Excl. {jur.salesTax.name}</span>
                  <span className="num">{fmtCurrency(Number(form.amount) - parseAmount(form.btwAmount), baseCurr)}</span>
                </div>
                <div className="flex justify-between text-xs" style={{ color: 'var(--text-3)' }}>
                  <span>{jur.salesTax.name}</span>
                  <span className="num" style={{ color: 'var(--success)' }}>{fmtCurrency(parseAmount(form.btwAmount), baseCurr)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold pt-1" style={{ color: 'var(--text)' }}>
                  <span>Totaal (in {baseCurr})</span>
                  <span className="num">{fmtCurrency(form.amount, baseCurr)}</span>
                </div>
              </div>

              <Textarea label="Notitie" rows={2} value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Optioneel..." />

              {/* Bijlage */}
              <div>
                <label className="block text-[12.5px] font-medium mb-1.5" style={{ color: 'var(--text-2)' }}>Bijlage (PDF of bestand)</label>
                <input ref={attachInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; handleAttach(f); }} />
                {form.attachment || form.attachmentPath ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <Paperclip size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    <span className="flex-1 truncate text-xs" style={{ color: 'var(--text)' }}>{form.attachmentName || 'Bijlage'}</span>
                    {form.attachmentPath
                      ? <button type="button" onClick={() => openStored(form.attachmentPath)} aria-label="Bijlage openen" className="flex" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}><Download size={13} /></button>
                      : <a href={form.attachment} download={form.attachmentName || 'bijlage'} className="flex" style={{ color: 'var(--text-3)' }}><Download size={13} /></a>}
                    <button onClick={() => { setForm(f => ({ ...f, attachment: null, attachmentName: null, attachmentPath: null, attachmentType: null })); setAttachTouched(true); }} aria-label="Bijlage verwijderen" className="flex" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0 }}><X size={13} /></button>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" onClick={() => attachInputRef.current?.click()} disabled={attachUploading}>
                    <Paperclip size={13} /> {attachUploading ? 'Uploaden...' : 'Bestand toevoegen'}
                  </Button>
                )}
              </div>

              {form.source && form.source !== 'manual' && (
                <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                  <Inbox size={11} />
                  <span>Bron: {form.source === 'email' ? 'Gmail (auto)' : form.source === 'camera' ? 'Camera' : form.source === 'bank' ? 'Bank' : 'Upload'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Vaste voettekst: knoppen altijd bereikbaar, lopen door op smalle schermen */}
        <div className="px-4 md:px-6 pt-3 border-t flex flex-wrap items-center justify-between gap-2" style={{ borderColor: 'var(--border)', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
          <Button variant="danger" size="sm" onClick={() => onDelete(expense.id)}><Trash2 size={14} /> Verwijderen</Button>
          <div className="flex flex-wrap gap-2 flex-1 justify-end">
            <Button variant="secondary" onClick={onClose}>Annuleren</Button>
            <Button onClick={handleSave} disabled={!isValid || scanning} className="flex-1 sm:flex-none">
              <Check size={14} /> Verwerken en boeken
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

// ============================================================================
// INVOICE TEMPLATE RENDERERS — Enterprise Edition (4 stijlen)
// ----------------------------------------------------------------------------
// Executive · Studio · Atelier · Signature
// Each takes (invoice, entity, client, totals, parentEntity) → JSX.
// ============================================================================

// ── Shared: line items + totals table ────────────────────────────────────────
// Creditnota-verwijzing en leverdatum/periode — gedeeld door alle templates
const InvoiceMetaNotes = ({ invoice, t }) => {
  const lines = [];
  if (isCreditNote(invoice) && (invoice.creditNoteForNumber || invoice.creditNoteFor)) {
    lines.push(t.creditNoteFor(invoice.creditNoteForNumber || '—', invoice.creditNoteForDate ? fmtDate(invoice.creditNoteForDate) : ''));
  }
  if (invoice.periodFrom || invoice.periodTo) {
    lines.push(`${t.period}: ${invoice.periodFrom ? fmtDate(invoice.periodFrom) : '…'} – ${invoice.periodTo ? fmtDate(invoice.periodTo) : '…'}`);
  } else if (invoice.deliveryDate) {
    lines.push(`${t.deliveryDate}: ${fmtDate(invoice.deliveryDate)}`);
  }
  if (!lines.length) return null;
  return (
    <div style={{ marginBottom: 16, fontSize: 11, lineHeight: 1.7, color: '#4a4a4a' }}>
      {lines.map((l, i) => <div key={i} style={i === 0 && isCreditNote(invoice) ? { fontWeight: 600, color: '#1a1a1a' } : undefined}>{l}</div>)}
    </div>
  );
};

const InvoiceLineItemsAndTotals = ({ invoice, client, totals, jur, accent, style = 'executive' }) => {
  const editCtx = useContext(InvoiceEditContext);
  const t = getInvoiceT(invoice.language, invoice);
  const vatTreatment = invoiceVatTreatment(invoice, client);
  // Verlegd / buiten de EU: alleen vermelden als er ook echt geen BTW berekend is
  const zeroRatedNotice = (jur?.code || 'NL') === 'NL' && isZeroRatedTreatment(vatTreatment) && Math.abs(totals.btwTotal) < 0.005;
  const rateEntries = Object.entries(totals.btwByRate);
  const allZeroRate = rateEntries.length > 0 && rateEntries.every(([r]) => Number(r) === 0);
  const isForeign = (invoice.currency || 'EUR') !== 'EUR';
  const eurRate = isForeign && Number(invoice.exchangeRate) > 0 ? invoiceEurRate(invoice) : null;
  const isMinimal = style === 'atelier';
  const headerBg = style === 'studio' ? accent : 'transparent';
  const headerColor = style === 'studio' ? '#fff' : 'var(--ink)';
  const rowBorder = isMinimal ? '1px solid #e8e8e8' : '1px solid var(--border)';
  return (
    <>
      <InvoiceMetaNotes invoice={invoice} t={t} />
      <table className="w-full text-sm mb-8" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: headerBg }}>
            <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.12em] font-semibold" style={{ color: headerColor || 'var(--muted)', borderBottom: `2px solid ${accent}` }}>{t.description}</th>
            <th className="text-right py-2.5 px-2 text-[10px] uppercase tracking-[0.12em] font-semibold w-16" style={{ color: headerColor || 'var(--muted)', borderBottom: `2px solid ${accent}` }}>{t.qty}</th>
            <th className="text-right py-2.5 px-2 text-[10px] uppercase tracking-[0.12em] font-semibold w-28" style={{ color: headerColor || 'var(--muted)', borderBottom: `2px solid ${accent}` }}>{t.unitPrice}</th>
            <th className="text-right py-2.5 px-2 text-[10px] uppercase tracking-[0.12em] font-semibold w-14" style={{ color: headerColor || 'var(--muted)', borderBottom: `2px solid ${accent}` }}>{jur.salesTax.name}</th>
            <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-[0.12em] font-semibold w-28" style={{ color: headerColor || 'var(--muted)', borderBottom: `2px solid ${accent}` }}>{t.amount}</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, idx) => {
            const line = computeLine(item);
            const isEven = idx % 2 === 1;
            return (
              <tr key={idx} style={{ background: isEven && !isMinimal ? '#fafaf9' : 'transparent', borderBottom: rowBorder }}>
                <td className="py-3 px-3 align-top">
                  <div className="font-medium text-sm" style={{ color: 'var(--ink)', lineHeight: 1.4 }}>{item.description}</div>
                  {item.discount && Number(item.discount.value) > 0 && (
                    <div className="text-[10px] mt-0.5 font-mono" style={{ color: accent }}>
                      − {t.discount}: {item.discount.type === 'percent' ? `${item.discount.value}%` : fmtCurrency(item.discount.value, invoice.currency)}
                      {item.discount.name ? ` (${item.discount.name})` : ''}
                    </div>
                  )}
                </td>
                <td className="py-3 px-2 text-right align-top num text-sm" style={{ color: 'var(--ink-2)' }}>{Number(item.quantity).toLocaleString('nl-NL')}</td>
                <td className="py-3 px-2 text-right align-top num text-sm" style={{ color: 'var(--ink-2)' }}>
                  {fmtCurrency(item.price, invoice.currency)}
                  {line.discount > 0 && <div className="text-[10px]" style={{ color: 'var(--muted)' }}>→ {fmtCurrency(line.net / (Number(item.quantity) || 1), invoice.currency)}</div>}
                </td>
                <td className="py-3 px-2 text-right align-top num text-xs" style={{ color: 'var(--muted)' }}>{item.btwRate}%</td>
                <td className="py-3 px-3 text-right align-top num font-semibold text-sm" style={{ color: 'var(--ink)' }}>{fmtCurrency(line.net, invoice.currency)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="flex justify-end mb-10">
        <div style={{ width: 300 }}>
          {totals.totalDiscount > 0 && (
            <>
              <div className="flex justify-between py-1.5 text-xs" style={{ color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>
                <span>{t.subtotalBeforeDiscount}</span>
                <span className="num">{fmtCurrency(totals.subtotal + totals.totalDiscount, invoice.currency)}</span>
              </div>
              <div className="flex justify-between py-1.5 text-xs" style={{ color: accent, borderBottom: '1px solid var(--border)' }}>
                <span>{t.totalDiscount}</span>
                <span className="num">− {fmtCurrency(totals.totalDiscount, invoice.currency)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between py-1.5 text-xs" style={{ color: 'var(--ink-2)', borderBottom: '1px solid var(--border)' }}>
            <span>{t.subtotalExcl(jur.salesTax.name)}</span>
            <span className="num">{fmtCurrency(totals.subtotal, invoice.currency)}</span>
          </div>
          {rateEntries.filter(([r]) => Number(r) > 0 || allZeroRate).map(([rate, amt]) => (
            <div key={rate} className="flex justify-between py-1.5 text-xs" style={{ color: 'var(--ink-2)', borderBottom: '1px solid var(--border)' }}>
              <span>{jur.salesTax.name} {rate}%</span>
              <span className="num">{fmtCurrency(amt, invoice.currency)}</span>
            </div>
          ))}
          <div className="flex justify-between items-center py-3 mt-1" style={{ borderTop: `2px solid ${accent}` }}>
            <span className="text-base font-semibold" style={{ color: 'var(--ink)' }}>{t.totalDue}</span>
            <span className="num text-xl font-bold" style={{ color: accent }}>{fmtCurrency(totals.total, invoice.currency)}</span>
          </div>
          {eurRate && (
            <div className="text-[10px]" style={{ color: '#6b6b6b', lineHeight: 1.6 }}>
              <div className="flex justify-between"><span>{t.vatInEur(jur.salesTax.name)}</span><span className="num">{fmtCurrency(roundMoney(totals.btwTotal * eurRate), 'EUR')}</span></div>
              <div className="flex justify-between"><span>{t.exchangeRate}</span><span className="num">1 {invoice.currency} = {eurRate.toLocaleString('nl-NL', { maximumFractionDigits: 6 })} EUR</span></div>
            </div>
          )}
        </div>
      </div>

      {zeroRatedNotice && (
        <div className="mb-6 text-[11px]" style={{ color: '#1a1a1a', borderLeft: `2px solid ${accent}`, paddingLeft: 10, lineHeight: 1.6 }}>
          <div className="font-semibold">{vatTreatment === 'reverse_eu' ? t.reverseCharge : t.outsideEu}</div>
          {vatTreatment === 'reverse_eu' && client?.btw && <div>{t.clientVatId}: <span className="font-mono">{client.btw}</span></div>}
        </div>
      )}

      {(invoice.notes || editCtx.editMode) && (
        <div className="mb-8 p-4 rounded-md text-xs" style={{ background: '#f9f8f6', border: `1px solid ${editCtx.editMode ? 'rgba(0,0,0,0.12)' : 'var(--border)'}` }}>
          <div className="uppercase tracking-[0.12em] text-[9px] mb-1.5 font-semibold" style={{ color: 'var(--muted)' }}>{t.notes}</div>
          {editCtx.editMode ? (
            <EditableField
              value={editCtx.editValues.notes ?? invoice.notes ?? ''}
              onChange={val => editCtx.onEdit('notes', val)}
              className="whitespace-pre-wrap leading-relaxed"
              style={{ color: 'var(--ink-2)' }}
            />
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--ink-2)' }}>{invoice.notes}</div>
          )}
        </div>
      )}
    </>
  );
};

// ── Shared: footer met bank + registratiegegevens ────────────────────────────
// Build EPC/SEPA QR code data string (GiroCode / EPC002-12 v1.0)
const buildEpcQr = ({ iban, bic, name, amount, reference }) => {
  if (!iban || !name) return null;
  const amtStr = amount && amount > 0 ? `EUR${Number(amount).toFixed(2)}` : 'EUR0.00';
  return [
    'BCD',
    '002',
    '1',
    'SCT',
    bic || '',
    name.slice(0, 70),
    iban.replace(/\s/g, ''),
    amtStr,
    '',
    '',
    (reference || '').slice(0, 140),
  ].join('\n');
};

const InvoiceFooter = ({ entity, jur, parentEntity, style = 'executive', invoice, totals }) => {
  const editCtx = useContext(InvoiceEditContext);
  const t = getInvoiceT(invoice?.language, invoice);
  const legalEntity = (entity?.type === 'label' && parentEntity) ? parentEntity : entity;
  const legalJur = (entity?.type === 'label' && parentEntity) ? JURISDICTIONS[parentEntity.jurisdiction || 'NL'] : jur;
  const opts = entity?.templateOptions || {};

  // Per-invoice override: invoice.qrEnabled = true (force on) | false (force off) | undefined (follow template)
  const qrOn = invoice?.qrEnabled === true ? true : invoice?.qrEnabled === false ? false : opts.showQrCode !== false;
  // EPC/SEPA QR is only valid for EUR transactions (SEPA countries)
  const isSepaCompatible = !invoice?.currency || invoice?.currency === 'EUR';
  // QR met het nog openstaande bedrag; niet voor creditnota's of als er niets (meer) te betalen is
  const qrAmount = !invoice ? 0 : invoice.status === 'draft' || !invoice.status ? Number(totals?.total || 0) : invoiceOpenAmount(invoice);
  const epcData = (qrOn && isSepaCompatible && !isCreditNote(invoice) && qrAmount > 0.005) ? buildEpcQr({
    iban: legalEntity.iban,
    bic: legalEntity.bicCode,
    name: legalEntity.name,
    amount: roundMoney(qrAmount),
    reference: invoice?.number,
  }) : null;
  const qrUrl = epcData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&ecc=M&margin=4&data=${encodeURIComponent(epcData)}`
    : null;

  return (
    <div className="invoice-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 8, pageBreakInside: 'avoid' }}>
      {entity?.type === 'label' && parentEntity && (
        <div className="text-[10px] mb-3 italic" style={{ color: 'var(--muted)' }}>
          {t.tradingNameOf(entity.name, parentEntity.name)}
        </div>
      )}

      {/* Handtekening */}
      {opts.showSignature && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ width: 200 }}>
            {opts.signatureImage
              ? <img src={opts.signatureImage} alt="Handtekening" style={{ maxHeight: 56, maxWidth: 180, objectFit: 'contain', display: 'block', marginBottom: 4 }} />
              : <div style={{ height: 44, borderBottom: '1px solid #ccc', marginBottom: 4 }} />
            }
            <div style={{ fontSize: 9, color: 'var(--muted)' }}>{opts.signatureLabel || t.signature}</div>
          </div>
        </div>
      )}

      {opts.showFooterText !== false && (editCtx.editMode || entity.footerText) && (
        editCtx.editMode ? (
          <EditableField
            value={editCtx.editValues.footerText ?? entity.footerText ?? ''}
            onChange={val => editCtx.onEdit('footerText', val)}
            className="text-xs mb-4"
            style={{ color: 'var(--ink-2)', fontStyle: 'italic', display: 'block' }}
          />
        ) : style === 'bloom' ? (
          <div style={{ textAlign: 'center', padding: '18px 0 14px', margin: '4px 0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ flex: 1, height: 0.5, background: 'linear-gradient(to right, transparent, #ddd)' }} />
              <span style={{ color: entity.accentColor || '#C9899E', fontSize: 13 }}>✦</span>
              <div style={{ flex: 1, height: 0.5, background: 'linear-gradient(to left, transparent, #ddd)' }} />
            </div>
            <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic', fontFamily: 'Fraunces, Georgia, serif', lineHeight: 1.8 }}>
              {entity.footerText}
            </div>
          </div>
        ) : style === 'velvet' ? (
          <div style={{ padding: '12px 18px', marginBottom: 18, background: '#FDF8F4', border: '1px solid #EAD9C8', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#7a6a5a', fontStyle: 'italic', lineHeight: 1.8, fontFamily: 'Fraunces, Georgia, serif' }}>
              {entity.footerText}
            </div>
          </div>
        ) : (
          <div className="text-xs mb-4" style={{ color: 'var(--ink-2)', fontStyle: 'italic' }}>{entity.footerText}</div>
        )
      )}

      {/* Bedrijfsgegevens (naam, adres, KvK, BTW-id) zijn wettelijk verplicht en staan er altijd;
          alleen bankgegevens + QR volgen de template-optie. Bij een label: gegevens van de moeder. */}
      <div className="text-xs" style={{ display: 'grid', gridTemplateColumns: opts.showBankDetails === false ? '1fr' : qrUrl ? '1fr auto 1fr' : '1fr 1fr', gap: 24, alignItems: 'flex-start', color: 'var(--ink-2)' }}>
        {opts.showBankDetails !== false && (
          <div>
            <div className="uppercase tracking-[0.12em] text-[9px] mb-2 font-semibold" style={{ color: 'var(--muted)' }}>{t.bankDetails}</div>
            {legalEntity.iban && <div className="font-mono font-medium" style={{ color: 'var(--ink)', letterSpacing: '0.05em' }}>{legalEntity.iban}</div>}
            <div className="mt-0.5">{t.payableTo} {legalEntity.name}</div>
            {legalEntity.bicCode && <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>BIC: {legalEntity.bicCode}</div>}
          </div>
        )}
        {opts.showBankDetails !== false && qrUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{ padding: 4, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <img src={qrUrl} alt="SEPA betaal-QR" width={84} height={84} style={{ display: 'block' }} />
            </div>
            <div style={{ fontSize: 7.5, color: '#aaa', textAlign: 'center', lineHeight: 1.4, letterSpacing: '0.04em' }}>
              {t.scanQr.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
            </div>
          </div>
        )}
        <div className={opts.showBankDetails === false ? '' : 'text-right'}>
          <div className="uppercase tracking-[0.12em] text-[9px] mb-2 font-semibold" style={{ color: 'var(--muted)' }}>{t.companyDetails}</div>
          <div className="font-medium" style={{ color: 'var(--ink)' }}>{legalEntity.name}</div>
          {legalEntity.address && <div className="mt-0.5">{legalEntity.address}</div>}
          {(legalEntity.postal || legalEntity.city) && <div>{[legalEntity.postal, legalEntity.city].filter(Boolean).join(' ')}{legalEntity.country ? `, ${legalEntity.country}` : ''}</div>}
          {legalEntity.registrationNumber && <div className="mt-0.5">{t.regNumber(legalJur.code)}: <span className="font-mono">{legalEntity.registrationNumber}</span></div>}
          {legalEntity.taxNumber && <div>{legalJur.salesTax.name}-id: <span className="font-mono">{legalEntity.taxNumber}</span></div>}
          {legalEntity.website && <div className="mt-0.5" style={{ color: 'var(--muted)' }}>{legalEntity.website}</div>}
        </div>
      </div>
    </div>
  );
};

// ── Shared: adresblok klant ──────────────────────────────────────────────────
const InvoiceClientBlock = ({ client, t }) => (
  <div className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
    <div className="font-semibold text-sm mb-0.5" style={{ color: 'var(--ink)' }}>{client?.name || '—'}</div>
    {client?.contactName && <div>{(t?.attn || 'T.a.v.')} {client.contactName}</div>}
    {client?.address && <div>{client.address}</div>}
    {(client?.postal || client?.city) && <div>{client.postal} {client.city}</div>}
    {client?.country && <div>{client.country}</div>}
    {client?.btw && <div className="mt-1 text-[10px]" style={{ color: 'var(--muted)' }}>{t?.clientVatId ? `${t.clientVatId}: ` : ''}<span className="font-mono">{client.btw}</span></div>}
  </div>
);

// ── Shared: logo/tekst kop ───────────────────────────────────────────────────
// headerMode: 'auto' (logo als aanwezig, anders tekst) | 'text' | 'logo' | 'both'
const EntityBrand = ({
  entity,
  logoHeight = 38, fontSize = 22, fontWeight = 600,
  fontFamily = 'Fraunces, Georgia, serif',
  color = '#1a1a1a', light = false, logoBackground = null,
}) => {
  const mode = entity.headerMode || 'auto';
  const hasLogo = !!entity.logo;
  const showLogo = hasLogo && mode !== 'text';
  const showText = !hasLogo || mode === 'text' || mode === 'both';
  const nameColor = light ? '#fff' : color;
  const scale = (entity.logoScale || 100) / 100;
  const align = entity.logoAlign || 'left';
  const alignMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: alignMap[align] }}>
      {showLogo && (
        logoBackground
          ? <div style={{ background: logoBackground, borderRadius: 8, padding: '8px 12px', display: 'inline-flex', marginBottom: showText ? 8 : 0 }}>
              <img src={entity.logo} alt={entity.name} style={{ height: logoHeight * scale, objectFit: 'contain', display: 'block' }} />
            </div>
          : <img src={entity.logo} alt={entity.name} style={{ height: logoHeight * scale, objectFit: 'contain', display: 'block', marginBottom: showText ? 6 : 0 }} />
      )}
      {showText && (
        <div style={{ fontFamily, fontSize, fontWeight, color: nameColor, lineHeight: 1.2 }}>{entity.name}</div>
      )}
    </div>
  );
};

// ── Template 1: EXECUTIVE ─────────────────────────────────────────────────────
// Fine letterhead stijl — klassiek zakelijk, hairline rules, precisie typografie
const TemplateClassic = ({ invoice, entity, client, totals, parentEntity }) => {
  const jur = JURISDICTIONS[entity.jurisdiction || 'NL'];
  const accent = entity.accentColor || '#7C2D2D';
  const opts = entity?.templateOptions || {};
  const t = getInvoiceT(invoice.language, invoice);
  return (
    <div className="bg-white" style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, fontFamily: 'Geist, -apple-system, sans-serif' }}>
      {/* Accent top bar */}
      <div style={{ height: 4, background: accent }} />
      <div style={{ padding: '48px 56px 40px' }}>
        {/* Header: logo/naam links, "FACTUUR" rechts */}
        <div className="flex items-start justify-between mb-12">
          <div>
            <EntityBrand entity={entity} fontSize={22} logoHeight={44} />
            <div style={{ fontSize: 11, lineHeight: 1.7, color: 'var(--ink-2)', marginTop: 8 }}>
              {opts.showAddress !== false && entity.address && <div>{entity.address}</div>}
              {opts.showAddress !== false && (entity.postal || entity.city) && <div>{entity.postal} {entity.city}</div>}
              {opts.showAddress !== false && entity.country && <div>{entity.country}</div>}
              {opts.showEmail !== false && entity.email && <div style={{ marginTop: 4 }}>{entity.email}</div>}
              {opts.showPhone !== false && entity.phone && <div>{entity.phone}</div>}
              {opts.showWebsite === true && entity.website && <div style={{ color: 'var(--muted)' }}>{entity.website}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>{t.invoice}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 500, color: accent, letterSpacing: '0.04em' }}>{invoice.number}</div>
            {invoice.reference && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>{t.ref}: {invoice.reference}</div>}
            {invoice.ncf && <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 2 }}>NCF: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{invoice.ncf}</span></div>}
          </div>
        </div>

        {/* Info grid: klant + factuurdata */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>{t.invoiceTo}</div>
            <InvoiceClientBlock client={client} t={t} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>{t.invoiceDetails}</div>
            <div style={{ fontSize: 11, lineHeight: 2, color: 'var(--ink-2)', fontFamily: 'JetBrains Mono, monospace' }}>
              <div><span style={{ color: 'var(--muted)', fontFamily: 'Geist, sans-serif', fontSize: 10 }}>{t.date} </span>{fmtDate(invoice.issueDate)}</div>
              <div><span style={{ color: 'var(--muted)', fontFamily: 'Geist, sans-serif', fontSize: 10 }}>{t.due} </span>{fmtDate(invoice.dueDate)}</div>
              {invoice.reference && <div><span style={{ color: 'var(--muted)', fontFamily: 'Geist, sans-serif', fontSize: 10 }}>{t.ref} </span>{invoice.reference}</div>}
              {invoice.ncf && <div><span style={{ color: 'var(--muted)', fontFamily: 'Geist, sans-serif', fontSize: 10 }}>NCF </span><span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{invoice.ncf}</span></div>}
            </div>
          </div>
        </div>

        <InvoiceLineItemsAndTotals invoice={invoice} client={client} totals={totals} jur={jur} accent={accent} style="executive" />
        <InvoiceFooter entity={entity} jur={jur} parentEntity={parentEntity} style="executive" invoice={invoice} totals={totals} />
      </div>
    </div>
  );
};

// ── Template 2: STUDIO ────────────────────────────────────────────────────────
// Full-bleed header — modern, agency/SaaS, krachtig merkgevoel
const TemplateModern = ({ invoice, entity, client, totals, parentEntity }) => {
  const jur = JURISDICTIONS[entity.jurisdiction || 'NL'];
  const accent = entity.accentColor || '#7C2D2D';
  const opts = entity?.templateOptions || {};
  const t = getInvoiceT(invoice.language, invoice);
  return (
    <div className="bg-white" style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, fontFamily: 'Geist, -apple-system, sans-serif' }}>
      {/* Full-bleed header */}
      <div style={{ background: accent, padding: '36px 52px 32px', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative circle */}
        <div style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 40, bottom: -80, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
          <div>
            <EntityBrand entity={entity} fontSize={24} fontWeight={600} light={true} logoHeight={36} logoBackground="rgba(255,255,255,0.15)" />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>
              {opts.showEmail !== false && entity.email && <span>{entity.email}</span>}
              {opts.showPhone !== false && entity.phone && <span> · {entity.phone}</span>}
              {opts.showWebsite === true && entity.website && <span> · {entity.website}</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>{t.invoice}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 500, color: '#fff', letterSpacing: '0.04em' }}>{invoice.number}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>
              <div>{fmtDate(invoice.issueDate)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-header: klant + data */}
      <div style={{ background: '#f9f8f6', padding: '20px 52px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>{t.invoiceTo}</div>
          <InvoiceClientBlock client={client} t={t} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>{t.invoiceDetails}</div>
          <div style={{ fontSize: 11, lineHeight: 1.9, color: 'var(--ink-2)' }}>
            <div>{t.invoiceDate}: <span className="num" style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(invoice.issueDate)}</span></div>
            <div>{t.dueDate}: <span className="num" style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(invoice.dueDate)}</span></div>
            {invoice.reference && <div>{t.reference}: <span style={{ color: 'var(--ink)' }}>{invoice.reference}</span></div>}
            {invoice.ncf && <div>NCF: <span style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{invoice.ncf}</span></div>}
          </div>
        </div>
      </div>

      <div style={{ padding: '36px 52px 48px' }}>
        <InvoiceLineItemsAndTotals invoice={invoice} client={client} totals={totals} jur={jur} accent={accent} style="studio" />
        <InvoiceFooter entity={entity} jur={jur} parentEntity={parentEntity} style="studio" invoice={invoice} totals={totals} />
      </div>
    </div>
  );
};

// ── Template 3: ATELIER ───────────────────────────────────────────────────────
// Maximale witruimte — luxe minimalistisch, architect/designer/consultant stijl
const TemplateMinimal = ({ invoice, entity, client, totals, parentEntity }) => {
  const jur = JURISDICTIONS[entity.jurisdiction || 'NL'];
  const accent = entity.accentColor || '#7C2D2D';
  const opts = entity?.templateOptions || {};
  const t = getInvoiceT(invoice.language, invoice);
  return (
    <div className="bg-white" style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, padding: '64px 72px 56px', fontFamily: 'Geist, -apple-system, sans-serif' }}>
      {/* Decorative accent dot */}
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, marginBottom: 32 }} />

      {/* Company name as headline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 56 }}>
        <div>
          <EntityBrand entity={entity} fontSize={28} fontWeight={400} logoHeight={38} />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.8 }}>
            {opts.showAddress !== false && entity.address && <span>{entity.address} · </span>}
            {opts.showAddress !== false && (entity.postal || entity.city) && <span>{entity.postal} {entity.city} · </span>}
            {opts.showEmail !== false && entity.email && <span>{entity.email}</span>}
            {opts.showPhone !== false && entity.phone && <span> · {entity.phone}</span>}
            {opts.showWebsite === true && entity.website && <span> · {entity.website}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>{t.invoice}</div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 32, fontWeight: 300, color: 'var(--ink)', letterSpacing: '-0.02em' }}>№{invoice.number}</div>
        </div>
      </div>

      {/* Hairline separator */}
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 40 }} />

      {/* Three-column info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32, marginBottom: 48 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>{t.invoiceTo}</div>
          <InvoiceClientBlock client={client} t={t} />
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>{t.date}</div>
          <div style={{ fontSize: 11, lineHeight: 2, color: 'var(--ink-2)' }}>
            <div>{t.invoiceDate}: <span className="num" style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(invoice.issueDate)}</span></div>
            <div>{t.dueDate}: <span className="num" style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(invoice.dueDate)}</span></div>
            {invoice.ncf && <div>NCF: <span className="num" style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{invoice.ncf}</span></div>}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>{t.total}</div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 24, fontWeight: 400, color: accent }}>{fmtCurrency(totals.total, invoice.currency)}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{t.inclTax(jur.salesTax.name)}</div>
        </div>
      </div>

      <InvoiceLineItemsAndTotals invoice={invoice} client={client} totals={totals} jur={jur} accent={accent} style="atelier" />
      <InvoiceFooter entity={entity} jur={jur} parentEntity={parentEntity} style="atelier" invoice={invoice} totals={totals} />
    </div>
  );
};

// ── Template 4: SIGNATURE ─────────────────────────────────────────────────────
// Gekleurde zijbalk — luxury consultancy, hoge merkidentiteit
const TemplateStatement = ({ invoice, entity, client, totals, parentEntity }) => {
  const jur = JURISDICTIONS[entity.jurisdiction || 'NL'];
  const accent = entity.accentColor || '#7C2D2D';
  const opts = entity?.templateOptions || {};
  const logoScale = (entity.logoScale || 100) / 100;
  const t = getInvoiceT(invoice.language, invoice);
  return (
    <div className="bg-white" style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, display: 'flex', fontFamily: 'Geist, -apple-system, sans-serif' }}>
      {/* Left sidebar */}
      <div style={{ width: 72, flexShrink: 0, background: accent, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '32px 0' }}>
        {entity.logo && (entity.headerMode || 'auto') !== 'text'
          ? <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 6, padding: 8, margin: '0 8px' }}>
              <img src={entity.logo} alt="logo" style={{ width: Math.min(40 * logoScale, 52), height: Math.min(40 * logoScale, 52), objectFit: 'contain' }} />
            </div>
          : <div style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', padding: '0 4px' }}>
              {entity.name}
            </div>
        }
        <div style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.08em', padding: '0 4px' }}>
          {invoice.number}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '44px 48px 44px 44px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36, paddingBottom: 28, borderBottom: `1px solid var(--border)` }}>
          <div>
            <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 26, fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.01em' }}>{entity.name}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, lineHeight: 1.7 }}>
              {opts.showAddress !== false && entity.address && <span>{entity.address} · </span>}
              {opts.showAddress !== false && (entity.postal || entity.city) && <span>{entity.postal} {entity.city}</span>}
              {opts.showEmail !== false && entity.email && <div>{entity.email}{opts.showPhone !== false && entity.phone ? ` · ${entity.phone}` : ''}</div>}
              {opts.showWebsite === true && entity.website && <div style={{ color: 'var(--muted)' }}>{entity.website}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{t.invoice}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 600, color: accent }}>{invoice.number}</div>
            {invoice.ncf && <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3 }}>NCF: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{invoice.ncf}</span></div>}
          </div>
        </div>

        {/* Client + data */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginBottom: 36 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>{t.invoiceTo}</div>
            <InvoiceClientBlock client={client} t={t} />
          </div>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>{t.details}</div>
            <div style={{ fontSize: 11, lineHeight: 2, color: 'var(--ink-2)' }}>
              <div>{t.date}: <span className="num" style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(invoice.issueDate)}</span></div>
              <div>{t.due}: <span className="num" style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(invoice.dueDate)}</span></div>
              {invoice.reference && <div>{t.ref}: <span style={{ color: 'var(--ink)' }}>{invoice.reference}</span></div>}
              {invoice.ncf && <div>NCF: <span style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{invoice.ncf}</span></div>}
            </div>
          </div>
        </div>

        <InvoiceLineItemsAndTotals invoice={invoice} client={client} totals={totals} jur={jur} accent={accent} style="signature" />
        <InvoiceFooter entity={entity} jur={jur} parentEntity={parentEntity} style="signature" invoice={invoice} totals={totals} />
      </div>
    </div>
  );
};

// ── Template 5: NOMAD ─────────────────────────────────────────────────────────
// Luchtig minimalistisch — rechter accentstreep, info-strip, voor freelancers
const TemplateNordic = ({ invoice, entity, client, totals, parentEntity }) => {
  const jur = JURISDICTIONS[entity.jurisdiction || 'NL'];
  const accent = entity.accentColor || '#7C2D2D';
  const opts = entity?.templateOptions || {};
  const t = getInvoiceT(invoice.language, invoice);
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, background: '#fff', fontFamily: 'Geist, -apple-system, sans-serif', position: 'relative', overflow: 'hidden' }}>
      {/* Rechter accentstreep */}
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, background: accent }} />

      <div style={{ padding: '52px 64px 44px 56px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 44 }}>
          <div>
            <EntityBrand entity={entity} fontSize={22} />
            <div style={{ fontSize: 10.5, color: '#888', marginTop: 7, lineHeight: 1.85 }}>
              {opts.showAddress !== false && entity.address && <div>{entity.address}{(entity.postal || entity.city) ? `, ${entity.postal} ${entity.city}` : ''}</div>}
              {opts.showEmail !== false && entity.email && <div>{entity.email}{opts.showPhone !== false && entity.phone ? ` · ${entity.phone}` : ''}</div>}
              {opts.showWebsite === true && entity.website && <div>{entity.website}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#ccc', marginBottom: 6 }}>{t.invoice}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 600, color: accent, letterSpacing: '0.03em' }}>{invoice.number}</div>
            {invoice.reference && <div style={{ fontSize: 9, color: '#bbb', marginTop: 4 }}>{t.ref}: {invoice.reference}</div>}
            {invoice.ncf && <div style={{ fontSize: 9, color: '#bbb', marginTop: 2 }}>NCF: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{invoice.ncf}</span></div>}
          </div>
        </div>

        {/* Hairline */}
        <div style={{ height: 1, background: '#ebebeb', marginBottom: 28 }} />

        {/* Info strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: '#fafaf8', borderRadius: 10, marginBottom: 40, overflow: 'hidden' }}>
          {[
            { label: t.invoiceTo, content: <InvoiceClientBlock client={client} t={t} /> },
            { label: t.date, content: (
              <div style={{ fontSize: 11, lineHeight: 2, color: '#555' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(invoice.issueDate)}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', color: '#999' }}>{t.due} {fmtDate(invoice.dueDate)}</div>
              </div>
            )},
            { label: t.total, content: (
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: accent }}>{fmtCurrency(totals.total, invoice.currency)}</div>
                <div style={{ fontSize: 9, color: '#bbb', marginTop: 3 }}>{t.inclTax(jur.salesTax.name)}</div>
              </div>
            )},
          ].map((col, i) => (
            <div key={i} style={{ padding: '20px 24px', borderRight: i < 2 ? '1px solid #ebebeb' : 'none' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: '#ccc', marginBottom: 10 }}>{col.label}</div>
              {col.content}
            </div>
          ))}
        </div>

        <InvoiceLineItemsAndTotals invoice={invoice} client={client} totals={totals} jur={jur} accent={accent} style="nordic" />
        <InvoiceFooter entity={entity} jur={jur} parentEntity={parentEntity} style="nordic" invoice={invoice} totals={totals} />
      </div>
    </div>
  );
};

// ── Template 6: CANVAS ────────────────────────────────────────────────────────
// Creatieve studio — naam als masthead, accentlijn, clean tweekoloms info
const TemplateBold = ({ invoice, entity, client, totals, parentEntity }) => {
  const jur = JURISDICTIONS[entity.jurisdiction || 'NL'];
  const accent = entity.accentColor || '#7C2D2D';
  const opts = entity?.templateOptions || {};
  const t = getInvoiceT(invoice.language, invoice);
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, background: '#fff', fontFamily: 'Geist, -apple-system, sans-serif' }}>
      <div style={{ padding: '48px 56px 0' }}>
        {/* Masthead */}
        <div style={{ paddingBottom: 18, borderBottom: `3px solid ${accent}`, marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <EntityBrand entity={entity} fontSize={30} fontWeight={700} />
            <div style={{ textAlign: 'right', marginBottom: 2 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#bbb', marginBottom: 5 }}>{t.invoiceNumber}</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 26, fontWeight: 800, color: accent, letterSpacing: '-0.01em', lineHeight: 1 }}>{invoice.number}</div>
              {invoice.ncf && <div style={{ fontSize: 9, color: '#bbb', marginTop: 4 }}>NCF: <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{invoice.ncf}</span></div>}
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: '#999', marginTop: 10, lineHeight: 1.7 }}>
            {opts.showAddress !== false && entity.address && <span>{entity.address}</span>}
            {opts.showAddress !== false && (entity.postal || entity.city) && <span> · {entity.postal} {entity.city}</span>}
            {opts.showEmail !== false && entity.email && <span> · {entity.email}</span>}
            {opts.showPhone !== false && entity.phone && <span> · {entity.phone}</span>}
            {opts.showWebsite === true && entity.website && <span> · {entity.website}</span>}
          </div>
        </div>

        {/* Info: client left, details right in card */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 36 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: '#bbb', marginBottom: 10 }}>{t.invoiceTo}</div>
            <InvoiceClientBlock client={client} t={t} />
          </div>
          <div style={{ background: '#f6f5f2', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: '#bbb', marginBottom: 10 }}>{t.invoiceDetails}</div>
            <div style={{ fontSize: 11, lineHeight: 2, color: '#555' }}>
              <div>{t.date} <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#1a1a1a', float: 'right' }}>{fmtDate(invoice.issueDate)}</span></div>
              <div>{t.due} <span style={{ fontFamily: 'JetBrains Mono, monospace', color: accent, float: 'right' }}>{fmtDate(invoice.dueDate)}</span></div>
              {invoice.reference && <div>{t.ref} <span style={{ color: '#1a1a1a', float: 'right' }}>{invoice.reference}</span></div>}
              {invoice.ncf && <div>NCF <span style={{ color: '#1a1a1a', float: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{invoice.ncf}</span></div>}
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e4e1db', fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: accent }}>{fmtCurrency(totals.total, invoice.currency)}</div>
          </div>
        </div>

        <InvoiceLineItemsAndTotals invoice={invoice} client={client} totals={totals} jur={jur} accent={accent} style="bold" />
        <InvoiceFooter entity={entity} jur={jur} parentEntity={parentEntity} style="bold" invoice={invoice} totals={totals} />
      </div>
    </div>
  );
};

// ── Template 7: DUSK ──────────────────────────────────────────────────────────
// Gespleten header — bedrijf wit links, factuurdetails in accentkleur rechts
const TemplateHorizon = ({ invoice, entity, client, totals, parentEntity }) => {
  const jur = JURISDICTIONS[entity.jurisdiction || 'NL'];
  const accent = entity.accentColor || '#7C2D2D';
  const opts = entity?.templateOptions || {};
  const t = getInvoiceT(invoice.language, invoice);
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, background: '#fff', fontFamily: 'Geist, -apple-system, sans-serif' }}>
      {/* Gespleten header */}
      <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', minHeight: 148 }}>
        <div style={{ background: '#fff', padding: '36px 40px 28px 52px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <EntityBrand entity={entity} fontSize={20} />
          <div style={{ fontSize: 10, color: '#999', marginTop: 7, lineHeight: 1.85 }}>
            {opts.showAddress !== false && entity.address && <div>{entity.address}{(entity.postal || entity.city) ? `, ${entity.postal} ${entity.city}` : ''}</div>}
            {opts.showEmail !== false && entity.email && <div>{entity.email}{opts.showPhone !== false && entity.phone ? ` · ${entity.phone}` : ''}</div>}
            {opts.showWebsite === true && entity.website && <div>{entity.website}</div>}
          </div>
        </div>
        <div style={{ background: accent, padding: '36px 52px 28px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{t.invoice}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 600, color: '#fff', letterSpacing: '0.03em' }}>{invoice.number}</div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.9 }}>
            <div>{fmtDate(invoice.issueDate)}</div>
            <div style={{ opacity: 0.7 }}>{t.due} {fmtDate(invoice.dueDate)}</div>
            {invoice.reference && <div style={{ opacity: 0.6, fontFamily: 'Geist, sans-serif', fontSize: 9 }}>Ref: {invoice.reference}</div>}
            {invoice.ncf && <div style={{ opacity: 0.7, fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>NCF: {invoice.ncf}</div>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '32px 52px 44px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 32, paddingBottom: 28, borderBottom: '1px solid #ebebeb' }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: '#ccc', marginBottom: 8 }}>{t.invoiceTo}</div>
            <InvoiceClientBlock client={client} t={t} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: '#ccc', marginBottom: 8 }}>{t.total}</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 24, fontWeight: 700, color: accent }}>{fmtCurrency(totals.total, invoice.currency)}</div>
            <div style={{ fontSize: 9, color: '#ccc', marginTop: 3 }}>{t.inclTax(jur.salesTax.name)}</div>
          </div>
        </div>
        <InvoiceLineItemsAndTotals invoice={invoice} client={client} totals={totals} jur={jur} accent={accent} style="horizon" />
        <InvoiceFooter entity={entity} jur={jur} parentEntity={parentEntity} style="horizon" invoice={invoice} totals={totals} />
      </div>
    </div>
  );
};

// ── Template 8: FOLIO ─────────────────────────────────────────────────────────
// Warm tweedelig — linker paneel lichtbeige met accentrand, portfolio-gevoel
const TemplateSplit = ({ invoice, entity, client, totals, parentEntity }) => {
  const jur = JURISDICTIONS[entity.jurisdiction || 'NL'];
  const accent = entity.accentColor || '#7C2D2D';
  const opts = entity?.templateOptions || {};
  const t = getInvoiceT(invoice.language, invoice);
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, display: 'flex', fontFamily: 'Geist, -apple-system, sans-serif' }}>
      {/* Links paneel: warm beige, linkerrand in accent */}
      <div style={{ width: 200, flexShrink: 0, background: '#F7F4EF', borderLeft: `4px solid ${accent}`, padding: '44px 22px 44px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <EntityBrand entity={entity} fontSize={15} fontWeight={700} fontFamily="Fraunces, Georgia, serif" color={accent} />
          <div style={{ fontSize: 9.5, color: '#aaa', marginTop: 8, lineHeight: 1.9 }}>
            {opts.showAddress !== false && entity.address && <div>{entity.address}</div>}
            {opts.showAddress !== false && (entity.postal || entity.city) && <div>{entity.postal} {entity.city}</div>}
            {opts.showEmail !== false && entity.email && <div style={{ marginTop: 3 }}>{entity.email}</div>}
            {opts.showPhone !== false && entity.phone && <div>{entity.phone}</div>}
            {opts.showWebsite === true && entity.website && <div>{entity.website}</div>}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c5b9a8', marginBottom: 10, fontWeight: 700 }}>{t.invoiceTo}</div>
          <InvoiceClientBlock client={client} t={t} />
        </div>

        <div>
          <div style={{ fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c5b9a8', marginBottom: 10, fontWeight: 700 }}>{t.details}</div>
          <div style={{ fontSize: 10, color: '#666', lineHeight: 1.9 }}>
            <div><span style={{ color: '#c5b9a8' }}>{t.invoiceNumber} </span><span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#3a3530', fontSize: 9.5 }}>{invoice.number}</span></div>
            <div><span style={{ color: '#c5b9a8' }}>{t.date} </span><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5 }}>{fmtDate(invoice.issueDate)}</span></div>
            <div><span style={{ color: '#c5b9a8' }}>{t.due} </span><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5 }}>{fmtDate(invoice.dueDate)}</span></div>
            {invoice.reference && <div><span style={{ color: '#c5b9a8' }}>{t.ref} </span>{invoice.reference}</div>}
            {invoice.ncf && <div><span style={{ color: '#c5b9a8' }}>NCF </span><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5 }}>{invoice.ncf}</span></div>}
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 18, borderTop: '1px solid #e4ddd3' }}>
          <div style={{ fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c5b9a8', marginBottom: 6, fontWeight: 700 }}>{t.total}</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 17, fontWeight: 700, color: accent }}>{fmtCurrency(totals.total, invoice.currency)}</div>
        </div>
      </div>

      {/* Rechts paneel: clean wit */}
      <div style={{ flex: 1, padding: '44px 44px 44px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid #ebebeb' }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: accent, flexShrink: 0 }} />
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, color: '#bbb' }}>{t.invoice}</div>
        </div>
        <InvoiceLineItemsAndTotals invoice={invoice} client={client} totals={totals} jur={jur} accent={accent} style="split" />
        <InvoiceFooter entity={entity} jur={jur} parentEntity={parentEntity} style="split" invoice={invoice} totals={totals} />
      </div>
    </div>
  );
};

// ── Template 9: BLOOM ─────────────────────────────────────────────────────────
// Romantisch & elegant — bruiloft, beauty & événement facturatie
const TemplateBloom = ({ invoice, entity, client, totals, parentEntity }) => {
  const jur = JURISDICTIONS[entity.jurisdiction || 'NL'];
  const accent = entity.accentColor || '#C9899E';
  const opts = entity?.templateOptions || {};
  const t = getInvoiceT(invoice.language, invoice);
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, fontFamily: 'Geist, -apple-system, sans-serif', background: '#fff' }}>
      {/* Dunne accentlijn bovenaan */}
      <div style={{ height: 3, background: accent }} />

      {/* Gecentreerde koptekst */}
      <div style={{ padding: '38px 56px 28px', textAlign: 'center', borderBottom: '1px solid #f0ece8' }}>
        <EntityBrand entity={entity} fontSize={22} fontWeight={600} fontFamily="Fraunces, Georgia, serif" color="#2c2319" logoHeight={46} />
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ height: 0.5, width: 40, background: '#ddd' }} />
          <div style={{ fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#b8a8a8', fontWeight: 500 }}>
            {t.invoice} &nbsp;{invoice.number || '—'}
          </div>
          <div style={{ height: 0.5, width: 40, background: '#ddd' }} />
        </div>
      </div>

      {/* Klant + factuurdetails */}
      <div style={{ padding: '28px 56px 0', display: 'flex', justifyContent: 'space-between', gap: 32, alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 8.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: accent, marginBottom: 8, fontWeight: 600 }}>{t.invoiceTo}</div>
          <InvoiceClientBlock client={client} t={t} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 8.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: accent, marginBottom: 8, fontWeight: 600 }}>{t.details}</div>
          <div style={{ fontSize: 10, color: '#999', lineHeight: 2 }}>
            <div><span style={{ color: '#ccc' }}>{t.date} </span><span style={{ color: '#555' }}>{fmtDate(invoice.issueDate)}</span></div>
            <div><span style={{ color: '#ccc' }}>{t.due} </span><span style={{ color: '#555' }}>{fmtDate(invoice.dueDate)}</span></div>
            {invoice.reference && <div><span style={{ color: '#ccc' }}>{t.ref} </span><span style={{ color: '#555' }}>{invoice.reference}</span></div>}
            {invoice.ncf && <div><span style={{ color: '#ccc' }}>NCF </span><span style={{ color: '#555', fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>{invoice.ncf}</span></div>}
          </div>
        </div>
      </div>

      {/* Decoratief scheidingsteken */}
      <div style={{ textAlign: 'center', padding: '18px 0 4px', color: accent, fontSize: 15, opacity: 0.7 }}>✦</div>

      {/* Regels + totalen + notities */}
      <div style={{ padding: '4px 56px 48px' }}>
        <InvoiceLineItemsAndTotals invoice={invoice} client={client} totals={totals} jur={jur} accent={accent} style="atelier" />
        <InvoiceFooter entity={entity} jur={jur} parentEntity={parentEntity} style="bloom" invoice={invoice} totals={totals} />
      </div>
    </div>
  );
};

// ── Template 10: VELVET ────────────────────────────────────────────────────────
// Luxe donkere kop — high-end makeup & beauty studio stijl
const TemplateVelvet = ({ invoice, entity, client, totals, parentEntity }) => {
  const jur = JURISDICTIONS[entity.jurisdiction || 'NL'];
  const accent = entity.accentColor || '#9E6B7A';
  const opts = entity?.templateOptions || {};
  const t = getInvoiceT(invoice.language, invoice);
  // Donkere headerkleur: gebruik accent maar verduister het flink
  const headerBg = accent;
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, fontFamily: 'Geist, -apple-system, sans-serif', background: '#FDFAF7' }}>
      {/* Donkere full-bleed koptekst */}
      <div style={{ background: headerBg, padding: '36px 52px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <EntityBrand entity={entity} fontSize={20} fontWeight={600} fontFamily="Fraunces, Georgia, serif" color="#fff" logoHeight={44} light />
          {opts.showAddress !== false && entity.address && (
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 8, lineHeight: 1.7 }}>
              {entity.address && <div>{entity.address}</div>}
              {(entity.postal || entity.city) && <div>{entity.postal} {entity.city}</div>}
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 500 }}>{t.invoice}</div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 18, fontWeight: 600, color: '#fff', lineHeight: 1 }}>{invoice.number || '—'}</div>
          <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.65)', marginTop: 10, lineHeight: 1.9 }}>
            <div><span style={{ opacity: 0.7 }}>{t.date} </span>{fmtDate(invoice.issueDate)}</div>
            <div><span style={{ opacity: 0.7 }}>{t.due} </span>{fmtDate(invoice.dueDate)}</div>
            {invoice.ncf && <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}><span style={{ opacity: 0.7 }}>NCF </span>{invoice.ncf}</div>}
          </div>
        </div>
      </div>

      {/* Dunne accentlijn onder header */}
      <div style={{ height: 2, background: `linear-gradient(to right, ${accent}, transparent)` }} />

      {/* Body */}
      <div style={{ padding: '32px 52px 48px' }}>
        {/* Klantgegevens */}
        <div style={{ marginBottom: 28, padding: '16px 20px', background: '#fff', borderRadius: 6, border: '1px solid #EEE9E3', display: 'inline-block', minWidth: 220 }}>
          <div style={{ fontSize: 8.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: accent, marginBottom: 8, fontWeight: 600 }}>{t.invoiceTo}</div>
          <InvoiceClientBlock client={client} t={t} />
        </div>

        {/* Regels + totalen + notities */}
        <InvoiceLineItemsAndTotals invoice={invoice} client={client} totals={totals} jur={jur} accent={accent} style="executive" />
        <InvoiceFooter entity={entity} jur={jur} parentEntity={parentEntity} style="velvet" invoice={invoice} totals={totals} />
      </div>
    </div>
  );
};

const renderTemplate = (templateId, rawProps) => {
  // Facturen die (door een oude bug) met een dubbel nummer verstuurd zijn, hebben intern een
  // A/B/C-achtervoegsel. Op de factuur zelf blijft het nummer staan zoals de klant het kreeg.
  // Oude creditnota's kregen per ongeluk het `numberAsSent` van de originele factuur mee — die negeren.
  const inv = rawProps.invoice;
  const asSent = inv?.numberAsSent && !(isCreditNote(inv) && !/^CN/i.test(inv.numberAsSent)) ? inv.numberAsSent : null;
  const props = asSent
    ? { ...rawProps, invoice: { ...inv, number: asSent } }
    : rawProps;
  switch (templateId) {
    case 'modern': return <TemplateModern {...props} />;
    case 'minimal': return <TemplateMinimal {...props} />;
    case 'statement': return <TemplateStatement {...props} />;
    case 'nordic': return <TemplateNordic {...props} />;
    case 'bold': return <TemplateBold {...props} />;
    case 'horizon': return <TemplateHorizon {...props} />;
    case 'split': return <TemplateSplit {...props} />;
    case 'bloom': return <TemplateBloom {...props} />;
    case 'velvet': return <TemplateVelvet {...props} />;
    default: return <TemplateClassic {...props} />;
  }
};

// ============================================================================
// TEMPLATE GALLERY (kies stijl met live preview)
// ============================================================================
const ACCENT_PRESETS = [
  { label: 'Diepblauw', value: '#1e3a5f' },
  { label: 'Accent blauw', value: '#2563eb' },
  { label: 'Sky', value: '#0ea5e9' },
  { label: 'Smaragd', value: '#059669' },
  { label: 'Bordeaux', value: '#7C2D2D' },
  { label: 'Crimson', value: '#dc2626' },
  { label: 'Oranje', value: '#ea580c' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Paars', value: '#7c3aed' },
  { label: 'Roze', value: '#db2777' },
  { label: 'Antraciet', value: '#374151' },
  { label: 'Zwart', value: '#111827' },
  { label: 'Blush', value: '#C9899E' },
  { label: 'Mauve', value: '#9E6B7A' },
  { label: 'Champagne', value: '#B8966A' },
  { label: 'Salie', value: '#6B8F7A' },
];

const TemplateGallery = ({ entity, onUpdate, sampleInvoice, sampleClient }) => {
  const totals = computeInvoice(sampleInvoice.items);
  const accent = entity.accentColor || '#7C2D2D';
  const [docEditMode, setDocEditMode] = useState(false);
  const [editValues, setEditValues] = useState({});
  const [hexInput, setHexInput] = useState('');
  const [hexFocused, setHexFocused] = useState(false);

  const applyHex = (raw) => {
    const v = raw.replace(/^#/, '').trim();
    if (/^[0-9a-fA-F]{6}$/.test(v)) {
      onUpdate({ ...entity, accentColor: '#' + v.toUpperCase() });
    }
  };

  const handleOpenEdit = () => {
    setEditValues({
      notes: sampleInvoice.notes ?? '',
      footerText: entity.footerText ?? '',
    });
    setDocEditMode(true);
  };

  const handleEdit = (key, val) => setEditValues(prev => ({ ...prev, [key]: val }));

  const handleSaveEdits = () => {
    const updates = { ...entity };
    if (editValues.footerText !== undefined) updates.footerText = editValues.footerText;
    if (editValues.notes !== undefined) {
      updates.templateOptions = { ...(entity.templateOptions || {}), defaultNotes: editValues.notes };
    }
    onUpdate(updates);
    setDocEditMode(false);
  };

  return (
    <div className="space-y-4">
      {/* Color picker */}
      <Card className="p-5">
        <div className="text-xs font-semibold mb-3" style={{ color: 'var(--ink-2)' }}>Accentkleur</div>
        <div className="flex items-center gap-3 flex-wrap">
          {ACCENT_PRESETS.map(p => (
            <button
              key={p.value}
              title={p.label}
              onClick={() => onUpdate({ ...entity, accentColor: p.value })}
              style={{
                width: 28, height: 28, borderRadius: '50%', background: p.value, border: 'none', cursor: 'pointer',
                boxShadow: accent === p.value ? `0 0 0 3px var(--surface), 0 0 0 5px ${p.value}` : '0 1px 3px rgba(0,0,0,0.3)',
                transition: 'box-shadow 0.15s',
              }}
            />
          ))}
          <label title="Aangepaste kleur" style={{ position: 'relative', width: 28, height: 28, cursor: 'pointer', flexShrink: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
              border: '2px solid var(--border-2)',
              boxShadow: !ACCENT_PRESETS.some(p => p.value === accent) ? `0 0 0 3px var(--surface), 0 0 0 5px ${accent}` : 'none',
            }} />
            <input
              type="color"
              value={accent}
              onChange={e => onUpdate({ ...entity, accentColor: e.target.value })}
              style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
            <div style={{ width: 20, height: 20, borderRadius: 4, background: accent, border: '1px solid var(--border-2)', flexShrink: 0 }} />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--muted)', userSelect: 'none' }}>#</span>
            <input
              value={hexFocused ? hexInput : accent.replace('#', '')}
              onFocus={() => { setHexFocused(true); setHexInput(accent.replace('#', '')); }}
              onChange={e => setHexInput(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
              onBlur={() => { setHexFocused(false); applyHex(hexInput); }}
              onKeyDown={e => { if (e.key === 'Enter') { applyHex(hexInput); e.target.blur(); } }}
              placeholder="bijv. FF0000"
              style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--ink-2)',
                background: 'var(--surface-2)', border: '1px solid var(--border-2)',
                borderRadius: 5, padding: '3px 7px', width: 80, outline: 'none',
              }}
            />
          </div>
        </div>
      </Card>

      {/* Template grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {INVOICE_TEMPLATES.map(t => {
          const isActive = entity.templateId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onUpdate({ ...entity, templateId: t.id })}
              className="text-left p-4 rounded-lg border-2 transition-all"
              style={{
                borderColor: isActive ? 'var(--ink)' : 'var(--border)',
                background: isActive ? 'var(--surface-2)' : 'transparent',
              }}
            >
              <div className="aspect-[3/4] mb-3 rounded overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                <TemplateThumb templateId={t.id} accent={entity.accentColor} />
              </div>
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">{t.name}</div>
                {isActive && <Check size={14} style={{ color: 'var(--success)' }} />}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{t.description}</div>
            </button>
          );
        })}
      </div>
      {/* Header modus */}
      <Card className="p-5 space-y-3">
        <div className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>Kop — logo of tekst</div>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'auto', label: 'Automatisch', desc: 'Logo indien aanwezig, anders naam' },
            { value: 'logo', label: 'Alleen logo', desc: 'Verberg bedrijfsnaam als tekst' },
            { value: 'text', label: 'Alleen tekst', desc: 'Altijd bedrijfsnaam, geen logo' },
            { value: 'both', label: 'Logo + naam', desc: 'Logo én naam onder elkaar' },
          ].map(opt => {
            const active = (entity.headerMode || 'auto') === opt.value;
            return (
              <button key={opt.value} onClick={() => onUpdate({ ...entity, headerMode: opt.value })}
                className="text-left px-3 py-2 rounded-lg border text-xs transition-all"
                style={{ borderColor: active ? 'var(--btn-primary)' : 'var(--border)', background: active ? 'var(--btn-primary)' : 'transparent', color: active ? 'var(--btn-primary-text)' : 'var(--ink-2)' }}>
                <div className="font-medium">{opt.label}</div>
                <div className="mt-0.5 opacity-70">{opt.desc}</div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Logo grootte */}
      {entity.logo && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>Logo grootte</div>
            <span className="text-xs font-mono" style={{ color: 'var(--muted)' }}>{entity.logoScale || 100}%</span>
          </div>
          <input
            type="range" min="40" max="200" step="5"
            value={entity.logoScale || 100}
            onChange={e => onUpdate({ ...entity, logoScale: Number(e.target.value) })}
            className="w-full"
          />
          {/* Snelkeuze als Segmented, consistent met andere toggles */}
          <Segmented
            options={[60, 80, 100, 130, 160].map(v => ({ id: v, label: `${v}%` }))}
            value={entity.logoScale || 100}
            onChange={v => onUpdate({ ...entity, logoScale: v })}
          />
        </Card>
      )}

      {/* Bedrijfsinfo in koptekst */}
      <Card className="p-5 space-y-4">
        <div className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>Bedrijfsinfo in koptekst</div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'showAddress', label: 'Adres', default: true },
            { key: 'showEmail', label: 'E-mailadres', default: true },
            { key: 'showPhone', label: 'Telefoonnummer', default: true },
            { key: 'showWebsite', label: 'Website', default: false },
          ].map(({ key, label, default: def }) => {
            const opts = entity.templateOptions || {};
            const active = opts[key] !== undefined ? opts[key] : def;
            return (
              <button key={key} onClick={() => onUpdate({ ...entity, templateOptions: { ...opts, [key]: !active } })}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all text-left"
                style={{ borderColor: active ? 'var(--btn-primary)' : 'var(--border)', background: active ? 'var(--surface-2)' : 'transparent' }}>
                <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${active ? 'border-0' : ''}`}
                  style={{ background: active ? 'var(--btn-primary)' : 'transparent', borderColor: 'var(--border-strong)' }}>
                  {active && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" style={{ stroke: 'var(--btn-primary-text)' }} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
                </div>
                <span style={{ color: 'var(--ink-2)' }}>{label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Aanpassingen */}
      <Card className="p-5 space-y-4">
        <div className="text-xs font-semibold" style={{ color: 'var(--ink-2)' }}>Aanpassingen &amp; zichtbaarheid</div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'showBankDetails', label: 'Bankgegevens & bedrijfsinfo', default: true },
            { key: 'showQrCode', label: 'SEPA QR-betaalcode', default: true },
            { key: 'showFooterText', label: 'Voettekst', default: true },
            { key: 'showSignature', label: 'Handtekeningveld', default: false },
          ].map(({ key, label, default: def }) => {
            const opts = entity.templateOptions || {};
            const active = opts[key] !== undefined ? opts[key] : def;
            return (
              <button key={key} onClick={() => onUpdate({ ...entity, templateOptions: { ...opts, [key]: !active } })}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all text-left"
                style={{ borderColor: active ? 'var(--btn-primary)' : 'var(--border)', background: active ? 'var(--surface-2)' : 'transparent' }}>
                <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${active ? 'border-0' : ''}`}
                  style={{ background: active ? 'var(--btn-primary)' : 'transparent', borderColor: 'var(--border-strong)' }}>
                  {active && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" style={{ stroke: 'var(--btn-primary-text)' }} strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
                </div>
                <span style={{ color: 'var(--ink-2)' }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Handtekening opties */}
        {(entity.templateOptions?.showSignature) && (
          <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>Handtekening</div>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--muted)' }}>Label</label>
                <input
                  type="text"
                  value={entity.templateOptions?.signatureLabel || ''}
                  onChange={e => onUpdate({ ...entity, templateOptions: { ...(entity.templateOptions || {}), signatureLabel: e.target.value } })}
                  placeholder="Handtekening / Signature"
                  className="w-full px-3 py-2 text-sm rounded-lg border"
                  style={{ borderColor: 'var(--border-2)', background: 'var(--surface)', color: 'var(--text)' }}
                />
              </div>
              <div>
                <label className="block text-xs mb-1.5" style={{ color: 'var(--muted)' }}>Afbeelding uploaden (optioneel)</label>
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs"
                  style={{ borderColor: 'var(--border-2)', color: 'var(--ink-2)' }}>
                  {entity.templateOptions?.signatureImage
                    ? <><img src={entity.templateOptions.signatureImage} alt="" style={{ height: 28, objectFit: 'contain' }} /><span>Wijzigen</span></>
                    : <span>Kies afbeelding…</span>
                  }
                  <input type="file" accept="image/*" className="hidden" onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => onUpdate({ ...entity, templateOptions: { ...(entity.templateOptions || {}), signatureImage: ev.target.result } });
                    reader.readAsDataURL(file);
                  }} />
                </label>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-4" style={{ background: 'var(--surface-2)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[12px] font-medium" style={{ color: 'var(--muted)' }}>Live preview</div>
          <div className="flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-md border transition-all"
              style={{ color: 'var(--ink-2)', borderColor: 'var(--border-2)', background: 'var(--surface)', cursor: 'pointer' }}
              onClick={() => {
                const printWin = window.open('', '_blank', 'width=960,height=1200');
                const previewEl = document.getElementById('invoice-template-preview');
                const html = previewEl ? previewEl.innerHTML : '';
                printWin.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Factuur voorbeeld</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600&family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    :root {
      --ink: #1a1a1a; --ink-2: #4a4a4a; --muted: #888;
      --border: #e5e7eb; --border-2: #d1d5db; --border-strong: #9ca3af;
      --surface: #fff; --surface-2: #f9fafb; --surface-3: #f3f4f6;
      --text: #1a1a1a; --text-2: #4a4a4a; --text-3: #888;
    }
    body { margin: 0; background: #e8edf3; display: flex; flex-direction: column; align-items: center; padding: 32px 20px; font-family: Geist, -apple-system, sans-serif; gap: 16px; }
    .invoice-wrapper { background: #fff; width: 800px; box-shadow: 0 2px 32px rgba(0,0,0,0.13); }
    .print-bar { display: flex; gap: 10px; align-items: center; }
    .print-btn { background: #1a1a1a; color: #fff; border: none; padding: 9px 22px; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: Geist, sans-serif; font-weight: 500; letter-spacing: 0.01em; }
    .print-btn:hover { background: #333; }
    @media print { body { background: #fff; padding: 0; } .print-bar { display: none; } .invoice-wrapper { box-shadow: none; width: 100%; } }
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="print-btn" onclick="window.print()">&#128438; Afdrukken / Opslaan als PDF</button>
  </div>
  <div class="invoice-wrapper">${html}</div>
</body>
</html>`);
                printWin.document.close();
              }}
            >
              <Eye size={10} />
              Voorbeeld bekijken
            </button>
            {!docEditMode && (
              <button
                onClick={handleOpenEdit}
                className="flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-md border transition-all"
                style={{ color: 'var(--ink-2)', borderColor: 'var(--border-2)', background: 'var(--surface)', cursor: 'pointer' }}
              >
                <Edit3 size={10} />
                Tekst bewerken
              </button>
            )}
          </div>
        </div>

        {docEditMode ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {entity.logo && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-md border" style={{ borderColor: 'var(--border-2)', background: 'var(--surface)' }}>
                    <span className="text-[9px] font-medium mr-0.5" style={{ color: 'var(--muted)' }}>Logo</span>
                    {[
                      { align: 'left', icon: <AlignLeft size={10} /> },
                      { align: 'center', icon: <AlignCenter size={10} /> },
                      { align: 'right', icon: <AlignRight size={10} /> },
                    ].map(({ align, icon }) => (
                      <button key={align}
                        onClick={() => onUpdate({ ...entity, logoAlign: align })}
                        className="flex items-center justify-center w-5 h-5 rounded transition-all"
                        style={{
                          background: (entity.logoAlign || 'left') === align ? 'var(--btn-primary)' : 'transparent',
                          color: (entity.logoAlign || 'left') === align ? 'var(--btn-primary-text)' : 'var(--ink-2)',
                          border: 'none', cursor: 'pointer',
                        }}>
                        {icon}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-[10px] px-1" style={{ color: 'var(--muted)' }}>
                  <Edit3 size={10} />
                  Klik op <strong style={{ color: 'var(--ink-2)' }}>opmerkingen</strong> of <strong style={{ color: 'var(--ink-2)' }}>voettekst</strong>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSaveEdits}
                  className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-md"
                  style={{ background: 'var(--btn-primary)', color: 'var(--btn-primary-text)', border: 'none', cursor: 'pointer' }}
                >
                  <Save size={10} /> Opslaan
                </button>
                <button
                  onClick={() => setDocEditMode(false)}
                  className="flex items-center justify-center text-[10px] w-6 h-6 rounded-md border"
                  style={{ color: 'var(--ink-2)', borderColor: 'var(--border-2)', background: 'transparent', cursor: 'pointer' }}
                >
                  <X size={10} />
                </button>
              </div>
            </div>
            <div style={{ maxHeight: 640, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border)', background: '#fff' }}>
              <InvoiceEditContext.Provider value={{ editMode: true, editValues, onEdit: handleEdit }}>
                {renderTemplate(entity.templateId, { invoice: { ...sampleInvoice, notes: editValues.notes ?? sampleInvoice.notes }, entity, client: sampleClient, totals })}
              </InvoiceEditContext.Provider>
            </div>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden border shadow-sm" style={{ borderColor: 'var(--border)' }}>
            <div style={{ transform: 'scale(0.65)', transformOrigin: 'top left', width: '154%', marginBottom: '-35%', background: '#fff' }}>
              <div id="invoice-template-preview">
                {renderTemplate(entity.templateId, { invoice: sampleInvoice, entity, client: sampleClient, totals })}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

const TemplateThumb = ({ templateId, accent = '#7C2D2D' }) => {
  // Tiny preview SVGs
  const styles = {
    classic: (
      <svg viewBox="0 0 120 160" className="w-full h-full bg-white">
        <rect x="10" y="10" width="40" height="6" fill="#1A1612" />
        <rect x="10" y="20" width="35" height="3" fill="#8B8276" />
        <rect x="10" y="26" width="30" height="3" fill="#8B8276" />
        <rect x="85" y="12" width="25" height="5" fill={accent} />
        <rect x="85" y="22" width="20" height="3" fill="#8B8276" />
        <line x1="10" y1="40" x2="110" y2="40" stroke="#E5DFD3" strokeWidth="0.5" />
        <rect x="10" y="48" width="30" height="3" fill="#1A1612" />
        <rect x="10" y="54" width="25" height="2" fill="#8B8276" />
        <line x1="10" y1="70" x2="110" y2="70" stroke="#1A1612" strokeWidth="1" />
        <rect x="10" y="78" width="50" height="2" fill="#8B8276" />
        <rect x="10" y="86" width="60" height="2" fill="#8B8276" />
        <rect x="10" y="94" width="45" height="2" fill="#8B8276" />
        <line x1="60" y1="120" x2="110" y2="120" stroke="#1A1612" strokeWidth="1" />
        <rect x="80" y="126" width="30" height="4" fill={accent} />
      </svg>
    ),
    modern: (
      <svg viewBox="0 0 120 160" className="w-full h-full bg-white">
        <rect x="0" y="0" width="120" height="35" fill={accent} />
        <circle cx="15" cy="17" r="5" fill="white" />
        <rect x="25" y="14" width="30" height="3" fill="white" />
        <rect x="25" y="19" width="20" height="2" fill="white" opacity="0.7" />
        <rect x="90" y="14" width="20" height="2" fill="white" opacity="0.7" />
        <rect x="85" y="20" width="25" height="5" fill="white" />
        <rect x="10" y="50" width="30" height="3" fill="#1A1612" />
        <rect x="10" y="58" width="25" height="2" fill="#8B8276" />
        <line x1="10" y1="75" x2="110" y2="75" stroke="#E5DFD3" strokeWidth="0.5" />
        <rect x="10" y="82" width="50" height="2" fill="#8B8276" />
        <rect x="10" y="90" width="60" height="2" fill="#8B8276" />
        <rect x="10" y="98" width="45" height="2" fill="#8B8276" />
        <rect x="80" y="126" width="30" height="4" fill={accent} />
      </svg>
    ),
    minimal: (
      <svg viewBox="0 0 120 160" className="w-full h-full bg-white">
        <rect x="55" y="15" width="10" height="3" fill="#1A1612" />
        <rect x="40" y="25" width="40" height="6" fill="#1A1612" />
        <rect x="50" y="35" width="20" height="2" fill="#8B8276" />
        <line x1="20" y1="45" x2="100" y2="45" stroke="#E5DFD3" strokeWidth="0.5" />
        <rect x="20" y="55" width="20" height="2" fill="#8B8276" />
        <rect x="50" y="55" width="20" height="2" fill="#8B8276" />
        <rect x="80" y="55" width="20" height="2" fill="#8B8276" />
        <rect x="20" y="60" width="15" height="2" fill="#1A1612" />
        <rect x="50" y="60" width="15" height="2" fill="#1A1612" />
        <rect x="80" y="60" width="15" height="2" fill="#1A1612" />
        <line x1="20" y1="85" x2="100" y2="85" stroke="#D4CCB8" strokeWidth="0.5" />
        <rect x="20" y="92" width="60" height="2" fill="#8B8276" />
        <rect x="20" y="100" width="50" height="2" fill="#8B8276" />
        <line x1="60" y1="125" x2="100" y2="125" stroke="#1A1612" strokeWidth="0.5" />
        <rect x="75" y="130" width="25" height="3" fill={accent} />
      </svg>
    ),
    statement: (
      <svg viewBox="0 0 120 160" className="w-full h-full bg-white">
        <rect x="0" y="0" width="18" height="160" fill={accent} />
        <rect x="5" y="10" width="8" height="8" fill="white" />
        <rect x="25" y="15" width="40" height="6" fill={accent} />
        <rect x="25" y="25" width="25" height="3" fill="#1A1612" />
        <rect x="25" y="32" width="35" height="2" fill="#8B8276" />
        <line x1="25" y1="48" x2="110" y2="48" stroke="#E5DFD3" strokeWidth="0.5" />
        <rect x="25" y="56" width="50" height="2" fill="#8B8276" />
        <rect x="25" y="64" width="60" height="2" fill="#8B8276" />
        <rect x="25" y="72" width="45" height="2" fill="#8B8276" />
        <line x1="60" y1="100" x2="110" y2="100" stroke="#1A1612" strokeWidth="1" />
        <rect x="80" y="106" width="30" height="4" fill={accent} />
      </svg>
    ),
    nordic: (
      <svg viewBox="0 0 120 160" className="w-full h-full bg-white">
        {/* Nomad: right accent stripe */}
        <rect x="117" y="0" width="3" height="160" fill={accent} />
        <rect x="10" y="14" width="44" height="5" fill="#1a1a1a" rx="1" />
        <rect x="10" y="22" width="30" height="2" fill="#ccc" rx="0.5" />
        <rect x="80" y="14" width="28" height="4" fill={accent} rx="0.5" />
        <line x1="10" y1="34" x2="108" y2="34" stroke="#ebebeb" strokeWidth="0.75" />
        <rect x="10" y="39" width="98" height="26" fill="#fafaf8" rx="4" />
        <rect x="15" y="44" width="18" height="2" fill="#ccc" rx="0.5" />
        <rect x="15" y="48" width="22" height="2.5" fill="#555" rx="0.5" />
        <rect x="15" y="52" width="16" height="2" fill="#aaa" rx="0.5" />
        <rect x="44" y="44" width="16" height="2" fill="#ccc" rx="0.5" />
        <rect x="44" y="48" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="44" y="52" width="20" height="2" fill="#aaa" rx="0.5" />
        <rect x="76" y="44" width="14" height="2" fill="#ccc" rx="0.5" />
        <rect x="76" y="48" width="26" height="5" fill={accent} rx="0.5" />
        <line x1="10" y1="74" x2="108" y2="74" stroke="#ebebeb" strokeWidth="0.75" />
        <rect x="10" y="80" width="52" height="2" fill="#ccc" rx="0.5" />
        <rect x="88" y="80" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="10" y="87" width="46" height="2" fill="#ccc" rx="0.5" />
        <rect x="88" y="87" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="10" y="94" width="50" height="2" fill="#ccc" rx="0.5" />
        <rect x="88" y="94" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="72" y="108" width="36" height="4" fill={accent} rx="0.5" />
      </svg>
    ),
    bold: (
      <svg viewBox="0 0 120 160" className="w-full h-full bg-white">
        {/* Canvas: masthead with thick underline */}
        <rect x="10" y="12" width="55" height="7" fill="#1a1a1a" rx="1" />
        <rect x="80" y="14" width="30" height="5" fill={accent} rx="0.5" />
        <rect x="10" y="22" width="100" height="3" fill={accent} rx="0.5" />
        <rect x="10" y="28" width="60" height="2" fill="#ccc" rx="0.5" />
        <rect x="10" y="40" width="46" height="2" fill="#ccc" rx="0.5" />
        <rect x="10" y="46" width="30" height="2.5" fill="#555" rx="0.5" />
        <rect x="10" y="50" width="24" height="2" fill="#aaa" rx="0.5" />
        <rect x="62" y="38" width="46" height="22" fill="#f6f5f2" rx="3" />
        <rect x="66" y="43" width="20" height="2" fill="#ccc" rx="0.5" />
        <rect x="66" y="48" width="28" height="2" fill="#555" rx="0.5" />
        <rect x="66" y="53" width="22" height="2" fill="#aaa" rx="0.5" />
        <rect x="66" y="56" width="30" height="3" fill={accent} rx="0.5" />
        <line x1="10" y1="72" x2="110" y2="72" stroke="#ebebeb" strokeWidth="0.75" />
        <rect x="10" y="79" width="52" height="2" fill="#ccc" rx="0.5" />
        <rect x="88" y="79" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="10" y="86" width="46" height="2" fill="#ccc" rx="0.5" />
        <rect x="88" y="86" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="72" y="104" width="36" height="4" fill={accent} rx="0.5" />
      </svg>
    ),
    horizon: (
      <svg viewBox="0 0 120 160" className="w-full h-full bg-white">
        {/* Dusk: split header — left white, right accent */}
        <rect x="0" y="0" width="60" height="44" fill="white" />
        <rect x="60" y="0" width="60" height="44" fill={accent} />
        <rect x="8" y="10" width="36" height="5" fill="#1a1a1a" rx="1" />
        <rect x="8" y="18" width="26" height="2" fill="#ccc" rx="0.5" />
        <rect x="8" y="22" width="20" height="2" fill="#ccc" rx="0.5" />
        <rect x="66" y="9" width="22" height="4" fill="white" rx="0.5" />
        <rect x="66" y="16" width="26" height="2.5" fill="rgba(255,255,255,0.7)" rx="0.5" />
        <rect x="66" y="21" width="18" height="2" fill="rgba(255,255,255,0.5)" rx="0.5" />
        <rect x="66" y="26" width="22" height="2" fill="rgba(255,255,255,0.5)" rx="0.5" />
        <line x1="10" y1="55" x2="110" y2="55" stroke="#ebebeb" strokeWidth="0.75" />
        <rect x="10" y="49" width="30" height="3" fill="#555" rx="0.5" />
        <rect x="80" y="47" width="28" height="6" fill={accent} rx="0.5" />
        <rect x="10" y="65" width="52" height="2" fill="#ccc" rx="0.5" />
        <rect x="88" y="65" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="10" y="72" width="46" height="2" fill="#ccc" rx="0.5" />
        <rect x="88" y="72" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="10" y="79" width="50" height="2" fill="#ccc" rx="0.5" />
        <rect x="88" y="79" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="72" y="98" width="36" height="4" fill={accent} rx="0.5" />
      </svg>
    ),
    split: (
      <svg viewBox="0 0 120 160" className="w-full h-full bg-white">
        {/* Folio: warm left panel, accent left border, white right */}
        <rect x="0" y="0" width="34" height="160" fill="#F7F4EF" />
        <rect x="0" y="0" width="3" height="160" fill={accent} />
        <rect x="6" y="12" width="22" height="4" fill={accent} rx="0.5" opacity="0.85" />
        <rect x="6" y="19" width="16" height="2" fill="#ccc" rx="0.5" />
        <rect x="6" y="23" width="18" height="2" fill="#ccc" rx="0.5" />
        <rect x="6" y="50" width="14" height="2" fill="#c5b9a8" rx="0.5" />
        <rect x="6" y="55" width="22" height="2.5" fill="#666" rx="0.5" />
        <rect x="6" y="59" width="18" height="2" fill="#aaa" rx="0.5" />
        <rect x="6" y="80" width="14" height="2" fill="#c5b9a8" rx="0.5" />
        <rect x="6" y="85" width="20" height="2" fill="#888" rx="0.5" />
        <rect x="6" y="89" width="16" height="2" fill="#aaa" rx="0.5" />
        <rect x="6" y="93" width="18" height="2" fill="#aaa" rx="0.5" />
        <line x1="6" y1="130" x2="30" y2="130" stroke="#e4ddd3" strokeWidth="0.75" />
        <rect x="6" y="134" width="22" height="4" fill={accent} rx="0.5" />
        {/* Right panel */}
        <circle cx="44" cy="20" r="5" fill={accent} />
        <rect x="53" y="18" width="28" height="2" fill="#bbb" rx="0.5" />
        <line x1="38" y1="32" x2="112" y2="32" stroke="#ebebeb" strokeWidth="0.75" />
        <rect x="38" y="40" width="52" height="2" fill="#ccc" rx="0.5" />
        <rect x="92" y="40" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="38" y="48" width="46" height="2" fill="#ccc" rx="0.5" />
        <rect x="92" y="48" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="38" y="56" width="50" height="2" fill="#ccc" rx="0.5" />
        <rect x="92" y="56" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="76" y="74" width="36" height="4" fill={accent} rx="0.5" />
      </svg>
    ),
    bloom: (
      <svg viewBox="0 0 120 160" className="w-full h-full bg-white">
        {/* Bloom: thin top bar, centered header, diamond separator */}
        <rect x="0" y="0" width="120" height="3" fill={accent} />
        {/* Bedrijfsnaam gecentreerd */}
        <rect x="30" y="14" width="60" height="6" fill="#2c2319" rx="1" />
        <rect x="42" y="23" width="36" height="2" fill="#ddd" rx="0.5" />
        {/* Horizontale scheidingslijn */}
        <line x1="10" y1="32" x2="110" y2="32" stroke="#f0ece8" strokeWidth="0.75" />
        {/* Diamond ✦ */}
        <polygon points="60,38 62.5,41 60,44 57.5,41" fill={accent} opacity="0.7" />
        {/* Klant links, details rechts */}
        <rect x="10" y="50" width="14" height="2" fill={accent} opacity="0.7" rx="0.5" />
        <rect x="10" y="55" width="28" height="2" fill="#555" rx="0.5" />
        <rect x="10" y="59" width="22" height="2" fill="#aaa" rx="0.5" />
        <rect x="10" y="63" width="20" height="2" fill="#aaa" rx="0.5" />
        <rect x="78" y="50" width="14" height="2" fill={accent} opacity="0.7" rx="0.5" />
        <rect x="78" y="55" width="30" height="2" fill="#aaa" rx="0.5" />
        <rect x="78" y="59" width="26" height="2" fill="#aaa" rx="0.5" />
        {/* Line items */}
        <line x1="10" y1="76" x2="110" y2="76" stroke="#f0ece8" strokeWidth="0.5" />
        <rect x="10" y="82" width="50" height="2" fill="#ccc" rx="0.5" />
        <rect x="88" y="82" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="10" y="89" width="44" height="2" fill="#ccc" rx="0.5" />
        <rect x="88" y="89" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="10" y="96" width="48" height="2" fill="#ccc" rx="0.5" />
        <rect x="88" y="96" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="72" y="111" width="36" height="4" fill={accent} rx="0.5" />
        {/* Decoratief dankwoord */}
        <line x1="20" y1="124" x2="50" y2="124" stroke="#ddd" strokeWidth="0.5" />
        <polygon points="60,122 61.5,124 60,126 58.5,124" fill={accent} opacity="0.5" />
        <line x1="70" y1="124" x2="100" y2="124" stroke="#ddd" strokeWidth="0.5" />
        <rect x="28" y="128" width="64" height="2" fill="#ccc" rx="0.5" opacity="0.7" />
      </svg>
    ),
    velvet: (
      <svg viewBox="0 0 120 160" className="w-full h-full" style={{ background: '#FDFAF7' }}>
        {/* Velvet: donkere full-bleed header */}
        <rect x="0" y="0" width="120" height="44" fill={accent} />
        {/* Bedrijfsnaam links in header */}
        <rect x="8" y="10" width="44" height="6" fill="white" rx="1" />
        <rect x="8" y="19" width="30" height="2" fill="rgba(255,255,255,0.45)" rx="0.5" />
        <rect x="8" y="23" width="22" height="2" fill="rgba(255,255,255,0.45)" rx="0.5" />
        {/* Factuurnummer rechts in header */}
        <rect x="82" y="9" width="28" height="4.5" fill="white" rx="0.5" />
        <rect x="88" y="16" width="22" height="2" fill="rgba(255,255,255,0.6)" rx="0.5" />
        <rect x="88" y="20" width="18" height="2" fill="rgba(255,255,255,0.6)" rx="0.5" />
        {/* Subtiele accentlijn onder header */}
        <rect x="0" y="44" width="120" height="1.5" fill={accent} opacity="0.35" />
        {/* Klantblok in wit kader */}
        <rect x="10" y="52" width="52" height="26" fill="white" rx="3" />
        <rect x="15" y="57" width="12" height="2" fill={accent} opacity="0.7" rx="0.5" />
        <rect x="15" y="61" width="36" height="2" fill="#555" rx="0.5" />
        <rect x="15" y="65" width="28" height="2" fill="#aaa" rx="0.5" />
        <rect x="15" y="69" width="24" height="2" fill="#aaa" rx="0.5" />
        {/* Line items */}
        <line x1="10" y1="88" x2="110" y2="88" stroke="#ebebeb" strokeWidth="0.75" />
        <rect x="10" y="94" width="52" height="2" fill="#ccc" rx="0.5" />
        <rect x="88" y="94" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="10" y="101" width="46" height="2" fill="#ccc" rx="0.5" />
        <rect x="88" y="101" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="10" y="108" width="50" height="2" fill="#ccc" rx="0.5" />
        <rect x="88" y="108" width="20" height="2" fill="#555" rx="0.5" />
        <rect x="72" y="122" width="36" height="4" fill={accent} rx="0.5" />
        {/* Dankwoord box */}
        <rect x="10" y="133" width="100" height="14" fill="#FDF8F4" rx="3" />
        <rect x="12" y="133" width="100" height="14" fill="none" stroke="#EAD9C8" strokeWidth="0.75" rx="3" />
        <rect x="26" y="138" width="68" height="2" fill="#c5b5a8" rx="0.5" opacity="0.8" />
        <rect x="34" y="142" width="52" height="2" fill="#c5b5a8" rx="0.5" opacity="0.6" />
      </svg>
    ),
  };
  return styles[templateId] || styles.classic;
};

// ============================================================================
// ENTITIES VIEW (Bedrijven beheer + tree visualisatie)
// ============================================================================
const EntitiesView = ({ entities, setEntities, activeEntityId, setActiveEntityId, invoices, expenses }) => {
  const [editing, setEditing] = useState(null);

  // Zelfde rekenregels als Winst & verlies: omzet en kosten excl. BTW, lopend jaar,
  // alle verstuurde facturen (factuurstelsel) i.p.v. alleen betaalde incl. BTW.
  const statsYear = new Date().getFullYear();
  const stats = useMemo(() => {
    const byEntity = {};
    entities.forEach(e => {
      const inv = invoices.filter(i => i.entityId === e.id);
      const exp = expenses.filter(x => x.entityId === e.id);
      const pl = buildProfitLoss({ invoices: inv, expenses: exp, year: statsYear });
      byEntity[e.id] = { invoiceCount: inv.length, expenseCount: exp.length, revenue: pl.revenue, costs: pl.costs };
    });
    return byEntity;
  }, [entities, invoices, expenses, statsYear]);

  const handleSave = (entity) => {
    if (entity.id && entities.find(e => e.id === entity.id)) {
      setEntities(prev => prev.map(e => e.id === entity.id ? entity : e));
    } else {
      const newEnt = { ...entity, id: generateId('ent'), createdAt: new Date().toISOString() };
      setEntities(prev => [...prev, newEnt]);
    }
    setEditing(null);
  };

  const handleDelete = (id) => {
    if (entities.length <= 1) { alert('Je moet minstens 1 bedrijf hebben.'); return; }
    const ent = entities.find(e => e.id === id);
    const invCount = invoices.filter(i => i.entityId === id).length;
    const expCount = expenses.filter(e => e.entityId === id).length;
    const childCount = entities.filter(e => e.parentId === id).length;
    // Blokkeren i.p.v. waarschuwen: facturen/bonnen van een verwijderd bedrijf worden door
    // geen enkel scherm meer getoond (ze zijn op entityId gefilterd) en tellen dan stil niet meer mee.
    if (invCount + expCount > 0) {
      alert(`"${ent?.name || 'Dit bedrijf'}" kan niet worden verwijderd: er hangen nog ${invCount} factu${invCount === 1 ? 'ur' : 'ren'} en ${expCount} kostenpost${expCount === 1 ? '' : 'en'} aan.\n\nDie zouden anders uit alle overzichten (dashboard, BTW-aangifte, boekhouding) verdwijnen. Verplaats of verwijder ze eerst; alleen een leeg bedrijf kan worden verwijderd.`);
      return;
    }
    if (childCount > 0) {
      alert(`"${ent?.name || 'Dit bedrijf'}" heeft nog ${childCount} onderliggend${childCount === 1 ? ' bedrijf of label' : 'e bedrijven/labels'}. Koppel die eerst aan een ander bedrijf.`);
      return;
    }
    if (!window.confirm(`"${ent?.name || 'Dit bedrijf'}" verwijderen? Er zijn geen facturen of kostenposten aan gekoppeld.`)) return;
    setEntities(prev => prev.filter(e => e.id !== id));
    if (id === activeEntityId) setActiveEntityId(entities.find(e => e.id !== id)?.id);
  };

  // Build tree structure
  const rootEntities = entities.filter(e => !e.parentId);
  const childrenOf = (parentId) => entities.filter(e => e.parentId === parentId);

  const renderEntityNode = (entity, depth = 0) => {
    const children = childrenOf(entity.id);
    const typ = getEntityType(entity.type);
    const jur = JURISDICTIONS[entity.jurisdiction || 'NL'];
    const s = stats[entity.id] || { invoiceCount: 0, expenseCount: 0, revenue: 0, costs: 0 };
    const isActive = entity.id === activeEntityId;

    return (
      <div key={entity.id} className="relative">
        {depth > 0 && (
          <div className="absolute left-0 top-0 w-6 h-6 border-l-2 border-b-2" style={{ borderColor: 'var(--border-strong)', borderBottomLeftRadius: 8 }} />
        )}
        <div className="flex items-stretch gap-3 mb-3" style={{ marginLeft: depth > 0 ? 24 : 0 }}>
          <Card className={`flex-1 p-4 transition-all`} style={{ borderColor: isActive ? 'var(--accent)' : 'var(--border)', borderWidth: isActive ? 2 : 1 }}>
            <div className="flex items-start gap-3">
              <div className="text-2xl">{typ.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display text-lg font-medium" style={{ color: 'var(--ink)' }}>{entity.name}</h3>
                  {isActive && <Badge status="processed">Actief</Badge>}
                  <span className="text-[11px] px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                    {typ.label}
                  </span>
                </div>
                <div className="text-xs mt-1 flex items-center gap-3 flex-wrap" style={{ color: 'var(--muted)' }}>
                  <span>{jur.flag} {jur.name}</span>
                  {entity.registrationNumber && <span className="font-mono">{jur.code === 'NL' ? 'KvK' : 'RNC'}: {entity.registrationNumber}</span>}
                  {entity.taxNumber && <span className="font-mono">{jur.code === 'NL' ? 'BTW' : 'Tax'}: {entity.taxNumber}</span>}
                </div>
                <div className="text-xs mt-2 flex gap-4 flex-wrap">
                  <span><span style={{ color: 'var(--muted)' }}>Omzet {statsYear} excl. BTW: </span><Money value={s.revenue} currency={jur.baseCurrency} className="font-medium" /></span>
                  <span><span style={{ color: 'var(--muted)' }}>Kosten excl. BTW: </span><Money value={s.costs} currency={jur.baseCurrency} className="font-medium" /></span>
                  <span><span style={{ color: 'var(--muted)' }}>Facturen: </span><span className="num font-medium">{s.invoiceCount}</span></span>
                  <span><span style={{ color: 'var(--muted)' }}>Kostenposten: </span><span className="num font-medium">{s.expenseCount}</span></span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {!isActive && (
                  <button onClick={() => setActiveEntityId(entity.id)} className="text-[10px] font-medium px-2 py-1 rounded hover:bg-[color:var(--surface-2)]" style={{ color: 'var(--accent)' }}>
                    Activeer
                  </button>
                )}
                <button onClick={() => setEditing(entity)} className="p-1.5 rounded hover:bg-[color:var(--surface-2)]">
                  <Edit3 size={13} style={{ color: 'var(--muted)' }} />
                </button>
                {entities.length > 1 && (
                  <button onClick={() => handleDelete(entity.id)} className="p-1.5 rounded hover:bg-[color:var(--danger-soft)]" title={s.invoiceCount + s.expenseCount > 0 ? 'Alleen lege bedrijven kunnen worden verwijderd' : 'Verwijderen'}>
                    <Trash2 size={13} style={{ color: 'var(--danger)' }} />
                  </button>
                )}
              </div>
            </div>
          </Card>
        </div>
        {children.length > 0 && (
          <div className="ml-3 border-l-2 pl-3" style={{ borderColor: 'var(--border-strong)' }}>
            {children.map(c => renderEntityNode(c, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bedrijven"
        sub={`${entities.length} bedrijf${entities.length !== 1 ? 'sentiteiten' : ''} · Structuur + gegevens`}
        actions={<Button onClick={() => setEditing({})}><Plus size={16} /> Nieuw bedrijf</Button>}
      />

      <Card className="p-5" style={{ background: 'var(--surface-2)' }}>
        <div className="flex items-start gap-3">
          <Network size={20} style={{ color: 'var(--accent)' }} />
          <div className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
            <strong>Structuur tip:</strong> Heb je een holding-structuur? Maak eerst de holding aan, daarna de werkmaatschappij(en) met de holding als parent. Heb je sub-brands zoals "DHS Leads"? Voeg ze toe als <em>Label / Handelsnaam</em> — ze erven KVK/BTW/IBAN van het parent bedrijf, maar verschijnen met eigen naam en logo op facturen.
          </div>
        </div>
      </Card>

      <div className="space-y-2">
        {rootEntities.map(e => renderEntityNode(e, 0))}
        {rootEntities.length === 0 && (
          <Card>
            <EmptyState
              icon={Building2}
              title="Nog geen bedrijven"
              description="Voeg je eerste bedrijf toe om te beginnen."
              action={<Button onClick={() => setEditing({})}><Plus size={14} /> Bedrijf toevoegen</Button>}
            />
          </Card>
        )}
      </div>

      {editing !== null && (
        <EntityForm
          entity={editing}
          entities={entities}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
};

const EntityForm = ({ entity, entities, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: '', legalName: '', type: 'operating', parentId: null,
    jurisdiction: 'NL', registrationNumber: '', taxNumber: '',
    address: '', postal: '', city: '', country: '',
    iban: '', bicCode: '', email: '', phone: '', website: '',
    logo: null, accentColor: '#7C2D2D', templateId: 'classic',
    invoicePrefix: new Date().getFullYear() + '-', nextInvoiceNumber: 1,
    paymentTerms: 14, footerText: 'Betaling binnen 14 dagen na factuurdatum.',
    ...entity,
  });

  const update = (key, val) => setForm({ ...form, [key]: val });
  const jur = JURISDICTIONS[form.jurisdiction || 'NL'];
  const possibleParents = entities.filter(e => e.id !== form.id);

  return (
    <Modal open onClose={onClose} size="lg">
      <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-display text-2xl">{form.id ? 'Bedrijf bewerken' : 'Nieuw bedrijf'}</h2>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-[color:var(--surface-2)]"><X size={16} /></button>
      </div>
      <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto scrollable">
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--ink-2)' }}>Type bedrijf</label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {ENTITY_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => update('type', t.id)}
                className="p-3 rounded-lg border-2 text-left transition-all"
                style={{ borderColor: form.type === t.id ? 'var(--ink)' : 'var(--border)', background: form.type === t.id ? 'var(--surface-2)' : 'transparent' }}
              >
                <div className="text-xl mb-1">{t.icon}</div>
                <div className="text-xs font-medium">{t.label}</div>
              </button>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
            {getEntityType(form.type).description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Bedrijfsnaam *" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Bijv. Den Hartogh Solutions" />
          <Input label="Juridische naam" value={form.legalName} onChange={e => update('legalName', e.target.value)} hint="Bijv. 'B.V.' of 'S.R.L.'" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select label="Jurisdictie" value={form.jurisdiction} onChange={e => update('jurisdiction', e.target.value)}>
            {Object.values(JURISDICTIONS).map(j => <option key={j.code} value={j.code}>{j.flag} {j.name}</option>)}
          </Select>
          <Select label="Bovenliggend bedrijf (parent)" value={form.parentId || ''} onChange={e => update('parentId', e.target.value || null)}>
            <option value="">— Geen parent (top-level) —</option>
            {possibleParents.map(p => <option key={p.id} value={p.id}>{getEntityType(p.type).icon} {p.name}</option>)}
          </Select>
        </div>

        {form.type === 'label' ? (
          <div className="rounded-md p-3 text-xs flex items-start gap-2" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Sparkles size={14} className="mt-0.5 shrink-0" />
            <div>
              <strong>Label / Handelsnaam:</strong> KVK, BTW en IBAN worden automatisch overgenomen van het parent bedrijf en verschijnen correct op facturen. Op de factuur staat "<em>{form.name || 'dit label'} is een handelsnaam van [parent]</em>".
              {!form.parentId && <span className="block mt-1 font-semibold" style={{ color: 'var(--warning)' }}>Selecteer hierboven een parent bedrijf.</span>}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={jur.code === 'NL' ? 'KvK-nummer' : 'RNC (Registro Nacional)'}
              value={form.registrationNumber}
              onChange={e => update('registrationNumber', e.target.value)}
              placeholder={jur.code === 'NL' ? '12345678' : '1-31-12345-6'}
            />
            <Input
              label={jur.code === 'NL' ? 'BTW-nummer' : 'NCF autorisatie'}
              value={form.taxNumber}
              onChange={e => update('taxNumber', e.target.value)}
              placeholder={jur.code === 'NL' ? 'NL123456789B01' : 'B0100000001'}
            />
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--ink)' }}>Adres</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input className="md:col-span-2" label="Straat + nummer" value={form.address} onChange={e => update('address', e.target.value)} />
            <Input label="Postcode" value={form.postal} onChange={e => update('postal', e.target.value)} />
            <Input className="md:col-span-2" label="Plaats" value={form.city} onChange={e => update('city', e.target.value)} />
            <Input label="Land" value={form.country} onChange={e => update('country', e.target.value)} />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--ink)' }}>Contact</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Email" value={form.email} onChange={e => update('email', e.target.value)} />
            <Input label="Telefoon" value={form.phone} onChange={e => update('phone', e.target.value)} />
            <Input label="Website" value={form.website} onChange={e => update('website', e.target.value)} />
          </div>
        </div>

        {form.type !== 'label' && (
          <div>
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--ink)' }}>Bank</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Input label="IBAN" value={form.iban} onChange={e => update('iban', e.target.value)} />
                {form.iban && !/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,30}$/.test(form.iban.replace(/\s/g, '').toUpperCase()) && (
                  <p className="text-xs mt-1" style={{ color: 'var(--warning)' }}>⚠ Ongeldig IBAN-formaat (verwacht: NL02ABNA0123456789)</p>
                )}
              </div>
              <Input label="BIC" value={form.bicCode} onChange={e => update('bicCode', e.target.value)} />
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--ink)' }}>Facturatie</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Factuurnummer prefix" value={form.invoicePrefix} onChange={e => update('invoicePrefix', e.target.value)} hint="Bijv. '2026-' of 'INV-'" />
            <Input label="Volgend nummer" type="number" value={form.nextInvoiceNumber} onChange={e => update('nextInvoiceNumber', Number(e.target.value))} />
            <label className="flex items-center gap-2 text-sm col-span-2 cursor-pointer">
              <input type="checkbox" checked={!!form.yearlyReset} onChange={e => update('yearlyReset', e.target.checked)} className="w-4 h-4" />
              <span>Factuurnummer jaarlijks resetten (bijv. 2027-0001 bij nieuw jaar)</span>
            </label>
            <Input label="Betaaltermijn (dagen)" type="number" value={form.paymentTerms} onChange={e => update('paymentTerms', Number(e.target.value))} />
            <Input label="Accentkleur" type="color" value={form.accentColor} onChange={e => update('accentColor', e.target.value)} />
          </div>
          <Textarea className="mt-3" label="Footer-tekst op factuur" rows={2} value={form.footerText} onChange={e => update('footerText', e.target.value)} />
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--ink)' }}>Logo</h3>
          {form.logo && (
            <div className="mb-3 flex items-center gap-3">
              <img src={form.logo} alt="logo" className="h-14 object-contain p-2 rounded border" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }} />
              <Button size="sm" variant="secondary" onClick={() => update('logo', null)}><X size={12} /> Verwijderen</Button>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) update('logo', await resizeImage(file, 600, 0.9));
            }}
            className="text-sm"
          />
          {form.logo && (
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Logo grootte — {form.logoScale || 100}%</label>
                <input type="range" min={30} max={200} step={5}
                  value={form.logoScale || 100}
                  onChange={e => update('logoScale', Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)' }}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>Logo uitlijning</label>
                <Segmented
                  options={[{ id: 'left', label: 'Links' }, { id: 'center', label: 'Midden' }, { id: 'right', label: 'Rechts' }]}
                  value={form.logoAlign || 'left'}
                  onChange={a => update('logoAlign', a)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="px-6 py-4 border-t flex justify-end gap-2" style={{ borderColor: 'var(--border)' }}>
        <Button variant="secondary" onClick={onClose}>Annuleren</Button>
        <Button onClick={() => form.name && onSave(form)} disabled={!form.name}>
          <Save size={14} /> Opslaan
        </Button>
      </div>
    </Modal>
  );
};

// ============================================================================
// TAX REPORT VIEW (BTW kwartaal NL / ITBIS mensual DR)
// ============================================================================
const TaxReportView = ({ invoices, expenses, setExpenses, clients, settings, activeEntity }) => {
  const jurisdiction = activeEntity?.jurisdiction || settings.jurisdiction || 'NL';
  const jur = JURISDICTIONS[jurisdiction];
  const baseCurr = jur.baseCurrency;
  const ledgerAccounts = getLedgerAccounts(jurisdiction);
  const now = new Date();
  const currentYear = now.getFullYear();

  // Period: quarter for NL, month for DR
  const [year, setYear] = useState(currentYear);
  const [period, setPeriod] = useState(() => {
    if (jur.filingPeriod === 'quarterly') return Math.floor(now.getMonth() / 3); // 0-3
    return now.getMonth(); // 0-11
  });

  const periodRange = useMemo(() => {
    if (jur.filingPeriod === 'quarterly') {
      const startMonth = period * 3;
      return { start: new Date(year, startMonth, 1), end: new Date(year, startMonth + 3, 1), label: `Q${period + 1} ${year}` };
    }
    return { start: new Date(year, period, 1), end: new Date(year, period + 1, 1), label: new Date(year, period, 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' }) };
  }, [year, period, jur.filingPeriod]);

  const data = useMemo(() => {
    // Eén rekenkern (src/finance.js): factuurstelsel op factuurdatum, creditnota's negatief,
    // kosten per BTW-behandeling (NL BTW / verlegd 4a / verlegd 4b / geen BTW).
    const vat = buildVatReturn({ invoices, expenses, clients, start: periodRange.start, end: periodRange.end });
    const salesByRate = {};
    let salesTotal = 0;
    vat.salesRows.forEach(({ totals }) => {
      salesTotal += totals.subtotal;
      Object.entries(totals.netByRate).forEach(([rate, net]) => {
        if (!salesByRate[rate]) salesByRate[rate] = { net: 0, tax: 0 };
        salesByRate[rate].net += net;
        salesByRate[rate].tax += totals.btwByRate[rate] || 0;
      });
    });
    const salesTaxOnSales = vat.salesRows.reduce((s, r) => s + r.totals.btwTotal, 0);

    let purchasesTotal = 0;
    const byLedger = {};
    vat.purchaseRows.forEach(({ e, net, vat: tax }) => {
      purchasesTotal += net;
      const ledgerCode = e.ledgerAccount || 'overig';
      if (!byLedger[ledgerCode]) {
        const acct = ledgerAccounts.find(a => a.code === ledgerCode);
        byLedger[ledgerCode] = { code: ledgerCode, name: acct?.name || 'Niet ingedeeld', group: acct?.group || '—', net: 0, tax: 0, total: 0, count: 0 };
      }
      byLedger[ledgerCode].net += net;
      byLedger[ledgerCode].tax += tax;
      byLedger[ledgerCode].total += Number(e.amount || 0);
      byLedger[ledgerCode].count += 1;
    });

    return {
      vat,
      periodInvoices: vat.salesRows.map(r => r.inv),
      periodExpenses: vat.purchaseRows.map(r => r.e),
      salesByRate,
      salesTotal,
      salesTaxOnSales,
      purchasesTotal,
      // Voor NL: verschuldigd = 1a..1c + verlegde BTW (4a/4b); voorbelasting = 5b incl. verlegd
      owed: jur.code === 'NL' ? vat.owed : salesTaxOnSales,
      taxOnPurchases: vat.deductible,
      saldo: jur.code === 'NL' ? vat.saldo : salesTaxOnSales - vat.deductible,
      byLedger: Object.values(byLedger).sort((a, b) => b.total - a.total),
    };
  }, [invoices, expenses, clients, periodRange, ledgerAccounts, jur.code]);

  const setTreatment = (expenseId, treatment) => {
    if (!setExpenses) return;
    setExpenses(prev => prev.map(e => {
      if (e.id !== expenseId) return e;
      if (treatment === 'standard') {
        const rate = Number(e.btwRate) || jur.salesTax.standard;
        const amt = Number(e.amount || 0);
        return { ...e, vatTreatment: treatment, btwRate: rate, btwAmount: e.btwAmount > 0 ? e.btwAmount : +(amt - amt / (1 + rate / 100)).toFixed(2) };
      }
      return { ...e, vatTreatment: treatment, btwRate: 0, btwAmount: 0, vatEstimated: false };
    }));
  };

  const handleExportCSV = () => {
    const rows = [
      ['Type', 'Datum', 'Nummer', 'Naam', 'Grootboek', 'Netto', `${jur.salesTax.name}`, 'Totaal', 'Valuta origineel', 'Origineel bedrag'],
      ...data.periodInvoices.map(inv => {
        const t = computeInvoice(inv.items);
        const c = clients.find(c => c.id === inv.clientId);
        return ['Verkoop', inv.issueDate, inv.number, c?.name || '', '8000', t.subtotal.toFixed(2), t.btwTotal.toFixed(2), t.total.toFixed(2), baseCurr, t.total.toFixed(2)];
      }),
      ...data.periodExpenses.map(e => {
        const acct = ledgerAccounts.find(a => a.code === e.ledgerAccount);
        const vatT = expenseVatTreatment(e);
        const vatAmt = vatT === 'standard' ? Number(e.btwAmount || 0) : expenseReverseVat(e);
        return ['Inkoop' + (vatT.startsWith('reverse') ? ` (verlegd ${vatT === 'reverse_eu' ? '4b' : '4a'})` : vatT === 'none' ? ' (geen BTW)' : ''), e.date, '', e.vendor, e.ledgerAccount + ' ' + (acct?.name || ''), expenseNet(e).toFixed(2), vatAmt.toFixed(2), Number(e.amount).toFixed(2), e.originalCurrency || e.currency || baseCurr, Number(e.originalAmount || e.amount).toFixed(2)];
      }),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${jur.code}_${jur.salesTax.name}_${periodRange.label.replace(/ /g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Aangifte</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {activeEntity?.name && <><span style={{ color: 'var(--ink-2)' }} className="font-medium">{activeEntity.name}</span> · </>}
            {jur.flag} {jur.name} · {jur.salesTax.name}-{jur.filingPeriod === 'quarterly' ? 'kwartaal' : 'maand'}aangifte
          </p>
        </div>
        <Button onClick={handleExportCSV}>
          <Download size={14} /> Exporteer voor accountant
        </Button>
      </div>

      {/* Period selector */}
      <Card className="p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Periode</div>
          <div className="flex gap-1">
            {yearOptions.map(y => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className="px-3 py-1.5 text-sm rounded font-medium num"
                style={{
                  background: year === y ? 'var(--btn-primary)' : 'transparent',
                  color: year === y ? '#fff' : 'var(--ink-2)',
                }}
              >
                {y}
              </button>
            ))}
          </div>
          <div className="h-5 w-px" style={{ background: 'var(--border)' }} />
          <div className="flex gap-1 flex-wrap">
            {jur.filingPeriod === 'quarterly'
              ? [0, 1, 2, 3].map(q => (
                  <button
                    key={q}
                    onClick={() => setPeriod(q)}
                    className="px-3 py-1.5 text-sm rounded font-medium"
                    style={{
                      background: period === q ? 'var(--accent)' : 'transparent',
                      color: period === q ? '#fff' : 'var(--ink-2)',
                    }}
                  >
                    Q{q + 1}
                  </button>
                ))
              : Array.from({ length: 12 }).map((_, m) => (
                  <button
                    key={m}
                    onClick={() => setPeriod(m)}
                    className="px-2 py-1 text-xs rounded font-medium"
                    style={{
                      background: period === m ? 'var(--accent)' : 'transparent',
                      color: period === m ? '#fff' : 'var(--ink-2)',
                    }}
                  >
                    {new Date(2000, m, 1).toLocaleDateString('nl-NL', { month: 'short' })}
                  </button>
                ))}
          </div>
          <div className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>
            Indienen: <strong style={{ color: 'var(--accent)' }}>{jur.filingDeadlines[jur.filingPeriod === 'quarterly' ? period : 0]?.deadline || 'maandelijks'}</strong>
          </div>
        </div>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Omzet (netto)</div>
          <div className="font-display text-2xl mt-2 num">{fmtCurrency(data.salesTotal, baseCurr)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{data.periodInvoices.length} factu{data.periodInvoices.length === 1 ? 'ur' : 'ren'}</div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Kosten (netto)</div>
          <div className="font-display text-2xl mt-2 num">{fmtCurrency(data.purchasesTotal, baseCurr)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{data.periodExpenses.length} bonnen</div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>{jur.salesTax.name} verschuldigd</div>
          <div className="font-display text-2xl mt-2 num" style={{ color: 'var(--accent)' }}>{fmtCurrency(data.owed, baseCurr)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{jur.code === 'NL' && (data.vat.boxes['4a'].tax + data.vat.boxes['4b'].tax) > 0 ? `incl. ${fmtCurrency(data.vat.boxes['4a'].tax + data.vat.boxes['4b'].tax, baseCurr)} verlegd` : 'Over verkopen'}</div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Voorbelasting</div>
          <div className="font-display text-2xl mt-2 num" style={{ color: 'var(--success)' }}>{fmtCurrency(data.taxOnPurchases, baseCurr)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Terug te vorderen</div>
        </Card>
      </div>

      {/* Saldo banner */}
      <Card className="p-6" style={{ background: data.saldo >= 0 ? 'var(--accent-soft)' : 'var(--success-soft)', borderColor: data.saldo >= 0 ? '#E5C7C2' : '#C5DBC8' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-medium" style={{ color: data.saldo >= 0 ? 'var(--accent)' : 'var(--success)' }}>
              Saldo {jur.salesTax.name} {periodRange.label}
            </div>
            <div className="font-display text-4xl mt-1 num font-medium" style={{ color: data.saldo >= 0 ? 'var(--accent)' : 'var(--success)' }}>
              {fmtCurrency(Math.abs(data.saldo), baseCurr)}
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--ink-2)' }}>
              {data.saldo >= 0 ? 'Af te dragen aan belastingdienst' : 'Terug te vorderen van belastingdienst'}
            </div>
          </div>
          <div className="text-right text-xs space-y-1" style={{ color: 'var(--ink-2)' }}>
            <div>Verschuldigd: <span className="num font-medium">{fmtCurrency(data.owed, baseCurr)}</span></div>
            <div>Voorbelasting: <span className="num font-medium">−{fmtCurrency(data.taxOnPurchases, baseCurr)}</span></div>
            <div className="pt-1 border-t" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
              <strong className="num">= {fmtCurrency(data.saldo, baseCurr)}</strong>
            </div>
          </div>
        </div>
      </Card>

      {/* Rubrieken (NL) or Casillas (DR) */}
      <Card>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-display text-lg font-medium">
            {jur.code === 'NL' ? 'Rubrieken aangifte' : 'Casillas declaración'}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {jur.code === 'NL' ? 'Voor invullen op Mijn Belastingdienst Zakelijk' : 'Para Form IT-1 (DGII Oficina Virtual)'}
          </p>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
          {jur.code === 'NL' ? (
            <>
              {[
                { key: '1a', label: 'Leveringen/diensten belast met hoog tarief (21%)' },
                { key: '1b', label: 'Leveringen/diensten belast met laag tarief (9%)' },
                { key: '1c', label: 'Leveringen/diensten belast met overige tarieven' },
                { key: '1e', label: 'Leveringen/diensten belast met 0% of niet bij u belast' },
                { key: '3b', label: 'Leveringen/diensten naar landen binnen de EU (ICP)', noTax: true },
                { key: '4a', label: 'Leveringen/diensten uit landen buiten de EU (verlegd)' },
                { key: '4b', label: 'Leveringen/diensten uit landen binnen de EU (verlegd)' },
              ].map(({ key, label, noTax }) => {
                const r = data.vat.boxes[key];
                const empty = !r.net && !r.tax;
                return (
                  <div key={key} className="px-5 py-3 flex items-center justify-between text-sm" style={{ opacity: empty ? 0.45 : 1 }}>
                    <div className="min-w-0 pr-3">
                      <span className="font-mono font-medium mr-2">{key}</span>
                      <span>{label}</span>
                    </div>
                    <div className="flex gap-6 text-right flex-shrink-0">
                      <div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>Omzet/bedrag</div>
                        <div className="num font-medium">{fmtCurrency(Math.round(r.net), baseCurr)}</div>
                      </div>
                      <div className="w-24">
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>{jur.salesTax.name}</div>
                        <div className="num font-medium">{noTax ? '—' : fmtCurrency(r.tax, baseCurr)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="px-5 py-3 flex items-center justify-between text-sm" style={{ background: 'var(--surface-2)' }}>
                <div><span className="font-mono font-medium mr-2">5a</span> Verschuldigde omzetbelasting (1a t/m 4b)</div>
                <div className="num font-medium w-24 text-right">{fmtCurrency(data.owed, baseCurr)}</div>
              </div>
              <div className="px-5 py-3 flex items-center justify-between text-sm" style={{ background: 'var(--surface-2)' }}>
                <div><span className="font-mono font-medium mr-2">5b</span> Voorbelasting (incl. verlegde BTW)</div>
                <div className="num font-medium w-24 text-right">{fmtCurrency(data.taxOnPurchases, baseCurr)}</div>
              </div>
              <div className="px-5 py-3 flex items-center justify-between text-sm font-semibold" style={{ background: 'var(--btn-primary)', color: '#fff' }}>
                <div><span className="font-mono mr-2">5c</span> Saldo te betalen / terug</div>
                <div className="num w-24 text-right">{fmtCurrency(data.saldo, baseCurr)}</div>
              </div>
              <div className="px-5 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>
                Belastingdienst rondt omzetbedragen af op hele euro's in jouw voordeel. Verlegde BTW (4a/4b) geef je aan én trek je af in 5b — netto € 0, maar wel verplicht in te vullen.
              </div>
            </>
          ) : (
            <>
              {jur.salesTax.rates.filter(r => r > 0).map(rate => {
                const r = data.salesByRate[String(rate)] || { net: 0, tax: 0 };
                return (
                  <div key={rate} className="px-5 py-3 flex items-center justify-between text-sm">
                    <div>Ventas gravadas {rate}%</div>
                    <div className="flex gap-6 text-right">
                      <div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>Base</div>
                        <div className="num font-medium">{fmtCurrency(r.net, baseCurr)}</div>
                      </div>
                      <div className="w-24">
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>ITBIS</div>
                        <div className="num font-medium">{fmtCurrency(r.tax, baseCurr)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="px-5 py-3 flex items-center justify-between text-sm" style={{ background: 'var(--surface-2)' }}>
                <div>ITBIS facturado total</div>
                <div className="num font-medium w-24 text-right">{fmtCurrency(data.salesTaxOnSales, baseCurr)}</div>
              </div>
              <div className="px-5 py-3 flex items-center justify-between text-sm" style={{ background: 'var(--surface-2)' }}>
                <div>ITBIS adelantado (compras)</div>
                <div className="num font-medium w-24 text-right">{fmtCurrency(data.taxOnPurchases, baseCurr)}</div>
              </div>
              <div className="px-5 py-3 flex items-center justify-between text-sm font-semibold" style={{ background: 'var(--btn-primary)', color: '#fff' }}>
                <div>Saldo a pagar / favor</div>
                <div className="num w-24 text-right">{fmtCurrency(data.saldo, baseCurr)}</div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Costs by ledger account */}
      <Card>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="font-display text-lg font-medium">Kosten per grootboekrekening</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Aangifte-ready breakdown voor je accountant</p>
        </div>
        {data.byLedger.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>Geen kosten in deze periode</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wider" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                <th className="text-left px-5 py-2 font-medium">Rekening</th>
                <th className="text-left py-2 font-medium">Groep</th>
                <th className="text-right py-2 font-medium">Aantal</th>
                <th className="text-right py-2 font-medium">Netto</th>
                <th className="text-right py-2 font-medium">{jur.salesTax.name}</th>
                <th className="text-right px-5 py-2 font-medium">Totaal</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {data.byLedger.map(l => (
                <tr key={l.code}>
                  <td className="px-5 py-2.5">
                    <div className="font-mono text-xs font-medium">{l.code}</div>
                    <div className="text-xs" style={{ color: 'var(--muted)' }}>{l.name}</div>
                  </td>
                  <td className="py-2.5 text-xs" style={{ color: 'var(--muted)' }}>{l.group}</td>
                  <td className="py-2.5 text-right num text-xs">{l.count}</td>
                  <td className="py-2.5 text-right num">{fmtCurrency(l.net, baseCurr)}</td>
                  <td className="py-2.5 text-right num text-xs" style={{ color: 'var(--success)' }}>{fmtCurrency(l.tax, baseCurr)}</td>
                  <td className="px-5 py-2.5 text-right num font-medium">{fmtCurrency(l.total, baseCurr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Detail lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-display text-lg font-medium">Verkopen ({data.periodInvoices.length})</h3>
          </div>
          {data.periodInvoices.length === 0 ? (
            <div className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>Geen verkopen</div>
          ) : (
            <div className="divide-y max-h-80 overflow-y-auto scrollable" style={{ borderColor: 'var(--border)' }}>
              {data.periodInvoices.map(inv => {
                const c = clients.find(cl => cl.id === inv.clientId);
                const t = computeInvoice(inv.items);
                return (
                  <div key={inv.id} className="px-5 py-2.5 text-sm flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-xs">{inv.number}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>{c?.name} · {fmtDate(inv.issueDate)}</div>
                    </div>
                    <div className="text-right">
                      <div className="num text-xs font-medium">{fmtCurrency(t.total, baseCurr)}</div>
                      <div className="num text-[10px]" style={{ color: 'var(--muted)' }}>{jur.salesTax.name}: {fmtCurrency(t.btwTotal, baseCurr)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-display text-lg font-medium">Inkopen ({data.periodExpenses.length})</h3>
          </div>
          {data.periodExpenses.length === 0 ? (
            <div className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>Geen inkopen</div>
          ) : (
            <div className="divide-y max-h-80 overflow-y-auto scrollable" style={{ borderColor: 'var(--border)' }}>
              {data.vat.purchaseRows.map(({ e, treatment, vat }) => {
                const suggested = suggestVatTreatment({ vendor: e.vendor, description: e.notes, currency: e.originalCurrency || e.currency });
                const mismatch = jur.code === 'NL' && !e.vatTreatment && suggested !== treatment;
                return (
                <div key={e.id} className="px-5 py-2.5 text-sm flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate flex items-center gap-1.5">
                      {e.vendor || 'Onbekend'}
                      {e.source === 'bank' && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>BANK</span>}
                      {mismatch && <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }} title={`Voorstel: ${VAT_TREATMENTS.find(v => v.id === suggested)?.label}`}>CHECK</span>}
                    </div>
                    <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                      <span className="font-mono">{e.ledgerAccount || '—'}</span> · {fmtDate(e.date)}
                    </div>
                  </div>
                  {jur.code === 'NL' && setExpenses && (
                    <select value={treatment} onChange={ev => setTreatment(e.id, ev.target.value)}
                      className="text-[11px] rounded border px-1.5 py-1"
                      style={{ background: 'var(--surface)', borderColor: mismatch ? 'var(--warning)' : 'var(--border)', color: 'var(--ink-2)', maxWidth: '110px' }}>
                      {VAT_TREATMENTS.map(v => <option key={v.id} value={v.id}>{v.short}</option>)}
                    </select>
                  )}
                  <div className="text-right" style={{ minWidth: '84px' }}>
                    <div className="num text-xs font-medium">{fmtCurrency(e.amount, baseCurr)}</div>
                    <div className="num text-[10px]" style={{ color: 'var(--muted)' }}>{jur.salesTax.name}: {fmtCurrency(vat, baseCurr)}</div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5" style={{ background: 'var(--surface-2)' }}>
        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
          <Globe size={14} /> Belastingvoorwaarden {jur.flag} {jur.name}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
          {jur.rules.map((r, i) => (
            <div key={i} className="flex justify-between border-b pb-1" style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--muted)' }}>{r.label}</span>
              <span style={{ color: 'var(--ink)' }} className="font-medium">{r.value}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ============================================================================
// INCOME TAX CALCULATOR  (NL 2026 / DR / EE — schattingen)
// ============================================================================
// Alle NL-parameters op één plek, zodat een jaarwissel één object is i.p.v. losse getallen.
// Bron: KvK "Belastingtarieven 2026" + Belastingplan 2026 (Grant Thornton / Van Oers
// loonspecials), nov 2026. Startersaftrek niet in die bronnen → controleren.
const TAX_NL_2026 = {
  year: 2026,
  zelfstandigenaftrek: 1200,          // was €3.750 (2024), €2.470 (2025)
  startersaftrek: 2123,               // controleren
  mkbWinstvrijstelling: 0.127,        // 12,70%
  // Box 1 (onder AOW-leeftijd), drie schijven
  brackets: [
    { to: 38883, rate: 0.3575 },
    { to: 78426, rate: 0.3756 },
    { to: Infinity, rate: 0.495 },
  ],
  // Algemene heffingskorting: max, afbouw 6,398% vanaf €29.736 → €0 bij €78.426
  ahk: { max: 3115, phaseStart: 29736, phaseRate: 0.06398 },
  // Arbeidskorting: opbouw in drie stappen tot max €5.685, afbouw 6,51% vanaf €45.592
  ak: {
    steps: [
      { to: 11965, base: 0, rate: 0.08324 },
      { to: 25845, base: 996, rate: 0.31009 },
      { to: 45592, base: 5300, rate: 0.0195 },
    ],
    max: 5685, phaseStart: 45592, phaseRate: 0.0651,
  },
  // Zvw inkomensafhankelijke bijdrage (verlaagd tarief ondernemers) en maximum bijdrage-inkomen
  zvw: { rate: 0.0485, cap: 79409 },
  korGrens: 20000,
};

const calcIncomeTax = (jurCode, { revenue = 0, costs = 0, isStarter = false, hasUrencriterium = true } = {}) => {
  const winst = Math.max(0, revenue - costs);

  if (jurCode === 'NL') {
    const P = TAX_NL_2026;
    const zelfstandigenAftrek = hasUrencriterium ? Math.min(P.zelfstandigenaftrek, winst) : 0;
    // Startersaftrek: extra aftrek in max. 3 van de eerste 5 jaar, alleen met urencriterium
    const startersAftrek = (isStarter && hasUrencriterium) ? Math.min(P.startersaftrek, Math.max(0, winst - zelfstandigenAftrek)) : 0;
    const winstNaAftrek = Math.max(0, winst - zelfstandigenAftrek - startersAftrek);
    const mkbVrijstelling = Math.round(winstNaAftrek * P.mkbWinstvrijstelling);
    const belastbaarInkomen = Math.max(0, winstNaAftrek - mkbVrijstelling);

    let belasting = 0, prev = 0;
    for (const b of P.brackets) {
      if (belastbaarInkomen <= prev) break;
      belasting += (Math.min(belastbaarInkomen, b.to) - prev) * b.rate;
      prev = b.to;
    }

    const ahk = Math.max(0, P.ahk.max - Math.max(0, belastbaarInkomen - P.ahk.phaseStart) * P.ahk.phaseRate);

    // Arbeidskorting over arbeidsinkomen (hier benaderd met belastbare winst)
    let ak;
    if (belastbaarInkomen > P.ak.phaseStart) {
      ak = Math.max(0, P.ak.max - (belastbaarInkomen - P.ak.phaseStart) * P.ak.phaseRate);
    } else {
      let lower = 0;
      ak = 0;
      for (const st of P.ak.steps) {
        if (belastbaarInkomen <= st.to) { ak = st.base + (belastbaarInkomen - lower) * st.rate; break; }
        lower = st.to;
      }
      ak = Math.min(P.ak.max, ak);
    }

    const kortingen = Math.min(belasting, ahk + ak);
    const inkomstenbelasting = Math.max(0, Math.round(belasting - kortingen));
    const zvw = Math.round(Math.min(belastbaarInkomen, P.zvw.cap) * P.zvw.rate);
    const totaal = inkomstenbelasting + zvw;
    const topGrens = P.brackets[1].to;
    const fmtE = (n) => `€${Math.round(n).toLocaleString('nl-NL')}`;

    return {
      currency: 'EUR', taxYear: P.year, winst, zelfstandigenAftrek, startersAftrek, mkbVrijstelling,
      belastbaarInkomen: Math.round(belastbaarInkomen),
      inkomstenbelasting, zvw, totaal,
      effectief: revenue > 0 ? Math.round((totaal / revenue) * 1000) / 10 : 0,
      opzijPercentage: revenue > 0 ? Math.ceil((totaal / revenue) * 100) : 0,
      alerts: [
        // KOR is een vrijstelling waar je je zelf voor aanmeldt (omzet < €20.000); BTW-plicht
        // bestaat sowieso. Boven de grens kun je de KOR alleen niet (meer) gebruiken.
        revenue > 16000 && revenue < P.korGrens && { type: 'warning', msg: `Nog ${fmtE(P.korGrens - revenue)} tot de KOR-grens (${fmtE(P.korGrens)} omzet). Gebruik je de KOR, dan vervalt die vrijstelling zodra je erboven komt en moet je weer BTW rekenen en aangifte doen.` },
        revenue >= P.korGrens && { type: 'info', msg: `Omzet boven ${fmtE(P.korGrens)}: de kleineondernemersregeling (KOR) is niet beschikbaar — BTW rekenen en aangifte doen.` },
        inkomstenbelasting === 0 && { type: 'success', msg: `Je hoeft waarschijnlijk geen inkomstenbelasting te betalen — alleen Zvw (${fmtE(zvw)}).` },
        belastbaarInkomen > topGrens && { type: 'warning', msg: `Je raakt de 49,5%-schijf (>${fmtE(topGrens)}). Overweeg lijfrente of extra kosten boeken.` },
      ].filter(Boolean),
    };
  }

  if (jurCode === 'DR') {
    // ISR Personas Físicas (schijven in DOP, stand 2024) — schatting, niet jaarlijks bijgewerkt
    const brackets = [
      { to: 416220, rate: 0 }, { to: 624329, rate: 0.15 },
      { to: 867123, rate: 0.20 }, { to: Infinity, rate: 0.25 },
    ];
    let isrPF = 0, prev = 0;
    for (const b of brackets) {
      if (winst <= prev) break;
      isrPF += (Math.min(winst, b.to) - prev) * b.rate;
      prev = b.to;
    }
    const isrSRL = Math.round(winst * 0.27); // SRL (bedrijf): 27% flat
    const anticiposSRL = Math.round(revenue * 0.015); // 1,5% maandelijkse vooruitbetaling
    return {
      currency: 'DOP', winst,
      isrPF: Math.round(isrPF), isrSRL, anticiposSRL,
      totaal: Math.round(isrPF),
      effectief: revenue > 0 ? Math.round((isrPF / revenue) * 1000) / 10 : 0,
      effectiefSRL: revenue > 0 ? Math.round((isrSRL / revenue) * 1000) / 10 : 0,
      alerts: [
        { type: 'info', msg: `Schatting op basis van ISR-schijven 2024 — controleer de actuele DGII-tarieven.` },
        { type: 'info', msg: `Persona Física: progressief 0%–25%. SRL (bedrijf): 27% flat over winst.` },
        { type: 'success', msg: `DR is soepel: kleding, maaltijden, benzine zijn aftrekbaar zonder logo-eis!` },
        anticiposSRL > 0 && { type: 'warning', msg: `SRL-anticipos: RD$${anticiposSRL.toLocaleString('es-DO')}/jaar (1,5% omzet) — maandelijks vooruit aan DGII.` },
      ].filter(Boolean),
    };
  }

  if (jurCode === 'EE') {
    // Schatting: vlakke tarieven (22% inkomsten-/dividendbelasting, 33% social tax), niet jaarlijks bijgewerkt
    const ouDividend = Math.round(winst * 0.22); // dividendbelasting OÜ
    const fieTaxable = Math.max(0, winst * 0.8); // 20% kostenaftrek FIE
    const fieIncome = Math.round(fieTaxable * 0.22);
    const fieSocial = Math.round(fieTaxable * 0.33);
    return {
      currency: 'EUR', winst, ouRetained: 0, ouDividend,
      fieIncome, fieSocial, fieTotal: fieIncome + fieSocial,
      totaal: 0, effectief: 0,
      effectiefDividend: revenue > 0 ? Math.round((ouDividend / revenue) * 1000) / 10 : 0,
      effectiefFIE: revenue > 0 ? Math.round(((fieIncome + fieSocial) / revenue) * 1000) / 10 : 0,
      alerts: [
        { type: 'info', msg: `Schatting met vlakke tarieven (22% / 33% social tax) — controleer de actuele EMTA-tarieven.` },
        { type: 'success', msg: `OÜ: 0% belasting op ingehouden winst — ideaal voor digital nomads!` },
        { type: 'info', msg: `Dividenden uitkeren: 22%. Salaris: +33% social tax boven op inkomen.` },
        { type: 'warning', msg: `FIE (eenmanszaak): ~55% effectief — gebruik altijd een OÜ in Estland!` },
      ],
    };
  }

  return { winst, totaal: 0, effectief: 0, alerts: [], currency: 'EUR' };
};

// Returns { struct, tax, eff, color, lines, note } in EUR for any jurisdiction
const calcCompareTax = (code, eurRevenue, eurCosts, taxProfile = {}) => {
  const jInfo = JURISDICTIONS[code];
  if (!jInfo) return null;
  const eurRev = Math.round(eurRevenue);
  const eurCost = Math.round(eurCosts);
  const eurProfit = Math.max(0, eurRev - eurCost);

  if (code === 'NL') {
    const t = calcIncomeTax('NL', { revenue: eurRev, costs: eurCost, ...taxProfile });
    return {
      struct: 'ZZP', tax: t.totaal, eff: t.effectief,
      color: t.inkomstenbelasting === 0 ? 'var(--success)' : 'var(--accent)',
      lines: [
        `IB: €${(t.inkomstenbelasting ?? 0).toLocaleString('nl-NL')}`,
        `Zvw: €${(t.zvw ?? 0).toLocaleString('nl-NL')}`,
        t.zelfstandigenAftrek > 0 ? `Aftrek: €${(t.zelfstandigenAftrek + (t.startersAftrek || 0)).toLocaleString('nl-NL')}` : 'Geen zelfst.aftrek',
      ],
      note: t.inkomstenbelasting === 0 ? 'Geen IB dankzij heffingskortingen!' : '',
    };
  }
  if (code === 'DR') {
    const drProfit = eurProfit * 60;
    const t = calcIncomeTax('DR', { revenue: drProfit * 1.3, costs: drProfit * 0.3 });
    return {
      struct: 'Persona Física', tax: Math.round(t.isrPF / 60), eff: t.effectief,
      color: eurProfit > 60000 ? 'var(--success)' : 'var(--accent)',
      lines: [
        `PF progressief: ~€${Math.round(t.isrPF / 60).toLocaleString('nl-NL')}`,
        `SRL flat 27%: ~€${Math.round(t.isrSRL / 60).toLocaleString('nl-NL')}`,
        'Auto/kleding/maaltijden aftrekbaar',
      ],
      note: eurProfit > 60000 ? 'DR aantrekkelijk boven ~€60k!' : 'Interessanter bij hogere winst',
    };
  }
  if (code === 'EE') {
    const t = calcIncomeTax('EE', { revenue: eurRev, costs: eurCost });
    return {
      struct: 'OÜ', tax: 0, eff: 0,
      color: 'var(--success)',
      lines: [
        'Ingehouden: €0 (0%)',
        `Dividend: €${(t.ouDividend ?? 0).toLocaleString('nl-NL')} (22%)`,
        'Geen salaris verplicht',
      ],
      note: '0% bij ingehouden winst!',
    };
  }
  if (code === 'UAE') {
    const corpThreshold = 102000; // AED 375k ÷ 3.67
    const tax = Math.round(Math.max(0, eurProfit - corpThreshold) * 0.09);
    const eff = eurRev > 0 ? Math.round((tax / eurRev) * 1000) / 10 : 0;
    return {
      struct: 'FZ / LLC', tax, eff,
      color: eurProfit < corpThreshold ? 'var(--success)' : 'var(--accent)',
      lines: [
        eurProfit < corpThreshold ? 'VPB: €0 (onder drempel)' : `VPB 9%: €${tax.toLocaleString('nl-NL')}`,
        'Persoonlijk inkomen: 0%',
        'Vrije zones: 0% VPB',
      ],
      note: eurProfit < corpThreshold ? '0% belasting onder €102k winst' : '9% VPB boven €102k',
    };
  }
  if (code === 'ES') {
    const ss = Math.min(eurProfit, 4392);
    const base = Math.max(0, eurProfit - ss);
    const braks = [{to:12450,r:0.19},{to:20200,r:0.24},{to:35200,r:0.30},{to:60000,r:0.37},{to:Infinity,r:0.47}];
    let ibTax = 0, prev = 0;
    for (const b of braks) { if (base <= prev) break; ibTax += (Math.min(base, b.to) - prev) * b.r; prev = b.to; }
    ibTax = Math.round(ibTax);
    const total = ibTax + ss;
    return {
      struct: 'Autónomo', tax: total, eff: eurRev > 0 ? Math.round((total / eurRev) * 1000) / 10 : 0,
      color: 'var(--warning)',
      lines: [`IB: €${ibTax.toLocaleString('nl-NL')}`, `Sociale lasten: €${ss.toLocaleString('nl-NL')}/jaar`, 'IS vennootschap: 25%'],
      note: 'Hoge sociale lasten autónomo',
    };
  }
  if (code === 'PT') {
    const ss = Math.round(eurProfit * 0.214);
    const base = Math.max(0, eurProfit - ss);
    const braks = [{to:7703,r:0.145},{to:11623,r:0.21},{to:16472,r:0.265},{to:21321,r:0.285},{to:27146,r:0.35},{to:39791,r:0.37},{to:51997,r:0.435},{to:81199,r:0.45},{to:Infinity,r:0.48}];
    let irsTax = 0, prev = 0;
    for (const b of braks) { if (base <= prev) break; irsTax += (Math.min(base, b.to) - prev) * b.r; prev = b.to; }
    irsTax = Math.round(irsTax);
    const total = irsTax + ss;
    return {
      struct: 'ENI', tax: total, eff: eurRev > 0 ? Math.round((total / eurRev) * 1000) / 10 : 0,
      color: 'var(--warning)',
      lines: [`IRS: €${irsTax.toLocaleString('nl-NL')}`, `Sociale lasten (21,4%): €${ss.toLocaleString('nl-NL')}`, 'NHR: mogelijk 20% flat'],
      note: 'NHR kan gunstig zijn voor expats',
    };
  }
  if (code === 'TH') {
    const thbProfit = eurProfit * 38;
    const braks = [{to:150000,r:0},{to:300000,r:0.05},{to:500000,r:0.10},{to:750000,r:0.15},{to:1000000,r:0.20},{to:2000000,r:0.25},{to:5000000,r:0.30},{to:Infinity,r:0.35}];
    let thbTax = 0, prev = 0;
    for (const b of braks) { if (thbProfit <= prev) break; thbTax += (Math.min(thbProfit, b.to) - prev) * b.r; prev = b.to; }
    const tax = Math.round(thbTax / 38);
    return {
      struct: 'Individu / BOI', tax, eff: eurRev > 0 ? Math.round((tax / eurRev) * 1000) / 10 : 0,
      color: 'var(--accent)',
      lines: [`PIT progressief: €${tax.toLocaleString('nl-NL')}`, 'CIT vennootschap: 20%', 'Lage levenskosten'],
      note: 'Gunstig bij lage winst',
    };
  }
  if (code === 'ID') {
    const umkm = Math.round(eurRev * 0.005);
    const idrProfit = eurProfit * 17000;
    const braks = [{to:60000000,r:0.05},{to:250000000,r:0.15},{to:500000000,r:0.25},{to:Infinity,r:0.30}];
    let idrTax = 0, prev = 0;
    for (const b of braks) { if (idrProfit <= prev) break; idrTax += (Math.min(idrProfit, b.to) - prev) * b.r; prev = b.to; }
    const pph = Math.round(idrTax / 17000);
    const tax = Math.min(umkm, pph);
    return {
      struct: 'UMKM / PT', tax, eff: eurRev > 0 ? Math.round((tax / eurRev) * 1000) / 10 : 0,
      color: 'var(--accent)',
      lines: [`UMKM (0,5% omzet): €${umkm.toLocaleString('nl-NL')}`, `PPh progressief: €${pph.toLocaleString('nl-NL')}`, 'UMKM: gunstigste optie'],
      note: 'UMKM: 0,5% bruto-omzet',
    };
  }
  if (code === 'US') {
    const se = Math.round(eurProfit * 0.9235 * 0.153);
    const agi = Math.max(0, eurProfit - se / 2 - eurProfit * 0.2);
    const ib = Math.round(Math.max(0, agi - 13850) * 0.22);
    const total = se + ib;
    return {
      struct: 'LLC / S-Corp', tax: total, eff: eurRev > 0 ? Math.round((total / eurRev) * 1000) / 10 : 0,
      color: 'var(--warning)',
      lines: [`SE-belasting (15,3%): €${se.toLocaleString('nl-NL')}`, `Inkomstenbelasting: €${ib.toLocaleString('nl-NL')}`, 'S-Corp verlaagt SE-belasting'],
      note: 'Hoge self-employment tax',
    };
  }
  if (code === 'BR') {
    const tax = Math.round(eurRev * 0.06);
    return {
      struct: 'MEI / Simples', tax, eff: eurRev > 0 ? Math.round((tax / eurRev) * 1000) / 10 : 0,
      color: 'var(--warning)',
      lines: [`Simples Nacional (~6%): €${tax.toLocaleString('nl-NL')}`, 'IRPJ + CSLL + PIS/COFINS', 'Complex systeem'],
      note: 'Simples voor kleine bedrijven',
    };
  }
  const rough = Math.round(eurProfit * 0.20);
  return {
    struct: jInfo.name, tax: rough, eff: eurRev > 0 ? Math.round((rough / eurRev) * 1000) / 10 : 0,
    color: 'var(--muted)',
    lines: ['Indicatieve schatting', '~20% over winst', 'Raadpleeg belastingadviseur'],
    note: 'Indicatief',
  };
};

// ============================================================================
// AI ADVISOR VIEW (Bedrijfsrapportage + fiscaal advies)
// ============================================================================
const AIAdvisorView = ({ entities, activeEntity, invoices, expenses, clients, settings }) => {
  const { t } = useLang();
  const [mode, setMode] = useState('report'); // 'report' | 'advice' | 'chat' | 'tax'
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  // Belasting prognose state
  const [taxProfile, setTaxProfile] = useState({ isStarter: false, hasUrencriterium: true });
  const [taxRevOverride, setTaxRevOverride] = useState('');
  const [taxCostOverride, setTaxCostOverride] = useState('');
  const [showCompare, setShowCompare] = useState(false);
  const [compareCode1, setCompareCode1] = useState(null);
  const [compareCode2, setCompareCode2] = useState(null);
  // Aftrekposten gids state
  const [deductSearch, setDeductSearch] = useState('');
  const [deductJur, setDeductJur] = useState(null); // null = huidig bedrijf
  const [expandedItem, setExpandedItem] = useState(null);

  const apiKey = resolveApiKey(settings.apiKey, settings.openaiApiKey);
  const jur = JURISDICTIONS[activeEntity?.jurisdiction || 'NL'];

  // Build current financial snapshot for context
  const snapshot = useMemo(() => {
    if (!activeEntity) return null;
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    // Zelfde filter als de App: facturen/bonnen zonder entityId horen bij het actieve bedrijf
    const entityInvoices = invoices.filter(i => !i.entityId || i.entityId === activeEntity.id);
    const entityExpenses = expenses.filter(e => !e.entityId || e.entityId === activeEntity.id);

    // Rekenregels uit finance.js: omzet = verstuurde facturen excl. BTW (factuurstelsel),
    // kosten excl. BTW, BTW-saldo incl. verlegde BTW (4a/4b) — gelijk aan Winst & verlies/BTW-aangifte.
    const year = now.getFullYear();
    const pl = buildProfitLoss({ invoices: entityInvoices, expenses: entityExpenses, year });
    const yearInvoices = pl.revInv;
    const yearExpenses = pl.exp;
    const revenue = pl.revenue;
    const costs = pl.costs;
    const vat = buildVatReturn({ invoices: entityInvoices, expenses: entityExpenses, clients, start: yearStart, end: new Date(year + 1, 0, 1) });
    const btwOwed = vat.owed;
    const btwReclaim = vat.deductible;

    // Top clients by revenue (excl. BTW)
    const byClient = {};
    yearInvoices.forEach(inv => {
      const c = clients.find(cl => cl.id === inv.clientId);
      if (!c) return;
      byClient[c.name] = (byClient[c.name] || 0) + computeInvoice(inv.items).subtotal;
    });
    const topClients = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Costs by ledger (excl. BTW)
    const byLedger = {};
    yearExpenses.forEach(e => {
      const code = e.ledgerAccount || 'overig';
      byLedger[code] = (byLedger[code] || 0) + expenseNet(e);
    });
    const topCosts = Object.entries(byLedger).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // Openstaand: werkelijk nog te ontvangen (ook deelbetaald/te laat), niet alleen status 'sent'
    const outstanding = entityInvoices.reduce((s, i) => s + invoiceOpenAmount(i), 0);
    const overdue = entityInvoices.filter(i => computeInvoiceStatus(i) === 'overdue').reduce((s, i) => s + invoiceOpenAmount(i), 0);

    // Jaarprognose op basis van verstreken dagen
    const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
    const yearFraction = Math.max(0.01, dayOfYear / 365);
    const projRevenue = Math.round(revenue / yearFraction);
    const projCosts = Math.round(costs / yearFraction);

    return {
      entity: activeEntity,
      year: now.getFullYear(),
      revenue, costs, profit: revenue - costs,
      projRevenue, projCosts, projProfit: projRevenue - projCosts,
      yearFraction: Math.round(yearFraction * 100),
      btwOwed, btwReclaim, btwNet: vat.saldo,
      invoiceCount: yearInvoices.length,
      expenseCount: yearExpenses.length,
      topClients, topCosts,
      outstanding, overdue,
    };
  }, [activeEntity, invoices, expenses, clients]);

  const buildContext = () => {
    if (!snapshot) return '';
    const ledgerAccounts = getLedgerAccounts(activeEntity.jurisdiction || 'NL');
    return `BEDRIJFSCONTEXT (jaar ${snapshot.year}):
- Bedrijf: ${snapshot.entity.name} (${getEntityType(snapshot.entity.type).label}, ${jur.name})
- ${jur.code === 'NL' ? 'KvK' : 'RNC'}: ${snapshot.entity.registrationNumber || '—'}
- ${jur.code === 'NL' ? 'BTW' : 'Tax ID'}: ${snapshot.entity.taxNumber || '—'}

OMZET & KOSTEN year-to-date:
- Omzet excl. BTW (verstuurde facturen, factuurstelsel): ${fmtCurrency(snapshot.revenue, jur.baseCurrency)}
- Kosten excl. BTW (verwerkte bonnen): ${fmtCurrency(snapshot.costs, jur.baseCurrency)}
- Winst voor belasting: ${fmtCurrency(snapshot.profit, jur.baseCurrency)}
- Aantal facturen: ${snapshot.invoiceCount}
- Aantal bonnen: ${snapshot.expenseCount}

${jur.salesTax.name}:
- Verschuldigd (verkopen + verlegde BTW): ${fmtCurrency(snapshot.btwOwed, jur.baseCurrency)}
- Voorbelasting (terug te vorderen): ${fmtCurrency(snapshot.btwReclaim, jur.baseCurrency)}
- Saldo: ${fmtCurrency(snapshot.btwNet, jur.baseCurrency)} (${snapshot.btwNet >= 0 ? 'af te dragen' : 'terug te vorderen'})

OPENSTAAND:
- Nog te ontvangen (openstaand saldo): ${fmtCurrency(snapshot.outstanding, jur.baseCurrency)}
- Te laat (overdue): ${fmtCurrency(snapshot.overdue, jur.baseCurrency)}

TOP KLANTEN (year-to-date, excl. BTW):
${snapshot.topClients.map(([n, v], i) => `${i + 1}. ${n}: ${fmtCurrency(v, jur.baseCurrency)}`).join('\n')}

KOSTEN PER GROOTBOEK (year-to-date, excl. BTW):
${snapshot.topCosts.map(([code, v]) => {
  const acct = ledgerAccounts.find(a => a.code === code);
  return `- ${code} ${acct?.name || ''}: ${fmtCurrency(v, jur.baseCurrency)}`;
}).join('\n')}`;
  };

  const runReport = async () => {
    setLoading(true);
    setError(null);
    setOutput('');
    try {
      const system = `Je bent een ervaren financieel adviseur en accountant voor MKB-ondernemers in ${jur.name}. Je geeft heldere, praktische analyses in het Nederlands. Geen disclaimers, geen "raadpleeg een expert" — wees concreet en behulpzaam. Gebruik markdown (## kopjes, **bold**, - lijsten).`;
      const prompt = `${buildContext()}

Maak een beknopte bedrijfsrapportage met:
1. **Kernpunten**: 2-3 zinnen wat de cijfers zeggen
2. **Sterke punten**: wat gaat goed?
3. **Aandachtspunten**: waar zit risico of inefficiëntie?
4. **Concrete acties**: 3-5 specifieke dingen om deze maand op te pakken
5. **Cashflow-check**: hoe staat het met openstaande facturen?

Houd het zakelijk, scherp, max 400 woorden.`;

      const result = await callAI({ system, prompt, apiKey: settings.apiKey, openaiApiKey: settings.openaiApiKey, maxTokens: 1500 });
      setOutput(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const runAdvice = async () => {
    setLoading(true);
    setError(null);
    setOutput('');
    try {
      const system = `Je bent een fiscaal adviseur gespecialiseerd in ${jur.name} (${jur.code === 'NL' ? 'Nederlandse belastingdienst' : 'DGII Dominicaanse Republiek'}) voor MKB-ondernemers en zzp'ers. Je geeft concrete, praktische adviezen over belastingoptimalisatie en compliance. Geen disclaimers nodig — je gesprekspartner heeft een accountant die alles uiteindelijk reviewt. Gebruik markdown.`;
      const prompt = `${buildContext()}

Geef fiscaal advies voor dit bedrijf, specifiek voor ${jur.name}:
1. **Aftrekposten die ik misschien mis**: kijk naar de kostenstructuur, welke veelvoorkomende aftrekposten ontbreken voor een SaaS/AI ontwikkelbedrijf?
2. **${jur.salesTax.name}-optimalisatie**: kan deze ondernemer slimmer met BTW omgaan?
3. **Specifieke ${jur.code} regelingen**: welke ${jur.code === 'NL' ? 'NL-regelingen (KIA, MIA, EIA, WBSO, zelfstandigenaftrek)' : 'DR-regelingen (Régimen Simplificado, ITBIS adelantado, retenciones, ISR brackets)'} zijn mogelijk relevant?
4. **Waarschuwingen**: waar moet hij/zij op letten met deze cijfers?

Wees concreet. Geen algemene praatjes. Max 500 woorden.`;

      const result = await callAI({ system, prompt, apiKey: settings.apiKey, openaiApiKey: settings.openaiApiKey, maxTokens: 1800 });
      setOutput(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatHistory(h => [...h, { role: 'user', content: userMsg }]);
    setLoading(true);
    setError(null);
    try {
      const system = `Je bent een ervaren financieel en fiscaal adviseur voor MKB-ondernemers in ${jur.name}. Beknopt, concreet, in het Nederlands. Geen disclaimers. Gebruik markdown.

${buildContext()}`;
      // Stuur volledige chatgeschiedenis mee zodat AI context behoudt
      const messages = [
        ...chatHistory.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMsg },
      ];
      const result = await callAI({ system, messages, apiKey: settings.apiKey, openaiApiKey: settings.openaiApiKey, maxTokens: 1500 });
      setChatHistory(h => [...h, { role: 'assistant', content: result }]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const runTaxExplanation = async (taxResult, projectedRevenue, projectedCosts) => {
    setLoading(true);
    setError(null);
    setOutput('');
    try {
      const jurName = jur.name;
      const jurCode = jur.code;
      const system = `Je bent een fiscaal adviseur gespecialiseerd in belasting voor digital nomads en zzp'ers in ${jurName}. Je geeft heldere, concrete uitleg over belastingverplichtingen. Geen disclaimers. Gebruik markdown.`;
      let taxSummary = '';
      if (jurCode === 'NL') {
        taxSummary = `BELASTINGBEREKENING NL (prognose ${snapshot?.year}):
- Verwachte jaaromzet: €${Math.round(projectedRevenue).toLocaleString('nl-NL')}
- Verwachte kosten: €${Math.round(projectedCosts).toLocaleString('nl-NL')}
- Winst: €${Math.round(taxResult.winst).toLocaleString('nl-NL')}
- Zelfstandigenaftrek: €${taxResult.zelfstandigenAftrek.toLocaleString('nl-NL')} (urencriterium: ${taxProfile.hasUrencriterium ? 'ja' : 'nee'})
- Startersaftrek: €${taxResult.startersAftrek.toLocaleString('nl-NL')} (starter: ${taxProfile.isStarter ? 'ja' : 'nee'})
- MKB-winstvrijstelling: €${taxResult.mkbVrijstelling.toLocaleString('nl-NL')}
- Belastbaar inkomen: €${taxResult.belastbaarInkomen.toLocaleString('nl-NL')}
- Inkomstenbelasting (na heffingskortingen): €${taxResult.inkomstenbelasting.toLocaleString('nl-NL')}
- Zvw-bijdrage: €${taxResult.zvw.toLocaleString('nl-NL')}
- TOTAAL opzij te zetten: €${taxResult.totaal.toLocaleString('nl-NL')} (${taxResult.effectief}% van omzet)`;
      } else if (jurCode === 'DR') {
        taxSummary = `BELASTINGBEREKENING DR (prognose ${snapshot?.year}):
- Verwachte jaaromzet: RD$${Math.round(projectedRevenue).toLocaleString('es-DO')}
- Verwachte kosten: RD$${Math.round(projectedCosts).toLocaleString('es-DO')}
- Winst: RD$${Math.round(taxResult.winst).toLocaleString('es-DO')}
- ISR Persona Física (progressief): RD$${taxResult.isrPF.toLocaleString('es-DO')} (${taxResult.effectief}%)
- ISR SRL/bedrijf (27% flat): RD$${taxResult.isrSRL.toLocaleString('es-DO')} (${taxResult.effectiefSRL}%)`;
      } else if (jurCode === 'EE') {
        taxSummary = `BELASTINGBEREKENING ESTLAND (prognose ${snapshot?.year}):
- Verwachte winst: €${Math.round(taxResult.winst).toLocaleString('nl-NL')}
- OÜ, ingehouden winst: €0 (0%)
- OÜ, dividend uitkeren: €${taxResult.ouDividend.toLocaleString('nl-NL')} (${taxResult.effectiefDividend}%)
- FIE (eenmanszaak): €${taxResult.fieTotal.toLocaleString('nl-NL')} (${taxResult.effectiefFIE}%)`;
      }
      const prompt = `${buildContext()}

${taxSummary}

Geef een heldere uitleg voor een digital nomad die officieel in ${jurName} is geregistreerd:
1. **Wat moet ik opzij zetten?** Leg de berekening uit in gewone taal.
2. **Waarom zo weinig/veel?** Verklaar de sleutelaftrekposten of tarieven.
3. **Wanneer betaal ik dit?** Geef de concrete betaalmomenten/deadlines.
4. **Specifieke tips voor ${jurName}**: 2-3 concrete acties om de belastingdruk legaal te verlagen.
5. **Valkuilen**: wat vergeten digital nomads in ${jurName} vaak?

Max 500 woorden. Praktisch, concreet, geen algemene praatjes.`;
      const result = await callAI({ system, prompt, apiKey: settings.apiKey, openaiApiKey: settings.openaiApiKey, maxTokens: 1800 });
      setOutput(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!activeEntity) {
    return (
      <Card>
        <EmptyState icon={Brain} title="Geen actief bedrijf" description="Selecteer een bedrijf om AI-advies te krijgen." />
      </Card>
    );
  }

  // AI-output is onbetrouwbare tekst: eerst ALLE HTML escapen, daarna pas **vet** toepassen.
  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const boldSafe = (s) => escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  const renderMarkdown = (text) => {
    // Lightweight markdown rendering
    const lines = String(text || '').split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('## ')) return <h3 key={i} className="font-display text-xl font-medium mt-5 mb-2">{line.slice(3)}</h3>;
      if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-base mt-4 mb-1.5">{line.slice(4)}</h4>;
      if (line.startsWith('# ')) return <h2 key={i} className="font-display text-2xl font-medium mt-6 mb-3">{line.slice(2)}</h2>;
      if (line.match(/^\d+\.\s+\*\*/)) {
        const m = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*:?\s*(.*)/);
        if (m) return <div key={i} className="mt-3"><strong>{m[1]}. {m[2]}</strong>{m[3] && `: ${m[3]}`}</div>;
      }
      if (line.startsWith('- ')) {
        return <li key={i} className="ml-5 list-disc" dangerouslySetInnerHTML={{ __html: boldSafe(line.slice(2)) }} />;
      }
      if (line.trim() === '') return <div key={i} className="h-2" />;
      return <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: boldSafe(line) }} />;
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader title="AI Adviseur" sub={`${activeEntity.name} · ${jur.flag} ${jur.name} · ${t('ai.subtitle')}`} />

      {/* Modus-keuze als Segmented (zelfde toggle-stijl als de rest van de app) */}
      <div className="overflow-x-auto">
        <Segmented
          options={[
            { id: 'report', label: <span className="inline-flex items-center gap-1.5"><FileBarChart size={13} />{t('ai.tabReport')}</span> },
            { id: 'advice', label: <span className="inline-flex items-center gap-1.5"><Lightbulb size={13} />{t('ai.tabAdvice')}</span> },
            { id: 'tax', label: <span className="inline-flex items-center gap-1.5"><Calculator size={13} />{t('ai.tabTax')}</span> },
            { id: 'deduct', label: <span className="inline-flex items-center gap-1.5"><Percent size={13} />{t('ai.tabDeduct')}</span> },
            { id: 'chat', label: <span className="inline-flex items-center gap-1.5"><MessageSquare size={13} />{t('ai.tabChat')}</span> },
          ]}
          value={mode}
          onChange={id => { setMode(id); setOutput(''); }}
        />
      </div>

      {/* Snapshot KPI strip */}
      {snapshot && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-[12px] font-medium" style={{ color: 'var(--muted)' }}>{t('ai.kpiRevenue')}</div>
            <div className="text-xl mt-1"><Money value={snapshot.revenue} currency={jur.baseCurrency} /></div>
          </Card>
          <Card className="p-4">
            <div className="text-[12px] font-medium" style={{ color: 'var(--muted)' }}>{t('ai.kpiProfit')}</div>
            <div className="text-xl mt-1"><Money value={snapshot.profit} currency={jur.baseCurrency} style={{ color: snapshot.profit >= 0 ? 'var(--success)' : 'var(--danger)' }} /></div>
          </Card>
          <Card className="p-4">
            <div className="text-[12px] font-medium" style={{ color: 'var(--muted)' }}>{jur.salesTax.name}-saldo {snapshot.year}</div>
            <div className="text-xl mt-1"><Money value={snapshot.btwNet} currency={jur.baseCurrency} style={{ color: snapshot.btwNet >= 0 ? 'var(--accent)' : 'var(--success)' }} /></div>
          </Card>
          <Card className="p-4">
            <div className="text-[12px] font-medium" style={{ color: 'var(--muted)' }}>{t('ai.kpiOutstanding')}</div>
            <div className="text-xl mt-1"><Money value={snapshot.outstanding} currency={jur.baseCurrency} style={{ color: snapshot.overdue > 0 ? 'var(--danger)' : 'var(--ink)' }} /></div>
          </Card>
        </div>
      )}

      {/* API key warning */}
      {!apiKey && (
        <Card className="p-4" style={{ background: 'var(--warning-soft)', borderColor: 'var(--warning)' }}>
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="mt-0.5" style={{ color: 'var(--warning)' }} />
            <div className="text-xs flex-1" style={{ color: 'var(--ink-2)' }}>
              <strong>{t('ai.keyMissing')}</strong> {t('ai.keyMissingDesc')}
            </div>
          </div>
        </Card>
      )}

      {/* ── AFTREKPOSTEN GIDS TAB ── */}
      {mode === 'deduct' && (() => {
        const activeJur = deductJur || jur.code;
        const guide = getDeductGuide(activeJur);
        const q = deductSearch.toLowerCase().trim();
        const STATUS_COLORS = { safe: 'var(--success)', borderline: 'var(--warning)', risky: 'var(--danger)', no: 'var(--muted)' };
        const STATUS_LABEL = { safe: '✅ Veilig', borderline: '⚠️ Randje', risky: '🚫 Risicovol', no: '❌ Niet aftrekbaar' };
        const STATUS_BG = { safe: 'var(--success-soft)', borderline: 'var(--warning-soft)', risky: 'var(--danger-soft)', no: 'var(--surface-3)' };

        const filteredGuide = guide.map(cat => ({
          ...cat,
          items: cat.items.filter(item =>
            !q || item.name.toLowerCase().includes(q) || (item.tip || '').toLowerCase().includes(q)
          ),
        })).filter(cat => cat.items.length > 0);

        return (
          <div className="space-y-4">
            {/* Header + land selector + zoekbalk */}
            <Card className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-1 flex-wrap">
                  {Object.values(JURISDICTIONS).map(({ code, flag, name }) => (
                    <button key={code} onClick={() => setDeductJur(code)}
                      className="px-3 py-1.5 rounded text-xs font-semibold"
                      title={name}
                      style={{ background: activeJur === code ? 'var(--btn-primary)' : 'var(--surface-2)', color: activeJur === code ? 'var(--btn-primary-text)' : 'var(--ink-2)' }}>
                      {flag} {code}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={deductSearch}
                  onChange={e => setDeductSearch(e.target.value)}
                  placeholder="Zoek: kleding, laptop, benzine..."
                  className="flex-1 min-w-[200px] px-3 py-1.5 text-sm rounded-md border"
                  style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-2)', color: 'var(--text)' }}
                />
              </div>
              <div className="flex gap-3 mt-3 text-[11px] flex-wrap">
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <span key={k} className="flex items-center gap-1" style={{ color: STATUS_COLORS[k] }}>{v}</span>
                ))}
              </div>
            </Card>

            {filteredGuide.map((cat, ci) => (
              <Card key={ci} className="p-0 overflow-hidden">
                <div className="px-4 py-3 flex items-center gap-2" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                  <span className="text-base">{cat.icon}</span>
                  <span className="font-semibold text-sm">{cat.category}</span>
                  <span className="text-[11px] ml-auto" style={{ color: 'var(--muted)' }}>{cat.items.length} items</span>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {cat.items.map((item, ii) => {
                    const key = `${ci}-${ii}`;
                    const isOpen = expandedItem === key;
                    return (
                      <div key={ii}>
                        <button
                          onClick={() => setExpandedItem(isOpen ? null : key)}
                          className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-opacity-50"
                          style={{ background: isOpen ? STATUS_BG[item.status] : 'transparent' }}
                        >
                          <span className="text-xs font-semibold shrink-0 w-24" style={{ color: STATUS_COLORS[item.status] }}>
                            {STATUS_LABEL[item.status]}
                          </span>
                          <span className="flex-1 text-sm">{item.name}</span>
                          {item.pct > 0 && item.pct < 100 && (
                            <span className="text-[11px] shrink-0 font-mono" style={{ color: 'var(--muted)' }}>{item.pct}%</span>
                          )}
                          <ChevronDown size={12} style={{ flexShrink: 0, color: 'var(--muted)', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                        </button>
                        {isOpen && (
                          <div className="px-4 pb-4 pt-2 space-y-2 text-xs" style={{ background: STATUS_BG[item.status] }}>
                            {item.tip && (
                              <div className="p-2.5 rounded-md font-mono text-xs" style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)' }}>
                                <div className="text-[11px] mb-1 font-sans" style={{ color: 'var(--muted)' }}>Omschrijving op de bon / in boekhouding</div>
                                {item.tip}
                              </div>
                            )}
                            {item.doc && (
                              <div className="flex gap-2 items-start p-2 rounded-md" style={{ background: 'var(--surface-2)' }}>
                                <span>📋</span>
                                <span style={{ color: 'var(--ink-2)' }}><strong>Documentatie:</strong> {item.doc}</span>
                              </div>
                            )}
                            {item.risk && (
                              <div className="flex gap-2 items-start p-2 rounded-md" style={{ background: 'var(--warning-soft)', color: 'var(--warning)' }}>
                                <span>⚠️</span>
                                <span><strong>Let op:</strong> {item.risk}</span>
                              </div>
                            )}
                            {item.pct > 0 && item.pct < 100 && (
                              <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                                Aftrekbaar: <strong>{item.pct}%</strong> van het bedrag
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}

            {filteredGuide.length === 0 && (
              <Card className="p-8 text-center">
                <div className="text-2xl mb-2">🔍</div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>Geen resultaten voor "{deductSearch}"</div>
                <button onClick={() => setDeductSearch('')} className="text-xs mt-2" style={{ color: 'var(--accent)' }}>Wis zoekopdracht</button>
              </Card>
            )}
          </div>
        );
      })()}

      {/* ── BELASTING PROGNOSE TAB ── */}
      {mode === 'tax' && snapshot && (() => {
        const projRev = taxRevOverride !== '' ? Number(taxRevOverride) : snapshot.projRevenue;
        const projCost = taxCostOverride !== '' ? Number(taxCostOverride) : snapshot.projCosts;
        const taxResult = calcIncomeTax(jur.code, { revenue: projRev, costs: projCost, ...taxProfile });
        const curr = jur.baseCurrency;
        const fmt = (v) => fmtCurrency(v, curr);

        // Landen vergelijker (altijd in EUR via ruwe wisselkoers)
        const EUR_RATE = jur.code === 'DR' ? 60 : 1; // RD$60 ≈ €1
        const eurProfit = Math.round((projRev - projCost) / EUR_RATE);
        const eurRevEUR = Math.round(projRev / EUR_RATE);
        const eurCostEUR = Math.round(projCost / EUR_RATE);

        return (
          <div className="space-y-4">
            {/* Profiel */}
            {jur.code === 'NL' && (
              <Card className="p-4">
                <h3 className="font-display text-base font-medium mb-3">Jouw ZZP-profiel</h3>
                <div className="flex gap-5 flex-wrap text-sm">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={taxProfile.hasUrencriterium} onChange={e => setTaxProfile(p => ({ ...p, hasUrencriterium: e.target.checked }))} className="rounded" />
                    <span>1225+ uur/jaar <span style={{ color: 'var(--muted)' }}>(→ zelfstandigenaftrek €{TAX_NL_2026.zelfstandigenaftrek.toLocaleString('nl-NL')})</span></span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={taxProfile.isStarter} onChange={e => setTaxProfile(p => ({ ...p, isStarter: e.target.checked }))} className="rounded" />
                    <span>Starter (eerste 3 jaar) <span style={{ color: 'var(--muted)' }}>(→ +€{TAX_NL_2026.startersaftrek.toLocaleString('nl-NL')} startersaftrek)</span></span>
                  </label>
                </div>
              </Card>
            )}

            {/* Prognose inputs */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-base font-medium">Jaarprognose {snapshot.year}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                    Op basis van {snapshot.yearFraction}% van het jaar · aanpasbaar
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Verwachte jaaromzet (excl. BTW)" type="number" value={taxRevOverride}
                  onChange={e => setTaxRevOverride(e.target.value)} placeholder={String(snapshot.projRevenue)} />
                <Input label="Verwachte jaarkosten (excl. BTW)" type="number" value={taxCostOverride}
                  onChange={e => setTaxCostOverride(e.target.value)} placeholder={String(snapshot.projCosts)} />
              </div>
            </Card>

            {/* Belasting breakdown */}
            <Card className="p-5">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-display text-base font-medium">Belastingberekening {jur.flag} {jur.name}</h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{jur.code === 'NL' ? `Schatting op basis van ${TAX_NL_2026.year}-tarieven` : 'Indicatieve schatting — tarieven niet jaarlijks bijgewerkt'}</p>
                </div>
                <div className="text-right">
                  <div className="text-[12px]" style={{ color: 'var(--muted)' }}>Opzij zetten</div>
                  <div className="font-display text-2xl font-medium num" style={{ color: taxResult.totaal > 0 ? 'var(--accent)' : 'var(--success)' }}>
                    {fmt(taxResult.totaal)}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--muted)' }}>{taxResult.effectief}% van omzet</div>
                </div>
              </div>

              {/* Breakdown rows */}
              <div className="space-y-1.5 text-sm border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                {jur.code === 'NL' && <>
                  <div className="flex justify-between"><span style={{ color: 'var(--muted)' }}>Verwachte omzet</span><span className="num font-medium">{fmt(projRev)}</span></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--muted)' }}>Verwachte kosten</span><span className="num" style={{ color: 'var(--danger)' }}>- {fmt(projCost)}</span></div>
                  <div className="flex justify-between border-t pt-1.5" style={{ borderColor: 'var(--border)' }}><span style={{ color: 'var(--muted)' }}>Winst voor aftrek</span><span className="num font-medium">{fmt(taxResult.winst)}</span></div>
                  {taxResult.zelfstandigenAftrek > 0 && <div className="flex justify-between"><span style={{ color: 'var(--accent)' }}>- Zelfstandigenaftrek</span><span className="num" style={{ color: 'var(--accent)' }}>- {fmt(taxResult.zelfstandigenAftrek)}</span></div>}
                  {taxResult.startersAftrek > 0 && <div className="flex justify-between"><span style={{ color: 'var(--accent)' }}>- Startersaftrek</span><span className="num" style={{ color: 'var(--accent)' }}>- {fmt(taxResult.startersAftrek)}</span></div>}
                  {taxResult.mkbVrijstelling > 0 && <div className="flex justify-between"><span style={{ color: 'var(--accent)' }}>- MKB-winstvrijstelling ({(TAX_NL_2026.mkbWinstvrijstelling * 100).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}%)</span><span className="num" style={{ color: 'var(--accent)' }}>- {fmt(taxResult.mkbVrijstelling)}</span></div>}
                  <div className="flex justify-between border-t pt-1.5 font-medium" style={{ borderColor: 'var(--border)' }}><span>Belastbaar inkomen</span><span className="num">{fmt(taxResult.belastbaarInkomen)}</span></div>
                  <div className="flex justify-between mt-2">
                    <span style={{ color: taxResult.inkomstenbelasting === 0 ? 'var(--success)' : 'var(--ink-2)' }}>Inkomstenbelasting (na kortingen)</span>
                    <span className="num font-medium" style={{ color: taxResult.inkomstenbelasting === 0 ? 'var(--success)' : 'var(--danger)' }}>{fmt(taxResult.inkomstenbelasting)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--ink-2)' }}>Zvw-bijdrage ({(TAX_NL_2026.zvw.rate * 100).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}%)</span>
                    <span className="num font-medium" style={{ color: 'var(--warning)' }}>{fmt(taxResult.zvw)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 font-semibold text-base" style={{ borderColor: 'var(--border)' }}>
                    <span>Totaal opzij</span>
                    <span className="num" style={{ color: taxResult.totaal > 0 ? 'var(--accent)' : 'var(--success)' }}>{fmt(taxResult.totaal)}</span>
                  </div>
                </>}
                {jur.code === 'DR' && <>
                  <div className="flex justify-between"><span style={{ color: 'var(--muted)' }}>Verwachte omzet</span><span className="num font-medium">{fmt(projRev)}</span></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--muted)' }}>Verwachte kosten</span><span className="num" style={{ color: 'var(--danger)' }}>- {fmt(projCost)}</span></div>
                  <div className="flex justify-between border-t pt-2 font-medium" style={{ borderColor: 'var(--border)' }}><span>Winst (belastbare basis)</span><span className="num">{fmt(taxResult.winst)}</span></div>
                  <div className="h-2" />
                  <div className="text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>Optie A: Persona Física (jijzelf)</div>
                  <div className="flex justify-between"><span style={{ color: 'var(--ink-2)' }}>ISR progressief (0%–25%)</span><span className="num font-semibold" style={{ color: 'var(--danger)' }}>{fmt(taxResult.isrPF)} ({taxResult.effectief}%)</span></div>
                  <div className="h-1" />
                  <div className="text-xs font-semibold mb-1 mt-2" style={{ color: 'var(--muted)' }}>Optie B: SRL (bedrijf)</div>
                  <div className="flex justify-between"><span style={{ color: 'var(--ink-2)' }}>ISR flat 27%</span><span className="num font-semibold" style={{ color: 'var(--warning)' }}>{fmt(taxResult.isrSRL)} ({taxResult.effectiefSRL}%)</span></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--muted)' }}>Anticipos maandelijks (1,5% omzet)</span><span className="num">{fmt(taxResult.anticiposSRL)}/jaar</span></div>
                </>}
                {jur.code === 'EE' && <>
                  <div className="flex justify-between"><span style={{ color: 'var(--muted)' }}>Verwachte omzet</span><span className="num font-medium">{fmt(projRev)}</span></div>
                  <div className="flex justify-between border-t pt-2 font-medium" style={{ borderColor: 'var(--border)' }}><span>Winst OÜ</span><span className="num">{fmt(taxResult.winst)}</span></div>
                  <div className="h-2" />
                  <div className="flex justify-between"><span style={{ color: 'var(--ink-2)' }}>OÜ — winst inhouden (niet uitkeren)</span><span className="num font-semibold" style={{ color: 'var(--success)' }}>€0 (0%)</span></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--ink-2)' }}>OÜ — dividend uitkeren (22%)</span><span className="num font-semibold" style={{ color: 'var(--warning)' }}>{fmt(taxResult.ouDividend)} ({taxResult.effectiefDividend}%)</span></div>
                  <div className="flex justify-between"><span style={{ color: 'var(--ink-2)' }}>FIE (eenmanszaak, ~55%)</span><span className="num font-semibold" style={{ color: 'var(--danger)' }}>{fmt(taxResult.fieTotal)} ({taxResult.effectiefFIE}%)</span></div>
                </>}
              </div>

              {/* Alerts */}
              {taxResult.alerts.length > 0 && (
                <div className="mt-4 space-y-2">
                  {taxResult.alerts.map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs p-2.5 rounded-md" style={{
                      background: a.type === 'success' ? 'var(--success-soft)' : a.type === 'warning' ? 'var(--warning-soft)' : 'var(--surface-2)',
                      color: a.type === 'success' ? 'var(--success)' : a.type === 'warning' ? 'var(--warning)' : 'var(--ink-2)',
                    }}>
                      <span>{a.msg}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* AI uitleg knop */}
              <div className="mt-4 pt-3 border-t flex gap-2 flex-wrap" style={{ borderColor: 'var(--border)' }}>
                <Button onClick={() => runTaxExplanation(taxResult, projRev, projCost)} disabled={loading}>
                  {loading ? <><RefreshCw size={14} className="animate-spin" /> Genereren...</> : <><Wand2 size={14} /> Laat AI dit uitleggen</>}
                </Button>
              </div>
            </Card>

            {/* Landen vergelijker */}
            <Card className="p-4">
              <button
                onClick={() => setShowCompare(v => !v)}
                className="w-full flex items-center justify-between text-sm font-medium"
              >
                <span className="flex items-center gap-2"><Globe size={14} /> Landen vergelijker</span>
                <ChevronDown size={14} style={{ transform: showCompare ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
              </button>
              {showCompare && (() => {
                const otherCodes = Object.keys(JURISDICTIONS).filter(c => c !== jur.code);
                const defaultC1 = jur.code === 'NL' ? 'DR' : 'NL';
                const defaultC2raw = jur.code === 'NL' ? 'EE' : (jur.code === 'EE' ? 'DR' : 'EE');
                const c1 = (compareCode1 && compareCode1 !== jur.code) ? compareCode1 : defaultC1;
                const defaultC2 = defaultC2raw === c1 ? (otherCodes.find(c => c !== c1) || otherCodes[0]) : defaultC2raw;
                const c2 = (compareCode2 && compareCode2 !== jur.code && compareCode2 !== c1) ? compareCode2 : defaultC2;
                const cards = [jur.code, c1, c2].map(code => ({
                  code, info: JURISDICTIONS[code],
                  card: calcCompareTax(code, eurRevEUR, eurCostEUR, taxProfile),
                }));
                return (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span style={{ color: 'var(--muted)' }}>Vergelijk:</span>
                      <span className="font-medium">{jur.flag} {jur.name}</span>
                      <span style={{ color: 'var(--muted)' }}>vs</span>
                      <select value={c1} onChange={e => setCompareCode1(e.target.value)}
                        className="px-2 py-1 rounded border text-xs"
                        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)' }}>
                        {Object.values(JURISDICTIONS).filter(j => j.code !== jur.code && j.code !== c2).map(j => (
                          <option key={j.code} value={j.code}>{j.flag} {j.name}</option>
                        ))}
                      </select>
                      <span style={{ color: 'var(--muted)' }}>vs</span>
                      <select value={c2} onChange={e => setCompareCode2(e.target.value)}
                        className="px-2 py-1 rounded border text-xs"
                        style={{ borderColor: 'var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)' }}>
                        {Object.values(JURISDICTIONS).filter(j => j.code !== jur.code && j.code !== c1).map(j => (
                          <option key={j.code} value={j.code}>{j.flag} {j.name}</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      Vergelijking op basis van ~€{eurProfit.toLocaleString('nl-NL')} winst per jaar (indicatief).
                      {jur.code === 'DR' && ' RD$60 ≈ €1 gebruikt voor omrekening.'}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {cards.map(({ code, info, card }) => card && (
                        <div key={code} className="rounded-lg p-3 text-center" style={{ background: 'var(--surface-2)', border: code === jur.code ? '2px solid var(--accent)' : '1px solid var(--border)' }}>
                          {code === jur.code && <div className="text-[11px] mb-1 font-semibold" style={{ color: 'var(--accent)' }}>Jouw land</div>}
                          <div className="text-2xl mb-1">{info.flag}</div>
                          <div className="font-semibold text-sm">{info.name}</div>
                          <div className="text-[10px] mb-2" style={{ color: 'var(--muted)' }}>{card.struct}</div>
                          <div className="font-display text-xl num font-medium" style={{ color: card.color }}>
                            <Money value={card.tax} />
                          </div>
                          <div className="text-[11px] mb-2" style={{ color: 'var(--muted)' }}>{card.eff}% van omzet</div>
                          <div className="text-[10px] space-y-0.5 text-left border-t pt-2" style={{ borderColor: 'var(--border)', color: 'var(--ink-2)' }}>
                            {card.lines.map((l, i) => <div key={i}>· {l}</div>)}
                          </div>
                          {card.note && <div className="text-[10px] mt-2 font-medium" style={{ color: card.color }}>{card.note}</div>}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 text-xs p-3 rounded-md" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--ink-2)' }}>
                      <div className="font-semibold text-sm mb-1" style={{ color: 'var(--ink)' }}>Wanneer wordt welk land interessant?</div>
                      <div><span className="font-medium" style={{ color: 'var(--accent)' }}>Nederland ZZP</span> is verrassend gunstig bij winst onder ~€40k. Dankzij zelfstandigenaftrek, MKB-vrijstelling en heffingskortingen betaal je bij lage winst nauwelijks inkomstenbelasting — alleen Zvw (4,85%). Let op: de zelfstandigenaftrek is in 2026 nog maar €1.200. Nadeel: strenge regels, logo-eis op kleding.</div>
                      <div><span className="font-medium" style={{ color: 'var(--warning)' }}>Dominicaanse Republiek</span> wordt interessanter bij hogere winsten (€60k+). Als individu (Persona Física) betaal je progressief 0%–25% — bij lage inkomens redelijk, bij hoge inkomens loopt het op. Als bedrijf (SRL) betaal je 27% flat, wat bij €20k winst juist nadelig is. Voordeel: soepele aftrekposten, lage levenskosten, geen vermogensbelasting.</div>
                      <div><span className="font-medium" style={{ color: 'var(--success)' }}>Estland OÜ</span> is ideaal voor remote werkers: zolang je winst in de BV laat, betaal je 0%. Pas als je dividend uitkeert, betaal je 22%. Je kunt winst jaren laten groeien en dan pas opnemen als het jou uitkomt — of herinvesteren zonder belasting. Geen verplicht salaris.</div>
                      <div><span className="font-medium" style={{ color: 'var(--ink)' }}>Dubai / UAE</span> kent 0% persoonlijke inkomstenbelasting. Vennootschapsbelasting is 9% maar pas boven ~€102k winst. Hoge levenskosten, maar enorm aantrekkelijk bij hogere inkomens.</div>
                      <div className="pt-1 border-t" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                        NL op basis van 2026-tarieven; overige landen zijn grove schattingen. Alle bedragen zijn indicatief — lokale aftrekposten, structuur en adviseur kunnen sterk afwijken.
                      </div>
                    </div>
                  </div>
                );
              })()}
            </Card>

            {/* AI output */}
            {output && (
              <Card className="p-6 animate-in">
                <div className="flex items-center gap-2 mb-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                  <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                  <div className="text-xs font-medium" style={{ color: 'var(--muted)' }}>AI-belastinguitleg · {new Date().toLocaleString('nl-NL')}</div>
                </div>
                <div className="prose prose-sm max-w-none" style={{ color: 'var(--ink)' }}>{renderMarkdown(output)}</div>
              </Card>
            )}
          </div>
        );
      })()}

      {/* Action button or chat input */}
      {mode === 'chat' ? (
        <Card className="p-4">
          {chatHistory.length > 0 && (
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto scrollable">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`p-3 rounded-lg text-sm ${msg.role === 'user' ? 'ml-8' : 'mr-8'}`} style={{ background: msg.role === 'user' ? 'var(--btn-primary)' : 'var(--surface-2)', color: msg.role === 'user' ? 'var(--btn-primary-text)' : 'var(--ink)' }}>
                  {msg.role === 'user' ? msg.content : renderMarkdown(msg.content)}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              className="flex-1"
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && sendChat()}
              placeholder={t('ai.chatPlaceholder')}
              disabled={loading}
            />
            <Button onClick={sendChat} disabled={loading || !chatInput.trim()}>
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            </Button>
          </div>
          <div className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
            Voorbeelden: "Welke kosten kan ik nog meer aftrekken?" · "Moet ik me als KOR aanmelden?" · "Hoe zit het met DR retenciones?"
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1">
              <h3 className="font-display text-lg font-medium">
                {mode === 'report' ? t('ai.tabReport') : t('ai.tabAdvice')}
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                {mode === 'report' ? 'Analyse van je YTD performance + concrete acties' : `${jur.salesTax.name}-optimalisatie en aftrekposten specifiek voor ${jur.name}`}
              </p>
            </div>
            <Button onClick={mode === 'report' ? runReport : runAdvice} disabled={loading}>
              {loading ? <><RefreshCw size={14} className="animate-spin" /> {t('ai.generating')}</> : <><Wand2 size={14} /> {t('ai.generate')}</>}
            </Button>
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-4" style={{ background: 'var(--danger-soft)', borderColor: 'var(--danger)' }}>
          <div className="flex items-start gap-3 text-sm" style={{ color: 'var(--danger)' }}>
            <AlertCircle size={16} className="mt-0.5" />
            <div><strong>Fout bij AI-aanroep:</strong> {error}</div>
          </div>
        </Card>
      )}

      {output && mode !== 'chat' && (
        <Card className="p-6 md:p-8 animate-in">
          <div className="flex items-center gap-2 mb-4 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <Sparkles size={16} style={{ color: 'var(--accent)' }} />
            <div className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
              AI-analyse · {new Date().toLocaleString('nl-NL')}
            </div>
          </div>
          <div className="prose prose-sm max-w-none" style={{ color: 'var(--ink)' }}>
            {renderMarkdown(output)}
          </div>
          <div className="mt-6 pt-4 border-t flex justify-end gap-2" style={{ borderColor: 'var(--border)' }}>
            <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard?.writeText(output); }}>
              <Copy size={12} /> {t('ai.copy')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Printer size={12} /> Print
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

// ============================================================================
// SETTINGS VIEW
// ============================================================================
const IMPORT_FUNCTION_URL = 'https://iomsezoerbldjwyztlkr.supabase.co/functions/v1/import-invoice';

function IntegratiesSection({ importTokenActive, generateImportToken }) {
  // De token is alleen direct na aanmaken bekend (in de database staat enkel de hash).
  const [importToken, setImportToken] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const copyToken = () => {
    if (!importToken) return;
    navigator.clipboard.writeText(importToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(IMPORT_FUNCTION_URL);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const token = await generateImportToken();
    if (token) setImportToken(token);
    setGenerating(false);
    setShowToken(true);
  };

  const masked = importToken
    ? importToken.slice(0, 8) + '••••••••••••••••••••••••••' + importToken.slice(-4)
    : null;

  return (
    <div className="space-y-5">
      <Card className="p-6 space-y-5">
        <div>
          <h3 className="font-display text-lg mb-2 font-medium">Make.com koppeling — Inkoop automatisch importeren</h3>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Genereer een persoonlijk API-token zodat Make.com facturen rechtstreeks in jouw inkoopoverzicht kan plaatsen.
            Elke gebruiker heeft zijn eigen token — data komt altijd in het juiste account terecht.
          </p>
        </div>

        {/* Token sectie */}
        <div className="space-y-3">
          <div style={{ color: 'var(--text-2)', fontSize: '12.5px', fontWeight: '600' }}>
            Jouw API-token
          </div>
          {importToken ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-sm"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)', minWidth: 0 }}>
                <Key size={13} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                <span className="truncate">{showToken ? importToken : masked}</span>
              </div>
              <button
                onClick={() => setShowToken(s => !s)}
                className="px-3 py-2 text-xs rounded-lg"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text-2)', whiteSpace: 'nowrap' }}
              >
                {showToken ? 'Verberg' : 'Toon'}
              </button>
              <button
                onClick={copyToken}
                className="px-3 py-2 text-xs rounded-lg flex items-center gap-1.5"
                style={{ background: copied ? 'var(--success-soft)' : 'var(--surface-2)', border: '1px solid var(--border-2)', color: copied ? 'var(--success)' : 'var(--text-2)', whiteSpace: 'nowrap' }}
              >
                {copied ? <><Check size={12} /> Gekopieerd</> : <><Copy size={12} /> Kopieer</>}
              </button>
            </div>
          ) : (
            <div className="rounded-md p-3 text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--muted)' }}>
              {importTokenActive ? 'Er is een token actief. Hij is om veiligheidsredenen niet meer in te zien; vernieuw hem als je hem kwijt bent.' : 'Nog geen token gegenereerd.'}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="px-4 py-2 text-sm rounded-lg flex items-center gap-2"
              style={{ background: 'var(--btn-primary)', color: 'var(--btn-primary-text)', opacity: generating ? 0.6 : 1, cursor: generating ? 'wait' : 'pointer' }}
            >
              <RefreshCw size={13} className={generating ? 'animate-spin' : ''} />
              {importToken || importTokenActive ? 'Vernieuw token' : 'Genereer token'}
            </button>
            {(importToken || importTokenActive) && (
              <span className="text-xs" style={{ color: 'var(--muted)' }}>
                Vernieuwen maakt het oude token ongeldig.
              </span>
            )}
          </div>
        </div>

        {/* Webhook URL */}
        <div className="space-y-2">
          <div style={{ color: 'var(--text-2)', fontSize: '12.5px', fontWeight: '600' }}>
            Webhook-URL (gebruik in Make)
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text-2)', minWidth: 0 }}>
              <Link2 size={12} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              <span className="truncate">{IMPORT_FUNCTION_URL}</span>
            </div>
            <button
              onClick={copyUrl}
              className="px-3 py-2 text-xs rounded-lg flex items-center gap-1.5"
              style={{ background: copiedUrl ? 'var(--success-soft)' : 'var(--surface-2)', border: '1px solid var(--border-2)', color: copiedUrl ? 'var(--success)' : 'var(--text-2)', whiteSpace: 'nowrap' }}
            >
              {copiedUrl ? <><Check size={12} /> Gekopieerd</> : <><Copy size={12} /> Kopieer</>}
            </button>
          </div>
        </div>
      </Card>

      {/* Make instructies */}
      <Card className="p-6 space-y-4">
        <h3 className="font-display text-base font-medium flex items-center gap-2">
          <Zap size={16} style={{ color: 'var(--accent)' }} />
          Make.com instellen
        </h3>
        <ol className="space-y-3 text-sm" style={{ color: 'var(--text-2)' }}>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: 'var(--btn-primary)', color: 'var(--btn-primary-text)' }}>1</span>
            <span>Maak een nieuw scenario in Make.com. Voeg module toe: <strong>Gmail → Watch Emails</strong>. Kies label <strong>Facturen</strong>, filter op <em>Ongelezen</em>.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: 'var(--btn-primary)', color: 'var(--btn-primary-text)' }}>2</span>
            <span>Voeg module toe: <strong>Gmail → Mark as Read</strong> (zodat elke factuur maar één keer verwerkt wordt).</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: 'var(--btn-primary)', color: 'var(--btn-primary-text)' }}>3</span>
            <span>Voeg module toe: <strong>OpenAI → Create a Completion</strong>. Gebruik de e-mailtekst als input met onderstaand JSON-formaat als output (zie veldlijst).</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: 'var(--btn-primary)', color: 'var(--btn-primary-text)' }}>4</span>
            <span>Voeg module toe: <strong>HTTP → Make a request</strong>. Methode: <code className="px-1 rounded" style={{ background: 'var(--surface-2)' }}>POST</code>, URL: de webhook URL hierboven. Header: <code className="px-1 rounded" style={{ background: 'var(--surface-2)' }}>Authorization: Bearer &lt;jouw token&gt;</code>.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center" style={{ background: 'var(--btn-primary)', color: 'var(--btn-primary-text)' }}>5</span>
            <span>Zet de scenario aan en test met een echte factuur-mail in het label.</span>
          </li>
        </ol>

        {/* JSON veldspec */}
        <div className="rounded-lg p-4 mt-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-2)' }}>JSON body die Make stuurt (verplicht: supplier, date, amount_excl)</div>
          <pre className="text-xs overflow-x-auto" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>{`{
  "supplier":       "OpenAI",
  "invoice_number": "2024-INV-001",
  "date":           "2024-06-01",
  "amount_excl":    49.00,
  "btw_rate":       0,
  "btw_amount":     0,
  "total_amount":   49.00,
  "currency":       "USD",
  "category":       "AI & Automatisering",
  "notes":          "GPT-4 API usage June"
}`}</pre>
        </div>

        <div className="rounded-md p-3 text-xs flex items-start gap-2" style={{ background: 'var(--warning-soft)', color: 'var(--ink-2)' }}>
          <AlertCircle size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
          <div>
            <strong>BTW-tip voor Make:</strong> Vraag in je OpenAI-prompt: <em>"Als het bedrijf buiten Nederland/EU is, zet btw_rate op 0. Als er BTW op staat, gebruik het exacte percentage."</em> Zo detecteert Make automatisch of het 0%, 9% of 21% is.
          </div>
        </div>
      </Card>
    </div>
  );
}

const SettingsView = ({ settings, setSettings, activeEntity, entities, setEntities, clients, initialSection, updateProfile, profile, user, organization, updateOrganization, saveUserApiKeys, generateImportToken, importTokenActive }) => {
  const { t, lang, setLang, LANGUAGES } = useLang();
  const [section, setSection] = useState(initialSection || 'jurisdiction');
  const [draft, setDraft] = useState(settings);
  const [savedFlash, setSavedFlash] = useState(false);
  const [profileName, setProfileName] = useState(profile?.full_name || '');
  const [profileSaved, setProfileSaved] = useState(false);
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [orgPlan, setOrgPlan] = useState(organization?.plan || 'starter');
  const [orgSaved, setOrgSaved] = useState(false);

  // Sync API keys from effectiveSettings nadat userApiKeys async geladen is
  useEffect(() => {
    setDraft(d => ({
      ...d,
      apiKey: settings.apiKey || d.apiKey,
      openaiApiKey: settings.openaiApiKey || d.openaiApiKey,
    }));
  }, [settings.apiKey, settings.openaiApiKey]);

  useEffect(() => {
    if (organization) {
      setOrgName(organization.name || '');
      setOrgPlan(organization.plan || 'starter');
    }
  }, [organization?.id]);

  useEffect(() => {
    if (initialSection) setSection(initialSection);
  }, [initialSection]);

  const saveProfileName = async () => {
    if (updateProfile) await updateProfile({ full_name: profileName });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const saveOrg = async () => {
    if (updateOrganization) await updateOrganization({ name: orgName.trim(), plan: orgPlan });
    setOrgSaved(true);
    setTimeout(() => setOrgSaved(false), 2000);
  };

  useEffect(() => setDraft(settings), [settings]);

  const update = (path, value) => {
    const keys = path.split('.');
    const next = JSON.parse(JSON.stringify(draft));
    let curr = next;
    for (let i = 0; i < keys.length - 1; i++) curr = curr[keys[i]];
    curr[keys[keys.length - 1]] = value;
    setDraft(next);
  };

  const save = async () => {
    // API keys zijn per gebruiker — apart opslaan in user_settings
    if (saveUserApiKeys) {
      await saveUserApiKeys({ apiKey: draft.apiKey || '', openaiApiKey: draft.openaiApiKey || '' });
    }
    const { apiKey, openaiApiKey, ...orgDraft } = draft;
    await setSettings(orgDraft);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const sections = [
    { id: 'profile', label: t('settings.profile'), icon: Users },
    { id: 'jurisdiction', label: t('settings.jurisdiction'), icon: Globe },
    { id: 'templates', label: t('settings.templates'), icon: Wand2 },
    { id: 'reminders', label: t('settings.reminders'), icon: Bell },
    { id: 'email', label: t('settings.email'), icon: Mail },
    { id: 'categories', label: t('settings.categories'), icon: Tag },
    { id: 'ai', label: t('settings.ai'), icon: Brain },
    { id: 'credit', label: t('settings.credit'), icon: ShieldCheck },
    { id: 'status', label: t('settings.status'), icon: CheckCircle2 },
    { id: 'appearance', label: t('settings.appearance'), icon: Sparkles },
    { id: 'integraties', label: t('settings.integrations'), icon: Link2 },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('settings.title')}
        sub={t('settings.subtitle')}
        actions={
          <Button onClick={save}>
            {savedFlash ? <><Check size={14} /> {t('settings.saved')}</> : <><Save size={14} /> {t('settings.save')}</>}
          </Button>
        }
      />

      {/* Mobile: compact dropdown nav */}
      <div className="md:hidden">
        <div className="relative">
          <select
            value={section}
            onChange={e => setSection(e.target.value)}
            className="w-full appearance-none pl-4 pr-10 py-3 text-sm rounded-xl border font-medium"
            style={{ background: 'var(--bg)', color: 'var(--text)', borderColor: 'var(--border-strong)' }}
          >
            {sections.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }} />
        </div>
      </div>

      {/* Desktop: sidebar + content / Mobile: content full width */}
      <div className="md:flex gap-6 items-start">
        {/* Sidebar nav — desktop only */}
        <nav className="hidden md:flex flex-col w-44 shrink-0 sticky gap-0.5" style={{ top: '1rem' }}>
          {sections.map(s => {
            const Icon = s.icon;
            const active = section === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm text-left transition-all"
                style={{
                  background: active ? 'var(--surface-2)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--ink-2)',
                  fontWeight: active ? 600 : 400,
                  borderLeft: `2px solid ${active ? 'var(--btn-primary)' : 'transparent'}`,
                }}
              >
                <Icon size={14} style={{ flexShrink: 0, opacity: active ? 1 : 0.5 }} />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-5">

      {section === 'profile' && (
        <div className="space-y-5">
          <Card className="p-6 space-y-5">
            <h3 className="font-display text-lg font-medium">{t('profile.title')}</h3>
            <div className="flex items-center gap-4">
              <label style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }} title={t('profile.avatarTooltip')}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%', overflow: 'hidden',
                  // Accent-tokens i.p.v. vaste indigo (zelfde avatar als in de sidebar)
                  background: profile?.avatar_url ? 'transparent' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', fontWeight: '700', color: 'var(--btn-primary-text)',
                  boxShadow: '0 4px 12px var(--accent-glow)',
                }}>
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : (profileName || profile?.full_name || user?.email || 'G')[0].toUpperCase()
                  }
                </div>
                {/* Hover overlay */}
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.18s',
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0}
                >
                  <Camera size={18} color="#fff" />
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = ev => {
                    const img = new Image();
                    img.onload = async () => {
                      const SIZE = 160;
                      const canvas = document.createElement('canvas');
                      canvas.width = SIZE;
                      canvas.height = SIZE;
                      const ctx = canvas.getContext('2d');
                      // Crop naar vierkant vanuit het midden
                      const side = Math.min(img.width, img.height);
                      const sx = (img.width - side) / 2;
                      const sy = (img.height - side) / 2;
                      ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
                      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
                      if (updateProfile) await updateProfile({ avatar_url: dataUrl });
                    };
                    img.src = ev.target.result;
                  };
                  reader.readAsDataURL(file);
                }} />
              </label>
              <div>
                <div className="font-semibold" style={{ color: 'var(--text)' }}>{profileName || t('profile.noName')}</div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>{user?.email || ''}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{t('profile.clickToChange')}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('profile.fullName')}
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                placeholder="Jan de Vries"
              />
              <Input
                label={t('profile.emailField')}
                value={user?.email || ''}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={saveProfileName}>
                {profileSaved ? <><Check size={14} /> {t('settings.saved')}</> : <><Save size={14} /> {t('profile.saveBtn')}</>}
              </Button>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{t('profile.emailReadonly')}</span>
            </div>
          </Card>
          <Card className="p-6 space-y-4">
            <h3 className="font-display text-base font-medium">{t('profile.accountInfo')}</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span style={{ color: 'var(--muted)' }}>{t('profile.role')}</span>
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                {profile?.role === 'platform_admin' ? t('profile.roleAdmin') : profile?.role === 'org_owner' ? t('profile.roleOwner') : profile?.role === 'accountant' ? t('profile.roleAccountant') : t('profile.roleEmployee')}
              </span>
              {profile?.organization_id && <>
                <span style={{ color: 'var(--muted)' }}>{t('profile.orgId')}</span>
                <span style={{ color: 'var(--text)', fontFamily: 'monospace', fontSize: '11px' }}>{profile.organization_id}</span>
              </>}
            </div>
            {organization && (profile?.role === 'org_owner' || profile?.role === 'platform_admin') && (
              <div className="space-y-4 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label={t('profile.orgName')}
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    placeholder="Mijn Bedrijf BV"
                  />
                  {profile?.role === 'platform_admin' ? (
                    <Select label={t('profile.plan')} value={orgPlan} onChange={e => setOrgPlan(e.target.value)}>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </Select>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('profile.plan')}</label>
                      <div className="px-3 py-2 text-sm rounded border capitalize" style={{ background: 'var(--surface-2)', color: 'var(--text)', borderColor: 'var(--border)' }}>
                        {organization.plan || 'starter'}
                      </div>
                    </div>
                  )}
                </div>
                <Button onClick={saveOrg}>
                  {orgSaved ? <><Check size={14} /> {t('settings.saved')}</> : <><Save size={14} /> {t('profile.saveOrg')}</>}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {section === 'jurisdiction' && (
        <div className="space-y-5">
          <Card className="p-6 space-y-5">
            <h3 className="font-display text-lg font-medium">{t('jur.title')}</h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {t('jur.desc')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {Object.values(JURISDICTIONS).map(j => {
                const isActive = (draft.jurisdiction || 'NL') === j.code;
                return (
                  <button
                    key={j.code}
                    onClick={() => {
                      const next = JSON.parse(JSON.stringify(draft));
                      next.jurisdiction = j.code;
                      if (j.code !== 'CUSTOM') {
                        next.baseCurrency = j.baseCurrency;
                        next.invoice = next.invoice || {};
                        next.invoice.defaultBtwRate = j.salesTax.standard;
                        next.invoice.currency = j.baseCurrency;
                      }
                      setDraft(next);
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all"
                    style={{
                      borderColor: isActive ? 'var(--ink)' : 'var(--border)',
                      background: isActive ? 'var(--surface-2)' : 'transparent',
                      borderWidth: isActive ? '2px' : '1px',
                    }}
                  >
                    <span className="text-base shrink-0">{j.flag}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color: 'var(--ink)' }}>{j.name}</div>
                      {j.code !== 'CUSTOM' ? (
                        <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>{j.salesTax.name} {j.salesTax.standard}%</div>
                      ) : (
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>{t('jur.customRules')}</div>
                      )}
                    </div>
                    {isActive && <Check size={11} className="shrink-0" style={{ color: 'var(--success)' }} />}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Custom jurisdiction editor */}
          {(draft.jurisdiction || 'NL') === 'CUSTOM' && (
            <Card className="p-6 space-y-4">
              <h3 className="font-display text-lg font-medium">{t('jur.customTitle')}</h3>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {t('jur.customDesc')}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('jur.countryName')} value={draft.customJurisdiction?.countryName || ''} onChange={e => update('customJurisdiction.countryName', e.target.value)} placeholder="bijv. Singapore" />
                <Input label={t('jur.taxType')} value={draft.customJurisdiction?.taxName || ''} onChange={e => update('customJurisdiction.taxName', e.target.value)} placeholder="bijv. GST, VAT, TVA" />
                <Input label={t('jur.standardRate')} type="number" min="0" max="100" step="0.1" value={draft.customJurisdiction?.standardRate ?? ''} onChange={e => update('customJurisdiction.standardRate', Number(e.target.value))} placeholder="bijv. 9" />
                <Select label={t('jur.baseCurrencyLabel')} value={draft.customJurisdiction?.currency || 'EUR'} onChange={e => { update('customJurisdiction.currency', e.target.value); update('baseCurrency', e.target.value); }}>
                  {SUPPORTED_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
                </Select>
                <Select label={t('jur.filingPeriod')} value={draft.customJurisdiction?.filingPeriod || 'quarterly'} onChange={e => update('customJurisdiction.filingPeriod', e.target.value)}>
                  <option value="quarterly">{t('jur.quarterly')}</option>
                  <option value="monthly">{t('jur.monthly')}</option>
                  <option value="yearly">{t('jur.yearly')}</option>
                </Select>
                <Input label={t('jur.filingDeadline')} value={draft.customJurisdiction?.filingDeadline || ''} onChange={e => update('customJurisdiction.filingDeadline', e.target.value)} placeholder="bijv. 30 dagen na kwartaaleinde" />
                <Input label={t('jur.regThreshold')} value={draft.customJurisdiction?.registrationThreshold || ''} onChange={e => update('customJurisdiction.registrationThreshold', e.target.value)} placeholder="bijv. € 20.000 omzet/jaar" />
                <Input label={t('jur.retention')} value={draft.customJurisdiction?.retentionPeriod || ''} onChange={e => update('customJurisdiction.retentionPeriod', e.target.value)} placeholder="bijv. 7 jaar" />
              </div>
              <div className="space-y-3 pt-2">
                <p className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>{t('jur.extraRules')}</p>
                {[1, 2, 3].map(n => (
                  <div key={n} className="grid grid-cols-2 gap-3">
                    <Input placeholder={`Regel ${n} — label`} value={draft.customJurisdiction?.[`rule${n}label`] || ''} onChange={e => update(`customJurisdiction.rule${n}label`, e.target.value)} />
                    <Input placeholder={`Regel ${n} — waarde`} value={draft.customJurisdiction?.[`rule${n}value`] || ''} onChange={e => update(`customJurisdiction.rule${n}value`, e.target.value)} />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Tax rules display */}
          <Card className="p-6">
            {(draft.jurisdiction || 'NL') === 'CUSTOM' ? (
              <>
                <h3 className="font-display text-lg font-medium mb-3">⚙️ {t('jur.customTitle')} — {draft.customJurisdiction?.countryName || t('jur.customRules')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    { label: t('jur.taxTypeRow'), value: draft.customJurisdiction?.taxName || '—' },
                    { label: t('jur.standardRateRow'), value: draft.customJurisdiction?.standardRate != null ? `${draft.customJurisdiction.standardRate}%` : '—' },
                    { label: t('currency.title'), value: draft.customJurisdiction?.currency || draft.baseCurrency || 'EUR' },
                    { label: t('jur.filingPeriodRow'), value: draft.customJurisdiction?.filingPeriod === 'monthly' ? t('jur.monthly') : draft.customJurisdiction?.filingPeriod === 'yearly' ? t('jur.yearly') : t('jur.quarterly') },
                    { label: t('jur.filingDeadline'), value: draft.customJurisdiction?.filingDeadline || '—' },
                    { label: t('jur.regThreshold'), value: draft.customJurisdiction?.registrationThreshold || '—' },
                    { label: t('jur.retention'), value: draft.customJurisdiction?.retentionPeriod || '—' },
                    ...[1, 2, 3].filter(n => draft.customJurisdiction?.[`rule${n}label`]).map(n => ({
                      label: draft.customJurisdiction[`rule${n}label`],
                      value: draft.customJurisdiction[`rule${n}value`] || '—',
                    })),
                  ].map((r, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                      <span style={{ color: 'var(--muted)' }}>{r.label}</span>
                      <span className="font-medium text-right">{r.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h3 className="font-display text-lg font-medium mb-3">{t('jur.taxConditions')} — {JURISDICTIONS[draft.jurisdiction || 'NL'].flag} {JURISDICTIONS[draft.jurisdiction || 'NL'].name}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {JURISDICTIONS[draft.jurisdiction || 'NL'].rules.map((r, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
                      <span style={{ color: 'var(--muted)' }}>{r.label}</span>
                      <span className="font-medium text-right">{r.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="text-xs mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              {t('jur.taxRulesNote')}
            </div>
          </Card>

          {/* Currency settings */}
          <Card className="p-6 space-y-4">
            <h3 className="font-display text-lg font-medium">{t('currency.title')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label={t('currency.baseLabel')} value={draft.baseCurrency || 'EUR'} onChange={e => update('baseCurrency', e.target.value)}>
                {SUPPORTED_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
              </Select>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>{t('currency.activeCurrencies')}</label>
                <div className="flex gap-1 flex-wrap">
                  {SUPPORTED_CURRENCIES.map(c => {
                    const active = (draft.enabledCurrencies || []).includes(c.code);
                    return (
                      <button
                        key={c.code}
                        onClick={() => {
                          const list = draft.enabledCurrencies || [];
                          const next = active ? list.filter(x => x !== c.code) : [...list, c.code];
                          update('enabledCurrencies', next);
                        }}
                        className="px-3 py-2 text-xs font-medium rounded border"
                        style={{
                          background: active ? 'var(--accent)' : 'var(--surface-2)',
                          color: active ? 'var(--btn-primary-text)' : 'var(--text-2)',
                          borderColor: active ? 'var(--accent)' : 'var(--border-2)',
                        }}
                      >
                        {c.symbol} {c.code}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="rounded-md p-3 text-xs flex items-start gap-2" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
              <RefreshCw size={14} className="mt-0.5 shrink-0" />
              <div>
                {t('currency.exchangeNote')}
              </div>
            </div>
            {draft.exchangeRates?.fetched && (
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                {t('currency.lastFetched')} {fmtDate(draft.exchangeRates.fetched)} ({draft.exchangeRates.base})
              </div>
            )}
          </Card>
        </div>
      )}

      {section === 'templates' && (
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <Wand2 size={18} style={{ color: 'var(--accent)' }} />
              <div className="text-xs leading-relaxed flex-1" style={{ color: 'var(--ink-2)' }}>
                <strong>{t('tmpl.chooseFor')} {activeEntity?.name}</strong>
                <div className="mt-1" style={{ color: 'var(--muted)' }}>
                  {t('tmpl.switchHint')}
                </div>
              </div>
            </div>
          </Card>
          {activeEntity && (
            <TemplateGallery
              entity={activeEntity}
              onUpdate={async (updatedEntity) => {
                await setEntities(prev => prev.map(e => e.id === updatedEntity.id ? updatedEntity : e));
              }}
              sampleInvoice={{
                number: (activeEntity.invoicePrefix || '2026-') + '0042',
                issueDate: todayISO(),
                dueDate: addDays(todayISO(), 14),
                reference: 'Q1 retainer',
                notes: 'Hartelijk dank voor de samenwerking.',
                items: [
                  { description: 'Strategie consult — Q1 sprint', quantity: 8, price: 125, btwRate: 21, discount: null },
                  { description: 'Implementatie API integratie', quantity: 12, price: 95, btwRate: 21, discount: { type: 'percent', value: 10, name: 'Vroege boeking' } },
                  { description: 'Documentatie + handover', quantity: 3, price: 75, btwRate: 21, discount: null },
                ],
              }}
              sampleClient={clients?.[0] || { name: 'Voorbeeld B.V.', contactName: 'Jan Janssen', address: 'Hoofdstraat 12', postal: '1234 AB', city: 'Amsterdam', country: 'Nederland', btw: 'NL999999999B01' }}
            />
          )}
        </div>
      )}

      {section === 'ai' && (
        <Card className="p-6 space-y-5">
          <div>
            <h3 className="font-display text-lg mb-2 font-medium">{t('ai.settingsTitle')}</h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {t('ai.settingsDesc')}
            </p>
          </div>
          <div className="rounded-md p-3 text-xs" style={{ background: 'var(--accent-soft)', color: 'var(--ink-2)', border: '1px solid var(--border-2)' }}>
            {t('ai.keyNote')}
          </div>
          <Input
            label="Anthropic API key (Claude)"
            type="password"
            value={draft.apiKey || ''}
            onChange={e => update('apiKey', e.target.value)}
            placeholder="sk-ant-..."
            hint="console.anthropic.com → API keys"
          />
          <Input
            label="OpenAI API key (GPT)"
            type="password"
            value={draft.openaiApiKey || ''}
            onChange={e => update('openaiApiKey', e.target.value)}
            placeholder="sk-..."
            hint="platform.openai.com → API keys"
          />
          {(draft.apiKey || draft.openaiApiKey) && (
            <div className="rounded-md p-3 text-xs flex items-center gap-2" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              <CheckCircle2 size={13} />
              {t('ai.activeLabel')} {draft.apiKey && detectProvider(draft.apiKey) === 'anthropic' ? 'Anthropic (Claude)' : draft.openaiApiKey ? 'OpenAI (GPT)' : '—'}
            </div>
          )}
          <div className="rounded-md p-3 text-xs flex items-start gap-2" style={{ background: 'var(--warning-soft)', color: 'var(--ink-2)' }}>
            <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
            <div>
              {t('ai.keyPrivacy')}
            </div>
          </div>
        </Card>
      )}

      {section === 'integraties' && (
        <IntegratiesSection importTokenActive={importTokenActive} generateImportToken={generateImportToken} />
      )}

      {section === 'reminders' && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-medium">{t('settings.reminders')}</h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.reminders.enabled}
                onChange={e => update('reminders.enabled', e.target.checked)}
                className="w-4 h-4"
              />
              <span>{t('rem.autoEnabled')}</span>
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--ink-2)' }}>{t('rem.schema')}</label>
            <div className="grid grid-cols-3 gap-3">
              {draft.reminders.schedule.map((days, idx) => (
                <Input
                  key={idx}
                  type="number"
                  value={days}
                  onChange={e => {
                    const sched = [...draft.reminders.schedule];
                    sched[idx] = Number(e.target.value);
                    update('reminders.schedule', sched);
                  }}
                  hint={`${t('rem.reminderN')} ${idx + 1}`}
                />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>{t('rem.templates')}</h4>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Variabelen: <code>{'{{number}}'}</code> <code>{'{{contact}}'}</code> <code>{'{{amount}}'}</code> <code>{'{{date}}'}</code> <code>{'{{dueDate}}'}</code> <code>{'{{iban}}'}</code> <code>{'{{senderName}}'}</code>
            </p>
            {draft.reminders.templates.map((tmpl, idx) => (
              <Card key={idx} className="p-4 space-y-3" style={{ background: 'var(--surface-2)' }}>
                <Input label={`Template ${idx + 1} ${t('rem.templateName')}`} value={tmpl.name} onChange={e => {
                  const t = [...draft.reminders.templates];
                  t[idx] = { ...t[idx], name: e.target.value };
                  update('reminders.templates', t);
                }} />
                <Input label={t('rem.subject')} value={tmpl.subject} onChange={e => {
                  const t = [...draft.reminders.templates];
                  t[idx] = { ...t[idx], subject: e.target.value };
                  update('reminders.templates', t);
                }} />
                <Textarea label={t('rem.message')} rows={5} value={tmpl.body} onChange={e => {
                  const t = [...draft.reminders.templates];
                  t[idx] = { ...t[idx], body: e.target.value };
                  update('reminders.templates', t);
                }} />
              </Card>
            ))}
          </div>
        </Card>
      )}

      {section === 'email' && (
        <div className="space-y-5">
          <Card className="p-6 space-y-5">
            <h3 className="font-display text-lg font-medium">{t('email.settingsTitle')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('email.fromName')} value={draft.email.fromName} onChange={e => update('email.fromName', e.target.value)} />
              <Input label={t('email.fromEmail')} value={draft.email.fromEmail} onChange={e => update('email.fromEmail', e.target.value)} placeholder="paul@denhartoghsolutions.com" />
            </div>
            <Input
              label={t('email.resendKey')}
              type="password"
              value={draft.email.resendApiKey || ''}
              onChange={e => update('email.resendApiKey', e.target.value)}
              placeholder="re_..."
              hint={t('email.resendHint')}
            />
            <Input label={t('email.invoiceSubject')} value={draft.email.invoiceSubject} onChange={e => update('email.invoiceSubject', e.target.value)} />
            <Textarea label={t('email.invoiceBody')} rows={5} value={draft.email.invoiceBody} onChange={e => update('email.invoiceBody', e.target.value)} />
          </Card>

          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--success-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={16} style={{ color: 'var(--success)' }} />
              </div>
              <div>
                <h3 className="font-display text-lg font-medium">WhatsApp</h3>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{t('email.waSubtitle')}</p>
              </div>
            </div>
            <Input
              label={t('email.waNumber')}
              value={draft.email.whatsappNumber || ''}
              onChange={e => update('email.whatsappNumber', e.target.value)}
              placeholder="+31612345678"
              hint={t('email.waNumberHint')}
            />
            <Textarea
              label={t('email.waMessage')}
              rows={4}
              value={draft.email.whatsappMessage || ''}
              onChange={e => update('email.whatsappMessage', e.target.value)}
              hint="Variabelen: {{contact}} {{number}} {{amount}} {{dueDate}} {{iban}}"
            />
            <div className="rounded-md p-3 text-xs flex items-start gap-2" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
              <MessageSquare size={13} className="mt-0.5 shrink-0" />
              <div>{t('email.waNote')}</div>
            </div>
          </Card>
        </div>
      )}

      {section === 'categories' && (
        <Card className="p-6 space-y-4">
          <h3 className="font-display text-lg font-medium">{t('cat.title')}</h3>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('cat.desc')}</p>
          <div className="space-y-2">
            {draft.categories.map((cat, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  className="flex-1"
                  value={cat}
                  onChange={e => {
                    const cs = [...draft.categories];
                    cs[idx] = e.target.value;
                    update('categories', cs);
                  }}
                />
                <button onClick={() => update('categories', draft.categories.filter((_, i) => i !== idx))} className="p-2 rounded hover:bg-[color:var(--danger-soft)]" title="Verwijderen">
                  <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                </button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => update('categories', [...draft.categories, ''])}>
              <Plus size={12} /> {t('cat.add')}
            </Button>
          </div>
        </Card>
      )}

      {section === 'credit' && (
        <div className="space-y-5">
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-medium">{t('credit.title')}</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{t('credit.desc')}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.creditManagement?.enabled ?? true} onChange={e => update('creditManagement.enabled', e.target.checked)} className="w-4 h-4" />
                <span>{t('credit.enabled')}</span>
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label={t('credit.escalationThreshold')}
                type="number"
                min="1"
                value={draft.creditManagement?.latePaymentThreshold ?? 3}
                onChange={e => update('creditManagement.latePaymentThreshold', Number(e.target.value))}
                hint={t('credit.escalationHint')}
              />
              <Input
                label={t('credit.highValueThreshold')}
                type="number"
                min="0"
                value={draft.creditManagement?.highValueThreshold ?? 5000}
                onChange={e => update('creditManagement.highValueThreshold', Number(e.target.value))}
                hint={t('credit.highValueHint')}
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="font-display text-lg font-medium">{t('credit.collectorTitle')}</h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>{t('credit.collectorDesc')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('credit.collectorName')} value={draft.creditManagement?.debtCollector?.name || ''} onChange={e => update('creditManagement.debtCollector.name', e.target.value)} placeholder="Jan de Vries" />
              <Input label={t('credit.collectorCompany')} value={draft.creditManagement?.debtCollector?.company || ''} onChange={e => update('creditManagement.debtCollector.company', e.target.value)} placeholder="Incasso Groep BV" />
              <Input label={t('credit.collectorEmail')} type="email" value={draft.creditManagement?.debtCollector?.email || ''} onChange={e => update('creditManagement.debtCollector.email', e.target.value)} placeholder="incasso@bureau.nl" />
              <Input label={t('credit.collectorPhone')} value={draft.creditManagement?.debtCollector?.phone || ''} onChange={e => update('creditManagement.debtCollector.phone', e.target.value)} placeholder="+31 20 123 4567" />
              <Input label={t('credit.collectorWebsite')} value={draft.creditManagement?.debtCollector?.website || ''} onChange={e => update('creditManagement.debtCollector.website', e.target.value)} placeholder="https://incasso.nl" />
            </div>
            <div>
              <Textarea
                label={t('credit.collectorNotes')}
                rows={3}
                value={draft.creditManagement?.debtCollector?.notes || ''}
                onChange={e => update('creditManagement.debtCollector.notes', e.target.value)}
                placeholder={t('credit.collectorNotesPlaceholder')}
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="font-display text-lg font-medium">{t('credit.aiCheckTitle')}</h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {t('credit.aiCheckDesc')}
            </p>
            <Input
              label={t('credit.graydonKey')}
              type="password"
              value={draft.creditManagement?.graydonApiKey || ''}
              onChange={e => update('creditManagement.graydonApiKey', e.target.value)}
              placeholder="graydon_live_..."
              hint={t('credit.graydonHint')}
            />
            <div className="rounded-md p-3 text-xs flex items-start gap-2" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <div>{t('credit.navHint')}</div>
            </div>
          </Card>
        </div>
      )}

      {section === 'status' && (() => {
        const hasAiKey = !!(import.meta.env.VITE_ANTHROPIC_API_KEY || import.meta.env.VITE_OPENAI_API_KEY || draft.apiKey || draft.openaiApiKey);
        const hasEmail = !!(draft.email?.fromEmail);
        const hasResend = !!(draft.email?.resendApiKey);
        const hasWhatsApp = !!(draft.email?.whatsappNumber);
        const { isSupabaseConfigured: sbOk } = { isSupabaseConfigured: true }; // checked at runtime

        const StatusRow = ({ label, ok, okText, failText, action }) => (
          <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? 'var(--success)' : 'var(--danger)', boxShadow: ok ? '0 0 6px var(--success)' : 'none', flexShrink: 0 }} />
              <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs mt-0.5" style={{ color: ok ? 'var(--success)' : 'var(--danger)' }}>{ok ? okText : failText}</div>
              </div>
            </div>
            {action && (
              <button onClick={action.onClick} className="text-xs px-3 py-1.5 rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--border-2)' }}>
                {action.label}
              </button>
            )}
          </div>
        );

        return (
          <div className="space-y-5">
            <Card className="p-6">
              <h3 className="font-display text-lg font-medium mb-1">{t('status.title')}</h3>
              <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>{t('status.desc')}</p>
              <div>
                <StatusRow
                  label="AI (Anthropic / OpenAI)"
                  ok={hasAiKey}
                  okText={`API key geconfigureerd (${resolveApiKey(draft.apiKey, draft.openaiApiKey) ? (detectProvider(resolveApiKey(draft.apiKey, draft.openaiApiKey)) === 'openai' ? 'OpenAI' : 'Anthropic') : 'env var'})`}
                  failText={t('status.aiMissing')}
                  action={!hasAiKey ? { label: t('status.configure'), onClick: () => setSection('ai') } : null}
                />
                <StatusRow
                  label="Email verzending (Resend)"
                  ok={hasResend}
                  okText={`Resend API key aanwezig${hasEmail ? ` · afzender: ${draft.email.fromEmail}` : ''}`}
                  failText={t('status.resendMissing')}
                  action={!hasResend ? { label: t('status.configure'), onClick: () => setSection('email') } : null}
                />
                <StatusRow
                  label={t('status.emailLabel')}
                  ok={hasEmail}
                  okText={draft.email.fromEmail}
                  failText={t('status.emailMissing')}
                  action={!hasEmail ? { label: t('status.configure'), onClick: () => setSection('email') } : null}
                />
                <StatusRow
                  label="WhatsApp"
                  ok={hasWhatsApp}
                  okText={`${t('status.waSetOnNumber')} ${draft.email.whatsappNumber}`}
                  failText={t('status.waMissing')}
                  action={!hasWhatsApp ? { label: t('status.configure'), onClick: () => setSection('email') } : null}
                />
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="font-display text-lg font-medium">{t('status.quickActions')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: t('status.aiSetup'), icon: Brain, onClick: () => setSection('ai'), ok: hasAiKey },
                  { label: t('status.emailSetup'), icon: Mail, onClick: () => setSection('email'), ok: hasEmail && hasResend },
                  { label: t('status.waSetup'), icon: MessageSquare, onClick: () => setSection('email'), ok: hasWhatsApp },
                ].map(a => (
                  <button key={a.label} onClick={a.onClick} className="p-4 rounded-lg border text-left transition-all hover:opacity-80"
                    style={{ borderColor: a.ok ? 'var(--success)' : 'var(--border-2)', background: a.ok ? 'var(--success-soft)' : 'var(--surface-2)' }}>
                    <a.icon size={18} style={{ color: a.ok ? 'var(--success)' : 'var(--accent)', marginBottom: 8 }} />
                    <div className="text-sm font-medium">{a.label}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{a.ok ? t('status.configured') : t('status.needsSetup')}</div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        );
      })()}

      {section === 'appearance' && (
        <div className="space-y-5">
          <Card className="p-6 space-y-5">
            <h3 className="font-display text-lg font-medium">{t('settings.appearance')}</h3>
            <div className="space-y-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{t('settings.language')}</label>
              <div className="mt-1">
                <Segmented
                  options={Object.entries(LANGUAGES).map(([code, name]) => ({ id: code, label: name }))}
                  value={lang}
                  onChange={setLang}
                />
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                {t('settings.languageHint')}
              </p>
              <p className="text-xs" style={{ color: 'var(--success)' }}>
                {t('settings.langSavedImmediately')}
              </p>
            </div>
          </Card>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP
// ============================================================================
// ============================================================================
// EMAIL AGENT (VOORGESORTEERD — nog niet actief)
// ----------------------------------------------------------------------------
// Wanneer je de Gmail-koppeling activeert (via Make.com of native Supabase
// Edge Function), stuurt die service POST-requests naar een webhook met dit
// data-formaat. De storage-keys hieronder zijn al gereserveerd zodat je
// alleen de webhook hoeft te schrijven die `pending_email_expenses` vult.
//
// Verwacht expense-object (zelfde shape als handmatige bonnen, source='email'):
// {
//   id: 'exp_xxx',
//   source: 'email',
//   sourceMeta: { gmailMessageId, fromAddress, subject, receivedAt },
//   status: 'open',                       // wacht op review
//   image: dataUrl,                       // PDF-attachment als base64
//   vendor: 'Anthropic',                  // geëxtraheerd door Claude/OCR
//   date: '2026-05-12',
//   currency: 'USD',
//   originalAmount: 50.00,
//   exchangeRate: null,                   // wordt opgehaald bij review
//   amount: 0,                            // berekend bij review
//   btwAmount: 0,
//   btwRate: 0,
//   category: 'Software/SaaS',
//   ledgerAccount: '4420',                // suggestLedgerAccount() heeft al gedraaid
//   notes: 'Auto-geëxtraheerd uit Gmail',
// }
//
// Implementatie-pad:
//   1. Supabase Edge Function `inbox-webhook` (verify_jwt=false, HMAC check)
//   2. Make.com scenario: Gmail "Inkoop facturen" label → HTTP POST → webhook
//   3. In webhook: parse PDF/image, call Claude Haiku met JSON schema, insert
//      naar `expenses` tabel met source='email', suggest ledger via vendor match
//   4. Frontend polled `pending_email_expenses` storage key (of realtime sub)
// ============================================================================
// KOPPELINGEN VIEW
// ============================================================================
const LINKS = [
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description: 'Boekhoudsoftware — klanten, facturen, btw-aangifte en rapportages.',
    url: 'https://app.qbo.intuit.com',
    color: '#2CA01C',
    category: 'Boekhouding',
    icon: () => (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <rect width="40" height="40" rx="8" fill="#2CA01C"/>
        <path d="M20 8C13.373 8 8 13.373 8 20s5.373 12 12 12 12-5.373 12-12S26.627 8 20 8zm0 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm-3 4v8l7-4-7-4z" fill="white"/>
      </svg>
    ),
  },
  {
    id: 'revolut',
    name: 'Revolut Business',
    description: 'Zakelijke bankrekening — betalingen, valutawissels en kaartbeheer.',
    url: 'https://business.revolut.com',
    color: '#191C1F',
    category: 'Bankieren',
    icon: () => (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <rect width="40" height="40" rx="8" fill="#191C1F"/>
        <path d="M13 10h9.5c3.038 0 5.5 2.462 5.5 5.5 0 2.1-1.18 3.93-2.92 4.87L28 30h-4.5l-2.67-8.75H17V30h-4V10zm4 3.5v4.75h5.5c1.105 0 2-.895 2-2s-.895-2.75-2-2.75H17z" fill="white"/>
      </svg>
    ),
  },
  {
    id: 'belastingdienst',
    name: 'Mijn Belastingdienst Zakelijk',
    description: 'BTW-aangifte doen, correspondentie bekijken en teruggaven opvolgen.',
    url: 'https://mijn.belastingdienst.nl/mbd-pmb/',
    color: '#154273',
    category: 'Belasting',
    icon: () => (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <rect width="40" height="40" rx="8" fill="#154273"/>
        <path d="M20 9l10 5v7c0 5.25-4.25 10.15-10 11.35C14.25 31.15 10 26.25 10 21v-7l10-5z" fill="white" fillOpacity="0.9"/>
        <path d="M16 20l3 3 5-5" stroke="#154273" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'kvk',
    name: 'Mijn KVK',
    description: 'Uittreksel ophalen, gegevens wijzigen en UBO-registratie beheren.',
    url: 'https://mijn.kvk.nl',
    color: '#E86700',
    category: 'Overheid',
    icon: () => (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <rect width="40" height="40" rx="8" fill="#E86700"/>
        <rect x="11" y="18" width="18" height="12" rx="1.5" fill="white" fillOpacity="0.9"/>
        <rect x="15" y="11" width="10" height="9" rx="1.5" fill="white" fillOpacity="0.7"/>
        <rect x="17" y="22" width="6" height="5" rx="1" fill="#E86700"/>
      </svg>
    ),
  },
  {
    id: 'ahasend',
    name: 'AhaSend',
    description: 'Transactionele e-mail — facturen en herinneringen versturen via SMTP/API.',
    url: 'https://ahasend.com',
    color: '#6366F1',
    category: 'E-mail',
    icon: () => (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <rect width="40" height="40" rx="8" fill="#6366F1"/>
        <path d="M10 14l10 8 10-8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <rect x="10" y="13" width="20" height="14" rx="2" stroke="white" strokeWidth="2" fill="none"/>
      </svg>
    ),
  },
  {
    id: 'anthropic',
    name: 'Anthropic Console',
    description: 'API-sleutels beheren, gebruik monitoren en Claude-modellen verkennen.',
    url: 'https://console.anthropic.com',
    color: '#CC785C',
    category: 'AI',
    icon: () => (
      <svg viewBox="0 0 40 40" fill="none" className="w-8 h-8">
        <rect width="40" height="40" rx="8" fill="#CC785C"/>
        <path d="M20 10l7 20h-3.5l-1.5-4h-4l-1.5 4H13l7-20zm0 5.5l-1.5 7h3l-1.5-7z" fill="white"/>
      </svg>
    ),
  },
];

const LinksView = () => {
  const categories = [...new Set(LINKS.map(l => l.category))];
  return (
    <div className="space-y-8 animate-in">
      <PageHeader title="Koppelingen" sub="Snelle toegang tot externe tools en diensten." />

      {categories.map(cat => (
        <div key={cat}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>{cat}</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {LINKS.filter(l => l.category === cat).map(link => {
              const Icon = link.icon;
              return (
                <Card key={link.id} className="p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <Icon />
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                      {link.category}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-sm mb-1" style={{ color: 'var(--ink)' }}>{link.name}</h3>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>{link.description}</p>
                  </div>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-opacity hover:opacity-80 self-start"
                    style={{ background: 'var(--btn-primary)', color: 'var(--btn-primary-text)' }}
                  >
                    <Globe size={13} />
                    Openen
                  </a>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================

export default function App({ signToken, accountantMode, onAccountantBack }) {
  const { user, profile, organization, signOut, updateProfile, updateOrganization } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settingsOpenSection, setSettingsOpenSection] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('dhs_theme') || 'dark');
  const [settings, setSettings, settingsLoaded] = useCloudStorage('settings', DEFAULT_SETTINGS);
  const [userApiKeys, saveUserApiKeys] = useCloudStorage('userApiKeys', { apiKey: '', openaiApiKey: '' });

  // Import-token voor Make.com: alleen de SHA-256-hash gaat naar de database
  // (user_settings.api_token_hash, migratie v7). Het token zelf wordt één keer getoond.
  const generateImportToken = async () => {
    if (!user?.id) return null
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
    const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
    // org_id en user_id worden server-side afgedwongen (trigger), maar user_id is nodig voor de upsert.
    const { error } = await supabase.from('user_settings').upsert(
      { user_id: user.id, api_token_hash: hash, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    if (error) {
      alert(`Token aanmaken mislukt: ${error.message}`)
      return null
    }
    window.prompt('Je nieuwe API-token. Kopieer hem nu: hij wordt maar één keer getoond en is daarna niet meer op te vragen. Het vorige token werkt niet meer.', token)
    return token
  }

  const effectiveSettings = useMemo(() => ({
    ...settings,
    apiKey: userApiKeys.apiKey || '',
    openaiApiKey: userApiKeys.openaiApiKey || '',
  }), [settings, userApiKeys]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dhs_theme', theme);
  }, [theme]);
  const [clients, setClients, clientsLoaded] = useCloudStorage('clients', []);
  const [invoices, setInvoices, invoicesLoaded] = useCloudStorage('invoices', []);
  const [expenses, setExpenses, expensesLoaded] = useCloudStorage('expenses', []);
  const [entities, setEntities, entitiesLoaded] = useCloudStorage('entities', []);
  const [quotes, setQuotes, quotesLoaded] = useCloudStorage('quotes', []);
  const [horizonData, setHorizonData, horizonDataLoaded] = useCloudStorage('horizonData', {});
  const [boekAssets, setBoekAssets] = useCloudStorage('boek_assets', []);
  const [boekEntries, setBoekEntries] = useCloudStorage('boek_entries', []);
  const [bankTransactions, setBankTransactions] = useCloudStorage('bank_transactions', []);
  const [purchaseInvoices, setPurchaseInvoices, purchaseInvoicesLoaded] = useCloudStorage('purchase_invoices', []);
  const [reminderModal, setReminderModal] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [invoiceIntent, setInvoiceIntent] = useState(null); // { type: 'open'|'new', id?, nonce }

  // ⌘K / Ctrl+K opent het commandopalet
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const loaded = settingsLoaded && clientsLoaded && invoicesLoaded && expensesLoaded && entitiesLoaded && quotesLoaded && horizonDataLoaded && purchaseInvoicesLoaded;
  const openCount = expenses.filter(e => e.status === 'open').length;

  // MIGRATION: if no entities yet, create one from settings.company
  useEffect(() => {
    if (!loaded) return;
    if (entities.length === 0) {
      const firstEntity = createDefaultEntity(settings);
      setEntities([firstEntity]);
      setSettings({ ...settings, activeEntityId: firstEntity.id });
      // Backfill entityId on existing invoices/expenses
      if (invoices.some(i => !i.entityId)) {
        setInvoices(invoices.map(i => i.entityId ? i : { ...i, entityId: firstEntity.id }));
      }
      if (expenses.some(e => !e.entityId)) {
        setExpenses(expenses.map(e => e.entityId ? e : { ...e, entityId: firstEntity.id }));
      }
    } else if (!settings.activeEntityId) {
      setSettings({ ...settings, activeEntityId: entities[0].id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const activeEntityId = settings.activeEntityId || entities[0]?.id;
  const activeEntity = entities.find(e => e.id === activeEntityId) || entities[0];

  const handleSendReminder = (invoice, level) => {
    setReminderModal({ invoice, level });
  };

  const confirmReminder = async (invoice, level) => {
    setInvoices(prev => prev.map(i => i.id === invoice.id ? {
      ...i,
      remindersSent: [...(i.remindersSent || []), { date: new Date().toISOString(), level }]
    } : i));
    setReminderModal(null);
  };

  const setActiveEntityId = async (id) => {
    await setSettings({ ...settings, activeEntityId: id });
  };

  if (!loaded || !activeEntity) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }} data-theme={theme}>
        <ThemeStyles />
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'linear-gradient(135deg, #4f46e5, #1e1b8b)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 14px rgba(79,70,229,0.45)' }}>
            <svg width="21" height="21" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 4.5C10 4.5 7 4 3.5 4.5C2.7 4.6 2 5.3 2 6.1V15.5C5.5 14.5 10 15.5 10 15.5V4.5Z" fill="rgba(255,255,255,0.18)" stroke="white" strokeWidth="1.1" strokeLinejoin="round"/>
              <path d="M10 4.5C10 4.5 13 4 16.5 4.5C17.3 4.6 18 5.3 18 6.1V15.5C14.5 14.5 10 15.5 10 15.5V4.5Z" fill="rgba(255,255,255,0.1)" stroke="white" strokeWidth="1.1" strokeLinejoin="round"/>
              <line x1="10" y1="4" x2="10" y2="16" stroke="white" strokeWidth="1" strokeOpacity="0.4"/>
              <line x1="3.5" y1="8" x2="8.5" y2="7.5" stroke="white" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.9"/>
              <line x1="3.5" y1="10.5" x2="8.5" y2="10" stroke="white" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.9"/>
              <line x1="3.5" y1="13" x2="7" y2="12.7" stroke="white" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.55"/>
              <line x1="11.5" y1="7.5" x2="16.5" y2="8" stroke="white" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.9"/>
              <line x1="11.5" y1="10" x2="16.5" y2="10.5" stroke="white" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.9"/>
              <line x1="13" y1="12.7" x2="16.5" y2="13" stroke="white" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.55"/>
            </svg>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-3)' }}>Laden…</div>
        </div>
      </div>
    );
  }

  // Filter data by active entity (for views that are entity-scoped)
  const entityInvoices = invoices.filter(i => !i.entityId || i.entityId === activeEntityId);
  const entityExpenses = expenses.filter(e => !e.entityId || e.entityId === activeEntityId);
  const entityPurchaseInvoices = purchaseInvoices.filter(i => !i.entityId || i.entityId === activeEntityId);
  // Nieuwe activa/journaalposten krijgen het actieve bedrijf mee (bestaande records blijven ongemoeid).
  const withEntityTag = (setter) => (next) => setter(prev => {
    const resolved = typeof next === 'function' ? next(prev) : next;
    const known = new Set((prev || []).map(x => x.id));
    return (resolved || []).map(x => (!known.has(x.id) && !x.entityId ? { ...x, entityId: activeEntityId } : x));
  });
  const dataIssueCount = findDataIssues({ invoices, expenses, entries: boekEntries, transactions: bankTransactions, clients, purchaseInvoices }).filter(i => i.severity !== 'low').length;

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)', flexDirection: 'column' }} data-theme={theme}>
      <ThemeStyles />
      {accountantMode && onAccountantBack && (
        <div style={{ background: 'var(--accent)', padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', color: '#fff', fontWeight: '500' }}>
            {accountantMode.readOnly ? '👁 Meekijkmodus' : '✏️ Beheersmodus'} — je bekijkt een klantomgeving
          </span>
          <button onClick={onAccountantBack} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', padding: '4px 12px', color: '#fff', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
            ← Terug naar klantoverzicht
          </button>
        </div>
      )}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSearch={() => setPaletteOpen(true)}
        openCount={entityExpenses.filter(e => e.status === 'open').length}
        issueCount={dataIssueCount}
        activeEntity={activeEntity}
        entities={entities}
        onSwitchEntity={setActiveEntityId}
        user={user}
        profile={profile}
        onSignOut={signOut}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        onGoToProfile={() => { setSettingsOpenSection('profile'); setActiveTab('settings'); }}
      />
      <main className="flex-1 min-w-0">
        <div className="max-w-6xl mx-auto p-5 md:p-8 pb-20 lg:pb-8 mobile-main-inner">
          {activeTab === 'dashboard' && (
            <Dashboard invoices={entityInvoices} expenses={entityExpenses} clients={clients} settings={effectiveSettings} activeEntity={activeEntity} setActiveTab={setActiveTab} onSendReminder={handleSendReminder} dataIssueCount={dataIssueCount} />
          )}
          {activeTab === 'invoices' && (
            <InvoicesView intent={invoiceIntent} invoices={entityInvoices} setInvoices={setInvoices} allInvoices={invoices} clients={clients} setClients={setClients} settings={effectiveSettings} setSettings={setSettings} activeEntity={activeEntity} setEntities={setEntities} entities={entities} onSendReminder={handleSendReminder} />
          )}
          {activeTab === 'clients' && (
            <ClientsView clients={clients} setClients={setClients} invoices={invoices} settings={effectiveSettings} />
          )}
          {activeTab === 'expenses' && (
            <ExpensesView expenses={entityExpenses} setExpenses={setExpenses} allExpenses={expenses} settings={effectiveSettings} setSettings={setSettings} activeEntity={activeEntity} />
          )}
          {activeTab === 'inkoop' && (
            <PurchaseInvoicesView
              purchaseInvoices={entityPurchaseInvoices}
              setPurchaseInvoices={setPurchaseInvoices}
              allPurchaseInvoices={purchaseInvoices}
              settings={effectiveSettings}
              activeEntity={activeEntity}
            />
          )}
          {activeTab === 'import' && (
            <ImportView
              setInvoices={setInvoices}
              setExpenses={setExpenses}
              clients={clients}
              settings={effectiveSettings}
              activeEntity={activeEntity}
            />
          )}
          {activeTab === 'entities' && (
            <EntitiesView entities={entities} setEntities={setEntities} activeEntityId={activeEntityId} setActiveEntityId={setActiveEntityId} invoices={invoices} expenses={expenses} />
          )}
          {activeTab === 'tax' && (
            <TaxReportView invoices={entityInvoices} expenses={entityExpenses} setExpenses={setExpenses} clients={clients} settings={effectiveSettings} activeEntity={activeEntity} />
          )}
          {activeTab === 'ai' && (
            <AIAdvisorView entities={entities} activeEntity={activeEntity} invoices={invoices} expenses={expenses} clients={clients} settings={effectiveSettings} />
          )}
          {(activeTab === 'quotes' || signToken) && (
            <QuotesView
              quotes={quotes} setQuotes={setQuotes}
              clients={clients} settings={effectiveSettings} activeEntity={activeEntity}
              signToken={signToken}
              onConvertToInvoice={(inv) => {
                // Zelfde nummerreeks als gewone facturen (voorheen "FACT-…" buiten de reeks om)
                const next = nextInvoiceNumberFor(activeEntity, invoices);
                const newInv = { ...inv, id: generateId('inv'), number: next.number, invoiceNumber: next.number, entityId: activeEntity?.id, remindersSent: [], payments: [], createdAt: new Date().toISOString() };
                setInvoices(prev => [...prev, newInv]);
                setEntities(prev => prev.map(e => e.id === activeEntity?.id ? { ...e, nextInvoiceNumber: next.seq + 1, lastInvoiceYear: next.year } : e));
                if (inv.fromQuoteId) setQuotes(prev => prev.map(q => q.id === inv.fromQuoteId ? { ...q, convertedToInvoiceId: newInv.id } : q));
                setActiveTab('invoices');
              }}
            />
          )}
          {activeTab === 'boekhouding' && (
            <BoekhoudenView
              invoices={entityInvoices}
              expenses={entityExpenses}
              assets={boekAssets.filter(a => !a.entityId || a.entityId === activeEntityId)}
              setAssets={withEntityTag(setBoekAssets)}
              entries={boekEntries.filter(e => !e.entityId || e.entityId === activeEntityId)}
              setEntries={withEntityTag(setBoekEntries)}
              clients={clients}
              ledgerAccounts={getLedgerAccounts(activeEntity?.jurisdiction || effectiveSettings.jurisdiction || 'NL')}
              transactions={bankTransactions.filter(t => !t.entityId || t.entityId === activeEntityId)}
              purchaseInvoices={entityPurchaseInvoices}
            />
          )}
          {activeTab === 'bank' && (
            <BankView
              transactions={bankTransactions}
              setTransactions={setBankTransactions}
              invoices={entityInvoices}
              setInvoices={setInvoices}
              expenses={entityExpenses}
              allExpenses={expenses}
              setExpenses={setExpenses}
              entries={boekEntries}
              setEntries={setBoekEntries}
              clients={clients}
              settings={effectiveSettings}
              activeEntity={activeEntity}
              callAI={callAI}
              suggestLedgerAccount={suggestLedgerAccount}
              getLedgerAccounts={getLedgerAccounts}
              jurisdictionInfo={JURISDICTIONS[activeEntity?.jurisdiction || effectiveSettings.jurisdiction || 'NL']}
            />
          )}
          {activeTab === 'horizonplanner' && (
            <HorizonPlanner
              invoices={entityInvoices}
              expenses={entityExpenses}
              clients={clients}
              horizonData={horizonData}
              setHorizonData={setHorizonData}
            />
          )}
          {activeTab === 'admin' && profile?.role === 'org_owner' && (
            <OrgUsersView profile={profile} />
          )}
          {activeTab === 'credit' && (
            <CreditManagementView
              clients={clients}
              invoices={entityInvoices}
              settings={effectiveSettings}
              entity={activeEntity}
              onSendReminder={handleSendReminder}
            />
          )}
          {activeTab === 'structuur' && <StructuurView />}
          {activeTab === 'controle' && (
            <DataCheckView invoices={invoices} setInvoices={setInvoices} expenses={expenses} setExpenses={setExpenses} entries={boekEntries} setEntries={setBoekEntries} transactions={bankTransactions} setTransactions={setBankTransactions} clients={clients} purchaseInvoices={purchaseInvoices} setPurchaseInvoices={setPurchaseInvoices} />
          )}
          {activeTab === 'links' && (
            <LinksView />
          )}
          {activeTab === 'settings' && (
            <SettingsView settings={effectiveSettings} setSettings={setSettings} activeEntity={activeEntity} entities={entities} setEntities={setEntities} clients={clients} initialSection={settingsOpenSection} updateProfile={updateProfile} profile={profile} user={user} organization={organization} updateOrganization={updateOrganization} saveUserApiKeys={saveUserApiKeys} generateImportToken={generateImportToken} importTokenActive={userApiKeys.importTokenActive} />
          )}
        </div>
      </main>

      <SyncIndicator />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        invoices={entityInvoices}
        clients={clients}
        expenses={entityExpenses}
        actions={[
          { id: 'new_invoice', label: 'Nieuwe factuur maken', icon: Plus, run: { type: 'newInvoice' } },
          { id: 'new_receipt', label: 'Bon uploaden', icon: Camera, run: { type: 'nav', tab: 'expenses' } },
          { id: 'bank_import', label: 'Bankafschrift importeren', icon: Landmark, run: { type: 'nav', tab: 'bank' } },
          { id: 'vat', label: 'BTW-aangifte dit kwartaal', icon: FileBarChart, run: { type: 'nav', tab: 'tax' } },
          { id: 'check', label: 'Data-controle uitvoeren', icon: ScanSearch, run: { type: 'nav', tab: 'controle' } },
          { id: 'theme', label: theme === 'dark' ? 'Lichte weergave' : 'Donkere weergave', icon: theme === 'dark' ? Sun : Moon, run: { type: 'theme' } },
        ]}
        navItems={[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'invoices', label: 'Facturen', icon: FileText },
          { id: 'quotes', label: 'Offertes', icon: FileCheck2 },
          { id: 'clients', label: 'Klanten', icon: Users },
          { id: 'expenses', label: 'Bonnen & kosten', icon: ReceiptIcon },
          { id: 'inkoop', label: 'Inkoopfacturen', icon: ShoppingCart },
          { id: 'bank', label: 'Bank', icon: Landmark },
          { id: 'boekhouding', label: 'Boekhouding', icon: BookOpen },
          { id: 'tax', label: 'Aangifte', icon: FileBarChart },
          { id: 'structuur', label: 'Structuur & plan (Zwitserland, LLC, Stripe)', icon: Compass },
          { id: 'settings', label: 'Instellingen', icon: SettingsIcon },
        ]}
        onRun={(r) => {
          if (r.type === 'nav') setActiveTab(r.tab);
          else if (r.type === 'theme') setTheme(t => t === 'dark' ? 'light' : 'dark');
          else if (r.type === 'newInvoice') { setActiveTab('invoices'); setInvoiceIntent({ type: 'new', nonce: Date.now() }); }
          else if (r.type === 'invoice') { setActiveTab('invoices'); setInvoiceIntent({ type: 'open', id: r.id, nonce: Date.now() }); }
        }}
      />
      {reminderModal && (
        <SendInvoiceModal
          invoice={reminderModal.invoice}
          client={clients.find(c => c.id === reminderModal.invoice.clientId)}
          settings={effectiveSettings}
          mode="reminder"
          reminderLevel={reminderModal.level}
          onSend={(level) => confirmReminder(reminderModal.invoice, level)}
          onClose={() => setReminderModal(null)}
        />
      )}
      </div>
    </div>
  );
}
