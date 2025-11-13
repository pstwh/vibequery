import React, { useState, useMemo, useEffect, useRef } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';
import { QueryResult } from '../types/types';
import { PlayIcon, DownloadIcon, ViewAddIcon, ClipboardCopyIcon, HistoryIcon } from './icons';

interface SqlConsoleProps {
  onRunQuery: (sql: string) => Promise<void>;
  queryResult: QueryResult | null;
  isQuerying: boolean;
  sql: string;
  setSql: (sql: string) => void;
  geminiPrompt: string | null;
  showToast: (message: string) => void;
  queryHistory: string[];
  theme: 'light' | 'dark';
}

const PAGE_SIZE = 100;

interface CreateViewModalProps {
    isOpen: boolean;
    onClose: () => void;
    query: string;
    onCreate: (viewName: string) => void;
}

const CreateViewModal: React.FC<CreateViewModalProps> = ({ isOpen, onClose, query, onCreate }) => {
    const [viewName, setViewName] = useState('');

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleCreate = () => {
        if (viewName.trim()) {
            onCreate(viewName.trim());
            setViewName('');
        }
    };

    return (
        <div className="fixed inset-0 bg-gray-900/60 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-db-dark-2 rounded-lg shadow-xl p-6 w-full max-w-2xl border border-gray-200 dark:border-db-dark-3" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-semibold mb-4">Create View</h2>
                <div className="mb-4">
                    <label htmlFor="viewName" className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">View Name</label>
                    <input
                        type="text"
                        id="viewName"
                        value={viewName}
                        onChange={(e) => setViewName(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-db-dark border border-gray-300 dark:border-db-dark-3 rounded px-3 py-2 text-gray-900 dark:text-db-light focus:outline-none focus:ring-1 focus:ring-db-accent"
                        placeholder="e.g., my_awesome_view"
                        autoFocus
                    />
                </div>
                <div className="mb-4">
                    <p className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">From Query:</p>
                    <pre className="bg-gray-100 dark:bg-db-dark p-3 rounded text-xs overflow-auto max-h-40 text-gray-700 dark:text-gray-300 font-mono">{query}</pre>
                </div>
                <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-db-dark-3 hover:bg-opacity-80 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2">Cancel</button>
            <button onClick={handleCreate} disabled={!viewName.trim()} className="px-4 py-2 rounded bg-db-accent hover:bg-db-accent-hover text-white disabled:bg-gray-400 dark:disabled:bg-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2">Create</button>
                </div>
            </div>
        </div>
    );
};

const SqlConsole: React.FC<SqlConsoleProps> = ({ onRunQuery, queryResult, isQuerying, sql, setSql, geminiPrompt, showToast, queryHistory, theme }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [queryResult]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setIsHistoryOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const { paginatedRows, totalPages, isSelectQuery } = useMemo(() => {
    const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
    if (!queryResult?.rows?.length) {
      return { paginatedRows: [], totalPages: 0, isSelectQuery: isSelect };
    }
    const total = Math.ceil(queryResult.rows.length / PAGE_SIZE);
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    const rows = queryResult.rows.slice(startIndex, endIndex);
    return { paginatedRows: rows, totalPages: total, isSelectQuery: isSelect };
  }, [queryResult, currentPage, sql]);

  const handleRun = () => {
    if (sql.trim()) {
      onRunQuery(sql);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };
  
  const triggerDownload = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (!queryResult || !queryResult.rows.length) return;
    const { columns, rows } = queryResult;
    const header = columns.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
    const body = rows.map(row => 
        row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    triggerDownload('query_result.csv', `${header}\n${body}`, 'text/csv;charset=utf-8;');
  };

  const handleExportJSON = () => {
    if (!queryResult || !queryResult.rows.length) return;
    const { columns, rows } = queryResult;
    const jsonData = rows.map(row => 
        columns.reduce((obj, col, i) => {
            obj[col] = row[i];
            return obj;
        }, {} as Record<string, any>)
    );
    triggerDownload('query_result.json', JSON.stringify(jsonData, null, 2), 'application/json;charset=utf-8;');
  };
  
  const handleCreateView = async (viewName: string) => {
    const sanitizedViewName = viewName.replace(/[^a-zA-Z0-9_]/g, '_');
    const createViewSql = `CREATE OR REPLACE VIEW ${sanitizedViewName} AS \n${sql}`;
    await onRunQuery(createViewSql);
    setIsViewModalOpen(false);
    showToast(`View '${sanitizedViewName}' created successfully.`);
  };

  const handleCopyQuery = () => {
    navigator.clipboard.writeText(sql);
    showToast('Query copied to clipboard');
  };

  const handleHistorySelect = (query: string) => {
    setSql(query);
    setIsHistoryOpen(false);
  };

  return (
    <div className="h-1/3 bg-gray-50 dark:bg-db-dark-2 flex flex-col p-2 resize-y" style={{ minHeight: '150px' }}>
       <CreateViewModal 
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        query={sql}
        onCreate={handleCreateView}
      />
      <div className="flex-shrink-0 flex items-center mb-2">
        <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mr-4">Console</h3>
        <button
          onClick={handleRun}
          disabled={isQuerying}
          className="flex items-center px-3 py-1 bg-db-accent hover:bg-db-accent-hover text-white rounded disabled:bg-gray-400 dark:disabled:bg-gray-500 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"
        >
          <PlayIcon className="mr-1" />
          Run (⌘+Enter)
        </button>
        <button
          onClick={handleCopyQuery}
          title="Copy Query"
          className="ml-2 flex items-center p-2 bg-gray-100 dark:bg-db-dark-3 hover:bg-gray-200 dark:hover:bg-db-dark-2 text-gray-700 dark:text-white rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"
        >
          <ClipboardCopyIcon className="h-4 w-4" />
        </button>
        <div className="relative ml-2" ref={historyRef}>
            <button
                onClick={() => setIsHistoryOpen(prev => !prev)}
                title="Query History"
                className="flex items-center p-2 bg-gray-100 dark:bg-db-dark-3 hover:bg-gray-200 dark:hover:bg-db-dark-2 text-gray-700 dark:text-white rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"
            >
                <HistoryIcon className="h-4 w-4" />
            </button>
            {isHistoryOpen && (
                <div className="absolute bottom-full right-0 mb-2 w-96 max-h-80 overflow-y-auto bg-white dark:bg-db-dark-2 border border-gray-200 dark:border-db-dark-3 rounded-md shadow-lg z-30 py-1">
                  {queryHistory.length > 0 ? (
                    <ul>
                      {queryHistory.map((q, i) => (
                        <li key={i}>
                          <button 
                            onClick={() => handleHistorySelect(q)} 
                            className="w-full text-left p-2 text-xs font-mono text-gray-800 dark:text-db-light hover:bg-db-accent hover:text-white truncate block"
                            title={q}
                          >
                            {q}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-2 text-xs text-gray-500 text-center">No history found.</div>
                  )}
                </div>
            )}
        </div>
      </div>
      <div className="flex-grow flex flex-col md:flex-row gap-2 overflow-hidden">
        <div className="w-full md:w-1/3 h-full flex flex-col relative">
            <div 
                className="w-full h-full bg-white dark:bg-db-dark rounded font-mono text-sm resize-none focus-within:outline-none focus-within:ring-1 focus-within:ring-db-accent overflow-auto prism-editor-wrapper border border-gray-200 dark:border-db-dark-3 shadow-sm"
                onKeyDown={handleKeyDown}
            >
                <Editor
                    value={sql}
                    onValueChange={setSql}
                    highlight={code => Prism.highlight(code, Prism.languages.sql, 'sql')}
                    padding={10}
                    style={{
                        fontFamily: '"Fira code", "Fira Mono", monospace',
                        fontSize: 14,
                        minHeight: '100%',
                        outline: 'none',
                        color: theme === 'dark' ? '#d4d4d4' : '#374151',
                    }}
                    placeholder="Enter SQL, @gemini to generate, or use @hist, @bar, @scatter, @line to visualize..."
                    
                />
            </div>
             {geminiPrompt && (
                <div className="absolute bottom-2 right-3 text-xs text-gray-500 dark:text-gray-400 opacity-60 pointer-events-none truncate" title={geminiPrompt}>
                    Generated from: "{geminiPrompt}"
                </div>
            )}
        </div>
        <div className="w-full md:w-2/3 h-full bg-white dark:bg-db-dark rounded flex flex-col overflow-hidden border border-gray-200 dark:border-db-dark-3 shadow-sm">
          {isQuerying && <div className="p-4 text-center">Running query...</div>}
          {!isQuerying && queryResult && (
            <>
              {queryResult.error ? (
                <div className="p-4 m-2 text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/20 rounded">
                  <p className="font-bold">Error:</p>
                  <pre className="whitespace-pre-wrap">{queryResult.error}</pre>
                </div>
              ) : (
                <>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-3 pt-2 flex justify-between items-center flex-shrink-0">
                    <span>{queryResult.rows.length} rows in {queryResult.executionTime.toFixed(2)}ms</span>
                    {queryResult.rows.length > 0 && (
                        <div className="flex items-center gap-3">
                            <button title="Create View from this Query" onClick={() => setIsViewModalOpen(true)} disabled={!isSelectQuery} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"> <ViewAddIcon className="h-4 w-4" /> </button>
                            <button title="Export as CSV" onClick={handleExportCSV} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"> <DownloadIcon className="h-4 w-4" /> </button>
                            <button title="Export as JSON" onClick={handleExportJSON} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"> <DownloadIcon className="h-4 w-4" /> </button>
                        </div>
                    )}
                  </div>
                  <div className="flex-grow overflow-auto">
                    <table className="w-full text-sm text-left table-fixed">
                      <thead className="bg-gray-100 dark:bg-db-dark-3 sticky top-0 z-10">
                        <tr>
                          {queryResult.columns.map((col, i) => (
                            <th key={i} className="px-3 py-2 font-semibold truncate border-b border-gray-200 dark:border-db-dark-3" title={col}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-db-dark-3">
                        {paginatedRows.map((row, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-db-dark' : 'bg-gray-50 dark:bg-db-dark-2'}>
                            {row.map((cell, j) => (
                              <td key={j} className="px-3 py-1.5 whitespace-nowrap truncate hover:bg-gray-100/60 dark:hover:bg-db-dark-3/60 transition-colors" title={String(cell)}>{String(cell)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex-shrink-0 flex items-center justify-center p-2 border-t border-gray-200 dark:border-db-dark-3 text-xs">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2 py-1 rounded bg-gray-200 dark:bg-db-dark-3 hover:bg-db-accent disabled:bg-gray-200 dark:disabled:bg-db-dark-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Previous page"
                      >
                        Previous
                      </button>
                      <span className="mx-4 text-gray-500 dark:text-gray-400" aria-live="polite">
                        Page {currentPage} of {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2 py-1 rounded bg-gray-200 dark:bg-db-dark-3 hover:bg-db-accent disabled:bg-gray-200 dark:disabled:bg-db-dark-3 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Next page"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SqlConsole;

