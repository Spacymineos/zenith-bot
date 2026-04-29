// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./MemeToken.sol";

interface IUniswapV2Factory {
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

/// @title MemeCoinFactory — deploy meme ERC-20 tokens with automatic DEX pair creation
contract MemeCoinFactory is Ownable {
    // ── State ────────────────────────────────────────────────────────────────
    IUniswapV2Factory public uniswapFactory;
    address public weth; // WZENITH address (wraps Zenith Coin)

    uint256 public creationFee = 1 ether; // default 1 Zenith Coin
    address public feeTreasury;

    address[] public allTokens;
    mapping(address => address[]) public tokensByCreator;

    // ── Events ───────────────────────────────────────────────────────────────
    event TokenCreated(
        address indexed creator,
        address indexed tokenAddress,
        address indexed pairAddress,
        string name,
        string symbol
    );
    event CreationFeeUpdated(uint256 oldFee, uint256 newFee);
    event FeesWithdrawn(address indexed treasury, uint256 amount);

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor(
        address _uniswapFactory,
        address _weth,
        address _feeTreasury,
        address _owner
    ) Ownable(_owner) {
        require(_uniswapFactory != address(0), "MemeCoinFactory: zero factory");
        require(_weth != address(0), "MemeCoinFactory: zero weth");
        require(_feeTreasury != address(0), "MemeCoinFactory: zero treasury");
        uniswapFactory = IUniswapV2Factory(_uniswapFactory);
        weth = _weth;
        feeTreasury = _feeTreasury;
    }

    // ── Public ───────────────────────────────────────────────────────────────

    /// @notice Create a new meme token and its Uniswap pair (costs creationFee Zenith Coin)
    function createToken(
        string calldata name_,
        string calldata symbol_
    ) external payable returns (address tokenAddress) {
        require(msg.value >= creationFee, "MemeCoinFactory: insufficient fee");
        require(bytes(name_).length > 0, "MemeCoinFactory: empty name");
        require(bytes(symbol_).length > 0, "MemeCoinFactory: empty symbol");

        // Deploy token — creator receives full supply
        MemeToken token = new MemeToken(name_, symbol_, msg.sender);
        tokenAddress = address(token);

        // Create Uniswap V2 pair: MemeToken / WZENITH (Zenith Coin)
        address pairAddress = uniswapFactory.createPair(tokenAddress, weth);

        allTokens.push(tokenAddress);
        tokensByCreator[msg.sender].push(tokenAddress);

        // Refund excess payment
        if (msg.value > creationFee) {
            (bool refundOk, ) = payable(msg.sender).call{value: msg.value - creationFee}("");
            require(refundOk, "MemeCoinFactory: refund failed");
        }

        // Forward fee to treasury
        (bool feeOk, ) = payable(feeTreasury).call{value: creationFee}("");
        require(feeOk, "MemeCoinFactory: fee transfer failed");

        emit TokenCreated(msg.sender, tokenAddress, pairAddress, name_, symbol_);
    }

    // ── Owner Functions ──────────────────────────────────────────────────────

    function setCreationFee(uint256 fee) external onlyOwner {
        emit CreationFeeUpdated(creationFee, fee);
        creationFee = fee;
    }

    function setFeeTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "MemeCoinFactory: zero address");
        feeTreasury = _treasury;
    }

    function setUniswapFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "MemeCoinFactory: zero address");
        uniswapFactory = IUniswapV2Factory(_factory);
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function allTokensLength() external view returns (uint256) {
        return allTokens.length;
    }

    function tokensCreatedBy(address creator) external view returns (address[] memory) {
        return tokensByCreator[creator];
    }
}
