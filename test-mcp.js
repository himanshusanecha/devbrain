const { spawn } = require('child_process');

const p = spawn('node', ['dist/cli/index.js', 'mcp'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

p.stdout.on('data', (d) => {
  console.log('STDOUT:', d.toString());
});

const reqGlobal = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "get_active_context",
    arguments: {}
  }
};

const reqRepo = {
  jsonrpc: "2.0",
  id: 2,
  method: "tools/call",
  params: {
    name: "get_active_context",
    arguments: {
      repo: "test-repo"
    }
  }
};

p.stdin.write(JSON.stringify(reqGlobal) + '\n');
setTimeout(() => {
  p.stdin.write(JSON.stringify(reqRepo) + '\n');
}, 500);
setTimeout(() => p.kill(), 2000);
