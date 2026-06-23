#!/usr/bin/env bash
# setup.sh — Install all tooling needed for ZK Stellar development
# Run once after cloning: bash scripts/setup.sh

set -euo pipefail

echo "==> Installing Rust + wasm32 target"
if ! command -v cargo &>/dev/null; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
fi
rustup target add wasm32-unknown-unknown

echo "==> Installing Stellar CLI"
cargo install --locked stellar-cli --features opt

echo "==> Installing Node dependencies (circom, snarkjs)"
npm install -g circom snarkjs

echo "==> Installing circuit npm dependencies (circomlib)"
cd "$(dirname "$0")/.."
npm install --prefix circuits circomlib

echo "==> Installing frontend dependencies"
cd frontend
npm install
npm install snarkjs @stellar/stellar-sdk @creit.tech/stellar-wallets-kit
cd ..

echo ""
echo "✓ All tools installed."
echo ""
echo "Next steps:"
echo "  1. Run 'make circuits' to compile the Circom circuit and generate keys"
echo "  2. Run 'make build'    to compile the Soroban contract"
echo "  3. Run 'make test'     to run contract unit tests"
echo "  4. Run 'make deploy'   to deploy to Stellar testnet"
