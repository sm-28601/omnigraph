import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";

function ForceGraph({ entities, anomalies }) {
  const svgRef = useRef(null);

  const graphData = useMemo(() => {
    const nodes = (entities || []).map((e) => ({
      id: e.entity_id,
      label: e.canonical_name,
      risk: Number(e.source_system_count || 0) >= 4 ? "HIGH" : "NORMAL",
    }));
    const links = [];
    for (let i = 1; i < nodes.length; i += 1) {
      links.push({ source: nodes[i - 1].id, target: nodes[i].id });
    }

    // Connect potentially risky nodes to anomaly hubs for visual emphasis.
    (anomalies || []).forEach((a, idx) => {
      const hubId = `ANOMALY-${idx + 1}`;
      nodes.push({ id: hubId, label: a.type || "ANOMALY", risk: "ALERT", anomaly: true });
      if (nodes[idx]) links.push({ source: hubId, target: nodes[idx].id });
    });
    return { nodes, links };
  }, [entities, anomalies]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 900;
    const height = 320;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const link = svg
      .append("g")
      .attr("stroke", "#60708f")
      .attr("stroke-opacity", 0.8)
      .selectAll("line")
      .data(graphData.links)
      .join("line")
      .attr("stroke-width", 1.5);

    const node = svg
      .append("g")
      .attr("stroke", "#0b1220")
      .attr("stroke-width", 1.2)
      .selectAll("circle")
      .data(graphData.nodes)
      .join("circle")
      .attr("r", (d) => (d.anomaly ? 10 : 14))
      .attr("fill", (d) => (d.risk === "ALERT" ? "#ef4444" : d.risk === "HIGH" ? "#f59e0b" : "#38bdf8"))
      .call(
        d3
          .drag()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    const label = svg
      .append("g")
      .selectAll("text")
      .data(graphData.nodes)
      .join("text")
      .text((d) => d.id)
      .attr("font-size", 10)
      .attr("fill", "#dbe8ff")
      .attr("dx", 10)
      .attr("dy", 4);

    const simulation = d3
      .forceSimulation(graphData.nodes)
      .force("link", d3.forceLink(graphData.links).id((d) => d.id).distance(90))
      .force("charge", d3.forceManyBody().strength(-250))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .on("tick", () => {
        link
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
        label.attr("x", (d) => d.x).attr("y", (d) => d.y);
      });

    return () => simulation.stop();
  }, [graphData]);

  return <svg ref={svgRef} className="w-full min-w-[760px] h-[320px]" />;
}

export default ForceGraph;
