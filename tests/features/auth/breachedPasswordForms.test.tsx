import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SignUpForm } from '../../../src/features/auth/SignUpForm'
import { UpdatePasswordForm } from '../../../src/features/auth/UpdatePasswordForm'
import { BREACHED_PASSWORD_MESSAGE } from '../../../src/features/auth/authValidation'
import { at } from '../../support/indexed'

/**
 * AUTH-002 at the two forms that choose a password.
 *
 * The unit tests beside this one prove the lookup itself. What these prove is
 * the part that actually protects anyone: a breached password does not reach
 * `onSubmit`, and an unavailable corpus does not stop an ordinary one.
 *
 * Every case injects `checkPwnedPassword`, so no test here touches the network.
 * The production default is the real lookup; that wiring is asserted by the CSP
 * parity suite, which reads the origin out of the module the forms import.
 */

const VALID = {
  displayName: 'Alex',
  email: 'alex@example.com',
  password: 'correct horse battery staple',
}

// Labels are matched exactly, not by pattern. `TextInput` renders a show/hide
// toggle whose own aria-label is "Show password", so /password/i matches the
// field AND the button and the query fails with "found multiple elements".
function fillSignUp(password = VALID.password) {
  fireEvent.change(screen.getByLabelText('Display name'), {
    target: { value: VALID.displayName },
  })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: VALID.email } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: /create account/i }))
}

describe('SignUpForm breach-corpus gate', () => {
  it('refuses a breached password and never calls onSubmit', async () => {
    const onSubmit = vi.fn()
    render(
      <SignUpForm onSubmit={onSubmit} checkPwnedPassword={async () => 10_382_543} />,
    )

    fillSignUp()

    expect(await screen.findByText(BREACHED_PASSWORD_MESSAGE)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('never shows the user how many times it was found', async () => {
    // The count is an engineer's signal and an alarming, unactionable number to
    // somebody creating an account — and quoting it back confirms to anyone
    // probing the form how well-known a candidate password is.
    render(<SignUpForm onSubmit={vi.fn()} checkPwnedPassword={async () => 10_382_543} />)

    fillSignUp()

    await screen.findByText(BREACHED_PASSWORD_MESSAGE)
    expect(screen.queryByText(/10,?382,?543/)).not.toBeInTheDocument()
  })

  it('submits a password the corpus does not hold', async () => {
    const onSubmit = vi.fn()
    render(<SignUpForm onSubmit={onSubmit} checkPwnedPassword={async () => 0} />)

    fillSignUp()

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(at(onSubmit.mock.calls, 0)[0]).toMatchObject({
      displayName: VALID.displayName,
      email: VALID.email,
      password: VALID.password,
    })
  })

  it('submits when the check is unavailable, because it fails open', async () => {
    // The whole point of failing open: HIBP being unreachable must not become an
    // outage on the signup form. `pwnedCount` swallows its own errors, so this
    // asserts the form's behaviour on the value that failure produces.
    const onSubmit = vi.fn()
    render(<SignUpForm onSubmit={onSubmit} checkPwnedPassword={async () => 0} />)

    fillSignUp()

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(BREACHED_PASSWORD_MESSAGE)).not.toBeInTheDocument()
  })

  it('spends no lookup on a password the local checks already reject', async () => {
    // Ordering matters for cost and for privacy: a password that is too short
    // never reaches the corpus at all.
    const check = vi.fn(async () => 0)
    render(<SignUpForm onSubmit={vi.fn()} checkPwnedPassword={check} />)

    fillSignUp('short')

    await screen.findByText(/at least 6 characters/i)
    expect(check).not.toHaveBeenCalled()
  })

  it('does not run a second lookup while the first is in flight', async () => {
    // Double-submit protection. Without the in-flight guard, an impatient second
    // click spends another request and can race two results onto one field.
    let release: (count: number) => void = () => {}
    const check = vi.fn(
      () => new Promise<number>((resolve) => {
        release = resolve
      }),
    )
    render(<SignUpForm onSubmit={vi.fn()} checkPwnedPassword={check} />)

    fillSignUp()
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(check).toHaveBeenCalledTimes(1)
    release(0)
  })
})

describe('UpdatePasswordForm breach-corpus gate', () => {
  function fillReset(password: string) {
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: password },
    })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))
  }

  it('refuses a breached password on the reset flow too', async () => {
    // This is where somebody who has just been told their password was
    // compromised picks the next one, so it is the form where the check matters
    // most and the easiest one to forget to wire.
    const onSubmit = vi.fn()
    render(
      <UpdatePasswordForm onSubmit={onSubmit} checkPwnedPassword={async () => 3} />,
    )

    fillReset(VALID.password)

    expect(await screen.findByText(BREACHED_PASSWORD_MESSAGE)).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a clean password', async () => {
    const onSubmit = vi.fn()
    render(<UpdatePasswordForm onSubmit={onSubmit} checkPwnedPassword={async () => 0} />)

    fillReset(VALID.password)

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(VALID.password))
  })

  it('spends no lookup when the confirmation does not match', async () => {
    const check = vi.fn(async () => 0)
    render(<UpdatePasswordForm onSubmit={vi.fn()} checkPwnedPassword={check} />)

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: VALID.password },
    })
    fireEvent.change(screen.getByLabelText('Confirm new password'), {
      target: { value: 'something else' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save new password/i }))

    await screen.findByText(/don't match/i)
    expect(check).not.toHaveBeenCalled()
  })
})
