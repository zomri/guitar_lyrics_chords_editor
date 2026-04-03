import { defineConfig } from 'vite';

const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? '';
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  root: '.',
  base: isGitHubActions && repoName ? `/${repoName}/` : './',
  appType: 'spa',
});
