import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { useTheme } from '@/presentation/context/ThemeContext.jsx';
import { DEV_MODE } from '@/core/config/app.config';
import { getIncidents } from '@/data/api/incidents.api';
import { incidents as mockIncidents } from '@/data/mock/mockData';
import { formatIncidentTypesLabel } from '@/core/utils/incidentDisplay';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;
const RESULT_LIMIT = 8;

function normalizeSearchResult(item) {
  const reportId = item?.report_id ?? item?.id;
  return {
    reportId,
    label: reportId != null ? `Incident #${reportId}` : 'Incident',
    type: formatIncidentTypesLabel(item),
    barangay: item?.barangay || '—',
    status: item?.status || item?.status_label || '—',
  };
}

function searchMockIncidents(query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  return mockIncidents
    .filter((inc) => {
      const idMatch = String(inc.id || '').toLowerCase().includes(needle);
      const barangayMatch = String(inc.barangay || '').toLowerCase().includes(needle);
      const descriptionMatch = String(inc.description || '').toLowerCase().includes(needle);
      const typeMatch = String(inc.emergencyType || '').toLowerCase().includes(needle);
      const numericId = parseInt(needle, 10);
      const exactNumeric = !Number.isNaN(numericId) && String(inc.id).includes(String(numericId));
      return idMatch || barangayMatch || descriptionMatch || typeMatch || exactNumeric;
    })
    .slice(0, RESULT_LIMIT)
    .map((inc) => normalizeSearchResult({
      report_id: inc.id,
      incident_type: inc.emergencyType,
      barangay: inc.barangay,
      status: inc.status,
    }));
}

export function GlobalSearch() {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const debounceRef = useRef(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [error, setError] = useState(null);

  const runSearch = useCallback(async (rawQuery) => {
    const trimmed = rawQuery.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = sessionStorage.getItem('token');
      if (DEV_MODE && !token) {
        setResults(searchMockIncidents(trimmed));
        return;
      }

      const data = await getIncidents({ search: trimmed, limit: RESULT_LIMIT });
      const items = Array.isArray(data) ? data : [];
      setResults(items.map(normalizeSearchResult));
    } catch (err) {
      setResults([]);
      setError(err?.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      setError(null);
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [results]);

  useEffect(() => {
    const onMouseDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const selectResult = (result) => {
    if (!result?.reportId) return;
    setQuery('');
    setResults([]);
    setIsOpen(false);
    navigate(`/incidents/${result.reportId}`);
  };

  const onKeyDown = (event) => {
    if (!isOpen && event.key === 'ArrowDown' && query.trim().length >= MIN_QUERY_LENGTH) {
      setIsOpen(true);
      return;
    }

    if (!isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setIsOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(results.length - 1, 0)));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = results[highlightedIndex];
      if (selected) selectResult(selected);
    }
  };

  const showDropdown = isOpen && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div ref={rootRef} className="relative flex-1 max-w-md">
      <div
        className={`relative rounded-xl border transition-colors ${
          isLight ? 'bg-gray-50/80 border-gray-200' : 'bg-background/50 border-border'
        }`}
      >
        <Search
          className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${
            isLight ? 'text-gray-400' : 'text-muted'
          }`}
        />
        <input
          type="search"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          placeholder="Search incidents by ID, barangay, or description…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query.trim().length >= MIN_QUERY_LENGTH) setIsOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={`w-full pl-9 pr-3 py-2.5 rounded-xl bg-transparent text-sm outline-none ${
            isLight ? 'text-gray-900 placeholder:text-gray-400' : 'text-foreground placeholder:text-muted'
          }`}
        />
        {loading && (
          <Loader2
            className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin ${
              isLight ? 'text-gray-400' : 'text-muted'
            }`}
            aria-hidden
          />
        )}
      </div>

      {showDropdown && (
        <div
          id="global-search-results"
          role="listbox"
          className={`absolute left-0 right-0 top-full mt-2 z-[100] rounded-xl border shadow-xl overflow-hidden ${
            isLight
              ? 'bg-white border-gray-200 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.15)]'
              : 'bg-card border-border shadow-[0_12px_32px_-8px_rgba(0,0,0,0.4)]'
          }`}
        >
          {error ? (
            <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : results.length === 0 && !loading ? (
            <p className="px-4 py-3 text-sm text-muted">No incidents found</p>
          ) : (
            <ul>
              {results.map((result, index) => (
                <li key={`${result.reportId}-${index}`} role="option" aria-selected={index === highlightedIndex}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => selectResult(result)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      index === highlightedIndex
                        ? isLight
                          ? 'bg-primary/10'
                          : 'bg-primary/15'
                        : isLight
                          ? 'hover:bg-gray-50'
                          : 'hover:bg-white/5'
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">{result.label}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {result.type} · {result.barangay} · {result.status}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
