import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import Login from '@/pages/Login'
import * as dataService from '@/services/dataService'
import { DEALER_USER, makeStore, MANUFACTURER_USER, renderWithApp } from '@/test/utils'

vi.mock('@/services/dataService')

const extraRoutes = [
  { path: '/', element: <div>Dealer home</div> },
  { path: '/order-approvals', element: <div>Order approvals</div> },
]
const renderLogin = (store = makeStore()) => renderWithApp(<Login />, { store, route: '/login', path: '/login', extraRoutes })

const emailField = () => screen.getByLabelText(/email/i)
const passwordField = () => screen.getByLabelText(/password/i, { selector: 'input' })
const signInButton = () => screen.getByRole('button', { name: /sign in/i })

describe('Login', () => {
  test('Sign in is disabled until email and password are entered', async () => {
    const user = userEvent.setup()
    renderLogin()
    expect(signInButton()).toBeDisabled()
    await user.type(emailField(), 'principal@demo.com')
    expect(signInButton()).toBeDisabled()
    await user.type(passwordField(), 'secret')
    expect(signInButton()).toBeEnabled()
  })

  test('wrong password shows the error and stays on the page', async () => {
    dataService.login.mockRejectedValue(new Error('Invalid email or password.'))
    const user = userEvent.setup()
    renderLogin()
    await user.type(emailField(), 'principal@demo.com')
    await user.type(passwordField(), 'wrong')
    await user.click(signInButton())
    expect(await screen.findByText('Invalid email or password.')).toBeInTheDocument()
    expect(dataService.login).toHaveBeenCalledWith('principal@demo.com', 'wrong')
  })

  test('typing again clears the error', async () => {
    dataService.login.mockRejectedValue(new Error('Invalid email or password.'))
    const user = userEvent.setup()
    renderLogin()
    await user.type(emailField(), 'principal@demo.com')
    await user.type(passwordField(), 'wrong')
    await user.click(signInButton())
    await screen.findByText('Invalid email or password.')
    await user.type(passwordField(), 'x')
    expect(screen.queryByText('Invalid email or password.')).not.toBeInTheDocument()
  })

  test('dealer sign-in lands on Home', async () => {
    dataService.login.mockResolvedValue(DEALER_USER)
    const user = userEvent.setup()
    renderLogin()
    await user.type(emailField(), 'principal@demo.com')
    await user.type(passwordField(), 'pw')
    await user.click(signInButton())
    expect(await screen.findByText('Dealer home')).toBeInTheDocument()
  })

  test('manufacturer sign-in lands on Order Approvals', async () => {
    dataService.login.mockResolvedValue(MANUFACTURER_USER)
    const user = userEvent.setup()
    renderLogin()
    await user.type(emailField(), 'manufacturer@demo.com')
    await user.type(passwordField(), 'pw')
    await user.click(signInButton())
    expect(await screen.findByText('Order approvals')).toBeInTheDocument()
  })

  test('demo account buttons fill the form', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.click(screen.getByRole('button', { name: 'Dealer' }))
    expect(emailField()).toHaveValue('principal@demo.com')
    expect(passwordField()).not.toHaveValue('')
    await waitFor(() => expect(signInButton()).toBeEnabled())
  })

  test('already signed in: skips the form', () => {
    renderLogin(makeStore({ user: DEALER_USER }))
    expect(screen.getByText('Dealer home')).toBeInTheDocument()
  })
})
