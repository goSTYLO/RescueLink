#!/usr/bin/env python3
"""
Compares gas usage between events-only and storage-based IncidentRegistry contracts.
Outputs JSON to stdout for consumption by Node.js gas optimization tests.
"""
import json
import os
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from web3 import Web3

BLOCKCHAIN_ROOT = Path(__file__).resolve().parent.parent
GANACHE_URL = os.getenv("GANACHE_URL", "http://127.0.0.1:8545")
PRIVATE_KEY = (os.getenv("PRIVATE_KEY", "") or "").strip()


def compile_contract(contract_name: str, contract_file: str):
    """Compile a Solidity contract and return (abi, bytecode)."""
    import solcx

    try:
        solcx.install_solc("0.8.17")
        solcx.set_solc_version("0.8.17")
    except Exception:
        try:
            solcx.set_solc_version("0.8.17")
        except Exception:
            pass

    contract_path = BLOCKCHAIN_ROOT / "contracts" / contract_file
    compiled = solcx.compile_files(
        [str(contract_path)],
        output_values=["abi", "bin"],
        allow_paths=[str(BLOCKCHAIN_ROOT)],
        evm_version="london",
    )

    key = None
    for k in compiled:
        if k.endswith(f":{contract_name}"):
            key = k
            break
    if not key:
        key = list(compiled.keys())[0]

    data = compiled[key]
    return data["abi"], data["bin"]


def main():
    if not PRIVATE_KEY or len(PRIVATE_KEY) != 66 or not PRIVATE_KEY.startswith("0x"):
        print(json.dumps({"error": "PRIVATE_KEY not set or invalid"}), file=sys.stderr)
        sys.exit(1)

    w3 = Web3(Web3.HTTPProvider(GANACHE_URL))
    if not w3.is_connected():
        print(json.dumps({"error": "Cannot connect to Ganache"}), file=sys.stderr)
        sys.exit(1)

    account = w3.eth.account.from_key(PRIVATE_KEY)
    report_id = int(os.getenv("GAS_COMPARISON_REPORT_ID", "999999999"))
    hash_bytes = bytes(32)  # 32 zero bytes for consistent comparison

    result = {"events": None, "storage": None, "error": None}

    # Deploy and call events-only contract
    try:
        abi, bytecode = compile_contract("IncidentRegistry", "IncidentRegistry.sol")
        contract = w3.eth.contract(abi=abi, bytecode=bytecode)
        deploy_tx = contract.constructor().transact({"from": account.address})
        deploy_receipt = w3.eth.wait_for_transaction_receipt(deploy_tx)
        address = deploy_receipt["contractAddress"]

        contract_instance = w3.eth.contract(address=address, abi=abi)
        call_tx = contract_instance.functions.recordIncident(hash_bytes).transact(
            {"from": account.address}
        )
        call_receipt = w3.eth.wait_for_transaction_receipt(call_tx)
        result["events"] = {
            "gas_used": int(call_receipt.get("gasUsed") or 0),
            "effective_gas_price": str(call_receipt.get("effectiveGasPrice") or 0),
        }
    except Exception as e:
        result["error"] = str(e)
        print(json.dumps(result))
        sys.exit(1)

    # Deploy and call storage contract (use different report_id to avoid conflict)
    try:
        storage_report_id = report_id + 1
        abi, bytecode = compile_contract("IncidentRegistryStorage", "IncidentRegistryStorage.sol")
        contract = w3.eth.contract(abi=abi, bytecode=bytecode)
        deploy_tx = contract.constructor().transact({"from": account.address})
        deploy_receipt = w3.eth.wait_for_transaction_receipt(deploy_tx)
        address = deploy_receipt["contractAddress"]

        contract_instance = w3.eth.contract(address=address, abi=abi)
        call_tx = contract_instance.functions.recordIncident(storage_report_id, hash_bytes).transact(
            {"from": account.address}
        )
        call_receipt = w3.eth.wait_for_transaction_receipt(call_tx)
        result["storage"] = {
            "gas_used": int(call_receipt.get("gasUsed") or 0),
            "effective_gas_price": str(call_receipt.get("effectiveGasPrice") or 0),
        }
    except Exception as e:
        result["storage_error"] = str(e)

    print(json.dumps(result))


if __name__ == "__main__":
    main()
