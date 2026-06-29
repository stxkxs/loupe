import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ToastProvider } from '@/components/toast/ToastProvider'
import { CopyValue } from '@/components/ui'
import { Spotlight } from '@/components/Spotlight'

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove('dark')
  localStorage.clear()
  vi.restoreAllMocks()
})

// Mock the async Clipboard API (absent in jsdom) so copy paths are exercisable.
function mockClipboard(impl: () => Promise<void>) {
  const writeText = vi.fn(impl)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  return writeText
}

describe('ThemeToggle', () => {
  it('toggles the .dark class on <html> and persists the choice', () => {
    render(<ThemeToggle />)
    const btn = screen.getByRole('button', { name: /switch to dark theme/i })
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    fireEvent.click(btn)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('loupe-theme')).toBe('dark')

    fireEvent.click(screen.getByRole('button', { name: /switch to light theme/i }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('loupe-theme')).toBe('light')
  })
})

describe('CopyValue', () => {
  it('writes to the clipboard and toasts on success', async () => {
    const writeText = mockClipboard(() => Promise.resolve())
    render(
      <ToastProvider>
        <CopyValue value="RX12345" label="RxCUI" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(writeText).toHaveBeenCalledWith('RX12345')
    expect(await screen.findByText(/Copied RxCUI/i)).toBeTruthy()
  })

  it('toasts a failure (not throws) when the clipboard rejects', async () => {
    mockClipboard(() => Promise.reject(new Error('denied')))
    render(
      <ToastProvider>
        <CopyValue value="RX12345" label="RxCUI" />
      </ToastProvider>,
    )
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByText(/Copy failed/i)).toBeTruthy()
  })
})

describe('Spotlight', () => {
  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn()
    render(
      <ToastProvider>
        <Spotlight open onClose={onClose} title="Cost reality">
          <div>panel body</div>
        </Spotlight>
      </ToastProvider>,
    )
    expect(screen.getByText('panel body')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})
