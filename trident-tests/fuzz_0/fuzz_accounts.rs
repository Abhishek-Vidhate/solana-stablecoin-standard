use trident_fuzz::fuzzing::*;

/// Storage for all account addresses used in fuzz testing.
///
/// This struct serves as a centralized repository for account addresses,
/// enabling their reuse across different instruction flows and test scenarios.
///
/// Docs: https://ackee.xyz/trident/docs/latest/trident-api-macro/trident-types/fuzz-accounts/
#[derive(Default)]
pub struct AccountAddresses {
    pub blacklister: AddressStorage,

    pub blacklister_role: AddressStorage,

    pub mint: AddressStorage,

    pub address: AddressStorage,

    pub blacklist_entry: AddressStorage,

    pub system_program: AddressStorage,

    pub payer: AddressStorage,

    pub extra_account_metas: AddressStorage,

    pub source: AddressStorage,

    pub destination: AddressStorage,

    pub authority: AddressStorage,

    pub sender_blacklist: AddressStorage,

    pub receiver_blacklist: AddressStorage,

    pub new_authority: AddressStorage,

    pub old_authority: AddressStorage,

    pub config: AddressStorage,

    pub old_admin_role: AddressStorage,

    pub new_admin_role: AddressStorage,

    pub burner: AddressStorage,

    pub burner_role: AddressStorage,

    pub from: AddressStorage,

    pub token_program: AddressStorage,

    pub freezer: AddressStorage,

    pub freezer_role: AddressStorage,

    pub token_account: AddressStorage,

    pub admin: AddressStorage,

    pub admin_role: AddressStorage,

    pub grantee: AddressStorage,

    pub role_account: AddressStorage,

    pub minter: AddressStorage,

    pub minter_role: AddressStorage,

    pub to: AddressStorage,

    pub pauser: AddressStorage,

    pub pauser_role: AddressStorage,

    pub seizer: AddressStorage,

    pub seizer_role: AddressStorage,

    pub fee_destination: AddressStorage,
}
