/**
 * Component accessibility tests — Dynamic Color Contrast & axe Compliance (Issue #87)
 *
 * Verifies runtime rendering, dynamic color token classes, and axe compliance for:
 * - TransactionStatusBadge (completed, pending, failed)
 * - AddressLookupBadge (resolved, not-found, error)
 * - Badge (destructive, default, secondary, outline)
 * - TestCoverageCard (pass, fail, pending)
 * - TeamCollaboration
 */

import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { axe } from 'jest-axe'
import { TransactionStatusBadge } from '@/components/ui/transaction-status-badge'
import { AddressLookupBadge } from '@/components/ui/address-lookup-badge'
import { Badge } from '@/components/ui/badge'
import { TestCoverageCard } from '@/components/dashboard/TestCoverageCard'
import { TeamCollaboration } from '@/components/dashboard/team-collaboration'

describe('Dynamic Color Components Accessibility (Issue #87)', () => {
  describe('TransactionStatusBadge', () => {
    it('renders completed status badge with compliant emerald tokens', () => {
      render(<TransactionStatusBadge status="completed" />)
      const badge = screen.getByTestId('transaction-status-badge')
      expect(badge).toHaveClass('bg-emerald-100', 'text-emerald-800')
      expect(badge).toHaveTextContent('Completed')
    })

    it('renders pending status badge with compliant amber tokens', () => {
      render(<TransactionStatusBadge status="pending" />)
      const badge = screen.getByTestId('transaction-status-badge')
      expect(badge).toHaveClass('bg-amber-100', 'text-amber-800')
      expect(badge).toHaveTextContent('Pending')
    })

    it('renders failed status badge with compliant red tokens', () => {
      render(<TransactionStatusBadge status="failed" />)
      const badge = screen.getByTestId('transaction-status-badge')
      expect(badge).toHaveClass('bg-red-100', 'text-red-700')
      expect(badge).toHaveTextContent('Failed')
    })

    it('passes axe accessibility audit across all status states', async () => {
      const { container } = render(
        <div>
          <TransactionStatusBadge status="completed" />
          <TransactionStatusBadge status="pending" />
          <TransactionStatusBadge status="failed" />
        </div>,
      )
      expect(await axe(container)).toHaveNoViolations()
    })
  })

  describe('AddressLookupBadge', () => {
    it('renders resolved status chip with compliant green-700 token', () => {
      render(
        <AddressLookupBadge
          result={{
            status: 'resolved',
            resolved: 'GABC1234567890XYZ',
          }}
        />,
      )
      const chip = screen.getByTestId('lookup-resolved')
      expect(chip).toBeInTheDocument()
      expect(chip.querySelector('span')).toHaveClass('text-green-700')
    })

    it('renders not-found warning chip with compliant amber-800 token', () => {
      render(
        <AddressLookupBadge
          result={{
            status: 'not-found',
          }}
        />,
      )
      const chip = screen.getByTestId('lookup-not-found')
      expect(chip).toHaveClass('text-amber-800')
    })

    it('renders error chip with compliant red-700 token', () => {
      render(
        <AddressLookupBadge
          result={{
            status: 'error',
            error: 'Network timeout',
          }}
        />,
      )
      const chip = screen.getByTestId('lookup-error')
      expect(chip).toHaveClass('text-red-700')
    })

    it('passes axe accessibility audit for resolved state', async () => {
      const { container } = render(
        <AddressLookupBadge
          result={{
            status: 'resolved',
            resolved: 'GABC1234567890XYZ',
          }}
        />,
      )
      expect(await axe(container)).toHaveNoViolations()
    })
  })

  describe('Badge', () => {
    it('renders destructive badge with red-700 background and white text', () => {
      render(<Badge variant="destructive">Critical Error</Badge>)
      const badge = screen.getByText('Critical Error')
      expect(badge).toHaveClass('bg-red-700', 'text-white')
    })

    it('passes axe audit for all badge variants', async () => {
      const { container } = render(
        <div>
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>,
      )
      expect(await axe(container)).toHaveNoViolations()
    })
  })

  describe('TestCoverageCard', () => {
    it('renders passing coverage status with emerald tokens', () => {
      render(<TestCoverageCard title="Unit Tests" coverage={95} threshold={80} status="pass" />)
      const statusBadge = screen.getByTestId('coverage-status-unit-tests')
      expect(statusBadge).toHaveClass('bg-emerald-100', 'text-emerald-800')
    })

    it('renders failing coverage status with red tokens and alert role', () => {
      render(<TestCoverageCard title="E2E Tests" coverage={50} threshold={80} status="fail" />)
      const statusBadge = screen.getByTestId('coverage-status-e2e-tests')
      expect(statusBadge).toHaveClass('bg-red-100', 'text-red-700')
      expect(screen.getByRole('alert')).toHaveTextContent('Coverage below the 80% threshold')
    })

    it('passes axe audit for passing and failing coverage cards', async () => {
      const { container } = render(
        <div>
          <TestCoverageCard title="Unit Tests" coverage={95} threshold={80} status="pass" />
          <TestCoverageCard title="E2E Tests" coverage={50} threshold={80} status="fail" />
        </div>,
      )
      expect(await axe(container)).toHaveNoViolations()
    })
  })

  describe('TeamCollaboration', () => {
    it('renders team member status badges cleanly without axe violations', async () => {
      const { container } = render(<TeamCollaboration />)
      expect(await axe(container)).toHaveNoViolations()
    })
  })
})
