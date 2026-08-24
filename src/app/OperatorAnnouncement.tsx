import { Alert } from '../design-system'
import announcementRecord from '../../config/operator-announcement.json' with { type: 'json' }
import { activeAnnouncement } from './site/operatorAnnouncement'

// The operator's service message, if there is one.
//
// The record is imported at BUILD TIME on purpose. A banner held in the
// database cannot be shown when the database is down, which is the outage most
// worth announcing; putting the message in the bundle means it survives exactly
// the failure it describes. The cost is that publishing takes a deploy, which
// the specification states rather than hides.
//
// `{message}` is a text child, so React escapes it. An operator announcement is
// the one string on this page authored outside the codebase, and it must not be
// able to introduce an element, a link or a script.

export function OperatorAnnouncement() {
  const announcement = activeAnnouncement(announcementRecord, Date.now())
  if (!announcement) return null

  return (
    <Alert variant={announcement.level}>{announcement.message}</Alert>
  )
}
