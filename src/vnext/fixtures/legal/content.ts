import { NON_AFFILIATION_SHORT } from '../../models/about'
import type { PublicDocumentModel } from '../../models/publicDocument'

const PRODUCT = 'Predictor Hub'

/**
 * Current-service privacy notice.
 *
 * Modest by design: this states what the product and its optional integrations
 * actually do, and refuses to invent a blanket retention promise, a self-service
 * deletion flow, a legal-review claim or an integration that may be disabled.
 */
export function privacyModel(options: {
  readonly supportEmail: string | null
} = { supportEmail: null }): PublicDocumentModel {
  const links = [
    { label: 'Terms', href: '/terms' },
    { label: 'About & Disclaimer', href: '/about' },
    ...(options.supportEmail
      ? [{ label: 'Privacy and data enquiries', href: `mailto:${options.supportEmail}` }]
      : []),
  ]

  return {
    title: 'Privacy',
    context: 'Privacy',
    summary:
      'This notice explains the information Predictor Hub uses to run your account and football prediction games, and the optional services that may process information when they are enabled.',
    sections: [
      {
        id: 'account-data',
        heading: 'Account and player data',
        paragraphs: [
          'We use account information needed to sign you in and recover your account, together with your chosen public display name and platform profile.',
          'When you play, the service stores the competitions and games you join, private-league membership, predictions and game picks, player preferences, scores, standings and the history needed to show your football record and operate the competition rules.',
          'Your email address and authentication credentials are not presented as your public player identity. Your chosen display name can appear to other players where the game, standings, league or profile rules allow it.',
        ],
      },
      {
        id: 'device-data',
        heading: 'Browser and device data',
        paragraphs: [
          'The app uses browser storage for things such as the signed-in session, theme and device preferences, safe journey hand-offs, local prediction drafts where supported, and the installed-app/offline cache.',
          'If product analytics is deliberately configured, its client may use browser storage or cookies for the allowed analytics events. Broad autocapture and session replay are not part of the current analytics implementation.',
        ],
      },
      {
        id: 'services',
        heading: 'Services that may process data',
        paragraphs: [
          'Supabase provides authentication and the application database, and Netlify hosts the web application. Cloudflare Turnstile is used on protected authentication journeys where CAPTCHA is configured.',
          'Sentry may receive privacy-restricted technical error information when error reporting is enabled. PostHog may receive the deliberately allowed product events when analytics is configured. These integrations are optional configuration: this notice does not claim they are active in every environment.',
          'The application also uses football-data providers for fixtures, results and related football information. Provider information is enrichment or football input; it does not become a second authority for your account, scoring or settlement merely because it came from a provider.',
          'Notification scheduling can store reminder and delivery state. An external notification sender, including any configured notification provider or web-push channel, processes delivery information only when that channel has actually been enabled and configured.',
        ],
      },
      {
        id: 'purpose',
        heading: 'Why the information is used',
        paragraphs: [
          'We use the information above to authenticate players, operate the prediction games and private competitions, enforce deadlines and permissions, calculate and explain results, remember player choices, prevent abuse, recover from failures and support the service.',
          'Operational security and reliability records may be used to investigate errors, suspicious activity, failed operations and service incidents. They are not a second public player profile.',
        ],
      },
      {
        id: 'retention',
        heading: 'Retention and deletion',
        paragraphs: [
          'There is no single blanket retention period that truthfully describes every current record. Competition and player-history records may be retained so the service can preserve results, history and operational evidence; technical and third-party records follow the purpose and configuration of the system that created them.',
          'The current product does not promise a self-service account-erasure or pseudonymisation workflow. If you want to ask about information held about you, use the contact route shown on this page when one is configured. We may need to verify that a request relates to your account before acting on it.',
        ],
      },
      {
        id: 'choices',
        heading: 'Your choices',
        paragraphs: [
          'You choose your public display name, competitions, games and optional player preferences. Notification and device preferences can be changed where the relevant feature is available.',
          'Analytics remains a deployment decision rather than a condition of playing the games. A disabled optional integration is not treated as if it collected data anyway.',
        ],
      },
      {
        id: 'review',
        heading: 'About this notice',
        paragraphs: [
          'This page describes the service as it is currently implemented. It does not claim that an external or qualified UK data-protection review has taken place, and it does not replace any rights or obligations that apply under law.',
        ],
      },
    ],
    links,
  }
}

/** Terms for the current free football-prediction service, not future products. */
export function termsModel(options: {
  readonly supportEmail: string | null
} = { supportEmail: null }): PublicDocumentModel {
  const links = [
    { label: 'Privacy', href: '/privacy' },
    { label: 'About & Disclaimer', href: '/about' },
    ...(options.supportEmail
      ? [{ label: 'Support and enquiries', href: `mailto:${options.supportEmail}` }]
      : []),
  ]

  return {
    title: 'Terms',
    context: 'Terms',
    summary:
      'Predictor Hub is a football prediction game for points, standings and competition with other players. These terms describe the current service and the rules around using it.',
    sections: [
      {
        id: 'service',
        heading: 'The service',
        paragraphs: [
          `${PRODUCT} lets you predict football results and take part in games including Match Predictor, Last Man Standing and the Predictor Championship, including private competitions where available.`,
          'The current game is played for points and position. There is no wager, stake or cash prize for taking part.',
        ],
      },
      {
        id: 'account',
        heading: 'Your account and public name',
        paragraphs: [
          'Keep access to your account secure and use the account as yourself. Your chosen display name is the public player identity used by the platform; do not use a name to impersonate another person or to abuse other players.',
          'Joining one competition, game or private container does not silently join you to another. The server-held membership and permission records decide what your account may enter and see.',
        ],
      },
      {
        id: 'game-rules',
        heading: 'Deadlines, scoring and results',
        paragraphs: [
          'The server is the authority for deadlines, locks, accepted predictions, game eligibility, scoring, progression and settlement. A device clock or a screen that has not refreshed cannot override the server answer.',
          'Football results and competition data can be corrected. When the service corrects a result, affected game results and standings may be recalculated under the same governing rules.',
        ],
      },
      {
        id: 'football-data',
        heading: 'Football data',
        paragraphs: [
          'Fixtures, results and related information can come from third-party football-data services and can be late, incomplete or corrected. Predictor Hub is not an official record of a football match or competition.',
          'Useful provider enrichment may help you understand a match, but it does not replace the platform authorities for scoring, locks, reveal or settlement.',
        ],
      },
      {
        id: 'fair-use',
        heading: 'Fair use and security',
        paragraphs: [
          'Do not attempt to bypass authentication, permissions, prediction locks, rate or capacity controls, private-league boundaries, invite protections or other security measures. Do not use the service in a way intended to disrupt it or other players.',
          'Reasonable technical limits may be applied to protect the service and other players. A refusal or temporary limit is not a successful gameplay write, and the application should say so.',
        ],
      },
      {
        id: 'availability',
        heading: 'Availability and changes',
        paragraphs: [
          'The service can be unavailable or partially unavailable, and football/provider information can arrive later than expected. We may change or retire features as the product develops, while already-settled competitive records remain governed by the authorities that produced them.',
        ],
      },
      {
        id: 'independence',
        heading: 'Unofficial and independent',
        paragraphs: [
          NON_AFFILIATION_SHORT,
          'Competition names, club names, trademarks, logos and other third-party intellectual property remain the property of their respective owners. Their use does not imply association with or endorsement of Predictor Hub.',
        ],
      },
    ],
    links,
  }
}
