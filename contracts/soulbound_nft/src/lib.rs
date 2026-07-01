#![no_std]

// ─────────────────────────────────────────────────────────────────────────────
// SoulboundNft — SEP-0041 identity token for Identizy
//
// Each verified user can mint exactly one non-transferable NFT.
// Minting requires a verified credential in the AgeVerifier contract
// (checked via cross-contract call to `has_credential_by_address`).
//
// Tiers and fees (USDC, 7 decimals):
//   0 = Basic   → $10.00   (any avatar URI)
//   1 = Premium → $25.00   (premium badge)
//   2 = Rare    → $100.00  (exclusive badge)
//
// SEP-0041 compliance:
//   transfer / transfer_from / approve / burn_from → always error (soulbound)
//   burn → allowed (user can voluntarily revoke their own token)
//   balance → 1 if holds token, 0 otherwise
//   decimals → 0  (non-fungible)
// ─────────────────────────────────────────────────────────────────────────────

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    token, vec, Address, Env, String, Symbol,
};

// ── Fee constants (USDC, 7 decimals) ─────────────────────────────────────────

const BASIC_FEE:   i128 = 100_000_000;   // $10.00
const PREMIUM_FEE: i128 = 250_000_000;   // $25.00
const RARE_FEE:    i128 = 1_000_000_000; // $100.00

// ── Storage TTL ───────────────────────────────────────────────────────────────

const TTL_MIN: u32 = 17_280;   // ~1 day
const TTL_MAX: u32 = 518_400;  // ~30 days

// ── Errors ────────────────────────────────────────────────────────────────────

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum SoulboundNftError {
    NotInitialized  = 0,
    AlreadyInit     = 1,
    NoCredential    = 2, // caller has no verified credential in age_verifier
    AlreadyMinted   = 3, // this address already has a token
    NonTransferable = 4, // soulbound: transfer/approve not allowed
    InvalidTier     = 5, // tier must be 0, 1, or 2
    NotTokenHolder  = 6, // caller doesn't own a token
}

// ── Storage keys ──────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    AgeVerifier,          // Address — age_verifier contract to verify credentials
    Admin,                // Address
    Treasury,             // Address — receives mint fees
    UsdcToken,            // Address — USDC SAC contract
    TokenHolder(Address), // bool    — whether this address holds a token
    AvatarUri(Address),   // String  — IPFS/HTTPS URI of the chosen avatar
    AvatarTier(Address),  // u32     — tier at time of mint
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct SoulboundNft;

#[contractimpl]
impl SoulboundNft {

    /// Initialize once after deploy.
    ///
    /// `age_verifier` — address of the AgeVerifier contract on this network.
    pub fn initialize(
        env: Env,
        age_verifier: Address,
        admin: Address,
        treasury: Address,
        usdc_token: Address,
    ) -> Result<(), SoulboundNftError> {
        if env.storage().instance().has(&DataKey::AgeVerifier) {
            return Err(SoulboundNftError::AlreadyInit);
        }
        env.storage().instance().extend_ttl(TTL_MIN, TTL_MAX);
        env.storage().instance().set(&DataKey::AgeVerifier, &age_verifier);
        env.storage().instance().set(&DataKey::Admin,       &admin);
        env.storage().instance().set(&DataKey::Treasury,    &treasury);
        env.storage().instance().set(&DataKey::UsdcToken,   &usdc_token);
        Ok(())
    }

    /// Mint a soulbound identity NFT.
    ///
    /// Requirements:
    ///   - `to` must have a verified credential in age_verifier
    ///   - `to` must not already have a token (one per address)
    ///   - `tier`: 0 = Basic ($10), 1 = Premium ($25), 2 = Rare ($100)
    ///   - `avatar_uri`: IPFS or HTTPS URI pointing to the avatar image
    ///
    /// The tier fee is forwarded directly to the treasury (same as age_verifier model).
    pub fn mint(
        env: Env,
        to: Address,
        tier: u32,
        avatar_uri: String,
    ) -> Result<(), SoulboundNftError> {
        to.require_auth();
        env.storage().instance().extend_ttl(TTL_MIN, TTL_MAX);

        if tier > 2 {
            return Err(SoulboundNftError::InvalidTier);
        }
        if env.storage().persistent().has(&DataKey::TokenHolder(to.clone())) {
            return Err(SoulboundNftError::AlreadyMinted);
        }

        // Cross-contract call: verify credential exists for this address
        let age_verifier: Address = env.storage().instance()
            .get(&DataKey::AgeVerifier)
            .ok_or(SoulboundNftError::NotInitialized)?;
        let has_cred: bool = env.invoke_contract(
            &age_verifier,
            &Symbol::new(&env, "has_credential_by_address"),
            vec![&env, to.to_val()],
        );
        if !has_cred {
            return Err(SoulboundNftError::NoCredential);
        }

        // Forward tier fee directly to treasury — contract never holds USDC
        let usdc_token: Address = env.storage().instance()
            .get(&DataKey::UsdcToken)
            .ok_or(SoulboundNftError::NotInitialized)?;
        let treasury: Address = env.storage().instance()
            .get(&DataKey::Treasury)
            .ok_or(SoulboundNftError::NotInitialized)?;
        token::Client::new(&env, &usdc_token)
            .transfer(&to, &treasury, &tier_fee(tier));

        // Store token
        env.storage().persistent().set(&DataKey::TokenHolder(to.clone()), &true);
        env.storage().persistent().extend_ttl(&DataKey::TokenHolder(to.clone()), TTL_MIN, TTL_MAX);
        env.storage().persistent().set(&DataKey::AvatarUri(to.clone()), &avatar_uri);
        env.storage().persistent().extend_ttl(&DataKey::AvatarUri(to.clone()), TTL_MIN, TTL_MAX);
        env.storage().persistent().set(&DataKey::AvatarTier(to.clone()), &tier);
        env.storage().persistent().extend_ttl(&DataKey::AvatarTier(to.clone()), TTL_MIN, TTL_MAX);

        env.events().publish(("identizy_nft", "minted"), (to, tier));
        Ok(())
    }

    /// Change the avatar URI. Free — no fee charged.
    /// Only the token holder can change their own avatar.
    pub fn set_avatar(
        env: Env,
        holder: Address,
        avatar_uri: String,
    ) -> Result<(), SoulboundNftError> {
        holder.require_auth();
        if !env.storage().persistent().has(&DataKey::TokenHolder(holder.clone())) {
            return Err(SoulboundNftError::NotTokenHolder);
        }
        env.storage().persistent().set(&DataKey::AvatarUri(holder.clone()), &avatar_uri);
        env.storage().persistent().extend_ttl(&DataKey::AvatarUri(holder), TTL_MIN, TTL_MAX);
        Ok(())
    }

    /// Burn (revoke) the token. Permanently removes the NFT from the holder.
    /// Only the holder can burn their own token.
    pub fn burn(
        env: Env,
        from: Address,
        _amount: i128, // SEP-0041 signature; ignored (always 1 for NFTs)
    ) -> Result<(), SoulboundNftError> {
        from.require_auth();
        if !env.storage().persistent().has(&DataKey::TokenHolder(from.clone())) {
            return Err(SoulboundNftError::NotTokenHolder);
        }
        env.storage().persistent().remove(&DataKey::TokenHolder(from.clone()));
        env.storage().persistent().remove(&DataKey::AvatarUri(from.clone()));
        env.storage().persistent().remove(&DataKey::AvatarTier(from.clone()));
        env.events().publish(("identizy_nft", "burned"), from);
        Ok(())
    }

    // ── Metadata ──────────────────────────────────────────────────────────────

    pub fn token_uri(env: Env, id: Address) -> Option<String> {
        env.storage().persistent().get(&DataKey::AvatarUri(id))
    }

    pub fn token_tier(env: Env, id: Address) -> Option<u32> {
        env.storage().persistent().get(&DataKey::AvatarTier(id))
    }

    // ── SEP-0041 interface ────────────────────────────────────────────────────

    pub fn balance(env: Env, id: Address) -> i128 {
        if env.storage().persistent().has(&DataKey::TokenHolder(id)) { 1 } else { 0 }
    }

    pub fn decimals(_env: Env) -> u32 { 0 }

    pub fn name(env: Env) -> String {
        String::from_str(&env, "Identizy Identity")
    }

    pub fn symbol(env: Env) -> String {
        String::from_str(&env, "IDZ")
    }

    pub fn allowance(_env: Env, _from: Address, _spender: Address) -> i128 { 0 }

    pub fn approve(
        _env: Env,
        _from: Address,
        _spender: Address,
        _amount: i128,
        _expiration_ledger: u32,
    ) -> Result<(), SoulboundNftError> {
        Err(SoulboundNftError::NonTransferable)
    }

    pub fn transfer(
        _env: Env,
        _from: Address,
        _to: Address,
        _amount: i128,
    ) -> Result<(), SoulboundNftError> {
        Err(SoulboundNftError::NonTransferable)
    }

    pub fn transfer_from(
        _env: Env,
        _spender: Address,
        _from: Address,
        _to: Address,
        _amount: i128,
    ) -> Result<(), SoulboundNftError> {
        Err(SoulboundNftError::NonTransferable)
    }

    pub fn burn_from(
        _env: Env,
        _spender: Address,
        _from: Address,
        _amount: i128,
    ) -> Result<(), SoulboundNftError> {
        Err(SoulboundNftError::NonTransferable)
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn tier_fee(tier: u32) -> i128 {
    match tier {
        0 => BASIC_FEE,
        1 => PREMIUM_FEE,
        _ => RARE_FEE,
    }
}

mod test;
