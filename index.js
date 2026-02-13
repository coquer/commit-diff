const core = require('@actions/core');
const { Octokit } = require('@octokit/action');

async function run() {
  try {
    const base = core.getInput('base') || process.env.GITHUB_BASE_REF;
    const head = core.getInput('head') || process.env.GITHUB_HEAD_REF;
    const tokenInput = core.getInput('token') || process.env.GITHUB_TOKEN;
    const repository = core.getInput('repository') || process.env.GITHUB_REPOSITORY;
    const filterBy = core.getInput('filter_by') || process.env.FILTER_BY;

    let octokit;
    if (tokenInput) {
      octokit = new Octokit({ auth: tokenInput });
    } else {
      octokit = new Octokit();
    }

    const [owner, repo] = repository.split('/');
    const blackListedPrefixes = filterBy
        ? filterBy.split(',').map(s => s.trim()).filter(Boolean)
        : [];
    core.info(`Comparing ${base}...${head} in ${owner}/${repo}`);

    const response = await octokit.request('GET /repos/{owner}/{repo}/compare/{base}...{head}', {
      owner,
      repo,
      base,
      head,
      headers: { accept: 'application/vnd.github.v3+json' }
    });

    if (response.status !== 200) {
      core.setFailed('GitHub API error response')
    }

    const files = response.data.files || [];
    const changedDirs = new Set();

    for (const file of files) {
      const path = file.filename;
      if (!path.includes('/')) {
        continue;
      }

      const parts = path.split('/');
      if (parts.length < 2) {
        continue;
      }

      const part1 = parts[0]
      const part2 = parts[1]

      const dirPath = `${part1}/${part2}`

      if (blackListedPrefixes.length > 0) {
        const matchesAllow = blackListedPrefixes.some(prefix => dirPath.startsWith(prefix));
        if (matchesAllow) continue;
      }

      changedDirs.add(dirPath);
    }

    const result = {
      changed_dirs: Array.from(changedDirs).sort()
    };

    core.setOutput('changed-dirs', JSON.stringify(result));
    core.info(`Detected changed top-level directories: ${result.changed_dirs.join(', ') || 'none'}`);

  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

run().catch((error) => {
  core.setFailed(error.message);
});