import React from 'react';
import { Visualization } from '../types/types';
import { ChartBarIcon, CloseIcon } from './icons';
import { BarChart, HistogramChart, LineChart, ScatterChart } from './D3Charts';

type Theme = 'light' | 'dark';

interface VisualizationPanelProps {
  visualization: Visualization;
  onClose: () => void;
  style?: React.CSSProperties;
  theme: Theme;
}

const ChartContainer: React.FC<{ visualization: Visualization, theme: Theme }> = ({ visualization, theme }) => {
    const { type, data } = visualization;
    
    if (data.rows.length === 0) {
        return <div className="p-4 text-sm text-gray-500">No data to display for this chart.</div>;
    }

    switch (type) {
        case 'hist':
            return <HistogramChart data={data} theme={theme} />;
        case 'bar':
            return <BarChart data={data} theme={theme} />;
        case 'scatter':
            return <ScatterChart data={data} theme={theme} />;
        case 'line':
            return <LineChart data={data} theme={theme} />;
        default:
            return <div className="p-4 text-sm text-red-400">Unknown chart type: {type}</div>;
    }
};

const VisualizationPanel: React.FC<VisualizationPanelProps> = ({ visualization, onClose, style, theme }) => {
  return (
    <aside className="bg-gray-50 dark:bg-db-dark-2 flex flex-col overflow-hidden flex-shrink-0" style={style}>
        <div className="p-2 flex-shrink-0 border-b border-gray-200 dark:border-db-dark-3 flex justify-between items-center">
            <div className="flex items-center">
                <ChartBarIcon className="mr-2 text-gray-500 dark:text-gray-400" />
                <h2 className="text-md font-bold text-gray-700 dark:text-gray-300">Visualization</h2>
            </div>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2" title="Close Panel">
                <CloseIcon />
            </button>
        </div>
        <div className="p-2 flex-shrink-0">
            <p className="text-xs text-gray-500 mb-1">Source Query:</p>
            <pre className="bg-white dark:bg-db-dark p-2 rounded text-xs overflow-auto max-h-24 text-gray-700 dark:text-gray-300 font-mono border border-gray-200 dark:border-db-dark-3 shadow-sm">
                {visualization.query}
            </pre>
        </div>
        <div className="flex-grow p-2 overflow-hidden">
            <ChartContainer visualization={visualization} theme={theme} />
        </div>
    </aside>
  );
};

export default VisualizationPanel;

