import * as vscode from "vscode";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    "gitCommitMoodTracker.analyzeCommits",
    () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage("No workspace folder open.");
        return;
      }

      const repoPath = workspaceFolder.uri.fsPath;

      // IMPORTANT: shell:true fixes Git on Windows
      const git = spawn(
        "git",
        ["log", "--pretty=format:%s", "-n", "50"],
        { cwd: repoPath, shell: true }
      );

      let output = "";
      let errorOutput = "";

      git.stdout.on("data", (data) => {
        output += data.toString();
      });

      git.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      git.on("close", () => {
        if (!output.trim()) {
          vscode.window.showErrorMessage(
            "Git log returned no commits. Is this a Git repository?"
          );
          return;
        }

        const commits = output
          .split("\n")
          .map(c => c.trim())
          .filter(Boolean);

        runPythonAnalysis(commits, context);
      });

      git.on("error", () => {
        vscode.window.showErrorMessage("Failed to execute git.");
      });
    }
  );

  context.subscriptions.push(disposable);
}

function runPythonAnalysis(
  commits: string[],
  context: vscode.ExtensionContext
) {
  const pythonScript = path.join(
    context.extensionPath,
    "python",
    "mood_analyzer.py"
  );

  const pythonCmd = process.platform === "win32" ? "python" : "python3";

  const python = spawn(
    pythonCmd,
    [pythonScript],
    { shell: true }
  );

  let output = "";
  let errorOutput = "";

  python.stdin.write(JSON.stringify(commits));
  python.stdin.end();

  python.stdout.on("data", (data) => {
    output += data.toString();
  });

  python.stderr.on("data", (data) => {
    errorOutput += data.toString();
  });

  python.on("close", () => {
    if (!output.trim()) {
      vscode.window.showErrorMessage(
        "Python script returned no data."
      );
      return;
    }

    try {
      const results = JSON.parse(output);
      showWebview(results, context);
    } catch (e) {
      vscode.window.showErrorMessage(
        "Failed to parse Python output."
      );
    }
  });
}

function showWebview(data: any, context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "commitMoodTracker",
    "Git Commit Mood Tracker",
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  const htmlPath = path.join(
    context.extensionPath,
    "media",
    "webviewContent.html"
  );

  let html = fs.readFileSync(htmlPath, "utf8");

  const injectedData = `
<script id="data-json" type="application/json">
${JSON.stringify(data)}
</script>
`;

  html = html.replace("<!-- DATA_PLACEHOLDER -->", injectedData);

  panel.webview.html = html;
}

export function deactivate() {}
