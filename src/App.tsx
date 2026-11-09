import { MetricGuide } from './pages/MetricGuide';
import { type DividendMode, type ProjectionPlans } from './calculations/projection';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  ChartNoAxesCombined,
  ChevronDown,
  Database,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  LayoutDashboard,
  BookOpen,
  Menu,
  Moon,
  PanelLeftClose,
  PieChart,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TrendingUp,
  X,
} from 'lucide-react';
import type { DataSet } from './services/data';
import { loadData } from './services/data';
import { useModel } from './services/model';
import type { Mode, ReturnKind } from './data/types';
import { defaultScenarios } from './calculations/scenarios';
import { Overview } from './pages/Overview';
import { Financial } from './pages/Financial';
import { Risk } from './pages/Risk';
import { Calculator, PortfolioPage } from './pages/Portfolio';
import { Forecast } from './pages/Forecast';
import { Stability } from './pages/Stability';
import { Sources } from './pages/Sources';
import { exportCSV, exportPDF, exportXLSX } from './utils/export';
import { Notice, Hint } from './components/ui';
import { date } from './utils/format';
const pages = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'financial', label: 'Финансовый анализ', icon: ChartNoAxesCombined },
  { id: 'risk', label: 'Доходность и риск', icon: Activity },
  { id: 'portfolio', label: 'Портфель Марковица', icon: PieChart },
  { id: 'calculator', label: 'Калькулятор', icon: SlidersHorizontal },
  { id: 'forecast', label: 'Прогноз 2026', icon: TrendingUp },
  { id: 'stability', label: 'Устойчивость', icon: ShieldCheck },
  { id: 'guide', label: 'Формулы и показатели', icon: BookOpen },
  { id: 'sources', label: 'Данные и источники', icon: Database },
];
function getPage() {
  const id = window.location.hash.slice(1).split('/')[0];
  return pages.some((p) => p.id === id) ? id : 'overview';
}
function safeTheme() {
  try {
    return localStorage.getItem('invest-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}
export default function App() {
  const [data, setData] = useState<DataSet | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    loadData()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Ошибка данных');
      });
    return () => {
      active = false;
    };
  }, []);
  return data ? (
    <Dashboard data={data} />
  ) : (
    <div className="loading">
      <div className="brand-mark">
        <ChartNoAxesCombined size={27} />
      </div>
      <h1>InvestAnalytics</h1>
      <p>
        {error
          ? `Не удалось проверить данные: ${error}`
          : 'Загружаем и проверяем данные исследования…'}
      </p>
      {error && (
        <button className="button" onClick={() => location.reload()}>
          Повторить
        </button>
      )}
    </div>
  );
}
function Dashboard({ data }: { data: DataSet }) {
  const [page, setPage] = useState(getPage),
    [mode, setMode] = useState<Mode>('compare'),
    [kind, setKind] = useState<ReturnKind>('price'),
    [start, setStart] = useState(2021),
    [rf, setRf] = useState(0.1),
    [weight, setWeight] = useState(0.5),
    [amount, setAmount] = useState(100000),
    [horizon, setHorizon] = useState(1),
    [method, setMethod] = useState('manual'),
    [dividendMode, setDividendMode] = useState<DividendMode>('reinvest'),
    [plans, setPlans] = useState<ProjectionPlans>({}),
    [guideMetric, setGuideMetric] = useState(() => location.hash.split('/')[1]),
    [scenarios, setScenarios] = useState(() => structuredClone(defaultScenarios)),
    [theme, setTheme] = useState(safeTheme),
    [mobile, setMobile] = useState(false),
    [exports, setExports] = useState(false),
    [exportError, setExportError] = useState(''),
    [busy, setBusy] = useState(false);
  const model = useModel(
    data,
    kind,
    start,
    rf,
    weight,
    amount,
    scenarios,
    horizon,
    dividendMode,
    plans,
  );
  useEffect(() => {
    const update = () => {
      setPage(getPage());
      setGuideMetric(location.hash.split('/')[1]);
      setMobile(false);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('invest-theme', theme);
    } catch {
      /* storage may be disabled */
    }
  }, [theme]);
  // A selected optimization method follows changes in the sample and risk-free rate.
  useEffect(() => {
    const m = model.model;
    if (m && method === 'minimum') setWeight(m.min.weight);
    if (m && method === 'sharpe') setWeight(m.max.weight);
  }, [model.model?.min.weight, model.model?.max.weight, method]);
  const controls = {
    model,
    weight,
    setWeight,
    rf,
    setRf,
    amount,
    setAmount,
    horizon,
    setHorizon,
    method,
    setMethod,
    dividendMode,
    setDividendMode,
    plans,
    setPlans,
    scenarios,
  };
  const ctx = useMemo(
    () => ({ data, model, kind, start, rf, weight, amount, scenarios, horizon }),
    [data, model, kind, start, rf, weight, amount, scenarios, horizon],
  );
  const navigate = (id: string) => {
    window.location.hash = id;
    setPage(id);
  };
  async function save(type: 'pdf' | 'xlsx' | 'csv') {
    setExports(false);
    setExportError('');
    try {
      if (type === 'pdf') exportPDF(ctx);
      if (type === 'csv') exportCSV(ctx);
      if (type === 'xlsx') {
        setBusy(true);
        await exportXLSX(ctx);
      }
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Не удалось создать отчёт');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label="Закрыть меню"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? 'is-open' : ''}`}>
        <a href="#overview" className="brand">
          <span className="brand-mark">
            <ChartNoAxesCombined size={22} />
          </span>
          <span>
            Invest<span className="brand-light">Analytics</span>
          </span>
        </a>
        <button
          className="mobile-close icon-button"
          aria-label="Закрыть навигацию"
          onClick={() => setMobile(false)}
        >
          <X size={20} />
        </button>
        <nav aria-label="Разделы исследования">
          {pages.map((p) => (
            <a
              href={`#${p.id}`}
              key={p.id}
              className={page === p.id ? 'active' : ''}
              aria-current={page === p.id ? 'page' : undefined}
            >
              <p.icon size={18} />
              {p.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="theme-button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}{' '}
            {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
            <span>◐</span>
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Открыть меню"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <PanelLeftClose size={17} className="desktop-icon" />
            <span>Исследования</span>
            <span className="crumb-slash">/</span>
            <strong>{pages.find((p) => p.id === page)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="educational-label">
              <GraduationCap size={15} />
              Университетский проект
            </span>
            <div className="export-wrap">
              <button
                className="button export-button"
                aria-expanded={exports}
                onClick={() => setExports(!exports)}
                disabled={busy}
              >
                <ArrowDownToLine size={16} />
                {busy ? 'Формируем…' : 'Экспорт отчёта'}
                <ChevronDown size={13} />
              </button>
              {exports && (
                <>
                  <button
                    className="dropdown-dismiss"
                    aria-label="Закрыть экспорт"
                    onClick={() => setExports(false)}
                  />
                  <div className="export-menu">
                    <button onClick={() => void save('pdf')}>
                      <FileText size={16} />
                      <span>
                        PDF-отчёт<small>Открыть для сохранения через печать</small>
                      </span>
                    </button>
                    <button onClick={() => void save('xlsx')}>
                      <FileSpreadsheet size={16} />
                      <span>
                        Excel с формулами<small>Данные, модели и источники</small>
                      </span>
                    </button>
                    <button onClick={() => void save('csv')}>
                      <Database size={16} />
                      <span>
                        CSV — исходные финансы<small>UTF-8 · разделитель ;</small>
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main>
          {page !== 'guide' && (
            <>
              <div className="global-controls">
                <div className="segmented company-switch" aria-label="Выбор компании">
                  <button
                    className={mode === 'SBER' ? 'active' : ''}
                    onClick={() => setMode('SBER')}
                  >
                    <i className="dot mint-bg" />
                    Сбербанк
                  </button>
                  <button className={mode === 'T' ? 'active' : ''} onClick={() => setMode('T')}>
                    <i className="dot blue-bg" />
                    Т-Технологии
                  </button>
                  <button
                    className={mode === 'compare' ? 'active' : ''}
                    onClick={() => setMode('compare')}
                  >
                    Сравнение
                  </button>
                </div>
                <div className="period-controls">
                  <label>
                    <span>Рыночный период</span>
                    <select
                      aria-label="Рыночный период"
                      value={start}
                      onChange={(e) => setStart(Number(e.target.value))}
                    >
                      <option value={2021}>2021 — 2025</option>
                      <option value={2023}>2023 — 2025</option>
                    </select>
                  </label>
                  <span className="data-status">
                    <span className="live-dot" />
                    Проверено {date(data.financial.updatedAt)}
                  </span>
                </div>
              </div>
              <div className="return-controls">
                <div className="segmented small">
                  <button
                    className={kind === 'price' ? 'active' : ''}
                    onClick={() => setKind('price')}
                  >
                    Ценовая доходность
                  </button>
                  <button
                    className={kind === 'total' ? 'active' : ''}
                    onClick={() => setKind('total')}
                  >
                    С дивидендами
                  </button>
                </div>
                <span>
                  {kind === 'price'
                    ? 'История: без дивидендов'
                    : 'История: условная реинвестиция в дату реестра · до налогов'}
                </span>
              </div>
              {exportError && <Notice tone="warn">{exportError}</Notice>}
              <p className="analysis-dates">
                {date(model.period.from)} — {date(model.period.till)} · {model.pair.rows.length}{' '}
                общих месяцев
                {model.period.limited && (
                  <span className="period-warning">
                    Общий период сокращён{' '}
                    <Hint text="Полная доходность T за 2021 не рассчитана: рублёвый эквивалент эмитента 17,82 ₽ известен, но фактические курс и дата зачисления инвестору не установлены. Оба режима и обе акции используют одинаковые даты с конца 2021. Пятилетняя ценовая история доступна в разделе «Подробнее» обзора. Для короткой базы выберите 2023–2025." />
                  </span>
                )}
              </p>
            </>
          )}
          {page === 'guide' && <MetricGuide selected={guideMetric} />}
          {page === 'overview' && (
            <Overview data={data} model={model} mode={mode} navigate={navigate} />
          )}{' '}
          {page === 'financial' && <Financial data={data} mode={mode} />}{' '}
          {page === 'risk' && <Risk data={data} model={model} mode={mode} />}{' '}
          {page === 'portfolio' && <PortfolioPage {...controls} />}{' '}
          {page === 'calculator' && <Calculator {...controls} />}{' '}
          {page === 'forecast' && (
            <Forecast
              model={model}
              scenarios={scenarios}
              setScenarios={setScenarios}
              reset={() => {
                setScenarios(structuredClone(defaultScenarios));
                setPlans({});
              }}
              mode={mode}
              amount={amount}
              weight={weight}
            />
          )}{' '}
          {page === 'stability' && <Stability data={data} model={model} mode={mode} />}{' '}
          {page === 'sources' && <Sources data={data} />}
          <footer className="main-footer">
            <span>
              <ChartNoAxesCombined size={14} />
              InvestAnalytics <b>·</b> 2021–2025
            </span>
            <p>
              Учебное исследование. Исторические результаты и сценарии не гарантируют будущую
              доходность.
            </p>
            <a href="#sources">
              Данные и методология <ArrowUpRight size={12} />
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
