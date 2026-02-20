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

from services.contract import get_contract

load_dotenv()

logger = logging.getLogger(__name__)

GANACHE_URL = os.getenv("GANACHE_URL", "http://127.0.0.1:8545")
PRIVATE_KEY = os.getenv("PRIVATE_KEY", "")

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

    w3 = get_web3()
    if not w3.is_connected():
        raise ConnectionError("Cannot connect to Ganache. Ensure it is running.")

    hash_value = _create_incident_hash(report_id, incident_data)

    # SHA-256 is 32 bytes, bytes32 is 32 bytes
    hash_bytes = bytes.fromhex(hash_value)

    contract = get_contract(w3)
    account = w3.eth.account.from_key(PRIVATE_KEY.strip())

    tx_hash = contract.functions.recordIncident(
        report_id,
        hash_bytes,
    ).transact({"from": account.address})

    receipt = w3.eth.wait_for_transaction_receipt(tx_hash)

    return {
        "hash_value": hash_value,
        "tx_hash": tx_hash.hex(),
        "block_number": receipt["blockNumber"],
    }
