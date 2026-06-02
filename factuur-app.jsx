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
  FileCheck2, ShieldCheck, LogOut, Moon, Sun, Paperclip, ShoppingCart,
} from 'lucide-react';
import { useAuth, useCloudStorage } from './src/AuthProvider';
import OrgUsersView from './src/OrgUsersView';
import QuotesView from './src/QuotesView';
import HorizonPlanner from './src/HorizonPlanner';
import CreditManagementView from './src/CreditManagementView';
import BoekhoudenView from './src/BoekhoudenView';
import ImportView from './src/ImportView';
import PurchaseInvoicesView from './src/PurchaseInvoicesView';
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

    :root {
      --bg: #060b15;
      --bg-alt: #0a1120;
      --surface: #0e1628;
      --surface-2: #131e32;
      --surface-3: #19273f;
      --border: rgba(59,130,246,0.1);
      --border-2: rgba(59,130,246,0.18);
      --border-3: rgba(59,130,246,0.32);
      --border-strong: rgba(59,130,246,0.18);
      --text: #dce8ff;
      --text-2: #7a9cc8;
      --text-3: #3d5c80;
      --accent: #3b82f6;
      --accent-2: #60a5fa;
      --accent-hover: #2563eb;
      --accent-soft: rgba(59,130,246,0.13);
      --accent-glow: rgba(59,130,246,0.25);
      --success: #10b981;
      --success-soft: rgba(16,185,129,0.12);
      --warning: #f59e0b;
      --warning-soft: rgba(245,158,11,0.12);
      --danger: #ef4444;
      --danger-soft: rgba(239,68,68,0.12);
      --info: #06b6d4;
      --info-soft: rgba(6,182,212,0.12);
      /* Legacy aliases */
      --ink: var(--text);
      --ink-2: var(--text-2);
      --muted: var(--text-3);
      --muted-2: #1a2f4a;
    }

    [data-theme="light"] {
      --bg: #f3f7ff;
      --bg-alt: #e8effc;
      --surface: #ffffff;
      --surface-2: #eef3ff;
      --surface-3: #e3ecfd;
      --border: rgba(30,64,175,0.08);
      --border-2: rgba(30,64,175,0.15);
      --border-3: rgba(30,64,175,0.28);
      --border-strong: rgba(30,64,175,0.15);
      --text: #071432;
      --text-2: #395a90;
      --text-3: #7a9cc8;
      --accent: #2563eb;
      --accent-2: #3b82f6;
      --accent-hover: #1d4ed8;
      --accent-soft: rgba(37,99,235,0.09);
      --accent-glow: rgba(37,99,235,0.18);
      --success: #059669;
      --success-soft: rgba(5,150,105,0.1);
      --warning: #d97706;
      --warning-soft: rgba(217,119,6,0.1);
      --danger: #dc2626;
      --danger-soft: rgba(220,38,38,0.1);
      --info: #0891b2;
      --info-soft: rgba(8,145,178,0.1);
      --ink: var(--text);
      --ink-2: var(--text-2);
      --muted: var(--text-3);
      --muted-2: #c0d4f4;
    }

    *, *::before, *::after { box-sizing: border-box; }
    body, html { background: var(--bg); color: var(--text); margin: 0; padding: 0; }
    * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .num { font-family: 'JetBrains Mono', monospace; font-feature-settings: 'tnum' 1, 'zero' 1; letter-spacing: -0.02em; }
    .font-display { font-family: 'Inter', sans-serif; letter-spacing: -0.03em; }
    .font-body { font-family: 'Inter', sans-serif; }
    .font-mono { font-family: 'JetBrains Mono', monospace; }

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

const todayISO = () => new Date().toISOString().split('T')[0];

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

const computeInvoice = (items = []) => {
  let subtotal = 0;
  let totalDiscount = 0;
  const btwByRate = {};
  items.forEach((it) => {
    const lineBase = Number(it.quantity || 0) * Number(it.price || 0);
    let lineDiscount = 0;
    if (it.discount && Number(it.discount.value) > 0) {
      lineDiscount = it.discount.type === 'percent'
        ? lineBase * (Number(it.discount.value) / 100)
        : Number(it.discount.value);
    }
    const lineNet = Math.max(0, lineBase - lineDiscount);
    const rate = Number(it.btwRate || 0);
    const lineBtw = lineNet * (rate / 100);
    subtotal += lineNet;
    totalDiscount += lineDiscount;
    btwByRate[rate] = (btwByRate[rate] || 0) + lineBtw;
  });
  const btwTotal = Object.values(btwByRate).reduce((a, b) => a + b, 0);
  return { subtotal, totalDiscount, btwByRate, btwTotal, total: subtotal + btwTotal };
};

const computeLine = (item) => {
  const base = Number(item.quantity || 0) * Number(item.price || 0);
  let discount = 0;
  if (item.discount && Number(item.discount.value) > 0) {
    discount = item.discount.type === 'percent'
      ? base * (Number(item.discount.value) / 100)
      : Number(item.discount.value);
  }
  return { base, discount, net: Math.max(0, base - discount) };
};

const computeInvoiceStatus = (invoice) => {
  if (invoice.status === 'paid' || invoice.status === 'draft') return invoice.status;
  if (invoice.status === 'sent' && invoice.dueDate && new Date(invoice.dueDate) < new Date(todayISO())) {
    return 'overdue';
  }
  return invoice.status;
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => resolve(e.target.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const resizeImage = async (file, maxWidth = 1400, quality = 0.78) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
    name: 'Den Hartogh Solutions',
    address: '',
    postal: '',
    city: '',
    country: 'Dominican Republic',
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
];

// ============================================================================
// AI HELPER
// Priority: VITE_ANTHROPIC_API_KEY env var → settings.apiKey (fallback)
// Stel in .env.local: VITE_ANTHROPIC_API_KEY=sk-ant-...
// ============================================================================
const resolveApiKey = (settingsKey) =>
  import.meta.env.VITE_ANTHROPIC_API_KEY || settingsKey || null;

const callClaude = async ({ system, prompt, apiKey, maxTokens = 2000 }) => {
  const resolvedKey = resolveApiKey(apiKey);
  const headers = { 'Content-Type': 'application/json' };
  if (resolvedKey) {
    headers['x-api-key'] = resolvedKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  const textBlock = data.content?.find(b => b.type === 'text');
  return textBlock?.text || '';
};

// Vision API — scant bon/factuur foto en retourneert gestructureerde data
const callClaudeVision = async ({ imageDataUrl, apiKey, jurisdiction = 'NL' }) => {
  const resolvedKey = resolveApiKey(apiKey);
  if (!resolvedKey) throw new Error('Geen API key ingesteld. Voeg VITE_ANTHROPIC_API_KEY toe aan .env.local of stel hem in via Instellingen → AI.');
  const base64 = imageDataUrl.split(',')[1];
  const mediaType = imageDataUrl.split(';')[0].split(':')[1] || 'image/jpeg';
  const taxRates = jurisdiction === 'NL' ? '0, 9 or 21' : '0, 16 or 18';
  const taxName = jurisdiction === 'NL' ? 'BTW/VAT' : 'ITBIS';

  const prompt = `You are an expert receipt/invoice data extractor. Analyze this receipt or invoice image carefully.

Return ONLY a valid JSON object with exactly these fields (no markdown, no explanation):
{
  "vendor": "company or store name as printed",
  "date": "YYYY-MM-DD format, or empty string if unclear",
  "total_incl_tax": 0.00,
  "tax_amount": 0.00,
  "tax_rate": 0,
  "currency": "ISO 4217 code"
}

Rules:
- "total_incl_tax": the final total amount INCLUDING tax (the amount the customer pays). If only excl amount shown, add the tax.
- "tax_amount": the tax/VAT/${taxName} amount shown. If not shown, calculate from rate.
- "tax_rate": choose the closest from ${taxRates}. If no tax, use 0.
- "currency": detect from currency symbol (€=EUR, $=USD, £=GBP, RD$=DOP, ¥=JPY). Default to EUR only if truly undetectable.
- All amounts as decimal numbers with a period (not comma).
- If a value is truly unreadable, use 0 or empty string.`;

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
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API error ${response.status}: ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  const text = data.content?.find(b => b.type === 'text')?.text || '';
  // Robust JSON extraction — find the outermost {...} block
  const match = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}/s) || text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Geen JSON gevonden in AI-respons. Probeer een scherpere foto.');
  try {
    return JSON.parse(match[0]);
  } catch {
    throw new Error('AI-respons kon niet worden verwerkt. Probeer opnieuw.');
  }
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
const Button = ({ variant = 'primary', size = 'md', className = '', children, ...props }) => {
  const base = 'inline-flex items-center justify-center gap-2 font-medium transition-all rounded-lg disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base',
  };
  const variants = {
    primary: 'text-white hover:opacity-90 active:scale-[0.98]',
    secondary: 'border hover:opacity-80 active:scale-[0.98]',
    ghost: 'hover:opacity-80',
    danger: 'text-white hover:opacity-90',
    outline: 'border bg-transparent hover:opacity-80',
  };
  const styles = {
    primary: { background: 'var(--accent)', color: '#fff' },
    secondary: { borderColor: 'var(--border-2)', background: 'var(--surface-2)', color: 'var(--text)' },
    ghost: { background: 'transparent', color: 'var(--text-2)' },
    danger: { background: 'var(--danger)' },
    outline: { borderColor: 'var(--border-2)', color: 'var(--text)' },
  };
  return (
    <button
      style={styles[variant]}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

const Input = ({ label, hint, error, className = '', ...props }) => (
  <div className={className}>
    {label && <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)', letterSpacing: '0.03em' }}>{label}</label>}
    <input
      {...props}
      className="w-full px-3 py-2.5 text-sm rounded-lg border transition-colors"
      style={{ borderColor: error ? 'var(--danger)' : 'var(--border-2)', background: 'var(--surface)', color: 'var(--text)' }}
    />
    {hint && <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{hint}</p>}
    {error && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{error}</p>}
  </div>
);

const Textarea = ({ label, hint, className = '', rows = 3, ...props }) => (
  <div className={className}>
    {label && <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)', letterSpacing: '0.03em' }}>{label}</label>}
    <textarea
      rows={rows}
      {...props}
      className="w-full px-3 py-2.5 text-sm rounded-lg border transition-colors resize-none"
      style={{ borderColor: 'var(--border-2)', background: 'var(--surface)', color: 'var(--text)' }}
    />
    {hint && <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>{hint}</p>}
  </div>
);

const Select = ({ label, children, className = '', ...props }) => (
  <div className={className}>
    {label && <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--text-2)', letterSpacing: '0.03em' }}>{label}</label>}
    <select
      {...props}
      className="w-full px-3 py-2.5 text-sm rounded-lg border transition-colors cursor-pointer"
      style={{ borderColor: 'var(--border-2)', background: 'var(--surface)', color: 'var(--text)' }}
    >
      {children}
    </select>
  </div>
);

const Badge = ({ status, children }) => {
  const styles = {
    draft: { background: '#F4F2EC', color: '#6B6359' },
    sent: { background: 'var(--info-soft)', color: 'var(--info)' },
    paid: { background: 'var(--success-soft)', color: 'var(--success)' },
    overdue: { background: 'var(--danger-soft)', color: 'var(--danger)' },
    open: { background: 'var(--warning-soft)', color: 'var(--warning)' },
    processed: { background: 'var(--success-soft)', color: 'var(--success)' },
  };
  const labels = {
    draft: 'Concept',
    sent: 'Verstuurd',
    paid: 'Betaald',
    overdue: 'Te laat',
    open: 'Open',
    processed: 'Verwerkt',
  };
  return (
    <span style={styles[status] || styles.draft} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">
      {children || labels[status] || status}
    </span>
  );
};

const Modal = ({ open, onClose, children, size = 'md' }) => {
  if (!open) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl', full: 'max-w-7xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(26, 22, 18, 0.4)' }} onClick={onClose}>
      <div
        className={`${sizes[size]} w-full bg-white rounded-xl shadow-2xl my-8 animate-slide`}
        onClick={(e) => e.stopPropagation()}
        style={{ border: '1px solid var(--border)' }}
      >
        {children}
      </div>
    </div>
  );
};

const Card = ({ children, className = '', hover = false, ...props }) => (
  <div
    className={`rounded-xl ${hover ? 'card-hover' : ''} ${className}`}
    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    {...props}
  >
    {children}
  </div>
);

const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="text-center py-16 px-6">
    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <Icon size={22} style={{ color: 'var(--muted)' }} />
    </div>
    <h3 className="font-display text-xl mb-2" style={{ color: 'var(--ink)' }}>{title}</h3>
    <p className="text-sm mb-5 max-w-sm mx-auto" style={{ color: 'var(--muted)' }}>{description}</p>
    {action}
  </div>
);

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
        <span className="text-lg">{typ.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{activeEntity.name}</div>
          <div className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
            {jur.flag} {typ.label}
          </div>
        </div>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--muted)' }} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-xl border z-50 animate-in py-1" style={{ borderColor: 'var(--border-strong)', background: 'var(--surface)' }}>
          <div className="text-[10px] uppercase tracking-wider font-medium px-3 pt-2 pb-1" style={{ color: 'var(--muted)' }}>Actief bedrijf</div>
          {entities.map(e => {
            const t = getEntityType(e.type);
            const j = JURISDICTIONS[e.jurisdiction || 'NL'];
            return (
              <button
                key={e.id}
                onClick={() => { onSwitch(e.id); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:opacity-80 transition-opacity"
              >
                <span className="text-base">{t.icon}</span>
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
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-stone-50 text-left text-sm"
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
const Sidebar = ({ activeTab, setActiveTab, openCount, activeEntity, entities, onSwitchEntity, user, profile, onSignOut, theme, onToggleTheme, onGoToProfile }) => {
  const mainItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Facturen', icon: FileText },
    { id: 'clients', label: 'Klanten', icon: Users },
    { id: 'expenses', label: 'Bonnen', icon: ReceiptIcon, badge: openCount },
    { id: 'inkoop', label: 'Inkoop', icon: ShoppingCart },
    { id: 'quotes', label: 'Offertes/E-Sign', icon: FileCheck2 },
    { id: 'import', label: 'Historisch importeren', icon: Upload },
  ];
  const finItems = [
    { id: 'entities', label: 'Bedrijven', icon: Network },
    { id: 'tax', label: 'BTW & Aangifte', icon: FileBarChart },
    { id: 'boekhouding', label: 'Boekhouding', icon: BookOpen },
    { id: 'horizonplanner', label: 'HorizonPlanner', icon: TrendingUp },
    { id: 'ai', label: 'AI Adviseur', icon: Brain },
    { id: 'credit', label: 'Creditbeheer', icon: ShieldCheck },
    { id: 'links', label: 'Koppelingen', icon: Globe },
  ];
  const accountItems = [
    { id: 'settings', label: 'Instellingen', icon: SettingsIcon },
    ...(profile?.role === 'org_owner' ? [{ id: 'admin', label: 'Gebruikers', icon: Users }] : []),
  ];
  const mobileItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Facturen', icon: FileText },
    { id: 'expenses', label: 'Bonnen', icon: ReceiptIcon, badge: openCount },
    { id: 'quotes', label: 'Offertes/E-Sign', icon: FileCheck2 },
    { id: 'settings', label: 'Meer', icon: SettingsIcon },
  ];

  const NavItem = ({ item }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        onClick={() => setActiveTab(item.id)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '7px 10px', borderRadius: '8px', marginBottom: '1px',
          background: isActive ? 'var(--accent-soft)' : 'transparent',
          border: 'none', cursor: 'pointer',
          borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
          transition: 'all 0.12s ease',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--surface-3)'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icon size={15} style={{ color: isActive ? 'var(--accent)' : 'var(--text-3)', flexShrink: 0 }} />
          <span style={{ fontSize: '13px', fontWeight: isActive ? '600' : '500', color: isActive ? 'var(--accent)' : 'var(--text-2)' }}>
            {item.label}
          </span>
        </span>
        {item.badge > 0 && (
          <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', borderRadius: '10px', background: 'var(--danger)', color: '#fff', minWidth: '18px', textAlign: 'center' }}>
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const Section = ({ label }) => (
    <div style={{ fontSize: '10px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '14px 10px 5px' }}>
      {label}
    </div>
  );

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Lokaal';
  const roleLabel = profile?.role === 'platform_admin' ? 'Platform Admin' : profile?.role === 'org_owner' ? 'Eigenaar' : 'Starter';

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col h-screen sticky top-0"
        style={{ width: '224px', flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
            <div style={{
              width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
              background: 'linear-gradient(135deg, #4f46e5 0%, #1e1b8b 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 3px 10px rgba(79,70,229,0.45)',
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
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

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 8px' }} className="scrollable">
          <Section label="Beheer" />
          {mainItems.map(item => <NavItem key={item.id} item={item} />)}
          <Section label="Financieel" />
          {finItems.map(item => <NavItem key={item.id} item={item} />)}
          <Section label="Account" />
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
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #4f46e5, #818cf8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: '700', color: '#fff',
                boxShadow: '0 2px 6px rgba(79,70,229,0.35)',
              }}>
                {displayName[0].toUpperCase()}
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
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t flex items-center justify-around py-1.5 px-1"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
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
                <span className="absolute top-0.5 right-1" style={{ fontSize: '9px', fontWeight: '700', padding: '1px 4px', borderRadius: '8px', background: 'var(--danger)', color: '#fff', minWidth: 14, textAlign: 'center' }}>
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
const Dashboard = ({ invoices, expenses, clients, settings, activeEntity, setActiveTab, onSendReminder }) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const stats = useMemo(() => {
    const paidThisMonth = invoices.filter(i => i.paidAt && new Date(i.paidAt) >= monthStart);
    const revenue = paidThisMonth.reduce((sum, i) => sum + computeInvoice(i.items).total, 0);
    const expensesThisMonth = expenses.filter(e => e.status === 'processed' && e.date && new Date(e.date) >= monthStart);
    const costs = expensesThisMonth.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const btwOwed = paidThisMonth.reduce((sum, i) => sum + computeInvoice(i.items).btwTotal, 0);
    const btwReclaim = expensesThisMonth.reduce((sum, e) => sum + Number(e.btwAmount || 0), 0);
    const outstanding = invoices.filter(i => i.status === 'sent').reduce((sum, i) => sum + computeInvoice(i.items).total, 0);
    const overdue = invoices.filter(i => computeInvoiceStatus(i) === 'overdue').reduce((sum, i) => sum + computeInvoice(i.items).total, 0);
    const openExpenses = expenses.filter(e => e.status === 'open').length;
    return { revenue, costs, btwOwed, btwReclaim, btwNet: btwOwed - btwReclaim, outstanding, overdue, openExpenses, profit: revenue - costs };
  }, [invoices, expenses]);

  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = d.toLocaleDateString('nl-NL', { month: 'short' });
      const rev = invoices.filter(inv => inv.paidAt && new Date(inv.paidAt) >= d && new Date(inv.paidAt) < next)
        .reduce((s, inv) => s + computeInvoice(inv.items).total, 0);
      const cost = expenses.filter(e => e.status === 'processed' && e.date && new Date(e.date) >= d && new Date(e.date) < next)
        .reduce((s, e) => s + Number(e.amount || 0), 0);
      months.push({ month: label, omzet: rev, kosten: cost });
    }
    return months;
  }, [invoices, expenses]);

  const dueReminders = useMemo(() => {
    if (!settings.reminders.enabled) return [];
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

  const recentInvoices = [...invoices].sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate)).slice(0, 5);
  const openExpensesList = expenses.filter(e => e.status === 'open').slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-medium" style={{ color: 'var(--ink)' }}>{activeEntity?.name || 'Overzicht'}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {activeEntity && (
              <>
                {JURISDICTIONS[activeEntity.jurisdiction || 'NL'].flag} {getEntityType(activeEntity.type).label} ·{' '}
              </>
            )}
            {now.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Omzet', value: fmtEUR(stats.revenue), sub: 'deze maand', icon: TrendingUp, iconColor: '#f97316', accentVar: '#f97316' },
          { label: 'Kosten', value: fmtEUR(stats.costs), sub: `${expenses.filter(e => e.status === 'processed' && e.date && new Date(e.date) >= monthStart).length} bonnen`, icon: Wallet, iconColor: 'var(--danger)', accentVar: '#ef4444' },
          { label: 'BTW saldo', value: fmtEUR(stats.btwNet), sub: stats.btwNet > 0 ? 'Af te dragen' : 'Terug te vorderen', icon: Percent, iconColor: 'var(--warning)', accentVar: '#f59e0b' },
          { label: 'Nettowinst', value: fmtEUR(stats.profit), sub: 'voor belasting', icon: Zap, iconColor: stats.profit >= 0 ? 'var(--success)' : 'var(--danger)', accentVar: stats.profit >= 0 ? '#10b981' : '#ef4444' },
        ].map((k, i) => (
          <Card key={i} className="p-5" style={{ borderTop: `2px solid ${k.accentVar}22` }}>
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] uppercase tracking-[0.08em] font-semibold" style={{ color: 'var(--text-3)' }}>{k.label}</div>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${k.accentVar}18` }}>
                <k.icon size={14} style={{ color: k.iconColor }} />
              </div>
            </div>
            <div className="num font-bold" style={{ fontSize: '22px', color: 'var(--text)', letterSpacing: '-0.03em' }}>{k.value}</div>
            <div className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>{k.sub}</div>
          </Card>
        ))}
      </div>

      {/* Reminders Banner */}
      {dueReminders.length > 0 && (
        <Card className="p-5" style={{ background: 'var(--warning-soft)', borderColor: '#E5C088' }}>
          <div className="flex items-start gap-4">
            <div className="rounded-full p-2" style={{ background: 'rgba(180, 83, 9, 0.15)' }}>
              <Bell size={18} style={{ color: 'var(--warning)' }} />
            </div>
            <div className="flex-1">
              <h3 className="font-medium" style={{ color: 'var(--ink)' }}>
                {dueReminders.length} herinnering{dueReminders.length !== 1 ? 'en' : ''} klaar om te versturen
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--ink-2)' }}>
                Volgens je herinneringsschema staan deze klaar voor verzending.
              </p>
              <div className="mt-3 space-y-2">
                {dueReminders.slice(0, 3).map((d, i) => {
                  const client = clients.find(c => c.id === d.invoice.clientId);
                  return (
                    <div key={i} className="flex items-center justify-between bg-white rounded-md p-3 text-sm" style={{ border: '1px solid var(--border)' }}>
                      <div>
                        <span className="font-mono font-medium">{d.invoice.number}</span>
                        <span className="mx-2" style={{ color: 'var(--muted)' }}>·</span>
                        <span>{client?.name || 'Onbekend'}</span>
                        <span className="ml-2 text-xs" style={{ color: 'var(--warning)' }}>{d.daysOverdue} dagen te laat</span>
                      </div>
                      <Button size="sm" onClick={() => onSendReminder(d.invoice, d.level)}>
                        <Send size={12} /> {settings.reminders.templates[d.level]?.name || `Herinnering ${d.level + 1}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Chart + Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-medium" style={{ color: 'var(--ink)' }}>Omzet & Kosten</h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Laatste 6 maanden</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="omzetGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="kostenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18}/>
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke="rgba(59,130,246,0.08)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--text-3)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--text-3)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, fontSize: 12, color: 'var(--text)' }}
                formatter={(v) => fmtEUR(v)}
              />
              <Area type="monotone" dataKey="omzet" stroke="#1A1612" strokeWidth={2} fill="url(#omzetGrad)" />
              <Area type="monotone" dataKey="kosten" stroke="#7C2D2D" strokeWidth={2} fill="url(#kostenGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--ink)' }}>Openstaand</h3>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Verstuurd</span>
                <span className="font-display text-xl num">{fmtEUR(stats.outstanding)}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Te laat</span>
                <span className="font-display text-xl num" style={{ color: 'var(--danger)' }}>{fmtEUR(stats.overdue)}</span>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium" style={{ color: 'var(--ink)' }}>Bonnen wachten</h3>
              <span className="text-xs num font-medium px-2 py-0.5 rounded" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                {stats.openExpenses}
              </span>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
              {stats.openExpenses === 0 ? 'Geen open bonnen' : 'Te verwerken inkomende bonnen'}
            </p>
            <button
              onClick={() => setActiveTab('expenses')}
              className="text-xs font-medium flex items-center gap-1 hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              Naar bonnen <ChevronRight size={12} />
            </button>
          </Card>
        </div>
      </div>

      {/* Recent invoices + open receipts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-display text-lg font-medium">Recente facturen</h3>
            <button onClick={() => setActiveTab('invoices')} className="text-xs font-medium hover:underline flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              Alles bekijken <ChevronRight size={12} />
            </button>
          </div>
          {recentInvoices.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>Nog geen facturen</div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {recentInvoices.map(inv => {
                const c = clients.find(x => x.id === inv.clientId);
                const total = computeInvoice(inv.items).total;
                const status = computeInvoiceStatus(inv);
                return (
                  <div key={inv.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-medium">{inv.number}</span>
                        <Badge status={status} />
                      </div>
                      <div className="text-sm truncate">{c?.name || '—'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-base num font-medium">{fmtEUR(total)}</div>
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>{fmtDate(inv.issueDate)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-display text-lg font-medium">Open bonnen</h3>
            <button onClick={() => setActiveTab('expenses')} className="text-xs font-medium hover:underline flex items-center gap-1" style={{ color: 'var(--accent)' }}>
              Verwerken <ChevronRight size={12} />
            </button>
          </div>
          {openExpensesList.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: 'var(--muted)' }}>Geen open bonnen</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 p-3">
              {openExpensesList.map(e => (
                <button
                  key={e.id}
                  onClick={() => setActiveTab('expenses')}
                  className="aspect-square rounded-md overflow-hidden border bg-stone-50 relative group"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {e.image ? (
                    <img src={e.image} alt="bon" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-full h-full p-4" style={{ color: 'var(--muted)' }} />
                  )}
                  <div className="absolute top-1 right-1">
                    <Badge status="open" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

// ============================================================================
// CLIENTS VIEW
// ============================================================================
const ClientsView = ({ clients, setClients, invoices }) => {
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');

  const filtered = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  const clientStats = (clientId) => {
    const inv = invoices.filter(i => i.clientId === clientId);
    const total = inv.reduce((s, i) => s + computeInvoice(i.items).total, 0);
    return { count: inv.length, total };
  };

  const handleSave = (data) => {
    if (data.id) {
      setClients(clients.map(c => c.id === data.id ? data : c));
    } else {
      const newClient = { ...data, id: generateId('cli'), createdAt: new Date().toISOString() };
      setClients([...clients, newClient]);
    }
    setEditing(null);
  };

  const handleDelete = (id) => {
    if (invoices.some(i => i.clientId === id)) {
      alert('Kan deze klant niet verwijderen: er zijn nog facturen aan gekoppeld.');
      return;
    }
    if (window.confirm('Klant verwijderen?')) {
      setClients(clients.filter(c => c.id !== id));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-medium">Klanten</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>{clients.length} klant{clients.length !== 1 ? 'en' : ''}</p>
        </div>
        <Button onClick={() => setEditing({})}><Plus size={16} /> Nieuwe klant</Button>
      </div>

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
        <Card>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filtered.map(c => {
              const stats = clientStats(c.id);
              return (
                <div key={c.id} className="px-5 py-4 hover:bg-stone-50 transition-colors flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{c.name}</h3>
                      {c.btw && <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>{c.btw}</span>}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                      {c.contactName && <span>{c.contactName} · </span>}
                      <span>{c.email || 'Geen email'}</span>
                      {c.city && <span> · {c.city}</span>}
                    </div>
                  </div>
                  <div className="hidden md:flex flex-col items-end text-right">
                    <span className="font-display text-base num font-medium">{fmtEUR(stats.total)}</span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{stats.count} factu{stats.count === 1 ? 'ur' : 'ren'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditing(c)} className="p-2 rounded hover:bg-stone-100" title="Bewerken">
                      <Edit3 size={14} style={{ color: 'var(--muted)' }} />
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="p-2 rounded hover:bg-red-50" title="Verwijderen">
                      <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {editing !== null && (
        <ClientForm client={editing} onSave={handleSave} onClose={() => setEditing(null)} />
      )}
    </div>
  );
};

const ClientForm = ({ client, onSave, onClose }) => {
  const [form, setForm] = useState({
    name: '', contactName: '', email: '', address: '', postal: '', city: '', country: 'Nederland',
    btw: '', kvk: '', notes: '', ...client,
  });

  const update = (key, val) => setForm({ ...form, [key]: val });

  return (
    <Modal open onClose={onClose} size="lg">
      <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-display text-2xl">{form.id ? 'Klant bewerken' : 'Nieuwe klant'}</h2>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-stone-100"><X size={16} /></button>
      </div>
      <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto scrollable">
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
// INVOICES VIEW
// ============================================================================
const InvoicesView = ({ invoices, setInvoices, allInvoices, clients, settings, setSettings, activeEntity, setEntities, entities, onSendReminder }) => {
  const [view, setView] = useState({ mode: 'list' });
  const [statusFilter, setStatusFilter] = useState('all');

  const filtered = invoices
    .filter(i => statusFilter === 'all' || computeInvoiceStatus(i) === statusFilter)
    .sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));

  const handleSave = async (invoice) => {
    const allInv = allInvoices || invoices;
    if (invoice.id && allInv.find(i => i.id === invoice.id)) {
      await setInvoices(allInv.map(i => i.id === invoice.id ? invoice : i));
    } else {
      const nextNum = activeEntity?.nextInvoiceNumber || 1;
      const prefix = activeEntity?.invoicePrefix || '2026-';
      const newInv = {
        ...invoice,
        id: generateId('inv'),
        entityId: activeEntity?.id,
        number: invoice.number || `${prefix}${String(nextNum).padStart(4, '0')}`,
        status: invoice.status || 'draft',
        remindersSent: [],
      };
      await setInvoices([...allInv, newInv]);
      if (!invoice.number && activeEntity) {
        await setEntities(entities.map(e => e.id === activeEntity.id ? { ...e, nextInvoiceNumber: nextNum + 1 } : e));
      }
    }
    setView({ mode: 'list' });
  };

  const handleDelete = async (id) => {
    if (window.confirm('Factuur verwijderen? Dit kan niet ongedaan worden gemaakt.')) {
      const allInv = allInvoices || invoices;
      await setInvoices(allInv.filter(i => i.id !== id));
      setView({ mode: 'list' });
    }
  };

  const handleStatusChange = async (id, newStatus, extra = {}) => {
    const allInv = allInvoices || invoices;
    await setInvoices(allInv.map(i => i.id === id ? { ...i, status: newStatus, ...extra } : i));
  };

  const handleDuplicate = (inv) => {
    const newInv = {
      ...inv,
      id: undefined,
      number: undefined,
      status: 'draft',
      sentAt: null,
      paidAt: null,
      remindersSent: [],
      issueDate: todayISO(),
      dueDate: addDays(todayISO(), settings.invoice.paymentTerms),
    };
    setView({ mode: 'edit', invoice: newInv });
  };

  if (view.mode === 'edit') {
    return <InvoiceEditor invoice={view.invoice} clients={clients} settings={settings} activeEntity={activeEntity} onSave={handleSave} onCancel={() => setView({ mode: 'list' })} />;
  }

  if (view.mode === 'view') {
    return <InvoiceDetail
      invoice={view.invoice}
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
    />;
  }

  const paymentTermsForEntity = activeEntity?.paymentTerms || settings.invoice?.paymentTerms || 14;
  const defaultBtw = JURISDICTIONS[activeEntity?.jurisdiction || 'NL'].salesTax.standard;
  const nextPrefix = activeEntity?.invoicePrefix || '';
  const nextNum = activeEntity?.nextInvoiceNumber || 1;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-medium">Facturen</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {invoices.length} factu{invoices.length === 1 ? 'ur' : 'ren'} · Volgend nr: <span className="font-mono">{nextPrefix}{String(nextNum).padStart(4, '0')}</span> · {activeEntity?.name}
          </p>
        </div>
        <Button onClick={() => {
          if (clients.length === 0) { alert('Voeg eerst een klant toe.'); return; }
          setView({ mode: 'edit', invoice: { issueDate: todayISO(), dueDate: addDays(todayISO(), paymentTermsForEntity), items: [{ description: '', quantity: 1, price: 0, btwRate: defaultBtw }] } });
        }}>
          <Plus size={16} /> Nieuwe factuur
        </Button>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap gap-1">
          {[{ id: 'all', label: 'Alles' }, { id: 'draft', label: 'Concept' }, { id: 'sent', label: 'Verstuurd' }, { id: 'overdue', label: 'Te laat' }, { id: 'paid', label: 'Betaald' }].map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className="px-3 py-1.5 text-xs font-medium rounded transition-colors"
              style={{
                background: statusFilter === f.id ? 'var(--ink)' : 'transparent',
                color: statusFilter === f.id ? '#fff' : 'var(--ink-2)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title={statusFilter !== 'all' ? 'Geen facturen met deze status' : 'Nog geen facturen'}
            description={statusFilter !== 'all' ? 'Probeer een ander filter' : 'Maak je eerste factuur aan om te beginnen.'}
            action={statusFilter === 'all' && clients.length > 0 && (
              <Button onClick={() => setView({ mode: 'edit', invoice: { issueDate: todayISO(), dueDate: addDays(todayISO(), paymentTermsForEntity), items: [{ description: '', quantity: 1, price: 0, btwRate: defaultBtw }] } })}>
                <Plus size={14} /> Eerste factuur
              </Button>
            )}
          />
        </Card>
      ) : (
        <Card>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {filtered.map(inv => {
              const c = clients.find(x => x.id === inv.clientId);
              const status = computeInvoiceStatus(inv);
              const total = computeInvoice(inv.items).total;
              const overdueDays = inv.dueDate ? daysBetween(inv.dueDate, todayISO()) : 0;
              return (
                <button
                  key={inv.id}
                  onClick={() => setView({ mode: 'view', invoice: inv })}
                  className="w-full px-5 py-4 hover:bg-stone-50 transition-colors flex items-center gap-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-medium">{inv.number}</span>
                      <Badge status={status} />
                      {status === 'overdue' && overdueDays > 0 && (
                        <span className="text-[10px]" style={{ color: 'var(--danger)' }}>{overdueDays}d te laat</span>
                      )}
                    </div>
                    <div className="text-sm truncate">{c?.name || '—'}</div>
                  </div>
                  <div className="hidden md:block text-xs text-right" style={{ color: 'var(--muted)' }}>
                    <div>Factuurdatum: {fmtDate(inv.issueDate)}</div>
                    <div>Vervalt: {fmtDate(inv.dueDate)}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg num font-medium">{fmtEUR(total)}</div>
                  </div>
                  <ChevronRight size={16} style={{ color: 'var(--muted)' }} />
                </button>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};

// ============================================================================
// INVOICE EDITOR
// ============================================================================
const InvoiceEditor = ({ invoice, clients, settings, activeEntity, onSave, onCancel }) => {
  const paymentTerms = activeEntity?.paymentTerms || settings.invoice?.paymentTerms || 14;
  const defaultBtw = JURISDICTIONS[activeEntity?.jurisdiction || 'NL'].salesTax.standard;
  const [form, setForm] = useState({
    clientId: '', issueDate: todayISO(), dueDate: addDays(todayISO(), paymentTerms),
    items: [{ description: '', quantity: 1, price: 0, btwRate: defaultBtw, discount: null }],
    notes: '', reference: '',
    ...invoice,
  });

  const update = (key, val) => setForm({ ...form, [key]: val });
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
  const addItem = () => setForm({ ...form, items: [...form.items, { description: '', quantity: 1, price: 0, btwRate: defaultBtw, discount: null }] });
  const removeItem = (idx) => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });

  const totals = computeInvoice(form.items);

  const isValid = form.clientId && form.items.length > 0 && form.items.every(i => i.description) && form.issueDate;
  const nextNum = activeEntity?.nextInvoiceNumber || 1;
  const prefix = activeEntity?.invoicePrefix || '';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <button onClick={onCancel} className="flex items-center gap-2 text-sm hover:underline" style={{ color: 'var(--ink-2)' }}>
          <ArrowLeft size={14} /> Terug
        </button>
      </div>

      <div>
        <h1 className="font-display text-4xl font-medium">{form.id ? `Factuur ${form.number}` : 'Nieuwe factuur'}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {form.id ? 'Wijzigingen worden direct opgeslagen' : `Factuurnummer: ${prefix}${String(nextNum).padStart(4, '0')} · ${activeEntity?.name}`}
        </p>
      </div>

      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Select label="Klant *" value={form.clientId} onChange={e => update('clientId', e.target.value)} className="md:col-span-2">
            <option value="">Kies klant...</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label="Referentie" value={form.reference || ''} onChange={e => update('reference', e.target.value)} placeholder="PO-nummer, etc." />
          <Input label="Factuurdatum *" type="date" value={form.issueDate} onChange={e => {
            update('issueDate', e.target.value);
            if (!form.dueDate || daysBetween(form.issueDate, form.dueDate) === settings.invoice.paymentTerms) {
              setForm(f => ({ ...f, issueDate: e.target.value, dueDate: addDays(e.target.value, settings.invoice.paymentTerms) }));
            }
          }} />
          <Input label="Vervaldatum *" type="date" value={form.dueDate} onChange={e => update('dueDate', e.target.value)} />
          <div className="flex items-end">
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              Betaaltermijn: <strong className="num" style={{ color: 'var(--ink)' }}>{form.dueDate && form.issueDate ? daysBetween(form.issueDate, form.dueDate) : 0}</strong> dagen
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm">Regels</h3>
            <Button size="sm" variant="secondary" onClick={addItem}><Plus size={12} /> Regel</Button>
          </div>
          <div className="overflow-x-auto scrollable">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wider" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                  <th className="text-left py-2 font-medium">Omschrijving</th>
                  <th className="text-right py-2 font-medium w-20">Aantal</th>
                  <th className="text-right py-2 font-medium w-28">Prijs</th>
                  <th className="text-right py-2 font-medium w-20">BTW</th>
                  <th className="text-right py-2 font-medium w-28">Totaal</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {form.items.map((item, idx) => {
                  const line = computeLine(item);
                  const hasDiscount = !!item.discount;
                  return (
                    <React.Fragment key={idx}>
                      <tr>
                        <td className="py-2 pr-2">
                          <input
                            value={item.description}
                            onChange={e => updateItem(idx, 'description', e.target.value)}
                            placeholder="Omschrijving werk/product..."
                            className="w-full px-2 py-1.5 text-sm bg-transparent rounded border"
                            style={{ borderColor: 'var(--border)' }}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={e => updateItem(idx, 'quantity', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm text-right bg-transparent rounded border num"
                            style={{ borderColor: 'var(--border)' }}
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="number"
                            step="0.01"
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
                            <option value={0}>0%</option>
                            <option value={9}>9%</option>
                            <option value={21}>21%</option>
                          </select>
                        </td>
                        <td className="py-2 text-right num font-medium">
                          {fmtEUR(line.net)}
                          {line.discount > 0 && <div className="text-[10px] line-through" style={{ color: 'var(--muted)' }}>{fmtEUR(line.base)}</div>}
                        </td>
                        <td className="py-2">
                          <div className="flex gap-0.5">
                            <button
                              onClick={() => toggleDiscount(idx)}
                              className="p-1 rounded hover:bg-stone-100"
                              title={hasDiscount ? 'Korting verwijderen' : 'Korting toevoegen'}
                            >
                              <Percent size={13} style={{ color: hasDiscount ? 'var(--accent)' : 'var(--muted)' }} />
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
                                className="flex-1 min-w-[120px] px-2 py-1 bg-white rounded border text-xs"
                                style={{ borderColor: 'var(--border)' }}
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
                                onChange={e => updateItemDiscount(idx, 'value', Number(e.target.value))}
                                className="w-20 px-2 py-1 bg-white rounded border text-xs text-right num"
                                style={{ borderColor: 'var(--border)' }}
                              />
                              <span className="num text-xs" style={{ color: 'var(--accent)' }}>−{fmtEUR(line.discount)}</span>
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
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Textarea label="Notities op factuur" rows={4} value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Bijv. project-naam, dankwoord, betalingsvoorwaarden..." />
          </div>
          <div className="space-y-2 text-sm">
            {totals.totalDiscount > 0 && (
              <>
                <div className="flex justify-between py-1 text-xs" style={{ color: 'var(--muted)' }}>
                  <span>Bruto subtotaal</span>
                  <span className="num">{fmtEUR(totals.subtotal + totals.totalDiscount)}</span>
                </div>
                <div className="flex justify-between py-1" style={{ color: 'var(--accent)' }}>
                  <span>Totale korting</span>
                  <span className="num">−{fmtEUR(totals.totalDiscount)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between py-1.5">
              <span style={{ color: 'var(--muted)' }}>Subtotaal</span>
              <span className="num font-medium">{fmtEUR(totals.subtotal)}</span>
            </div>
            {Object.entries(totals.btwByRate).map(([rate, amt]) => Number(rate) > 0 && (
              <div key={rate} className="flex justify-between py-1.5">
                <span style={{ color: 'var(--muted)' }}>BTW {rate}%</span>
                <span className="num font-medium">{fmtEUR(amt)}</span>
              </div>
            ))}
            <div className="flex justify-between py-2.5 border-t-2 mt-2" style={{ borderColor: 'var(--ink)' }}>
              <span className="font-display text-lg">Totaal</span>
              <span className="font-display text-xl num font-medium">{fmtEUR(totals.total)}</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Annuleren</Button>
        <Button onClick={() => isValid && onSave(form)} disabled={!isValid}>
          <Save size={14} /> Factuur opslaan
        </Button>
      </div>
    </div>
  );
};

// ============================================================================
// INVOICE DETAIL VIEW (with PDF preview)
// ============================================================================
const InvoiceDetail = ({ invoice, clients, settings, activeEntity, entities, onClose, onEdit, onDelete, onStatusChange, onDuplicate, onSendReminder }) => {
  const [showSendModal, setShowSendModal] = useState(false);
  const client = clients.find(c => c.id === invoice.clientId);
  const totals = computeInvoice(invoice.items);
  const status = computeInvoiceStatus(invoice);
  // Pick the entity this invoice belongs to (or fall back to active)
  const invoiceEntity = entities?.find(e => e.id === invoice.entityId) || activeEntity;
  // If the entity is a label, resolve its parent for legal/financial data on the invoice
  const invoiceParentEntity = invoiceEntity?.parentId
    ? entities?.find(e => e.id === invoiceEntity.parentId)
    : null;

  const handlePrint = () => {
    // Open dedicated print window with only the invoice — browser shows "Save as PDF"
    const el = document.querySelector('.invoice-printable')
    if (!el) { window.print(); return }
    const w = window.open('', '_blank', 'width=900,height=1200')
    w.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Factuur ${invoice.number || ''}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #fff; color: #000; }
    @media print { @page { size: A4; margin: 10mm; } body { margin: 0; } }
    :root {
      --text: #000; --text-2: #333; --text-3: #666;
      --surface: #fff; --surface-2: #f5f5f5; --surface-3: #eee;
      --border: rgba(0,0,0,0.1); --border-2: rgba(0,0,0,0.15); --border-3: rgba(0,0,0,0.25);
      --accent: #2563eb; --success: #059669; --danger: #dc2626; --warning: #d97706;
      --muted: #666; --ink: #000; --ink-2: #333;
    }
  </style>
</head>
<body>
${el.innerHTML}
<script>
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 600);
  });
<\/script>
</body>
</html>`)
    w.document.close()
    w.focus()
  };

  return (
    <div className="space-y-5">
      <div className="no-print flex items-center justify-between gap-4 flex-wrap">
        <button onClick={onClose} className="flex items-center gap-2 text-sm hover:underline" style={{ color: 'var(--ink-2)' }}>
          <ArrowLeft size={14} /> Terug naar lijst
        </button>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onDuplicate(invoice)}><Copy size={13} /> Dupliceren</Button>
          <Button size="sm" variant="secondary" onClick={handlePrint}><Download size={13} /> Download PDF</Button>
          {status === 'draft' && <Button size="sm" variant="secondary" onClick={() => onEdit(invoice)}><Edit3 size={13} /> Bewerken</Button>}
          {(status === 'draft' || status === 'sent' || status === 'overdue') && (
            <Button size="sm" onClick={() => setShowSendModal(true)}><Send size={13} /> {status === 'draft' ? 'Versturen' : 'Opnieuw versturen'}</Button>
          )}
          {status !== 'paid' && status !== 'draft' && (
            <Button size="sm" onClick={() => onStatusChange(invoice.id, 'paid', { paidAt: new Date().toISOString() })}><Check size={13} /> Markeer betaald</Button>
          )}
          {status === 'paid' && (
            <Button size="sm" variant="secondary" onClick={() => onStatusChange(invoice.id, 'sent', { paidAt: null })}><X size={13} /> Markeer onbetaald</Button>
          )}
          <Button size="sm" variant="danger" onClick={() => onDelete(invoice.id)}><Trash2 size={13} /></Button>
        </div>
      </div>

      <div className="no-print flex items-center gap-3 flex-wrap">
        <h1 className="font-display text-3xl font-medium">Factuur {invoice.number}</h1>
        <Badge status={status} />
        {invoice.sentAt && <span className="text-xs" style={{ color: 'var(--muted)' }}>Verstuurd op {fmtDate(invoice.sentAt)}</span>}
        {invoice.paidAt && <span className="text-xs" style={{ color: 'var(--success)' }}>Betaald op {fmtDate(invoice.paidAt)}</span>}
      </div>

      {invoice.remindersSent && invoice.remindersSent.length > 0 && (
        <Card className="p-4 no-print">
          <h3 className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>Herinneringen verstuurd</h3>
          <div className="space-y-1.5">
            {invoice.remindersSent.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                <span>{settings.reminders.templates[r.level]?.name || `Herinnering ${r.level + 1}`}</span>
                <span style={{ color: 'var(--muted)' }}>· {fmtDate(r.date)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Invoice preview / printable — uses template selected on entity */}
      <Card className="invoice-printable" style={{ maxWidth: 800, margin: '0 auto', overflow: 'hidden' }}>
        {renderTemplate(invoiceEntity?.templateId || 'classic', { invoice, entity: invoiceEntity, client, totals, parentEntity: invoiceParentEntity })}
      </Card>

      {showSendModal && (
        <SendInvoiceModal
          invoice={invoice}
          client={client}
          settings={settings}
          onSend={(reminderLevel) => {
            if (reminderLevel !== undefined) {
              onSendReminder(invoice, reminderLevel);
            } else {
              onStatusChange(invoice.id, 'sent', { sentAt: new Date().toISOString() });
            }
            setShowSendModal(false);
          }}
          onClose={() => setShowSendModal(false)}
          mode="send"
        />
      )}
    </div>
  );
};

// ============================================================================
// SEND INVOICE / REMINDER MODAL
// ============================================================================
const SendInvoiceModal = ({ invoice, client, settings, onSend, onClose, mode = 'send', reminderLevel = null }) => {
  const totals = computeInvoice(invoice.items);
  const isReminder = mode === 'reminder';
  const template = isReminder
    ? settings.reminders.templates[reminderLevel] || settings.reminders.templates[0]
    : { subject: settings.email.invoiceSubject, body: settings.email.invoiceBody };

  const replaceVars = (str) => (str || '')
    .replace(/{{number}}/g, invoice.number)
    .replace(/{{contact}}/g, client?.contactName || client?.name || '')
    .replace(/{{company}}/g, settings.company.name)
    .replace(/{{amount}}/g, fmtEUR(totals.total))
    .replace(/{{date}}/g, fmtDate(invoice.issueDate))
    .replace(/{{dueDate}}/g, fmtDate(invoice.dueDate))
    .replace(/{{senderName}}/g, settings.email.fromName)
    .replace(/{{iban}}/g, settings.company.iban || '');

  const [channel, setChannel] = useState('email');
  const [subject, setSubject] = useState(replaceVars(template.subject));
  const [body, setBody] = useState(replaceVars(template.body));
  const [waBody, setWaBody] = useState(replaceVars(settings.email?.whatsappMessage || 'Hallo {{contact}}, factuur {{number}} — {{amount}} — vervalt {{dueDate}}.'));

  const whatsappNumber = (client?.phone || settings.email?.whatsappNumber || '').replace(/\D/g, '');

  const sendWhatsApp = () => {
    if (!whatsappNumber) {
      alert('Geen WhatsApp-nummer bekend bij deze klant. Vul het in bij klantgegevens.');
      return;
    }
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(waBody)}`;
    window.open(url, '_blank');
    onSend(isReminder ? reminderLevel : undefined);
  };

  return (
    <Modal open onClose={onClose} size="lg">
      <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="font-display text-2xl">{isReminder ? 'Herinnering versturen' : 'Factuur versturen'}</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {isReminder ? template.name : `Factuur ${invoice.number}`} → {client?.email || client?.name}
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-stone-100"><X size={16} /></button>
      </div>

      {/* Channel selector */}
      <div className="px-6 pt-4 flex gap-2">
        {[
          { id: 'email', label: 'Email', icon: Mail },
          { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
        ].map(ch => (
          <button key={ch.id} onClick={() => setChannel(ch.id)}
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
                <strong>Demo modus:</strong> Koppel Resend via Instellingen → Email & WhatsApp om direct te versturen. Status wordt wel bijgewerkt.
              </div>
            </div>
            <Input label="Van" value={`${settings.email.fromName} <${settings.email.fromEmail || 'nog-niet-ingesteld@example.com'}>`} readOnly />
            <Input label="Aan" value={client?.email || 'Geen email ingesteld bij klant'} readOnly />
            <Input label="Onderwerp" value={subject} onChange={e => setSubject(e.target.value)} />
            <Textarea label="Bericht" rows={8} value={body} onChange={e => setBody(e.target.value)} />
            <div className="text-xs flex items-center gap-2 px-3 py-2 rounded" style={{ background: 'var(--surface-2)' }}>
              <FileText size={14} style={{ color: 'var(--muted)' }} />
              <span style={{ color: 'var(--ink-2)' }}>Bijlage: {invoice.number}.pdf</span>
            </div>
          </>
        )}

        {channel === 'whatsapp' && (
          <>
            <div className="rounded-md p-3 text-xs flex items-start gap-2" style={{ background: 'rgba(37,211,102,0.08)', color: '#16a34a' }}>
              <MessageSquare size={14} className="mt-0.5 shrink-0" />
              <div>
                WhatsApp Web opent in een nieuw tabblad met het ingevulde bericht. De klant ontvangt het bericht direct via WhatsApp.
                {!whatsappNumber && <strong> Voeg een telefoonnummer toe bij de klant om door te gaan.</strong>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Verzenden naar</label>
              <div className="text-sm px-3 py-2 rounded" style={{ background: 'var(--surface-2)', color: whatsappNumber ? 'var(--ink)' : 'var(--danger)' }}>
                {whatsappNumber ? `+${whatsappNumber}` : 'Geen telefoonnummer ingesteld bij klant'}
              </div>
            </div>
            <Textarea label="WhatsApp bericht" rows={6} value={waBody} onChange={e => setWaBody(e.target.value)} />
            <div className="text-xs" style={{ color: 'var(--muted)' }}>
              Tip: voeg ook een link toe naar de factuur-PDF wanneer je hosting hebt.
            </div>
          </>
        )}
      </div>

      <div className="px-6 py-4 border-t flex justify-end gap-2" style={{ borderColor: 'var(--border)' }}>
        <Button variant="secondary" onClick={onClose}>Annuleren</Button>
        {channel === 'email' && (
          <Button onClick={() => onSend(isReminder ? reminderLevel : undefined)}>
            <Send size={14} /> {isReminder ? 'Herinnering versturen' : 'Versturen'}
          </Button>
        )}
        {channel === 'whatsapp' && (
          <button onClick={sendWhatsApp} disabled={!whatsappNumber}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#25d366', border: 'none', borderRadius: 8, padding: '8px 16px', color: '#fff', fontSize: 13, fontWeight: 600, cursor: whatsappNumber ? 'pointer' : 'not-allowed', opacity: whatsappNumber ? 1 : 0.5 }}>
            <MessageSquare size={14} /> Verstuur via WhatsApp
          </button>
        )}
      </div>
    </Modal>
  );
};

// ============================================================================
// EXPENSES VIEW
// ============================================================================
const ExpensesView = ({ expenses, setExpenses, allExpenses, settings, setSettings, activeEntity }) => {
  const [processing, setProcessing] = useState(null);
  const [filter, setFilter] = useState('all');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  const filtered = expenses
    .filter(e => filter === 'all' || e.status === filter)
    .sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));

  const openCount = expenses.filter(e => e.status === 'open').length;
  const totalCosts = expenses.filter(e => e.status === 'processed').reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalBtw = expenses.filter(e => e.status === 'processed').reduce((s, e) => s + Number(e.btwAmount || 0), 0);
  const baseCurr = activeEntity ? JURISDICTIONS[activeEntity.jurisdiction || 'NL'].baseCurrency : (settings.baseCurrency || 'EUR');
  const defaultBtw = activeEntity ? JURISDICTIONS[activeEntity.jurisdiction || 'NL'].salesTax.standard : 21;

  const handleCapture = async (file, source = 'upload') => {
    if (!file) return;
    setUploading(true);
    try {
      const isPdf = file.type === 'application/pdf';
      const dataUrl = isPdf ? await readFileAsDataUrl(file) : await resizeImage(file);
      const newExpense = {
        id: generateId('exp'),
        entityId: activeEntity?.id,
        image: isPdf ? null : dataUrl,
        attachment: isPdf ? dataUrl : null,
        attachmentName: isPdf ? file.name : null,
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
      const all = allExpenses || expenses;
      setExpenses([newExpense, ...all]);
    } catch (e) {
      alert('Foto kon niet worden verwerkt: ' + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateRates = async (rates) => {
    if (setSettings) await setSettings({ ...settings, exchangeRates: rates });
  };

  const handleProcess = (expense) => {
    const all = allExpenses || expenses;
    setExpenses(all.map(e => e.id === expense.id ? { ...e, ...expense, status: 'processed' } : e));
    setProcessing(null);
  };

  const handleDelete = (id) => {
    if (window.confirm('Bon verwijderen?')) {
      const all = allExpenses || expenses;
      setExpenses(all.filter(e => e.id !== id));
      setProcessing(null);
    }
  };

  return (
    <div className="space-y-5 pb-24 lg:pb-0">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-medium">Bonnen</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {openCount > 0 ? `${openCount} open · ` : ''}{expenses.length} totaal
          </p>
        </div>
      </div>

      {/* Quick capture card */}
      <Card className="p-6" style={{ background: 'linear-gradient(135deg, #1A1612 0%, #2D2520 100%)', borderColor: 'transparent' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-white">
            <h3 className="font-display text-xl font-medium">Bon vastleggen</h3>
            <p className="text-sm opacity-70 mt-0.5">Foto maken of bestand kiezen — verwerk je later</p>
          </div>
          <div className="flex gap-2">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleCapture(e.target.files?.[0], 'camera')}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => handleCapture(e.target.files?.[0], 'upload')}
            />
            <button
              onClick={() => cameraInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2.5 rounded-md text-sm font-medium bg-white text-stone-900 flex items-center gap-2 hover:bg-stone-100 transition disabled:opacity-50"
            >
              <Camera size={16} /> {uploading ? 'Bezig...' : 'Foto'}
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2.5 rounded-md text-sm font-medium border border-white/20 text-white flex items-center gap-2 hover:bg-white/10 transition disabled:opacity-50"
            >
              <Upload size={16} /> Bestand
            </button>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Open</div>
          <div className="font-display text-2xl num mt-1" style={{ color: openCount > 0 ? 'var(--accent)' : 'var(--ink)' }}>{openCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Totaal kosten</div>
          <div className="font-display text-xl num mt-1">{fmtEUR(totalCosts)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>BTW terug</div>
          <div className="font-display text-xl num mt-1" style={{ color: 'var(--success)' }}>{fmtEUR(totalBtw)}</div>
        </Card>
      </div>

      {/* Filter tabs */}
      <Card className="p-3">
        <div className="flex flex-wrap gap-1">
          {[{ id: 'all', label: 'Alles' }, { id: 'open', label: `Open${openCount > 0 ? ` (${openCount})` : ''}` }, { id: 'processed', label: 'Verwerkt' }].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="px-3 py-1.5 text-xs font-medium rounded transition-colors"
              style={{
                background: filter === f.id ? 'var(--ink)' : 'transparent',
                color: filter === f.id ? '#fff' : 'var(--ink-2)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={ReceiptIcon}
            title={filter === 'open' ? 'Geen open bonnen' : filter === 'processed' ? 'Geen verwerkte bonnen' : 'Nog geen bonnen'}
            description={filter === 'all' ? 'Maak een foto van een bon om te beginnen.' : 'Wissel van filter om andere bonnen te zien.'}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map(e => (
            <button
              key={e.id}
              onClick={() => setProcessing(e)}
              className="text-left rounded-xl overflow-hidden border bg-white hover:shadow-md transition-shadow group"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="aspect-square bg-stone-100 relative overflow-hidden">
                {e.image ? (
                  <img src={e.image} alt="bon" className="w-full h-full object-cover" />
                ) : e.attachment ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                    <Paperclip size={28} style={{ color: 'var(--muted)' }} />
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>PDF</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon size={32} style={{ color: 'var(--muted)' }} />
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <Badge status={e.status} />
                </div>
                {e.attachment && (
                  <div className="absolute bottom-2 left-2">
                    <Paperclip size={12} style={{ color: 'var(--muted)' }} />
                  </div>
                )}
              </div>
              <div className="p-3">
                {e.status === 'processed' ? (
                  <>
                    <div className="text-sm font-medium truncate">{e.vendor || 'Onbekend'}</div>
                    <div className="text-xs mt-0.5 flex items-center justify-between" style={{ color: 'var(--muted)' }}>
                      <span>{fmtDate(e.date)}</span>
                      <span className="num font-medium" style={{ color: 'var(--ink)' }}>{fmtEUR(e.amount)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-medium" style={{ color: 'var(--warning)' }}>Te verwerken</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{fmtDate(e.capturedAt)}</div>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {processing && (
        <ExpenseProcessModal
          expense={processing}
          settings={settings}
          onSave={handleProcess}
          onDelete={handleDelete}
          onClose={() => setProcessing(null)}
          onUpdateRates={handleUpdateRates}
        />
      )}
    </div>
  );
};

const ExpenseProcessModal = ({ expense, settings, onSave, onDelete, onClose, onUpdateRates }) => {
  const jur = JURISDICTIONS[settings.jurisdiction || 'NL'];
  const baseCurr = settings.baseCurrency || 'EUR';
  const ledgerAccounts = getLedgerAccounts(settings.jurisdiction || 'NL');

  const [form, setForm] = useState({
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
  });

  const [fetchingRate, setFetchingRate] = useState(false);
  const [rateError, setRateError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [scanResult, setScanResult] = useState(null); // for showing what was found
  const attachInputRef = useRef(null);
  const [attachUploading, setAttachUploading] = useState(false);

  const handleAIScan = async () => {
    if (!expense.image) return;
    setScanning(true);
    setScanError(null);
    setScanResult(null);
    try {
      const apiKey = resolveApiKey(settings.apiKey);
      const result = await callClaudeVision({ imageDataUrl: expense.image, apiKey, jurisdiction: settings.jurisdiction || 'NL' });

      // Use total_incl_tax as originalAmount — recalc formula expects the INCLUSIVE amount
      const totalIncl = Number(result.total_incl_tax) || 0;
      const btwAmt = Number(result.tax_amount) || 0;
      const btwRate = Number(result.tax_rate) || 0;
      const detectedCurrency = (result.currency || baseCurr).toUpperCase();

      setScanResult({ vendor: result.vendor, date: result.date, totalIncl, btwAmt, btwRate, currency: detectedCurrency });

      setForm(f => {
        const next = {
          ...f,
          vendor: result.vendor || f.vendor,
          date: result.date || f.date,
          currency: detectedCurrency,
          originalAmount: totalIncl,
          btwRate: btwRate || f.btwRate,
          // Override btwAmount only if AI returned it — recalc will recompute if 0
          ...(btwAmt > 0 ? { btwAmount: btwAmt } : {}),
          // Reset exchange rate to 1 so auto-fetch fires correctly
          exchangeRate: detectedCurrency !== baseCurr ? 1 : f.exchangeRate,
        };
        return recalc(next);
      });

      // If foreign currency detected: explicitly fetch live rate after state settles
      if (detectedCurrency !== baseCurr) {
        setTimeout(async () => {
          try {
            const rates = await fetchExchangeRates(baseCurr);
            const conv = convertCurrency(1, detectedCurrency, baseCurr, rates);
            if (conv) {
              setForm(f => recalc({ ...f, exchangeRate: conv.rate }));
              if (onUpdateRates) onUpdateRates(rates);
            }
          } catch { /* exchange rate fetch failed silently — user can manually refresh */ }
        }, 50);
      }
    } catch (e) {
      setScanError(e.message);
    } finally {
      setScanning(false);
    }
  };

  // Auto-suggest ledger account on vendor change (only if user hasn't picked one yet)
  const suggestion = useMemo(
    () => suggestLedgerAccount(form.vendor, settings.jurisdiction || 'NL'),
    [form.vendor, settings.jurisdiction]
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

  const recalc = (next) => {
    const orig = Number(next.originalAmount || 0);
    const rate = Number(next.exchangeRate || 1);
    const amtBase = +(orig * rate).toFixed(2);
    const btwRate = Number(next.btwRate || 0);
    const btw = +(amtBase - (amtBase / (1 + btwRate / 100))).toFixed(2);
    return { ...next, amount: amtBase, btwAmount: btw };
  };

  const update = (key, val) => {
    setForm(f => recalc({ ...f, [key]: val }));
  };

  const handleFetchRate = async () => {
    if (form.currency === baseCurr) return;
    setFetchingRate(true);
    setRateError(null);
    try {
      const rates = await fetchExchangeRates(baseCurr);
      const conv = convertCurrency(1, form.currency, baseCurr, rates);
      if (conv) {
        setForm(f => recalc({ ...f, exchangeRate: conv.rate }));
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
    if (form.currency !== baseCurr && (!form.exchangeRate || form.exchangeRate === 1) && !expense.exchangeRate) {
      handleFetchRate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.currency]);

  const isValid = form.vendor && form.date && form.originalAmount > 0 && form.ledgerAccount;
  const selectedAccount = ledgerAccounts.find(a => a.code === form.ledgerAccount);

  return (
    <Modal open onClose={onClose} size="lg">
      <div className="px-6 py-5 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="font-display text-2xl">Bon verwerken</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            Vastgelegd op {fmtDate(expense.capturedAt)} · {jur.flag} {jur.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {expense.image && (
            <Button size="sm" variant="secondary" onClick={handleAIScan} disabled={scanning}>
              <Wand2 size={13} className={scanning ? 'animate-spin' : ''} />
              {scanning ? 'Scannen...' : 'Scan met AI'}
            </Button>
          )}
          <button onClick={onClose} className="p-1.5 rounded hover:bg-stone-100"><X size={16} /></button>
        </div>
      </div>
      {scanResult && !scanError && (
        <div className="mx-6 mt-3 px-3 py-2 rounded-md text-xs flex items-start gap-2 animate-in" style={{ background: 'var(--success-soft)', color: 'var(--success)' }}>
          <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
          <span>
            <strong>AI gevonden:</strong> {scanResult.vendor || '?'} · {scanResult.date || '?'} ·{' '}
            {fmtCurrency(scanResult.totalIncl, scanResult.currency)}
            {scanResult.btwAmt > 0 && ` (incl. ${scanResult.currency === 'EUR' ? 'BTW' : 'belasting'} ${fmtCurrency(scanResult.btwAmt, scanResult.currency)})`}
            {scanResult.currency !== baseCurr && <span className="ml-1 opacity-80">→ wisselkoers ophalen...</span>}
          </span>
        </div>
      )}
      {scanError && (
        <div className="mx-6 mt-3 px-3 py-2 rounded-md text-xs flex items-start gap-2" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{scanError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 max-h-[78vh] overflow-y-auto scrollable">
        <div className="bg-stone-100 p-4 flex items-center justify-center">
          {expense.image ? (
            <img src={expense.image} alt="bon" className="max-w-full max-h-[60vh] rounded shadow-md" />
          ) : (
            <div className="text-sm" style={{ color: 'var(--muted)' }}>Geen afbeelding</div>
          )}
        </div>
        <div className="p-6 space-y-4">
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
                <div className="opacity-75 mt-0.5">Match op "{suggestion.matched}" · automatisch ingevuld, je kunt het hieronder aanpassen</div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input label="Datum bon *" type="date" value={form.date} onChange={e => update('date', e.target.value)} />
            <Select label="Categorie" value={form.category} onChange={e => update('category', e.target.value)}>
              <option value="">Kies...</option>
              {settings.categories.map(c => <option key={c} value={c}>{c}</option>)}
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
              <div className="font-medium flex items-center gap-1.5" style={{ color: 'var(--ink-2)' }}>
                <BookOpen size={11} /> Journaalpost
              </div>
              <div className="font-mono" style={{ color: 'var(--ink)' }}>
                Debet &nbsp;: {selectedAccount.code} {selectedAccount.name}
              </div>
              <div className="font-mono" style={{ color: 'var(--ink)' }}>
                Credit: 1100 Bank / Creditcard
              </div>
              <div style={{ color: 'var(--muted)' }}>{selectedAccount.group} · {jur.salesTax.name} voorbelasting apart verwerken</div>
            </div>
          )}

          {/* Currency + amount */}
          <div className="space-y-2">
            <label className="block text-xs font-medium" style={{ color: 'var(--ink-2)' }}>Bedrag op bon *</label>
            <div className="grid grid-cols-5 gap-2">
              <input
                type="number" step="0.01"
                value={form.originalAmount}
                onChange={e => update('originalAmount', e.target.value)}
                className="col-span-3 px-3 py-2.5 text-sm bg-white rounded-md border num"
                style={{ borderColor: 'var(--border-strong)' }}
                placeholder="0,00"
              />
              <select
                value={form.currency}
                onChange={e => update('currency', e.target.value)}
                className="col-span-2 px-2 py-2.5 text-sm bg-white rounded-md border cursor-pointer"
                style={{ borderColor: 'var(--border-strong)' }}
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
                  className="text-xs font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-white/50 disabled:opacity-50"
                  style={{ color: 'var(--info)' }}
                >
                  <RefreshCw size={11} className={fetchingRate ? 'animate-spin' : ''} />
                  {fetchingRate ? 'Ophalen...' : 'Huidige koers'}
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="num">1 {form.currency}</span>
                <ArrowRight size={12} style={{ color: 'var(--muted)' }} />
                <input
                  type="number" step="0.000001"
                  value={form.exchangeRate}
                  onChange={e => update('exchangeRate', e.target.value)}
                  className="flex-1 px-2 py-1 text-sm bg-white rounded border num"
                  style={{ borderColor: 'var(--border)' }}
                />
                <span className="num">{baseCurr}</span>
              </div>
              {rateError && <div className="text-xs" style={{ color: 'var(--danger)' }}>{rateError}</div>}
              <div className="text-xs flex justify-between pt-1 border-t" style={{ borderColor: 'rgba(30,64,175,0.15)', color: 'var(--info)' }}>
                <span>{fmtCurrency(form.originalAmount, form.currency)}</span>
                <span className="num font-semibold">≈ {fmtCurrency(form.amount, baseCurr)}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select label={`${jur.salesTax.name} %`} value={form.btwRate} onChange={e => update('btwRate', Number(e.target.value))}>
              {jur.salesTax.rates.map(r => <option key={r} value={r}>{r}%</option>)}
            </Select>
            <div className="flex items-end">
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                <div>Excl: <span className="num" style={{ color: 'var(--ink)' }}>{fmtCurrency(Number(form.amount) - Number(form.btwAmount), baseCurr)}</span></div>
                <div>{jur.salesTax.name}: <span className="num" style={{ color: 'var(--success)' }}>{fmtCurrency(form.btwAmount, baseCurr)}</span></div>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-md text-sm space-y-1" style={{ background: 'var(--surface-2)' }}>
            <div className="flex justify-between font-display text-base">
              <span>Totaal (in {baseCurr})</span>
              <span className="num font-medium">{fmtCurrency(form.amount, baseCurr)}</span>
            </div>
          </div>

          <Textarea label="Notitie" rows={2} value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Optioneel..." />

          {/* Bijlage */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Bijlage (PDF / bestand)</label>
            <input ref={attachInputRef} type="file" accept=".pdf,image/*" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              setAttachUploading(true);
              try { const url = await readFileAsDataUrl(f); setForm(prev => ({ ...prev, attachment: url, attachmentName: f.name })); }
              finally { setAttachUploading(false); }
            }} />
            {form.attachment ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <Paperclip size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span className="flex-1 truncate text-xs" style={{ color: 'var(--ink)' }}>{form.attachmentName || 'Bijlage'}</span>
                <a href={form.attachment} download={form.attachmentName || 'bijlage'} className="flex" style={{ color: 'var(--muted)' }}><Download size={13} /></a>
                <button onClick={() => setForm(f => ({ ...f, attachment: null, attachmentName: null }))} className="flex" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0 }}><X size={13} /></button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => attachInputRef.current?.click()} disabled={attachUploading}>
                <Paperclip size={13} /> {attachUploading ? 'Uploaden...' : 'Bestand toevoegen'}
              </Button>
            )}
          </div>

          {form.source && form.source !== 'manual' && (
            <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
              <Inbox size={11} />
              <span>Bron: {form.source === 'email' ? 'Gmail (auto)' : form.source === 'camera' ? 'Camera' : 'Upload'}</span>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t flex justify-between gap-2" style={{ borderColor: 'var(--border)' }}>
        <Button variant="danger" size="sm" onClick={() => onDelete(expense.id)}><Trash2 size={14} /> Verwijderen</Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Annuleren</Button>
          <Button onClick={() => isValid && onSave(form)} disabled={!isValid}>
            <Check size={14} /> Verwerken & boeken
          </Button>
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
const InvoiceLineItemsAndTotals = ({ invoice, totals, jur, accent, style = 'executive' }) => {
  const editCtx = useContext(InvoiceEditContext);
  const isMinimal = style === 'atelier';
  const headerBg = style === 'studio' ? accent : 'transparent';
  const headerColor = style === 'studio' ? '#fff' : 'var(--ink)';
  const rowBorder = isMinimal ? '1px solid #e8e8e8' : '1px solid var(--border)';
  return (
    <>
      <table className="w-full text-sm mb-8" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: headerBg }}>
            <th className="text-left py-2.5 px-3 text-[10px] uppercase tracking-[0.12em] font-semibold" style={{ color: headerColor || 'var(--muted)', borderBottom: `2px solid ${accent}` }}>Omschrijving</th>
            <th className="text-right py-2.5 px-2 text-[10px] uppercase tracking-[0.12em] font-semibold w-16" style={{ color: headerColor || 'var(--muted)', borderBottom: `2px solid ${accent}` }}>Aantal</th>
            <th className="text-right py-2.5 px-2 text-[10px] uppercase tracking-[0.12em] font-semibold w-28" style={{ color: headerColor || 'var(--muted)', borderBottom: `2px solid ${accent}` }}>Stukprijs</th>
            <th className="text-right py-2.5 px-2 text-[10px] uppercase tracking-[0.12em] font-semibold w-14" style={{ color: headerColor || 'var(--muted)', borderBottom: `2px solid ${accent}` }}>{jur.salesTax.name}</th>
            <th className="text-right py-2.5 px-3 text-[10px] uppercase tracking-[0.12em] font-semibold w-28" style={{ color: headerColor || 'var(--muted)', borderBottom: `2px solid ${accent}` }}>Bedrag</th>
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
                      − korting: {item.discount.type === 'percent' ? `${item.discount.value}%` : fmtEUR(item.discount.value)}
                      {item.discount.name ? ` (${item.discount.name})` : ''}
                    </div>
                  )}
                </td>
                <td className="py-3 px-2 text-right align-top num text-sm" style={{ color: 'var(--ink-2)' }}>{Number(item.quantity).toLocaleString('nl-NL')}</td>
                <td className="py-3 px-2 text-right align-top num text-sm" style={{ color: 'var(--ink-2)' }}>
                  {fmtEUR(item.price)}
                  {line.discount > 0 && <div className="text-[10px]" style={{ color: 'var(--muted)' }}>→ {fmtEUR(line.net / (Number(item.quantity) || 1))}</div>}
                </td>
                <td className="py-3 px-2 text-right align-top num text-xs" style={{ color: 'var(--muted)' }}>{item.btwRate}%</td>
                <td className="py-3 px-3 text-right align-top num font-semibold text-sm" style={{ color: 'var(--ink)' }}>{fmtEUR(line.net)}</td>
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
                <span>Subtotaal (voor korting)</span>
                <span className="num">{fmtEUR(totals.subtotal + totals.totalDiscount)}</span>
              </div>
              <div className="flex justify-between py-1.5 text-xs" style={{ color: accent, borderBottom: '1px solid var(--border)' }}>
                <span>Totale korting</span>
                <span className="num">− {fmtEUR(totals.totalDiscount)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between py-1.5 text-xs" style={{ color: 'var(--ink-2)', borderBottom: '1px solid var(--border)' }}>
            <span>Subtotaal (excl. {jur.salesTax.name})</span>
            <span className="num">{fmtEUR(totals.subtotal)}</span>
          </div>
          {Object.entries(totals.btwByRate).filter(([r]) => Number(r) > 0).map(([rate, amt]) => (
            <div key={rate} className="flex justify-between py-1.5 text-xs" style={{ color: 'var(--ink-2)', borderBottom: '1px solid var(--border)' }}>
              <span>{jur.salesTax.name} {rate}%</span>
              <span className="num">{fmtEUR(amt)}</span>
            </div>
          ))}
          <div className="flex justify-between items-center py-3 mt-1" style={{ borderTop: `2px solid ${accent}` }}>
            <span className="text-base font-semibold" style={{ color: 'var(--ink)' }}>Totaal te betalen</span>
            <span className="num text-xl font-bold" style={{ color: accent }}>{fmtEUR(totals.total)}</span>
          </div>
        </div>
      </div>

      {(invoice.notes || editCtx.editMode) && (
        <div className="mb-8 p-4 rounded-md text-xs" style={{ background: '#f9f8f6', border: `1px solid ${editCtx.editMode ? 'rgba(0,0,0,0.12)' : 'var(--border)'}` }}>
          <div className="uppercase tracking-[0.12em] text-[9px] mb-1.5 font-semibold" style={{ color: 'var(--muted)' }}>Opmerkingen</div>
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
  const legalEntity = (entity?.type === 'label' && parentEntity) ? parentEntity : entity;
  const legalJur = (entity?.type === 'label' && parentEntity) ? JURISDICTIONS[parentEntity.jurisdiction || 'NL'] : jur;
  const opts = entity?.templateOptions || {};

  const epcData = opts.showQrCode !== false ? buildEpcQr({
    iban: legalEntity.iban,
    bic: legalEntity.bicCode,
    name: legalEntity.name,
    amount: totals?.total,
    reference: invoice?.number,
  }) : null;
  const qrUrl = epcData
    ? `https://api.qrserver.com/v1/create-qr-code/?size=90x90&ecc=M&data=${encodeURIComponent(epcData)}`
    : null;

  return (
    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginTop: 8 }}>
      {entity?.type === 'label' && parentEntity && (
        <div className="text-[10px] mb-3 italic" style={{ color: 'var(--muted)' }}>
          {entity.name} is een handelsnaam van {parentEntity.name}.
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
            <div style={{ fontSize: 9, color: 'var(--muted)' }}>{opts.signatureLabel || 'Handtekening'}</div>
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
        ) : (
          <div className="text-xs mb-4" style={{ color: 'var(--ink-2)', fontStyle: 'italic' }}>{entity.footerText}</div>
        )
      )}

      {opts.showBankDetails !== false && (
        <div className="text-xs" style={{ display: 'grid', gridTemplateColumns: qrUrl ? '1fr auto 1fr' : '1fr 1fr', gap: 24, alignItems: 'flex-start', color: 'var(--ink-2)' }}>
          <div>
            <div className="uppercase tracking-[0.12em] text-[9px] mb-2 font-semibold" style={{ color: 'var(--muted)' }}>Bankgegevens</div>
            {legalEntity.iban && <div className="font-mono font-medium" style={{ color: 'var(--ink)', letterSpacing: '0.05em' }}>{legalEntity.iban}</div>}
            <div className="mt-0.5">t.n.v. {legalEntity.name}</div>
            {legalEntity.bicCode && <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--muted)' }}>BIC: {legalEntity.bicCode}</div>}
          </div>
          {qrUrl && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <img src={qrUrl} alt="SEPA QR" width={80} height={80} style={{ borderRadius: 4, border: '1px solid var(--border)' }} />
              <div style={{ fontSize: 8, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.3 }}>Scan om<br />te betalen</div>
            </div>
          )}
          <div className="text-right">
            <div className="uppercase tracking-[0.12em] text-[9px] mb-2 font-semibold" style={{ color: 'var(--muted)' }}>Bedrijfsgegevens</div>
            <div className="font-medium" style={{ color: 'var(--ink)' }}>{legalEntity.name}</div>
            {legalEntity.registrationNumber && <div className="mt-0.5">{legalJur.code === 'NL' ? 'KvK' : 'RNC'}: <span className="font-mono">{legalEntity.registrationNumber}</span></div>}
            {legalEntity.taxNumber && <div>{legalJur.salesTax.name}-nr: <span className="font-mono">{legalEntity.taxNumber}</span></div>}
            {legalEntity.website && <div className="mt-0.5" style={{ color: 'var(--muted)' }}>{legalEntity.website}</div>}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Shared: adresblok klant ──────────────────────────────────────────────────
const InvoiceClientBlock = ({ client }) => (
  <div className="text-xs leading-relaxed" style={{ color: 'var(--ink-2)' }}>
    <div className="font-semibold text-sm mb-0.5" style={{ color: 'var(--ink)' }}>{client?.name || '—'}</div>
    {client?.contactName && <div>T.a.v. {client.contactName}</div>}
    {client?.address && <div>{client.address}</div>}
    {(client?.postal || client?.city) && <div>{client.postal} {client.city}</div>}
    {client?.country && <div>{client.country}</div>}
    {client?.btw && <div className="mt-1 font-mono text-[10px]" style={{ color: 'var(--muted)' }}>{client.btw}</div>}
  </div>
);

// ── Shared: logo/tekst kop ───────────────────────────────────────────────────
// headerMode: 'auto' (logo als aanwezig, anders tekst) | 'text' | 'logo' | 'both'
const EntityBrand = ({
  entity,
  logoHeight = 38, fontSize = 22, fontWeight = 600,
  fontFamily = 'Fraunces, Georgia, serif',
  color = '#1a1a1a', light = false,
}) => {
  const mode = entity.headerMode || 'auto';
  const hasLogo = !!entity.logo;
  const showLogo = hasLogo && mode !== 'text';
  const showText = !hasLogo || mode === 'text' || mode === 'both';
  const nameColor = light ? '#fff' : color;
  return (
    <div>
      {showLogo && (
        <img src={entity.logo} alt={entity.name} style={{ height: logoHeight, objectFit: 'contain', display: 'block', marginBottom: showText ? 6 : 0 }} />
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
  return (
    <div className="bg-white" style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, fontFamily: 'Geist, -apple-system, sans-serif' }}>
      {/* Accent top bar */}
      <div style={{ height: 4, background: accent }} />
      <div style={{ padding: '48px 56px 40px' }}>
        {/* Header: logo/naam links, "FACTUUR" rechts */}
        <div className="flex items-start justify-between mb-12">
          <div>
            {entity.logo
              ? <img src={entity.logo} alt="logo" style={{ height: 44, objectFit: 'contain', marginBottom: 12 }} />
              : <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{entity.name}</div>
            }
            {entity.logo && <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 16, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>{entity.name}</div>}
            <div style={{ fontSize: 11, lineHeight: 1.7, color: 'var(--ink-2)' }}>
              {entity.address && <div>{entity.address}</div>}
              {(entity.postal || entity.city) && <div>{entity.postal} {entity.city}</div>}
              {entity.country && <div>{entity.country}</div>}
              {entity.email && <div style={{ marginTop: 4 }}>{entity.email}</div>}
              {entity.phone && <div>{entity.phone}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>Factuur</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 500, color: accent, letterSpacing: '0.04em' }}>{invoice.number}</div>
            {invoice.reference && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>Ref: {invoice.reference}</div>}
          </div>
        </div>

        {/* Info grid: klant + factuurdata */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 40, paddingBottom: 32, borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Factuur aan</div>
            <InvoiceClientBlock client={client} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Factuurdetails</div>
            <div style={{ fontSize: 11, lineHeight: 2, color: 'var(--ink-2)', fontFamily: 'JetBrains Mono, monospace' }}>
              <div><span style={{ color: 'var(--muted)', fontFamily: 'Geist, sans-serif', fontSize: 10 }}>Datum </span>{fmtDate(invoice.issueDate)}</div>
              <div><span style={{ color: 'var(--muted)', fontFamily: 'Geist, sans-serif', fontSize: 10 }}>Vervalt </span>{fmtDate(invoice.dueDate)}</div>
              {invoice.reference && <div><span style={{ color: 'var(--muted)', fontFamily: 'Geist, sans-serif', fontSize: 10 }}>Ref </span>{invoice.reference}</div>}
            </div>
          </div>
        </div>

        <InvoiceLineItemsAndTotals invoice={invoice} totals={totals} jur={jur} accent={accent} style="executive" />
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
  // Compute a lighter tint for header backgrounds
  return (
    <div className="bg-white" style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, fontFamily: 'Geist, -apple-system, sans-serif' }}>
      {/* Full-bleed header */}
      <div style={{ background: accent, padding: '36px 52px 32px', position: 'relative', overflow: 'hidden' }}>
        {/* Decorative circle */}
        <div style={{ position: 'absolute', right: -60, top: -60, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 40, bottom: -80, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' }}>
          <div>
            {entity.logo
              ? <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 12px', display: 'inline-flex', marginBottom: 12 }}>
                  <img src={entity.logo} alt="logo" style={{ height: 36, objectFit: 'contain' }} />
                </div>
              : null}
            <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 24, fontWeight: 600, color: '#fff', lineHeight: 1.2 }}>{entity.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
              {entity.email}{entity.phone ? ` · ${entity.phone}` : ''}{entity.website ? ` · ${entity.website}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>Invoice / Factuur</div>
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
          <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Factuur aan</div>
          <InvoiceClientBlock client={client} />
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>Details</div>
          <div style={{ fontSize: 11, lineHeight: 1.9, color: 'var(--ink-2)' }}>
            <div>Factuurdatum: <span className="num" style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(invoice.issueDate)}</span></div>
            <div>Vervaldatum: <span className="num" style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(invoice.dueDate)}</span></div>
            {invoice.reference && <div>Referentie: <span style={{ color: 'var(--ink)' }}>{invoice.reference}</span></div>}
          </div>
        </div>
      </div>

      <div style={{ padding: '36px 52px 48px' }}>
        <InvoiceLineItemsAndTotals invoice={invoice} totals={totals} jur={jur} accent={accent} style="studio" />
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
  return (
    <div className="bg-white" style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, padding: '64px 72px 56px', fontFamily: 'Geist, -apple-system, sans-serif' }}>
      {/* Decorative accent dot */}
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, marginBottom: 32 }} />

      {/* Company name as headline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 56 }}>
        <div>
          {entity.logo && <img src={entity.logo} alt="logo" style={{ height: 38, objectFit: 'contain', marginBottom: 16 }} />}
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 28, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{entity.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6, lineHeight: 1.8 }}>
            {entity.address && <span>{entity.address} · </span>}
            {(entity.postal || entity.city) && <span>{entity.postal} {entity.city} · </span>}
            {entity.email && <span>{entity.email}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Factuur</div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 32, fontWeight: 300, color: 'var(--ink)', letterSpacing: '-0.02em' }}>№{invoice.number}</div>
        </div>
      </div>

      {/* Hairline separator */}
      <div style={{ height: 1, background: 'var(--border)', marginBottom: 40 }} />

      {/* Three-column info grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32, marginBottom: 48 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>Aan</div>
          <InvoiceClientBlock client={client} />
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>Datum</div>
          <div style={{ fontSize: 11, lineHeight: 2, color: 'var(--ink-2)' }}>
            <div>Factuur: <span className="num" style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(invoice.issueDate)}</span></div>
            <div>Vervalt: <span className="num" style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(invoice.dueDate)}</span></div>
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 10 }}>Totaal</div>
          <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 24, fontWeight: 400, color: accent }}>{fmtEUR(totals.total)}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>incl. {jur.salesTax.name}</div>
        </div>
      </div>

      <InvoiceLineItemsAndTotals invoice={invoice} totals={totals} jur={jur} accent={accent} style="atelier" />
      <InvoiceFooter entity={entity} jur={jur} parentEntity={parentEntity} style="atelier" invoice={invoice} totals={totals} />
    </div>
  );
};

// ── Template 4: SIGNATURE ─────────────────────────────────────────────────────
// Gekleurde zijbalk — luxury consultancy, hoge merkidentiteit
const TemplateStatement = ({ invoice, entity, client, totals, parentEntity }) => {
  const jur = JURISDICTIONS[entity.jurisdiction || 'NL'];
  const accent = entity.accentColor || '#7C2D2D';
  return (
    <div className="bg-white" style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, display: 'flex', fontFamily: 'Geist, -apple-system, sans-serif' }}>
      {/* Left sidebar */}
      <div style={{ width: 72, flexShrink: 0, background: accent, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '32px 0' }}>
        {entity.logo
          ? <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 6, padding: 8, margin: '0 8px' }}>
              <img src={entity.logo} alt="logo" style={{ width: 40, height: 40, objectFit: 'contain' }} />
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
              {entity.address && <span>{entity.address} · </span>}
              {(entity.postal || entity.city) && <span>{entity.postal} {entity.city}</span>}
              {entity.email && <div>{entity.email}{entity.phone ? ` · ${entity.phone}` : ''}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Factuur</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 600, color: accent }}>{invoice.number}</div>
          </div>
        </div>

        {/* Client + data */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, marginBottom: 36 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Factuur aan</div>
            <InvoiceClientBlock client={client} />
          </div>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--muted)', marginBottom: 8 }}>Gegevens</div>
            <div style={{ fontSize: 11, lineHeight: 2, color: 'var(--ink-2)' }}>
              <div>Datum: <span className="num" style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(invoice.issueDate)}</span></div>
              <div>Vervalt: <span className="num" style={{ color: 'var(--ink)', fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(invoice.dueDate)}</span></div>
              {invoice.reference && <div>Ref: <span style={{ color: 'var(--ink)' }}>{invoice.reference}</span></div>}
            </div>
          </div>
        </div>

        <InvoiceLineItemsAndTotals invoice={invoice} totals={totals} jur={jur} accent={accent} style="signature" />
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
              {entity.address && <div>{entity.address}{(entity.postal || entity.city) ? `, ${entity.postal} ${entity.city}` : ''}</div>}
              {entity.email && <div>{entity.email}{entity.phone ? ` · ${entity.phone}` : ''}</div>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#ccc', marginBottom: 6 }}>Factuur</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 600, color: accent, letterSpacing: '0.03em' }}>{invoice.number}</div>
            {invoice.reference && <div style={{ fontSize: 9, color: '#bbb', marginTop: 4 }}>Ref: {invoice.reference}</div>}
          </div>
        </div>

        {/* Hairline */}
        <div style={{ height: 1, background: '#ebebeb', marginBottom: 28 }} />

        {/* Info strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', background: '#fafaf8', borderRadius: 10, marginBottom: 40, overflow: 'hidden' }}>
          {[
            { label: 'Factuur aan', content: <InvoiceClientBlock client={client} /> },
            { label: 'Datum', content: (
              <div style={{ fontSize: 11, lineHeight: 2, color: '#555' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace' }}>{fmtDate(invoice.issueDate)}</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', color: '#999' }}>Vervalt {fmtDate(invoice.dueDate)}</div>
              </div>
            )},
            { label: 'Totaal', content: (
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: accent }}>{fmtEUR(totals.total)}</div>
                <div style={{ fontSize: 9, color: '#bbb', marginTop: 3 }}>incl. {jur.salesTax.name}</div>
              </div>
            )},
          ].map((col, i) => (
            <div key={i} style={{ padding: '20px 24px', borderRight: i < 2 ? '1px solid #ebebeb' : 'none' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: '#ccc', marginBottom: 10 }}>{col.label}</div>
              {col.content}
            </div>
          ))}
        </div>

        <InvoiceLineItemsAndTotals invoice={invoice} totals={totals} jur={jur} accent={accent} style="nordic" />
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
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, background: '#fff', fontFamily: 'Geist, -apple-system, sans-serif' }}>
      <div style={{ padding: '48px 56px 0' }}>
        {/* Masthead */}
        <div style={{ paddingBottom: 18, borderBottom: `3px solid ${accent}`, marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <EntityBrand entity={entity} fontSize={30} fontWeight={700} />
            <div style={{ textAlign: 'right', marginBottom: 2 }}>
              <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#bbb', marginBottom: 5 }}>Factuurnummer</div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 26, fontWeight: 800, color: accent, letterSpacing: '-0.01em', lineHeight: 1 }}>{invoice.number}</div>
            </div>
          </div>
          <div style={{ fontSize: 10.5, color: '#999', marginTop: 10, lineHeight: 1.7 }}>
            {entity.address && <span>{entity.address}</span>}
            {(entity.postal || entity.city) && <span> · {entity.postal} {entity.city}</span>}
            {entity.email && <span> · {entity.email}</span>}
            {entity.phone && <span> · {entity.phone}</span>}
          </div>
        </div>

        {/* Info: client left, details right in card */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 36 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: '#bbb', marginBottom: 10 }}>Factuur aan</div>
            <InvoiceClientBlock client={client} />
          </div>
          <div style={{ background: '#f6f5f2', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: '#bbb', marginBottom: 10 }}>Factuurdetails</div>
            <div style={{ fontSize: 11, lineHeight: 2, color: '#555' }}>
              <div>Datum <span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#1a1a1a', float: 'right' }}>{fmtDate(invoice.issueDate)}</span></div>
              <div>Vervalt <span style={{ fontFamily: 'JetBrains Mono, monospace', color: accent, float: 'right' }}>{fmtDate(invoice.dueDate)}</span></div>
              {invoice.reference && <div>Ref <span style={{ color: '#1a1a1a', float: 'right' }}>{invoice.reference}</span></div>}
            </div>
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #e4e1db', fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: accent }}>{fmtEUR(totals.total)}</div>
          </div>
        </div>

        <InvoiceLineItemsAndTotals invoice={invoice} totals={totals} jur={jur} accent={accent} style="bold" />
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
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, background: '#fff', fontFamily: 'Geist, -apple-system, sans-serif' }}>
      {/* Gespleten header */}
      <div style={{ display: 'grid', gridTemplateColumns: '55% 45%', minHeight: 148 }}>
        <div style={{ background: '#fff', padding: '36px 40px 28px 52px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <EntityBrand entity={entity} fontSize={20} />
          <div style={{ fontSize: 10, color: '#999', marginTop: 7, lineHeight: 1.85 }}>
            {entity.address && <div>{entity.address}{(entity.postal || entity.city) ? `, ${entity.postal} ${entity.city}` : ''}</div>}
            {entity.email && <div>{entity.email}{entity.phone ? ` · ${entity.phone}` : ''}</div>}
          </div>
        </div>
        <div style={{ background: accent, padding: '36px 52px 28px 36px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>Factuur</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 22, fontWeight: 600, color: '#fff', letterSpacing: '0.03em' }}>{invoice.number}</div>
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)', fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.9 }}>
            <div>{fmtDate(invoice.issueDate)}</div>
            <div style={{ opacity: 0.7 }}>Vervalt {fmtDate(invoice.dueDate)}</div>
            {invoice.reference && <div style={{ opacity: 0.6, fontFamily: 'Geist, sans-serif', fontSize: 9 }}>Ref: {invoice.reference}</div>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '32px 52px 44px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 32, paddingBottom: 28, borderBottom: '1px solid #ebebeb' }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: '#ccc', marginBottom: 8 }}>Factuur aan</div>
            <InvoiceClientBlock client={client} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: '#ccc', marginBottom: 8 }}>Totaal</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 24, fontWeight: 700, color: accent }}>{fmtEUR(totals.total)}</div>
            <div style={{ fontSize: 9, color: '#ccc', marginTop: 3 }}>incl. {jur.salesTax.name}</div>
          </div>
        </div>
        <InvoiceLineItemsAndTotals invoice={invoice} totals={totals} jur={jur} accent={accent} style="horizon" />
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
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', minHeight: 1050, display: 'flex', fontFamily: 'Geist, -apple-system, sans-serif' }}>
      {/* Links paneel: warm beige, linkerrand in accent */}
      <div style={{ width: 200, flexShrink: 0, background: '#F7F4EF', borderLeft: `4px solid ${accent}`, padding: '44px 22px 44px 24px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        <div>
          <EntityBrand entity={entity} fontSize={15} fontWeight={700} fontFamily="Fraunces, Georgia, serif" color={accent} />
          <div style={{ fontSize: 9.5, color: '#aaa', marginTop: 8, lineHeight: 1.9 }}>
            {entity.address && <div>{entity.address}</div>}
            {(entity.postal || entity.city) && <div>{entity.postal} {entity.city}</div>}
            {entity.email && <div style={{ marginTop: 3 }}>{entity.email}</div>}
            {entity.phone && <div>{entity.phone}</div>}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c5b9a8', marginBottom: 10, fontWeight: 700 }}>Factuur aan</div>
          <div style={{ fontSize: 10, color: '#666', lineHeight: 1.85 }}>
            <div style={{ fontWeight: 700, color: '#3a3530' }}>{client?.name || '—'}</div>
            {client?.contactName && <div>{client.contactName}</div>}
            {client?.address && <div>{client.address}</div>}
            {(client?.postal || client?.city) && <div>{client.postal} {client.city}</div>}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c5b9a8', marginBottom: 10, fontWeight: 700 }}>Details</div>
          <div style={{ fontSize: 10, color: '#666', lineHeight: 1.9 }}>
            <div><span style={{ color: '#c5b9a8' }}>Nr </span><span style={{ fontFamily: 'JetBrains Mono, monospace', color: '#3a3530', fontSize: 9.5 }}>{invoice.number}</span></div>
            <div><span style={{ color: '#c5b9a8' }}>Datum </span><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5 }}>{fmtDate(invoice.issueDate)}</span></div>
            <div><span style={{ color: '#c5b9a8' }}>Vervalt </span><span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9.5 }}>{fmtDate(invoice.dueDate)}</span></div>
            {invoice.reference && <div><span style={{ color: '#c5b9a8' }}>Ref </span>{invoice.reference}</div>}
          </div>
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 18, borderTop: '1px solid #e4ddd3' }}>
          <div style={{ fontSize: 8.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c5b9a8', marginBottom: 6, fontWeight: 700 }}>Totaal</div>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 17, fontWeight: 700, color: accent }}>{fmtEUR(totals.total)}</div>
        </div>
      </div>

      {/* Rechts paneel: clean wit */}
      <div style={{ flex: 1, padding: '44px 44px 44px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, paddingBottom: 18, borderBottom: '1px solid #ebebeb' }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: accent, flexShrink: 0 }} />
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, color: '#bbb' }}>Factuur</div>
        </div>
        <InvoiceLineItemsAndTotals invoice={invoice} totals={totals} jur={jur} accent={accent} style="split" />
        <InvoiceFooter entity={entity} jur={jur} parentEntity={parentEntity} style="split" invoice={invoice} totals={totals} />
      </div>
    </div>
  );
};

const renderTemplate = (templateId, props) => {
  switch (templateId) {
    case 'modern': return <TemplateModern {...props} />;
    case 'minimal': return <TemplateMinimal {...props} />;
    case 'statement': return <TemplateStatement {...props} />;
    case 'nordic': return <TemplateNordic {...props} />;
    case 'bold': return <TemplateBold {...props} />;
    case 'horizon': return <TemplateHorizon {...props} />;
    case 'split': return <TemplateSplit {...props} />;
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
];

const TemplateGallery = ({ entity, onUpdate, sampleInvoice, sampleClient }) => {
  const totals = computeInvoice(sampleInvoice.items);
  const accent = entity.accentColor || '#7C2D2D';
  const [docEditMode, setDocEditMode] = useState(false);
  const [editValues, setEditValues] = useState({});

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
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--ink-2)' }}>{accent}</span>
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
                style={{ borderColor: active ? 'var(--ink)' : 'var(--border)', background: active ? 'var(--ink)' : 'transparent', color: active ? '#fff' : 'var(--ink-2)' }}>
                <div className="font-medium">{opt.label}</div>
                <div className="mt-0.5 opacity-70">{opt.desc}</div>
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
                style={{ borderColor: active ? 'var(--ink)' : 'var(--border)', background: active ? 'var(--surface-2)' : 'transparent' }}>
                <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${active ? 'border-0' : ''}`}
                  style={{ background: active ? 'var(--ink)' : 'transparent', borderColor: 'var(--border-strong)' }}>
                  {active && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
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
          <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Live preview</div>
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

        {docEditMode ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[10px] px-1" style={{ color: 'var(--muted)' }}>
                <Edit3 size={10} />
                Klik op <strong style={{ color: 'var(--ink-2)' }}>opmerkingen</strong> of <strong style={{ color: 'var(--ink-2)' }}>voettekst</strong> om te bewerken
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleSaveEdits}
                  className="flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded-md"
                  style={{ background: 'var(--ink)', color: '#fff', border: 'none', cursor: 'pointer' }}
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
            <div style={{ transform: 'scale(0.65)', transformOrigin: 'top left', width: '154%', marginBottom: '-35%' }}>
              {renderTemplate(entity.templateId, { invoice: sampleInvoice, entity, client: sampleClient, totals })}
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
  };
  return styles[templateId] || styles.classic;
};

// ============================================================================
// ENTITIES VIEW (Bedrijven beheer + tree visualisatie)
// ============================================================================
const EntitiesView = ({ entities, setEntities, activeEntityId, setActiveEntityId, invoices, expenses }) => {
  const [editing, setEditing] = useState(null);

  const stats = useMemo(() => {
    const byEntity = {};
    entities.forEach(e => {
      const inv = invoices.filter(i => i.entityId === e.id);
      const exp = expenses.filter(x => x.entityId === e.id);
      const revenue = inv.filter(i => i.status === 'paid').reduce((s, i) => s + computeInvoice(i.items).total, 0);
      const costs = exp.filter(x => x.status === 'processed').reduce((s, x) => s + Number(x.amount || 0), 0);
      byEntity[e.id] = { invoiceCount: inv.length, expenseCount: exp.length, revenue, costs };
    });
    return byEntity;
  }, [entities, invoices, expenses]);

  const handleSave = (entity) => {
    if (entity.id && entities.find(e => e.id === entity.id)) {
      setEntities(entities.map(e => e.id === entity.id ? entity : e));
    } else {
      const newEnt = { ...entity, id: generateId('ent'), createdAt: new Date().toISOString() };
      setEntities([...entities, newEnt]);
    }
    setEditing(null);
  };

  const handleDelete = (id) => {
    if (entities.length <= 1) { alert('Je moet minstens 1 bedrijf hebben.'); return; }
    const invCount = invoices.filter(i => i.entityId === id).length;
    const expCount = expenses.filter(e => e.entityId === id).length;
    if (invCount + expCount > 0) {
      if (!window.confirm(`Dit bedrijf heeft ${invCount} facturen en ${expCount} bonnen. Deze blijven bestaan maar verliezen koppeling. Doorgaan?`)) return;
    }
    setEntities(entities.filter(e => e.id !== id));
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
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium" style={{ background: 'var(--surface-2)', color: 'var(--muted)' }}>
                    {typ.label}
                  </span>
                </div>
                <div className="text-xs mt-1 flex items-center gap-3 flex-wrap" style={{ color: 'var(--muted)' }}>
                  <span>{jur.flag} {jur.name}</span>
                  {entity.registrationNumber && <span className="font-mono">{jur.code === 'NL' ? 'KvK' : 'RNC'}: {entity.registrationNumber}</span>}
                  {entity.taxNumber && <span className="font-mono">{jur.code === 'NL' ? 'BTW' : 'Tax'}: {entity.taxNumber}</span>}
                </div>
                <div className="text-xs mt-2 flex gap-4 flex-wrap">
                  <span><span style={{ color: 'var(--muted)' }}>Omzet: </span><span className="num font-medium">{fmtCurrency(s.revenue, jur.baseCurrency)}</span></span>
                  <span><span style={{ color: 'var(--muted)' }}>Kosten: </span><span className="num font-medium">{fmtCurrency(s.costs, jur.baseCurrency)}</span></span>
                  <span><span style={{ color: 'var(--muted)' }}>Facturen: </span><span className="num font-medium">{s.invoiceCount}</span></span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {!isActive && (
                  <button onClick={() => setActiveEntityId(entity.id)} className="text-[10px] font-medium px-2 py-1 rounded hover:bg-stone-100" style={{ color: 'var(--accent)' }}>
                    Activeer
                  </button>
                )}
                <button onClick={() => setEditing(entity)} className="p-1.5 rounded hover:bg-stone-100">
                  <Edit3 size={13} style={{ color: 'var(--muted)' }} />
                </button>
                {entities.length > 1 && (
                  <button onClick={() => handleDelete(entity.id)} className="p-1.5 rounded hover:bg-red-50">
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
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-medium">Bedrijven</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            {entities.length} bedrijf{entities.length !== 1 ? 'sentiteiten' : ''} · Structuur + gegevens
          </p>
        </div>
        <Button onClick={() => setEditing({})}><Plus size={16} /> Nieuw bedrijf</Button>
      </div>

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
        <button onClick={onClose} className="p-1.5 rounded hover:bg-stone-100"><X size={16} /></button>
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
              <Input label="IBAN" value={form.iban} onChange={e => update('iban', e.target.value)} />
              <Input label="BIC" value={form.bicCode} onChange={e => update('bicCode', e.target.value)} />
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--ink)' }}>Facturatie</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="Factuurnummer prefix" value={form.invoicePrefix} onChange={e => update('invoicePrefix', e.target.value)} hint="Bijv. '2026-' of 'INV-'" />
            <Input label="Volgend nummer" type="number" value={form.nextInvoiceNumber} onChange={e => update('nextInvoiceNumber', Number(e.target.value))} />
            <Input label="Betaaltermijn (dagen)" type="number" value={form.paymentTerms} onChange={e => update('paymentTerms', Number(e.target.value))} />
            <Input label="Accentkleur" type="color" value={form.accentColor} onChange={e => update('accentColor', e.target.value)} />
          </div>
          <Textarea className="mt-3" label="Footer-tekst op factuur" rows={2} value={form.footerText} onChange={e => update('footerText', e.target.value)} />
        </div>

        <div>
          <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--ink)' }}>Logo</h3>
          {form.logo && (
            <div className="mb-3 flex items-center gap-3">
              <img src={form.logo} alt="logo" className="h-14 object-contain bg-stone-50 p-2 rounded border" style={{ borderColor: 'var(--border)' }} />
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
const TaxReportView = ({ invoices, expenses, clients, settings, activeEntity }) => {
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
    // Sales (invoices) — use paid invoices only for cash-basis, or sent for accrual
    // For NL BTW we use issueDate (factuurdatum); only count non-draft
    const periodInvoices = invoices.filter(i => {
      if (i.status === 'draft') return false;
      const d = new Date(i.issueDate);
      return d >= periodRange.start && d < periodRange.end;
    });

    const salesByRate = {};
    let salesTotal = 0;
    let salesTaxOnSales = 0;
    periodInvoices.forEach(inv => {
      const totals = computeInvoice(inv.items);
      salesTotal += totals.subtotal;
      Object.entries(totals.btwByRate).forEach(([rate, amt]) => {
        if (!salesByRate[rate]) salesByRate[rate] = { net: 0, tax: 0 };
        const rateNum = Number(rate);
        inv.items.forEach(it => {
          if (Number(it.btwRate) === rateNum) {
            salesByRate[rate].net += Number(it.quantity || 0) * Number(it.price || 0);
          }
        });
        salesByRate[rate].tax += amt;
        salesTaxOnSales += amt;
      });
    });

    // Purchases (expenses) — processed only, in period
    const periodExpenses = expenses.filter(e => {
      if (e.status !== 'processed' || !e.date) return false;
      const d = new Date(e.date);
      return d >= periodRange.start && d < periodRange.end;
    });

    let purchasesTotal = 0;
    let taxOnPurchases = 0;
    const byLedger = {};
    periodExpenses.forEach(e => {
      const total = Number(e.amount || 0);
      const tax = Number(e.btwAmount || 0);
      purchasesTotal += (total - tax);
      taxOnPurchases += tax;
      const ledgerCode = e.ledgerAccount || 'overig';
      if (!byLedger[ledgerCode]) {
        const acct = ledgerAccounts.find(a => a.code === ledgerCode);
        byLedger[ledgerCode] = { code: ledgerCode, name: acct?.name || 'Niet ingedeeld', group: acct?.group || '—', net: 0, tax: 0, total: 0, count: 0 };
      }
      byLedger[ledgerCode].net += (total - tax);
      byLedger[ledgerCode].tax += tax;
      byLedger[ledgerCode].total += total;
      byLedger[ledgerCode].count += 1;
    });

    return {
      periodInvoices,
      periodExpenses,
      salesByRate,
      salesTotal,
      salesTaxOnSales,
      purchasesTotal,
      taxOnPurchases,
      saldo: salesTaxOnSales - taxOnPurchases,
      byLedger: Object.values(byLedger).sort((a, b) => b.total - a.total),
    };
  }, [invoices, expenses, periodRange, ledgerAccounts]);

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
        return ['Inkoop', e.date, '', e.vendor, e.ledgerAccount + ' ' + (acct?.name || ''), (Number(e.amount) - Number(e.btwAmount)).toFixed(2), Number(e.btwAmount).toFixed(2), Number(e.amount).toFixed(2), e.currency || baseCurr, Number(e.originalAmount || e.amount).toFixed(2)];
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
          <h1 className="font-display text-4xl font-medium">Aangifte</h1>
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
                  background: year === y ? 'var(--ink)' : 'transparent',
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
          <div className="font-display text-2xl mt-2 num" style={{ color: 'var(--accent)' }}>{fmtCurrency(data.salesTaxOnSales, baseCurr)}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Over verkopen</div>
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
            <div>Verschuldigd: <span className="num font-medium">{fmtCurrency(data.salesTaxOnSales, baseCurr)}</span></div>
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
              {jur.salesTax.rates.map(rate => {
                const r = data.salesByRate[String(rate)] || { net: 0, tax: 0 };
                const rubriekKey = rate === 21 ? '1a' : rate === 9 ? '1b' : '1c';
                return (
                  <div key={rate} className="px-5 py-3 flex items-center justify-between text-sm">
                    <div>
                      <span className="font-mono font-medium mr-2">{rubriekKey}</span>
                      <span>{jur.rubrieken[rubriekKey]}</span>
                    </div>
                    <div className="flex gap-6 text-right">
                      <div>
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>Bedrag</div>
                        <div className="num font-medium">{fmtCurrency(r.net, baseCurr)}</div>
                      </div>
                      <div className="w-24">
                        <div className="text-xs" style={{ color: 'var(--muted)' }}>{jur.salesTax.name}</div>
                        <div className="num font-medium">{fmtCurrency(r.tax, baseCurr)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="px-5 py-3 flex items-center justify-between text-sm" style={{ background: 'var(--surface-2)' }}>
                <div><span className="font-mono font-medium mr-2">5a</span> Verschuldigde BTW</div>
                <div className="num font-medium w-24 text-right">{fmtCurrency(data.salesTaxOnSales, baseCurr)}</div>
              </div>
              <div className="px-5 py-3 flex items-center justify-between text-sm" style={{ background: 'var(--surface-2)' }}>
                <div><span className="font-mono font-medium mr-2">5b</span> Voorbelasting</div>
                <div className="num font-medium w-24 text-right">{fmtCurrency(data.taxOnPurchases, baseCurr)}</div>
              </div>
              <div className="px-5 py-3 flex items-center justify-between text-sm font-semibold" style={{ background: 'var(--ink)', color: '#fff' }}>
                <div><span className="font-mono mr-2">5c</span> Saldo te betalen / terug</div>
                <div className="num w-24 text-right">{fmtCurrency(data.saldo, baseCurr)}</div>
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
              <div className="px-5 py-3 flex items-center justify-between text-sm font-semibold" style={{ background: 'var(--ink)', color: '#fff' }}>
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
              {data.periodExpenses.map(e => (
                <div key={e.id} className="px-5 py-2.5 text-sm flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{e.vendor}</div>
                    <div className="text-xs truncate" style={{ color: 'var(--muted)' }}>
                      <span className="font-mono">{e.ledgerAccount || '—'}</span> · {fmtDate(e.date)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="num text-xs font-medium">{fmtCurrency(e.amount, baseCurr)}</div>
                    {e.currency && e.currency !== baseCurr && (
                      <div className="num text-[10px]" style={{ color: 'var(--muted)' }}>{fmtCurrency(e.originalAmount, e.currency)}</div>
                    )}
                  </div>
                </div>
              ))}
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
// AI ADVISOR VIEW (Bedrijfsrapportage + fiscaal advies)
// ============================================================================
const AIAdvisorView = ({ entities, activeEntity, invoices, expenses, clients, settings }) => {
  const [mode, setMode] = useState('report'); // 'report' | 'advice' | 'chat'
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState('');
  const [error, setError] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([]);

  const apiKey = resolveApiKey(settings.apiKey);
  const jur = JURISDICTIONS[activeEntity?.jurisdiction || 'NL'];

  // Build current financial snapshot for context
  const snapshot = useMemo(() => {
    if (!activeEntity) return null;
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const entityInvoices = invoices.filter(i => i.entityId === activeEntity.id);
    const entityExpenses = expenses.filter(e => e.entityId === activeEntity.id);

    const yearInvoices = entityInvoices.filter(i => i.status === 'paid' && i.paidAt && new Date(i.paidAt) >= yearStart);
    const yearExpenses = entityExpenses.filter(e => e.status === 'processed' && e.date && new Date(e.date) >= yearStart);
    const revenue = yearInvoices.reduce((s, i) => s + computeInvoice(i.items).total, 0);
    const costs = yearExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const btwOwed = yearInvoices.reduce((s, i) => s + computeInvoice(i.items).btwTotal, 0);
    const btwReclaim = yearExpenses.reduce((s, e) => s + Number(e.btwAmount || 0), 0);

    // Top clients by revenue
    const byClient = {};
    yearInvoices.forEach(inv => {
      const c = clients.find(cl => cl.id === inv.clientId);
      if (!c) return;
      const t = computeInvoice(inv.items).total;
      byClient[c.name] = (byClient[c.name] || 0) + t;
    });
    const topClients = Object.entries(byClient).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Costs by ledger
    const byLedger = {};
    yearExpenses.forEach(e => {
      const code = e.ledgerAccount || 'overig';
      byLedger[code] = (byLedger[code] || 0) + Number(e.amount || 0);
    });
    const topCosts = Object.entries(byLedger).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // Outstanding
    const outstanding = entityInvoices.filter(i => i.status === 'sent').reduce((s, i) => s + computeInvoice(i.items).total, 0);
    const overdue = entityInvoices.filter(i => computeInvoiceStatus(i) === 'overdue').reduce((s, i) => s + computeInvoice(i.items).total, 0);

    return {
      entity: activeEntity,
      year: now.getFullYear(),
      revenue, costs, profit: revenue - costs,
      btwOwed, btwReclaim, btwNet: btwOwed - btwReclaim,
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
- Omzet (betaalde facturen): ${fmtCurrency(snapshot.revenue, jur.baseCurrency)}
- Kosten (verwerkte bonnen): ${fmtCurrency(snapshot.costs, jur.baseCurrency)}
- Winst voor belasting: ${fmtCurrency(snapshot.profit, jur.baseCurrency)}
- Aantal facturen: ${snapshot.invoiceCount}
- Aantal bonnen: ${snapshot.expenseCount}

${jur.salesTax.name}:
- Verschuldigd over verkopen: ${fmtCurrency(snapshot.btwOwed, jur.baseCurrency)}
- Voorbelasting (terug te vorderen): ${fmtCurrency(snapshot.btwReclaim, jur.baseCurrency)}
- Saldo: ${fmtCurrency(snapshot.btwNet, jur.baseCurrency)} (${snapshot.btwNet >= 0 ? 'af te dragen' : 'terug te vorderen'})

OPENSTAAND:
- Verstuurd, nog niet betaald: ${fmtCurrency(snapshot.outstanding, jur.baseCurrency)}
- Te laat (overdue): ${fmtCurrency(snapshot.overdue, jur.baseCurrency)}

TOP KLANTEN (year-to-date):
${snapshot.topClients.map(([n, v], i) => `${i + 1}. ${n}: ${fmtCurrency(v, jur.baseCurrency)}`).join('\n')}

KOSTEN PER GROOTBOEK (year-to-date):
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

      const result = await callClaude({ system, prompt, apiKey, maxTokens: 1500 });
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

      const result = await callClaude({ system, prompt, apiKey, maxTokens: 1800 });
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
      const headers = { 'Content-Type': 'application/json', 'x-api-key': resolveApiKey(apiKey), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1500, system, messages }),
      });
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const data = await resp.json();
      const result = data.content?.find(b => b.type === 'text')?.text || '';
      setChatHistory(h => [...h, { role: 'assistant', content: result }]);
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

  const renderMarkdown = (text) => {
    // Lightweight markdown rendering
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('## ')) return <h3 key={i} className="font-display text-xl font-medium mt-5 mb-2">{line.slice(3)}</h3>;
      if (line.startsWith('### ')) return <h4 key={i} className="font-semibold text-base mt-4 mb-1.5">{line.slice(4)}</h4>;
      if (line.startsWith('# ')) return <h2 key={i} className="font-display text-2xl font-medium mt-6 mb-3">{line.slice(2)}</h2>;
      if (line.match(/^\d+\.\s+\*\*/)) {
        const m = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*:?\s*(.*)/);
        if (m) return <div key={i} className="mt-3"><strong>{m[1]}. {m[2]}</strong>{m[3] && `: ${m[3]}`}</div>;
      }
      if (line.startsWith('- ')) {
        const content = line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        return <li key={i} className="ml-5 list-disc" dangerouslySetInnerHTML={{ __html: content }} />;
      }
      if (line.trim() === '') return <div key={i} className="h-2" />;
      const content = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      return <p key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: content }} />;
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-4xl font-medium">AI Adviseur</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
          {activeEntity.name} · {jur.flag} {jur.name} · Live analyse van je cijfers
        </p>
      </div>

      <Card className="p-2 flex gap-1 flex-wrap">
        {[
          { id: 'report', label: 'Bedrijfsrapportage', icon: FileBarChart, action: runReport, desc: 'Snelle analyse van je YTD performance + concrete acties' },
          { id: 'advice', label: 'Fiscaal advies', icon: Lightbulb, action: runAdvice, desc: `${jur.salesTax.name}-optimalisatie en aftrekposten specifiek voor ${jur.name}` },
          { id: 'chat', label: 'Vrije vraag', icon: MessageSquare, action: null, desc: 'Stel zelf een vraag over je financiën of belastingen' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => { setMode(t.id); setOutput(''); }}
            className="flex-1 min-w-[160px] flex items-center gap-2 px-3 py-2.5 rounded text-sm font-medium transition-colors"
            style={{
              background: mode === t.id ? 'var(--ink)' : 'transparent',
              color: mode === t.id ? '#fff' : 'var(--ink-2)',
            }}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </Card>

      {/* Snapshot KPI strip */}
      {snapshot && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Omzet YTD</div>
            <div className="font-display text-xl mt-1 num">{fmtCurrency(snapshot.revenue, jur.baseCurrency)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Winst YTD</div>
            <div className="font-display text-xl mt-1 num" style={{ color: snapshot.profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>{fmtCurrency(snapshot.profit, jur.baseCurrency)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>{jur.salesTax.name} saldo</div>
            <div className="font-display text-xl mt-1 num" style={{ color: snapshot.btwNet >= 0 ? 'var(--accent)' : 'var(--success)' }}>{fmtCurrency(snapshot.btwNet, jur.baseCurrency)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--muted)' }}>Openstaand</div>
            <div className="font-display text-xl mt-1 num" style={{ color: snapshot.overdue > 0 ? 'var(--danger)' : 'var(--ink)' }}>{fmtCurrency(snapshot.outstanding, jur.baseCurrency)}</div>
          </Card>
        </div>
      )}

      {/* API key warning */}
      {!apiKey && (
        <Card className="p-4" style={{ background: 'var(--warning-soft)', borderColor: '#E5C088' }}>
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="mt-0.5" style={{ color: 'var(--warning)' }} />
            <div className="text-xs flex-1" style={{ color: 'var(--ink-2)' }}>
              <strong>API key niet ingesteld.</strong> Maak een bestand <span className="font-mono">.env.local</span> aan in de projectmap met: <span className="font-mono">VITE_ANTHROPIC_API_KEY=sk-ant-...</span> — of vul de key in via Instellingen → AI.
            </div>
          </div>
        </Card>
      )}

      {/* Action button or chat input */}
      {mode === 'chat' ? (
        <Card className="p-4">
          {chatHistory.length > 0 && (
            <div className="space-y-3 mb-4 max-h-96 overflow-y-auto scrollable">
              {chatHistory.map((msg, i) => (
                <div key={i} className={`p-3 rounded-lg text-sm ${msg.role === 'user' ? 'ml-8' : 'mr-8'}`} style={{ background: msg.role === 'user' ? 'var(--ink)' : 'var(--surface-2)', color: msg.role === 'user' ? '#fff' : 'var(--ink)' }}>
                  {msg.role === 'user' ? msg.content : renderMarkdown(msg.content)}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && sendChat()}
              placeholder="Stel een vraag over je financiën, belastingen, structuur..."
              className="flex-1 px-3 py-2.5 text-sm bg-white rounded-md border"
              style={{ borderColor: 'var(--border-strong)' }}
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
                {mode === 'report' ? 'Bedrijfsrapportage' : 'Fiscaal advies'}
              </h3>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                {mode === 'report' ? 'Analyse van je YTD performance + concrete acties' : `${jur.salesTax.name}-optimalisatie en aftrekposten specifiek voor ${jur.name}`}
              </p>
            </div>
            <Button onClick={mode === 'report' ? runReport : runAdvice} disabled={loading}>
              {loading ? <><RefreshCw size={14} className="animate-spin" /> Genereren...</> : <><Wand2 size={14} /> Genereer</>}
            </Button>
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-4" style={{ background: 'var(--danger-soft)', borderColor: '#E5B0B0' }}>
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
            <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
              AI Analyse · {new Date().toLocaleString('nl-NL')}
            </div>
          </div>
          <div className="prose prose-sm max-w-none" style={{ color: 'var(--ink)' }}>
            {renderMarkdown(output)}
          </div>
          <div className="mt-6 pt-4 border-t flex justify-end gap-2" style={{ borderColor: 'var(--border)' }}>
            <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard?.writeText(output); }}>
              <Copy size={12} /> Kopieer
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
const SettingsView = ({ settings, setSettings, activeEntity, entities, setEntities, clients, initialSection, updateProfile, profile, user }) => {
  const [section, setSection] = useState(initialSection || 'jurisdiction');
  const [draft, setDraft] = useState(settings);
  const [savedFlash, setSavedFlash] = useState(false);
  const [profileName, setProfileName] = useState(profile?.full_name || '');
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    if (initialSection) setSection(initialSection);
  }, [initialSection]);

  const saveProfileName = async () => {
    if (updateProfile) await updateProfile({ full_name: profileName });
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
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
    await setSettings(draft);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const sections = [
    { id: 'profile', label: 'Mijn Profiel' },
    { id: 'jurisdiction', label: 'Land & Valuta' },
    { id: 'templates', label: 'Factuur Templates' },
    { id: 'reminders', label: 'Herinneringen' },
    { id: 'email', label: 'Email & WhatsApp' },
    { id: 'categories', label: 'Categorieën' },
    { id: 'ai', label: 'AI' },
    { id: 'credit', label: 'Creditbeheer' },
    { id: 'status', label: 'Status' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl font-medium">Instellingen</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Configureer je facturatie en boekhouding</p>
        </div>
        <Button onClick={save}>
          {savedFlash ? <><Check size={14} /> Opgeslagen</> : <><Save size={14} /> Opslaan</>}
        </Button>
      </div>

      <Card className="p-2 overflow-x-auto scrollable">
        <div className="flex gap-1">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className="px-4 py-2 text-sm rounded font-medium whitespace-nowrap transition-colors"
              style={{
                background: section === s.id ? 'var(--ink)' : 'transparent',
                color: section === s.id ? '#fff' : 'var(--ink-2)',
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </Card>

      {section === 'profile' && (
        <div className="space-y-5">
          <Card className="p-6 space-y-5">
            <h3 className="font-display text-lg font-medium">Mijn profiel</h3>
            <div className="flex items-center gap-4">
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #4f46e5, #818cf8)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', fontWeight: '700', color: '#fff',
                boxShadow: '0 4px 12px rgba(79,70,229,0.35)',
              }}>
                {(profileName || profile?.full_name || user?.email || 'G')[0].toUpperCase()}
              </div>
              <div>
                <div className="font-semibold" style={{ color: 'var(--text)' }}>{profileName || 'Naam niet ingesteld'}</div>
                <div className="text-sm" style={{ color: 'var(--muted)' }}>{user?.email || ''}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Volledige naam"
                value={profileName}
                onChange={e => setProfileName(e.target.value)}
                placeholder="Jan de Vries"
              />
              <Input
                label="E-mailadres"
                value={user?.email || ''}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={saveProfileName}>
                {profileSaved ? <><Check size={14} /> Opgeslagen</> : <><Save size={14} /> Naam opslaan</>}
              </Button>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>E-mailadres kan niet worden gewijzigd</span>
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="font-display text-base font-medium">Account info</h3>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span style={{ color: 'var(--muted)' }}>Rol</span>
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                {profile?.role === 'platform_admin' ? 'Platform Admin' : profile?.role === 'org_owner' ? 'Eigenaar' : profile?.role === 'accountant' ? 'Accountant' : 'Medewerker'}
              </span>
              {profile?.organization_id && <>
                <span style={{ color: 'var(--muted)' }}>Organisatie ID</span>
                <span style={{ color: 'var(--text)', fontFamily: 'monospace', fontSize: '11px' }}>{profile.organization_id}</span>
              </>}
            </div>
          </Card>
        </div>
      )}

      {section === 'jurisdiction' && (
        <div className="space-y-5">
          <Card className="p-6 space-y-5">
            <h3 className="font-display text-lg font-medium">Belastingjurisdictie</h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Kies onder welke belastingdienst je je administratie voert. Dit bepaalt BTW-tarieven, grootboekrekeningen, aangiftefrequentie en de basis-valuta.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                    className="text-left p-4 rounded-lg border-2 transition-all"
                    style={{
                      borderColor: isActive ? 'var(--ink)' : 'var(--border)',
                      background: isActive ? 'var(--surface-2)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xl">{j.flag}</span>
                      <span className="font-display text-sm font-medium leading-tight">{j.name}</span>
                      {isActive && <Check size={12} className="ml-auto shrink-0" style={{ color: 'var(--success)' }} />}
                    </div>
                    {j.code !== 'CUSTOM' && (
                      <div className="text-xs space-y-0.5" style={{ color: 'var(--muted)' }}>
                        <div>{j.salesTax.name} {j.salesTax.standard}%</div>
                        <div>{j.baseCurrency} · {j.filingPeriod === 'quarterly' ? 'Kwartaal' : 'Maandelijks'}</div>
                      </div>
                    )}
                    {j.code === 'CUSTOM' && (
                      <div className="text-xs" style={{ color: 'var(--muted)' }}>Eigen tarieven & regels</div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Custom jurisdiction editor */}
          {(draft.jurisdiction || 'NL') === 'CUSTOM' && (
            <Card className="p-6 space-y-4">
              <h3 className="font-display text-lg font-medium">Handmatige jurisdictie-instellingen</h3>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Vul hieronder de belastingregels in voor jouw land of situatie. Deze worden getoond in het Aangifte-overzicht en op facturen.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label="Landnaam" value={draft.customJurisdiction?.countryName || ''} onChange={e => update('customJurisdiction.countryName', e.target.value)} placeholder="bijv. Singapore" />
                <Input label="Belastingtype / naam" value={draft.customJurisdiction?.taxName || ''} onChange={e => update('customJurisdiction.taxName', e.target.value)} placeholder="bijv. GST, VAT, TVA" />
                <Input label="Standaard belastingtarief (%)" type="number" min="0" max="100" step="0.1" value={draft.customJurisdiction?.standardRate ?? ''} onChange={e => update('customJurisdiction.standardRate', Number(e.target.value))} placeholder="bijv. 9" />
                <Select label="Basis-valuta" value={draft.customJurisdiction?.currency || 'EUR'} onChange={e => { update('customJurisdiction.currency', e.target.value); update('baseCurrency', e.target.value); }}>
                  {SUPPORTED_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
                </Select>
                <Select label="Aangiftefrequentie" value={draft.customJurisdiction?.filingPeriod || 'quarterly'} onChange={e => update('customJurisdiction.filingPeriod', e.target.value)}>
                  <option value="quarterly">Per kwartaal</option>
                  <option value="monthly">Maandelijks</option>
                  <option value="yearly">Jaarlijks</option>
                </Select>
                <Input label="Indientermijn" value={draft.customJurisdiction?.filingDeadline || ''} onChange={e => update('customJurisdiction.filingDeadline', e.target.value)} placeholder="bijv. 30 dagen na kwartaaleinde" />
                <Input label="Registratiegrens" value={draft.customJurisdiction?.registrationThreshold || ''} onChange={e => update('customJurisdiction.registrationThreshold', e.target.value)} placeholder="bijv. € 20.000 omzet/jaar" />
                <Input label="Bewaarplicht" value={draft.customJurisdiction?.retentionPeriod || ''} onChange={e => update('customJurisdiction.retentionPeriod', e.target.value)} placeholder="bijv. 7 jaar" />
              </div>
              <div className="space-y-3 pt-2">
                <p className="text-xs font-medium" style={{ color: 'var(--ink-2)' }}>Extra belastingregels (optioneel)</p>
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
                <h3 className="font-display text-lg font-medium mb-3">⚙️ Handmatige jurisdictie — {draft.customJurisdiction?.countryName || 'Eigen land'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    { label: 'Belastingtype', value: draft.customJurisdiction?.taxName || '—' },
                    { label: 'Standaard tarief', value: draft.customJurisdiction?.standardRate != null ? `${draft.customJurisdiction.standardRate}%` : '—' },
                    { label: 'Basis-valuta', value: draft.customJurisdiction?.currency || draft.baseCurrency || 'EUR' },
                    { label: 'Aangiftefrequentie', value: draft.customJurisdiction?.filingPeriod === 'monthly' ? 'Maandelijks' : draft.customJurisdiction?.filingPeriod === 'yearly' ? 'Jaarlijks' : 'Per kwartaal' },
                    { label: 'Indientermijn', value: draft.customJurisdiction?.filingDeadline || '—' },
                    { label: 'Registratiegrens', value: draft.customJurisdiction?.registrationThreshold || '—' },
                    { label: 'Bewaarplicht', value: draft.customJurisdiction?.retentionPeriod || '—' },
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
                <h3 className="font-display text-lg font-medium mb-3">Belastingvoorwaarden — {JURISDICTIONS[draft.jurisdiction || 'NL'].flag} {JURISDICTIONS[draft.jurisdiction || 'NL'].name}</h3>
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
              Deze regels worden ook in het Aangifte-overzicht getoond. De app berekent alle bedragen aangifte-ready; je accountant doet de daadwerkelijke indiening.
            </div>
          </Card>

          {/* Currency settings */}
          <Card className="p-6 space-y-4">
            <h3 className="font-display text-lg font-medium">Valuta</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select label="Basis-valuta (voor rapportage)" value={draft.baseCurrency || 'EUR'} onChange={e => update('baseCurrency', e.target.value)}>
                {SUPPORTED_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.symbol} {c.code} — {c.name}</option>)}
              </Select>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--ink-2)' }}>Actieve valuta voor bonnen</label>
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
                          background: active ? 'var(--ink)' : 'transparent',
                          color: active ? '#fff' : 'var(--ink-2)',
                          borderColor: active ? 'var(--ink)' : 'var(--border-strong)',
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
                Bij het verwerken van een bon in vreemde valuta haalt de app de huidige koers op via een gratis ECB-gebaseerde service. Origineel bedrag, koers en geconverteerd bedrag worden allemaal bewaard voor je administratie.
              </div>
            </div>
            {draft.exchangeRates?.fetched && (
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Laatste koersen opgehaald: {fmtDate(draft.exchangeRates.fetched)} ({draft.exchangeRates.base})
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
                <strong>Kies factuur stijl voor: {activeEntity?.name}</strong>
                <div className="mt-1" style={{ color: 'var(--muted)' }}>
                  Iedere bedrijfseenheid kan een eigen template hebben. Switch via de selector linksboven naar een ander bedrijf om de template daarvoor in te stellen.
                </div>
              </div>
            </div>
          </Card>
          {activeEntity && (
            <TemplateGallery
              entity={activeEntity}
              onUpdate={async (updatedEntity) => {
                await setEntities(entities.map(e => e.id === updatedEntity.id ? updatedEntity : e));
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
            <h3 className="font-display text-lg mb-2 font-medium">AI integratie</h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              De app gebruikt Claude voor bedrijfsrapportage en fiscaal advies. Veiligste aanpak: zet <span className="font-mono text-xs">VITE_ANTHROPIC_API_KEY=sk-ant-...</span> in een <span className="font-mono text-xs">.env.local</span> bestand. Of vul de key hieronder in als fallback.
            </p>
          </div>
          <Input
            label="Anthropic API key"
            type="password"
            value={draft.apiKey || ''}
            onChange={e => update('apiKey', e.target.value)}
            placeholder="sk-ant-..."
            hint="Krijg een key op console.anthropic.com — alleen nodig voor productie deployment"
          />
          <div className="rounded-md p-3 text-xs flex items-start gap-2" style={{ background: 'var(--warning-soft)', color: 'var(--ink-2)' }}>
            <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
            <div>
              <strong>Productie security:</strong> Gebruik <span className="font-mono">.env.local</span> voor de key (wordt nooit meegebundeld naar git). Voor een gedeelde/publieke deployment: gebruik een Supabase Edge Function als proxy zodat de key server-side blijft.
            </div>
          </div>
        </Card>
      )}

      {section === 'reminders' && (
        <Card className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-medium">Herinneringen</h3>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.reminders.enabled}
                onChange={e => update('reminders.enabled', e.target.checked)}
                className="w-4 h-4"
              />
              <span>Auto-herinneringen aan</span>
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--ink-2)' }}>Schema (dagen na vervaldatum)</label>
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
                  hint={`${idx + 1}e herinnering`}
                />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-medium" style={{ color: 'var(--ink-2)' }}>Templates</h4>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Variabelen: <code>{'{{number}}'}</code> <code>{'{{contact}}'}</code> <code>{'{{amount}}'}</code> <code>{'{{date}}'}</code> <code>{'{{dueDate}}'}</code> <code>{'{{iban}}'}</code> <code>{'{{senderName}}'}</code>
            </p>
            {draft.reminders.templates.map((tmpl, idx) => (
              <Card key={idx} className="p-4 space-y-3" style={{ background: 'var(--surface-2)' }}>
                <Input label={`Template ${idx + 1} naam`} value={tmpl.name} onChange={e => {
                  const t = [...draft.reminders.templates];
                  t[idx] = { ...t[idx], name: e.target.value };
                  update('reminders.templates', t);
                }} />
                <Input label="Onderwerp" value={tmpl.subject} onChange={e => {
                  const t = [...draft.reminders.templates];
                  t[idx] = { ...t[idx], subject: e.target.value };
                  update('reminders.templates', t);
                }} />
                <Textarea label="Bericht" rows={5} value={tmpl.body} onChange={e => {
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
            <h3 className="font-display text-lg font-medium">Email instellingen</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Afzender naam" value={draft.email.fromName} onChange={e => update('email.fromName', e.target.value)} />
              <Input label="Afzender email" value={draft.email.fromEmail} onChange={e => update('email.fromEmail', e.target.value)} placeholder="paul@denhartoghsolutions.com" />
            </div>
            <Input
              label="Resend API key (voor email verzending)"
              type="password"
              value={draft.email.resendApiKey || ''}
              onChange={e => update('email.resendApiKey', e.target.value)}
              placeholder="re_..."
              hint="Maak een gratis account aan op resend.com — tot 3.000 mails/maand gratis"
            />
            <Input label="Standaard onderwerp factuur" value={draft.email.invoiceSubject} onChange={e => update('email.invoiceSubject', e.target.value)} />
            <Textarea label="Standaard bericht factuur" rows={5} value={draft.email.invoiceBody} onChange={e => update('email.invoiceBody', e.target.value)} />
          </Card>

          <Card className="p-6 space-y-5">
            <div className="flex items-center gap-2">
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(37,211,102,0.13)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <MessageSquare size={16} style={{ color: '#25d366' }} />
              </div>
              <div>
                <h3 className="font-display text-lg font-medium">WhatsApp</h3>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Facturen versturen via WhatsApp met een vooraf ingesteld bericht</p>
              </div>
            </div>
            <Input
              label="Jouw WhatsApp-nummer (incl. landcode)"
              value={draft.email.whatsappNumber || ''}
              onChange={e => update('email.whatsappNumber', e.target.value)}
              placeholder="+31612345678"
              hint="Dit is het nummer dat in de facturen als afzender wordt weergegeven"
            />
            <Textarea
              label="Standaard WhatsApp-bericht"
              rows={4}
              value={draft.email.whatsappMessage || ''}
              onChange={e => update('email.whatsappMessage', e.target.value)}
              hint="Variabelen: {{contact}} {{number}} {{amount}} {{dueDate}} {{iban}}"
            />
            <div className="rounded-md p-3 text-xs flex items-start gap-2" style={{ background: 'rgba(37,211,102,0.08)', color: '#16a34a' }}>
              <MessageSquare size={13} className="mt-0.5 shrink-0" />
              <div>Wanneer je op "Verstuur via WhatsApp" klikt op een factuur, opent WhatsApp Web automatisch met het ingevulde bericht. Geen API-koppeling nodig.</div>
            </div>
          </Card>
        </div>
      )}

      {section === 'categories' && (
        <Card className="p-6 space-y-4">
          <h3 className="font-display text-lg font-medium">Kosten-categorieën</h3>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Gebruikt bij het verwerken van bonnen voor je BTW-aangifte.</p>
          <div className="space-y-2">
            {draft.categories.map((cat, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={cat}
                  onChange={e => {
                    const cs = [...draft.categories];
                    cs[idx] = e.target.value;
                    update('categories', cs);
                  }}
                  className="flex-1 px-3 py-2 text-sm bg-white rounded-md border"
                  style={{ borderColor: 'var(--border-strong)' }}
                />
                <button onClick={() => update('categories', draft.categories.filter((_, i) => i !== idx))} className="p-2 rounded hover:bg-red-50">
                  <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                </button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => update('categories', [...draft.categories, ''])}>
              <Plus size={12} /> Categorie toevoegen
            </Button>
          </div>
        </Card>
      )}

      {section === 'credit' && (
        <div className="space-y-5">
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-medium">Creditbeheer</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Volg laattijdige betalingen en stel escalatiedrempels in.</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.creditManagement?.enabled ?? true} onChange={e => update('creditManagement.enabled', e.target.checked)} className="w-4 h-4" />
                <span>Ingeschakeld</span>
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Escalatiegrens (aantal te late betalingen)"
                type="number"
                min="1"
                value={draft.creditManagement?.latePaymentThreshold ?? 3}
                onChange={e => update('creditManagement.latePaymentThreshold', Number(e.target.value))}
                hint="Aanbeveling voor dossieraanmaak na dit aantal te late betalingen"
              />
              <Input
                label="Hoge factuurgrens (€) — bel-aanbeveling"
                type="number"
                min="0"
                value={draft.creditManagement?.highValueThreshold ?? 5000}
                onChange={e => update('creditManagement.highValueThreshold', Number(e.target.value))}
                hint="Aanbeveling voor telefonisch contact bij openstaande bedragen boven dit bedrag"
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="font-display text-lg font-medium">Deurwaarder / Incassobureau</h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Gegevens van de partij waarnaar dossiers worden gestuurd. Wordt automatisch ingevuld in dossier-emails.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Contactpersoon naam" value={draft.creditManagement?.debtCollector?.name || ''} onChange={e => update('creditManagement.debtCollector.name', e.target.value)} placeholder="Jan de Vries" />
              <Input label="Bedrijfsnaam" value={draft.creditManagement?.debtCollector?.company || ''} onChange={e => update('creditManagement.debtCollector.company', e.target.value)} placeholder="Incasso Groep BV" />
              <Input label="E-mailadres" type="email" value={draft.creditManagement?.debtCollector?.email || ''} onChange={e => update('creditManagement.debtCollector.email', e.target.value)} placeholder="incasso@bureau.nl" />
              <Input label="Telefoon" value={draft.creditManagement?.debtCollector?.phone || ''} onChange={e => update('creditManagement.debtCollector.phone', e.target.value)} placeholder="+31 20 123 4567" />
              <Input label="Website" value={draft.creditManagement?.debtCollector?.website || ''} onChange={e => update('creditManagement.debtCollector.website', e.target.value)} placeholder="https://incasso.nl" />
            </div>
            <div>
              <Textarea
                label="Notities / instructies"
                rows={3}
                value={draft.creditManagement?.debtCollector?.notes || ''}
                onChange={e => update('creditManagement.debtCollector.notes', e.target.value)}
                placeholder="Eventuele instructies of opmerkingen voor het incassobureau..."
              />
            </div>
          </Card>

          <Card className="p-6 space-y-4">
            <h3 className="font-display text-lg font-medium">AI Credit Check (Graydon / extern)</h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Voeg een Graydon API-key toe voor externe bedrijfsdata in de AI-creditanalyse. Zonder key analyseert Claude op basis van de lokale betalingshistorie.
            </p>
            <Input
              label="Graydon API key (optioneel)"
              type="password"
              value={draft.creditManagement?.graydonApiKey || ''}
              onChange={e => update('creditManagement.graydonApiKey', e.target.value)}
              placeholder="graydon_live_..."
              hint="Verkrijgbaar via graydon.nl — verrijkt de AI-analyse met externe kredietdata"
            />
            <div className="rounded-md p-3 text-xs flex items-start gap-2" style={{ background: 'var(--info-soft)', color: 'var(--info)' }}>
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <div>Ga naar <strong>Creditbeheer</strong> in de navigatie om klantrisico's te bekijken, dossiers aan te maken en AI-analyses uit te voeren.</div>
            </div>
          </Card>
        </div>
      )}

      {section === 'status' && (() => {
        const hasAiKey = !!(import.meta.env.VITE_ANTHROPIC_API_KEY || draft.apiKey);
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
              <h3 className="font-display text-lg font-medium mb-1">Systeem status</h3>
              <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>Overzicht van alle koppelingen en API-sleutels</p>
              <div>
                <StatusRow
                  label="AI (Claude)"
                  ok={hasAiKey}
                  okText="API key geconfigureerd"
                  failText="Geen API key — stel in via Instellingen → AI"
                  action={!hasAiKey ? { label: 'Instellen', onClick: () => setSection('ai') } : null}
                />
                <StatusRow
                  label="Email verzending (Resend)"
                  ok={hasResend}
                  okText={`Resend API key aanwezig${hasEmail ? ` · afzender: ${draft.email.fromEmail}` : ''}`}
                  failText="Geen Resend API key — stel in via Email & WhatsApp"
                  action={!hasResend ? { label: 'Instellen', onClick: () => setSection('email') } : null}
                />
                <StatusRow
                  label="Afzender e-mailadres"
                  ok={hasEmail}
                  okText={draft.email.fromEmail}
                  failText="Geen afzender e-mail — stel in via Email & WhatsApp"
                  action={!hasEmail ? { label: 'Instellen', onClick: () => setSection('email') } : null}
                />
                <StatusRow
                  label="WhatsApp"
                  ok={hasWhatsApp}
                  okText={`Ingesteld op ${draft.email.whatsappNumber}`}
                  failText="Geen WhatsApp-nummer — stel in via Email & WhatsApp"
                  action={!hasWhatsApp ? { label: 'Instellen', onClick: () => setSection('email') } : null}
                />
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="font-display text-lg font-medium">Snelle acties</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { label: 'AI instellen', icon: Brain, onClick: () => setSection('ai'), ok: hasAiKey },
                  { label: 'Email instellen', icon: Mail, onClick: () => setSection('email'), ok: hasEmail && hasResend },
                  { label: 'WhatsApp instellen', icon: MessageSquare, onClick: () => setSection('email'), ok: hasWhatsApp },
                ].map(a => (
                  <button key={a.label} onClick={a.onClick} className="p-4 rounded-lg border text-left transition-all hover:opacity-80"
                    style={{ borderColor: a.ok ? 'var(--success)' : 'var(--border-2)', background: a.ok ? 'var(--success-soft)' : 'var(--surface-2)' }}>
                    <a.icon size={18} style={{ color: a.ok ? 'var(--success)' : 'var(--accent)', marginBottom: 8 }} />
                    <div className="text-sm font-medium">{a.label}</div>
                    <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{a.ok ? 'Geconfigureerd' : 'Vereist setup'}</div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        );
      })()}
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
      <div>
        <h1 className="font-display text-2xl font-medium mb-1" style={{ color: 'var(--ink)' }}>Koppelingen</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Snelle toegang tot externe tools en diensten.</p>
      </div>

      {categories.map(cat => (
        <div key={cat}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{cat}</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {LINKS.filter(l => l.category === cat).map(link => {
              const Icon = link.icon;
              return (
                <Card key={link.id} className="p-5 flex flex-col gap-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <Icon />
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
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
                    style={{ background: 'var(--ink)', color: '#fff' }}
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
  const { user, profile, signOut, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settingsOpenSection, setSettingsOpenSection] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('dhs_theme') || 'dark');
  const [settings, setSettings, settingsLoaded] = useCloudStorage('settings', DEFAULT_SETTINGS);

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
  const [purchaseInvoices, setPurchaseInvoices, purchaseInvoicesLoaded] = useCloudStorage('purchase_invoices', []);
  const [reminderModal, setReminderModal] = useState(null);

  const loaded = settingsLoaded && clientsLoaded && invoicesLoaded && expensesLoaded && entitiesLoaded && quotesLoaded && horizonDataLoaded && purchaseInvoicesLoaded;
  const openCount = expenses.filter(e => e.status === 'open').length;

  // MIGRATION: if no entities yet, create one from settings.company
  useEffect(() => {
    if (!loaded) return;
    if (entities.length === 0) {
      const firstEntity = createDefaultEntity(settings);
      setEntities([firstEntity]);
      if (!settings.activeEntityId) {
        setSettings({ ...settings, activeEntityId: firstEntity.id });
      }
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
  const activeEntity = entities.find(e => e.id === activeEntityId);

  const handleSendReminder = (invoice, level) => {
    setReminderModal({ invoice, level });
  };

  const confirmReminder = async (invoice, level) => {
    const updated = invoices.map(i => i.id === invoice.id ? {
      ...i,
      remindersSent: [...(i.remindersSent || []), { date: new Date().toISOString(), level }]
    } : i);
    await setInvoices(updated);
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
        openCount={entityExpenses.filter(e => e.status === 'open').length}
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
        <div className="max-w-6xl mx-auto p-5 md:p-8 pb-20 lg:pb-8">
          {activeTab === 'dashboard' && (
            <Dashboard invoices={entityInvoices} expenses={entityExpenses} clients={clients} settings={settings} activeEntity={activeEntity} setActiveTab={setActiveTab} onSendReminder={handleSendReminder} />
          )}
          {activeTab === 'invoices' && (
            <InvoicesView invoices={entityInvoices} setInvoices={setInvoices} allInvoices={invoices} clients={clients} settings={settings} setSettings={setSettings} activeEntity={activeEntity} setEntities={setEntities} entities={entities} onSendReminder={handleSendReminder} />
          )}
          {activeTab === 'clients' && (
            <ClientsView clients={clients} setClients={setClients} invoices={invoices} />
          )}
          {activeTab === 'expenses' && (
            <ExpensesView expenses={entityExpenses} setExpenses={setExpenses} allExpenses={expenses} settings={settings} setSettings={setSettings} activeEntity={activeEntity} />
          )}
          {activeTab === 'inkoop' && (
            <PurchaseInvoicesView
              purchaseInvoices={entityPurchaseInvoices}
              setPurchaseInvoices={setPurchaseInvoices}
              allPurchaseInvoices={purchaseInvoices}
              settings={settings}
              activeEntity={activeEntity}
            />
          )}
          {activeTab === 'import' && (
            <ImportView
              setInvoices={setInvoices}
              setExpenses={setExpenses}
              clients={clients}
              settings={settings}
              activeEntity={activeEntity}
            />
          )}
          {activeTab === 'entities' && (
            <EntitiesView entities={entities} setEntities={setEntities} activeEntityId={activeEntityId} setActiveEntityId={setActiveEntityId} invoices={invoices} expenses={expenses} />
          )}
          {activeTab === 'tax' && (
            <TaxReportView invoices={entityInvoices} expenses={entityExpenses} clients={clients} settings={settings} activeEntity={activeEntity} />
          )}
          {activeTab === 'ai' && (
            <AIAdvisorView entities={entities} activeEntity={activeEntity} invoices={invoices} expenses={expenses} clients={clients} settings={settings} />
          )}
          {(activeTab === 'quotes' || signToken) && (
            <QuotesView
              quotes={quotes} setQuotes={setQuotes}
              clients={clients} settings={settings} activeEntity={activeEntity}
              signToken={signToken}
              onConvertToInvoice={(inv) => { setInvoices(prev => [inv, ...prev]); setActiveTab('invoices'); }}
            />
          )}
          {activeTab === 'boekhouding' && (
            <BoekhoudenView
              invoices={entityInvoices}
              expenses={entityExpenses}
              assets={boekAssets}
              setAssets={setBoekAssets}
              entries={boekEntries}
              setEntries={setBoekEntries}
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
              settings={settings}
              entity={activeEntity}
              onSendReminder={handleSendReminder}
            />
          )}
          {activeTab === 'links' && (
            <LinksView />
          )}
          {activeTab === 'settings' && (
            <SettingsView settings={settings} setSettings={setSettings} activeEntity={activeEntity} entities={entities} setEntities={setEntities} clients={clients} initialSection={settingsOpenSection} updateProfile={updateProfile} profile={profile} user={user} />
          )}
        </div>
      </main>

      {reminderModal && (
        <SendInvoiceModal
          invoice={reminderModal.invoice}
          client={clients.find(c => c.id === reminderModal.invoice.clientId)}
          settings={settings}
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
