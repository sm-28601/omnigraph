import { useMemo, useRef, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import * as THREE from "three";

function IconRecords() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-cyan-300">
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 9h8M8 12h8M8 15h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconResolved() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-cyan-300">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.5 12 2.3 2.3L15.8 9.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAnomaly() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-rose-300">
      <path d="M12 4 20 19H4L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="16.8" r="1" fill="currentColor" />
    </svg>
  );
}

function IconActive() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-emerald-300">
      <path d="M12 4v8l5 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function buildGraphData() {
  const nodes = [];
  const links = [];

  for (let i = 1; i <= 50; i += 1) {
    nodes.push({
      id: `ENT-${String(i).padStart(4, "0")}`,
      name: `Business ${i}`,
      type: i % 6 === 0 ? "resolved_business" : "business",
      threatLevel: i % 6 === 0 ? "Medium" : "Low",
      clusterId: `core-${(i % 5) + 1}`,
    });
  }

  for (let i = 1; i < 50; i += 1) {
    links.push({
      source: `ENT-${String(i).padStart(4, "0")}`,
      target: `ENT-${String(i + 1).padStart(4, "0")}`,
      relation: "transaction",
      clusterId: `core-${(i % 5) + 1}`,
    });
  }

  for (let i = 0; i < 24; i += 1) {
    const a = `ENT-${String(1 + Math.floor(Math.random() * 50)).padStart(4, "0")}`;
    const b = `ENT-${String(1 + Math.floor(Math.random() * 50)).padStart(4, "0")}`;
    if (a !== b) {
      links.push({ source: a, target: b, relation: "ownership", clusterId: "cross" });
    }
  }

  const anomalyClusters = [
    {
      clusterId: "cluster-red-1",
      anomalyId: "ANOM-DEL-42",
      anomalyNodeId: "THREAT-DELHI-42",
      addressNodeId: "ADDR-ROOM-42",
      anomalyName: "Room 42 Shared Registration Ring",
      addressName: "Room 42, Paharganj Industrial Arcade, Delhi",
      seeds: [15, 16, 17, 18, 19, 20],
      threatLevel: "Critical",
      type: "ADDRESS_CLUSTER",
    },
    {
      clusterId: "cluster-red-2",
      anomalyId: "ANOM-PHN-800",
      anomalyNodeId: "THREAT-PHONE-800",
      addressNodeId: "PHONE-800-123-4567",
      anomalyName: "Hotline Reuse Fraud Ring",
      addressName: "800-123-4567",
      seeds: [31, 32, 33, 34, 35, 36],
      threatLevel: "High",
      type: "PHONE_REUSE",
    },
  ];

  anomalyClusters.forEach((cluster) => {
    nodes.push(
      {
        id: cluster.anomalyNodeId,
        name: cluster.anomalyName,
        type: "anomaly",
        anomalyType: cluster.type,
        threatLevel: cluster.threatLevel,
        clusterId: cluster.clusterId,
      },
      {
        id: cluster.addressNodeId,
        name: cluster.addressName,
        type: "address_or_id",
        threatLevel: "Observed",
        clusterId: cluster.clusterId,
      }
    );

    links.push({
      source: cluster.anomalyNodeId,
      target: cluster.addressNodeId,
      relation: "correlated_signal",
      clusterId: cluster.clusterId,
      anomalyLink: true,
    });

    cluster.seeds.forEach((seed) => {
      const entityId = `ENT-${String(seed).padStart(4, "0")}`;
      const seededNode = nodes.find((node) => node.id === entityId);
      if (seededNode) {
        seededNode.clusterId = cluster.clusterId;
        seededNode.threatLevel = "Elevated";
      }

      links.push(
        {
          source: entityId,
          target: cluster.addressNodeId,
          relation: "registered_at",
          clusterId: cluster.clusterId,
          anomalyLink: true,
        },
        {
          source: entityId,
          target: cluster.anomalyNodeId,
          relation: "risk_proximity",
          clusterId: cluster.clusterId,
          anomalyLink: true,
        }
      );
    });
  });

  return { nodes, links, anomalyClusters };
}

const metricCards = [
  {
    label: "Total Records",
    value: "35,450",
    delta: "+5.2% vs last month",
    deltaClass: "text-emerald-300",
    icon: <IconRecords />,
  },
  {
    label: "Resolved Entities",
    value: "3,120",
    delta: "+2.1%",
    deltaClass: "text-emerald-300",
    icon: <IconResolved />,
  },
  {
    label: "Anomalies Detected",
    value: "150",
    delta: "+10.5%",
    deltaClass: "text-rose-300",
    icon: <IconAnomaly />,
  },
  {
    label: "Active Entities",
    value: "2,970",
    delta: "-0.3%",
    deltaClass: "text-emerald-300",
    icon: <IconActive />,
  },
];

const anomalyFeed = [
  {
    id: "ANOM-DEL-42",
    clusterId: "cluster-red-1",
    severity: "CRITICAL",
    type: "ADDRESS_CLUSTER",
    entities: "ENT-0015, ENT-0016, ENT-0017, ENT-0018",
    description: "12 entities mapped to Room 42, Delhi with synchronized registration windows.",
  },
  {
    id: "ANOM-PHN-800",
    clusterId: "cluster-red-2",
    severity: "HIGH",
    type: "PHONE_REUSE",
    entities: "ENT-0031, ENT-0032, ENT-0033, ENT-0034",
    description: "Shared hotline 800-123-4567 reused across shell entities in two states.",
  },
  {
    id: "ANOM-KYC-71",
    clusterId: "cluster-red-1",
    severity: "HIGH",
    type: "KYC_DOC_REUSE",
    entities: "ENT-0019, ENT-0020, ENT-0021",
    description: "Near-identical KYC signatures attached to separate legal entities.",
  },
  {
    id: "ANOM-TAX-09",
    clusterId: "cluster-red-2",
    severity: "MEDIUM",
    type: "TAX_CREDIT_LOOP",
    entities: "ENT-0035, ENT-0036, ENT-0037",
    description: "Circular invoice pattern indicates synthetic input-credit movement.",
  },
];

const recentEntities = [
  {
    entity_id: "ENT-0001",
    canonical_name: "Acme Industries Pvt Ltd",
    pan: "AAACA1234B",
    city: "Mumbai",
    state: "Maharashtra",
    source_system_count: 9,
    bypassed_tier_1: false,
  },
  {
    entity_id: "ENT-0002",
    canonical_name: "Sunrise Logistics LLP",
    pan: "AAKFS9988R",
    city: "Bengaluru",
    state: "Karnataka",
    source_system_count: 7,
    bypassed_tier_1: true,
  },
  {
    entity_id: "ENT-0003",
    canonical_name: "Metro Fabrication Works",
    pan: "AAEFM6677N",
    city: "Vadodara",
    state: "Gujarat",
    source_system_count: 6,
    bypassed_tier_1: false,
  },
  {
    entity_id: "ENT-0004",
    canonical_name: "Shree Traders Limited",
    pan: "ABCTS4455K",
    city: "Surat",
    state: "Gujarat",
    source_system_count: 8,
    bypassed_tier_1: true,
  },
  {
    entity_id: "ENT-0005",
    canonical_name: "Pioneer Ventures Pvt Ltd",
    pan: "AAQPV7812L",
    city: "Delhi",
    state: "Delhi",
    source_system_count: 5,
    bypassed_tier_1: true,
  },
];

function OmniGraphGrid() {
  const fgRef = useRef(null);
  const hoverNodeRef = useRef(null);
  const hoverLinkRef = useRef(null);
  const anomalyMeshesRef = useRef(new Map());

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedClusterId, setSelectedClusterId] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const graphData = useMemo(() => buildGraphData(), []);

  const isSelectedCluster = (item) => selectedClusterId && item?.clusterId === selectedClusterId;

  const focusOnNode = (node) => {
    if (!fgRef.current || !node) return;
    const distance = 120;
    const norm = Math.hypot(node.x || 1, node.y || 1, node.z || 1);
    const ratio = 1 + distance / norm;

    fgRef.current.cameraPosition(
      {
        x: (node.x || 0) * ratio,
        y: (node.y || 0) * ratio,
        z: (node.z || 0) * ratio,
      },
      { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
      1100
    );
  };

  const findClusterAnchorNode = (clusterId) =>
    graphData.nodes.find((n) => n.type === "anomaly" && n.clusterId === clusterId) ||
    graphData.nodes.find((n) => n.clusterId === clusterId);

  const onAnomalySelect = (clusterId) => {
    setSelectedClusterId(clusterId);
    const anchor = findClusterAnchorNode(clusterId);
    if (anchor) focusOnNode(anchor);
  };

  const nodeThreeObject = (node) => {
    const group = new THREE.Group();
    const highlighted = isSelectedCluster(node);

    if (node.type === "anomaly") {
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(highlighted ? 6.8 : 6.0, 30, 30),
        new THREE.MeshStandardMaterial({
          color: highlighted ? "#ff5f70" : "#ff2f4d",
          emissive: "#ff001e",
          emissiveIntensity: highlighted ? 2.4 : 1.8,
          metalness: 0.2,
          roughness: 0.25,
        })
      );
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(highlighted ? 9.5 : 8.5, 24, 24),
        new THREE.MeshBasicMaterial({ color: "#ff3a4d", transparent: true, opacity: highlighted ? 0.35 : 0.2 })
      );
      group.add(core);
      group.add(glow);
      anomalyMeshesRef.current.set(node.id, group);
      return group;
    }

    if (node.type === "address_or_id") {
      group.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(highlighted ? 2.6 : 2.2, 16, 16),
          new THREE.MeshStandardMaterial({
            color: highlighted ? "#f0f4ff" : "#cfd8ea",
            emissive: "#cfd8ea",
            emissiveIntensity: highlighted ? 0.35 : 0.2,
            roughness: 0.7,
          })
        )
      );
      return group;
    }

    if (node.type === "resolved_business") {
      group.add(
        new THREE.Mesh(
          new THREE.SphereGeometry(highlighted ? 4.0 : 3.5, 18, 18),
          new THREE.MeshStandardMaterial({
            color: highlighted ? "#6fc8ff" : "#3db5ff",
            emissive: "#206cff",
            emissiveIntensity: highlighted ? 1.55 : 1.25,
            metalness: 0.3,
            roughness: 0.4,
          })
        )
      );
      return group;
    }

    group.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(highlighted ? 3.1 : 2.8, 18, 18),
        new THREE.MeshStandardMaterial({
          color: highlighted ? "#74c6ff" : "#37b7ff",
          emissive: "#2563ff",
          emissiveIntensity: highlighted ? 1.25 : 0.9,
          metalness: 0.28,
          roughness: 0.4,
        })
      )
    );
    return group;
  };

  const updateTooltipPosition = () => {
    if (!fgRef.current || (!hoverNodeRef.current && !hoverLinkRef.current) || !tooltip) return;

    let coords;
    if (hoverNodeRef.current) {
      coords = fgRef.current.graph2ScreenCoords(
        hoverNodeRef.current.x || 0,
        hoverNodeRef.current.y || 0,
        hoverNodeRef.current.z || 0
      );
    } else if (hoverLinkRef.current) {
      const s = hoverLinkRef.current.source;
      const t = hoverLinkRef.current.target;
      coords = fgRef.current.graph2ScreenCoords(
        ((s?.x || 0) + (t?.x || 0)) / 2,
        ((s?.y || 0) + (t?.y || 0)) / 2,
        ((s?.z || 0) + (t?.z || 0)) / 2
      );
    }

    if (coords) {
      setTooltip((prev) => (prev ? { ...prev, x: coords.x + 12, y: coords.y + 12 } : prev));
    }
  };

  const animatePulse = () => {
    const t = Date.now() * 0.0045;
    anomalyMeshesRef.current.forEach((group, key) => {
      const boosted = selectedClusterId && graphData.nodes.find((n) => n.id === key)?.clusterId === selectedClusterId;
      const pulse = (boosted ? 1.12 : 1.0) + 0.14 * (Math.sin(t) + 1);
      group.scale.set(pulse, pulse, pulse);
    });
  };

  return (
    <div className="h-screen w-full overflow-hidden bg-[#070C15] text-slate-100">
      <div className="mx-auto flex h-full max-w-[1700px] flex-col gap-3 p-3">
        <header className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-cyan-100">OmniGraph Command Grid</h1>
            <p className="text-xs text-slate-400">30,000+ records | 40 departments | 25 shell-company clusters</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded border border-cyan-400/40 bg-cyan-900/20 px-2 py-1 text-cyan-200">Mentoring Mode</span>
            <button className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200 transition hover:border-slate-500">Scenario A</button>
            <button className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-200 transition hover:border-slate-500">Scenario B</button>
          </div>
        </header>

        <section className="grid grid-cols-4 gap-3">
          {metricCards.map((card) => (
            <div key={card.label} className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 shadow-[0_0_0_1px_rgba(30,41,59,0.35)]">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-slate-400">
                {card.icon}
                <span>{card.label}</span>
              </div>
              <div className="text-2xl font-semibold text-cyan-100">{card.value}</div>
              <div className={`mt-1 text-xs ${card.deltaClass}`}>{card.delta}</div>
            </div>
          ))}
        </section>

        <section className="grid min-h-0 flex-1 grid-cols-10 gap-3 overflow-hidden">
          <div className="relative col-span-7 min-h-0 overflow-hidden rounded-xl border border-slate-800 bg-[#090F1D]">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(56,78,110,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(56,78,110,0.22) 1px, transparent 1px)",
                backgroundSize: "34px 34px",
              }}
            />
            <div className="pointer-events-none absolute left-4 top-3 z-10">
              <h2 className="text-sm font-semibold text-cyan-100">3D Business Network Graph - Interactive Visualization of Entities &amp; Anomalies</h2>
              <p className="text-xs text-slate-400">Orbit, zoom, hover for intel, click to focus and isolate threat clusters.</p>
            </div>

            <ForceGraph3D
              ref={fgRef}
              graphData={graphData}
              backgroundColor="rgba(0,0,0,0)"
              nodeThreeObject={nodeThreeObject}
              showNavInfo={false}
              enableNodeDrag
              linkOpacity={0.5}
              linkWidth={(link) => {
                const hot = link.anomalyLink || (selectedClusterId && link.clusterId === selectedClusterId);
                return hot ? 1.4 : 0.45;
              }}
              linkColor={(link) => {
                const hot = link.anomalyLink || (selectedClusterId && link.clusterId === selectedClusterId);
                return hot ? "rgba(255,78,96,0.7)" : "rgba(93,163,220,0.32)";
              }}
              linkDirectionalParticles={(link) => (link.anomalyLink ? 4 : 0)}
              linkDirectionalParticleSpeed={(link) => (link.anomalyLink ? 0.007 : 0)}
              linkDirectionalParticleWidth={(link) => (link.anomalyLink ? 1.8 : 0)}
              linkDirectionalParticleColor={() => "#ff4d64"}
              onNodeClick={(node) => {
                focusOnNode(node);
                if (node?.clusterId?.startsWith("cluster-red")) setSelectedClusterId(node.clusterId);
              }}
              onNodeHover={(node) => {
                hoverNodeRef.current = node || null;
                hoverLinkRef.current = null;
                if (!node) {
                  setTooltip(null);
                  return;
                }
                setTooltip({
                  mode: "node",
                  title: node.name,
                  lines: [
                    `ID: ${node.id}`,
                    `Type: ${node.type}`,
                    `Threat Level: ${node.threatLevel || "Low"}`,
                  ],
                  x: 0,
                  y: 0,
                });
              }}
              onLinkHover={(link) => {
                hoverLinkRef.current = link || null;
                hoverNodeRef.current = null;
                if (!link) {
                  setTooltip(null);
                  return;
                }
                const sourceId = typeof link.source === "object" ? link.source.id : link.source;
                const targetId = typeof link.target === "object" ? link.target.id : link.target;
                setTooltip({
                  mode: "link",
                  title: link.relation || "relationship",
                  lines: [`From: ${sourceId}`, `To: ${targetId}`, link.anomalyLink ? "Threat Path: Active" : "Threat Path: Normal"],
                  x: 0,
                  y: 0,
                });
              }}
              onEngineTick={() => {
                animatePulse();
                updateTooltipPosition();
              }}
            />

            {tooltip ? (
              <div
                className="pointer-events-none absolute z-20 min-w-60 rounded-lg border border-cyan-300/35 bg-slate-950/95 p-3 text-xs shadow-2xl"
                style={{ left: tooltip.x, top: tooltip.y }}
              >
                <div className="mb-1 text-[11px] uppercase tracking-widest text-cyan-300">Signal Intel</div>
                <div className="font-semibold text-cyan-100">{tooltip.title}</div>
                <div className="mt-1 space-y-0.5 text-slate-300">
                  {tooltip.lines.map((line) => (
                    <div key={line}>{line}</div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <aside className="col-span-3 flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-950/90">
            <div className="border-b border-slate-800 px-3 py-3">
              <h3 className="text-sm font-semibold text-rose-100">High-Priority Anomaly Feed</h3>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-auto p-2">
              {anomalyFeed.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border p-3 ${
                    item.severity === "CRITICAL"
                      ? "border-rose-500/50 bg-rose-950/20"
                      : "border-rose-900/60 bg-slate-900/70"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs">
                      <IconAnomaly />
                      <span className="font-semibold text-rose-200">{item.type}</span>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[10px] ${item.severity === "CRITICAL" ? "bg-rose-500/30 text-rose-100" : "bg-amber-500/20 text-amber-200"}`}>
                      {item.severity}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300">{item.entities}</div>
                  <p className="mt-1 text-xs text-slate-400">{item.description}</p>
                  <button
                    className="mt-2 w-full rounded border border-rose-500/40 bg-rose-900/20 px-2 py-1.5 text-xs font-medium text-rose-200 transition hover:border-rose-300"
                    onClick={() => onAnomalySelect(item.clusterId)}
                  >
                    Investigate Cluster
                  </button>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section
          className={`overflow-hidden rounded-xl border border-slate-800 bg-slate-950/95 transition-all duration-300 ${
            drawerOpen ? "h-[32%]" : "h-12"
          }`}
        >
          <button
            onClick={() => setDrawerOpen((v) => !v)}
            className="flex h-12 w-full items-center justify-between border-b border-slate-800 px-4 text-left"
          >
            <span className="text-sm font-semibold text-cyan-100">Resolved Entities Table (Minimized Drawer)</span>
            <span className="text-xs text-slate-300">{drawerOpen ? "Collapse" : "Expand"}</span>
          </button>

          {drawerOpen ? (
            <div className="h-[calc(100%-3rem)] overflow-auto p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                <span>Bypassed Tier 1: 2 of 5 shown</span>
                <span>Page 1 of 624</span>
              </div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-slate-300">
                    <th className="border border-slate-800 p-2 text-left">Entity ID</th>
                    <th className="border border-slate-800 p-2 text-left">Name</th>
                    <th className="border border-slate-800 p-2 text-left">PAN</th>
                    <th className="border border-slate-800 p-2 text-left">City</th>
                    <th className="border border-slate-800 p-2 text-left">State</th>
                    <th className="border border-slate-800 p-2 text-left">Sources</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEntities.map((row) => (
                    <tr key={row.entity_id} className="hover:bg-slate-900/60">
                      <td className="border border-slate-800 p-2 text-cyan-200">{row.entity_id}</td>
                      <td className="border border-slate-800 p-2">{row.canonical_name}</td>
                      <td className="border border-slate-800 p-2">{row.pan}</td>
                      <td className="border border-slate-800 p-2">{row.city}</td>
                      <td className="border border-slate-800 p-2">{row.state}</td>
                      <td className="border border-slate-800 p-2">
                        <span>{row.source_system_count}</span>
                        {row.bypassed_tier_1 ? (
                          <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">Bypassed Tier 1</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

export default OmniGraphGrid;
