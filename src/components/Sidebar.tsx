import React, { useState, useMemo } from 'react';
import { TableInfo, Project } from '../types/types';
import { TableIcon, ColumnIcon, ChevronRightIcon, FileIcon, RefreshIcon, ViewIcon } from './icons';
import ProjectSelector from './ProjectSelector';

interface SidebarProps {
  tables: TableInfo[];
  onTableCopied: (tableName: string) => void;
  onRefresh: () => void;
  style?: React.CSSProperties;
  projects: Project[];
  activeProjectId: string | null;
  onCreateProject: (name: string) => void;
  onSwitchProject: (id: string) => void;
  onRenameProject: (id: string, newName: string) => void;
  onDeleteProject: (id: string) => void;
}

const TableItem: React.FC<{ table: TableInfo; onTableCopied: (tableName: string) => void; }> = ({ table, onTableCopied }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(table.name);
    onTableCopied(table.name);
  };

  return (
    <div className="mb-1">
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex items-center text-left pl-4 pr-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-db-dark-3 transition-colors cursor-pointer"
      >
        <ChevronRightIcon className={`mr-1 transform transition-transform text-gray-400 dark:text-gray-500 ${isOpen ? 'rotate-90' : ''}`} />
        {table.isView 
            ? <ViewIcon className="mr-2 text-orange-400 flex-shrink-0" />
            : <TableIcon className="mr-2 text-blue-400 flex-shrink-0" />
        }
        <span 
          className="font-medium text-gray-800 dark:text-db-light text-sm flex-grow hover:underline truncate"
          title={`Click to copy "${table.name}"`}
          onClick={handleCopy}
        >
          {table.name}
        </span>
      </div>
      {isOpen && (
        <div className="pl-10 mt-1 space-y-1">
          {table.columns.map((col) => (
            <div key={col.column_name} className="flex items-center text-xs px-2 py-0.5">
              <ColumnIcon className="mr-2 text-yellow-400 flex-shrink-0" />
              <span className="text-gray-500 dark:text-gray-400 mr-2 truncate">{col.column_name}:</span>
              <span className="text-purple-400 font-mono">{col.column_type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const FileGroup: React.FC<{ fileName: string; tables: TableInfo[]; onTableCopied: (tableName: string) => void; }> = ({ fileName, tables, onTableCopied }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="mb-2">
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-db-dark-3 cursor-pointer transition-colors"
            >
                <ChevronRightIcon className={`mr-1 transform transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                <FileIcon className="mr-2 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                <span className="font-semibold text-sm text-gray-600 dark:text-gray-300 truncate">{fileName}</span>
            </div>
            {isOpen && (
                <div className="mt-1 pl-2">
                    {tables.map(table => (
                        <TableItem key={table.name} table={table} onTableCopied={onTableCopied} />
                    ))}
                </div>
            )}
        </div>
    );
};

const Sidebar: React.FC<SidebarProps> = ({ tables, onTableCopied, onRefresh, style, projects, activeProjectId, onCreateProject, onSwitchProject, onRenameProject, onDeleteProject }) => {
  const groupedTables = useMemo(() => {
    return tables.reduce((acc, table) => {
      const { sourceFile } = table;
      if (!acc[sourceFile]) {
        acc[sourceFile] = [];
      }
      acc[sourceFile].push(table);
      return acc;
    }, {} as Record<string, TableInfo[]>);
  }, [tables]);

  return (
    <aside className="bg-gray-50 dark:bg-db-dark-2 flex flex-col overflow-hidden flex-shrink-0 border-r border-gray-200 dark:border-db-dark-3 shadow-card" style={style}>
      <div className="p-4 flex-shrink-0 border-b border-gray-200 dark:border-db-dark-3">
        <ProjectSelector
          projects={projects}
          activeProjectId={activeProjectId}
          onCreateProject={onCreateProject}
          onSwitchProject={onSwitchProject}
          onRenameProject={onRenameProject}
          onDeleteProject={onDeleteProject}
        />
        <div className="flex justify-between items-center mt-4">
          <h2 className="text-md font-bold text-gray-700 dark:text-gray-300">Explorer</h2>
          <button onClick={onRefresh} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2" title="Refresh Explorer">
            <RefreshIcon />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">{tables.length} {tables.length === 1 ? 'table' : 'tables'} loaded</p>
      </div>
      <div className="flex-grow overflow-y-auto p-2">
        {Object.keys(groupedTables).length > 0 ? (
          Object.entries(groupedTables).map(([fileName, fileTables]) => (
            <FileGroup key={fileName} fileName={fileName} tables={fileTables} onTableCopied={onTableCopied} />
          ))
        ) : (
          <p className="text-sm text-gray-500 px-2 py-4">No tables loaded. Drop a file to get started.</p>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;

