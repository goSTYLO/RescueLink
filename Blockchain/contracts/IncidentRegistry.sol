// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract IncidentRegistry {
    event IncidentVerified(uint256 indexed reportId, bytes32 hashValue, uint256 timestamp);

    function recordIncident(uint256 reportId, bytes32 hashValue) external {
        emit IncidentVerified(reportId, hashValue, block.timestamp);
    }
}
