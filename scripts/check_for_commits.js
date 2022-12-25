const execa = require('execa')
const { readVersionFile } = require('./util')

async function checkForCommit(mode) {
  const lastCommit = readVersionFile({ fileName: 'commit_sync' })
  const { stdout } = await execa('git', [
    'log',
    '--pretty=%h | %s',
    `${lastCommit}..HEAD`,
    '--perl-regexp',
    '--author=^((?!Prismo|renovate).*)$',
  ])

  const commits = stdout.split('\n').map((l) => l.split(' | '))

  if (mode === 'check') {
    console.log(`::set-output name=has_commits::${Boolean(commits.length)}`)
    return
  }

  if (mode === 'last') {
    console.log(`::set-output name=latest_commit::${commits[commits.length - 1][0]}`)
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
