// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ColorSwatch } from './ColorSwatch.tsx'
import { IconButton } from './IconButton.tsx'
import { TextField } from './TextField.tsx'
import { TooltipProvider } from './Tooltip.tsx'

describe('IconButton', () => {
  it('is named by its label and reports the active tool', () => {
    render(
      <TooltipProvider>
        <IconButton label="Broom" icon={<svg />} active />
      </TooltipProvider>,
    )
    const button = screen.getByRole('button', { name: 'Broom' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('ColorSwatch', () => {
  it('selects its color when tapped', () => {
    const onSelect = vi.fn()
    render(
      <ColorSwatch
        label="Caramel"
        fill={{ type: 'solid', color: '#b98b65' }}
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Caramel' }))
    expect(onSelect).toHaveBeenCalledOnce()
  })
})

describe('TextField', () => {
  it('links the error message to the input', () => {
    render(<TextField label="Title" error="Give the notebook a title." />)
    const input = screen.getByLabelText('Title')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Give the notebook a title.')
  })
})
