import { useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";

function makeSyntheticGraphData() {
  const nodes = [];
  const links = [];

  const normalCount = 50;

  for (let i = 0; i < normalCount; i += 1) {
    nodes.push({
      id: `BIZ-${String(i + 1).padStart(3, "0")}`,
      name: `Business ${i + 1}`,
      type: "business",
      threatLevel: "Low",
      group: i % 8,
    });
  }

  for (let i = 0; i < normalCount - 1; i += 1) {
    links.push({
      source: nodes[i].id,
      target: nodes[i + 1].id,
      relation: "transaction",
    });
  }

  for (let i = 0; i < 26; i += 1) {
    const a = `BIZ-${String(1 + Math.floor(Math.random() * normalCount)).padStart(3, "0")}`;
    const b = `BIZ-${String(1 + Math.floor(Math.random() * normalCount)).padStart(3, "0")}`;
    if (a !== b) {
      links.push({ source: a, target: b, relation: "ownership" });
    }
  }

  const anomalyClusters = [
    {
      id: "THREAT-ALPHA",
      name: "Shell Cluster Alpha",
      address: "Plot 12, MIDC Andheri East",
      seeds: [2, 5, 11, 17, 23, 28, 35],
    },
    {
      id: "THREAT-BETA",
      name: "Shell Cluster Beta",
      address: "Unit 8, Sector 44, Gurgaon",
      seeds: [7, 9, 16, 21, 32, 40, 48],
    },
  ];

  anomalyClusters.forEach((cluster, idx) => {
    const threatNode = {
      id: cluster.id,
      name: cluster.name,
      type: "anomaly",
      threatLevel: "High",
      group: 100 + idx,
    };
    const addressNode = {
      id: `ADDR-${idx + 1}`,
      name: cluster.address,
      type: "address",
      threatLevel: "Observed",
      group: 200 + idx,
    };

    nodes.push(threatNode, addressNode);

    links.push({
      source: threatNode.id,
      target: addressNode.id,
      relation: "shares_address",
    });

    cluster.seeds.forEach((seed) => {
      const bizId = `BIZ-${String(seed).padStart(3, "0")}`;
      links.push({
        source: bizId,
        target: addressNode.id,
        relation: "registered_at",
      });
      links.push({
        source: bizId,
        target: threatNode.id,
        relation: "contributes_to_risk",
      });
    });
  });

  return { nodes, links };
}

function OmniGraph3D() {
  const fgRef = useRef(null);
  const hoverNodeRef = useRef(null);
  const anomalyMeshesRef = useRef(new Map());

  const [hoveredNode, setHoveredNode] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const graphData = useMemo(() => makeSyntheticGraphData(), []);

  const isAnomalyLink = (link) => {
    const sourceType = typeof link.source === "object" ? link.source?.type : null;
    const targetType = typeof link.target === "object" ? link.target?.type : null;
    return sourceType === "anomaly" || targetType === "anomaly";
  };

  const nodeThreeObject = (node) => {
    const group = new THREE.Group();

    if (node.type === "anomaly") {
      const coreGeometry = new THREE.SphereGeometry(5.2, 28, 28);
      const coreMaterial = new THREE.MeshStandardMaterial({
        color: "#ff2f4d",
        emissive: "#ff001e",
        emissiveIntensity: 1.6,
        metalness: 0.25,
        roughness: 0.3,
      });
      const coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);

      const glowGeometry = new THREE.SphereGeometry(7.2, 24, 24);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: "#ff3357",
        transparent: true,
        opacity: 0.25,
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);

      group.add(coreMesh);
      group.add(glowMesh);
      anomalyMeshesRef.current.set(node.id, group);
      return group;
    }

    if (node.type === "address") {
      const geometry = new THREE.SphereGeometry(2.1, 16, 16);
      const material = new THREE.MeshStandardMaterial({
        color: "#dce3f0",
        emissive: "#dce3f0",
        emissiveIntensity: 0.18,
        roughness: 0.7,
      });
      group.add(new THREE.Mesh(geometry, material));
      return group;
    }

    const geometry = new THREE.SphereGeometry(2.7, 18, 18);
    const material = new THREE.MeshStandardMaterial({
      color: "#37b7ff",
      emissive: "#2f78ff",
      emissiveIntensity: 0.8,
      metalness: 0.3,
      roughness: 0.4,
    });

    group.add(new THREE.Mesh(geometry, material));
    return group;
  };

  const focusNode = (node) => {
    if (!fgRef.current || !node) return;

    const distance = 95;
    const distRatio = 1 + distance / Math.hypot(node.x || 1, node.y || 1, node.z || 1);

    fgRef.current.cameraPosition(
      {
        x: (node.x || 0) * distRatio,
        y: (node.y || 0) * distRatio,
        z: (node.z || 0) * distRatio,
      },
      { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
      1200
    );
  };

  const updateTooltipPosition = () => {
    if (!fgRef.current || !hoverNodeRef.current) return;

    const coords = fgRef.current.graph2ScreenCoords(
      hoverNodeRef.current.x || 0,
      hoverNodeRef.current.y || 0,
      hoverNodeRef.current.z || 0
    );
    setTooltipPos({ x: coords.x + 12, y: coords.y + 12 });
  };

  const animateAnomalyPulse = () => {
    const t = Date.now() * 0.004;

    anomalyMeshesRef.current.forEach((group) => {
      const pulse = 1 + 0.14 * (Math.sin(t) + 1);
      group.scale.set(pulse, pulse, pulse);
    });
  };

  return (
    <div
      className="relative h-[640px] w-full overflow-hidden rounded-xl border border-slate-800"
      style={{ background: "#0A0F1A" }}
    >
      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-md border border-cyan-400/30 bg-slate-950/70 px-3 py-2 text-xs tracking-wide text-cyan-200 backdrop-blur">
        OMNIGRAPH CYBER COMMAND CENTER
      </div>

      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        backgroundColor="#0A0F1A"
        enableNodeDrag
        showNavInfo={false}
        nodeThreeObject={nodeThreeObject}
        linkWidth={(link) => (isAnomalyLink(link) ? 1.25 : 0.45)}
        linkColor={(link) => (isAnomalyLink(link) ? "rgba(255,58,78,0.62)" : "rgba(115,153,188,0.33)")}
        linkOpacity={0.55}
        linkDirectionalParticles={(link) => (isAnomalyLink(link) ? 4 : 0)}
        linkDirectionalParticleWidth={(link) => (isAnomalyLink(link) ? 1.5 : 0)}
        linkDirectionalParticleSpeed={(link) => (isAnomalyLink(link) ? 0.007 : 0)}
        linkDirectionalParticleColor={() => "#ff4d64"}
        onNodeClick={focusNode}
        onNodeHover={(node) => {
          hoverNodeRef.current = node || null;
          setHoveredNode(node || null);
          if (node) updateTooltipPosition();
        }}
        onEngineTick={() => {
          animateAnomalyPulse();
          updateTooltipPosition();
        }}
      />

      {hoveredNode ? (
        <div
          className="pointer-events-none absolute z-20 min-w-56 rounded-lg border border-cyan-300/35 bg-slate-950/95 p-3 text-xs text-slate-100 shadow-2xl"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          <div className="mb-1 text-[11px] uppercase tracking-widest text-cyan-300/90">Entity Intel</div>
          <div className="font-semibold text-cyan-100">{hoveredNode.name}</div>
          <div className="mt-1 text-slate-300">ID: {hoveredNode.id}</div>
          <div className="text-slate-300">Type: {hoveredNode.type}</div>
          <div className="text-slate-300">Threat Level: {hoveredNode.threatLevel}</div>
        </div>
      ) : null}
    </div>
  );
}

export default OmniGraph3D;