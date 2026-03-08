# TUI vs Frontend — Clarification

## Are they different?

Yes. They serve different audiences and workflows:

| Aspect | TUI (CLI `sss-token tui`) | Frontend (Next.js) |
|--------|---------------------------|--------------------|
| **Audience** | Operators/admins in the terminal | Users who prefer a browser UI |
| **Auth** | CLI keypair (`~/.config/solana/id.json`) | Wallet adapter (Phantom, Solflare, etc.) |
| **Deployment** | Local binary; no server | Web app (optional Docker) |
| **Use case** | DevOps, SSH sessions, scripts | Demos, non-CLI users, shared dashboards |
| **Bounty** | Part of "CLI & Admin Tools" | Not required (bounty: Blockchain + Backend) |

## Why both exist

- **TUI:** Interactive Admin TUI for real-time monitoring **and operations**. Uses the local keypair as signer. Best for operators who work in the terminal.
- **Frontend:** Demonstrates SDK + API usage; wallet-based flows for Create; backend API for Operations, Roles, Blacklist. Best for demos and non-terminal users.

## Bounty alignment

- **TUI with Operations/Compliance:** Aligns with "interactive Admin TUI for monitoring and operations."
- **Frontend:** Optional; illustrates how to use the SDK and backend. The bounty listing does not require a web UI.

## Example vs core

The frontend lives under `example/frontend/` to signal it is illustrative, not core bounty deliverable. The TUI remains the primary admin interface for operators.

### Running the example frontend

```bash
cd example/frontend && npm install && npm run dev
```
