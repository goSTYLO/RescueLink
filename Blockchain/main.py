"""
RescueLink Blockchain Service - FastAPI
Stores verified incident hashes on Ganache for tamper-proof audit trail.
"""

import logging
import time
import uuid
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.incident_registry import is_connected, record_incident_on_blockchain

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


@app.middleware("http")
async def add_request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    return response


class VerifyIncidentRequest(BaseModel):
    report_id: int
    incident_data: dict[str, Any]


class VerifyIncidentResponse(BaseModel):
    hash_value: str
    tx_hash: str
    block_number: int
    gas_used: int
    effective_gas_price: str
    gas_cost_wei: str
    already_recorded: bool


@app.get("/health")
def health_check() -> dict[str, Any]:
    """Health check and Ganache connection status."""
    ganache_ok = is_connected()
    return {
        "status": "healthy" if ganache_ok else "degraded",
        "ganache_connected": ganache_ok,
    }


@app.post("/verify-incident", response_model=VerifyIncidentResponse)
def verify_incident(req: VerifyIncidentRequest, request: Request) -> VerifyIncidentResponse:
    """
    Record a verified incident hash on the blockchain.
    Creates SHA-256 hash of incident data and stores it in a Ganache transaction.
    """
    started_at = time.time()
    request_id = getattr(request.state, "request_id", "none")
    try:
        logger.info(
            "[blockchain][verify] request_id=%s report_id=%s status=start",
            request_id,
            req.report_id,
        )
        result = record_incident_on_blockchain(req.report_id, req.incident_data)
        elapsed_ms = int((time.time() - started_at) * 1000)
        logger.info(
            "[blockchain][verify] request_id=%s report_id=%s status=success latency_ms=%s tx_hash=%s",
            request_id,
            req.report_id,
            elapsed_ms,
            (result["tx_hash"] or "")[:12],
        )
        return VerifyIncidentResponse(
            hash_value=result["hash_value"],
            tx_hash=result["tx_hash"],
            block_number=result["block_number"],
            gas_used=result["gas_used"],
            effective_gas_price=result["effective_gas_price"],
            gas_cost_wei=result["gas_cost_wei"],
            already_recorded=result.get("already_recorded", False),
        )
    except ValueError as e:
        logger.warning(
            "[blockchain][verify] request_id=%s report_id=%s status=bad_request latency_ms=%s error=%s",
            request_id,
            req.report_id,
            int((time.time() - started_at) * 1000),
            str(e),
        )
        raise HTTPException(status_code=400, detail=str(e))
    except ConnectionError as e:
        logger.error(
            "[blockchain][verify] request_id=%s report_id=%s status=unavailable latency_ms=%s error=%s",
            request_id,
            req.report_id,
            int((time.time() - started_at) * 1000),
            str(e),
        )
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.exception(
            "[blockchain][verify] request_id=%s report_id=%s status=error latency_ms=%s error=%s",
            request_id,
            req.report_id,
            int((time.time() - started_at) * 1000),
            e,
        )
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
