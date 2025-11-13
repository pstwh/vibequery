import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { useDuckDB } from '../hooks/useDuckDB';
import { TableInfo, GraphData, QueryResult, GraphNode, GraphLink, Project, PersistedFile, PersistedView, Visualization, ChartType } from '../types/types';
import Sidebar from '../components/Sidebar';
import GraphView from '../components/GraphView';
import SqlConsole from '../components/SqlConsole';
import { UploadIcon, ClipboardCopyIcon, QuestionMarkCircleIcon, CloseIcon, HistoryIcon, SunIcon, MoonIcon } from '../components/icons';
import { CogIcon } from '../components/icons';
import * as ProjectDB from '../lib/ProjectDB';
import VisualizationPanel from '../components/VisualizationPanel';

type Theme = 'light' | 'dark';

const processDroppedItems = async (items: DataTransferItemList): Promise<File[]> => {
    const files: File[] = [];
    const entries = Array.from(items).map(item => item.webkitGetAsEntry());

    const readEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> => {
        return new Promise((resolve, reject) => {
            reader.readEntries(resolve, reject);
        });
    };

    const traverse = async (entry: FileSystemEntry | null): Promise<void> => {
        if (!entry) return;

        if (entry.isFile) {
            await new Promise<void>((resolve, reject) => {
                (entry as FileSystemFileEntry).file(file => {
                    const relativePath = entry.fullPath.startsWith('/') ? entry.fullPath.substring(1) : entry.fullPath;
                    if (!('webkitRelativePath' in file) || !file.webkitRelativePath) {
                         Object.defineProperty(file, 'webkitRelativePath', {
                             value: relativePath,
                             configurable: true,
                             writable: true,
                         });
                    }
                    files.push(file);
                    resolve();
                }, reject);
            });
        } else if (entry.isDirectory) {
            const reader = (entry as FileSystemDirectoryEntry).createReader();
            let entriesChunk: FileSystemEntry[] = [];
            let allEntries: FileSystemEntry[] = [];
            do {
                entriesChunk = await readEntries(reader);
                allEntries = allEntries.concat(entriesChunk);
            } while (entriesChunk.length > 0);
            
            for (const subEntry of allEntries) {
                await traverse(subEntry);
            }
        }
    };

    for (const entry of entries) {
        await traverse(entry);
    }
    return files;
};

const HelpModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
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

    return (
        <div className="fixed inset-0 bg-gray-900/60 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-db-dark-2 rounded-lg shadow-xl p-6 w-full max-w-2xl border border-gray-200 dark:border-db-dark-3" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">Querying Tips & Tricks</h2>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
                        <CloseIcon />
                    </button>
                </div>
                <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 max-h-[70vh] overflow-y-auto pr-2">
                    <div>
                        <h3 className="font-semibold text-gray-800 dark:text-db-light mb-1">AI-Powered Query Generation with <code className="bg-gray-100 dark:bg-db-dark px-1 py-0.5 rounded text-orange-500 dark:text-orange-400">@gemini</code></h3>
                        <p>Let AI write SQL for you! Simply type <code className="bg-gray-100 dark:bg-db-dark px-1 py-0.5 rounded">@gemini</code> followed by your question in plain English in the console.</p>
                        <p className="mt-1 text-xs text-gray-500">Example: <code className="bg-gray-100 dark:bg-db-dark px-1 py-0.5 rounded">@gemini show me the top 5 customers by total sales</code></p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800 dark:text-db-light mb-1">Quick Visualizations</h3>
                        <p>Generate charts directly from your SQL queries using special commands. The command is followed by a standard <code className="bg-gray-100 dark:bg-db-dark px-1 py-0.5 rounded">SELECT</code> query.</p>
                        <ul className="list-disc list-inside mt-2 space-y-1 pl-2 text-xs">
                            <li><code className="bg-gray-100 dark:bg-db-dark px-1 py-0.5 rounded text-purple-500 dark:text-purple-400">@hist</code>: Creates a histogram from a single numerical column.</li>
                            <li><code className="bg-gray-100 dark:bg-db-dark px-1 py-0.5 rounded text-purple-500 dark:text-purple-400">@bar</code>: Creates a bar chart from a categorical column and a numerical column.</li>
                            <li><code className="bg-gray-100 dark:bg-db-dark px-1 py-0.5 rounded text-purple-500 dark:text-purple-400">@scatter</code>: Creates a scatter plot from two numerical columns.</li>
                            <li><code className="bg-gray-100 dark:bg-db-dark px-1 py-0.5 rounded text-purple-500 dark:text-purple-400">@line</code>: Creates a line chart from two numerical columns (typically for time-series).</li>
                        </ul>
                         <p className="mt-1 text-xs text-gray-500">Example: <code className="bg-gray-100 dark:bg-db-dark px-1 py-0.5 rounded">@bar SELECT category, SUM(sales) FROM products GROUP BY category</code></p>
                    </div>
                     <div>
                        <h3 className="font-semibold text-gray-800 dark:text-db-light mb-1">Query History</h3>
                        <p>Access your previous queries for the current project using the history button <HistoryIcon className="inline-block h-4 w-4" /> in the console toolbar.</p>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800 dark:text-db-light mb-1">Run Query Shortcut</h3>
                        <p>Press <kbd className="px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-db-dark-3 border border-gray-300 dark:border-db-dark-3 rounded-md">⌘ + Enter</kbd> (on Mac) or <kbd className="px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-db-dark-3 border border-gray-300 dark:border-db-dark-3 rounded-md">Ctrl + Enter</kbd> (on Windows/Linux) in the editor to run the current query.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onTest: () => Promise<void>;
  isTesting: boolean;
  testMessage: string | null;
}> = ({ isOpen, onClose, value, onChange, onSave, onTest, isTesting, testMessage }) => {
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
  return (
    <div className="fixed inset-0 bg-gray-900/60 dark:bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-db-dark-2 rounded-lg shadow-xl p-6 w-full max-w-md border border-gray-200 dark:border-db-dark-3" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors">
            <CloseIcon />
          </button>
        </div>
        <div className="space-y-3">
          <label className="block text-sm text-gray-600 dark:text-gray-300">Gemini API Key</label>
          <input
            type="password"
            className="w-full rounded border border-gray-300 dark:border-db-dark-3 bg-white dark:bg-db-dark px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-db-accent"
            placeholder="Enter your Gemini API key"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              className="px-3 py-1.5 rounded bg-db-accent text-white text-sm hover:bg-db-accent-hover transition-colors"
            >
              Save
            </button>
            <button
              onClick={onTest}
              disabled={isTesting || !value}
              className="px-3 py-1.5 rounded bg-gray-100 dark:bg-db-dark-3 text-gray-800 dark:text-db-light text-sm border border-gray-300 dark:border-db-dark-3 disabled:opacity-60"
            >
              {isTesting ? 'Testing…' : 'Test Key'}
            </button>
          </div>
          {testMessage && (
            <div className="text-sm mt-1">{testMessage}</div>
          )}
        </div>
      </div>
    </div>
  );
};

function App() {
  const { isLoading: isDbLoading, error: dbError, loadFiles, runQuery, getTablesInfo } = useDuckDB();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const [sql, setSql] = useState<string>('SELECT * FROM your_table_name LIMIT 10;');
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [geminiPrompt, setGeminiPrompt] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const appInitialized = useRef(false);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [visualization, setVisualization] = useState<Visualization | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const savedWidth = localStorage.getItem('sidebarWidth');
    return savedWidth ? Math.max(200, Math.min(600, parseInt(savedWidth, 10))) : 288;
  });
  const isResizing = useRef(false);

  const [vizSidebarWidth, setVizSidebarWidth] = useState(() => {
    const savedWidth = localStorage.getItem('vizSidebarWidth');
    return savedWidth ? Math.max(300, Math.min(800, parseInt(savedWidth, 10))) : 400;
  });
  const isVizResizing = useRef(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('theme') as Theme) || 'light');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => localStorage.getItem('vibequery_gemini_api_key') || '');
  const [tempKey, setTempKey] = useState<string>('');
  const aiRef = useRef<GoogleGenAI | null>(null);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const processingAbortRef = useRef(false);
  const [isCancellingProcessing, setIsCancellingProcessing] = useState(false);
  const [processingTotalFiles, setProcessingTotalFiles] = useState(0);
  const [processingProcessedFiles, setProcessingProcessedFiles] = useState(0);
  const [processingTotalGroups, setProcessingTotalGroups] = useState(0);
  const [processingGroupIndex, setProcessingGroupIndex] = useState(0);
  const [processingGroupName, setProcessingGroupName] = useState('');
  const [showInitOverlay, setShowInitOverlay] = useState(false);
  const [isHydratingProject, setIsHydratingProject] = useState(false);

  useEffect(() => {
      const root = window.document.documentElement;
      root.classList.remove(theme === 'dark' ? 'light' : 'dark');
      root.classList.add(theme);
      localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    aiRef.current = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
  }, [geminiApiKey]);

  useEffect(() => {
    let timer: number | undefined;
    if (isDbLoading || isAppLoading) {
      timer = window.setTimeout(() => setShowInitOverlay(true), 300);
    } else {
      setShowInitOverlay(false);
    }
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [isDbLoading, isAppLoading]);

  const handleRefreshExplorer = useCallback(async () => {
    try {
        const dbTables = await getTablesInfo();
        const existingTablesMap = new Map(tables.map(t => [t.name, t]));
        
        const newTablesState = dbTables.map((dbTable): TableInfo => {
            const existing = existingTablesMap.get(dbTable.name);
            let sourceFile: string;

            if (dbTable.isView) {
                sourceFile = '(views)';
            } else if (existing) {
                sourceFile = (existing as TableInfo).sourceFile;
            } else {
                sourceFile = '(database)';
            }
            
            return {
                ...dbTable,
                sourceFile,
            };
        });
        setTables(newTablesState);
    } catch (e) {
        setError(`Failed to refresh explorer: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [getTablesInfo, tables]);

  const processFiles = useCallback(async (files: (File | PersistedFile)[], saveToProject: boolean = true, showProgressOverride?: boolean) => {
    if (files.length === 0) return;
    setError(null);
    const showProgress = showProgressOverride ?? !!saveToProject;
    if (showProgress) {
      setIsProcessing(true);
      processingAbortRef.current = false;
      setIsCancellingProcessing(false);
      setProcessingTotalFiles(0);
      setProcessingProcessedFiles(0);
      setProcessingTotalGroups(0);
      setProcessingGroupIndex(0);
      setProcessingGroupName('');
    }
    try {
      if (saveToProject && activeProjectId) {
          for (const file of files) {
              if (file instanceof File) {
                 await ProjectDB.addFileToProject(activeProjectId, file);
              }
          }
      }
      const newTables = await loadFiles(files, {
        onBegin: ({ totalGroups, totalFiles }) => {
          if (!showProgress) return;
          setProcessingTotalGroups(totalGroups);
          setProcessingTotalFiles(totalFiles);
          setProcessingProcessedFiles(0);
        },
        onProgress: ({ groupIndex, groupName, totalGroups, processedFiles, totalFiles }) => {
          if (!showProgress) return;
          setProcessingGroupIndex(groupIndex);
          setProcessingGroupName(groupName);
          setProcessingTotalGroups(totalGroups);
          setProcessingProcessedFiles(processedFiles);
          setProcessingTotalFiles(totalFiles);
        },
        isAborted: () => processingAbortRef.current,
      });
      setTables(prev => [...prev, ...newTables]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (showProgress) {
        setIsProcessing(false);
        processingAbortRef.current = false;
        setIsCancellingProcessing(false);
      }
    }
  }, [loadFiles, activeProjectId]);

  useEffect(() => {
    const initializeApp = async () => {
        setIsAppLoading(true);
        try {
            await ProjectDB.initDB();
            const storedProjects = ProjectDB.getProjects();
            setProjects(Object.values(storedProjects));

            let currentProjectId = ProjectDB.getActiveProjectId();
            if (!currentProjectId && Object.keys(storedProjects).length === 0) {
                const newProject = await ProjectDB.createProject('My First Project');
                setProjects([newProject]);
                currentProjectId = newProject.id;
                ProjectDB.setActiveProjectId(newProject.id);
            } else if (!currentProjectId && Object.keys(storedProjects).length > 0) {
                currentProjectId = Object.keys(storedProjects)[0];
                ProjectDB.setActiveProjectId(currentProjectId);
            }
            
            setActiveProjectId(currentProjectId);

            if (currentProjectId) {
                setQueryHistory(ProjectDB.getQueryHistory(currentProjectId));
                (async () => {
                  setIsHydratingProject(true);
                  try {
                    const projectFiles = await ProjectDB.getProjectFiles(currentProjectId!);
                    if (projectFiles.length > 0) {
                        await processFiles(projectFiles, false, true);
                    }
                    const projectViews = await ProjectDB.getProjectViews(currentProjectId!);
                    for (const view of projectViews) {
                        await runQuery(view.sql);
                    }
                    await handleRefreshExplorer();
                  } catch (e) {
                  } finally {
                    setIsHydratingProject(false);
                  }
                })();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsAppLoading(false);
        }
    };
    
    if (!isDbLoading && !appInitialized.current) {
        appInitialized.current = true;
        initializeApp();
    }
  }, [isDbLoading]);

  useEffect(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const fileNames = new Set<string>();

    tables.forEach(t => {
      if(t.sourceFile && t.sourceFile !== '(views)' && t.sourceFile !== '(database)') {
        fileNames.add(t.sourceFile);
      }
    });

    for (const fileName of fileNames) {
      nodes.push({ id: fileName, group: 'file', name: fileName });
    }

    for (const table of tables) {
      nodes.push({ id: table.name, group: table.isView ? 'view' : 'table', name: table.name });
      
      if (table.isView && table.dependencies) {
        for (const dep of table.dependencies) {
          if (tables.some(t => t.name === dep)) {
            links.push({ source: table.name, target: dep });
          }
        }
      } else if (table.sourceFile && !table.isView) {
        if(fileNames.has(table.sourceFile)){
            links.push({ source: table.sourceFile, target: table.name });
        }
      }
    }
    
    setGraphData({ nodes, links });
  }, [tables]);

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3000);
  }, []);

  const handleTableCopied = (tableName: string) => {
    showToast(`Copied "${tableName}" to clipboard`);
  };

  const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.items) {
        const files = await processDroppedItems(e.dataTransfer.items);
        processFiles(files);
    } else {
        processFiles(Array.from(e.dataTransfer.files));
    }
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(Array.from(e.target.files || []));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  const handleImportClick = () => fileInputRef.current?.click();
  
  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
  };
  
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
      handleDragEvents(e);
      setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      handleDragEvents(e);
      setIsDragging(false);
  };

  const generateSchemaPrompt = () => {
    if (tables.length === 0) {
      return "No tables are loaded.";
    }
    return tables.map(table => 
      `Table "${table.name}" has columns: ${table.columns.map(c => `"${c.column_name}" (${c.column_type})`).join(', ')}.`
    ).join('\n');
  };

  const handleAddToHistory = (query: string) => {
    if (activeProjectId) {
      ProjectDB.addQueryToHistory(activeProjectId, query);
      setQueryHistory(ProjectDB.getQueryHistory(activeProjectId));
    }
  };

  const handleRunQuery = async (query: string) => {
    if (isDbLoading || isAppLoading || isHydratingProject) {
      showToast(isHydratingProject ? 'Preparing explorer… Please wait a moment.' : 'Initializing... Please wait a moment.');
      return;
    }
    setIsQuerying(true);
    setQueryResult(null);
    setVisualization(null);

    try {
      let finalQuery = query;
      const vizMatch = query.trim().match(/^@(hist|bar|scatter|line)\s+((.|\n)+)/i);

      if (vizMatch) {
          const type = vizMatch[1].toLowerCase() as ChartType;
          const sqlQuery = vizMatch[2];
          const result = await runQuery(sqlQuery);
          setQueryResult(result);
          if (!result.error) {
              setVisualization({ type, data: result, query });
              handleAddToHistory(query);
          }
          setGeminiPrompt(null);
      } else if (query.trim().toLowerCase().startsWith('@gemini')) {
        const prompt = query.trim().substring(7).trim();
        if (!prompt) throw new Error("Please provide a prompt after @gemini.");
        
        setGeminiPrompt(prompt);
        if (!aiRef.current) {
          throw new Error("Set a Gemini API key in Settings to use @gemini.");
        }

        const schema = generateSchemaPrompt();
        const fullPrompt = `
          Based on the following database schema, write a single, valid SQL query to answer the user's request.
          Only return the SQL query and nothing else. Do not wrap it in markdown or explain it.

          Schema:
          ${schema}

          User Request:
          ${prompt}
        `;

        const response = await aiRef.current.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: fullPrompt,
        });

        finalQuery = response.text.replace(/^```sql\n|```$/g, '').trim();
        setSql(finalQuery);
        
        const result = await runQuery(finalQuery);
        setQueryResult(result);
        if (!result.error) {
            handleAddToHistory(finalQuery);
        }

      } else {
        setGeminiPrompt(null);
        finalQuery = query;
        const result = await runQuery(finalQuery);
        setQueryResult(result);

        if (!result.error) {
            handleAddToHistory(finalQuery);
            const command = finalQuery.trim().toUpperCase();
            const firstWord = command.split(/\s+/)[0];

            if (['CREATE', 'DROP', 'ALTER'].includes(firstWord)) {
                if (activeProjectId) {
                    const createViewMatch = command.match(/^CREATE(?:\s+OR\s+REPLACE)?\s+VIEW\s+([a-zA-Z0-9_]+)/);
                    const dropViewMatch = command.match(/^DROP\s+VIEW(?:(?:\s+IF\s+EXISTS))?\s+([a-zA-Z0-9_]+)/);

                    if (createViewMatch) {
                        const viewName = createViewMatch[1];
                        await ProjectDB.saveView(activeProjectId, { name: viewName, sql: finalQuery });
                    } else if (dropViewMatch) {
                        const viewName = dropViewMatch[1];
                        await ProjectDB.deleteView(activeProjectId, viewName);
                    }
                }
                await handleRefreshExplorer();
            }
        }
      }

    } catch (e) {
      setGeminiPrompt(null);
      setQueryResult({
        columns: [],
        rows: [],
        error: e instanceof Error ? e.message : String(e),
        executionTime: 0
      });
    } finally {
      setIsQuerying(false);
    }
  };

  const handleSqlChange = (newSql: string) => {
    setSql(newSql);
    if (geminiPrompt) {
      setGeminiPrompt(null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };
  const handleMouseUp = useCallback(() => {
    isResizing.current = false;
    isVizResizing.current = false;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing.current) {
      const newWidth = e.clientX;
      const constrainedWidth = Math.max(200, Math.min(600, newWidth));
      setSidebarWidth(constrainedWidth);
    }
    if (isVizResizing.current) {
      const newWidth = window.innerWidth - e.clientX;
      const constrainedWidth = Math.max(300, Math.min(800, newWidth));
      setVizSidebarWidth(constrainedWidth);
    }
  }, []);

  const handleVizMouseDown = (e: React.MouseEvent) => {
      e.preventDefault();
      isVizResizing.current = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    localStorage.setItem('sidebarWidth', String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem('vizSidebarWidth', String(vizSidebarWidth));
  }, [vizSidebarWidth]);

  const handleCreateProject = async (name: string) => {
      const newProject = await ProjectDB.createProject(name);
      ProjectDB.setActiveProjectId(newProject.id);
      window.location.reload();
  };

  const handleSwitchProject = (id: string) => {
      ProjectDB.setActiveProjectId(id);
      window.location.reload();
  };

  const handleRenameProject = async (id: string, newName: string) => {
      const updatedProject = await ProjectDB.updateProject(id, newName);
      if (updatedProject) {
          setProjects(prev => prev.map(p => p.id === id ? updatedProject : p));
          showToast(`Project renamed to "${newName}"`);
      }
  };

  const handleDeleteProject = async (id: string) => {
      await ProjectDB.deleteProject(id);
      window.location.reload();
  };

  if (dbError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-db-dark text-red-500 dark:text-red-400">
        Error: {dbError}
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen flex flex-col bg-gray-50 text-gray-800 dark:bg-db-dark dark:text-db-light"
      onDrop={handleFileDrop}
      onDragOver={handleDragEvents}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple className="hidden" accept=".csv,.parquet,.json,.xlsx,.sqlite,.db" />
      <HelpModal isOpen={isHelpModalOpen} onClose={() => setIsHelpModalOpen(false)} />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        value={tempKey}
        onChange={setTempKey}
        onSave={() => {
          setGeminiApiKey(tempKey);
          localStorage.setItem('vibequery_gemini_api_key', tempKey);
          setTestMessage(null);
          setIsSettingsOpen(false);
          setTempKey('');
          showToast('Gemini API key saved');
        }}
        onTest={async () => {
          setIsTestingKey(true);
          setTestMessage(null);
          try {
            const testAi = new GoogleGenAI({ apiKey: tempKey });
            const r = await testAi.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: 'Reply with OK',
            });
            const t = (r as any).text || '';
            if (typeof t === 'string' && t.toUpperCase().includes('OK')) {
              setTestMessage('Key is valid.');
            } else {
              setTestMessage('Received a response, but validation was inconclusive.');
            }
          } catch (e: any) {
            setTestMessage(e?.message ? `Test failed: ${e.message}` : 'Test failed.');
          } finally {
            setIsTestingKey(false);
          }
        }}
        isTesting={isTestingKey}
        testMessage={testMessage}
      />
      <header className="flex-shrink-0 bg-white/80 dark:bg-db-dark-2/80 backdrop-blur border-b border-gray-200 dark:border-db-dark-3 px-3 py-2 flex justify-between items-center">
        <div className="text-left">
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">vibequery</h1>
            <p className="text-xs text-gray-500">Your data, locally queried and visually connected.</p>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={handleImportClick}
                disabled={isDbLoading || isAppLoading}
                className="flex items-center px-3 py-1.5 bg-db-accent hover:bg-db-accent-hover text-white rounded transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"
            >
                <UploadIcon className="mr-2" />
                Import Data
            </button>
            <button 
                onClick={() => setIsHelpModalOpen(true)}
                className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-db-dark-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"
                title="Help & Querying Tips"
            >
                <QuestionMarkCircleIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                setTempKey(geminiApiKey || '');
                setTestMessage(null);
                setIsSettingsOpen(true);
              }}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-db-dark-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"
              title="Settings"
            >
              <CogIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-db-dark-3 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            {(isDbLoading || isAppLoading) && (
              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                <svg className="animate-spin h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                Initializing...
              </div>
            )}
        </div>
      </header>
      
      <main className="flex-grow flex overflow-hidden bg-gradient-to-b from-gray-50 to-white dark:from-db-dark dark:to-db-dark-2">
        {showInitOverlay && (
          <div className="fixed inset-0 z-40 flex items-center justify-center">
            <div className="bg-white dark:bg-db-dark-2 border border-gray-200 dark:border-db-dark-3 shadow-xl rounded-lg px-5 py-4 flex items-center gap-3">
              <svg className="animate-spin h-5 w-5 text-gray-600 dark:text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              <div className="text-sm text-gray-700 dark:text-gray-200">
                {isDbLoading ? 'Starting query engine…' : 'Loading project data…'}
              </div>
            </div>
          </div>
        )}
        <Sidebar 
          tables={tables} 
          onTableCopied={handleTableCopied} 
          onRefresh={() => {
            handleRefreshExplorer();
            showToast('Explorer refreshed');
          }} 
          style={{ width: `${sidebarWidth}px` }} 
          projects={projects}
          activeProjectId={activeProjectId}
          onCreateProject={handleCreateProject}
          onSwitchProject={handleSwitchProject}
          onRenameProject={handleRenameProject}
          onDeleteProject={handleDeleteProject}
        />
        <div
          onMouseDown={handleMouseDown}
          className="w-1.5 cursor-col-resize bg-gray-200 dark:bg-db-dark-3 hover:bg-db-accent transition-colors duration-200 flex-shrink-0"
          title="Drag to resize"
        />
        <div className="flex-grow flex flex-col relative overflow-hidden">
            <div className="flex-grow">
                 <GraphView data={graphData} theme={theme} />
            </div>
            <SqlConsole 
                onRunQuery={handleRunQuery} 
                queryResult={queryResult} 
                isQuerying={isQuerying} 
                sql={sql} 
                setSql={handleSqlChange} 
                geminiPrompt={geminiPrompt} 
                showToast={showToast}
                queryHistory={queryHistory}
                theme={theme}
            />

            {(isDragging || isProcessing || isHydratingProject || error) && (
              <div className="absolute inset-0 bg-gray-900/70 dark:bg-black/70 flex items-center justify-center z-10 backdrop-blur-sm">
                <div className="text-center p-8 border-2 border-dashed border-gray-600 dark:border-db-dark-3 rounded-lg bg-white/5 dark:bg-db-dark-3/20">
                  {isDragging && !isProcessing && <h2 className="text-2xl font-semibold text-white">Drop to upload</h2>}
                  {isProcessing && (
                    <div>
                      <h2 className="text-2xl font-semibold text-white">{isHydratingProject ? 'Restoring project files...' : 'Processing files...'}</h2>
                      <p className="text-sm text-gray-300 mt-2">
                        {processingProcessedFiles} / {processingTotalFiles}{processingGroupName ? ` · ${processingGroupName}` : ''}
                      </p>
                      <div className="mt-4 w-80 bg-gray-600 rounded h-2 overflow-hidden">
                        <div
                          className="bg-db-accent h-2"
                          style={{ width: `${processingTotalFiles > 0 ? Math.round((processingProcessedFiles / processingTotalFiles) * 100) : 0}%` }}
                        />
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={() => {
                            processingAbortRef.current = true;
                            setIsCancellingProcessing(true);
                          }}
                          className="px-3 py-1.5 bg-gray-200 dark:bg-db-dark-3 text-gray-800 dark:text-db-light rounded border border-gray-300 dark:border-db-dark-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"
                        >
                          {isCancellingProcessing ? 'Cancelling...' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  )}
                  {!isProcessing && isHydratingProject && (
                    <div>
                      <h2 className="text-2xl font-semibold text-white">Preparing explorer…</h2>
                      <div className="mt-4 w-80 bg-gray-600 rounded h-2 overflow-hidden">
                        <div className="bg-db-accent h-2 animate-pulse" style={{ width: '50%' }} />
                      </div>
                    </div>
                  )}
                  {error && (
                    <div>
                      <h2 className="text-2xl font-semibold text-red-400">Upload Failed</h2>
                      <p className="text-red-300 mt-2">{error}</p>
                      <button onClick={() => setError(null)} className="mt-4 px-4 py-2 bg-db-accent rounded">
                        Close
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
        </div>

        {visualization && (
          <>
            <div
              onMouseDown={handleVizMouseDown}
              className="w-1.5 cursor-col-resize bg-gray-200 dark:bg-db-dark-3 hover:bg-db-accent transition-colors duration-200 flex-shrink-0"
              title="Drag to resize"
            />
            <VisualizationPanel
              visualization={visualization}
              onClose={() => setVisualization(null)}
              style={{ width: `${vizSidebarWidth}px` }}
              theme={theme}
            />
          </>
        )}

      </main>
      
      <div
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 flex items-center px-4 py-2 bg-white/95 dark:bg-db-dark-3/95 text-gray-800 dark:text-db-light rounded-md shadow-cardLg border border-gray-200 dark:border-db-dark-3 transition-all duration-300 ${
          toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
        }`}
      >
        <ClipboardCopyIcon className="mr-2 text-green-500 dark:text-green-400" />
        {toast.message}
      </div>
    </div>
  );
}

export default App;

