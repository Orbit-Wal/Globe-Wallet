# Globe Wallet

A comprehensive Stellar blockchain wallet application built with Next.js, providing seamless cryptocurrency management and financial operations.

## Features

### 🪙 Stellar (XLM) Operations
- **Receive XLM**: Generate wallet addresses with QR codes for easy receiving
- **Send XLM**: Transfer Stellar Lumens to other wallet addresses
- **Balance Management**: Real-time XLM balance tracking and transaction history

### 💱 Currency Conversion
- **XLM to USDC**: Convert Stellar Lumens to USD Coin
- **XLM to USDT**: Convert Stellar Lumens to Tether
- **Real-time Rates**: Live exchange rates and conversion calculations

### 🏦 Off-ramp Services
- **Crypto to Bank**: Convert cryptocurrency holdings to fiat currency
- **Bank Integration**: Direct transfers to connected bank accounts
- **Withdrawal Options**: Multiple withdrawal methods and processing

### 📱 User Experience
- **Dashboard**: Comprehensive overview of portfolio and recent transactions
- **Profile Management**: User settings and account configuration
- **Savings Features**: Track and manage savings goals
- **Transaction History**: Detailed records of all wallet activities

### 🔧 Technical Features
- **QR Code Generation**: For easy address sharing and payments
- **Responsive Design**: Optimized for desktop and mobile devices
- **Dark/Light Theme**: Customizable user interface themes
- **Real-time Updates**: Live balance and transaction updates

## Built with v0

This repository is linked to a [v0](https://v0.app) project for rapid development and deployment.

## Documentation

- [Architecture Overview](docs/architecture.md) - Deep dive into the service-oriented architecture.
- [Chart Recharts Strict Typing (Issue #17)](docs/issue-17.md) - Strict Recharts TypeScript types for chart components, API contracts, and test instructions.
- [Enterprise Upgrade (Issue #27)](docs/issue-27.md) - Details on the v1.2.0 upgrade, including API contracts and design rationale.
- [Send Form: Contact Selection & Confirmation (Issue #23)](docs/issue-23.md) - Two-step send flow, contact picker, API contracts, and test instructions.
- [Developer Onboarding (Issue #29)](docs/issue-29.md) - Repo structure, conventions, testing strategy, and contributor guide.
- [Accessibility Audit (Issue #24)](docs/issue-24.md) - Automated axe/pa11y checks for main pages, API contracts, and CI integration.
- [E2E Testing: Core Wallet Flows (Issue #25)](docs/issue-25.md) - Playwright E2E journeys for receive, convert, off-ramp, savings, cards, and profile.
- [Environment Setup & Stellar Network Configuration (Issue #28)](docs/issue-28.md) - Environment variables, testnet vs mainnet setup, and key security rules.
- [Crypto-Native Send Flow: Federated Address Lookup (Issue #11)](docs/issue-11.md) - Stellar federation protocol support (SEP-0002), `AddressLookupBadge` component, `/api/federation` route, and full test coverage.
- [Mock Centralization (Issue #14)](docs/issue-14.md) - Centralized fixtures/data service, API contracts, test strategy, and rollout notes.
- [Convert Page: Conversion Math & Rate Lookup Tests (Issue #20)](docs/issue-20.md) - Unit/component/integration/E2E tests for the convert page, pure math helpers, and API contracts.
- [Real Stellar Submission for Send Payments (Issue #63)](docs/issue-63.md) - Root cause, design decision (embedded Horizon SDK vs backend API call), signing-key configuration, and real-testnet verification for `/api/wallet/send`.

[Continue working on v0 →](https://v0.app/chat/projects/prj_Z6moUc7brx5QzV1vPHQC842r9sYK)

## Architecture

### Frontend Stack
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Shadcn/UI**: Component library
- **React Hooks**: State management and effects

### Blockchain Integration
- **Stellar SDK**: Stellar blockchain interactions
- **Wallet Connection**: Secure wallet management
- **Transaction Processing**: XLM and token operations
- **Smart Contract Integration**: Automated financial operations

### Backend Services *(Planned)*
- **API Routes**: Next.js API for wallet operations
- **Database**: Transaction and user data storage
- **Authentication**: Secure user management
- **Payment Processing**: Off-ramp service integration
- **Rate Provider**: Real-time exchange rate feeds

### Security Features
- **Private Key Management**: Secure key storage and handling
- **Transaction Signing**: Cryptographic transaction verification
- **Address Validation**: Stellar address format verification
- **Rate Limiting**: API protection and abuse prevention

## Development Status

### ✅ Completed Features
- **Enterprise Service Layer**: Robust, interface-driven services for Wallet, Pricing, Exchange, and Off-Ramp.
- **Advanced Hook System**: Specialized hooks for state management and service interaction.
- **Comprehensive Testing**: Unit, Component, Integration, and E2E test suites with >90% business logic coverage.
- **CI/CD Integration**: Automated quality gates and merge analytics.
- **Architecture Sync**: Alignment between documentation and implementation.

### 📋 Planned Features
- Multi-currency support beyond XLM/USDC/USDT
- Advanced portfolio analytics
- Automated savings features
- Social payment features
- Mobile app version

## Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm
- Stellar account for testing

### Installation

```bash
# Clone the repository
git clone https://github.com/Orbit-Wal/Globe-Wallet.git
cd Globe-Wallet

# Install dependencies
pnpm install

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Environment Setup
Copy `.env.example` to `.env.local`, then update values for your environment:
```
cp .env.example .env.local
```

The app validates its environment during startup and prints actionable errors for missing or malformed values. Run `npm run check:env` after changing the schema or `.env.example`.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Testing

### Testing strategy

Globe Wallet targets **>90% coverage** on business logic in `lib/`, `hooks/`, and `components/` (see `jest.config.js`). Full details, API contracts, and the QA checklist live in [docs/issue-30.md](docs/issue-30.md).

| Command | Purpose |
|---------|---------|
| `npm test` | Full Jest suite (unit, component, integration, property) |
| `npm run test:unit` | Service and utility unit tests |
| `npm run test:component` | React Testing Library component tests |
| `npm run test:integration` | API routes and service integration |
| `npm run test:a11y` | jest-axe component accessibility scans (Issue #24) |
| `npm run test:a11y:e2e` | Playwright + axe E2E accessibility scans (Issue #24) |
| `npm run test:coverage` | Coverage report with 90% global threshold |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run lint` | ESLint |
| `npm run build` | Production build verification |

**E2E highlights**

- Send flow (issue #23): `npm run test:e2e -- --grep "Send Flow"`
- Receive flow (issue #22): `npm run test:e2e -- --grep "Receive Flow"`
- Dashboard integration (issue #30): `npm run test:e2e -- --grep "Issue #30"`
- Accessibility audit (issue #24): `npm run test:a11y:e2e`

CI runs lint, build, all Jest layers, Playwright, and coverage on every push/PR to `main`. Successful merges to `main` POST merge analytics to `MERGE_ANALYTICS_URL` (repository secret).

### Browser Testing
All wallet flows are verified in supported browsers:
- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Test Scenarios
- Wallet creation and import
- XLM sending and receiving
- Currency conversion flows
- Off-ramp processes
- UI responsiveness across devices

## Resources

- [Stellar Documentation](https://developers.stellar.org/) - Stellar blockchain development
- [Next.js Documentation](https://nextjs.org/docs) - Next.js features and API
- [Tailwind CSS](https://tailwindcss.com/docs) - Styling framework
- [Shadcn/UI](https://ui.shadcn.com/) - Component library

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
