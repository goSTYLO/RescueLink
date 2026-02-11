"""
RescueLink Blockchain Service - FastAPI
Stores verified incident hashes on Ganache for tamper-proof audit trail.
"""

import logging
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.ganache import is_connected, record_incident_on_blockchain

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RescueLink Blockchain Service",
    description="Stores verified incident hashes on Ganache for audit trail",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class VerifyIncidentRequest(BaseModel):
    report_id: int
    incident_data: dict[str, Any]


class VerifyIncidentResponse(BaseModel):
    hash_value: str
    tx_hash: str
    block_number: int


@app.get("/health")
def health_check() -> dict[str, Any]:
    """Health check and Ganache connection status."""
    ganache_ok = is_connected()
    return {
        "status": "healthy" if ganache_ok else "degraded",
        "ganache_connected": ganache_ok,
    }


@app.post("/verify-incident", response_model=VerifyIncidentResponse)
def verify_incident(req: VerifyIncidentRequest) -> VerifyIncidentResponse:
    """
    Record a verified incident hash on the blockchain.
    Creates SHA-256 hash of incident data and stores it in a Ganache transaction.
    """
    try:
        result = record_incident_on_blockchain(req.report_id, req.incident_data)
        return VerifyIncidentResponse(
            hash_value=result["hash_value"],
            tx_hash=result["tx_hash"],
            block_number=result["block_number"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception("Failed to record incident on blockchain: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
