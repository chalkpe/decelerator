import { log } from '@temporalio/activity'
import { createRestAPIClient } from 'masto'

export interface IdentifyParams {
  domain: string
  accessToken: string
}

export async function identifyActivity(params: IdentifyParams) {
  const { domain, accessToken } = params
  log.info('Identifying account', { domain })

  const masto = createRestAPIClient({ url: `https://${domain}`, accessToken })
  return { user: await masto.v1.accounts.verifyCredentials() }
}
