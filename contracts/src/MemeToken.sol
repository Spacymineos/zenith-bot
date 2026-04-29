// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MemeToken — fixed-supply ERC-20 deployed by MemeCoinFactory
contract MemeToken is ERC20, Ownable {
    // ── Metadata ─────────────────────────────────────────────────────────────
    address public immutable creator;
    uint256 public immutable deployedAt;

    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 1e18;

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor(
        string memory name_,
        string memory symbol_,
        address creator_
    ) ERC20(name_, symbol_) Ownable(creator_) {
        creator = creator_;
        deployedAt = block.timestamp;
        _mint(creator_, INITIAL_SUPPLY);
    }

    // No additional mint — fixed supply forever
}
