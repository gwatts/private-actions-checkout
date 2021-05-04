const {
  error,
  getInput,
  info,
  setFailed,
  setOutput,
  setSecret
} = require('@actions/core')
const {
  sshSetup,
  cloneWithSSH,
  cleanupSSH,
  configureSSHGit
} = require('./ssh-setup')
const {
  obtainAppToken,
  cloneWithApp,
  configureAppGit
} = require('./github-app-setup')

const hasValue = (input) => {
  return input.trim().length !== 0
}

const CLONE_STRATEGY_SSH = 'ssh'
const CLONE_STRATEGY_APP = 'app'

const run = async () => {
  try {
    const sshPrivateKey = getInput('ssh_private_key')
    const actionsList = JSON.parse(getInput('actions_list'))
    const basePath = getInput('checkout_base_path')
    const appId = getInput('app_id')
    const privateKey = getInput('app_private_key')
    const returnAppToken = getInput('return_app_token') === 'true'
    const configGit = getInput('configure_git') === 'true'

    let cloneStrategy
    let appToken

    // If appId exist we will go ahead and use the GitHub App
    if (hasValue(appId) && hasValue(privateKey)) {
      cloneStrategy = CLONE_STRATEGY_APP
      info('App > Cloning using GitHub App strategy')
      appToken = await obtainAppToken(appId, privateKey)
      if (!appToken) {
        setFailed('App > App token generation failed. Workflow can not continue')
        return
      }
      if (returnAppToken) {
        info('App > Returning app-token')
        setOutput('app-token', appToken)
        setSecret(appToken)
      } else {
        info('App > Not returning app-token')
      }
    } else if (hasValue(sshPrivateKey)) {
      cloneStrategy = CLONE_STRATEGY_SSH
      info('SSH > Cloning using SSH strategy')
      info('SSH > Setting up the SSH agent with the provided private key')
      sshSetup(sshPrivateKey, configGit)
    } else {
      cloneStrategy = CLONE_STRATEGY_SSH
      info('SSH > Cloning using SSH strategy')
      info('SSH > No private key provided. Assuming valid SSH credentials are available')
    }

    // Proceed with the clones
    actionsList.forEach((action) => {
      if (cloneStrategy === CLONE_STRATEGY_APP) {
        cloneWithApp(basePath, action, appToken)
      } else if (cloneStrategy === CLONE_STRATEGY_SSH) {
        cloneWithSSH(basePath, action)
      }
    })

    if (configGit) {
      if (cloneStrategy === CLONE_STRATEGY_APP) {
        configureAppGit(appToken)
      } else {
        configureSSHGit()
      }
    } else {
      // Cleanup
      if (cloneStrategy === CLONE_STRATEGY_SSH && hasValue(sshPrivateKey)) {
        cleanupSSH()
      }
    }
  } catch (e) {
    error(e)
    setFailed(e.message)
  }
}

run()
