// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title PriceOracle — owner-managed USD price feed used by all Zenith contracts
contract PriceOracle is AccessControl {
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    // ── State ────────────────────────────────────────────────────────────────
    struct PriceData {
        uint256 price;       // 18-decimal USD price
        uint256 updatedAt;   // block.timestamp of last update
    }

    mapping(bytes32 => PriceData) private _prices;

    // ── Events ───────────────────────────────────────────────────────────────
    event PriceUpdated(bytes32 indexed asset, uint256 price, uint256 timestamp);

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPDATER_ROLE, admin);
    }

    // ── Owner Functions ──────────────────────────────────────────────────────

    /// @notice Set the USD price for an asset (18 decimals)
    function setPrice(bytes32 asset, uint256 usdPriceIn18Decimals) external onlyRole(UPDATER_ROLE) {
        _prices[asset] = PriceData({
            price: usdPriceIn18Decimals,
            updatedAt: block.timestamp
        });
        emit PriceUpdated(asset, usdPriceIn18Decimals, block.timestamp);
    }

    // ── Public Read ──────────────────────────────────────────────────────────

    /// @notice Get the USD price for an asset (18 decimals)
    function getPrice(bytes32 asset) external view returns (uint256) {
        PriceData memory d = _prices[asset];
        require(d.updatedAt > 0, "PriceOracle: no price set");
        return d.price;
    }

    /// @notice Get price along with its last-update timestamp
    function getPriceData(bytes32 asset) external view returns (uint256 price, uint256 updatedAt) {
        PriceData memory d = _prices[asset];
        require(d.updatedAt > 0, "PriceOracle: no price set");
        return (d.price, d.updatedAt);
    }

    /// @notice Convenience: encode a string ticker to bytes32
    function toKey(string calldata ticker) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(ticker));
    }
}
