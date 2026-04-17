import { useEffect, useState } from "react";
import ForceGraph from "./components/ForceGraph.jsx";

const API_BASE = "http://localhost:8080";

function App() {
  const [metrics, setMetrics] = useState(null);
  const [entities, setEntities] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [m, e, a] = await Promise.all([
          fetch(`${API_BASE}/api/metrics`).then((r) => r.json()),
          fetch(`${API_BASE}/api/entities`).then((r) => r.json()),
          fetch(`${API_BASE}/api/anomalies`).then((r) => r.json()),
        ]);
        setMetrics(m);
        setEntities(e.entities || []);
        setAnomalies(a.anomalies || []);
      } catch (err) {
        setError("Could not load API data. Start backend on port 8080.");
      }
    }
    load();
  }, []);

  return (
    <main className="page min-h-screen bg-slate-950 text-slate-100">
      <h1 className="text-3xl font-semibold">OmniGraph Unified Command Dashboard</h1>
      {error ? <p className="error">{error}</p> : null}

      <section className="cards">
        <MetricCard label="Unified Entities" value={metrics?.total_entities ?? "-"} />
        <MetricCard label="Source Records" value={metrics?.total_source_records ?? "-"} />
        <MetricCard label="Source Systems" value={metrics?.source_systems ?? "-"} />
        <MetricCard label="Low Confidence Records" value={metrics?.low_confidence_records ?? "-"} />
        <MetricCard label="Anomaly Alerts" value={metrics?.anomaly_count ?? "-"} />
      </section>

      <section>
        <h2>Resolved Entities</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Entity ID</th>
                <th>Name</th>
                <th>PAN</th>
                <th>Location</th>
                <th>Sources</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((row) => (
                <tr key={row.entity_id}>
                  <td>{row.entity_id}</td>
                  <td>{row.canonical_name}</td>
                  <td>{row.pan}</td>
                  <td>
                    {row.city}, {row.state}
                  </td>
                  <td>{row.source_system_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>D3 Graph View</h2>
        <div className="graphWrap">
          <ForceGraph entities={entities} anomalies={anomalies} />
        </div>
      </section>

      <section>
        <h2>Anomaly Feed</h2>
        <ul className="anomalyList">
          {anomalies.length === 0 ? <li>No anomalies detected.</li> : null}
          {anomalies.map((a, i) => (
            <li key={i}>
              <strong>{a.severity}</strong> - {a.description} ({a.address})
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p className="value">{value}</p>
    </div>
  );
}

export default App;
