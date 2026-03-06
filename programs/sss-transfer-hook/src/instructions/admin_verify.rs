use anchor_lang::prelude::*;

use crate::constants::{SSS_CONFIG_SEED, SSS_CORE_PROGRAM_ID, SSS_ROLE_SEED};
use crate::error::TransferHookError;

/// Verifies a blacklister role PDA from sss-core without CPI.
/// Re-derives the expected PDA and checks owner + address match.
pub fn verify_blacklister_for_mint(
    blacklister_role: &AccountInfo,
    mint_key: &Pubkey,
    authority_key: &Pubkey,
) -> Result<()> {
    require!(
        blacklister_role.owner == &SSS_CORE_PROGRAM_ID,
        TransferHookError::Unauthorized
    );

    let (sss_config_pda, _) =
        Pubkey::find_program_address(&[SSS_CONFIG_SEED, mint_key.as_ref()], &SSS_CORE_PROGRAM_ID);

    let (expected_pda, _) = Pubkey::find_program_address(
        &[
            SSS_ROLE_SEED,
            sss_config_pda.as_ref(),
            authority_key.as_ref(),
            &[5u8], // Role::Blacklister = 5
        ],
        &SSS_CORE_PROGRAM_ID,
    );

    require!(
        blacklister_role.key() == expected_pda,
        TransferHookError::Unauthorized
    );

    Ok(())
}
