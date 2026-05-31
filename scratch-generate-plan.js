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

      // If we got the initialization response, let's call generate_frontend_test_plan
      if (response.id === 1) {
        const planRequest = {
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: {
            name: "testsprite_generate_frontend_test_plan",
            arguments: {
              projectPath: "c:\\Users\\90535\\Desktop\\DersRotası",
              needLogin: false
            }
          }
        };
        mcp.stdin.write(JSON.stringify(planRequest) + "\n");
      }

      // If response received, terminate
      if (response.id === 5) {
        console.log("PLAN_GENERATION_SUCCESS!");
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

// Timeout fallback (plan generation might take a few minutes as it uses LLMs to analyze code)
setTimeout(() => {
  console.log("Timeout waiting for plan generation.");
  mcp.kill();
  process.exit(1);
}, 240000); // 4 minutes
