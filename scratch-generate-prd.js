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
  const lines = buffer.split('\n');
  buffer = lines.pop();

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const response = JSON.parse(line);
      console.log("MCP_RESPONSE:", JSON.stringify(response, null, 2));

      // If we got the initialization response, let's call testsprite_generate_standardized_prd
      if (response.id === 1) {
        const prdRequest = {
          jsonrpc: "2.0",
          id: 6,
          method: "tools/call",
          params: {
            name: "testsprite_generate_standardized_prd",
            arguments: {
              projectPath: "c:\\Users\\90535\\Desktop\\DersRotası"
            }
          }
        };
        mcp.stdin.write(JSON.stringify(prdRequest) + "\n");
      }

      // If response received, terminate
      if (response.id === 6) {
        console.log("PRD_GENERATION_SUCCESS!");
        mcp.kill();
        process.exit(0);
      }
    } catch (e) {
      console.log("RAW_LINE:", line);
    }
  }
});

mcp.stderr.on('data', (data) => {
  console.error("STDERR:", data.toString());
});

// Start initialization
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

// Timeout fallback
setTimeout(() => {
  console.log("Timeout waiting for PRD generation.");
  mcp.kill();
  process.exit(1);
}, 240000); // 4 minutes
