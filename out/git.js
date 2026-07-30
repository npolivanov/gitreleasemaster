"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkspaceCwd = getWorkspaceCwd;
exports.listReleaseBranches = listReleaseBranches;
const simple_git_1 = __importDefault(require("simple-git"));
const vscode = __importStar(require("vscode"));
/**
 * Resolve the working directory that git commands should run in.
 * Returns the first workspace folder, or null if no folder is open.
 */
function getWorkspaceCwd() {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return null;
    }
    return folders[0].uri.fsPath;
}
/**
 * List all git branches whose name starts with `prefix`, sorted by last
 * commit date (newest first). Each branch is enriched with metadata from
 * its most recent commit.
 */
async function listReleaseBranches(cwd, prefix) {
    const git = (0, simple_git_1.default)({ baseDir: cwd });
    // Verify we are inside a git working tree.
    let isRepo = false;
    try {
        isRepo = await git.checkIsRepo();
    }
    catch {
        // ignore — treat as not-a-repo
    }
    if (!isRepo) {
        return {
            ok: false,
            reason: "not-a-repo",
            message: "The open folder is not a Git repository.",
        };
    }
    // `git.branch --list 'release/*' --sort=-committerdate`
    const safePrefix = prefix.endsWith("/") ? prefix : `${prefix}/`;
    let summary;
    try {
        summary = await git.branch([
            "--list",
            `${safePrefix}*`,
            "--sort=-committerdate",
        ]);
    }
    catch (err) {
        return {
            ok: false,
            reason: "git-error",
            message: err instanceof Error ? err.message : String(err),
        };
    }
    const names = Object.keys(summary.branches);
    if (names.length === 0) {
        return { ok: true, branches: [] };
    }
    const branches = [];
    for (const name of names) {
        const meta = summary.branches[name];
        try {
            const log = await git.log({ from: meta.commit, to: "HEAD", maxCount: 1 });
            const latest = log.latest;
            branches.push({
                name,
                lastCommitDate: latest?.date ?? new Date().toISOString(),
                author: latest?.author_name ?? meta.commit,
                sha: meta.commit,
            });
        }
        catch {
            // Fall back to whatever we already know from the branch summary.
            branches.push({
                name,
                lastCommitDate: new Date().toISOString(),
                author: meta.commit,
                sha: meta.commit,
            });
        }
    }
    // `git branch --sort` already orders them, but enforce a stable order in
    // case the underlying sort is unstable across platforms.
    branches.sort((a, b) => new Date(b.lastCommitDate).getTime() -
        new Date(a.lastCommitDate).getTime());
    return { ok: true, branches };
}
//# sourceMappingURL=git.js.map