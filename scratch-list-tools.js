import { spawn } from 'child_process';

const mcp = spawn('node', ['./node_modules/@testsprite/testsprite-mcp/dist/index.js'], {
  env: {
    ...process.env,
    API_KEY: 'sk-user-zcPFTRO1Zl5KKcaJil9QU8J24UKR-H0Hk8QLxVS_BhvzEkXNIYBK0iZLKJwUG5AvqBFchV8aW0u698IoHFJs6rbf_DkGqx77RIJS2oqz1myS04JykI977ZKkjrJfrJDnLUA'
  }
});

let buffer = '';
mcp.stdout.on('data', (data) => {
  buffer += data.toString();
  console.log("STDOUT:", data.toString());
});

mcp.stderr.on('data', (data) => {
  console.error("STDERR:", data.toString());
});

// Send JSON-RPC initialize
const initRequest = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "antigravity-test-client",
      version: "1.0.0"
    }
  }
};

mcp.stdin.write(JSON.stringify(initRequest) + "\n");

// Send tools/list after initialization
setTimeout(() => {
  const listToolsRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  };
  mcp.stdin.write(JSON.stringify(listToolsRequest) + "\n");
}, 1500);

// Exit safely after some time
setTimeout(() => {
  mcp.kill();
  process.exit(0);
}, 4000);
