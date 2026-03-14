use anyhow::Result;
use solana_sdk::transaction::Transaction;
use solana_zk_sdk::encryption::{
    auth_encryption::AeKey,
    elgamal::ElGamalKeypair,
};
use spl_token_2022::extension::confidential_transfer::{
    account_info::ApplyPendingBalanceAccountInfo,
    instruction as ct_instruction,
    ConfidentialTransferAccount, DecryptableBalance,
};
use spl_token_2022::extension::BaseStateWithExtensions;
use spl_token_2022::state::Account as TokenAccount;
use spl_token_confidential_transfer_proof_extraction::instruction::{ProofData, ProofLocation};

use crate::config::CliContext;
use crate::utils;

/// Configure a token account for confidential transfers.
///
/// Derives an ElGamal keypair from the payer's Solana keypair, generates the
/// required pubkey validity proof, and submits the ConfigureAccount instruction.
pub fn configure_account(ctx: &CliContext, mint_str: &str, account_str: &str) -> Result<()> {
    let mint = utils::parse_pubkey(mint_str)?;
    let token_account = utils::parse_pubkey(account_str)?;
    let payer = ctx.payer_pubkey();

    let elgamal_keypair = ElGamalKeypair::new_from_signer(&ctx.payer, &token_account.to_bytes())
        .map_err(|e| anyhow::anyhow!("Failed to derive ElGamal keypair: {}", e))?;

    let aes_key = AeKey::new_from_signer(&ctx.payer, &token_account.to_bytes())
        .map_err(|e| anyhow::anyhow!("Failed to derive AES key: {}", e))?;

    let decryptable_zero_balance: DecryptableBalance = aes_key.encrypt(0_u64).into();

    let proof_data = ct_instruction::PubkeyValidityProofData::new(&elgamal_keypair)
        .map_err(|e| anyhow::anyhow!("Failed to generate pubkey validity proof: {:?}", e))?;

    let max_pending_credits =
        spl_token_2022::extension::confidential_transfer::DEFAULT_MAXIMUM_PENDING_BALANCE_CREDIT_COUNTER;

    let proof_location = ProofLocation::InstructionOffset(
        1i8.try_into().map_err(|_| anyhow::anyhow!("Invalid proof offset"))?,
        ProofData::InstructionData(&proof_data),
    );

    let ixs = ct_instruction::configure_account(
        &spl_token_2022::ID,
        &token_account,
        &mint,
        decryptable_zero_balance,
        max_pending_credits,
        &payer,
        &[],
        proof_location,
    )
    .map_err(|e| anyhow::anyhow!("Failed to build ConfigureAccount instruction: {}", e))?;

    let recent_blockhash = ctx.client.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &ixs,
        Some(&payer),
        &[&ctx.payer],
        recent_blockhash,
    );

    let sig = ctx.client.send_and_confirm_transaction(&tx)?;

    utils::print_success("Configured account for confidential transfers");
    utils::print_field("Mint", mint_str);
    utils::print_field("Token Account", account_str);
    println!();
    utils::print_tx(&sig.to_string());

    Ok(())
}

/// Deposit tokens from the public balance into the confidential pending balance.
pub fn deposit(
    ctx: &CliContext,
    mint_str: &str,
    account_str: &str,
    amount: u64,
    decimals: u8,
) -> Result<()> {
    let mint = utils::parse_pubkey(mint_str)?;
    let token_account = utils::parse_pubkey(account_str)?;
    let payer = ctx.payer_pubkey();

    let ix = ct_instruction::deposit(
        &spl_token_2022::ID,
        &token_account,
        &mint,
        amount,
        decimals,
        &payer,
        &[],
    )
    .map_err(|e| anyhow::anyhow!("Failed to build Deposit instruction: {}", e))?;

    let recent_blockhash = ctx.client.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer),
        &[&ctx.payer],
        recent_blockhash,
    );

    let sig = ctx.client.send_and_confirm_transaction(&tx)?;

    utils::print_success(&format!(
        "Deposited {} tokens to confidential pending balance",
        amount
    ));
    utils::print_field("Mint", mint_str);
    utils::print_field("Token Account", account_str);
    println!();
    utils::print_tx(&sig.to_string());

    Ok(())
}

/// Apply the pending confidential balance to the available balance.
pub fn apply_pending(ctx: &CliContext, mint_str: &str, account_str: &str) -> Result<()> {
    let _mint = utils::parse_pubkey(mint_str)?;
    let token_account = utils::parse_pubkey(account_str)?;
    let payer = ctx.payer_pubkey();

    let elgamal_keypair = ElGamalKeypair::new_from_signer(&ctx.payer, &token_account.to_bytes())
        .map_err(|e| anyhow::anyhow!("Failed to derive ElGamal keypair: {}", e))?;
    let aes_key = AeKey::new_from_signer(&ctx.payer, &token_account.to_bytes())
        .map_err(|e| anyhow::anyhow!("Failed to derive AES key: {}", e))?;

    let account_data = ctx
        .client
        .get_account(&token_account)
        .map_err(|e| anyhow::anyhow!("Failed to fetch token account: {}", e))?;

    let token_account_state =
        spl_token_2022::extension::StateWithExtensionsOwned::<TokenAccount>::unpack(account_data.data)
            .map_err(|e| anyhow::anyhow!("Failed to unpack token account: {}", e))?;

    let ct_extension = token_account_state
        .get_extension::<ConfidentialTransferAccount>()
        .map_err(|e| {
            anyhow::anyhow!(
                "Token account does not have confidential transfer extension: {}",
                e
            )
        })?;

    let account_info = ApplyPendingBalanceAccountInfo::new(ct_extension);
    let pending_credit_counter = account_info.pending_balance_credit_counter();

    let new_decryptable_balance: DecryptableBalance = account_info
        .new_decryptable_available_balance(elgamal_keypair.secret(), &aes_key)
        .map_err(|e| {
            anyhow::anyhow!("Failed to compute new decryptable balance: {:?}", e)
        })?
        .into();

    let ix = ct_instruction::apply_pending_balance(
        &spl_token_2022::ID,
        &token_account,
        pending_credit_counter,
        new_decryptable_balance,
        &payer,
        &[],
    )
    .map_err(|e| anyhow::anyhow!("Failed to build ApplyPendingBalance instruction: {}", e))?;

    let recent_blockhash = ctx.client.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&payer),
        &[&ctx.payer],
        recent_blockhash,
    );

    let sig = ctx.client.send_and_confirm_transaction(&tx)?;

    utils::print_success("Applied pending balance to available confidential balance");
    utils::print_field("Mint", mint_str);
    utils::print_field("Token Account", account_str);
    utils::print_field("Credit Counter", &pending_credit_counter.to_string());
    println!();
    utils::print_tx(&sig.to_string());

    Ok(())
}
