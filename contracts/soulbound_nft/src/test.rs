#![cfg(test)]
extern crate std;

use soroban_sdk::{
    testutils::Address as _,
    Address, Env, String,
};

use crate::{SoulboundNft, SoulboundNftClient, SoulboundNftError};

// ── Helpers ───────────────────────────────────────────────────────────────────

fn setup(env: &Env) -> SoulboundNftClient<'_> {
    SoulboundNftClient::new(env, &env.register(SoulboundNft {}, ()))
}

fn avatar(env: &Env) -> String {
    String::from_str(env, "ipfs://QmTestAvatarHash")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[test]
fn test_double_initialize_rejected() {
    let env = Env::default();
    let client = setup(&env);
    let age_verifier = Address::generate(&env);
    let admin        = Address::generate(&env);
    let treasury     = Address::generate(&env);
    let usdc         = Address::generate(&env);

    client.initialize(&age_verifier, &admin, &treasury, &usdc);

    let result = client.try_initialize(&age_verifier, &admin, &treasury, &usdc);
    assert_eq!(result, Err(Ok(SoulboundNftError::AlreadyInit)));
}

#[test]
fn test_invalid_tier_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);
    let age_verifier = Address::generate(&env);
    let admin        = Address::generate(&env);
    let treasury     = Address::generate(&env);
    let usdc         = Address::generate(&env);
    client.initialize(&age_verifier, &admin, &treasury, &usdc);

    let user = Address::generate(&env);
    let result = client.try_mint(&user, &3u32, &avatar(&env));
    assert_eq!(result, Err(Ok(SoulboundNftError::InvalidTier)));
}

#[test]
fn test_balance_zero_before_mint() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);
    let age_verifier = Address::generate(&env);
    let admin        = Address::generate(&env);
    let treasury     = Address::generate(&env);
    let usdc         = Address::generate(&env);
    client.initialize(&age_verifier, &admin, &treasury, &usdc);

    let user = Address::generate(&env);
    assert_eq!(client.balance(&user), 0);
    assert_eq!(client.token_uri(&user), None);
    assert_eq!(client.token_tier(&user), None);
}

#[test]
fn test_transfer_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);
    let age_verifier = Address::generate(&env);
    let admin        = Address::generate(&env);
    let treasury     = Address::generate(&env);
    let usdc         = Address::generate(&env);
    client.initialize(&age_verifier, &admin, &treasury, &usdc);

    let from = Address::generate(&env);
    let to   = Address::generate(&env);
    let result = client.try_transfer(&from, &to, &1i128);
    assert_eq!(result, Err(Ok(SoulboundNftError::NonTransferable)));
}

#[test]
fn test_approve_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);
    let age_verifier = Address::generate(&env);
    let admin        = Address::generate(&env);
    let treasury     = Address::generate(&env);
    let usdc         = Address::generate(&env);
    client.initialize(&age_verifier, &admin, &treasury, &usdc);

    let from    = Address::generate(&env);
    let spender = Address::generate(&env);
    let result  = client.try_approve(&from, &spender, &1i128, &1000u32);
    assert_eq!(result, Err(Ok(SoulboundNftError::NonTransferable)));
}

#[test]
fn test_allowance_always_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);
    let age_verifier = Address::generate(&env);
    let admin        = Address::generate(&env);
    let treasury     = Address::generate(&env);
    let usdc         = Address::generate(&env);
    client.initialize(&age_verifier, &admin, &treasury, &usdc);

    let from    = Address::generate(&env);
    let spender = Address::generate(&env);
    assert_eq!(client.allowance(&from, &spender), 0);
}

#[test]
fn test_metadata() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);
    let age_verifier = Address::generate(&env);
    let admin        = Address::generate(&env);
    let treasury     = Address::generate(&env);
    let usdc         = Address::generate(&env);
    client.initialize(&age_verifier, &admin, &treasury, &usdc);

    assert_eq!(client.decimals(), 0);
    assert_eq!(client.name(),   String::from_str(&env, "Identizy Identity"));
    assert_eq!(client.symbol(), String::from_str(&env, "IDZ"));
}

#[test]
fn test_set_avatar_without_token_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let client = setup(&env);
    let age_verifier = Address::generate(&env);
    let admin        = Address::generate(&env);
    let treasury     = Address::generate(&env);
    let usdc         = Address::generate(&env);
    client.initialize(&age_verifier, &admin, &treasury, &usdc);

    let user   = Address::generate(&env);
    let result = client.try_set_avatar(&user, &avatar(&env));
    assert_eq!(result, Err(Ok(SoulboundNftError::NotTokenHolder)));
}

// TODO: add test_mint_and_burn after full proof round-trip is available.
// The mint flow requires a live age_verifier cross-contract call returning true.
// Approach: deploy a mock age_verifier that always returns true for has_credential_by_address,
// then test mint → balance=1 → burn → balance=0.
