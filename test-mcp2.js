const { spawn } = require('child_process');

const p = spawn('node', ['dist/cli/index.js', 'mcp'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

p.stdout.on('data', (d) => {
  console.log('STDOUT:', JSON.stringify(d.toString()));
});
p.stderr.on('data', (d) => {
  console.log('STDERR:', JSON.stringify(d.toString()));
});

const req = {
  jsonrpc: "2.0",
  id: 1,
  method: "tools/call",
  params: {
    name: "create_branch_note",
    arguments: {
      repo: "email-extension",
      branch: "branch-fixes"
    }
  }
};

p.stdin.write(JSON.stringify(req) + '\n');
setTimeout(() => p.kill(), 2000);
