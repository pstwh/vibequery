import React, { useEffect, useRef } from 'react';
import {
  select,
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  drag,
  zoom,
  zoomIdentity,
  Simulation,
  D3DragEvent,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from 'd3';
import { GraphData, GraphNode } from '../types/types';
import { CenterViewIcon, FileIcon, TableIcon, TargetIcon } from './icons';

interface GraphViewProps {
  data: GraphData;
  theme: 'light' | 'dark';
}

const GraphView: React.FC<GraphViewProps> = ({ data, theme }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<Simulation<GraphNode, undefined> | null>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    const svg = select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [-width / 2, -height / 2, width, height].join(' '));

    svg.selectAll("*").remove();

    const g = svg.append('g');

    const simulation = forceSimulation(data.nodes)
        .force('link', forceLink<GraphNode, SimulationLinkDatum<GraphNode>>(data.links).id(d => d.id).distance(60))
        .force('charge', forceManyBody().strength(-40))
        .force('center', forceCenter(0, 0));
    simulationRef.current = simulation;

    const link = g.append('g')
      .attr('stroke', theme === 'dark' ? '#999' : '#a1a1aa')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('stroke-width', 1.5);

    const node = g.append('g')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .call(createDragHandler(simulation));

    const fileNodes = node.filter(d => d.group === 'file');
    fileNodes.append('circle')
      .attr('r', 20)
      .attr('fill', theme === 'dark' ? '#0e639c' : '#2563eb');

    const tableNodes = node.filter(d => d.group === 'table');
    tableNodes.append('circle')
      .attr('r', 15)
      .attr('fill', theme === 'dark' ? '#2a9d8f' : '#10b981');
      
    const viewNodes = node.filter(d => d.group === 'view');
    viewNodes.append('circle')
      .attr('r', 15)
      .attr('fill', theme === 'dark' ? '#e76f51' : '#f97316');

    node.append('text')
      .attr('y', d => d.group === 'file' ? 30 : 25)
      .attr('text-anchor', 'middle')
      .attr('fill', theme === 'dark' ? '#d4d4d4' : '#18181b')
      .attr('font-size', '10px')
      .text(d => d.name);
      
    simulation.on('tick', () => {
        link
          .attr('x1', d => (d.source as SimulationNodeDatum).x!)
          .attr('y1', d => (d.source as SimulationNodeDatum).y!)
          .attr('x2', d => (d.target as SimulationNodeDatum).x!)
          .attr('y2', d => (d.target as SimulationNodeDatum).y!);
        node
          .attr('transform', d => `translate(${d.x},${d.y})`);
      });

    function createDragHandler(simulation: Simulation<GraphNode, undefined>) {
        function dragstarted(event: D3DragEvent<Element, GraphNode, GraphNode>) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        function dragged(event: D3DragEvent<Element, GraphNode, GraphNode>) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        function dragended(event: D3DragEvent<Element, GraphNode, GraphNode>) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        return drag<Element, GraphNode>().on('start', dragstarted).on('drag', dragged).on('end', dragended);
    }

    const zoomHandler = zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
        g.attr('transform', event.transform);
    });
    svg.call(zoomHandler);
    zoomBehaviorRef.current = zoomHandler;

  }, [data, theme]);

  const handleCenterView = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    const svg = select(svgRef.current);
    svg.transition().duration(750).call(
        zoomBehaviorRef.current.transform,
        zoomIdentity
    );
  };

  const handleResetNodesToOrigin = () => {
    if (!simulationRef.current) return;
    (data.nodes as any[]).forEach((n: any) => {
      n.x = 0;
      n.y = 0;
      n.vx = 0;
      n.vy = 0;
      n.fx = null;
      n.fy = null;
    });
    simulationRef.current.alpha(1).restart();
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-white dark:bg-db-dark overflow-hidden">
      <svg ref={svgRef}></svg>
      <div className="absolute top-2 right-2 flex items-center gap-2">
        <button
          onClick={handleCenterView}
          className="p-1.5 bg-white/60 dark:bg-db-dark-3/60 backdrop-blur rounded-md text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-db-dark-3/80 transition-colors shadow-card border border-gray-200 dark:border-db-dark-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"
          title="Center View"
        >
          <CenterViewIcon />
        </button>
        <button
          onClick={handleResetNodesToOrigin}
          className="p-1.5 bg-white/60 dark:bg-db-dark-3/60 backdrop-blur rounded-md text-gray-600 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-db-dark-3/80 transition-colors shadow-card border border-gray-200 dark:border-db-dark-3 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-db-accent dark:focus:ring-offset-db-dark-2"
          title="Move nodes to origin"
        >
          <TargetIcon />
        </button>
      </div>
      {data.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center p-8 border-2 border-dashed border-gray-200 dark:border-db-dark-3 rounded-lg">
                  <h3 className="text-2xl font-semibold text-gray-600 dark:text-gray-400">vibequery</h3>
                  <p className="text-gray-500 mt-2">Your data, visually connected.</p>
                  <p className="text-gray-400 dark:text-gray-600 mt-4">Drag and drop CSV, Parquet, JSON, XLSX, SQLite files or folders (Delta, Parquet) to begin.</p>
              </div>
          </div>
      )}
    </div>
  );
};

export default GraphView;

