import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PayrollManager } from '@/components/payroll-manager'
import { useTeamManagement } from '@/hooks/use-team-management'

// Mock the team management hook
vi.mock('@/hooks/use-team-management')

const mockUseTeamManagement = vi.mocked(useTeamManagement)

describe('PayrollManager Integration', () => {
  beforeEach(() => {
    mockUseTeamManagement.mockReturnValue({
      members: [
        {
          id: '0x123_0',
          name: 'John Doe',
          walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
          salary: 5000,
          paymentDate: 15,
          status: 'verified',
          joinDate: new Date('2024-01-01'),
          totalPaid: 50000,
          paymentHistory: []
        },
        {
          id: '0x123_1',
          name: 'Jane Smith',
          walletAddress: '0x8ba1f109551bD432803012645Hac136c30C6213',
          salary: 6500,
          paymentDate: 15,
          status: 'active',
          joinDate: new Date('2024-02-01'),
          totalPaid: 39000,
          paymentHistory: []
        }
      ],
      upcomingPayrolls: [
        {
          id: 'upcoming_0',
          scheduledDate: new Date('2025-01-15'),
          totalAmount: 11500,
          employeeCount: 2,
          status: 'scheduled',
          processed: false,
          failed: false,
          payments: []
        }
      ],
      payrollHistory: [
        {
          id: 'history_0',
          scheduledDate: new Date('2024-12-15'),
          totalAmount: 11500,
          employeeCount: 2,
          status: 'completed',
          processed: true,
          failed: false,
          processedAt: new Date('2024-12-15T10:00:00Z'),
          payments: [
            {
              id: '0_0',
              amount: 5000,
              date: new Date('2024-12-15T10:00:00Z'),
              transactionHash: '0xabc123...',
              status: 'successful',
              gasUsed: 21000,
              processingTime: 30
            },
            {
              id: '0_1',
              amount: 6500,
              date: new Date('2024-12-15T10:01:00Z'),
              transactionHash: '0xdef456...',
              status: 'successful',
              gasUsed: 21000,
              processingTime: 35
            }
          ]
        }
      ],
      isLoading: false,
      error: null,
      addTeamMember: vi.fn().mockResolvedValue('0xhash123'),
      updateTeamMember: vi.fn().mockResolvedValue('0xhash456'),
      removeTeamMember: vi.fn().mockResolvedValue('0xhash789'),
      schedulePayroll: vi.fn().mockResolvedValue('0xhashABC'),
      loadAllData: vi.fn(),
      validateTeamMember: vi.fn(),
      isValidWalletAddress: vi.fn(),
      isValidEmail: vi.fn()
    })
  })

  it('displays team members correctly', () => {
    render(<PayrollManager />)
    
    // Check if team members are displayed
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    
    // Check salary display
    expect(screen.getByText('$5,000')).toBeInTheDocument()
    expect(screen.getByText('$6,500')).toBeInTheDocument()
    
    // Check status badges
    expect(screen.getByText('verified')).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('displays team statistics correctly', () => {
    render(<PayrollManager />)
    
    // Check team stats
    expect(screen.getByText('2')).toBeInTheDocument() // Active members count
    expect(screen.getByText('$11,500')).toBeInTheDocument() // Monthly total
    expect(screen.getByText('Active Members')).toBeInTheDocument()
    expect(screen.getByText('Monthly Total')).toBeInTheDocument()
  })

  it('shows upcoming payrolls', async () => {
    render(<PayrollManager />)
    
    // Switch to upcoming payrolls tab
    fireEvent.click(screen.getByText('Upcoming Payrolls'))
    
    await waitFor(() => {
      expect(screen.getByText('1/15/2025')).toBeInTheDocument()
      expect(screen.getByText('2 employees • $11,500')).toBeInTheDocument()
    })
  })

  it('shows payroll history', async () => {
    render(<PayrollManager />)
    
    // Switch to payroll history tab
    fireEvent.click(screen.getByText('Payroll History'))
    
    await waitFor(() => {
      expect(screen.getByText('12/15/2024')).toBeInTheDocument()
      expect(screen.getByText('completed')).toBeInTheDocument()
      expect(screen.getByText('abc123...f456')).toBeInTheDocument() // Transaction hash
    })
  })

  it('handles add member dialog', async () => {
    const mockAddTeamMember = vi.fn().mockResolvedValue('0xhash123')
    mockUseTeamManagement.mockReturnValue({
      ...mockUseTeamManagement(),
      addTeamMember: mockAddTeamMember
    })

    render(<PayrollManager />)
    
    // Open add member dialog - use more specific selector
    const addMemberButtons = screen.getAllByText('Add Member')
    fireEvent.click(addMemberButtons[0]) // Click the first "Add Member" button (dialog trigger)
    
    // Wait for dialog to open
    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeInTheDocument()
    })
    
    // Fill in the form
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Employee' } })
    fireEvent.change(screen.getByLabelText('Wallet Address'), { 
      target: { value: '0x1234567890123456789012345678901234567890' } 
    })
    fireEvent.change(screen.getByLabelText('Monthly Salary (USD)'), { target: { value: '4000' } })
    
    // Submit the form - use the submit button specifically
    const submitButton = screen.getByRole('button', { name: /add member/i })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(mockAddTeamMember).toHaveBeenCalledWith({
        name: 'New Employee',
        walletAddress: '0x1234567890123456789012345678901234567890',
        email: undefined,
        salary: 4000,
        paymentDate: 15,
        status: 'pending'
      })
    })
  })

  it('handles remove member action', async () => {
    const mockRemoveTeamMember = vi.fn().mockResolvedValue('0xhash789')
    mockUseTeamManagement.mockReturnValue({
      ...mockUseTeamManagement(),
      removeTeamMember: mockRemoveTeamMember
    })

    render(<PayrollManager />)
    
    // Find and click the remove button for the first member
    // Look for buttons with specific aria-label or data-testid
    const removeButton = screen.getByRole('button', { name: /remove/i })
    
    fireEvent.click(removeButton)
    
    await waitFor(() => {
      expect(mockRemoveTeamMember).toHaveBeenCalledWith('0x123_0')
    })
  })

  it('handles schedule payroll', async () => {
    const mockSchedulePayroll = vi.fn().mockResolvedValue('0xhashABC')
    mockUseTeamManagement.mockReturnValue({
      ...mockUseTeamManagement(),
      schedulePayroll: mockSchedulePayroll
    })

    render(<PayrollManager />)
    
    // Switch to upcoming payrolls tab
    fireEvent.click(screen.getByText('Upcoming Payrolls'))
    
    // Find the datetime input by type and schedule button
    const datetimeInput = screen.getByRole('textbox') // More specific than getByDisplayValue('')
    const scheduleButton = screen.getByText('Schedule')
    
    // Set a future date
    fireEvent.change(datetimeInput, { target: { value: '2025-02-15T10:00' } })
    fireEvent.click(scheduleButton)
    
    await waitFor(() => {
      expect(mockSchedulePayroll).toHaveBeenCalledWith(new Date('2025-02-15T10:00'))
    })
  })

  it('displays error state correctly', () => {
    mockUseTeamManagement.mockReturnValue({
      ...mockUseTeamManagement(),
      error: 'Failed to connect to contract'
    })

    render(<PayrollManager />)
    
    expect(screen.getByText('Failed to connect to contract')).toBeInTheDocument()
  })

  it('displays empty state when no members', () => {
    mockUseTeamManagement.mockReturnValue({
      ...mockUseTeamManagement(),
      members: []
    })

    render(<PayrollManager />)
    
    expect(screen.getByText('No team members added yet. Click "Add Member" to get started.')).toBeInTheDocument()
  })
})