import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "./server.js";

function startServer(options = {}) {
  const app = createApp(options);
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${port}`,
      });
    });
  });
}

test("health endpoint reports service status", async () => {
  const { server, baseUrl } = await startServer({ authEnabled: false });
  try {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, "ok");
    assert.equal(body.service, "omnigraph-api");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("entities endpoint returns paginated payload", async () => {
  const { server, baseUrl } = await startServer({ authEnabled: false });
  try {
    const res = await fetch(`${baseUrl}/api/entities?page=1&limit=5`);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(typeof body.count, "number");
    assert.equal(body.page, 1);
    assert.equal(body.limit, 5);
    assert.equal(typeof body.total_pages, "number");
    assert.ok(Array.isArray(body.entities));
    assert.ok(body.entities.length <= 5);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("auth is enforced when enabled", async () => {
  const apiKeys = new Map([["test-key-admin", "admin"]]);
  const { server, baseUrl } = await startServer({ authEnabled: true, apiKeys });
  try {
    const unauthorized = await fetch(`${baseUrl}/api/entities`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${baseUrl}/api/entities?page=1&limit=1`, {
      headers: {
        "x-api-key": "test-key-admin",
      },
    });
    assert.equal(authorized.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("role-based access blocks source mapping for viewer", async () => {
  const apiKeys = new Map([
    ["viewer-key", "viewer"],
    ["analyst-key", "analyst"],
  ]);
  const { server, baseUrl } = await startServer({ authEnabled: true, apiKeys });
  try {
    const viewerRes = await fetch(`${baseUrl}/api/source-mapping?page=1&limit=2`, {
      headers: {
        "x-api-key": "viewer-key",
      },
    });
    assert.equal(viewerRes.status, 403);

    const analystRes = await fetch(`${baseUrl}/api/source-mapping?page=1&limit=2`, {
      headers: {
        "x-api-key": "analyst-key",
      },
    });
    assert.equal(analystRes.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("prometheus metrics endpoint emits counters", async () => {
  const { server, baseUrl } = await startServer({ authEnabled: false });
  try {
    await fetch(`${baseUrl}/api/entities?page=1&limit=1`);
    const metricsRes = await fetch(`${baseUrl}/metrics`);
    assert.equal(metricsRes.status, 200);
    const text = await metricsRes.text();
    assert.match(text, /omnigraph_http_requests_total/);
    assert.match(text, /omnigraph_http_request_duration_ms_total/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
