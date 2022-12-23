const { readVersionFile } = require('./util')
const execa = require('execa')
const pRetry = require('p-retry')

async function getVersionFromNpm({ channel }) {
  const { stdout } = await execa('npm', ['show', `prisma@${channel}`, 'version'])

  return stdout
}

function checkForUpdate({ channel }) {
  ;(async () => {
    const currentPrismaVersion = readVersionFile({
      fileName: `prisma_${channel}`,
    })
    console.log(`current '${channel}': ${currentPrismaVersion}`)

    const npmPrismaVersion = await pRetry(() => getVersionFromNpm({ channel }), {
      retries: 3,
      onFailedAttempt: (error) => {
        console.error(error)
        console.error(`Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`)
      },
    })
    console.log(`npm '${channel}': ${npmPrismaVersion}`)

    if (npmPrismaVersion === undefined) {
      throw Error('Could not get current Prisma CLI version.')
    }
    if (currentPrismaVersion != npmPrismaVersion) {
      console.log(`New Prisma CLI version for ${channel} available.`)
      console.log(`::set-output name=${channel}_version::${npmPrismaVersion}`)
    }
  })()
}

module.exports = { checkForUpdate }

if (require.main === module) {
  // checkForUpdate({ channel: 'dev' })
  checkForUpdate({ channel: 'latest' })
  // checkForUpdate({ channel: 'patch-dev' })
}
