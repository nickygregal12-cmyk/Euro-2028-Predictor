import { db } from './client'
import {
  mapPrivateCompetitionDiscoveryPage,
  mapPrivateCupLaunchReadiness,
  type PrivateCompetitionDiscoveryPage,
  type PrivateCupLaunchReadiness,
} from './privateCompetitionDiscoveryModel'

/**
 * Contract 179's caller-addressed private-container reads.
 *
 * Private Last Man Standing and Predictor Championship competitions are
 * `bonus_competitions`, not ordinary `leagues`. These wrappers keep that
 * distinction explicit so `/leagues` can rediscover a successful create/join
 * after a hard reload without routing the two storage models through one RPC.
 */

export type {
  PrivateCompetitionDiscovery,
  PrivateCompetitionDiscoveryPage,
  PrivateCompetitionGameKey,
  PrivateCupLaunchReadiness,
} from './privateCompetitionDiscoveryModel'

/**
 * The caller's private LMS/Championship containers, newest first.
 *
 * The server clamps a page to 50. The global surface deliberately asks for one
 * maximum page and must state `hasMore` rather than silently pretending that a
 * truncated page is complete.
 */
export async function fetchMyPrivateCompetitions(
  limit = 50,
  offset = 0,
): Promise<PrivateCompetitionDiscoveryPage> {
  const { data, error } = await db.rpc('get_my_private_competitions', {
    p_limit: limit,
    p_offset: offset,
  })
  if (error) throw error
  return mapPrivateCompetitionDiscoveryPage(data)
}

/**
 * Read the Championship launch verdict from the private-container workspace.
 *
 * The browser never recomputes eligibility. Contract 179 derives this from the
 * same authorities the launch command uses and additionally removes `canLaunch`
 * from non-organisers.
 */
export async function fetchPrivateCupLaunchReadiness(
  competitionId: string,
): Promise<PrivateCupLaunchReadiness | null> {
  const { data, error } = await db.rpc('get_private_competition_workspace', {
    p_competition_id: competitionId,
  })
  if (error) throw error
  return mapPrivateCupLaunchReadiness(data)
}
