# ZK Stellar — Makefile
# Prerequisites: Rust + stellar-cli (run scripts/setup.sh)

NETWORK      ?= testnet
ACCOUNT      ?= alice
CONTRACT_DIR  = contracts/age_verifier
CIRCUITS_DIR  = circuits/age_verifier
PTAU          = circuits/age_verifier/powersOfTau28_hez_final_12.ptau

.PHONY: setup circuits build test deploy initialize clean

# ─── Setup ────────────────────────────────────────────────────

setup:
	bash scripts/setup.sh

# ─── Circuits ─────────────────────────────────────────────────

$(PTAU):
	@echo "==> Copying ptau from reference implementation..."
	cp zk-threshold-proof-saas/packages/circuits/powersOfTau28_hez_final_12.ptau $(PTAU)

circuits: $(PTAU)
	@echo "==> Installing circomlib..."
	npm install --prefix circuits circomlib --silent

	@echo "==> Compiling Circom circuit..."
	circom $(CIRCUITS_DIR)/age_verifier.circom \
		--r1cs --wasm --sym \
		--output $(CIRCUITS_DIR) \
		-l circuits/node_modules

	@echo "==> Groth16 setup..."
	snarkjs groth16 setup \
		$(CIRCUITS_DIR)/age_verifier.r1cs \
		$(PTAU) \
		$(CIRCUITS_DIR)/circuit_0000.zkey

	@echo "==> Contributing to ceremony..."
	snarkjs zkey contribute \
		$(CIRCUITS_DIR)/circuit_0000.zkey \
		$(CIRCUITS_DIR)/circuit_final.zkey \
		--name="hackathon contribution" -v

	@echo "==> Exporting verification key..."
	snarkjs zkey export verificationkey \
		$(CIRCUITS_DIR)/circuit_final.zkey \
		$(CIRCUITS_DIR)/verification_key.json

	@echo "==> Generating sample proof..."
	node scripts/generate_proof.js 946684800 18 1719878400 > $(CIRCUITS_DIR)/proof_sample.json

	@echo "==> Copying artifacts to frontend/public/circuits/ ..."
	mkdir -p frontend/public/circuits
	cp $(CIRCUITS_DIR)/age_verifier_js/age_verifier.wasm frontend/public/circuits/
	cp $(CIRCUITS_DIR)/circuit_final.zkey              frontend/public/circuits/
	cp $(CIRCUITS_DIR)/verification_key.json           frontend/public/circuits/

	@echo "✓ Circuit compiled. Artifacts in $(CIRCUITS_DIR)/ and frontend/public/circuits/"

# ─── Contract ─────────────────────────────────────────────────

build:
	stellar contract build

test:
	cargo test -p age-verifier

# ─── Deployment ───────────────────────────────────────────────

deploy: build
	@echo "==> Deploying to $(NETWORK)..."
	stellar contract deploy \
		--wasm target/wasm32-unknown-unknown/release/age_verifier.wasm \
		--source $(ACCOUNT) \
		--network $(NETWORK) \
	| tee .contract_id
	@echo "==> Contract ID saved to .contract_id"

initialize: .contract_id
	@echo "==> Converting VK to Soroban format..."
	@VK=$$(node scripts/convert_vk.js $(CIRCUITS_DIR)/verification_key.json); \
	CONTRACT_ID=$$(cat .contract_id); \
	echo "Contract: $$CONTRACT_ID"; \
	echo "VK: $$VK"
	@echo ""
	@echo "Run the initialize invocation manually with the VK above:"
	@echo "  stellar contract invoke --id <ID> --source $(ACCOUNT) --network $(NETWORK) -- initialize --vk '<VK_JSON>'"

# ─── Proof generation (off-chain) ─────────────────────────────

proof:
	@if [ -z "$(BIRTH)" ]; then echo "Usage: make proof BIRTH=<timestamp> AGE=18"; exit 1; fi
	node scripts/generate_proof.js $(BIRTH) $(or $(AGE),18)

verify-local:
	snarkjs groth16 verify \
		$(CIRCUITS_DIR)/verification_key.json \
		$(CIRCUITS_DIR)/proof_sample.json \
		$(CIRCUITS_DIR)/public.json

# ─── Cleanup ──────────────────────────────────────────────────

clean:
	rm -f $(CIRCUITS_DIR)/age_verifier.r1cs \
		$(CIRCUITS_DIR)/age_verifier.sym \
		$(CIRCUITS_DIR)/circuit_0000.zkey \
		$(CIRCUITS_DIR)/circuit_final.zkey \
		$(CIRCUITS_DIR)/proof_sample.json \
		$(CIRCUITS_DIR)/public.json \
		$(CIRCUITS_DIR)/witness.wtns
	rm -rf $(CIRCUITS_DIR)/age_verifier_js
	cargo clean
