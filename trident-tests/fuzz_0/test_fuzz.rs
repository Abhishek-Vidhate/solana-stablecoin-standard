use fuzz_accounts::*;
use trident_fuzz::fuzzing::*;
mod fuzz_accounts;
mod types;
use types::*;

const ROLE_ADMIN: u8 = 0;
const ROLE_MINTER: u8 = 1;
const ROLE_PAUSER: u8 = 3;
const ROLE_SEIZER: u8 = 6;

fn sss_core_id() -> Pubkey {
    pubkey!("CoREsjH41J3KezywbudJC4gHqCE1QhNWaXRbC1QjA9ei")
}

fn token_2022_id() -> Pubkey {
    pubkey!("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb")
}

fn derive_config(mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"sss-config", mint.as_ref()], &sss_core_id())
}

fn derive_role(config: &Pubkey, address: &Pubkey, role: u8) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"sss-role", config.as_ref(), address.as_ref(), &[role]],
        &sss_core_id(),
    )
}

#[derive(FuzzTestMethods)]
struct FuzzTest {
    trident: Trident,
    fuzz_accounts: AccountAddresses,
    mint_pk: Option<Pubkey>,
    config_pk: Option<Pubkey>,
}

#[flow_executor]
impl FuzzTest {
    fn new() -> Self {
        Self {
            trident: Trident::default(),
            fuzz_accounts: AccountAddresses::default(),
            mint_pk: None,
            config_pk: None,
        }
    }

    #[init]
    fn start(&mut self) {
        let payer = self.trident.payer();
        let payer_pk = payer.pubkey();

        let mint_kp = Keypair::new();
        let mint_pk = mint_kp.pubkey();
        let (config_pda, _) = derive_config(&mint_pk);
        let (admin_role_pda, _) = derive_role(&config_pda, &payer_pk, ROLE_ADMIN);

        self.fuzz_accounts.mint.insert_with_address(mint_pk);
        self.fuzz_accounts.config.insert_with_address(config_pda);
        self.fuzz_accounts.admin.insert_with_address(payer_pk);
        self.fuzz_accounts.admin_role.insert_with_address(admin_role_pda);

        let init_ix = sss_core::InitializeInstruction::data(
            sss_core::InitializeInstructionData::new(InitializeArgs::new(
                1, // SSS-1 preset
                "FuzzCoin".to_string(),
                "FUZZ".to_string(),
                "https://fuzz.test".to_string(),
                6,
                Some(1_000_000_000_000),
                None,
                None,
                None,
                None,
                None,
                None,
            )),
        )
        .accounts(sss_core::InitializeInstructionAccounts::new(
            payer_pk,
            config_pda,
            mint_pk,
            admin_role_pda,
            token_2022_id(),
        ))
        .instruction();

        let result = self.trident.process_transaction(&[init_ix], Some("initialize"));

        if result.is_success() {
            self.mint_pk = Some(mint_pk);
            self.config_pk = Some(config_pda);
        }
    }

    #[flow]
    fn flow_mint_tokens(&mut self) {
        let Some(mint_pk) = self.mint_pk else { return };
        let Some(config_pk) = self.config_pk else { return };

        let payer = self.trident.payer();
        let payer_pk = payer.pubkey();
        let (minter_role, _) = derive_role(&config_pk, &payer_pk, ROLE_MINTER);

        let grant_ix = sss_core::GrantRoleInstruction::data(
            sss_core::GrantRoleInstructionData::new(ROLE_MINTER),
        )
        .accounts(sss_core::GrantRoleInstructionAccounts::new(
            payer_pk,
            config_pk,
            self.fuzz_accounts.admin_role.get(&mut self.trident).unwrap_or(payer_pk),
            payer_pk,
            minter_role,
        ))
        .instruction();

        let _ = self.trident.process_transaction(&[grant_ix], Some("grant_minter"));

        let to = payer_pk;
        let amounts = [1u64, 1000, 1_000_000, u64::MAX / 2];
        let idx = self.trident.get_current_timestamp() as usize % amounts.len();
        let amount = amounts[idx];

        let mint_ix = sss_core::MintTokensInstruction::data(
            sss_core::MintTokensInstructionData::new(amount),
        )
        .accounts(sss_core::MintTokensInstructionAccounts::new(
            payer_pk,
            config_pk,
            minter_role,
            mint_pk,
            to,
            token_2022_id(),
        ))
        .instruction();

        let result = self.trident.process_transaction(&[mint_ix], Some("mint_tokens"));

        if amount > 1_000_000_000_000 {
            assert!(result.is_error(), "Mint beyond supply cap should fail");
        }
    }

    #[flow]
    fn flow_pause_unpause(&mut self) {
        let Some(config_pk) = self.config_pk else { return };

        let payer = self.trident.payer();
        let payer_pk = payer.pubkey();
        let (pauser_role, _) = derive_role(&config_pk, &payer_pk, ROLE_PAUSER);

        let grant_ix = sss_core::GrantRoleInstruction::data(
            sss_core::GrantRoleInstructionData::new(ROLE_PAUSER),
        )
        .accounts(sss_core::GrantRoleInstructionAccounts::new(
            payer_pk,
            config_pk,
            self.fuzz_accounts.admin_role.get(&mut self.trident).unwrap_or(payer_pk),
            payer_pk,
            pauser_role,
        ))
        .instruction();

        let _ = self.trident.process_transaction(&[grant_ix], Some("grant_pauser"));

        let pause_ix = sss_core::PauseInstruction::data(sss_core::PauseInstructionData::new())
            .accounts(sss_core::PauseInstructionAccounts::new(
                payer_pk,
                config_pk,
                pauser_role,
            ))
            .instruction();

        let _ = self.trident.process_transaction(&[pause_ix], Some("pause"));

        let unpause_ix =
            sss_core::UnpauseInstruction::data(sss_core::UnpauseInstructionData::new())
                .accounts(sss_core::UnpauseInstructionAccounts::new(
                    payer_pk,
                    config_pk,
                    pauser_role,
                ))
                .instruction();

        let _ = self.trident.process_transaction(&[unpause_ix], Some("unpause"));
    }

    #[flow]
    fn flow_role_management(&mut self) {
        let Some(config_pk) = self.config_pk else { return };

        let payer = self.trident.payer();
        let payer_pk = payer.pubkey();
        let admin_role_pda = self
            .fuzz_accounts
            .admin_role
            .get(&mut self.trident)
            .unwrap_or(payer_pk);

        let grantee = Keypair::new();
        let grantee_pk = grantee.pubkey();

        let roles_to_test = [ROLE_MINTER, 2u8, ROLE_PAUSER, 4, 5, ROLE_SEIZER];
        let idx = self.trident.get_current_timestamp() as usize % roles_to_test.len();
        let role = roles_to_test[idx];

        let (role_pda, _) = derive_role(&config_pk, &grantee_pk, role);

        let grant_ix = sss_core::GrantRoleInstruction::data(
            sss_core::GrantRoleInstructionData::new(role),
        )
        .accounts(sss_core::GrantRoleInstructionAccounts::new(
            payer_pk,
            config_pk,
            admin_role_pda,
            grantee_pk,
            role_pda,
        ))
        .instruction();

        let result = self.trident.process_transaction(&[grant_ix], Some("grant_role"));

        if result.is_success() {
            let revoke_ix = sss_core::RevokeRoleInstruction::data(
                sss_core::RevokeRoleInstructionData::new(),
            )
            .accounts(sss_core::RevokeRoleInstructionAccounts::new(
                payer_pk,
                config_pk,
                admin_role_pda,
                role_pda,
            ))
            .instruction();

            let _ = self.trident.process_transaction(&[revoke_ix], Some("revoke_role"));
        }

        let invalid_role = 7u8;
        let (invalid_role_pda, _) = derive_role(&config_pk, &grantee_pk, invalid_role);
        let invalid_grant_ix = sss_core::GrantRoleInstruction::data(
            sss_core::GrantRoleInstructionData::new(invalid_role),
        )
        .accounts(sss_core::GrantRoleInstructionAccounts::new(
            payer_pk,
            config_pk,
            admin_role_pda,
            grantee_pk,
            invalid_role_pda,
        ))
        .instruction();

        let result = self
            .trident
            .process_transaction(&[invalid_grant_ix], Some("grant_invalid_role"));
        assert!(result.is_error(), "Granting invalid role (7) should fail");
    }

    #[flow]
    fn flow_supply_cap(&mut self) {
        let Some(config_pk) = self.config_pk else { return };

        let payer = self.trident.payer();
        let payer_pk = payer.pubkey();
        let admin_role_pda = self
            .fuzz_accounts
            .admin_role
            .get(&mut self.trident)
            .unwrap_or(payer_pk);

        let small_cap = 100u64;
        let update_ix = sss_core::UpdateSupplyCapInstruction::data(
            sss_core::UpdateSupplyCapInstructionData::new(Some(small_cap)),
        )
        .accounts(sss_core::UpdateSupplyCapInstructionAccounts::new(
            payer_pk,
            config_pk,
            admin_role_pda,
        ))
        .instruction();

        let _ = self.trident.process_transaction(&[update_ix], Some("update_cap"));

        let clear_ix = sss_core::UpdateSupplyCapInstruction::data(
            sss_core::UpdateSupplyCapInstructionData::new(None),
        )
        .accounts(sss_core::UpdateSupplyCapInstructionAccounts::new(
            payer_pk,
            config_pk,
            admin_role_pda,
        ))
        .instruction();

        let _ = self.trident.process_transaction(&[clear_ix], Some("clear_cap"));
    }

    #[flow]
    fn flow_fee_management(&mut self) {
        let Some(mint_pk) = self.mint_pk else { return };
        let Some(config_pk) = self.config_pk else { return };

        let payer = self.trident.payer();
        let payer_pk = payer.pubkey();
        let admin_role_pda = self
            .fuzz_accounts
            .admin_role
            .get(&mut self.trident)
            .unwrap_or(payer_pk);

        let fee_ix = sss_core::UpdateTransferFeeInstruction::data(
            sss_core::UpdateTransferFeeInstructionData::new(100, 1_000_000),
        )
        .accounts(sss_core::UpdateTransferFeeInstructionAccounts::new(
            payer_pk,
            config_pk,
            admin_role_pda,
            mint_pk,
            token_2022_id(),
        ))
        .instruction();

        let result = self.trident.process_transaction(&[fee_ix], Some("update_fee"));
        assert!(
            result.is_error(),
            "UpdateTransferFee on SSS-1 should fail (requires SSS-4)"
        );

        let invalid_fee_ix = sss_core::UpdateTransferFeeInstruction::data(
            sss_core::UpdateTransferFeeInstructionData::new(15000, 0),
        )
        .accounts(sss_core::UpdateTransferFeeInstructionAccounts::new(
            payer_pk,
            config_pk,
            admin_role_pda,
            mint_pk,
            token_2022_id(),
        ))
        .instruction();

        let result = self
            .trident
            .process_transaction(&[invalid_fee_ix], Some("invalid_fee_bps"));
        assert!(result.is_error(), "Basis points > 10000 should fail");
    }

    #[flow]
    fn flow_authority_transfer(&mut self) {
        let Some(config_pk) = self.config_pk else { return };

        let payer = self.trident.payer();
        let payer_pk = payer.pubkey();
        let admin_role_pda = self
            .fuzz_accounts
            .admin_role
            .get(&mut self.trident)
            .unwrap_or(payer_pk);

        let new_authority = Keypair::new();
        let new_authority_pk = new_authority.pubkey();

        let propose_ix = sss_core::ProposeAuthorityInstruction::data(
            sss_core::ProposeAuthorityInstructionData::new(),
        )
        .accounts(sss_core::ProposeAuthorityInstructionAccounts::new(
            payer_pk,
            config_pk,
            admin_role_pda,
            new_authority_pk,
        ))
        .instruction();

        let _ = self
            .trident
            .process_transaction(&[propose_ix], Some("propose_authority"));
    }

    #[end]
    fn end(&mut self) {
        if let Some(config_pk) = self.config_pk {
            let account = self.trident.get_account(&config_pk);
            let data = account.data();

            if data.len() > 8 {
                let offset = 8 + 32 + 32 + 1 + 1 + 1; // skip discriminator + authority + mint + preset + paused + has_supply_cap
                if data.len() >= offset + 8 + 8 + 8 {
                    let total_minted =
                        u64::from_le_bytes(data[offset + 8..offset + 16].try_into().unwrap());
                    let total_burned =
                        u64::from_le_bytes(data[offset + 16..offset + 24].try_into().unwrap());
                    assert!(
                        total_minted >= total_burned,
                        "Supply invariant violated: minted ({}) < burned ({})",
                        total_minted,
                        total_burned
                    );
                }
            }
        }
    }
}

fn main() {
    FuzzTest::fuzz(1000, 100);
}
