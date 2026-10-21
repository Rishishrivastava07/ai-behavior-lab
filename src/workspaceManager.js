/**
 * Workspace Manager - Manages folder-based isolation for client policies and settings.
 *
 * NOTE ON SECURITY:
 * This implementation provides local folder-based workspace isolation.
 * It is designed for single-machine prototyping. Multi-user security, RBAC,
 * and authenticated session isolation will be added in a production milestone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, loadPolicy as loadDefaultAcmePolicy } from './config.js';

export const WORKSPACES_DIR = path.join(REPO_ROOT, 'workspaces');

export class WorkspaceManager {
  constructor(baseDir = WORKSPACES_DIR) {
    this.baseDir = baseDir;
    this._ensureWorkspacesDir();
    this._ensureDefaultWorkspace();
  }

  _ensureWorkspacesDir() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  _ensureDefaultWorkspace() {
    const defaultDir = path.join(this.baseDir, 'default');
    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }

    const policyFile = path.join(defaultDir, 'policy.json');
    if (!fs.existsSync(policyFile)) {
      const defaultText = loadDefaultAcmePolicy();
      const defaultData = {
        id: 'default',
        filename: 'Acme_Innovations_Policy_v2026.1.md',
        isDefault: true,
        uploadedAt: new Date().toISOString(),
        charCount: defaultText.length,
        wordCount: defaultText.split(/\s+/).filter(Boolean).length,
        text: defaultText,
      };
      fs.writeFileSync(policyFile, JSON.stringify(defaultData, null, 2), 'utf-8');
    }
  }

  listWorkspaces() {
    this._ensureWorkspacesDir();
    const dirs = fs.readdirSync(this.baseDir, { withFileTypes: true });
    return dirs
      .filter((d) => d.isDirectory())
      .map((d) => {
        const id = d.name;
        const info = this.getWorkspaceInfo(id);
        return {
          id,
          name: id === 'default' ? 'Default Workspace (Acme Corp)' : `Workspace: ${id}`,
          isDefault: id === 'default',
          policyName: info.policy?.filename || 'No policy loaded',
          uploadedAt: info.policy?.uploadedAt || null,
          charCount: info.policy?.charCount || 0,
        };
      });
  }

  getWorkspaceDir(workspaceId = 'default') {
    // Sanitize ID to prevent path traversal attacks
    const sanitizedId = workspaceId.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
    const dir = path.join(this.baseDir, sanitizedId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  getWorkspaceInfo(workspaceId = 'default') {
    const dir = this.getWorkspaceDir(workspaceId);
    const policyFile = path.join(dir, 'policy.json');

    if (fs.existsSync(policyFile)) {
      try {
        const policy = JSON.parse(fs.readFileSync(policyFile, 'utf-8'));
        return { id: workspaceId, policy };
      } catch {}
    }

    // Fall back to default policy if custom workspace has no policy yet
    const defaultText = loadDefaultAcmePolicy();
    return {
      id: workspaceId,
      policy: {
        id: workspaceId,
        filename: 'Acme_Innovations_Policy_v2026.1.md',
        isDefault: true,
        uploadedAt: new Date().toISOString(),
        charCount: defaultText.length,
        wordCount: defaultText.split(/\s+/).filter(Boolean).length,
        text: defaultText,
      },
    };
  }

  savePolicy(workspaceId = 'default', { filename, text, charCount, wordCount }) {
    const dir = this.getWorkspaceDir(workspaceId);
    const policyFile = path.join(dir, 'policy.json');

    const data = {
      id: workspaceId,
      filename: filename || 'custom_policy.txt',
      isDefault: false,
      uploadedAt: new Date().toISOString(),
      charCount: charCount || text.length,
      wordCount: wordCount || text.split(/\s+/).filter(Boolean).length,
      text,
    };

    fs.writeFileSync(policyFile, JSON.stringify(data, null, 2), 'utf-8');
    return data;
  }

  resetPolicy(workspaceId = 'default') {
    const dir = this.getWorkspaceDir(workspaceId);
    const policyFile = path.join(dir, 'policy.json');
    const defaultText = loadDefaultAcmePolicy();

    const data = {
      id: workspaceId,
      filename: 'Acme_Innovations_Policy_v2026.1.md',
      isDefault: true,
      uploadedAt: new Date().toISOString(),
      charCount: defaultText.length,
      wordCount: defaultText.split(/\s+/).filter(Boolean).length,
      text: defaultText,
    };

    fs.writeFileSync(policyFile, JSON.stringify(data, null, 2), 'utf-8');
    return data;
  }
}
