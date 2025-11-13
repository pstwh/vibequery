import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { QueryResult } from '../types/types';

interface ChartProps {
  data: QueryResult;
  theme: 'light' | 'dark';
}

const THEME_COLORS = {
    light: {
        axis: '#6b7280',
        label: '#374151',
        bar: '#2563eb',
        hist: '#10b981',
        scatter: '#ef4444',
        line: '#f97316',
    },
    dark: {
        axis: '#9ca3af',
        label: '#d1d5db',
        bar: '#0e639c',
        hist: '#2a9d8f',
        scatter: '#e76f51',
        line: '#e76f51',
    }
}

const ChartMessage: React.FC<{ message: string }> = ({ message }) => (
    <div className="w-full h-full flex items-center justify-center p-4">
        <div className="text-center text-sm text-gray-600 dark:text-gray-400 border border-dashed border-gray-300 dark:border-db-dark-3 p-4 rounded-md">
            {message}
        </div>
    </div>
);

export const HistogramChart: React.FC<ChartProps> = ({ data, theme }) => {
    const ref = useRef<SVGSVGElement>(null);
    const colors = THEME_COLORS[theme];

    useEffect(() => {
        if (!data || !ref.current || data.columns.length < 1 || data.rows.length === 0) return;
        
        const values = data.rows.map(r => +r[0]).filter(v => !isNaN(v));
        if (values.length === 0) return;

        const svg = d3.select(ref.current);
        svg.selectAll("*").remove();

        const parent = (ref.current.parentElement as HTMLElement);
        const margin = { top: 20, right: 30, bottom: 40, left: 50 };
        const width = parent.clientWidth - margin.left - margin.right;
        const height = parent.clientHeight - margin.top - margin.bottom;

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear()
            .domain(d3.extent(values) as [number, number])
            .range([0, width]);
        
        const xAxis = g.append("g")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(x));
        xAxis.selectAll("text").style("fill", colors.axis);
        xAxis.selectAll("line").style("stroke", colors.axis);
        xAxis.select(".domain").style("stroke", colors.axis);


        const histogram = d3.bin().domain(x.domain() as [number, number]).thresholds(x.ticks(20));
        const bins = histogram(values);

        const y = d3.scaleLinear()
            .range([height, 0])
            .domain([0, d3.max(bins, d => d.length) as number]);
        
        const yAxis = g.append("g").call(d3.axisLeft(y));
        yAxis.selectAll("text").style("fill", colors.axis);
        yAxis.selectAll("line").style("stroke", colors.axis);
        yAxis.select(".domain").style("stroke", colors.axis);
        
        g.selectAll("rect")
            .data(bins)
            .enter()
            .append("rect")
            .attr("x", 1)
            .attr("transform", d => `translate(${x(d.x0!)},${y(d.length)})`)
            .attr("width", d => Math.max(0, x(d.x1!) - x(d.x0!) - 1))
            .attr("height", d => height - y(d.length))
            .style("fill", colors.hist);

    }, [data, theme, colors]);
    
    if (data.columns.length !== 1) {
        return <ChartMessage message={`Histogram requires 1 column, but query returned ${data.columns.length}.`} />
    }
    if (data.rows.map(r => +r[0]).filter(v => !isNaN(v)).length === 0) {
        return <ChartMessage message="The selected column contains no valid numerical data for a histogram." />
    }

    return <div className="w-full h-full"><svg ref={ref} width="100%" height="100%"></svg></div>;
};


export const BarChart: React.FC<ChartProps> = ({ data, theme }) => {
    const ref = useRef<SVGSVGElement>(null);
    const colors = THEME_COLORS[theme];

    useEffect(() => {
        if (!data || !ref.current || data.columns.length < 2 || data.rows.length === 0) return;
        
        const svg = d3.select(ref.current);
        svg.selectAll("*").remove();

        const parent = (ref.current.parentElement as HTMLElement);
        const margin = { top: 20, right: 30, bottom: 60, left: 50 };
        const width = parent.clientWidth - margin.left - margin.right;
        const height = parent.clientHeight - margin.top - margin.bottom;

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
        
        const categories = data.rows.map(r => String(r[0]));
        const values = data.rows.map(r => +r[1]);

        const x = d3.scaleBand().range([0, width]).domain(categories).padding(0.2);
        const xAxis = g.append("g")
         .attr("transform", `translate(0,${height})`)
         .call(d3.axisBottom(x));
        xAxis.selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end")
            .style("fill", colors.axis);
        xAxis.selectAll("line").style("stroke", colors.axis);
        xAxis.select(".domain").style("stroke", colors.axis);


        const y = d3.scaleLinear().domain([0, d3.max(values) as number]).range([height, 0]);
        const yAxis = g.append("g").call(d3.axisLeft(y));
        yAxis.selectAll("text").style("fill", colors.axis);
        yAxis.selectAll("line").style("stroke", colors.axis);
        yAxis.select(".domain").style("stroke", colors.axis);

        g.selectAll("mybar")
         .data(data.rows)
         .enter()
         .append("rect")
         .attr("x", d => x(String(d[0])) as number)
         .attr("y", d => y(+d[1]))
         .attr("width", x.bandwidth())
         .attr("height", d => height - y(+d[1]))
         .attr("fill", colors.bar);

    }, [data, theme, colors]);

    if (data.columns.length !== 2) {
        return <ChartMessage message={`Bar chart requires 2 columns, but query returned ${data.columns.length}.`} />
    }

    return <div className="w-full h-full"><svg ref={ref} width="100%" height="100%"></svg></div>;
};

export const ScatterChart: React.FC<ChartProps> = ({ data, theme }) => {
    const ref = useRef<SVGSVGElement>(null);
    const colors = THEME_COLORS[theme];

    useEffect(() => {
        if (!data || !ref.current || data.columns.length < 2 || data.rows.length === 0) return;
        
        const svg = d3.select(ref.current);
        svg.selectAll("*").remove();

        const parent = (ref.current.parentElement as HTMLElement);
        const margin = { top: 20, right: 30, bottom: 50, left: 60 };
        const width = parent.clientWidth - margin.left - margin.right;
        const height = parent.clientHeight - margin.top - margin.bottom;

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const xValues = data.rows.map(r => +r[0]);
        const yValues = data.rows.map(r => +r[1]);

        const x = d3.scaleLinear().domain(d3.extent(xValues) as [number, number]).range([0, width]);
        const xAxis = g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
        xAxis.selectAll("text").style("fill", colors.axis);
        xAxis.selectAll("line").style("stroke", colors.axis);
        xAxis.select(".domain").style("stroke", colors.axis);

        const y = d3.scaleLinear().domain(d3.extent(yValues) as [number, number]).range([height, 0]);
        const yAxis = g.append("g").call(d3.axisLeft(y));
        yAxis.selectAll("text").style("fill", colors.axis);
        yAxis.selectAll("line").style("stroke", colors.axis);
        yAxis.select(".domain").style("stroke", colors.axis);
        
        g.append("text")
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom - 10)
            .style("fill", colors.label)
            .text(data.columns[0]);

        g.append("text")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left + 20)
            .attr("x", -height / 2)
            .style("fill", colors.label)
            .text(data.columns[1]);

        g.append('g')
         .selectAll("dot")
         .data(data.rows)
         .enter()
         .append("circle")
         .attr("cx", d => x(+d[0]))
         .attr("cy", d => y(+d[1]))
         .attr("r", 3)
         .style("fill", colors.scatter);

    }, [data, theme, colors]);

    if (data.columns.length !== 2) {
        return <ChartMessage message={`Scatter plot requires 2 columns, but query returned ${data.columns.length}.`} />
    }

    return <div className="w-full h-full"><svg ref={ref} width="100%" height="100%"></svg></div>;
};

export const LineChart: React.FC<ChartProps> = ({ data, theme }) => {
    const ref = useRef<SVGSVGElement>(null);
    const colors = THEME_COLORS[theme];

    useEffect(() => {
        if (!data || !ref.current || data.columns.length < 2 || data.rows.length === 0) return;
        
        const svg = d3.select(ref.current);
        svg.selectAll("*").remove();

        const parent = (ref.current.parentElement as HTMLElement);
        const margin = { top: 20, right: 30, bottom: 50, left: 60 };
        const width = parent.clientWidth - margin.left - margin.right;
        const height = parent.clientHeight - margin.top - margin.bottom;

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        const xValues = data.rows.map(r => +r[0]);
        const yValues = data.rows.map(r => +r[1]);

        const x = d3.scaleLinear().domain(d3.extent(xValues) as [number, number]).range([0, width]);
        const xAxis = g.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
        xAxis.selectAll("text").style("fill", colors.axis);
        xAxis.selectAll("line").style("stroke", colors.axis);
        xAxis.select(".domain").style("stroke", colors.axis);

        const y = d3.scaleLinear().domain(d3.extent(yValues) as [number, number]).range([height, 0]);
        const yAxis = g.append("g").call(d3.axisLeft(y));
        yAxis.selectAll("text").style("fill", colors.axis);
        yAxis.selectAll("line").style("stroke", colors.axis);
        yAxis.select(".domain").style("stroke", colors.axis);

        g.append("text")
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom - 10)
            .style("fill", colors.label)
            .text(data.columns[0]);

        g.append("text")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("y", -margin.left + 20)
            .attr("x", -height / 2)
            .style("fill", colors.label)
            .text(data.columns[1]);

        g.append("path")
         .datum(data.rows)
         .attr("fill", "none")
         .attr("stroke", colors.line)
         .attr("stroke-width", 1.5)
         .attr("d", d3.line().x(d => x(+d[0])).y(d => y(+d[1])) as any);

    }, [data, theme, colors]);

    if (data.columns.length !== 2) {
        return <ChartMessage message={`Line chart requires 2 columns, but query returned ${data.columns.length}.`} />
    }

    return <div className="w-full h-full"><svg ref={ref} width="100%" height="100%"></svg></div>;
};

