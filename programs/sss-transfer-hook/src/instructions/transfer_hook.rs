use anchor_lang::prelude::*;

use crate::error::TransferHookError;

/// Transfer hook validation. Token-2022 calls this on every transfer for
/// mints configured with this hook. Account ordering is fixed by the SPL spec.
#[derive(Accounts)]
pub struct TransferHook<'info> {
    /// CHECK: Source token account -- validated by Token-2022.
    pub source: UncheckedAccount<'info>,
    /// CHECK: Token mint -- validated by Token-2022.
    pub mint: UncheckedAccount<'info>,
    /// CHECK: Destination token account -- validated by Token-2022.
    pub destination: UncheckedAccount<'info>,
    /// CHECK: Source authority (owner/delegate) -- validated by Token-2022.
    pub authority: UncheckedAccount<'info>,
    /// CHECK: ExtraAccountMetaList PDA -- resolved by Token-2022.
    pub extra_account_metas: UncheckedAccount<'info>,
    /// CHECK: Sender blacklist PDA -- resolved from ExtraAccountMetaList.
    pub sender_blacklist: UncheckedAccount<'info>,
    /// CHECK: Receiver blacklist PDA -- resolved from ExtraAccountMetaList.
    pub receiver_blacklist: UncheckedAccount<'info>,
}

pub fn handler_transfer_hook(ctx: Context<TransferHook>, _amount: u64) -> Result<()> {
    let sender_bl = &ctx.accounts.sender_blacklist;
    let receiver_bl = &ctx.accounts.receiver_blacklist;

    if !sender_bl.data_is_empty() && sender_bl.owner == ctx.program_id {
        return Err(TransferHookError::SenderBlacklisted.into());
    }

    if !receiver_bl.data_is_empty() && receiver_bl.owner == ctx.program_id {
        return Err(TransferHookError::ReceiverBlacklisted.into());
    }

    Ok(())
}
