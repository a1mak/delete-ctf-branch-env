import * as core from '@actions/core'
import { context } from '@actions/github'
import { Context } from '@actions/github/lib/context'
import { DeleteEvent } from '@octokit/webhooks-types'
import { createClient } from 'contentful-management'
import { normalizeBranchName } from './utils/normalize-branch-name'

interface DeleteBranchContext extends Context {
  payload: DeleteEvent
}

function isDeleteBranchContext(ctx: Context): ctx is DeleteBranchContext {
  return ctx.eventName === 'delete' && ctx.payload.ref_type === 'branch'
}

async function run(ctx: Context): Promise<void> {
  try {
    const { SPACE_ID, MANAGEMENT_ACCESS_TOKEN } = process.env

    if (!SPACE_ID || !MANAGEMENT_ACCESS_TOKEN)
      throw Error(
        'Contentful connecton data required. Please provide SPACE_ID and MANAGEMENT_ACCESS_TOKEN'
      )

    if (!isDeleteBranchContext(ctx))
      throw Error(
        `Event "${ctx.eventName}" on ref_type "${ctx.payload.ref_type}" is not supported. This action can be executed only on "delete branch" event`
      )

    const payload = ctx.payload

    const envNamePrefix = core.getInput('environment_name_prefix')

    const envName = envNamePrefix + normalizeBranchName(payload.ref)

    core.info('Connecting to contentful space...')

    const client = createClient({ accessToken: MANAGEMENT_ACCESS_TOKEN })
    const space = await client.getSpace(SPACE_ID)

    core.info('Connection established.')
    core.info('Creating contentful environment...')

    try {
      const environment = await space.getEnvironment(envName)

      await environment.delete()

      core.info(`Deleted Contentful Environment ${envName}`)
      core.setOutput('environment_name', envName)
    } catch (error) {
      if (!(error instanceof Error)) throw error

      const response = JSON.parse(error.message)

      if (response.status === 404) {
        core.info(
          `No Contentful Environment with name ${envName} found. Skipping step.`
        )
      } else {
        throw Error(error.message)
      }
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run(context)
