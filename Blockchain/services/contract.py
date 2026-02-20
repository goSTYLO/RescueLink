"""
Compile and deploy IncidentRegistry smart contract.
"""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

logger = logging.getLogger(__name__)

GANACHE_URL = os.getenv("GANACHE_URL", "http://127.0.0.1:8545")
PRIVATE_KEY = os.getenv("PRIVATE_KEY", "").strip()
CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "").strip()

# Path to contract (relative to Blockchain project root)
BLOCKCHAIN_ROOT = Path(__file__).resolve().parent.parent
CONTRACT_PATH = BLOCKCHAIN_ROOT / "contracts" / "IncidentRegistry.sol"
CONTRACT_NAME = "IncidentRegistry"

# Cached after first compile/deploy
_abi = None
_bytecode = None
_deployed_address: str | None = None


def _compile_contract() -> tuple[list, str]:
    """Compile IncidentRegistry.sol and return (abi, bytecode)."""
    import solcx

    # Use solc 0.8.17 + Paris EVM to avoid PUSH0 (Shanghai) opcode unsupported by Ganache 2.7.x
    try:
        solcx.install_solc("0.8.17")
        solcx.set_solc_version("0.8.17")
    except Exception as e:
        logger.warning("solc install/set: %s, trying default", e)
        try:
            solcx.set_solc_version("0.8.17")
        except Exception:
            pass

    compiled = solcx.compile_files(
        [str(CONTRACT_PATH)],
        output_values=["abi", "bin"],
        allow_paths=[str(BLOCKCHAIN_ROOT)],
        evm_version="london",
    )

    # Key is typically "contracts/IncidentRegistry.sol:IncidentRegistry"
    key = None
    for k in compiled:
        if k.endswith(f":{CONTRACT_NAME}"):
            key = k
            break
    if not key:
        key = list(compiled.keys())[0]

    contract_data = compiled[key]
    abi = contract_data["abi"]
    bytecode = contract_data["bin"]
    return abi, bytecode


def _deploy_contract(w3: Web3) -> str:
    """Deploy IncidentRegistry to Ganache and return contract address."""
    if not PRIVATE_KEY:
        raise ValueError(
            "PRIVATE_KEY not set. Use first Ganache account's private key from .env"
        )
    account = w3.eth.account.from_key(PRIVATE_KEY)
    abi, bytecode = _compile_contract()
    contract = w3.eth.contract(abi=abi, bytecode=bytecode)
    tx_hash = contract.constructor().transact({"from": account.address})
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    address = receipt["contractAddress"]
    logger.info(
        "Deployed IncidentRegistry at %s. Add CONTRACT_ADDRESS=%s to .env for persistence.",
        address,
        address,
    )
    return address


def get_contract_address(w3: Web3) -> str:
    """Return CONTRACT_ADDRESS from env, or deploy and return address."""
    global _deployed_address
    if CONTRACT_ADDRESS:
        return CONTRACT_ADDRESS
    if _deployed_address:
        return _deployed_address
    _deployed_address = _deploy_contract(w3)
    return _deployed_address


def get_contract(w3: Web3):
    """Return web3 contract instance for IncidentRegistry."""
    global _abi
    if _abi is None:
        _abi, _ = _compile_contract()
    address = get_contract_address(w3)
    return w3.eth.contract(address=address, abi=_abi)
