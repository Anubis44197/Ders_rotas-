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

      // If we got the initialization response, let's call testsprite_generate_code_and_execute
      if (response.id === 1) {
        const executeRequest = {
          jsonrpc: "2.0",
          id: 8,
          method: "tools/call",
          params: {
            name: "testsprite_generate_code_and_execute",
            arguments: {
              projectName: "DersRotası",
              projectPath: "c:\\Users\\90535\\Desktop\\DersRotası",
              testIds: [],
              additionalInstruction: "",
              serverMode: "development"
            }
          }
        };
        mcp.stdin.write(JSON.stringify(executeRequest) + "\n");
      }

      // If response received, terminate
      if (response.id === 8) {
        console.log("TEST_EXECUTION_COMPLETED!");
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

// Timeout fallback (generating and executing tests can take up to 10 minutes)
setTimeout(() => {
  console.log("Timeout waiting for test execution.");
  mcp.kill();
  process.exit(1);
}, 600000); // 10 minutes
