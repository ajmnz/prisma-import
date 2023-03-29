const execa = require('execa')
const { readVersionFile } = require('./util')

async function checkForCommit(mode) {
  const lastCommit = readVersionFile({ fileName: 'commit_sync' })

  const { stdout } = await execa('git', ['log', `${lastCommit}..HEAD`, `--pretty=%h | %s | %an`])

  const commits = stdout
    .split('\n')
    .map((l) => l.split(' | '))
    .filter(([sha, _, author]) => !['renovate', 'Prismo'].includes(author) && !!sha)

  if (mode === 'check') {
    console.log(`has_commits::${Boolean(commits.length)}`)
    console.log(`::set-output name=has_commits::${Boolean(commits.length)}`)
    return
  }

  if (mode === 'last') {
    console.log(`::set-output name=latest_commit::${commits[0][0]}`)
    return
  }

  console.log(
    commits
      .map(([sha, summary]) => `- [ ] ${summary} ([${sha}](https://github.com/prisma/language-tools/commit/${sha}))`)
      .join('\n'),
  )
}

module.exports = { checkForCommit }

if (require.main === module) {
  const args = process.argv.slice(2)
  const mode = args[0]

  if (mode && !['check', 'last'].includes(mode)) {
    throw new Error("Mode should be either 'check', 'last' or empty")
  }

  checkForCommit(mode)
}
