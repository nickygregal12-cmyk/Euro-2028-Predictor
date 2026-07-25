# SEC-002 raw error inventory

## Direct internal-message use
```text
src/services/supabase/devAutoLogin.ts:66:      error.message,
src/app/providers/PredictionsProvider.tsx:741:      return { ok: false, message: e instanceof Error ? e.message : 'Submission failed.' }
src/app/providers/TournamentDataProvider.tsx:66:            message: err instanceof Error ? err.message : 'Failed to load',
src/features/more/MorePage.tsx:19:    setSignOutError(null)
src/features/more/MorePage.tsx:25:    setSignOutError(null)
src/features/more/MorePage.tsx:32:    setSignOutError(null)
src/features/more/MorePage.tsx:40:      setSignOutError('We couldn’t sign you out. Check your connection and try again.')
src/features/matches/MatchCentrePage.tsx:97:    setSaidError(null)
src/features/matches/MatchCentrePage.tsx:147:        if (active) setSaidError((err as { message?: string })?.message ?? 'Could not load predictions.')
src/features/leagues/JoinLandingPage.tsx:45:            message: e instanceof Error ? e.message : 'Could not load the invite.',
src/features/leagues/JoinLandingPage.tsx:71:        message: e instanceof Error ? e.message : 'Could not join the league.',
src/features/leagues/CreateLeagueModal.tsx:32:    setError(null)
src/features/leagues/CreateLeagueModal.tsx:44:      setError('Give your league a name.')
src/features/leagues/CreateLeagueModal.tsx:48:      setError(`Keep the name to ${NAME_MAX} characters or fewer.`)
src/features/leagues/CreateLeagueModal.tsx:52:    setError(null)
src/features/leagues/CreateLeagueModal.tsx:57:      setError(e instanceof Error ? e.message : 'Could not create the league. Try again.')
src/features/leagues/JoinLeagueModal.tsx:29:    setError(null)
src/features/leagues/JoinLeagueModal.tsx:40:      setError('Enter an invite code.')
src/features/leagues/JoinLeagueModal.tsx:44:    setError(null)
src/features/leagues/JoinLeagueModal.tsx:48:        setError("That code doesn't match a league. Check it and try again.")
src/features/leagues/JoinLeagueModal.tsx:53:      setError(e instanceof Error ? e.message : 'Could not look up that code.')
src/features/leagues/JoinLeagueModal.tsx:62:    setError(null)
src/features/leagues/JoinLeagueModal.tsx:70:      setError(e instanceof Error ? e.message : 'Could not join the league.')
src/features/leagues/JoinLeagueModal.tsx:99:            setError(null)
src/features/leagues/share.ts:59:    if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
src/features/leagues/TransferOwnershipModal.tsx:34:    setError(null)
src/features/leagues/TransferOwnershipModal.tsx:41:    setError(null)
src/features/leagues/TransferOwnershipModal.tsx:48:      setError(e instanceof Error ? e.message : 'Could not transfer ownership.')
src/features/leagues/LeagueDetailPage.tsx:74:            message: e instanceof Error ? e.message : 'Failed to load the league.',
src/features/leagues/LeagueDetailPage.tsx:136:    setActionError(null)
src/features/leagues/LeagueDetailPage.tsx:142:      setActionError(e instanceof Error ? e.message : 'Could not leave the league.')
src/features/leagues/LeagueDetailPage.tsx:150:    setActionError(null)
src/features/leagues/LeagueDetailPage.tsx:156:      setActionError(e instanceof Error ? e.message : 'Could not delete the league.')
src/features/auth/ResetRequestPage.tsx:23:    setError(null)
src/features/auth/ResetRequestPage.tsx:28:      setError(friendlyAuthError(err, 'reset'))
src/features/auth/ResetRequestForm.tsx:49:    setFieldError(err)
src/features/auth/LoginPage.tsx:20:    setError(null)
src/features/auth/LoginPage.tsx:26:      setError(friendlyAuthError(err, 'login'))
src/features/auth/UpdatePasswordPage.tsx:40:    setError(null)
src/features/auth/UpdatePasswordPage.tsx:45:      setError(friendlyAuthError(err, 'update'))
src/features/auth/SignUpPage.tsx:28:    setError(null)
src/features/auth/SignUpPage.tsx:40:      setError(friendlyAuthError(err, 'signup'))
src/features/home/useHomeData.ts:266:            message: e instanceof Error ? e.message : 'Failed to load your dashboard.',
src/features/share/shareImage.ts:29:      if (e instanceof Error && e.name === 'AbortError') return 'cancelled'
src/features/profile/ProfilePage.tsx:108:            message: e instanceof Error ? e.message : 'Failed to load your profile.',
src/features/h2h/H2HPage.tsx:144:            message: e instanceof Error ? e.message : 'Head-to-head is unavailable.',
src/features/predict/ReviewPage.tsx:202:    setSubmitError(null)
src/features/predict/ReviewPage.tsx:205:    if (!result.ok) setSubmitError(result.message ?? 'Submission failed. Please try again.')
src/features/league/OverallStandingsPage.tsx:40:            message: e instanceof Error ? e.message : 'Failed to load standings.',
src/features/league/LeaguePage.tsx:63:            message: e instanceof Error ? e.message : 'Failed to load standings.',
```

## User-visible rendering candidates
```text
src/app/providers/saveController.ts:68:      if (state.status === 'error') errorKeys.push(key)
src/design-system/TieResolver.tsx:146:            <span className={styles.saveError}>Save failed — try again</span>
src/design-system/TextInput.tsx:59:        <p id={describedById} className={styles.error} role="alert">
src/features/more/MorePage.tsx:96:        {signOutError ? <p role="alert">{signOutError}</p> : null}
src/features/matches/MatchCentrePage.tsx:158:  if (data.status === 'error') {
src/features/matches/MatchesPage.tsx:108:  if (data.status === 'error') {
src/features/leagues/JoinLandingPage.tsx:93:        {state.status === 'error' && (
src/features/leagues/LeagueDetailPage.tsx:114:  if (state.status === 'error') {
src/features/auth/ResetRequestPage.tsx:6:import { friendlyAuthError } from './authErrors'
src/features/auth/LoginPage.tsx:6:import { friendlyAuthError } from './authErrors'
src/features/auth/UpdatePasswordPage.tsx:9:import { friendlyAuthError } from './authErrors'
src/features/auth/SignUpPage.tsx:7:import { friendlyAuthError } from './authErrors'
src/features/home/HomePage.tsx:54:  if (state.status === 'error') {
src/features/home/useHomeData.ts:91:    if (data.status === 'error') {
src/features/profile/ProfilePage.tsx:51:    if (data.status === 'error') {
src/features/profile/ProfilePage.tsx:126:  if (state.status === 'error') {
src/features/h2h/H2HPage.tsx:91:    if (data.status === 'error') {
src/features/h2h/H2HPage.tsx:161:  if (state.status === 'error') {
src/features/bracket/BracketRound.tsx:68:  if (data.status === 'error') {
src/features/bracket/BracketRound.tsx:225:      {status === 'error' && (
src/features/predict/ThirdPlacePage.tsx:26:  if (data.status === 'error') {
src/features/predict/PredictHubPage.tsx:65:  if (data.status === 'error') {
src/features/predict/ReviewPage.tsx:57:  const [submitError, setSubmitError] = useState<string | null>(null)
src/features/predict/ReviewPage.tsx:80:  if (data.status === 'error') {
src/features/predict/ReviewPage.tsx:314:      {submitError && (
src/features/predict/ReviewPage.tsx:316:          {submitError}
src/features/predict/GroupPredictorPage.tsx:44:  if (data.status === 'error') {
src/features/predict/JokersPage.tsx:26:  if (data.status === 'error') {
src/features/league/OverallStandingsPage.tsx:63:  if (data.status === 'error') {
src/features/league/OverallStandingsPage.tsx:85:  if (state.status === 'error') {
src/features/league/LeaguePage.tsx:86:  if (data.status === 'error') {
src/features/league/LeaguePage.tsx:111:  if (state.status === 'error') {
tests/features/auth/authErrors.test.ts:2:import { friendlyAuthError } from '../../../src/features/auth/authErrors'
```
