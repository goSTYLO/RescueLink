"""
Incident logging on blockchain via IncidentRegistry contract.
Records verified incident hashes on-chain (Ganache) for tamper-proof audit trail.
"""

import hashlib
import json
import logging
import os
from typing import Any, Optional

from dotenv import load_dotenv
from web3 import Web3

from services.contract import get_contract, _is_valid_private_key

load_dotenv()

logger = logging.getLogger(__name__)

GANACHE_URL = os.getenv("GANACHE_URL", "http://127.0.0.1:8545")
PRIVATE_KEY = (os.getenv("PRIVATE_KEY", "") or "").strip()

# Web3 instance (lazy init)
_w3: Optional[Web3] = None


def get_web3() -> Web3:
    """Get Web3 instance connected to blockchain (Ganache)."""
    global _w3
    if _w3 is None:
        _w3 = Web3(Web3.HTTPProvider(GANACHE_URL))
    return _w3


def is_connected() -> bool:
    """Check if connected to blockchain (Ganache)."""
    try:
        return get_web3().is_connected()
    except Exception as e:
        logger.error("Blockchain connection check failed: %s", e)
        return False


def _create_incident_hash(report_id: int, incident_data: dict) -> str:
    """Create SHA-256 hash of incident data for tamper-proof recording."""
    payload = json.dumps(
        {"report_id": report_id, "incident": incident_data},
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def record_incident_on_blockchain(
    report_id: int, incident_data: dict
) -> dict[str, Any]:
    """
    Record verified incident hash on blockchain via IncidentRegistry contract.
    Emits IncidentVerified event with reportId and hash.
    """
    if not PRIVATE_KEY:
        raise ValueError(
            "PRIVATE_KEY not set. Use first Ganache account's private key from .env"
        )
    if not _is_valid_private_key(PRIVATE_KEY):
        raise ValueError(
            "PRIVATE_KEY in .env must be a single 0x-prefixed 64-character hex string. "
            "Check for pasted keys (e.g. two keys concatenated or extra characters)."
        )

    w3 = get_web3()
    if not w3.is_connected():
        raise ConnectionError("Cannot connect to Ganache. Ensure it is running.")

    hash_value = _create_incident_hash(report_id, incident_data)

    # SHA-256 is 32 bytes, bytes32 is 32 bytes
    hash_bytes = bytes.fromhex(hash_value)

    contract = get_contract(w3)
    account = w3.eth.account.from_key(PRIVATE_KEY)

    existing_logs = contract.events.IncidentVerified().get_logs(
        from_block=0,
        to_block="latest",
        argument_filters={"reportId": report_id},
    )
    if existing_logs:
        last_log = existing_logs[-1]
        existing_tx_hash = last_log["transactionHash"].hex()
        existing_block = int(last_log["blockNumber"])
        existing_hash_value = last_log["args"].get("hashValue")
        if isinstance(existing_hash_value, bytes):
            existing_hash_value = existing_hash_value.hex()
        elif hasattr(existing_hash_value, "hex"):
            existing_hash_value = existing_hash_value.hex()
        if isinstance(existing_hash_value, str) and existing_hash_value.startswith("0x"):
            existing_hash_value = existing_hash_value[2:]

        return {
            "hash_value": existing_hash_value or hash_value,
            "tx_hash": existing_tx_hash,
            "block_number": existing_block,
            "gas_used": 0,
            "effective_gas_price": "0",
            "gas_cost_wei": "0",
            "already_recorded": True,
        }

    tx_hash = contract.functions.recordIncident(
        report_id,
        hash_bytes,
    ).transact({"from": account.address})

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    return {
        "hash_value": hash_value,
        "tx_hash": tx_hash.hex(),
        "block_number": receipt["blockNumber"],
        "gas_used": int(receipt.get("gasUsed") or 0),
        "effective_gas_price": str(receipt.get("effectiveGasPrice") or 0),
        "gas_cost_wei": str((receipt.get("gasUsed") or 0) * (receipt.get("effectiveGasPrice") or 0)),
        "already_recorded": False,
    }
